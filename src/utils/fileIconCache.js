const MAX_FILE_ICON_CACHE_SIZE = 500
const fileIconCache = new Map()

export function getCachedFileIcon(id) {
  if (!fileIconCache.has(id)) {
    return null
  }
  const value = fileIconCache.get(id)
  // 刷新 LRU 顺序
  fileIconCache.delete(id)
  fileIconCache.set(id, value)
  return value || null
}

export function setCachedFileIcon(id, iconUrl) {
  if (typeof id !== 'number' || !iconUrl) {
    return
  }
  if (fileIconCache.has(id)) {
    fileIconCache.delete(id)
  } else if (fileIconCache.size >= MAX_FILE_ICON_CACHE_SIZE) {
    const oldestKey = fileIconCache.keys().next().value
    if (typeof oldestKey !== 'undefined') {
      fileIconCache.delete(oldestKey)
    }
  }
  fileIconCache.set(id, iconUrl)
}

export function deleteCachedFileIcon(id) {
  fileIconCache.delete(id)
}

export function clearCachedFileIcons() {
  fileIconCache.clear()
}
