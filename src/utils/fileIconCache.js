const fileIconCache = new Map()

export function getCachedFileIcon(id) {
  return fileIconCache.get(id) || null
}

export function setCachedFileIcon(id, iconUrl) {
  if (typeof id !== 'number' || !iconUrl) {
    return
  }
  fileIconCache.set(id, iconUrl)
}

export function deleteCachedFileIcon(id) {
  fileIconCache.delete(id)
}

export function clearCachedFileIcons() {
  fileIconCache.clear()
}
