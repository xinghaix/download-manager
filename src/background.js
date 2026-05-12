/* eslint-disable no-undef */
import storage from "./utils/storage.js"
import common from "./utils/common.js"
import icon from "./utils/icon.js"
import { getDangerStatus, isDangerousDownload } from "./utils/downloadDanger.js"
import { getRoutingFilename } from "./utils/downloadFileRouting.js"

// 全局状态（Service Worker 重启时会丢失，需要从 storage 恢复）
let state = {
  anyInProgress: false,
  anyInDangerous: false,
  downloadingNumber: 0,
  progress: -1,
  notificationList: [],
  itemRefreshTimer: null,
  activeRefreshTimer: null,
  systemTheme: null
}

const contextDownloadMenus = ['link', 'image', 'audio', 'video']
const pendingDownloadIds = new Set()
const DOWNLOADS_PROJECTION_KEY = 'downloads_projection'
const ACTIVE_DOWNLOADS_ALARM = 'active-downloads-reconcile'
const RECENT_DOWNLOAD_KEEP_MS = 10000

// Service Worker 安装
self.addEventListener('install', () => {
  self.skipWaiting()
})

// Service Worker 激活
self.addEventListener('activate', (event) => {
  event.waitUntil(initialize())
})

// 初始化
async function initialize() {
  try {
    // 默认设置
    await storage.defaultSettings()

    // 获取主题并设置图标
    const themeKey = await getActiveIconThemeKey()
    const iconColor = await storage.get('icon_color')
    if (iconColor && iconColor[themeKey]) {
      icon.setBrowserActionIcon(iconColor[themeKey], false)
    }

    // 禁用浏览器原生下载 UI
    await disableBrowserDownloadUi()

    // 初始化下载进度
    handleDownloadingNumber(0)
    handleDangerousDownloading(false)
    await refreshActiveDownloadsSummary()
    await rebuildProjectionFromActiveDownloads()

    // 创建上下文菜单
    const downloadContextMenus = await storage.get('download_context_menus')
    if (downloadContextMenus) {
      await createDownloadContextMenus()
    }
  } catch (error) {
    console.error('Initialize error:', error)
  }
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

// 下载创建监听
chrome.downloads.onCreated.addListener((item) => {
  queueDownloadRefresh(item.id)
})

// 下载变化监听
chrome.downloads.onChanged.addListener((delta) => {
  if (delta && typeof delta.id === 'number') {
    queueDownloadRefresh(delta.id)
  }
})

// 下载删除监听
chrome.downloads.onErased.addListener((id) => {
  pendingDownloadIds.delete(id)
  deleteAllDownloadNotificationId(id)
  ;(async () => {
    try {
      const projection = await getDownloadsProjection()
      delete projection.itemsById[id]
      projection.removedIds = [id]
      projection.summary = {
        anyInProgress: state.anyInProgress,
        anyInDangerous: state.anyInDangerous,
        downloadingNumber: state.downloadingNumber,
        progress: state.progress
      }
      await setDownloadsProjection(projection)
    } catch (error) {
      console.error('Projection erase sync error:', error)
    }
  })()
  scheduleActiveDownloadsRefresh()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ACTIVE_DOWNLOADS_ALARM) {
    return
  }

  rebuildProjectionFromActiveDownloads().catch(error => {
    console.error('Active downloads reconcile error:', error)
  })
})

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  ;(async () => {
    const filename = await getSuggestedRoutingFilename(item)
    if (filename) {
      suggest({ filename })
      return
    }
    suggest()
  })().catch(error => {
    console.error('Download file routing error:', error)
    suggest()
  })

  return true
})

// 通知按钮点击
chrome.notifications.onButtonClicked.addListener((notificationId, index) => {
  handleNotificationButtonClicked(notificationId, index).catch(error => {
    console.error('Notification button click error:', error)
  })
})

chrome.notifications.onClicked.addListener((notificationId) => {
  handleNotificationClicked(notificationId).catch(error => {
    console.error('Notification click error:', error)
  })
})

async function handleNotificationButtonClicked(notificationId, index) {
  await chrome.notifications.clear(notificationId)

  const fileId = getNotificationDownloadId(notificationId)
  if (fileId === null) {
    return
  }

  if (notificationId.endsWith('-completed')) {
    if (index === 0) {
      await chrome.downloads.open(fileId)
    } else if (index === 1) {
      await chrome.downloads.show(fileId)
    }
    return
  }

  if (notificationId.endsWith('-warning')) {
    if (index === 0) {
      await openDangerDownloadUi()
    } else if (index === 1) {
      await cancelDownload(fileId)
    }
  }
}

