import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseAtomFeed,
  htmlToPlainText,
  evaluateEntryAgainstKeywords,
} from "../src/feedUtils.js";

const SAMPLE_ATOM_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Alerts and advisories - Canadian Centre for Cyber Security</title>
  <id>https://www.cyber.gc.ca/en/alerts-advisories</id>
  <updated>2026-11-16T20:00:00Z</updated>
  <entry>
    <id>tag:cyber.gc.ca,2026:AL26-002</id>
    <title type="html">Cisco IOS XE &amp; VMware ESXi Security Advisory (AL26-002)</title>
    <updated>2026-11-16T19:30:00Z</updated>
    <link rel="self" href="https://www.cyber.gc.ca/api/entry/AL26-002" />
    <link rel="alternate" type="text/html" href="https://www.cyber.gc.ca/en/alerts-advisories/al26-002" />
    <summary type="html">&lt;p&gt;Short summary only.&lt;/p&gt;</summary>
    <content type="html">&lt;div&gt;&lt;h2&gt;Purpose&lt;/h2&gt;&lt;p&gt;An advisory regarding Cisco &amp;amp; VMware products.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;CVE-2026-1001&lt;/li&gt;&lt;li&gt;CVE-2026-1002&lt;/li&gt;&lt;/ul&gt;&lt;/div&gt;</content>
  </entry>
  <entry>
    <id>tag:cyber.gc.ca,2026:AV26-001</id>
    <title>Apple macOS and Linux Kernel Update</title>
    <updated>2026-11-16T18:00:00Z</updated>
    <link href="https://www.cyber.gc.ca/en/alerts-advisories/av26-001" />
    <summary type="html">&lt;p&gt;Updates for macOS Sonoma and RHEL 9.&lt;/p&gt;</summary>
  </entry>
