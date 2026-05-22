export const DEFAULT_DOWNLOAD_FILE_ROUTING_RULES = [
  {
    id: 'images',
    enabled: true,
    folder: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tif', 'tiff', 'ico']
  },
  {
    id: 'audio',
    enabled: true,
    folder: 'Audio',
    extensions: ['mp3', 'aac', 'wav', 'ogg', 'flac', 'm4a', 'wma', 'ape', 'aiff']
  },
  {
    id: 'videos',
    enabled: true,
    folder: 'Videos',
    extensions: ['mp4', 'm4v', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mpeg', 'mpg', '3gp']
  },
  {
    id: 'applications',
    enabled: true,
    folder: 'Applications',
    extensions: ['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'apk', 'appx']
  },
  {
    id: 'documents',
    enabled: true,
    folder: 'Documents',
    extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'text', 'rtf', 'odt', 'ods', 'odp', 'csv']
  },
  {
    id: 'books',
    enabled: true,
    folder: 'Books',
    extensions: ['epub', 'mobi', 'azw', 'azw3', 'fb2', 'djvu']
  },
  {
    id: 'archives',
    enabled: true,
    folder: 'Archives',
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'gzip', 'bz2', 'xz', 'iso']
  }
]

const INVALID_FOLDER_CHARS = new Set(['<', '>', ':', '"', '|', '?', '*'])

export function cloneDefaultDownloadFileRoutingRules() {
  return DEFAULT_DOWNLOAD_FILE_ROUTING_RULES.map(rule => ({
    ...rule,
    extensions: [...rule.extensions]
  }))
}

export function parseExtensions(value) {
  const source = Array.isArray(value) ? value.join(',') : String(value || '')
  return [...new Set(source
    .split(/[\s,;，；]+/)
    .map(extension => extension.trim().replace(/^\.+/, '').toLowerCase())
    .filter(extension => /^[a-z0-9][a-z0-9_+-]*$/.test(extension)))]
}

export function normalizeFolderPath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .split('/')
    .map(segment => segment.trim()
      .split('')
      .filter(char => char.charCodeAt(0) >= 32 && !INVALID_FOLDER_CHARS.has(char))
      .join(''))
    .filter(segment => segment && segment !== '.' && segment !== '..')
    .join('/')
}

export function normalizeDownloadFileRoutingRules(rules) {
  if (!Array.isArray(rules)) {
    return cloneDefaultDownloadFileRoutingRules()
  }

  return rules.map((rule, index) => ({
    id: rule && rule.id ? String(rule.id) : `rule-${index}`,
    enabled: rule ? rule.enabled !== false : true,
    folder: normalizeFolderPath(rule && rule.folder),
    extensions: parseExtensions(rule && rule.extensions)
  }))
}

export function getBasename(filename) {
  const normalizedFilename = String(filename || '').replace(/\\/g, '/')
  return normalizedFilename.substring(normalizedFilename.lastIndexOf('/') + 1)
}

export function getFileExtension(filename) {
  const basename = getBasename(filename).toLowerCase()
  const dotIndex = basename.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === basename.length - 1) {
    return ''
  }
  return basename.substring(dotIndex + 1)
}

export function getRoutingFilename(filename, rules) {
  const basename = getBasename(filename)
  const extension = getFileExtension(basename)
  if (!basename || !extension) {
    return null
  }

  const normalizedRules = normalizeDownloadFileRoutingRules(rules)
  const matchedRule = normalizedRules.find(rule => {
    return rule.enabled && rule.folder && rule.extensions.includes(extension)
  })

  if (!matchedRule) {
    return null
  }

  return `${matchedRule.folder}/${basename}`
}