async function handleNotificationClicked(notificationId) {
  await chrome.notifications.clear(notificationId)

  if (notificationId.endsWith('-warning')) {
    await openDangerDownloadUi()
  }
}

function getNotificationDownloadId(notificationId) {
  const match = /^(\d+)-/.exec(notificationId)
  if (!match) {
    return null
  }

  return Number(match[1])
}

async function openDangerDownloadUi() {
  if (chrome.action && chrome.action.openPopup) {
    try {
      await chrome.action.openPopup()
      return
    } catch (error) {
      console.warn('Open popup for dangerous download failed:', error)
    }
  }

  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') })
  } catch (error) {
    console.warn('Open extension download page failed:', error)
    await chrome.tabs.create({ url: 'chrome://downloads' })
  }
}

async function cancelDownload(fileId) {
  try {
    await chrome.downloads.cancel(fileId)
  } catch (error) {
    console.warn('Cancel dangerous download failed:', error)
  }
}

// 上下文菜单点击
chrome.contextMenus.onClicked.addListener((info) => {
  let url
  if (info.menuItemId === 'download-link') {
    url = info.linkUrl
  } else {
    url = info.srcUrl
  }
  common.download(url)
})

// 消息监听
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      let received = message
      if (typeof message === 'string') {
        received = JSON.parse(message)
      }

      if (!received || typeof received !== 'object' || !received.type) {
        sendResponse({ success: false, error: 'Invalid message payload' })
        return
      }

      switch (received.type) {
        case 'downloadMenus':
          if (received.data) {
            await createDownloadContextMenus()
          } else {
            removeDownloadContextMenus()
          }
          break
        case 'ui_theme_changed':
          await handleUiThemeChanged(received.data)
          break
        case 'system_theme_changed':
          await handleSystemThemeChanged(received.data)
          break
        case 'icon_color':
          if (state.anyInProgress) {
            icon.message.color = received.data
          } else {
            icon.setBrowserActionIcon(received.data, false)
          }
          break
        case 'icon_downloading_color':
          icon.message.runningColor = received.data
          break
        case 'download_snapshot_request':
          sendResponse({
            success: true,
            data: await getDownloadSnapshot(
              received.data && typeof received.data === 'object' ? received.data : null
            )
          })
          return
      }

      sendResponse({ success: true })
    } catch (error) {
      console.error('Message handler error:', error)
      sendResponse({ success: false, error: error.message })
    }
  })()

  return true
})


async function searchDownloads(query) {
  return chrome.downloads.search(query)
}

function prepareRuntimeDownloadItem(item) {
  if (!item) {
    return null
  }
  common.beforeHandler(item)
  return item
}

async function getSuggestedRoutingFilename(item) {
  const enabled = await storage.get('download_file_routing_enabled')
  if (!enabled || !item) {
    return null
  }

  const rules = await storage.get('download_file_routing_rules')
  return getRoutingFilename(item.filename || item.url || item.finalUrl, rules)
}

async function getDownloadById(id) {
  const items = await searchDownloads({ id })
  if (!items || !items.length) {
    return null
  }
  return prepareRuntimeDownloadItem(items[0])
}

async function getDownloadSnapshot(query = null) {
  const searchQuery = query ? {...query} : { orderBy: ['-startTime'] }
  if (Array.isArray(searchQuery.ids)) {
    const items = await Promise.all(
      searchQuery.ids
        .filter(id => typeof id === 'number')
        .map(id => getDownloadById(id))
    )
    return items.filter(item => item)
  }
  if (!searchQuery.orderBy) {
    searchQuery.orderBy = ['-startTime']
  }
  const items = await searchDownloads(searchQuery)
  return items
    .filter(item => item)
    .map(item => prepareRuntimeDownloadItem(item))
}

