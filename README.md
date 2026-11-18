<p align="center">
  <img src="public/icons/icon128.png" alt="CCCS Threat Monitor Logo" width="96" height="96" />
</p>

# CCCS Threat Monitor

> Monitors the Canadian Centre for Cyber Security (CCCS) Atom feed for keyword matches with unread badges and full-text alerts.

**CCCS Threat Monitor** (`v1.0.1`) is a lightweight Manifest V3 Google Chrome extension that monitors the official [Canadian Centre for Cyber Security (CCCS)](https://www.cyber.gc.ca/) public Alerts and Advisories Atom feed, filters new bulletins locally against a customizable keyword watchlist, updates an unread badge counter on the extension toolbar icon, and delivers native desktop notifications with the full advisory text.

## Key Benefits

- **Hands-Free CCCS Advisory Monitoring:** Automatically tracks official Canadian Centre for Cyber Security alerts and advisories in the background—no manual `cyber.gc.ca` checks or separate RSS client required.
- **High-Signal Keyword Targeting (Less Alert Fatigue):** Surfaces only bulletins matching the platforms, vendors, and products you care about (while letting you exclude irrelevant ones), keeping your attention focused on actionable threats.
- **At-a-Glance Unread Badge Awareness:** Displays an unmistakable toolbar unread badge count whenever matching advisories arrive—so you never miss an alert while away from your desk—and resets automatically when you open the popup.
- **Instant Triage via Full-Text Desktop Notifications:** Delivers the complete plain-text advisory body directly in native desktop notifications so you can assess impact, affected products, and CVEs on the spot, with one-click access to the full CCCS bulletin when deeper remediation is needed.

## What It Does

- **Scheduled Atom Feed Monitoring:** Polls the official CCCS English Alerts & Advisories feed (`https://www.cyber.gc.ca/api/cccs/atom/v1/get?feed=alerts_advisories&lang=en`) in the background using `chrome.alarms` (surviving browser restarts and system shutdowns).
- **Veto-First Keyword & Exclusion Filtering:** Evaluates advisory and alert titles locally against your watchlist—supporting case-insensitive substring **watch keywords** and whole-word **negative exclusions** prefixed with `-`.
- **Clean Initial Baseline:** On first install, marks currently published feed entries as seen without spamming historical desktop alerts.
- **Unread Toolbar Badge:** Increments a high-contrast `#D80621` badge counter on the extension icon when new matches arrive, and clears it automatically when you open the popup.
- **Full-Text Desktop Notifications:** Displays native browser notifications containing the matched keywords, advisory title, and complete plain-text advisory body (`requireInteraction: true` where supported). Clicking any notification opens the official CCCS advisory in a new tab.
- **Recent Matches Viewer:** Stores your most recent matches and shows the last 10 in the popup with matched keyword pills, timestamps, expandable full-text previews, and direct links.
- **Automatic Light & Dark Theme:** Adapts seamlessly to your operating system and browser `prefers-color-scheme` setting.
- **100% Local & Private:** All XML parsing, keyword matching, and state persistence run exclusively inside your browser via `chrome.storage.local`—no backend servers, accounts, or telemetry.

---

## Install from the Chrome Web Store

1. Open the **[Chrome Web Store](https://chromewebstore.google.com/)** in Google Chrome and search for **CCCS Threat Monitor** (or navigate directly to the extension's Chrome Web Store listing).
2. Click **Add to Chrome**.
3. Review the requested permissions (`alarms`, `notifications`, `storage`, and access to `https://www.cyber.gc.ca/*`) and click **Add extension**.
4. Click the **Extensions** (puzzle piece) button in the Chrome toolbar and click the **Pin** icon beside **CCCS Threat Monitor** so the unread badge counter remains visible.
5. Click the pinned **CCCS Threat Monitor** icon to open the popup and **customize the default keywords** for your environment.

---

## How to Use

> [!IMPORTANT]
> **Customize the Default Keywords:** Out of the box, **CCCS Threat Monitor** ships with only `"Windows"` and `"Linux"` as starter default keywords. You should **update this watchlist to suit your own infrastructure, vendors, and preferences**—for example, adding terms like `RHEL`, `Cisco`, `VMware`, `Fortinet`, `Citrix`, `Exchange`, or exclusion rules like `-macOS`.

### 1. Managing the Keyword Watchlist

All watchlist changes are saved immediately to `chrome.storage.local` and persist across browser and computer restarts.

- **Positive Watch Keywords (Blue Pills):** Type a vendor, OS, or product name (e.g., `Cisco`, `RHEL`, `VMware`) and press **Enter** or click **Add**. Positive terms match case-insensitively as substrings in the advisory or alert title.
- **Negative Exclusion Keywords (Red Strikethrough Pills):** Prefix a term with `-` (e.g., `-macOS`, `-iOS`) to suppress noisy advisories. Exclusions are evaluated **veto-first** against the advisory title using case-insensitive whole-word boundaries (`\bterm\b`), so `-win` will not falsely block `"window"` or `"Windows"`, while a whole-word match immediately discards the advisory even if a positive watch term is also present.
- **Removing a Term:** Click the **`×`** button on any pill to delete it from your watchlist.

### 2. Check Frequency & Manual Scans

- **Polling Presets:** Use the **Check Frequency** dropdown in the popup to select **Every 5 minutes**, **Every 15 minutes (Default)**, **Every 30 minutes**, or **Every 1 hour**.
- **Manual Check:** Click **Check Now** in the status bar at any time to fetch and evaluate the feed immediately and inspect the last check timestamp and status (`OK` or error details).

### 3. Notifications, Unread Badge & Recent Matches

- **Desktop Alerts:** When a newly published CCCS advisory matches your watchlist, Chrome shows a persistent notification with the full plain-text advisory body. Click the notification to open the CCCS advisory page in a new tab.
- **Toolbar Badge & Match History:** Opening the popup automatically clears the unread toolbar badge and displays up to the **last 10 matched advisories**. If your operating system truncates long desktop notification banners, expand **Show full advisory text** on any entry in the popup or click **Open ↗** to read it on `cyber.gc.ca`.

---

## Dependencies

### Prerequisites

- **Node.js** `18+` (Node `20+` LTS recommended; verified on Node `24.18.0`)
- **npm**
- **Google Chrome** (or another Chromium-based browser supporting Manifest V3)

### Runtime Dependencies

- [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) (`^4.5.0`) — parses the CCCS Atom XML feed inside the Manifest V3 background service worker (where `DOMParser` is unavailable).

### Development & Build Dependencies

- [`vite`](https://vite.dev/) (`^5.4.11`) — bundles extension scripts, CSS, and HTML into `dist/` with strict Manifest V3 CSP compliance (no inline scripts or remote CDNs).
- [`@crxjs/vite-plugin`](https://crxjs.dev/vite-plugin) (`^2.0.0-beta.28`) — builds Manifest V3 service workers, popup pages, and `dist/manifest.json`.
- [`@resvg/resvg-js`](https://github.com/thx/resvg-js) (`^2.6.2`) — renders the programmatic vector SVG maple-leaf-and-padlock logo into `16x16`, `48x48`, and `128x128` PNG icons in `public/icons/` during `prebuild` (falls back to the `inkscape` CLI if native bindings are unavailable).

---

## Local Development: Build, Install & Test

### 1. Clone, Install & Build

```bash
git clone https://github.com/va7acq/cccs-threat-monitor.git
cd cccs-threat-monitor
npm install
npm run build
```

Running `npm run build` automatically executes `prebuild` (`npm run generate-icons`) to generate `public/icons/icon16.png`, `icon48.png`, and `icon128.png`, then compiles the complete extension bundle into `dist/`.

### 2. Load Unpacked in Chrome

1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked** and select the compiled **`dist/`** directory inside the repository (not the repository root).
4. Whenever you modify source files, re-run `npm run build` (or use `npm run dev` for Vite watch mode) and click the **Reload** icon on the **CCCS Threat Monitor** card in `chrome://extensions`.

### 3. Available npm Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run generate-icons` | `node scripts/generate-icons.js` | Generates `icon.svg` and `16x16`, `48x48`, `128x128` PNG icons in `public/icons/`. |
| `npm run sync-privacy` | `node scripts/sync-privacy.js` | Syncs `PRIVACY.md` to `docs/privacy-policy.md` for GitHub Pages. |
| `npm run build` | `vite build` | Runs `prebuild` (icon generation + privacy sync) and builds the production MV3 bundle in `dist/`. |
| `npm run dev` | `vite` | Starts Vite in development mode for active iteration. |
| `npm test` | `node --test tests/extension.test.js` | Builds `dist/` via `pretest` and runs automated unit and build-artifact verification tests. |
| `npm run package` | `node scripts/package-extension.js` | Runs `npm test` (fresh build + tests) and packages `dist/` into `cccs-threat-monitor-v<version>.zip` for Chrome Web Store upload. |

### 4. Project Structure

```text
cccs-threat-monitor/
├── manifest.json              # Manifest V3 configuration, permissions, and entry points
├── vite.config.js             # Vite + @crxjs/vite-plugin build configuration
├── scripts/
│   ├── generate-icons.js      # Programmatic SVG -> PNG icon generator (16, 48, 128 px)
│   ├── package-extension.js   # Builds Chrome Web Store .zip archive from dist/
│   └── sync-privacy.js        # Keeps docs/privacy-policy.md synced with PRIVACY.md
├── docs/
│   └── privacy-policy.md      # GitHub Pages privacy policy copy (synced from PRIVACY.md)
├── public/
│   └── icons/                 # Generated SVG master and PNG extension icons
├── src/
│   ├── background.js          # MV3 service worker (alarms, feed checks, badge, notifications)
│   ├── feedUtils.js           # Atom XML parser, HTML-to-text converter, keyword/veto matcher
│   ├── popup.html             # Extension popup markup (strict MV3 CSP, light/dark color-scheme)
│   ├── popup.css              # Light & dark theme CSS tokens and popup layout
│   └── popup.js               # Popup state, watchlist controls, interval selector, theme sync
├── tests/
│   └── extension.test.js      # Node test suite covering parsing, matching, worker & build output
├── dist/                      # Production unpacked Chrome extension output (load this folder)
├── LICENSE                    # MIT License
├── PRIVACY.md                 # Extension privacy policy
└── README.md                  # Project documentation
```

---

## License, Privacy & Disclaimer

- **License:** Released under the [MIT License](./LICENSE) (Copyright © 2026 Josh Sinclair).
- **Privacy Policy:** See [PRIVACY.md](./PRIVACY.md) for complete details. **CCCS Threat Monitor** performs all feed fetching, XML parsing, keyword filtering, and storage locally in your browser without collecting or transmitting any user data.
- **Disclaimer of Affiliation:** **CCCS Threat Monitor** is an independent open-source utility and is not affiliated with, endorsed by, sponsored by, or officially connected to the Canadian Centre for Cyber Security (CCCS), the Communications Security Establishment Canada (CSE), or the Government of Canada.
- **AI Development Disclaimer:** This extension was created with Google Antigravity using the Gemini 4 Carbon model.
