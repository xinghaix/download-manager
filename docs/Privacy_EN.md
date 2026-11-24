# Privacy Policy

#### download-manager

An open-source download manager extension (Manifest V3) for Chromium-based browsers (Google Chrome, Microsoft Edge, etc.).

**[简体中文](Privacy.md) | [English](Privacy_EN.md)**

**Last Updated**: November 2026  
**Applicable Version**: 1.3.0 and later

---

## 1. Data Collection & Privacy Statement

**download-manager** values your privacy and strictly adheres to the following principles:

1. **Zero Telemetry & Zero Third-Party Sharing**: This extension **does not collect, track, transmit, sell, or share** your personal identity information, browsing history, download list, download URLs, filenames, or downloaded file contents with the developer or any third party. All logic runs 100% locally inside your browser without remote scripts, advertisements, or analytics SDKs.
2. **Optional Built-In Browser Settings Sync Only**: By default, the extension uses the browser's built-in `chrome.storage.sync` only to synchronize your extension preferences (such as theme selection, icon colors, toolbar layout, and local file routing rules — never download history or personal browsing data) across devices signed in to your browser profile. You may turn off "Sync settings" at any time on the extension Options page to store preferences strictly locally via `chrome.storage.local`.
3. **Write-Only Clipboard Access on User Action**: The extension writes to the system clipboard solely when you explicitly click the "Copy download link" button or right-click a filename/URL in the popup to copy it. It **never reads or monitors** your clipboard content.
4. **Data Minimization & Limited Use**: Every permission requested in `manifest.json` is strictly limited to implementing user-facing download management functionality inside your browser in compliance with the Chrome Web Store / Microsoft Edge Add-ons Limited Use policies.

---

## 2. Browser Permissions Used by the Extension

In `manifest.json` (Manifest V3), this extension declares and uses only the following **9 permissions**:

### 2.1. `downloads`
Used to provide core download management features:
- Querying and displaying your browser download history and real-time download progress;
- Initiating manual downloads, pausing, resuming, canceling, retrying, removing entries, deleting downloaded files, or locating files in their local folder (`chrome.downloads.show`);
- Displaying confirmation prompts for browser-flagged dangerous downloads and applying your choice (`chrome.downloads.acceptDanger`);
- Evaluating your locally configured file extension and domain routing rules via `chrome.downloads.onDeterminingFilename` to organize downloads into subfolders under your default download directory (100% locally, with no external requests).

### 2.2. `downloads.open`
Used when you left-click a completed download's filename in the popup or click a download completion notification, invoking `chrome.downloads.open` to open the downloaded local file with the system's default application.

### 2.3. `downloads.shelf`
Used for compatibility with Chromium-based browsers that still support the legacy bottom download shelf, calling `chrome.downloads.setShelfEnabled(false)` to suppress redundant bottom download bar popups.

### 2.4. `downloads.ui`
Used in modern Chrome / Microsoft Edge (Manifest V3) to call `chrome.downloads.setUiOptions({ enabled: false })` so the browser's default download bubble/UI does not overlap with the extension's popup panel and toolbar icon progress indicator.

### 2.5. `storage`
Used to manage extension configuration and transient session state inside the browser:
- **User Preferences** (`chrome.storage.sync` / `chrome.storage.local`): Stores selected theme series, icon colors, popup dimensions, toolbar button layout, notification preferences, and file/domain routing rules;
- **Session Cache** (`chrome.storage.session`): Temporarily caches in-memory active download progress projections and pending download confirmations across Manifest V3 Service Worker restarts; automatically cleared when the browser closes.

### 2.6. `notifications`
Used (according to your settings) to display native desktop notifications via `chrome.notifications` when a download starts, finishes, or triggers a safety warning, as well as to handle notification action buttons for opening files/folders or confirming pending downloads.

### 2.7. `contextMenus`
Used to add quick-download entries to web page context menus via `chrome.contextMenus`, strictly filtered by the content types you enable in Settings (Link, Image, Audio, Video).

### 2.8. `offscreen`
Used under Manifest V3 to create a strictly local offscreen document (`offscreen.html`) exclusively for two browser APIs not available inside a Service Worker:
1. **Local Notification Audio (`AUDIO_PLAYBACK`)**: Playing bundled local notification sound files when download sound alerts are enabled in Settings;
2. **System Appearance Detection (`MATCH_MEDIA`)**: Observing OS light/dark `prefers-color-scheme` changes so the extension toolbar icon updates automatically when "Auto" theme adaptation is enabled.

This offscreen document runs only bundled local scripts and **never makes network requests or loads external resources**.

### 2.9. `alarms`
Used to keep long-running or active downloads synchronized while respecting Manifest V3 Service Worker suspension lifecycles: only when at least one active (`in_progress`) download exists, a lightweight 30-second reconciliation alarm (`chrome.alarms`) refreshes toolbar icon progress and session state; as soon as all downloads finish or stop, the alarm is immediately cleared so the extension does not wake unnecessarily while idle.

---

## 3. Data Retention & User Control

- This extension operates **no backend servers**, so no user data is ever retained on developer or third-party servers;
- You can disable settings sync, turn off notifications/audio, or adjust routing rules at any time from the Options page;
- Uninstalling or disabling the extension immediately stops all local execution, and browser-managed extension storage is cleared according to standard browser lifecycle rules.

---

## 4. Policy Updates & Contact

If future versions introduce changes to extension permissions or privacy practices, we will update this document and its "Last Updated" date accordingly.

For privacy questions, feedback, or support, please open an issue on GitHub:  
- GitHub Issues: https://github.com/xinghaix/download-manager/issues