function pickProjectionItemFields(item) {
  if (!item) {
    return null
  }

  return {
    id: item.id,
    state: item.state,
    filename: item.filename,
    basename: item.basename,
    finalUrl: item.finalUrl,
    url: item.url,
    bytesReceived: item.bytesReceived,
    totalBytes: item.totalBytes,
    estimatedEndTime: item.estimatedEndTime || null,
    endTime: item.endTime || null,
    paused: Boolean(item.paused),
    error: item.error || null,
    exists: typeof item.exists === 'boolean' ? item.exists : true,
    danger: item.danger,
    canResume: Boolean(item.canResume),
    startTime: item.startTime,
    iconUrl: item.iconUrl || null,
    retainedUntil: item.state === 'in_progress' ? null : Date.now() + RECENT_DOWNLOAD_KEEP_MS
  }
}

function pruneProjectionItems(itemsById) {
  const nextItemsById = {}
  const now = Date.now()

  Object.entries(itemsById || {}).forEach(([id, item]) => {
    if (!item) {
      return
    }

    if (item.state === 'in_progress') {
      nextItemsById[id] = item
      return
    }

    if (!item.retainedUntil || item.retainedUntil > now) {
      nextItemsById[id] = item
    }
  })

  return nextItemsById
}

async function getDownloadsProjection() {
  const projection = await storage.getSession(DOWNLOADS_PROJECTION_KEY)
  if (!projection || typeof projection !== 'object') {
    return {
      seq: 0,
      updatedAt: 0,
      itemsById: {},
      removedIds: [],
      summary: {
        anyInProgress: false,
        anyInDangerous: false,
        downloadingNumber: 0,
        progress: -1
      }
    }
  }

  return {
    seq: typeof projection.seq === 'number' ? projection.seq : 0,
    updatedAt: typeof projection.updatedAt === 'number' ? projection.updatedAt : 0,
    itemsById: pruneProjectionItems(projection.itemsById && typeof projection.itemsById === 'object' ? projection.itemsById : {}),
    removedIds: Array.isArray(projection.removedIds) ? projection.removedIds : [],
    summary: projection.summary && typeof projection.summary === 'object' ? projection.summary : {
      anyInProgress: false,
      anyInDangerous: false,
      downloadingNumber: 0,
      progress: -1
    }
  }
}

async function setDownloadsProjection(projection) {
  const nextProjection = {
    ...projection,
    seq: (typeof projection.seq === 'number' ? projection.seq : 0) + 1,
    updatedAt: Date.now()
  }
  await storage.setSession(DOWNLOADS_PROJECTION_KEY, nextProjection)
  return nextProjection
}

async function rebuildProjectionFromActiveDownloads() {
  const activeItems = (await searchDownloads({ state: 'in_progress', orderBy: ['-startTime'] }))
    .map(item => prepareRuntimeDownloadItem(item))

  const itemsById = {}
  activeItems.forEach(item => {
    const projectionItem = pickProjectionItemFields(item)
    if (projectionItem) {
      itemsById[item.id] = projectionItem
    }
  })

  const projection = await getDownloadsProjection()
  projection.itemsById = itemsById
  projection.removedIds = []
  projection.summary = {
    anyInProgress: state.anyInProgress,
    anyInDangerous: state.anyInDangerous,
    downloadingNumber: state.downloadingNumber,
    progress: state.progress
  }

  await setDownloadsProjection(projection)
  await syncActiveDownloadsAlarm(state.anyInProgress)
}

async function syncActiveDownloadsAlarm(hasActiveDownloads) {
  const alarm = await chrome.alarms.get(ACTIVE_DOWNLOADS_ALARM)
  if (hasActiveDownloads) {
    if (!alarm) {
      chrome.alarms.create(ACTIVE_DOWNLOADS_ALARM, { periodInMinutes: 0.5 })
    }
    return
  }

  if (alarm) {
    chrome.alarms.clear(ACTIVE_DOWNLOADS_ALARM)
  }
}

function scheduleActiveDownloadsRefresh() {
  if (state.activeRefreshTimer) {
    return
  }

  state.activeRefreshTimer = setTimeout(async () => {
    state.activeRefreshTimer = null
    try {
      await refreshActiveDownloadsSummary()
    } catch (error) {
      console.error('Refresh active downloads summary error:', error)
    }
  }, 80)
}

function queueDownloadRefresh(id) {
  if (typeof id !== 'number') {
    return
  }

  pendingDownloadIds.add(id)
  if (state.itemRefreshTimer) {
    return
  }

  state.itemRefreshTimer = setTimeout(async () => {
    state.itemRefreshTimer = null
    try {
      await flushPendingDownloadUpdates()
    } catch (error) {
      console.error('Flush pending download updates error:', error)
    }
  }, 80)
}

