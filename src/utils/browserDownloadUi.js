/* eslint-disable no-undef */

const DOWNLOAD_UI_DISABLE_THROTTLE_MS = 5000

let disableDownloadUiPromise = null
let disableDownloadUiLastRunAt = 0

export async function ensureBrowserDownloadUiDisabled(force = false) {
  const now = Date.now()
  if (!force && now - disableDownloadUiLastRunAt < DOWNLOAD_UI_DISABLE_THROTTLE_MS) {
    return
  }

  if (disableDownloadUiPromise) {
    return disableDownloadUiPromise
  }

  disableDownloadUiLastRunAt = now
  disableDownloadUiPromise = disableBrowserDownloadUi().finally(() => {
    disableDownloadUiPromise = null
  })

  return disableDownloadUiPromise
}

async function disableBrowserDownloadUi() {
  if (chrome.downloads.setUiOptions) {
    try {
      await chrome.downloads.setUiOptions({ enabled: false })
      return
    } catch (error) {
      console.warn('Disable download UI with setUiOptions failed:', error)
    }
  }

  if (chrome.downloads.setShelfEnabled) {
    try {
      chrome.downloads.setShelfEnabled(false)
    } catch (error) {
      console.warn('Disable download shelf failed:', error)
    }
  }
}
