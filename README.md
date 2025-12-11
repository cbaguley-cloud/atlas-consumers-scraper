# Atlas Consumers Scraper

A robust data extraction tool designed to scrape, filter, and export Consumer and Permission data from the Atlas/SightMap administration panel.

This application provides a modern, dark-mode web interface to bypass manual data entry, allowing for batch processing of thousands of records with advanced filtering and CSV export capabilities.

## 🚀 Key Features

* **Session-Based Authentication:** Uses your browser's active session cookie to securely access data without storing credentials.
* **Deep Scraping:** Automatically fetches the main consumer list and visits individual detail pages to extract specific permissions (which are not available in the main list view).
* **Robust Extraction Engine:** Features automatic retries, rate-limiting protection, and multiple fallback strategies (JSON parsing & Regex) to ensure data integrity even if the source HTML changes.
* **Advanced Filtering:**
    * SQL-style logic (Contains, Does Not Contain, Starts With, Equals, etc.).
    * **"OR" Logic:** Support for comma-separated values (e.g., `unitmap, floorplan` matches either).
    * Stackable rules for complex queries (e.g., "Name does not contain [Deprecated]" AND "Permissions contains [Write]").
* **Data Export:** One-click export to CSV, JSON, or Clipboard.

## 🛠️ Tech Stack

* **Backend:** Node.js, Express, Socket.io (for real-time progress streaming).
* **Scraper:** Axios (HTTP requests).
* **Frontend:** HTML5, Bootstrap 5, Vanilla JS (WebSockets).

---

## 📦 Installation

1. **Clone the repository:**
   ```bash
       git clone [https://github.com/YOUR_USERNAME/atlas-scraper.git](https://github.com/YOUR_USERNAME/atlas-scraper.git)
       cd atlas-scraper

 2. **Install dependencies:**
    bash:
       npm install

  3. Start the server:
     bash:
      npm start

  * Or run node server.js manually.
  
  4. Open the App: Go to http://localhost:3000 in your browser.


## 🍪 How to Get Your Session Cookie
  * To use this app, you must prove to the server that you are logged in. We do this by borrowing the Session Cookie from your browser.
  
  1) Open Chrome and log in to SightMap/Atlas.
  
  2) Navigate to the Consumers page (/manage/consumers).
  
  3) Open Developer Tools by pressing F12 (or Right Click > Inspect).
  
  4) Go to the Network tab.
  
  5) Refresh the page.
  
  6) In the Network list, click the first request named consumers (or consumers?offset=0...).
  
  7) In the right panel, scroll down to the Request Headers section.
  
  8) Find the header named Cookie.
  
  9) Copy the entire value (it will be a long string starting with _gid= or session=).
  
  10) Right-click the value -> Copy value.
  
  11) Paste this string into the "Cookie String" box in the scraper app.


## 🔍 How to Use Filters
  * The filtering engine allows for complex queries. You can stack multiple rules, and they will act as an AND chain (Rule 1 MUST be true AND Rule 2 MUST be true).
  
  * The "OR" Logic
    To search for multiple variations at once, **use a comma ** inside the value field.
  
  **Examples:
  Find specific permissions:**
  
  _Column:_ Permissions
  
  _Operator:_ Contains
  
  _Value:_ unitmap, floorplan
  
  _Result:_ Finds rows where permissions contain "unitmap" OR "floorplan".
  
  **Exclude deprecated items:**
  
  _Column:_ Consumer Name
  
  _Operator:_ Does Not Contain
  
  _Value:_ deprecated, test, temp
  
  _Result:_ Excludes rows containing "deprecated" OR "test" OR "temp".


## ⚠️ Troubleshooting
  **"Extraction Failed" or "Rate Limited"** If you see this in the status column, the tool is hitting the server too fast.
  
  * Fix: The app automatically retries these requests. If they fail permanently, wait a few minutes and try scraping again. The server may have temporarily blocked your IP.
  
 
  **"Session Expired" If the logs say "Redirected to Login," your cookie has expired.**
  
  * Fix: Refresh the SightMap tab in your browser, grab a fresh Cookie string (steps above), and paste it into the app.
  
 
  **App won't start (EADDRINUSE)**
  
  * Fix: This means the app is already running in another window. Run killall node (Mac) or close the other terminal window.
