import common from './common.js'
import { deleteCachedFileIcon, getCachedFileIcon, setCachedFileIcon } from './fileIconCache.js'

const completedIconRefreshIds = new Set()

export function getStoredFileIcon(item, options = {}) {
  if (!item) {
    return null
  }

  const cachedIconUrl = getCachedFileIcon(item.id)
  if (cachedIconUrl) {
    return cachedIconUrl
  }

  return options.ignoreItemIcon ? null : (item.iconUrl || null)
}

export function shouldRefreshCompletedFileIcon(id) {
  return typeof id === 'number' && !completedIconRefreshIds.has(id)
}

export function markCompletedFileIconRefreshed(id) {
  if (typeof id === 'number') {
    completedIconRefreshIds.add(id)
  }
}

export function resetFileIcon(id) {
  deleteCachedFileIcon(id)
}

export async function loadFileIcon(item, options = {}) {
  if (!item) {
    return null
  }

  const iconItem = options.forceRefresh ? {...item, iconUrl: null} : item
  const iconUrl = await common.getCustomFileIcon(iconItem)

  if (iconUrl) {
    setCachedFileIcon(item.id, iconUrl)
  }

  return iconUrl || null
}

export function rememberItemFileIcon(item) {
  if (item && item.iconUrl) {
    setCachedFileIcon(item.id, item.iconUrl)
  }
}
