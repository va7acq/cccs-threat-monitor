const DEFAULT_KEYWORDS = ["Windows", "Linux"];

const statusBadgeEl = document.getElementById("status-badge");
const lastCheckTimeEl = document.getElementById("last-check-time");
const statusErrorEl = document.getElementById("status-error");
const checkNowBtn = document.getElementById("check-now-btn");
const intervalSelectEl = document.getElementById("interval-select");
const keywordFormEl = document.getElementById("keyword-form");
const keywordInputEl = document.getElementById("keyword-input");
const keywordPillsEl = document.getElementById("keyword-pills");
const keywordStatsEl = document.getElementById("keyword-stats");
const matchesListEl = document.getElementById("matches-list");
const matchesCountEl = document.getElementById("matches-count");

let currentKeywords = [];

function formatTimestamp(isoString) {
  if (!isoString) return "Never";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return String(isoString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function renderStatus({ lastCheckTime, lastCheckStatus, lastCheckError }) {
  lastCheckTimeEl.textContent = `Last check: ${formatTimestamp(lastCheckTime)}`;

  if (lastCheckStatus === "OK") {
    statusBadgeEl.textContent = "OK";
    statusBadgeEl.className = "status-pill status-ok";
    statusErrorEl.hidden = true;
    statusErrorEl.textContent = "";
  } else if (lastCheckStatus === "Error") {
    statusBadgeEl.textContent = "Error";
    statusBadgeEl.className = "status-pill status-err";
    statusErrorEl.textContent = lastCheckError || "Feed check failed";
    statusErrorEl.hidden = false;
  } else {
    statusBadgeEl.textContent = lastCheckStatus || "Pending";
    statusBadgeEl.className = "status-pill status-idle";
    statusErrorEl.hidden = true;
    statusErrorEl.textContent = "";
  }
}

function renderKeywords(keywords) {
  currentKeywords = Array.isArray(keywords) ? [...keywords] : [];
  keywordPillsEl.replaceChildren();

  let positiveCount = 0;
  let negativeCount = 0;

  if (currentKeywords.length === 0) {
    const emptyHint = document.createElement("span");
    emptyHint.className = "meta-count";
    emptyHint.textContent = "No keywords configured. Add a watch term above.";
    keywordPillsEl.appendChild(emptyHint);
    keywordStatsEl.textContent = "0 keywords";
    return;
  }

  currentKeywords.forEach((kw, index) => {
    const isNegative = kw.startsWith("-") && kw.slice(1).trim().length > 0;
    if (isNegative) {
      negativeCount += 1;
    } else {
      positiveCount += 1;
    }

    const pill = document.createElement("span");
    pill.setAttribute("role", "listitem");
    pill.className = `keyword-pill ${
      isNegative ? "pill-negative" : "pill-positive"
    }`;

    if (isNegative) {
      const prefixSpan = document.createElement("span");
      prefixSpan.className = "pill-prefix";
      prefixSpan.textContent = "-";

      const termSpan = document.createElement("span");
      termSpan.className = "pill-term";
      termSpan.textContent = kw.slice(1).trim();

      pill.append(prefixSpan, termSpan);
    } else {
      const termSpan = document.createElement("span");
      termSpan.className = "pill-term";
      termSpan.textContent = kw;
      pill.appendChild(termSpan);
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "pill-remove";
    removeBtn.title = `Remove ${kw}`;
    removeBtn.setAttribute("aria-label", `Remove keyword ${kw}`);
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => removeKeywordAt(index));

    pill.appendChild(removeBtn);
    keywordPillsEl.appendChild(pill);
  });

  keywordStatsEl.textContent = `${positiveCount} watch · ${negativeCount} exclude`;
}

async function addKeyword(rawInput) {
  const cleaned = rawInput.trim();
  if (!cleaned) return;

  // Reject bare "-" without a term
  if (cleaned === "-" || (cleaned.startsWith("-") && !cleaned.slice(1).trim())) {
    return;
  }

  const normalized = cleaned.startsWith("-")
    ? `-${cleaned.slice(1).trim()}`
    : cleaned;

  const exists = currentKeywords.some(
    (existing) => existing.toLowerCase() === normalized.toLowerCase()
  );
  if (exists) {
    keywordInputEl.value = "";
    return;
  }

  const updated = [...currentKeywords, normalized];
  await chrome.storage.local.set({ keywords: updated });
  renderKeywords(updated);
  keywordInputEl.value = "";
}

async function removeKeywordAt(index) {
  const updated = currentKeywords.filter((_, i) => i !== index);
  await chrome.storage.local.set({ keywords: updated });
  renderKeywords(updated);
}

function renderRecentMatches(matches) {
  const recentTen = Array.isArray(matches) ? matches.slice(0, 10) : [];
  matchesListEl.replaceChildren();
  matchesCountEl.textContent =
    recentTen.length > 0
      ? `Showing ${recentTen.length} of last 10`
      : "No matches yet";

  if (recentTen.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty-state";
    emptyDiv.textContent =
      "No matching advisories yet. New CCCS alerts matching your watchlist will appear here.";
    matchesListEl.appendChild(emptyDiv);
    return;
  }

  for (const item of recentTen) {
    const card = document.createElement("article");
    card.className = "match-item";

    const topRow = document.createElement("div");
    topRow.className = "match-top";

    const titleEl = document.createElement("h3");
    titleEl.className = "match-title";
    titleEl.textContent = item.title || "Untitled Advisory";
    topRow.appendChild(titleEl);

    if (item.url && /^https?:\/\//i.test(item.url)) {
      const linkEl = document.createElement("a");
      linkEl.className = "match-link";
      linkEl.href = item.url;
      linkEl.target = "_blank";
      linkEl.rel = "noopener noreferrer";
      linkEl.textContent = "Open ↗";
      linkEl.addEventListener("click", (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: item.url });
      });
      topRow.appendChild(linkEl);
    }

    const metaRow = document.createElement("div");
    metaRow.className = "match-meta";

    const tagsContainer = document.createElement("div");
    tagsContainer.className = "match-tags";
    for (const kw of item.matchedKeywords || []) {
      const tag = document.createElement("span");
      tag.className = "match-tag";
      tag.textContent = kw;
      tagsContainer.appendChild(tag);
    }

    const dateSpan = document.createElement("span");
    dateSpan.className = "match-date";
    dateSpan.textContent = formatTimestamp(item.updated || item.matchedAt);

    metaRow.append(tagsContainer, dateSpan);

    const detailsEl = document.createElement("details");
    detailsEl.className = "match-preview";

    const summaryEl = document.createElement("summary");
    summaryEl.textContent = "Show full advisory text";

    const bodyPre = document.createElement("div");
    bodyPre.className = "match-body";
    bodyPre.textContent = item.body || "No advisory text available.";

    detailsEl.addEventListener("toggle", () => {
      summaryEl.textContent = detailsEl.open
        ? "Hide full advisory text"
        : "Show full advisory text";
    });

    detailsEl.append(summaryEl, bodyPre);
    card.append(topRow, metaRow, detailsEl);
    matchesListEl.appendChild(card);
  }
}

