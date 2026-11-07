// ---------- This function runs INSIDE the job page (injected, not bundled) ----------
function extractJobDetails() {
  const out = { company: "", title: "", url: location.href, description: "", salary: "", location: "", jobType: "" };

  // Map schema.org employmentType codes to friendly labels
  const formatJobType = (et) => {
    const code = Array.isArray(et) ? et[0] : et;
    if (!code) return "";
    const map = {
      FULL_TIME: "Full-time",
      PART_TIME: "Part-time",
      CONTRACTOR: "Contract",
      TEMPORARY: "Contract",
      INTERN: "Internship",
      VOLUNTEER: "Volunteer",
      PER_DIEM: "Freelance",
    };
    return map[code] || String(code).replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  };

  const stripHtml = (html) => {
    const d = document.createElement("div");
    d.innerHTML = html;
    return (d.textContent || "").replace(/\s+\n/g, "\n").trim();
  };
  const meta = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.getAttribute("content") : "";
  };

  // Turn a schema.org baseSalary object into "$150k–$185k/yr"
  const formatSalary = (bs) => {
    if (!bs || typeof bs !== "object") return "";
    const v = bs.value || {};
    const sym = { USD: "$", GBP: "£", EUR: "€", INR: "₹" }[bs.currency] || (bs.currency ? bs.currency + " " : "");
    const unit = { YEAR: "/yr", HOUR: "/hr", MONTH: "/mo", WEEK: "/wk", DAY: "/day" }[v.unitText] || "";
    const k = (n) => (n >= 1000 && n % 1000 === 0 ? n / 1000 + "k" : Number(n).toLocaleString());
    const min = v.minValue, max = v.maxValue, val = v.value;
    if (min != null && max != null) return `${sym}${k(min)}–${sym}${k(max)}${unit}`;
    if (val != null) return `${sym}${k(val)}${unit}`;
    return "";
  };

  // Turn jobLocation into "Remote (US)" or "Austin, TX, US"
  const formatLocation = (item) => {
    if (item.jobLocationType === "TELECOMMUTE") {
      const country = item.applicantLocationRequirements?.name;
      return country ? `Remote (${country})` : "Remote";
    }
    const loc = Array.isArray(item.jobLocation) ? item.jobLocation[0] : item.jobLocation;
    const a = loc?.address;
    if (!a) return "";
    return [a.addressLocality, a.addressRegion, a.addressCountry].filter(Boolean).join(", ");
  };

  // 1) Structured data — most ATS/job boards embed schema.org JobPosting
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    let parsed;
    try { parsed = JSON.parse(s.textContent); } catch { return; }
    const items = Array.isArray(parsed) ? parsed : parsed["@graph"] || [parsed];
    items.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const type = item["@type"];
      const isJob = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
      if (!isJob) return;
      if (item.title) out.title = item.title;
      if (item.hiringOrganization) {
        out.company = typeof item.hiringOrganization === "string"
          ? item.hiringOrganization
          : item.hiringOrganization.name || out.company;
      }
      if (item.description) out.description = stripHtml(item.description);
      if (item.baseSalary) out.salary = formatSalary(item.baseSalary) || out.salary;
      if (item.employmentType) out.jobType = formatJobType(item.employmentType) || out.jobType;
      const loc = formatLocation(item);
      if (loc) out.location = loc;
    });
  });

  // 1b) Rippling ATS — a Next.js app with the full job record in __NEXT_DATA__
  if (location.hostname.includes("rippling.com")) {
    try {
      const nd = JSON.parse(document.getElementById("__NEXT_DATA__").textContent);
      const jp = (nd && nd.props && nd.props.pageProps && nd.props.pageProps.apiData && nd.props.pageProps.apiData.jobPost) || {};
      if (jp.name) out.title = jp.name;
      if (jp.companyName) out.company = jp.companyName;
      if (jp.description && jp.description.role) out.description = stripHtml(jp.description.role);
      const wl = Array.isArray(jp.workLocations) ? jp.workLocations[0] : null;
      if (wl) out.location = typeof wl === "string" ? wl : wl.name || out.location;

      const et = ((jp.employmentType && (jp.employmentType.id || jp.employmentType.label)) || "").toLowerCase();
      if (et) {
        out.jobType =
          /part/.test(et) ? "Part-time" :
          /full|_ft|salaried/.test(et) ? "Full-time" :
          /contract/.test(et) ? "Contract" :
          /intern/.test(et) ? "Internship" :
          /temp/.test(et) ? "Contract" :
          /volunteer/.test(et) ? "Volunteer" : out.jobType;
      }

      const pr = Array.isArray(jp.payRangeDetails) ? jp.payRangeDetails[0] : null;
      if (pr && (pr.rangeStart || pr.rangeEnd)) {
        const sym = { USD: "$", CAD: "CA$", AUD: "A$", GBP: "£", EUR: "€", INR: "₹" }[pr.currency] || (pr.currency ? pr.currency + " " : "");
        const unit = { YEAR: "/yr", HOUR: "/hr", MONTH: "/mo", WEEK: "/wk", DAY: "/day" }[pr.frequency] || "";
        const k = (n) => (n >= 1000 && n % 1000 === 0 ? n / 1000 + "k" : Number(n).toLocaleString());
        out.salary = pr.rangeStart && pr.rangeEnd
          ? `${sym}${k(pr.rangeStart)}–${sym}${k(pr.rangeEnd)}${unit}`
          : `${sym}${k(pr.rangeStart || pr.rangeEnd)}${unit}`;
      }
    } catch (e) { /* fall through to generic heuristics */ }
  }

  // 2) Per-site selectors for the big ones
  const host = location.hostname;
  const pick = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() : "";
  };

  if (host.includes("linkedin.com")) {
    out.title ||= pick(".job-details-jobs-unified-top-card__job-title, .topcard__title, h1");
    out.company ||= pick(".job-details-jobs-unified-top-card__company-name a, .topcard__org-name-link");
    out.description ||= pick(".jobs-description__content, .description__text");
  } else if (host.includes("greenhouse.io") || host.includes("boards.greenhouse")) {
    out.title ||= pick("h1.app-title, h1");
    out.company ||= pick(".company-name, span.company-name");
    out.description ||= pick("#content, .job__description");
  } else if (host.includes("lever.co")) {
    out.title ||= pick(".posting-headline h2, h2");
    out.company ||= pick(".main-header-logo img")?.alt || "";
    out.description ||= pick(".section-wrapper.page-full-width");
  } else if (host.includes("indeed.com")) {
    out.title ||= pick("h1.jobsearch-JobInfoHeader-title, h1");
    out.company ||= pick('[data-company-name="true"], .jobsearch-CompanyInfoContainer a');
    out.description ||= pick("#jobDescriptionText");
  }

  // 3) Generic company detection (try structured attributes, then title patterns)
  out.title ||= meta('meta[property="og:title"]') || document.title;
  if (!out.company) {
    out.company = pick('[itemprop="hiringOrganization"], [data-testid*="company" i], [class*="company-name" i], [class*="employer" i], [class*="companyName" i]');
  }
  if (!out.company) {
    // "Job Title at Acme Corp", "Job Title - Acme | Board"
    const t = (meta('meta[property="og:title"]') || document.title || "");
    const at = t.match(/\bat\s+([^|\-–·]+)/i);
    const dash = t.match(/[|\-–·]\s*([^|\-–·]+?)\s*(?:[|\-–·].*)?$/);
    out.company = (at && at[1].trim()) || (dash && dash[1].trim()) || "";
  }
  out.company ||= meta('meta[property="og:site_name"]');

  // 4) Full description — grab the largest meaningful text block if we only have a snippet
  if (out.description.length < 250) {
    const candidates = [
      '[class*="job-description" i]', '[class*="jobDescription" i]', '[class*="description" i]',
      '[id*="description" i]', '[class*="posting" i]', '[class*="job-details" i]',
      '[data-testid*="description" i]', 'article', '[role="main"]', 'main',
    ];
    let best = out.description;
    candidates.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        const t = el.innerText ? el.innerText.trim() : "";
        if (t.length > best.length) best = t;
      });
    });
    out.description = best;
  }
  out.description ||= meta('meta[name="description"]') || meta('meta[property="og:description"]');

  // 5) Text heuristics — salary / job type for sites with no structured data
  const pageText = (document.body && document.body.innerText) || "";

  if (!out.jobType) {
    const m = pageText.match(/\b(full[\s-]?time|part[\s-]?time|contractor|contract|freelance|permanent|temporary|internship|intern|volunteer)\b/i);
    if (m) {
      const key = m[1].toLowerCase().replace(/[\s-]/g, "");
      out.jobType = {
        fulltime: "Full-time", parttime: "Part-time", contractor: "Contract",
        contract: "Contract", freelance: "Freelance", permanent: "Permanent",
        temporary: "Contract", internship: "Internship", intern: "Internship",
        volunteer: "Volunteer",
      }[key] || "";
    }
  }

  if (!out.salary) {
    // A salary figure: currency symbol OR currency word, single value or range, optional /period.
    const amount = "(?:[$£€₹]|USD|GBP|EUR|INR|CAD|AUD)?\\s?\\d[\\d,]*(?:\\.\\d+)?\\s?[kK]?";
    const moneyRe = new RegExp(
      amount +
      "(?:\\s?(?:-|–|—|to)\\s?" + amount + ")?" +
      "(?:\\s?(?:USD|GBP|EUR|per\\s+|/)\\s?(?:hour|hr|year|yr|annum|month|mo|week|wk|annually)?)?",
      "i"
    );
    // Only trust a money match that sits on a pay-related line (avoids random prices/years)
    const payLine = pageText.split("\n").find((l) =>
      /salary|compensation|pay\s*range|salary\s*range|base\s*pay|\bpay\b|remuneration|\$|£|€|₹/i.test(l) &&
      /salary|compensation|pay|remuneration|range|[$£€₹]|USD|GBP|EUR/i.test(l) &&
      moneyRe.test(l) && /[$£€₹]|\d{3}|k\b/i.test(l)
    );
    if (payLine) {
      const m = payLine.match(moneyRe);
      if (m && m[0].trim()) out.salary = m[0].replace(/\s+/g, " ").trim();
    }
  }

  return out;
}

