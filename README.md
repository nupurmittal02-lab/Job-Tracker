# Job Application Tracker

A Chrome extension that scrapes job details from the page you're on and appends them to your Google Sheet in one click. No more copy-pasting company, title, URL, and description by hand.

**Columns it fills:** Date Applied · Company · Job Title · Job URL · Type of Organization · Status · Job Description

---

## How it works

1. You're on a job posting/application page.
2. Click the extension icon. It auto-reads the page (structured `JobPosting` data → meta tags → per-site selectors) and pre-fills the form.
3. You glance at it, set **Type of Organization** and **Status**, tweak anything off.
4. Hit **Save to Sheet** → a new row lands in your Google Sheet.

The extension talks to your sheet through a tiny Google Apps Script web app you deploy once. No Google Cloud project, no API keys.

---

## Setup

### Part 1: The Google Sheet (≈2 min)

1. Create (or open) the Google Sheet you want to track applications in.
2. **Extensions ▸ Apps Script**. Delete any starter code.
3. Paste the contents of [`apps-script/Code.gs`](apps-script/Code.gs). Save.
4. **Deploy ▸ New deployment**.
   - Gear icon ▸ **Web app**.
   - **Execute as:** Me.
   - **Who has access:** Anyone.
   - Click **Deploy**, authorize when prompted (it's your own script — the "unverified" warning is expected; click *Advanced ▸ Go to project*).
5. Copy the **Web app URL** (ends in `/exec`). You'll paste it into the extension.

> The script auto-creates an `Applications` tab with headers the first time it runs, so you don't have to set up columns yourself.

### Part 2: The Chrome extension (≈1 min)

1. Go to `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. **Load unpacked** → select this `job-tracker-extension` folder.
4. Click the extension icon, open **⚙ settings**, paste your Web App URL, **Save URL**.

Done. Pin the extension to your toolbar, and you're ready.

---

## Notes & limits

- **Auto-extraction isn't perfect.** Sites with `JobPosting` structured data (most ATS: Greenhouse, Lever, Workday, plus LinkedIn/Indeed) fill cleanly. Obscure custom career pages may only fill the URL + title — that's why the form is editable before you save.
- **Type of Organization** is yours to pick (it's not reliably on the page). The field remembers nothing yet — it's a free-text box with common suggestions.
- **Privacy:** Data goes only to your own sheet via your own script URL. Treat that URL like a password — anyone with it can append rows.
- Want it to also capture salary, location, or recruiter name? Those are easy to add — say the word.
