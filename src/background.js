/* eslint-disable no-undef */
import storage from "./utils/storage.js"
import common from "./utils/common.js"
import icon from "./utils/icon.js"

// 全局状态（Service Worker 重启时会丢失，需要从 storage 恢复）
let state = {
  anyInProgress: false,
  anyInDangerous: false,
  downloadingNumber: 0,
  progress: -1,
  notificationList: [],
  progressTimer: null,
  systemTheme: null
}

const contextDownloadMenus = ['link', 'image', 'audio', 'video']

// Service Worker 安装
self.addEventListener('install', () => {
  console.log('Download Manager Service Worker installing...')
  self.skipWaiting()
})

// Service Worker 激活
self.addEventListener('activate', (event) => {
  console.log('Download Manager Service Worker activated')
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

    // 禁用下载底部提示
    if (chrome.downloads.setShelfEnabled) {
      chrome.downloads.setShelfEnabled(false)
    }

    // 初始化下载进度
    handleDownloadingNumber(0)
    handleDangerousDownloading(false)
    updateDownloadProgress()

    await ensureOffscreenDocument()

    // 创建上下文菜单
    const downloadContextMenus = await storage.get('download_context_menus')
    if (downloadContextMenus) {
      await createDownloadContextMenus()
    }

  } catch (error) {
    console.error('Initialize error:', error)
  }
}

// 下载创建监听
chrome.downloads.onCreated.addListener((item) => {
  if (item.state === 'in_progress') {
    updateDownloadProgress()
  }
})

// 下载变化监听
chrome.downloads.onChanged.addListener(() => {
  updateDownloadProgress()
})

// 下载删除监听
chrome.downloads.onErased.addListener((id) => {
  deleteAllDownloadNotificationId(id)
})

// 通知按钮点击
chrome.notifications.onButtonClicked.addListener((notificationId, index) => {
  chrome.notifications.clear(notificationId)

  if (notificationId.indexOf('completed') >= 0) {
    const fileId = parseInt(notificationId.substring(0, notificationId.indexOf('-')))
    if (index === 0) {
      chrome.downloads.open(fileId)
    } else if (index === 1) {
      chrome.downloads.show(fileId)
    }
  }
})

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
      }

      sendResponse({ success: true })
    } catch (error) {
      console.error('Message handler error:', error)
      sendResponse({ success: false, error: error.message })
    }
  })()

  return true
})


// 更新下载进度
async function updateDownloadProgress() {
  if (state.progressTimer) return
  
  state.progressTimer = setTimeout(async () => {
    state.progressTimer = null
    
    try {
      const items = await chrome.downloads.search({ orderBy: ['-startTime'] })
      
      let downloadingNumber = 0
      let anyInProgress = false
      let anyInDangerous = false
      let greaterThanZeroNumber = 0
      let totalProgress = 0.0

      for (const item of items) {
        common.beforeHandler(item)
        
        if (item.state === 'in_progress') {
          downloadingNumber++
          anyInProgress = true

          await handleDownloadStartedNotification(item)

          if ((item.danger !== 'safe') && (item.danger !== 'accepted')) {
            anyInDangerous = true
            await handleDownloadWarningNotification(item)
          }

          const progress = getProgress(item)
          if (progress !== -1) {
            greaterThanZeroNumber++
            totalProgress += progress
          }
        } else if (item.state === 'complete') {
          await handleDownloadCompletedNotification(item)
        } else {
          deleteAllDownloadNotificationId(item.id)
        }
      }

      state.anyInProgress = anyInProgress
      state.anyInDangerous = anyInDangerous

      // 设置当前所有下载文件总体进度
      if (greaterThanZeroNumber > 0) {
        state.progress = totalProgress / greaterThanZeroNumber
      } else {
        state.progress = -1
      }

      // 更新图标和 badge
      state.downloadingNumber = downloadingNumber
      handleDownloadingNumber(downloadingNumber)
      handleDangerousDownloading(anyInDangerous)

      // 更新图标进度
      if (anyInProgress) {
        const themeKey = await getActiveIconThemeKey()
        const iconColor = await storage.get('icon_color')
        const iconDownloadingColor = await storage.get('icon_downloading_color')

        if (iconColor && iconDownloadingColor) {
          icon.setRunningBrowserActionIcon(
            iconColor[themeKey],
            iconDownloadingColor[themeKey],
            anyInProgress,
            state.progress
          )
        }
      } else {
        const themeKey = await getActiveIconThemeKey()
        const iconColor = await storage.get('icon_color')
        if (iconColor) {
          icon.restoreDefaultIcon(iconColor[themeKey])
        }
      }

      // 发送数据到 popup（如果打开）
      try {
        await chrome.runtime.sendMessage(JSON.stringify({
          type: 'download',
          data: items
        }))
      } catch (e) {
        // Popup 可能未打开，忽略错误
      }

      // 如果还有下载中的文件，继续更新
      if (state.anyInProgress) {
        setTimeout(updateDownloadProgress, 400)
      }
    } catch (error) {
      console.error('Update download progress error:', error)
    }
  }, 100)
}