async function flushPendingDownloadUpdates() {
  const ids = [...pendingDownloadIds]
  pendingDownloadIds.clear()

  if (!ids.length) {
    scheduleActiveDownloadsRefresh()
    return
  }

  const projection = await getDownloadsProjection()
  projection.removedIds = []

  for (const id of ids) {
    const item = await getDownloadById(id)
    const projectionItem = pickProjectionItemFields(item)

    if (!item) {
      delete projection.itemsById[id]
      projection.removedIds.push(id)
      continue
    }

    if (projectionItem) {
      projection.itemsById[id] = projectionItem
    }

    if (item.state === 'in_progress') {
      await handleDownloadStartedNotification(item)
      if (isDangerousDownload(item)) {
        await handleDownloadWarningNotification(item)
      } else {
        deleteDownloadNotificationId(item.id, '-warning')
      }
    } else if (item.state === 'complete') {
      deleteDownloadNotificationId(item.id, '-warning')
      await handleDownloadCompletedNotification(item)
    } else {
      deleteAllDownloadNotificationId(item.id)
    }
  }

  projection.itemsById = pruneProjectionItems(projection.itemsById)

  projection.summary = {
    anyInProgress: state.anyInProgress,
    anyInDangerous: state.anyInDangerous,
    downloadingNumber: state.downloadingNumber,
    progress: state.progress
  }
  await setDownloadsProjection(projection)
  scheduleActiveDownloadsRefresh()
}

async function refreshActiveDownloadsSummary() {
  const activeItems = (await searchDownloads({ state: 'in_progress', orderBy: ['-startTime'] }))
    .map(item => prepareRuntimeDownloadItem(item))

  let anyInDangerous = false
  let greaterThanZeroNumber = 0
  let totalProgress = 0.0

  activeItems.forEach(item => {
    if (isDangerousDownload(item)) {
      anyInDangerous = true
    }

    const progress = getProgress(item)
    if (progress !== -1) {
      greaterThanZeroNumber++
      totalProgress += progress
    }
  })

  state.anyInProgress = activeItems.length > 0
  state.anyInDangerous = anyInDangerous
  state.downloadingNumber = activeItems.length
  state.progress = greaterThanZeroNumber > 0 ? totalProgress / greaterThanZeroNumber : -1

  handleDownloadingNumber(state.downloadingNumber)
  handleDangerousDownloading(anyInDangerous)
  await syncActiveDownloadsAlarm(state.anyInProgress)

  const themeKey = await getActiveIconThemeKey()
  const iconColor = await storage.get('icon_color')
  const iconDownloadingColor = await storage.get('icon_downloading_color')

  if (state.anyInProgress && iconColor && iconDownloadingColor) {
    icon.setRunningBrowserActionIcon(
      iconColor[themeKey],
      iconDownloadingColor[themeKey],
      true,
      state.progress
    )
  } else if (iconColor) {
    icon.restoreDefaultIcon(iconColor[themeKey])
  }

  const projection = await getDownloadsProjection()
  projection.summary = {
    anyInProgress: state.anyInProgress,
    anyInDangerous: state.anyInDangerous,
    downloadingNumber: state.downloadingNumber,
    progress: state.progress
  }
  await setDownloadsProjection(projection)
}

// 处理下载开始通知
async function handleDownloadStartedNotification(item) {
  const notificationId = item.id + '-started'
  if (state.notificationList.indexOf(notificationId) < 0) {
    const showNotification = await storage.get('download_started_notification')

    if (showNotification) {
      const level = await chrome.notifications.getPermissionLevel()
      if (level === 'granted') {
        const visible = await storage.get('download_notification_remain_visible')
        const option = {
          type: 'basic',
          priority: 2,
          iconUrl: getNotificationIcon(),
          title: common.i18data.downloadStartedNotification,
          message: item.basename || item.url,
          buttons: [{ title: common.i18data.deleteNotification }]
        }

        if (visible) {
          option.requireInteraction = true
        }

        const createdId = await createExtensionNotification(notificationId, option)
        state.notificationList.push(createdId)
        closeNotification(createdId, option, visible)
      }
    }

    const playTone = await storage.get('download_started_tone')
    if (playTone) {
      playAudio('audio/start.mp3')
    }
  }
}

