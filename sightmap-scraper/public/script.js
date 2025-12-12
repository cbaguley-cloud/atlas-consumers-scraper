const socket = io();
let globalData = [];
let filteredData = [];
let activeRules = [];

const tableBody = document.querySelector("#resultsTable tbody");
const recordCount = document.getElementById("recordCount");
const exportCount = document.getElementById("exportCount");

// UI Elements
const startBtn = document.getElementById("startBtn");
const logs = document.getElementById("logs");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("statusText");
const percentText = document.getElementById("percentText");
const actionCard = document.getElementById("actionCard");
const filterCard = document.getElementById("filterCard");

// Start
startBtn.addEventListener("click", () => {
  const cookie = document.getElementById("cookieInput").value;
  if (!cookie) return alert("Please paste your cookie first!");

  // Reset
  globalData = [];
  filteredData = [];
  tableBody.innerHTML =
    '<tr><td colspan="4" class="text-center text-muted p-5" style="color:#aaa !important;">Loading List...</td></tr>';
  resetProgress();
  startBtn.disabled = true;
  startBtn.innerText = "Scraping in progress...";

  socket.emit("start-scrape", cookie);
});

// --- SOCKET HANDLERS ---

socket.on("log", (msg) => {
  logs.innerHTML += `<div>> ${msg}</div>`;
  logs.scrollTop = logs.scrollHeight;
});

socket.on("progress", (data) => {
  const p = data.percent.toFixed(1) + "%";
  progressBar.style.width = p;
  percentText.innerText = p;
  statusText.innerText = data.status;
});

socket.on("init-table", (records) => {
  globalData = records;
  applyFilters();
  enableCards();
});

socket.on("update-rows", (updates) => {
  updates.forEach((update) => {
    const item = globalData.find((d) => d.id === update.id);
    if (item) item.permissions = update.permissions;
  });
  applyFilters();
});

socket.on("error", (msg) => {
  alert("Error: " + msg);
  startBtn.disabled = false;
  startBtn.innerText = "Retry Scrape";
  progressBar.style.backgroundColor = "#cf6679";
});

socket.on("done", (data) => {
  globalData = data;
  applyFilters();
  statusText.innerText = "Complete";
  startBtn.disabled = false;
  startBtn.innerText = "Start New Scrape";
  enableCards();
});

function enableCards() {
  actionCard.style.opacity = "1";
  actionCard.style.pointerEvents = "all";
  filterCard.style.opacity = "1";
  filterCard.style.pointerEvents = "all";
}

// --- FILTER LOGIC ---

function addFilter() {
  const col = document.getElementById("filterCol").value;
  const op = document.getElementById("filterOp").value;
  const val = document.getElementById("filterVal").value.trim();

  if (!val) return;

  activeRules.push({ col, op, val });
  document.getElementById("filterVal").value = "";
  renderFilterTags();
  applyFilters();
}

function removeFilter(index) {
  activeRules.splice(index, 1);
  renderFilterTags();
  applyFilters();
}

function clearFilters() {
  activeRules = [];
  renderFilterTags();
  applyFilters();
}

function renderFilterTags() {
  const container = document.getElementById("activeFilters");
  container.innerHTML = activeRules
    .map((rule, i) => {
      let opText = rule.op;
      if (opText === "not_contains") opText = "not contains";
      if (opText === "not_ends") opText = "not ends with";

      return `
                <div class="filter-tag">
                    <span style="color:#fff; font-weight:600;">${rule.col}</span>&nbsp;
                    <span style="color:#aaa;">${opText}</span>&nbsp;
                    "${rule.val}"
                    <i class="fa-solid fa-xmark" onclick="removeFilter(${i})"></i>
                </div>
            `;
    })
    .join("");
}

// --- LOGIC UPDATED FOR OR SEPARATION ---
function applyFilters() {
  if (activeRules.length === 0) {
    filteredData = [...globalData];
  } else {
    filteredData = globalData.filter((row) => {
      // ALL rules must pass (AND logic between rules)
      return activeRules.every((rule) => {
        const cellValue = (row[rule.col] || "").toString().toLowerCase();

        // Split input by comma for OR logic within a single rule
        const searchTerms = rule.val
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s);

        switch (rule.op) {
          // OR Logic: Does ANY of the terms match?
          case "contains":
            return searchTerms.some((term) => cellValue.includes(term));
          case "starts":
            return searchTerms.some((term) => cellValue.startsWith(term));
          case "ends":
            return searchTerms.some((term) => cellValue.endsWith(term));
          case "equals":
            return searchTerms.some((term) => cellValue === term);

          // NEGATIVE OR Logic: Does NONE of the terms match? (Exclude A AND Exclude B)
          case "not_contains":
            return searchTerms.every((term) => !cellValue.includes(term));
          case "not_ends":
            return searchTerms.every((term) => !cellValue.endsWith(term));

          default:
            return true;
        }
      });
    });
  }

  renderTable(filteredData);
}

// --- RENDERERS ---

function renderTable(data) {
  recordCount.innerText = data.length;
  exportCount.innerText = data.length;

  const rows = data
    .map((item) => {
      let permClass = "perm-cell";
      const perms = (item.permissions || "").toString();
      if (perms.includes("Error") || perms.includes("Failed"))
        permClass += " perm-error";
      else if (perms !== "..." && perms !== "") permClass += " perm-loaded";

      return `
            <tr id="row-${item.id}">
                <td><span class="badge bg-dark border border-secondary">${
                  item.id
                }</span></td>
                <td style="font-weight:600">${item.name}</td>
                <td class="small">${(item.created_at || "").split("T")[0]}</td>
                <td class="${permClass}">${item.permissions || "..."}</td>
            </tr>
            `;
    })
    .join("");
  tableBody.innerHTML =
    rows ||
    '<tr><td colspan="4" class="text-center text-muted p-5" style="color:#aaa !important;">No matching records found.</td></tr>';
}

function resetProgress() {
  progressBar.style.width = "0%";
  progressBar.style.backgroundColor = "var(--accent-lime)";
  percentText.innerText = "0%";
  logs.innerHTML = "";
  activeRules = [];
  renderFilterTags();

  actionCard.style.opacity = "0.5";
  actionCard.style.pointerEvents = "none";
  filterCard.style.opacity = "0.5";
  filterCard.style.pointerEvents = "none";
}

// --- ACTIONS ---

function downloadCsv() {
  if (!filteredData.length) return alert("No data to export!");
  const headers = ["id", "name", "created_at", "permissions"];
  const csvRows = [headers.join(",")];

  for (const row of filteredData) {
    const values = headers.map((header) => {
      const escaped = ("" + (row[header] || "")).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "atlas_filtered.csv";
  a.click();
}

function copyToClipboard() {
  if (!filteredData.length) return;
  let text = "ID\tName\tCreated\tPermissions\n";
  filteredData.forEach((row) => {
    text += `${row.id}\t${row.name}\t${row.created_at}\t${row.permissions}\n`;
  });
  navigator.clipboard
    .writeText(text)
    .then(() => alert("Copied filtered list!"));
}

function copyJson() {
  if (!filteredData.length) return;
  navigator.clipboard
    .writeText(JSON.stringify(filteredData, null, 2))
    .then(() => alert("JSON Copied!"));
}
