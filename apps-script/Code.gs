/**
 * Job Application Tracker — Google Apps Script backend.
 *
 * Paste this into the Apps Script editor bound to your Google Sheet
 * (Extensions ▸ Apps Script), then deploy it as a Web App.
 * The deployment URL goes into the Chrome extension's settings.
 *
 * Rows are written by matching the header text in row 1 — not by position —
 * so you can reorder, rename, or add columns in the sheet without touching
 * this script. Columns it doesn't recognize are left alone.
 */

const SHEET_NAME = "Applications";

// Headers used only when creating a fresh sheet. An existing sheet keeps its own.
const HEADERS = [
  "Applied on",
  "Company",
  "Job Title",
  "Job URL",
  "Status",
  "Notes",
  "Salary",
  "Location",
  "Job Type",
  "Job description",
  "Saved on",
];

// Header text (normalized: lowercased, non-alphanumerics stripped) → value to write.
// Multiple spellings map to the same field so renaming a column still works.
const FIELD_BY_HEADER = {
  appliedon:          (d) => d.dateApplied || new Date().toISOString().slice(0, 10),
  dateapplied:        (d) => d.dateApplied || new Date().toISOString().slice(0, 10),
  company:            (d) => d.company,
  jobtitle:           (d) => d.title,
  title:              (d) => d.title,
  role:               (d) => d.title,
  joburl:             (d) => d.url,
  url:                (d) => d.url,
  link:               (d) => d.url,
  status:             (d) => d.status || "To Apply",
  notes:              (d) => d.notes,
  salary:             (d) => d.salary,
  compensation:       (d) => d.salary,
  location:           (d) => d.location,
  jobtype:            (d) => d.jobType,
  typeofjob:          (d) => d.jobType,
  typeoforganization: (d) => d.orgType,
  orgtype:            (d) => d.orgType,
  jobdescription:     (d) => d.description,
  description:        (d) => d.description,
  savedon:            () => new Date(),
  savedat:            () => new Date(),
};

const normalize = (h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, "");

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getSheet();

    const width = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, width).getValues()[0];

    // Build the row positionally from whatever the headers happen to be.
    const row = headers.map((h) => {
      const fn = FIELD_BY_HEADER[normalize(h)];
      if (!fn) return "";           // unrecognized column — leave blank
      const v = fn(data);
      return v == null ? "" : v;
    });

    sheet.appendRow(row);
    propagateValidation(sheet, width);

    return json({ result: "success" });
  } catch (err) {
    return json({ result: "error", message: String(err) });
  }
}

// Carry any dropdown (data validation) from the row above down into the newly
// appended row, so manually-set dropdowns persist on every save. Runs over every
// column, so it keeps working when columns move.
function propagateValidation(sheet, width) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) return; // nothing above to copy from (header + first row)
  for (let col = 1; col <= width; col++) {
    const source = sheet.getRange(lastRow - 1, col).getDataValidation();
    if (source) sheet.getRange(lastRow, col).setDataValidation(source);
  }
}

// Lets you open the deployment URL in a browser to confirm it's live, and shows
// which of your columns the extension can currently fill.
function doGet() {
  const sheet = getSheet();
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  return json({
    result: "ok",
    message: "Job Tracker endpoint is live.",
    columns: headers.map((h) => ({
      header: h,
      filled: Boolean(FIELD_BY_HEADER[normalize(h)]),
    })),
  });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