</feed>`;

test("parseAtomFeed extracts entries, alternate links, fallback links, and prefers <content> over <summary>", () => {
  const entries = parseAtomFeed(SAMPLE_ATOM_XML);
  assert.equal(entries.length, 2);

  // Entry 1: <content> preferred, rel="alternate" selected over rel="self"
  assert.equal(entries[0].id, "tag:cyber.gc.ca,2026:AL26-002");
  assert.equal(
    entries[0].title,
    "Cisco IOS XE & VMware ESXi Security Advisory (AL26-002)"
  );
  assert.equal(
    entries[0].url,
    "https://www.cyber.gc.ca/en/alerts-advisories/al26-002"
  );
  assert.match(entries[0].body, /Purpose/);
  assert.match(entries[0].body, /Cisco & VMware products\./);
  assert.match(entries[0].body, /• CVE-2026-1001/);
  assert.doesNotMatch(entries[0].body, /<p>|<div>|Short summary only/);

  // Entry 2: falls back to <summary> and first <link>@_href
  assert.equal(entries[1].id, "tag:cyber.gc.ca,2026:AV26-001");
  assert.equal(
    entries[1].url,
    "https://www.cyber.gc.ca/en/alerts-advisories/av26-001"
  );
  assert.equal(entries[1].body, "Updates for macOS Sonoma and RHEL 9.");
});

test("htmlToPlainText preserves paragraph breaks and decodes entities cleanly", () => {
  const raw =
    "<p>First paragraph&nbsp;with &#8220;quotes&#8221; &amp; accents (&eacute;).</p><p>Second<br/>line</p>";
  const plain = htmlToPlainText(raw);
  assert.equal(
    plain,
    "First paragraph with “quotes” & accents (é).\n\nSecond\nline"
  );
});

test("evaluateEntryAgainstKeywords applies veto-first word-boundary exclusions and substring positives on titles only", () => {
  // Partial word "-win" must NOT falsely block "window" or "Windows" in the title
  const windowsEntry = {
    title: "Microsoft Windows Maintenance Window Advisory",
    body: "Maintenance window scheduled for administrators.",
  };
  const res1 = evaluateEntryAgainstKeywords(windowsEntry, ["Windows", "-win"]);
  assert.equal(res1.excluded, false);
  assert.equal(res1.matched, true);
  assert.deepEqual(res1.matchedKeywords, ["Windows"]);

  // Exact word "-win" MUST veto standalone "win" in the title
  const standaloneWinEntry = {
    title: "Windows Quick Win Advisory",
    body: "Patch management guidance.",
  };
  const res2 = evaluateEntryAgainstKeywords(standaloneWinEntry, [
    "Windows",
    "-win",
  ]);
  assert.equal(res2.excluded, true);
  assert.equal(res2.matched, false);

  // Veto-first exclusion blocks even when positive keyword "Linux" matches in the title
  const mixedEntry = {
    title: "Apple macOS and Linux Update",
    body: "Affects macOS and RHEL servers.",
  };
  const res3 = evaluateEntryAgainstKeywords(mixedEntry, [
    "RHEL",
    "Linux",
    "-macos",
  ]);
  assert.equal(res3.excluded, true);
  assert.equal(res3.matched, false);

  // Title-only enforcement: positive keywords present only in body do NOT match
  const bodyOnlyMatch = {
    title: "Generic Router Security Advisory",
    body: "Mentions Windows and Linux in passing.",
  };
  const res4 = evaluateEntryAgainstKeywords(bodyOnlyMatch, ["Windows", "Linux"]);
  assert.equal(res4.excluded, false);
  assert.equal(res4.matched, false);
  assert.deepEqual(res4.matchedKeywords, []);

  // Title-only enforcement: exclusion keywords present only in body do NOT veto
  const bodyOnlyExclusion = {
    title: "Windows Server Security Advisory",
    body: "Also notes macOS compatibility.",
  };
  const res5 = evaluateEntryAgainstKeywords(bodyOnlyExclusion, [
    "Windows",
    "-macOS",
  ]);
  assert.equal(res5.excluded, false);
  assert.equal(res5.matched, true);
  assert.deepEqual(res5.matchedKeywords, ["Windows"]);
});

test("background service worker registers listeners synchronously, handles baseline + new matches + badge + click URL persistence", async () => {
  const storageData = {};
  const listeners = {
    onInstalled: [],
    onStartup: [],
    onAlarm: [],
    onNotificationClicked: [],
    onNotificationClosed: [],
    onMessage: [],
  };
  const alarms = new Map();
  const createdNotifications = [];
  const clearedNotifications = [];
  const openedTabs = [];
  let badgeText = "";
  let badgeBg = "";

  globalThis.chrome = {
    storage: {
      local: {
        async get(keys) {
          if (Array.isArray(keys)) {
            const out = {};
            for (const k of keys) {
              if (k in storageData) out[k] = structuredClone(storageData[k]);
            }
            return out;
          }
          if (keys && typeof keys === "object") {
            const out = {};
            for (const [k, def] of Object.entries(keys)) {
              out[k] =
                k in storageData
                  ? structuredClone(storageData[k])
                  : structuredClone(def);
            }
            return out;
          }
          return structuredClone(storageData);
        },
        async set(items) {
          for (const [k, v] of Object.entries(items)) {
            storageData[k] = structuredClone(v);
          }
        },
      },
    },
    alarms: {
      async get(name) {
        return alarms.get(name) || undefined;
      },
      async create(name, info) {
        alarms.set(name, { name, ...info });
      },
      onAlarm: {
        addListener(fn) {
          listeners.onAlarm.push(fn);
        },
      },
    },
    action: {
      async setBadgeBackgroundColor({ color }) {
        badgeBg = color;
      },
      async setBadgeTextColor() {},
      async setBadgeText({ text }) {
        badgeText = text;
      },
    },
    notifications: {
      async create(id, options) {
        createdNotifications.push({ id, options });
        return id;
      },
      async clear(id) {
        clearedNotifications.push(id);
        return true;
      },
      onClicked: {
        addListener(fn) {
          listeners.onNotificationClicked.push(fn);
        },
      },
      onClosed: {
        addListener(fn) {
          listeners.onNotificationClosed.push(fn);
        },
      },
    },
    tabs: {
      async create(opts) {
        openedTabs.push(opts);
      },
    },
    runtime: {
      getURL(p) {
        return `chrome-extension://test-ext-id/${p.replace(/^\//, "")}`;
      },
      onInstalled: {
        addListener(fn) {
          listeners.onInstalled.push(fn);
        },
      },
      onStartup: {
        addListener(fn) {
          listeners.onStartup.push(fn);
        },
      },
      onMessage: {
        addListener(fn) {
          listeners.onMessage.push(fn);
        },
      },
    },
  };

  let currentFeedXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>baseline-1</id>
        <title>Cisco Baseline Entry</title>
        <updated>2026-11-16T10:00:00Z</updated>
        <link rel="alternate" href="https://www.cyber.gc.ca/en/baseline-1" />
        <content type="html">&lt;p&gt;Initial baseline Cisco advisory.&lt;/p&gt;</content>
      </entry>
    </feed>`;

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    async text() {
      return currentFeedXml;
    },
  });

  // Import background.js and verify top-level synchronous listener registration
  await import("../src/background.js");

  assert.equal(listeners.onInstalled.length, 1);
  assert.equal(listeners.onStartup.length, 1);
  assert.equal(listeners.onAlarm.length, 1);
  assert.equal(listeners.onNotificationClicked.length, 1);
  assert.equal(listeners.onMessage.length, 1);

  // Trigger onInstalled -> initializes defaults, schedules alarm, marks baseline without notifying
  listeners.onInstalled[0]({ reason: "install" });
  await new Promise((r) => setTimeout(r, 80));

  assert.equal(alarms.get("check-cccs-feed")?.periodInMinutes, 15);
  assert.deepEqual(storageData.keywords, ["Windows", "Linux"]);
  assert.deepEqual(storageData.seenEntryIds, ["baseline-1"]);
  assert.equal(storageData.unreadCount, 0);
  assert.equal(createdNotifications.length, 0);

  // Now simulate 2 new advisories: one matching Cisco/VMware, one excluded by -macOS
  await chrome.storage.local.set({
    keywords: ["Cisco", "VMware", "Linux", "-macOS"],
  });

  currentFeedXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>new-match-1</id>
        <title>Critical VMware &amp; Cisco Advisory</title>
        <updated>2026-11-16T12:00:00Z</updated>
        <link rel="alternate" href="https://www.cyber.gc.ca/en/new-match-1" />
        <content type="html">&lt;p&gt;Full advisory details for VMware ESXi and Cisco.&lt;/p&gt;</content>
      </entry>
      <entry>
        <id>new-excluded-1</id>
        <title>Linux and macOS Advisory</title>
        <updated>2026-11-16T11:00:00Z</updated>
        <link rel="alternate" href="https://www.cyber.gc.ca/en/new-excluded-1" />
        <content type="html">&lt;p&gt;Applies to Linux and macOS systems.&lt;/p&gt;</content>
      </entry>
      <entry>
        <id>baseline-1</id>
        <title>Cisco Baseline Entry</title>
        <updated>2026-11-16T10:00:00Z</updated>
        <link rel="alternate" href="https://www.cyber.gc.ca/en/baseline-1" />
        <content type="html">&lt;p&gt;Initial baseline Cisco advisory.&lt;/p&gt;</content>
      </entry>
    </feed>`;

  // Trigger manual CHECK_NOW message
  const checkResponse = await new Promise((resolve) => {
    listeners.onMessage[0]({ type: "CHECK_NOW" }, {}, resolve);
  });

  assert.equal(checkResponse.ok, true);
  assert.equal(checkResponse.newMatchesCount, 1);
  assert.equal(storageData.unreadCount, 1);
  assert.equal(badgeText, "1");
  assert.equal(badgeBg, "#D80621");
  assert.deepEqual(storageData.seenEntryIds, [
    "baseline-1",
    "new-excluded-1",
    "new-match-1",
  ]);
  assert.equal(createdNotifications.length, 1);
  assert.match(createdNotifications[0].options.title, /Cisco, VMware/);
  assert.equal(
    createdNotifications[0].options.message,
    "Full advisory details for VMware ESXi and Cisco."
  );
  assert.equal(createdNotifications[0].options.requireInteraction, true);

  // Click notification -> opens advisory URL in new tab and removes entry from notificationUrls
  const notifId = createdNotifications[0].id;
  assert.equal(
    storageData.notificationUrls[notifId],
    "https://www.cyber.gc.ca/en/new-match-1"
  );

  listeners.onNotificationClicked[0](notifId);
  await new Promise((r) => setTimeout(r, 50));

  assert.deepEqual(openedTabs, [
    { url: "https://www.cyber.gc.ca/en/new-match-1" },
  ]);
  assert.ok(clearedNotifications.includes(notifId));
  assert.equal(storageData.notificationUrls[notifId], undefined);

  // Test CLEAR_UNREAD message
  const clearResponse = await new Promise((resolve) => {
    listeners.onMessage[0]({ type: "CLEAR_UNREAD" }, {}, resolve);
  });
  assert.equal(clearResponse.ok, true);
  assert.equal(storageData.unreadCount, 0);
  assert.equal(badgeText, "");
});

