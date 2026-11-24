import common from './common.js'
import { deleteCachedFileIcon, getCachedFileIcon, setCachedFileIcon } from './fileIconCache.js'

const MAX_COMPLETED_REFRESH_CACHE_SIZE = 1000
const MAX_CONCURRENT_ICON_LOADS = 4

const completedIconRefreshIds = new Set()
const inFlightIconPromises = new Map()
const pendingIconQueue = []
let activeIconLoads = 0

function resolveTaskOnce(task, value) {
  if (!task || task.resolved) {
    return
  }
  task.resolved = true
  task.resolve(value)
}

function pumpIconLoadQueue() {
  while (activeIconLoads < MAX_CONCURRENT_ICON_LOADS && pendingIconQueue.length > 0) {
    const task = pendingIconQueue.shift()
    if (!task || task.cancelled) {
      if (task) {
        resolveTaskOnce(task, null)
      }
      continue
    }

    task.started = true
    activeIconLoads += 1
    Promise.resolve()
      .then(() => common.getCustomFileIcon(task.iconItem))
      .then(iconUrl => {
        if (iconUrl) {
          setCachedFileIcon(task.id, iconUrl)
        }
        resolveTaskOnce(task, iconUrl || null)
      })
      .catch(() => {
        resolveTaskOnce(task, null)
      })
      .finally(() => {
        activeIconLoads -= 1
        if (inFlightIconPromises.get(task.key)?.task === task) {
          inFlightIconPromises.delete(task.key)
        }
        pumpIconLoadQueue()
      })
  }
}

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
    if (completedIconRefreshIds.size >= MAX_COMPLETED_REFRESH_CACHE_SIZE) {
      const oldest = completedIconRefreshIds.values().next().value
      if (typeof oldest !== 'undefined') {
        completedIconRefreshIds.delete(oldest)
      }
    }
    completedIconRefreshIds.add(id)
  }
}

export function resetFileIcon(id) {
  deleteCachedFileIcon(id)
  completedIconRefreshIds.delete(id)
}

/**
 * 限流排队加载系统文件图标，支持滚动离开视口时取消未开始的排队任务，
 * 避免低配 Windows 下快速滚动触发大量并发 SHGetFileInfo 调用造成主进程卡顿。
 */
export function loadFileIcon(item, options = {}) {
  if (!item || typeof item.id !== 'number') {
    return { promise: Promise.resolve(null), cancel: () => {} }
  }

  const forceRefresh = Boolean(options.forceRefresh)
  if (!forceRefresh) {
    const cached = getCachedFileIcon(item.id)
    if (cached) {
      return { promise: Promise.resolve(cached), cancel: () => {} }
    }
  }

  const key = `${item.id}:${forceRefresh ? 'refresh' : 'normal'}`
  let sharedEntry = inFlightIconPromises.get(key)
  if (!sharedEntry) {
    const iconItem = forceRefresh ? { ...item, iconUrl: null } : item
    let taskRef = null
    const promise = new Promise(resolve => {
      taskRef = {
        id: item.id,
        key,
        iconItem,
        subscribers: 0,
        started: false,
        cancelled: false,
        resolved: false,
        resolve
      }
    })
    sharedEntry = { promise, task: taskRef }
    inFlightIconPromises.set(key, sharedEntry)
    pendingIconQueue.push(taskRef)
  }

  sharedEntry.task.subscribers += 1
  let cancelledByCaller = false

  const cancel = () => {
    if (cancelledByCaller) {
      return
    }
    cancelledByCaller = true
    sharedEntry.task.subscribers -= 1
    if (sharedEntry.task.subscribers <= 0) {
      sharedEntry.task.cancelled = true
      if (inFlightIconPromises.get(key)?.task === sharedEntry.task) {
        inFlightIconPromises.delete(key)
      }
      if (!sharedEntry.task.started) {
        resolveTaskOnce(sharedEntry.task, null)
      }
    }
  }

  pumpIconLoadQueue()
  return { promise: sharedEntry.promise, cancel }
}

export function rememberItemFileIcon(item) {
  if (item && item.iconUrl) {
    setCachedFileIcon(item.id, item.iconUrl)
  }
}