// 处理下载完成通知
async function handleDownloadCompletedNotification(item) {
  const notificationId = item.id + '-completed'
  if (state.notificationList.indexOf(notificationId) < 0) {
    const showNotification = await storage.get('download_completed_notification')

    if (showNotification) {
      const level = await chrome.notifications.getPermissionLevel()
      if (level === 'granted') {
        const visible = await storage.get('download_notification_remain_visible')
        const option = {
          type: 'basic',
          priority: 2,
          iconUrl: getNotificationIcon(),
          title: common.i18data.downloadCompletedNotification,
          message: item.basename || item.url,
          buttons: [
            { title: common.i18data.openFile },
            { title: common.i18data.openFolderNotification }
          ]
        }

        if (visible) {
          option.requireInteraction = true
        }

        const createdId = await createExtensionNotification(notificationId, option)
        state.notificationList.push(createdId)
        closeNotification(createdId, option, visible)
      }
    }

    const playTone = await storage.get('download_completed_tone')
    if (playTone) {
      playAudio('audio/completed.wav')
    }
  }
}

// 处理下载警告通知
async function handleDownloadWarningNotification(item) {
  const notificationId = item.id + '-warning'
  if (state.notificationList.indexOf(notificationId) < 0) {
    const showNotification = await storage.get('download_warning_notification')

    if (showNotification) {
      const level = await chrome.notifications.getPermissionLevel()
      if (level === 'granted') {
        const visible = await storage.get('download_notification_remain_visible')
        const option = {
          type: 'basic',
          priority: 2,
          iconUrl: getNotificationIcon(),
          title: common.i18data.downloadWarnNotification,
          message: getDangerDescription(item),
          contextMessage: item.basename || item.url || '',
          buttons: [
            { title: common.i18data.dangerOpenAction },
            { title: common.i18data.dangerDiscard }
          ]
        }

        if (visible) {
          option.requireInteraction = true
        }

        const createdId = await createExtensionNotification(notificationId, option)
        state.notificationList.push(createdId)
        closeNotification(createdId, option, visible)
      }
    }

    const playTone = await storage.get('download_warning_tone')
    if (playTone) {
      playAudio('audio/warning.mp3')
    }
  }
}

function getDangerDescription(item) {
  switch (getDangerStatus(item)) {
    case 'scanning':
      return common.i18data.dangerScanningDescription
    case 'blocked':
      return common.i18data.dangerBlockedDescription
    case 'action_required':
      return common.i18data.dangerActionRequiredDescription
    default:
      return common.i18data.dangerDescription
  }
}

async function getActiveIconThemeKey() {
  const uiTheme = await storage.get('ui_theme')
  if (uiTheme) {
    return uiTheme.endsWith('-dark') ? 'dark' : 'light'
  }

  const theme = await storage.get('theme')
  if (theme === 'dark' || theme === 'light') {
    return theme
  }

  if (state.systemTheme === 'dark' || state.systemTheme === 'light') {
    return state.systemTheme
  }

  const storedSystemTheme = await storage.get('system_theme')
  if (storedSystemTheme === 'dark' || storedSystemTheme === 'light') {
    return storedSystemTheme
  }

  return 'light'
}

async function handleUiThemeChanged(themeName) {
  if (themeName) {
    const themeKey = themeName.endsWith('-dark') ? 'dark' : 'light'
    const iconColor = await storage.get('icon_color')
    const iconDownloadingColor = await storage.get('icon_downloading_color')

    if (state.anyInProgress && iconColor && iconDownloadingColor) {
      icon.setRunningBrowserActionIcon(
        iconColor[themeKey],
        iconDownloadingColor[themeKey],
        true,
        state.progress
      )
    } else if (iconColor) {
      icon.restoreDefaultIcon(iconColor[themeKey])
    }
    return
  }

  const themeKey = await getActiveIconThemeKey()
  const iconColor = await storage.get('icon_color')
  const iconDownloadingColor = await storage.get('icon_downloading_color')

  if (state.anyInProgress && iconColor && iconDownloadingColor) {
    icon.setRunningBrowserActionIcon(
      iconColor[themeKey],
      iconDownloadingColor[themeKey],
      true,
      state.progress
    )
  } else if (iconColor) {
    icon.restoreDefaultIcon(iconColor[themeKey])
  }
}

