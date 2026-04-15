const SAFE_DANGER_TYPES = new Set([
  'safe',
  'accepted',
  'allowlistedByPolicy',
  'deepScannedSafe'
])

const ACCEPTABLE_DANGER_TYPES = new Set([
  'file',
  'url',
  'content',
  'uncommon',
  'host',
  'unwanted',
  'sensitiveContentWarning',
  'deepScannedOpenedDangerous',
  'accountCompromise'
])

export function isDangerousDownload(item) {
  return Boolean(
    item &&
    item.state === 'in_progress' &&
    item.danger &&
    !SAFE_DANGER_TYPES.has(item.danger)
  )
}

export function canAcceptDanger(item) {
  return isDangerousDownload(item) && ACCEPTABLE_DANGER_TYPES.has(item.danger)
}

