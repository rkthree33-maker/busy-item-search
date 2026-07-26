# Busy Item Search

A production-ready, lightning-fast frontend application designed to search through Excel exports from Busy Accounting Software via Google Sheets. Built purely with HTML, CSS, and Vanilla JS.

## Features
- 🚀 **Instant Search:** Debounced multi-column search (Name, ID, Group, Rates).
- ♾️ **Handles 50k+ Rows:** Uses DOM virtualization (chunked rendering) to prevent browser freezes.
- 📱 **Mobile First & PWA:** Fully responsive, installable as a mobile or desktop app, with offline UI support.
- 🌙 **Dark Mode:** Automatically saves preference via `localStorage`.
- 📊 **Sort & Filter:** Sort dynamically by Name or Rate. Auto-populates Group filters.
- 📋 **Export & Copy:** Export current searches to CSV or copy items individually.
- ⌨️ **Keyboard Shortcuts:** `Ctrl+K` to search, `Esc` to clear search.

## 1. Google Sheet Setup
1. Create a new Google Sheet. Rename the tab to `Sheet1`.
2. Ensure columns are exactly in this order:
   - `Column A` : ItemID
   - `Column B` : Item Name
   - `Column C` : Item Group
   - `Column D` : Purchase Rate
   - `Column E` : A Rate
   - `Column F` : B Rate
3. Paste your Busy Excel export into this sheet (including the headers on Row 1).

## 2. Google Apps Script Setup
1. From your Google Sheet, click **Extensions > Apps Script**.
2. Delete any code there, and paste the code from `Code.gs` included in this project.
3. Click **Deploy > New Deployment**.
4. Settings:
   - **Type:** Web App
   - **Execute as:** Me
   - **Who has access:** Anyone
5. Authorize the script when prompted.
6. Copy the **Web App URL**.

## 3. GitHub Pages Deployment
1. Open `config.js` in this project.
2. Replace `"YOUR_GOOGLE_SCRIPT_URL"` with the Web App URL you just copied.
3. Commit and push all files to a new GitHub repository.
4. In your GitHub repository, go to **Settings > Pages**.
5. Set the source branch to `main` (or `master`) and save.
6. Your application will be live at `https://[username].github.io/[repo-name]/`.

## How to Update Data
Simply paste your new exported data into the Google Sheet. The web app automatically fetches live data directly from the sheet on every page reload.