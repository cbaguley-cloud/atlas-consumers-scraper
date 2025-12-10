const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// --- CONFIGURATION ---
const CONFIG = {
    url: "https://sightmap.com/manage/consumers",
    // Paste the SAME cookie string as before
    cookie: "_gid=GA1.2.1200424774.1765236945; _ga=GA1.2.11152509.1764709442; _ga_YY51Q4JDTF=GS2.1.s1765383587$o133$g1$t1765383621$j26$l0$h0; _ga_L1EN3DZCC1=GS2.1.s1765383587$o133$g1$t1765383621$j26$l0$h0; XSRF-TOKEN=eyJpdiI6Im9oKzFQWm5peFBNamhDSTBldUtlRFE9PSIsInZhbHVlIjoiVG5xb25zckZMUzhGeHRoN1UxRlZsMkUxdksrcUJGUGRnZ0JRTnBDL0dNd3Y3KzEyVGk2bEk1ZEE1Vzd4T2d1KzZrOEVreXRwMHVDdEthMzZ3c0FHUEt6cUdubWs3YmxUQW1jekxYMElmaU9FcjlhbnR1eWZ3a01YMUlzbndhWVMiLCJtYWMiOiJmZjA0ZWFjMjkyMmQxM2ZiMTU0ZGVlMzc0OGEzYjg0NGY3OWI4MmZhNWFmYjk1MTdmYjNmMWZmM2I1Mzc2Y2NjIiwidGFnIjoiIn0%3D; session=eyJpdiI6InhXMzBRMkVDeE5kVXhPYTUrbExldHc9PSIsInZhbHVlIjoibWpYSm45dmRZNFdXdjNpOGZhMUJSTlU1WEJTYUV3SnBVSDdvNjBHWkUyMldEdklUVHNZTG55bmhJV3YrS3A0SjhlUXFwWE96YWtiZ25ZUm9XNjhCMFN1Z0lwNzh4STdBeHFDSUpOR2xMM2ZnZlNDNThZL0UwUXNZNG02cnJPakMiLCJtYWMiOiJhYjFkMjkxYmUzOWI2YTA1ODU5YmVlNGRhODQ1ZjczMWJiZTI1YzE3NTcxMDk3OGM4MzVjZWNmNDhlYjY0YmQ1IiwidGFnIjoiIn0%3D",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    limit: 100 
};

// HELPER: Extract XSRF Token from cookie string
function getXsrfToken(cookieString) {
    const match = cookieString.match(/XSRF-TOKEN=([^;]+)/);
    // decodeURIComponent removes the %3D and other encoding
    return match ? decodeURIComponent(match[1]) : '';
}

async function fetchData() {
    let allRecords = [];
    let offset = 0;
    let total = null;
    
    // Attempt to parse the XSRF token automatically
    const xsrfToken = getXsrfToken(CONFIG.cookie);

    const client = axios.create({
        headers: {
            'Cookie': CONFIG.cookie,
            'User-Agent': CONFIG.userAgent,
            'Accept': 'application/json',
            'X-XSRF-TOKEN': xsrfToken, // OFTEN REQUIRED for this type of site
            'X-Requested-With': 'XMLHttpRequest' // Tells server "I am a script, send JSON"
        }
    });

    console.log("🚀 Starting scraper...");

    try {
        while (total === null || offset < total) {
            
            const response = await client.get(CONFIG.url, {
                params: {
                    offset: offset,
                    limit: CONFIG.limit,
                    sort: 'name',
                    search_field: 'name'
                }
            });

            // DEBUGGING: Check what we actually got back
            if (!response.data || !response.data.meta) {
                console.log("\n❌ FATAL ERROR: Unexpected Response Format.");
                
                // Print the first 200 characters of the response
                // If you see <html> or <!DOCTYPE>, it means you are getting a webpage, not data.
                const preview = typeof response.data === 'string' 
                    ? response.data.substring(0, 300) 
                    : JSON.stringify(response.data).substring(0, 300);
                    
                console.log("------------------------------------------");
                console.log("SERVER RESPONSE PREVIEW:\n", preview);
                console.log("------------------------------------------");
                console.log("💡 DIAGNOSIS:");
                console.log("1. If the preview shows HTML, your Cookie is expired or invalid.");
                console.log("2. Refresh the website, copy the Cookie again immediately, and update CONFIG.");
                break;
            }

            const meta = response.data.meta;
            const records = response.data.data;

            if (total === null) {
                total = meta.pagination.total;
                console.log(`📊 Total records found: ${total}`);
            }

            if (!records || records.length === 0) break;

            allRecords.push(...records);
            
            const progress = Math.min((allRecords.length / total) * 100, 100).toFixed(1);
            console.log(`   Fetched ${records.length} items (Total: ${allRecords.length}/${total}) - ${progress}%`);

            offset += CONFIG.limit;
            await new Promise(resolve => setTimeout(resolve, 250));
        }

        return allRecords;

    } catch (error) {
        console.error("❌ Error:", error.message);
        if(error.response) console.log("Status Code:", error.response.status);
        return [];
    }
}

async function saveCsv(records) {
    if (records.length === 0) return;

    console.log("💾 Preparing CSV...");
    const firstRecord = records[0];
    const headers = Object.keys(firstRecord).map(key => ({
        id: key,
        title: key.toUpperCase()
    }));

    const csvWriter = createCsvWriter({
        path: 'sightmap_consumers.csv',
        header: headers
    });

    await csvWriter.writeRecords(records);
    console.log(`✅ Success! Saved ${records.length} rows.`);
}

(async () => {
    const data = await fetchData();
    await saveCsv(data);
})();