// ---------- Popup logic ----------
const $ = (id) => document.getElementById(id);

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setMsg(text, type) {
  const el = $("msg");
  el.textContent = text;
  el.className = "msg" + (type ? " " + type : "");
}

// Pre-fill date with today
function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

async function init() {
  $("dateApplied").value = todayISO();

  // Load saved web app URL; surface settings if missing
  const { webAppUrl } = await chrome.storage.sync.get("webAppUrl");
  if (webAppUrl) {
    $("webAppUrl").value = webAppUrl;
  } else {
    $("settings").classList.remove("hidden");
    setMsg("First time? Add your Web App URL in settings ⚙", "err");
  }

  // Auto-extract from the current page
  try {
    const tab = await getActiveTab();
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobDetails,
    });
    if (result) {
      $("company").value = result.company || "";
      $("title").value = result.title || "";
      $("url").value = result.url || tab.url || "";
      $("salary").value = result.salary || "";
      $("location").value = result.location || "";
      $("jobType").value = result.jobType || "";
      $("description").value = result.description || "";
    }
  } catch (e) {
    // Pages like chrome:// can't be scripted — fall back to the tab URL
    const tab = await getActiveTab();
    $("url").value = tab?.url || "";
  }
}

$("settingsToggle").addEventListener("click", () => {
  $("settings").classList.toggle("hidden");
});