async function handleSystemThemeChanged(themeName) {
  if (themeName !== 'dark' && themeName !== 'light') {
    return
  }

  state.systemTheme = themeName
  storage.set('system_theme', themeName)

  const uiTheme = await storage.get('ui_theme')
  const theme = await storage.get('theme')
  if (uiTheme || theme !== 'auto') {
    return
  }

  const iconColor = await storage.get('icon_color')
  const iconDownloadingColor = await storage.get('icon_downloading_color')

  if (state.anyInProgress && iconColor && iconDownloadingColor) {
    icon.setRunningBrowserActionIcon(
      iconColor[themeName],
      iconDownloadingColor[themeName],
      true,
      state.progress
    )
  } else if (iconColor) {
    icon.restoreDefaultIcon(iconColor[themeName])
  }
}

async function hasOffscreenDocument() {
  if (chrome.runtime.getContexts) {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    })
    return existingContexts.length > 0
  }

  const clientsList = await clients.matchAll()
  const offscreenUrl = chrome.runtime.getURL('offscreen.html')
  return clientsList.some((client) => client.url === offscreenUrl)
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    return
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK', 'MATCH_MEDIA'],
    justification: 'Play notification audio and observe system theme changes'
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function sendMessageToOffscreen(message, maxAttempts = 5, delayMs = 60) {
  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await chrome.runtime.sendMessage(message)
    } catch (error) {
      lastError = error
      const errorMessage = error?.message || String(error)
      if (!errorMessage.includes('Could not establish connection')) {
        throw error
      }
      if (attempt < maxAttempts) {
        await sleep(delayMs)
      }
    }
  }

  throw lastError || new Error('Failed to deliver message to offscreen document')
}

// 播放音频（使用 Offscreen Document）
async function playAudio(audioFile) {
  try {
    await ensureOffscreenDocument()

    await sendMessageToOffscreen({
      type: 'play-audio',
      file: audioFile
    })
  } catch (error) {
    console.error('Play audio error:', error)
  }
}

// 关闭通知
async function closeNotification(id, option, visible) {
  const reservedTime = await storage.get('download_notification_reserved_time')

  if (reservedTime !== null && typeof reservedTime === 'number' && reservedTime >= 0) {
    setTimeout(async () => {
      const wasCleared = await chrome.notifications.clear(id)

      if (!wasCleared) {
        const level = await chrome.notifications.getPermissionLevel()
        if (level === 'granted') {
          if (visible) {
            option.requireInteraction = false
          }
          const returnId = await chrome.notifications.create(id, option)
          await chrome.notifications.clear(returnId)
        }
      }
    }, reservedTime * 1000)
  }
}

function getNotificationIcon() {
  return chrome.runtime.getURL('img/icon19.png')
}

async function createExtensionNotification(id, options) {
  return chrome.notifications.create(id, options)
}

// 删除所有通知
function deleteAllDownloadNotificationId(id) {
  deleteDownloadNotificationId(id, '-started')
  deleteDownloadNotificationId(id, '-completed')
  deleteDownloadNotificationId(id, '-warning')
}

function deleteDownloadNotificationId(id, suffix) {
  const index = state.notificationList.indexOf(id + suffix)
  if (index >= 0) {
    state.notificationList.splice(index, 1)
  }
}

// 处理下载数量
function handleDownloadingNumber(num) {
  setBrowserBadge(num <= 0 ? 0 : num)
}

// 处理危险下载
function handleDangerousDownloading(anyInDangerous) {
  chrome.action.setBadgeBackgroundColor({
    color: anyInDangerous ? '#FF0000' : '#4285F4'
  })
}

// 设置 badge
function setBrowserBadge(number) {
  let text = ''
  if (number > 0) {
    if (number >= 1000) {
      text = '999+'
    } else {
      text = number.toString()
    }
  }
  chrome.action.setBadgeText({ text: text })
}

// 获取下载进度
function getProgress(item) {
  return item.totalBytes != null && item.totalBytes > 0 ?
    parseFloat((1.0 * item.bytesReceived / item.totalBytes).toFixed(2)) : -1
}

// 创建上下文菜单
async function createDownloadContextMenus() {
  await new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => resolve())
  })

  await Promise.all(contextDownloadMenus.map((menu) => {
    return new Promise((resolve) => {
      chrome.contextMenus.create({
        id: 'download-' + menu,
        title: common.i18data.prefixMenus + common.i18data[menu],
        contexts: [menu]
      }, () => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError)
        }
        resolve()
      })
    })
  }))
}

// 删除上下文菜单
function removeDownloadContextMenus() {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError)
    }
  })
}