// 处理下载开始通知
async function handleDownloadStartedNotification(item) {
  const notificationId = item.id + '-started'
  if (state.notificationList.indexOf(notificationId) < 0) {
    state.notificationList.push(notificationId)
    
    const iconUrl = await getIcon(item)
    const showNotification = await storage.get('download_started_notification')
    
    if (showNotification) {
      const level = await chrome.notifications.getPermissionLevel()
      if (level === 'granted') {
        const visible = await storage.get('download_notification_remain_visible')
        const option = {
          type: 'basic',
          priority: 2,
          iconUrl: iconUrl || 'img/icon19.png',
          title: common.i18data.downloadStartedNotification,
          message: item.basename || item.url,
          buttons: [{ title: common.i18data.deleteNotification }]
        }
        
        if (visible) {
          option.requireInteraction = true
        }
        
        await chrome.notifications.create(notificationId, option)
        closeNotification(notificationId, option, visible)
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
  if (state.notificationList.indexOf(notificationId) < 0 &&
      state.notificationList.indexOf(item.id + '-started') >= 0) {
    state.notificationList.push(notificationId)
    
    const iconUrl = await getIcon(item)
    const showNotification = await storage.get('download_completed_notification')
    
    if (showNotification) {
      const level = await chrome.notifications.getPermissionLevel()
      if (level === 'granted') {
        const visible = await storage.get('download_notification_remain_visible')
        const option = {
          type: 'basic',
          priority: 2,
          iconUrl: iconUrl || 'img/icon19.png',
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
        
        await chrome.notifications.create(notificationId, option)
        closeNotification(notificationId, option, visible)
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
    state.notificationList.push(notificationId)
    
    const iconUrl = await getIcon(item)
    const showNotification = await storage.get('download_warning_notification')
    
    if (showNotification) {
      const level = await chrome.notifications.getPermissionLevel()
      if (level === 'granted') {
        const visible = await storage.get('download_notification_remain_visible')
        const option = {
          type: 'basic',
          priority: 2,
          iconUrl: iconUrl || 'img/icon19.png',
          title: common.i18data.downloadWarnNotification,
          message: item.basename || item.url,
          buttons: [{ title: common.i18data.deleteNotification }]
        }
        
        if (visible) {
          option.requireInteraction = true
        }
        
        await chrome.notifications.create(notificationId, option)
        closeNotification(notificationId, option, visible)
      }
    }

    const playTone = await storage.get('download_warning_tone')
    if (playTone) {
      playAudio('audio/warning.mp3')
    }
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

// 播放音频（使用 Offscreen Document）
async function playAudio(audioFile) {
  try {
    await ensureOffscreenDocument()

    await chrome.runtime.sendMessage({
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

// 获取文件图标
async function getIcon(item) {
  if (item.iconUrl) {
    return item.iconUrl
  } else {
    return await common.getCustomFileIcon(item)
  }
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

console.log('Download Manager background script loaded')
