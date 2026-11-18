# Privacy Policy for CCCS Threat Monitor

**Effective Date:** November 18, 2026  
**Extension Name:** CCCS Threat Monitor

## Overview

**CCCS Threat Monitor** is a browser extension designed to automatically poll the official Canadian Centre for Cyber Security (CCCS) public Alerts and Advisories Atom feed and notify users of security bulletins matching their configured keywords.

Your privacy is fundamental to the design of this extension. **CCCS Threat Monitor operates entirely locally within your browser.** It does not collect, transmit, store on external servers, sell, or share any personal information or user data.

---

## 1. Data Collection and Transmission

* **No Personal Data Collected:** CCCS Threat Monitor does not collect names, email addresses, IP addresses, authentication credentials, browsing history, or device identifiers.
* **No Developer Servers or Telemetry:** The extension has no backend server infrastructure. It contains zero analytics SDKs, crash trackers, advertising networks, or behavioral telemetry.
* **Local-Only Filtering:** All XML feed parsing and keyword matching occur exclusively in memory on your local machine. Your watchlist keywords and exclusion filters are never transmitted over the network.

---

## 2. Local Data Storage (`chrome.storage.local`)

To function across browser sessions, CCCS Threat Monitor uses the browser's built-in `chrome.storage.local` API to save the following configuration and state data solely on your device:

* **Positive Watchlist Keywords:** Terms you configure to match relevant security advisories (e.g., `RHEL`, `Linux`, `Windows`, `Cisco`, `VMware`, `HPE`, `Citrix`).
* **Negative Exclusion Keywords:** Terms you configure to filter out irrelevant bulletins.
* **Extension Preferences:** Your selected background polling interval and notification settings.
* **Advisory State Tracking:** Unique identifiers (`<id>` entries) and read/unread status flags for previously fetched CCCS advisories so the extension can calculate the toolbar unread badge count and avoid sending duplicate desktop notifications.

**Data Retention & Deletion:** This locally stored data never leaves your computer. You can clear it at any time by resetting your configuration within the extension or by uninstalling **CCCS Threat Monitor** from Chrome, which permanently deletes all associated `chrome.storage.local` data.

---

## 3. External Network Connections

CCCS Threat Monitor communicates with only one external endpoint:

* **Canadian Centre for Cyber Security (CCCS) Public Atom Feed:**  
  `https://www.cyber.gc.ca/api/cccs/atom/v1/get?feed=alerts_advisories&lang=en`

Requests to this endpoint are standard read-only HTTP `GET` requests made solely to retrieve publicly available cybersecurity alerts and advisories. No query parameters derived from your user profile, browsing activity, or keyword watchlist are appended to these requests.

---

## 4. Browser Permissions Usage

CCCS Threat Monitor requests only the minimum permissions required to perform its single purpose:

* **`alarms`:** Schedules periodic background checks (every 15 minutes by default) to poll the CCCS Atom feed.
* **`notifications`:** Displays native desktop alerts when a newly published advisory matches your local keyword rules.
* **`storage`:** Saves your keyword lists, polling preferences, and seen advisory IDs locally in `chrome.storage.local`.
* **`host_permissions` (`https://www.cyber.gc.ca/*`):** Allows the background service worker to fetch the public CCCS XML feed directly without cross-origin restrictions. The extension does not read, inject scripts into, or modify any web pages you visit.

---

## 5. Chrome Web Store Limited Use Compliance

CCCS Threat Monitor's use of information received from Chrome APIs adheres strictly to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-privacy/), including the Limited Use requirements. Because no user data is collected or transmitted off-device, user configuration data is never transferred to third parties, used for advertising, or used to determine creditworthiness.

---

## 6. Disclaimer of Affiliation

CCCS Threat Monitor is an independent open-source utility. It is not affiliated with, endorsed by, sponsored by, or officially connected to the Canadian Centre for Cyber Security (CCCS), the Communications Security Establishment Canada (CSE), or the Government of Canada.

---

## 7. Changes to This Privacy Policy & Contact

If future updates introduce changes to how the extension handles local storage or permissions, this Privacy Policy will be updated alongside a revised effective date at the top of this page.

For questions, bug reports, or privacy inquiries regarding **CCCS Threat Monitor**, please open an issue on the project's [official GitHub repository](https://github.com/va7acq/cccs-threat-monitor/issues) or contact the maintainer through the support link listed on the Chrome Web Store listing page.
