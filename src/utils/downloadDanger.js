const SAFE_DANGER_TYPES = new Set([
  'safe',
  'accepted',
  'allowlistedByPolicy',
  'deepScannedSafe'
])

const WAITING_DANGER_TYPES = new Set([
  'asyncScanning',
  'asyncLocalPasswordScanning'
])

const BLOCKED_DANGER_TYPES = new Set([
  'blockedTooLarge',
  'sensitiveContentBlock',
  'blockedScanFailed',
  'forceSaveToGdrive',
  'forceSaveToGDrive',
  'forceSaveToOnedrive',
  'forceSaveToOneDrive'
])

export function isDangerousDownload(item) {
  return Boolean(
    item &&
    item.state === 'in_progress' &&
    item.danger &&
    !SAFE_DANGER_TYPES.has(item.danger)
  )
}

export function getDangerStatus(item) {
  if (!isDangerousDownload(item)) {
    return 'safe'
  }

  if (WAITING_DANGER_TYPES.has(item.danger)) {
    return 'scanning'
  }

  if (BLOCKED_DANGER_TYPES.has(item.danger)) {
    return 'blocked'
  }

  return 'action_required'
}

export function canAcceptDanger(item) {
  return getDangerStatus(item) === 'action_required'
}
