import {
  parseAtomFeed,
  evaluateEntryAgainstKeywords,
} from "./feedUtils.js";

const ALARM_NAME = "check-cccs-feed";
const MAX_SEEN_IDS = 500;
const MAX_STORED_MATCHES = 25;
const MAX_NOTIFICATION_URLS = 200;

const STORAGE_DEFAULTS = {
  feedUrl:
    "https://www.cyber.gc.ca/api/cccs/atom/v1/get?feed=alerts_advisories&lang=en",
  checkIntervalMinutes: 15,
  keywords: ["Windows", "Linux"],
  seenEntryIds: [],
  recentMatches: [],
  unreadCount: 0,
  notificationUrls: {},
  lastCheckTime: null,
  lastCheckStatus: "Never checked",
  lastCheckError: null,
};

let activeCheckPromise = null;

async function initializeDefaultsIfMissing() {
  const existing = await chrome.storage.local.get(Object.keys(STORAGE_DEFAULTS));
  const toSet = {};

  for (const [key, defaultValue] of Object.entries(STORAGE_DEFAULTS)) {
    if (existing[key] === undefined) {
      toSet[key] = defaultValue;
    }
  }

  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }

  return { ...STORAGE_DEFAULTS, ...existing, ...toSet };
}

async function updateBadge(unreadCount) {
  const count = Number(unreadCount) || 0;
  try {
    await chrome.action.setBadgeBackgroundColor({ color: "#D80621" });
    if (typeof chrome.action.setBadgeTextColor === "function") {
      await chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
    }
    await chrome.action.setBadgeText({
      text: count > 0 ? String(count) : "",
    });
  } catch (err) {
    console.error("[CCCS Threat Monitor] Failed to update badge:", err);
  }
}

async function ensureAlarmScheduled(forceRecreate = false) {
  const { checkIntervalMinutes } = await chrome.storage.local.get({
    checkIntervalMinutes: STORAGE_DEFAULTS.checkIntervalMinutes,
  });
  const periodInMinutes = Math.max(1, Number(checkIntervalMinutes) || 15);

  const existingAlarm = await chrome.alarms.get(ALARM_NAME);
  if (
    forceRecreate ||
    !existingAlarm ||
    existingAlarm.periodInMinutes !== periodInMinutes
  ) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes });
  }
}