$("saveSettings").addEventListener("click", async () => {
  const url = $("webAppUrl").value.trim();
  await chrome.storage.sync.set({ webAppUrl: url });
  setMsg("URL saved ✓", "ok");
});

$("save").addEventListener("click", async () => {
  const { webAppUrl } = await chrome.storage.sync.get("webAppUrl");
  if (!webAppUrl) {
    $("settings").classList.remove("hidden");
    setMsg("Add your Web App URL first ⚙", "err");
    return;
  }

  const payload = {
    company: $("company").value.trim(),
    title: $("title").value.trim(),
    url: $("url").value.trim(),
    salary: $("salary").value.trim(),
    location: $("location").value.trim(),
    jobType: $("jobType").value.trim(),
    description: $("description").value.trim(),
    orgType: $("orgType").value.trim(),
    notes: $("notes").value.trim(),
    dateApplied: $("dateApplied").value,
    status: $("status").value,
  };

  const btn = $("save");
  btn.disabled = true;
  setMsg("Saving…");

  try {
    const res = await fetch(webAppUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.result === "success") {
      setMsg("Saved to your sheet ✓", "ok");
      setTimeout(() => window.close(), 900);
    } else {
      setMsg("Sheet error: " + (data.message || "unknown"), "err");
      btn.disabled = false;
    }
  } catch (e) {
    setMsg("Couldn't reach the sheet. Check the URL / deployment.", "err");
    btn.disabled = false;
  }
});

init();
