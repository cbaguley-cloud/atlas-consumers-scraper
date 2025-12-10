const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIGURATION ---
const CONFIG = {
    listUrl: "https://sightmap.com/manage/consumers",
    detailUrlBase: "https://sightmap.com/manage/consumers/",
    limit: 100,
    concurrentRequests: 2, // SUPER SAFE MODE: Only 2 at a time
    delayBetweenBatches: 1000, // Wait 1 second between batches
    maxRetries: 2 // Try 2 times before giving up
};

function getXsrfToken(cookieString) {
    const match = cookieString.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

async function fetchDetails(client, id, attempt = 1) {
    try {
        const response = await client.get(`${CONFIG.detailUrlBase}${id}`, { 
            responseType: 'text',
            validateStatus: status => status < 500
        });

        const html = response.data;

        // DEBUG: If we get a login page or error page, print it to terminal
        if (html.includes('<title>Login</title>')) {
            console.log(`❌ ID ${id}: Redirected to Login (Cookie Expired)`);
            return "Session Expired";
        }
        
        // STRATEGY 1: Clean JSON Extraction
        let jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
        
        if (jsonMatch && jsonMatch[1]) {
            try {
                const jsonData = JSON.parse(jsonMatch[1]);
                if (jsonData.consumer && jsonData.consumer.permissions) {
                    const perms = jsonData.consumer.permissions.map(p => p.name);
                    return perms.length > 0 ? perms.join(' | ') : "No Permissions Assigned";
                }
            } catch (e) { /* JSON parse failed, ignore */ }
        }

        // STRATEGY 2: Regex Search for raw text (Backup)
        const rawMatches = html.match(/(sightmap|unitmap)\.[\w-]+\.[\w-]+/g);
        if (rawMatches && rawMatches.length > 0) {
            return [...new Set(rawMatches)].join(' | ');
        }

        // If we got here, we found nothing.
        // If it's a 429 (Too Many Requests), throw error to trigger retry
        if (response.status === 429) throw new Error("Rate Limited");

        return "No Permissions Found";

    } catch (error) {
        // RETRY LOGIC
        if (attempt <= CONFIG.maxRetries) {
            console.log(`⚠️ ID ${id} failed (Attempt ${attempt}). Retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            return fetchDetails(client, id, attempt + 1);
        }
        
        console.error(`❌ ID ${id} Failed permanently: ${error.message}`);
        return "Extraction Failed";
    }
}

io.on('connection', (socket) => {
    socket.on('start-scrape', async (userCookie) => {
        const xsrfToken = getXsrfToken(userCookie);
        
        const client = axios.create({
            headers: {
                'Cookie': userCookie,
                'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                'Accept': 'application/json',
                'X-XSRF-TOKEN': xsrfToken,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        let allRecords = [];
        let offset = 0;
        let total = null;

        try {
            // UPDATED TEXT HERE
            socket.emit('log', '🚀 Connecting to Atlas...');
            
            // --- PHASE 1: LIST ---
            while (total === null || offset < total) {
                const response = await client.get(CONFIG.listUrl, {
                    params: { offset, limit: CONFIG.limit, sort: 'name', search_field: 'name' }
                });

                if (!response.data || !response.data.meta) throw new Error("Invalid Session/Cookie");

                const records = response.data.data;
                if (total === null) {
                    total = response.data.meta.pagination.total;
                    socket.emit('log', `📊 Found ${total} consumers. Downloading list...`);
                }

                if (records.length === 0) break;
                
                records.forEach(r => r.permissions = "...");
                allRecords.push(...records);
                
                const progress = Math.min((allRecords.length / total) * 10, 10);
                socket.emit('progress', { percent: progress, status: `Fetching List: ${allRecords.length}/${total}` });
                
                offset += CONFIG.limit;
            }

            // --- PHASE 2: DETAILS ---
            socket.emit('log', '🔍 Extracting permissions (Slow & Steady)...');
            socket.emit('init-table', allRecords);

            const chunkSize = CONFIG.concurrentRequests;
            let processedCount = 0;

            for (let i = 0; i < allRecords.length; i += chunkSize) {
                const chunk = allRecords.slice(i, i + chunkSize);
                
                const promises = chunk.map(async (consumer) => {
                    const result = await fetchDetails(client, consumer.id);
                    consumer.permissions = result;
                    return { id: consumer.id, permissions: result };
                });

                const results = await Promise.all(promises);
                processedCount += chunk.length;

                socket.emit('update-rows', results);

                const percent = 10 + ((processedCount / allRecords.length) * 90);
                socket.emit('progress', { 
                    percent: percent, 
                    status: `Analyzing Permissions: ${processedCount}/${allRecords.length}` 
                });
                
                await new Promise(r => setTimeout(r, CONFIG.delayBetweenBatches));
            }

            socket.emit('log', '✅ Scrape Complete!');
            socket.emit('done', allRecords);

        } catch (error) {
            socket.emit('error', error.message);
            socket.emit('log', `❌ Error: ${error.message}`);
        }
    });
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});