async function createAdvisoryNotification(match, notificationUrls) {
  const notificationId = `cccs-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;

  if (match.url) {
    notificationUrls[notificationId] = match.url;
    // Cap stored notification URL entries while keeping the newest ones
    const keys = Object.keys(notificationUrls);
    if (keys.length > MAX_NOTIFICATION_URLS) {
      for (const oldKey of keys.slice(0, keys.length - MAX_NOTIFICATION_URLS)) {
        delete notificationUrls[oldKey];
      }
    }
    await chrome.storage.local.set({ notificationUrls });
  }

  const keywordPrefix =
    match.matchedKeywords.length > 0
      ? `[${match.matchedKeywords.join(", ")}] `
      : "";
  const baseOptions = {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: `${keywordPrefix}${match.title}`,
    message: match.body || match.title,
  };

  try {
    await chrome.notifications.create(notificationId, {
      ...baseOptions,
      requireInteraction: true,
    });
  } catch {
    // Fallback if platform does not support requireInteraction
    await chrome.notifications.create(notificationId, baseOptions);
  }
}

async function performFeedCheck() {
  const state = await initializeDefaultsIfMissing();
  const { feedUrl, keywords } = state;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(feedUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept:
          "application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();
    const entries = parseAtomFeed(xmlText);

    // Re-read mutable state immediately prior to committing results
    const current = await chrome.storage.local.get({
      seenEntryIds: [],
      recentMatches: [],
      unreadCount: 0,
      notificationUrls: {},
      keywords: STORAGE_DEFAULTS.keywords,
    });

    const activeKeywords = Array.isArray(current.keywords)
      ? current.keywords
      : keywords;
    const seenList = Array.isArray(current.seenEntryIds)
      ? [...current.seenEntryIds]
      : [];
    const seenSet = new Set(seenList);

    const nowIso = new Date().toISOString();

    // Very first run: when seenEntryIds is empty, mark existing entries as seen without spamming historical alerts
    if (seenList.length === 0) {
      const chronologicalIds = [...entries]
        .reverse()
        .map((e) => e.id)
        .filter(Boolean);
      const uniqueIds = [...new Set(chronologicalIds)].slice(-MAX_SEEN_IDS);

      await chrome.storage.local.set({
        seenEntryIds: uniqueIds,
        lastCheckTime: nowIso,
        lastCheckStatus: "OK",
        lastCheckError: null,
      });

      return {
        ok: true,
        initializedBaseline: true,
        newMatchesCount: 0,
        lastCheckTime: nowIso,
      };
    }

    // Process unseen entries in chronological order (oldest -> newest) so seenEntryIds retains the 500 most recent
    const unseenEntries = entries
      .filter((entry) => !seenSet.has(entry.id))
      .reverse();

    const newMatches = [];
    const notificationUrls = { ...(current.notificationUrls || {}) };

    for (const entry of unseenEntries) {
      if (!seenSet.has(entry.id)) {
        seenSet.add(entry.id);
        seenList.push(entry.id);
      }

      const result = evaluateEntryAgainstKeywords(entry, activeKeywords);
      if (result.excluded || !result.matched) {
        continue;
      }

      const matchRecord = {
        id: entry.id,
        title: entry.title,
        url: entry.url,
        updated: entry.updated,
        matchedAt: nowIso,
        matchedKeywords: result.matchedKeywords,
        body: entry.body,
      };

      newMatches.push(matchRecord);
    }

    const cappedSeenIds = seenList.slice(-MAX_SEEN_IDS);
    const newestFirstNewMatches = [...newMatches].reverse();
    const updatedRecentMatches = [
      ...newestFirstNewMatches,
      ...(Array.isArray(current.recentMatches) ? current.recentMatches : []),
    ].slice(0, MAX_STORED_MATCHES);

    const updatedUnreadCount =
      (Number(current.unreadCount) || 0) + newMatches.length;

    await chrome.storage.local.set({
      seenEntryIds: cappedSeenIds,
      recentMatches: updatedRecentMatches,
      unreadCount: updatedUnreadCount,
      lastCheckTime: nowIso,
      lastCheckStatus: "OK",
      lastCheckError: null,
    });

    if (newMatches.length > 0) {
      await updateBadge(updatedUnreadCount);
      for (const match of newMatches) {
        await createAdvisoryNotification(match, notificationUrls);
      }
    }

    return {
      ok: true,
      initializedBaseline: false,
      newMatchesCount: newMatches.length,
      lastCheckTime: nowIso,
    };
  } catch (err) {
    const nowIso = new Date().toISOString();
    const errorMessage =
      err?.name === "AbortError"
        ? "Feed request timed out (25s)"
        : err?.message || "Failed to fetch feed";

    await chrome.storage.local.set({
      lastCheckTime: nowIso,
      lastCheckStatus: "Error",
      lastCheckError: errorMessage,
    });

    return {
      ok: false,
      error: errorMessage,
      lastCheckTime: nowIso,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function checkFeed() {
  if (!activeCheckPromise) {
    activeCheckPromise = performFeedCheck().finally(() => {
      activeCheckPromise = null;
    });
  }
  return activeCheckPromise;
}

// ============================================================================
// Top-Level Synchronous Event Listeners (Strict MV3 Service Worker Requirement)
// ============================================================================

chrome.runtime.onInstalled.addListener(() => {
  (async () => {
    const state = await initializeDefaultsIfMissing();
    await updateBadge(state.unreadCount);
    await ensureAlarmScheduled(false);
    await checkFeed();
  })();
});

chrome.runtime.onStartup.addListener(() => {
  (async () => {
    const state = await initializeDefaultsIfMissing();
    await updateBadge(state.unreadCount);
    await ensureAlarmScheduled(false);
  })();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm?.name === ALARM_NAME) {
    checkFeed();
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  (async () => {
    const { notificationUrls = {} } = await chrome.storage.local.get({
      notificationUrls: {},
    });
    const targetUrl = notificationUrls[notificationId];

    if (targetUrl && /^https?:\/\//i.test(targetUrl)) {
      await chrome.tabs.create({ url: targetUrl });
    }

    await chrome.notifications.clear(notificationId);

    if (Object.prototype.hasOwnProperty.call(notificationUrls, notificationId)) {
      delete notificationUrls[notificationId];
      await chrome.storage.local.set({ notificationUrls });
    }
  })();
});

chrome.notifications.onClosed.addListener((notificationId) => {
  (async () => {
    const { notificationUrls = {} } = await chrome.storage.local.get({
      notificationUrls: {},
    });
    if (Object.prototype.hasOwnProperty.call(notificationUrls, notificationId)) {
      delete notificationUrls[notificationId];
      await chrome.storage.local.set({ notificationUrls });
    }
  })();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "CLEAR_UNREAD") {
    (async () => {
      try {
        await chrome.storage.local.set({ unreadCount: 0 });
        await updateBadge(0);
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || "Failed to clear badge" });
      }
    })();
    return true;
  }

  if (message.type === "CHECK_NOW") {
    (async () => {
      const result = await checkFeed();
      sendResponse(result);
    })();
    return true;
  }

  if (message.type === "UPDATE_INTERVAL") {
    (async () => {
      try {
        const minutes = Math.max(1, Number(message.checkIntervalMinutes) || 15);
        await chrome.storage.local.set({ checkIntervalMinutes: minutes });
        await chrome.alarms.create(ALARM_NAME, { periodInMinutes: minutes });
        sendResponse({ ok: true, checkIntervalMinutes: minutes });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err?.message || "Failed to update polling interval",
        });
      }
    })();
    return true;
  }

  return false;
});