async function clearUnreadBadgeOnOpen() {
  try {
    await chrome.runtime.sendMessage({ type: "CLEAR_UNREAD" });
  } catch {
    // Fallback if service worker is still initializing
    await chrome.storage.local.set({ unreadCount: 0 });
    await chrome.action.setBadgeText({ text: "" });
  }
}

async function loadState() {
  const data = await chrome.storage.local.get({
    keywords: DEFAULT_KEYWORDS,
    checkIntervalMinutes: 15,
    recentMatches: [],
    lastCheckTime: null,
    lastCheckStatus: "Never checked",
    lastCheckError: null,
  });

  renderStatus(data);
  renderKeywords(data.keywords);
  renderRecentMatches(data.recentMatches);

  const validPresets = ["5", "15", "30", "60"];
  const intervalStr = String(data.checkIntervalMinutes || 15);
  intervalSelectEl.value = validPresets.includes(intervalStr)
    ? intervalStr
    : "15";
}

// Event Listeners
checkNowBtn.addEventListener("click", async () => {
  checkNowBtn.disabled = true;
  checkNowBtn.textContent = "Checking…";
  statusBadgeEl.textContent = "Checking…";
  statusBadgeEl.className = "status-pill status-idle";
  statusErrorEl.hidden = true;

  try {
    await chrome.runtime.sendMessage({ type: "CHECK_NOW" });
    await loadState();
    // Since popup is currently open, keep unread count cleared if user is viewing matches
    await clearUnreadBadgeOnOpen();
  } catch (err) {
    renderStatus({
      lastCheckTime: new Date().toISOString(),
      lastCheckStatus: "Error",
      lastCheckError: err?.message || "Unable to reach background worker",
    });
  } finally {
    checkNowBtn.disabled = false;
    checkNowBtn.textContent = "Check Now";
  }
});

keywordFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  await addKeyword(keywordInputEl.value);
});

intervalSelectEl.addEventListener("change", async () => {
  const minutes = Number(intervalSelectEl.value) || 15;
  await chrome.storage.local.set({ checkIntervalMinutes: minutes });
  try {
    await chrome.runtime.sendMessage({
      type: "UPDATE_INTERVAL",
      checkIntervalMinutes: minutes,
    });
  } catch {
    await chrome.alarms.create("check-cccs-feed", { periodInMinutes: minutes });
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes.keywords) {
    renderKeywords(changes.keywords.newValue);
  }
  if (changes.recentMatches) {
    renderRecentMatches(changes.recentMatches.newValue);
  }
  if (
    changes.lastCheckTime ||
    changes.lastCheckStatus ||
    changes.lastCheckError
  ) {
    chrome.storage.local
      .get({
        lastCheckTime: null,
        lastCheckStatus: "Never checked",
        lastCheckError: null,
      })
      .then(renderStatus);
  }
});

function syncSystemTheme() {
  if (typeof window.matchMedia !== "function") return;
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const applyTheme = (isDark) => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  };

  applyTheme(mediaQuery.matches);
  mediaQuery.addEventListener("change", (event) => {
    applyTheme(event.matches);
  });
}

// Initialize popup immediately on load
syncSystemTheme();
clearUnreadBadgeOnOpen();
loadState();