test("generated icons and dist build artifacts exist with valid PNG dimensions", () => {
  const sizes = [16, 48, 128];
  for (const size of sizes) {
    for (const baseDir of ["public/icons", "dist/icons"]) {
      const filePath = path.resolve(process.cwd(), baseDir, `icon${size}.png`);
      assert.ok(fs.existsSync(filePath), `Missing ${filePath}`);
      const buf = fs.readFileSync(filePath);
      // Verify PNG signature
      assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      // Verify IHDR width and height
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      assert.equal(width, size);
      assert.equal(height, size);
    }
  }

  const distManifest = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "dist/manifest.json"), "utf8")
  );
  assert.equal(distManifest.manifest_version, 3);
  assert.equal(distManifest.name, "CCCS Threat Monitor");
  assert.equal(distManifest.version, "1.0.1");
  assert.ok(
    distManifest.description.length <= 132,
    `Manifest description (${distManifest.description.length} chars) must not exceed 132 chars`
  );
  assert.equal(distManifest.optional_host_permissions, undefined);
  assert.deepEqual(distManifest.permissions, [
    "alarms",
    "notifications",
    "storage",
  ]);
});

test("popup supports system-derived light and dark themes with MV3 CSP compliance", () => {
  const distPopupHtml = fs.readFileSync(
    path.resolve(process.cwd(), "dist/src/popup.html"),
    "utf8"
  );
  assert.match(
    distPopupHtml,
    /<meta\s+name=["']color-scheme["']\s+content=["']light dark["']/i
  );

  // Ensure every <script> tag in dist/src/popup.html is external (no inline JS)
  const scriptTags = [...distPopupHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.ok(scriptTags.length > 0, "Expected module script tag in dist/src/popup.html");
  for (const [, attrs, body] of scriptTags) {
    assert.match(attrs, /\bsrc=/i, "Script tag must reference an external asset");
    assert.equal(body.trim(), "", "Inline script bodies are disallowed under MV3 CSP");
  }

  const popupCss = fs.readFileSync(
    path.resolve(process.cwd(), "src/popup.css"),
    "utf8"
  );
  assert.match(popupCss, /color-scheme:\s*light dark;/);
  assert.match(popupCss, /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/);
  assert.match(popupCss, /:root\[data-theme="dark"\]/);

  const componentCss = popupCss.split("* {")[1] || "";
  assert.ok(componentCss.length > 0, "Expected component CSS rules");
  assert.doesNotMatch(componentCss, /#fcfdff/i);
  assert.doesNotMatch(componentCss, /#cbd5e1/i);

  const popupJs = fs.readFileSync(
    path.resolve(process.cwd(), "src/popup.js"),
    "utf8"
  );
  assert.match(popupJs, /matchMedia\(\s*["']\(prefers-color-scheme:\s*dark\)["']\s*\)/);
  assert.match(popupJs, /documentElement\.dataset\.theme/);
});

test("docs/privacy-policy.md stays in sync with PRIVACY.md", () => {
  const rootPrivacy = fs.readFileSync(
    path.resolve(process.cwd(), "PRIVACY.md"),
    "utf8"
  );
  const docsPrivacy = fs.readFileSync(
    path.resolve(process.cwd(), "docs/privacy-policy.md"),
    "utf8"
  );
  assert.equal(
    docsPrivacy,
    rootPrivacy,
    "docs/privacy-policy.md must match PRIVACY.md"
  );
});
