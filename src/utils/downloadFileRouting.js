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

export const DEFAULT_DOWNLOAD_DOMAIN_ROUTING_RULES = []

export const DOWNLOAD_ROUTING_PRECEDENCE_DOMAIN = 'domain'
export const DOWNLOAD_ROUTING_PRECEDENCE_EXTENSION = 'extension'
export const DEFAULT_DOWNLOAD_ROUTING_PRECEDENCE = DOWNLOAD_ROUTING_PRECEDENCE_DOMAIN

const INVALID_FOLDER_CHARS = new Set(['<', '>', ':', '"', '|', '?', '*'])

export function cloneDefaultDownloadFileRoutingRules() {
  return DEFAULT_DOWNLOAD_FILE_ROUTING_RULES.map(rule => ({
    ...rule,
    extensions: [...rule.extensions]
  }))
}

export function cloneDefaultDownloadDomainRoutingRules() {
  return DEFAULT_DOWNLOAD_DOMAIN_ROUTING_RULES.map(rule => ({
    ...rule,
    domains: [...(rule.domains || [])]
  }))
}

export function parseExtensions(value) {
  const source = Array.isArray(value) ? value.join(',') : String(value || '')
  return [...new Set(source
    .split(/[\s,;，；]+/)
    .map(extension => extension.trim().replace(/^\.+/, '').toLowerCase())
    .filter(extension => /^[a-z0-9][a-z0-9_+-]*$/.test(extension)))]
}

export function normalizeHostname(value) {
  let host = String(value || '').trim().toLowerCase()
  if (!host) {
    return ''
  }

  host = host.replace(/^\*+/, '')
  host = host.replace(/^https?:\/\//, '')
  host = host.split('/')[0]
  host = host.split('?')[0]
  host = host.split('#')[0]
  host = host.replace(/:\d+$/, '')
  host = host.replace(/^\.+/, '').replace(/\.+$/, '')

  if (!host || host.includes(' ') || INVALID_FOLDER_CHARS.has(host[0])) {
    return ''
  }

  // allow hostname labels and dots only
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/.test(host)) {
    return ''
  }

  return host
}

export function parseDomains(value) {
  const source = Array.isArray(value) ? value.join(',') : String(value || '')
  return [...new Set(source
    .split(/[\s,;，；]+/)
    .map(domain => normalizeHostname(domain))
    .filter(Boolean))]
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

export function normalizeDownloadDomainRoutingRules(rules) {
  if (!Array.isArray(rules)) {
    return cloneDefaultDownloadDomainRoutingRules()
  }

  return rules.map((rule, index) => ({
    id: rule && rule.id ? String(rule.id) : `domain-rule-${index}`,
    enabled: rule ? rule.enabled !== false : true,
    folder: normalizeFolderPath(rule && rule.folder),
    domains: parseDomains(rule && rule.domains)
  }))
}

export function normalizeDownloadRoutingPrecedence(value) {
  if (value === DOWNLOAD_ROUTING_PRECEDENCE_EXTENSION) {
    return DOWNLOAD_ROUTING_PRECEDENCE_EXTENSION
  }
  return DOWNLOAD_ROUTING_PRECEDENCE_DOMAIN
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

export function getHostnameFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return ''
  }

  try {
    return normalizeHostname(new URL(url).hostname)
  } catch (e) {
    return normalizeHostname(url)
  }
}

export function getDownloadRoutingHostname(item) {
  if (!item) {
    return ''
  }

  return getHostnameFromUrl(item.referrer)
    || getHostnameFromUrl(item.finalUrl)
    || getHostnameFromUrl(item.url)
}

export function hostnameMatchesDomain(hostname, domain) {
  const host = normalizeHostname(hostname)
  const ruleDomain = normalizeHostname(domain)
  if (!host || !ruleDomain) {
    return false
  }

  return host === ruleDomain || host.endsWith(`.${ruleDomain}`)
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

export function getDomainRoutingFilename(filename, item, domainRules) {
  const basename = getBasename(filename)
  if (!basename) {
    return null
  }

  const hostname = getDownloadRoutingHostname(item)
  if (!hostname) {
    return null
  }

  const normalizedRules = normalizeDownloadDomainRoutingRules(domainRules)
  const matchedRule = normalizedRules.find(rule => {
    return rule.enabled
      && rule.folder
      && rule.domains.some(domain => hostnameMatchesDomain(hostname, domain))
  })

  if (!matchedRule) {
    return null
  }

  return `${matchedRule.folder}/${basename}`
}

/**
 * Resolve relative Downloads path.
 * Precedence default: domain rules first, then extension rules.
 */
export function resolveRoutingFilename(item, {
  extensionRules,
  domainRules,
  precedence = DEFAULT_DOWNLOAD_ROUTING_PRECEDENCE
} = {}) {
  if (!item) {
    return null
  }

  const filename = item.filename || item.url || item.finalUrl
  const orderedPrecedence = normalizeDownloadRoutingPrecedence(precedence)
  const domainFilename = getDomainRoutingFilename(filename, item, domainRules)
  const extensionFilename = getRoutingFilename(filename, extensionRules)

  if (orderedPrecedence === DOWNLOAD_ROUTING_PRECEDENCE_EXTENSION) {
    return extensionFilename || domainFilename
  }

  return domainFilename || extensionFilename
}
