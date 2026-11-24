<script>
  import { onMount, tick, untrack } from 'svelte'
  import { fade } from 'svelte/transition'
  import common from '../../utils/common'
  import storage from '../../utils/storage'
  import { deleteCachedFileIcon } from '../../utils/fileIconCache'
  import { isDangerousDownload } from '../../utils/downloadDanger'
  import {
    POPUP_HEADER_BUTTON_KEYS,
    normalizePopupHeaderButtons,
    normalizePopupHeaderButtonsOrder,
    getOrderedVisiblePopupHeaderButtons,
    isPopupHeaderButtonVisible
  } from '../../utils/popupHeaderButtons'
  import Icon from '../../components/Icon.svelte'
  import Tip from '../../components/Tip.svelte'
  import VirtualList from '../../components/VirtualList.svelte'
  import FloatingTooltip from '../../components/FloatingTooltip.svelte'
  import File from './File.svelte'
  import emptyStateUrl from '../../assets/empty-state.svg'

  const DOWNLOADS_PROJECTION_KEY = 'downloads_projection'
  const PENDING_POPUP_DOWNLOAD_CONFIRM_KEY = 'pending_popup_download_confirm'
  const DOWNLOAD_CONFIRM_TTL_MS = 24 * 60 * 60 * 1000
  const TOOLTIP_SHOW_AFTER = 700
  const ACTIVE_DOWNLOAD_POLL_INTERVAL_MS = 500
  const CHROME_DOWNLOAD_PAGE_URL = 'chrome://downloads'
  const POPUP_SETTINGS_KEYS = [
    'download_panel_page_size',
    'theme',
    'ui_theme_series',
    'ui_theme',
    'download_panel_theme',
    'close_tooltip',
    'left_click_file',
    'right_click_file',
    'left_click_url',
    'right_click_url',
    'enable_animation',
    'show_download_progress',
    'delete_file_confirm',
    'popup_header_buttons_visible',
    'popup_header_buttons',
    'popup_header_buttons_order'
  ]

  let cachedThemeData = null
  let themeDataPromise = null

  function loadThemeData() {
    if (cachedThemeData) {
      return Promise.resolve(cachedThemeData)
    }
    if (themeDataPromise) {
      return themeDataPromise
    }

    const themeUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('/theme/theme.json')
      : '/theme/theme.json'
    themeDataPromise = fetch(themeUrl)
      .then(response => response.json())
      .then(data => {
        cachedThemeData = data
        return data
      })
      .catch(error => {
        themeDataPromise = null
        throw error
      })
    return themeDataPromise
  }

  function formatMonthDayHourMinute(time) {
    if (!time) {
      return ''
    }
    const date = new Date(time)
    if (isNaN(date.getTime())) {
      return ''
    }
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${month}/${day} ${hours}:${minutes}`
  }

  const i18data = common.i18data

  // 界面与设置状态
  let downloadPanelPageSize = $state({ width: 400, height: 420 })
  let searchContent = $state('')
  let downloadUrl = $state('')
  let downloadItems = $state([])
  let showPopover = $state(false)
  let openDropdown = $state(null) // 'clear' | 'batch' | null
  let listScrollTop = $state(0)

  // 复制提示状态
  let tipPosition = $state({ x: 0, y: 0 })
  let showCopiedTip = $state(false)

  // 插件设置
  let closeTooltip = $state(true)
  let leftClickFile = $state(true)
  let leftClickUrl = $state(true)
  let rightClickFile = $state(true)
  let rightClickUrl = $state(true)
  let enableAnimation = $state(false)
  let showDownloadProgress = $state(true)
  let deleteFileConfirm = $state(true)
  let popupHeaderButtonsVisible = $state(true)
  let popupHeaderButtons = $state([...POPUP_HEADER_BUTTON_KEYS])
  let popupHeaderButtonsOrder = $state([...POPUP_HEADER_BUTTON_KEYS])

  const visibleHeaderButtons = $derived(
    getOrderedVisiblePopupHeaderButtons(popupHeaderButtonsVisible, popupHeaderButtons, popupHeaderButtonsOrder)
  )
  const showNewDownloadBtn = $derived(isPopupHeaderButtonVisible(popupHeaderButtonsVisible, popupHeaderButtons, 'newDownload'))
  const showClearBtn = $derived(isPopupHeaderButtonVisible(popupHeaderButtonsVisible, popupHeaderButtons, 'clear'))
  const showBatchActionsBtn = $derived(isPopupHeaderButtonVisible(popupHeaderButtonsVisible, popupHeaderButtons, 'batchActions'))

  // 确认弹窗状态
  let deleteConfirm = $state({
    visible: false,
    title: '',
    message: '',
    confirmText: '',
    action: null
  })
  let downloadConfirm = $state({
    visible: false,
    title: '',
    message: '',
    confirmText: '',
    url: '',
    afterDownload: null
  })

  // 全局单例 Tooltip 状态（Header 按钮 + 文件行操作按钮共用）
  let actionTooltip = $state({
    visible: false,
    content: '',
    triggerEl: null,
    placement: 'top'
  })

  // DOM 引用与浮层定位
  let virtualListRef = $state(null)
  let downloadBtnRef = $state(null)
  let clearBtnRef = $state(null)
  let batchBtnRef = $state(null)
  let textareaRef = $state(null)
  let dropdownMenuRef = $state(null)
  let popoverTop = $state(48)
  let popoverArrowLeft = $state(240)
  let dropdownPos = $state({ top: 48, left: 0, arrowLeft: 24, ready: false })

  // 非响应式内部状态（避免不必要的依赖追踪）
  let themeData = null
  let downloadItemIndexMap = new Map()
  let downloadUpdateVersion = 0
  let renderRequestId = 0
  let activeDownloadsPollTimer = null
  let activeDownloadsPollInFlight = false
  let visibleActiveDownloadIdsSignature = ''
  let visibleDownloadRange = { start: 0, end: -1 }
  let actionTooltipTimer = null

  // 派生状态
  const filteredDownloadItems = $derived.by(() => {
    const keyword = searchContent.trim().toLowerCase()
    if (!keyword) {
      return downloadItems
    }
    return downloadItems.filter(item => (item.searchKey || '').includes(keyword))
  })

  const openDownloadPopoverWidth = $derived(
    Math.max(Number(downloadPanelPageSize.width) - 8, 280)
  )

  const inProgressDownloadItems = $derived(
    downloadItems.filter(item => item && item.state === 'in_progress')
  )
  const pausableDownloadItems = $derived(
    inProgressDownloadItems.filter(item => !item.paused)
  )
  const resumableDownloadItems = $derived(
    downloadItems.filter(item => {
      if (!item) {
        return false
      }
      if (item.state === 'in_progress') {
        return Boolean(item.paused) && item.canResume !== false
      }
      return item.state === 'interrupted' && item.canResume === true
    })
  )
  const hasPausableDownloads = $derived(pausableDownloadItems.length > 0)
  const hasResumableDownloads = $derived(resumableDownloadItems.length > 0)
  const hasCancelableDownloads = $derived(inProgressDownloadItems.length > 0)

  // 组件初始化即并发预取，消除串行 IPC 瀑布
  const bootstrapStartVersion = downloadUpdateVersion
  const bootstrapPromise = Promise.all([
    loadThemeData().catch(error => {
      console.warn('Load theme.json failed:', error)
      return null
    }),
    storage.getMany(POPUP_SETTINGS_KEYS),
    storage.getManySession([DOWNLOADS_PROJECTION_KEY, PENDING_POPUP_DOWNLOAD_CONFIRM_KEY]),
    queryDownloadsSnapshot()
  ])

  // 自动调整下拉菜单位置
  $effect(() => {
    const active = openDropdown
    const menuEl = dropdownMenuRef
    const triggerEl = active === 'clear' ? clearBtnRef : (active === 'batch' ? batchBtnRef : null)
    if (!active || !menuEl || !triggerEl) {
      dropdownPos.ready = false
      return
    }

    const triggerRect = triggerEl.getBoundingClientRect()
    const menuWidth = menuEl.offsetWidth || 120
    const vw = window.innerWidth
    const margin = 6
    const triggerCenterX = triggerRect.left + triggerRect.width / 2
    const nextLeft = Math.max(margin, Math.min(triggerCenterX - menuWidth / 2, vw - menuWidth - margin))
    const nextArrowLeft = Math.max(12, Math.min(triggerCenterX - nextLeft, menuWidth - 12))

    dropdownPos = {
      top: Math.round(triggerRect.bottom + 8),
      left: Math.round(nextLeft),
      arrowLeft: Math.round(nextArrowLeft),
      ready: true
    }
  })

  // 当搜索词变化时，同步当前可见的活动下载轮询
  $effect(() => {
    void searchContent
    untrack(() => syncActiveDownloadsPolling())
  })

  onMount(() => {
    let disposed = false

    const runtimeMessageListener = (message) => {
      if (typeof message !== 'string') {
        return
      }
      let received
      try {
        received = JSON.parse(message)
      } catch {
        return
      }
      if (received.type === 'ui_theme_changed') {
        setTheme(received.data)
      }
    }
    chrome.runtime.onMessage.addListener(runtimeMessageListener)

    const storageChangeListener = (changes, areaName) => {
      if (areaName === 'session') {
        const projectionChange = changes[DOWNLOADS_PROJECTION_KEY]
        if (projectionChange && projectionChange.newValue) {
          applyDownloadsProjection(projectionChange.newValue)
        }
      }

      if (changes.close_tooltip) {
        closeTooltip = Boolean(changes.close_tooltip.newValue)
        if (closeTooltip) {
          hideActionTooltip()
        }
      }

      if (changes.show_download_progress) {
        const nextValue = changes.show_download_progress.newValue
        showDownloadProgress = typeof nextValue === 'boolean' ? nextValue : true
        syncActiveDownloadsPolling()
      }

      if (changes.delete_file_confirm) {
        const nextValue = changes.delete_file_confirm.newValue
        deleteFileConfirm = typeof nextValue === 'boolean' ? nextValue : true
      }

      if (changes.popup_header_buttons_visible) {
        const nextValue = changes.popup_header_buttons_visible.newValue
        popupHeaderButtonsVisible = typeof nextValue === 'boolean' ? nextValue : true
        if (!popupHeaderButtonsVisible) {
          closeOpenDownloadPopover()
          openDropdown = null
        }
      }

      if (changes.popup_header_buttons_order) {
        popupHeaderButtonsOrder = normalizePopupHeaderButtonsOrder(changes.popup_header_buttons_order.newValue)
        popupHeaderButtons = normalizePopupHeaderButtons(popupHeaderButtons, popupHeaderButtonsOrder)
      }

      if (changes.popup_header_buttons) {
        popupHeaderButtons = normalizePopupHeaderButtons(changes.popup_header_buttons.newValue, popupHeaderButtonsOrder)
        if (!popupHeaderButtons.includes('newDownload') && showPopover) {
          closeOpenDownloadPopover()
        }
        if (openDropdown === 'clear' && !popupHeaderButtons.includes('clear')) {
          openDropdown = null
        }
        if (openDropdown === 'batch' && !popupHeaderButtons.includes('batchActions')) {
          openDropdown = null
        }
      }
    }
    chrome.storage.onChanged.addListener(storageChangeListener)

    const darkModeMediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    const darkModeChangeListener = async (e) => {
      const settings = await storage.getMany(['theme', 'ui_theme_series', 'ui_theme'])
      if (settings.theme !== 'auto') {
        return
      }
      if (settings.ui_theme_series && themeData && themeData[`${settings.ui_theme_series}-${e.matches ? 'dark' : 'light'}`]) {
        setTheme(`${settings.ui_theme_series}-${e.matches ? 'dark' : 'light'}`)
        return
      }
      if (!settings.ui_theme) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }
    if (darkModeMediaQuery) {
      darkModeMediaQuery.addEventListener('change', darkModeChangeListener)
    }

    const visibilityChangeListener = () => {
      if (document.hidden) {
        stopActiveDownloadsPolling()
      } else {
        syncActiveDownloadsPolling()
      }
    }
    document.addEventListener('visibilitychange', visibilityChangeListener)

    const keydownListener = (event) => {
      if (event.key !== 'Escape') {
        return
      }
      if (downloadConfirm.visible) {
        cancelDownloadConfirm()
      } else if (deleteConfirm.visible) {
        cancelDeleteConfirm()
      } else if (showPopover) {
        closeOpenDownloadPopover()
      } else if (openDropdown) {
        openDropdown = null
      }
    }
    window.addEventListener('keydown', keydownListener)

    const pointerDownListener = (event) => {
      if (!openDropdown) {
        return
      }
      const target = event.target
      if (
        (dropdownMenuRef && dropdownMenuRef.contains(target)) ||
        (clearBtnRef && clearBtnRef.contains(target)) ||
        (batchBtnRef && batchBtnRef.contains(target))
      ) {
        return
      }
      openDropdown = null
    }
    window.addEventListener('mousedown', pointerDownListener)

    ;(async () => {
      const [loadedThemeData, settings, sessionData, snapshotItems] = await bootstrapPromise
      if (disposed) {
        return
      }

      checkPageSize(settings.download_panel_page_size)
      themeData = loadedThemeData
      if (themeData) {
        setTheme(resolveThemeNameFromSettings(settings))
      }

      closeTooltip = typeof settings.close_tooltip === 'boolean' ? settings.close_tooltip : true
      leftClickFile = typeof settings.left_click_file === 'boolean' ? settings.left_click_file : true
      rightClickFile = typeof settings.right_click_file === 'boolean' ? settings.right_click_file : true
      leftClickUrl = typeof settings.left_click_url === 'boolean' ? settings.left_click_url : true
      rightClickUrl = typeof settings.right_click_url === 'boolean' ? settings.right_click_url : true
      enableAnimation = Boolean(settings.enable_animation)
      showDownloadProgress = typeof settings.show_download_progress === 'boolean' ? settings.show_download_progress : true
      deleteFileConfirm = typeof settings.delete_file_confirm === 'boolean' ? settings.delete_file_confirm : true
      popupHeaderButtonsVisible = typeof settings.popup_header_buttons_visible === 'boolean' ? settings.popup_header_buttons_visible : true
      popupHeaderButtonsOrder = normalizePopupHeaderButtonsOrder(settings.popup_header_buttons_order)
      popupHeaderButtons = normalizePopupHeaderButtons(settings.popup_header_buttons, popupHeaderButtonsOrder)

      const preparedItems = []
      if (Array.isArray(snapshotItems)) {
        snapshotItems.forEach(item => {
          if (!item) {
            return
          }
          prepareDownloadItem(item)
          preparedItems.push(item)
        })
      }
      downloadItems = preparedItems
      rebuildDownloadItemIndexMap()

      const projection = downloadUpdateVersion !== bootstrapStartVersion
        ? await storage.getSession(DOWNLOADS_PROJECTION_KEY)
        : (sessionData && sessionData[DOWNLOADS_PROJECTION_KEY])
      if (disposed) {
        return
      }
      applyDownloadsProjection(projection, { allowInsertStates: ['in_progress'] })
      syncActiveDownloadsPolling()

      try {
        const pendingConfirm = sessionData && sessionData[PENDING_POPUP_DOWNLOAD_CONFIRM_KEY]
        if (pendingConfirm) {
          await storage.removeSession(PENDING_POPUP_DOWNLOAD_CONFIRM_KEY)
          const pendingUrl = typeof pendingConfirm.url === 'string' ? pendingConfirm.url.trim() : ''
          const isFresh = typeof pendingConfirm.createdAt !== 'number'
            || (Date.now() - pendingConfirm.createdAt) < DOWNLOAD_CONFIRM_TTL_MS
          if (!disposed && pendingUrl && isFresh) {
            openDownloadConfirm({
              title: i18data.downloadConfirmTitle,
              message: i18data.downloadConfirmMessage.replace('{}', pendingUrl),
              confirmText: i18data.downloadConfirmButton,
              url: pendingUrl,
              afterDownload: async (downloadId) => {
                if (downloadId !== null) {
                  await render()
                }
              }
            })
          }
        }
      } catch (error) {
        console.warn('Consume pending popup download confirm failed:', error)
      }
    })()

    return () => {
      disposed = true
      chrome.runtime.onMessage.removeListener(runtimeMessageListener)
      chrome.storage.onChanged.removeListener(storageChangeListener)
      window.removeEventListener('keydown', keydownListener)
      window.removeEventListener('mousedown', pointerDownListener)
      if (darkModeMediaQuery) {
        darkModeMediaQuery.removeEventListener('change', darkModeChangeListener)
      }
      document.removeEventListener('visibilitychange', visibilityChangeListener)
      hideActionTooltip()
      stopActiveDownloadsPolling()
    }
  })

  function applyDownloadsProjection(projection, options = {}) {
    if (!projection || typeof projection !== 'object') {
      return
    }

    downloadUpdateVersion++

    const removedIds = Array.isArray(projection.removedIds) ? projection.removedIds : []
    const removedIdSet = new Set(removedIds)
    removedIds.forEach(id => removeItemById(id))

    const itemsById = projection.itemsById && typeof projection.itemsById === 'object'
      ? projection.itemsById
      : {}

    Object.values(itemsById).forEach(item => {
      if (item && !removedIdSet.has(item.id)) {
        upsertDownloadItem(item, options)
      }
    })

    syncActiveDownloadsPolling()
  }

  function resolveThemeNameFromSettings(settings) {
    const theme = settings && settings.theme
    let effectiveMode
    if (theme === 'dark' || theme === 'light') {
      effectiveMode = theme
    } else {
      effectiveMode = common.isInDarkMode() ? 'dark' : 'light'
    }

    const uiThemeSeries = settings && settings.ui_theme_series
    const uiTheme = settings && settings.ui_theme
    if (uiThemeSeries && themeData && themeData[`${uiThemeSeries}-${effectiveMode}`]) {
      return `${uiThemeSeries}-${effectiveMode}`
    }

    if (uiTheme && themeData && themeData[uiTheme]) {
      return uiTheme
    }

    let downloadPanelTheme = settings && settings.download_panel_theme
    if (downloadPanelTheme !== 'dark' && downloadPanelTheme !== 'light') {
      downloadPanelTheme = effectiveMode
    }
    return downloadPanelTheme
  }

  function clearActionTooltipTimer() {
    if (actionTooltipTimer) {
      clearTimeout(actionTooltipTimer)
      actionTooltipTimer = null
    }
  }

  function showActionTooltip(triggerEl, content, placement = 'top') {
    if (closeTooltip || !triggerEl || !content) {
      return
    }
    clearActionTooltipTimer()
    if (actionTooltip.visible) {
      actionTooltip = {
        visible: true,
        content,
        triggerEl,
        placement
      }
      return
    }
    actionTooltipTimer = setTimeout(() => {
      actionTooltipTimer = null
      if (!closeTooltip && triggerEl.isConnected) {
        actionTooltip = {
          visible: true,
          content,
          triggerEl,
          placement
        }
      }
    }, TOOLTIP_SHOW_AFTER)
  }

  function hideActionTooltip() {
    clearActionTooltipTimer()
    if (actionTooltip.visible) {
      actionTooltip = {
        ...actionTooltip,
        visible: false
      }
    }
  }

  function onHeaderBtnEnter(event, text) {
    if (closeTooltip || !event?.currentTarget || openDropdown || showPopover) {
      return
    }
    showActionTooltip(event.currentTarget, text, 'bottom')
  }

  function checkPageSize(pageSize) {
    if (pageSize) {
      let width = Number(pageSize.width)
      if (width < 380) {
        width = 380
      }
      if (width > 800) {
        width = 800
      }

      let height = Number(pageSize.height)
      if (height < 300) {
        height = 300
      }
      if (height > 600) {
        height = 600
      }

      downloadPanelPageSize = { width, height }
    }
  }

  function getItem(id) {
    const index = downloadItemIndexMap.get(id)
    if (typeof index === 'number') {
      return downloadItems[index] || null
    }
    return null
  }

  function rebuildDownloadItemIndexMap() {
    downloadItemIndexMap = new Map(downloadItems.map((item, i) => [item.id, i]))
  }

  function removeItemById(id) {
    deleteCachedFileIcon(id)
    downloadItems = downloadItems.filter(item => item.id !== id)
    rebuildDownloadItemIndexMap()
  }

  function prepareDownloadItem(item, options = {}) {
    const recomputeBasename = options.recomputeBasename !== false
    const recomputeTime = options.recomputeTime !== false

    if (recomputeBasename || !item.basename) {
      common.beforeHandler(item)
      const nextSearchKey = (item.basename || '').toLowerCase()
      if (item.searchKey !== nextSearchKey) {
        item.searchKey = nextSearchKey
      }
    }
    if (recomputeTime || typeof item.formattedTime !== 'string') {
      const nextFormattedTime = formatMonthDayHourMinute(item.endTime || item.startTime)
      if (item.formattedTime !== nextFormattedTime) {
        item.formattedTime = nextFormattedTime
      }
    }

    const now = Date.now()
    if (typeof item.previousBytesReceived !== 'number') {
      item.previousBytesReceived = item.bytesReceived || 0
    }
    if (typeof item.previousMetricsUpdatedAt !== 'number') {
      item.previousMetricsUpdatedAt = now
    }
    if (typeof item.downloadMetricsUpdatedAt !== 'number') {
      item.downloadMetricsUpdatedAt = now
    }
    if (typeof item.downloadSpeedBytesPerSecond !== 'number') {
      item.downloadSpeedBytesPerSecond = null
    }
    const nextError = item.error || null
    if (item.error !== nextError) {
      item.error = nextError
    }
    const nextEstimatedEndTime = item.estimatedEndTime || null
    if (item.estimatedEndTime !== nextEstimatedEndTime) {
      item.estimatedEndTime = nextEstimatedEndTime
    }
    const nextEndTime = item.endTime || null
    if (item.endTime !== nextEndTime) {
      item.endTime = nextEndTime
    }
    const nextExists = typeof item.exists === 'boolean' ? item.exists : true
    if (item.exists !== nextExists) {
      item.exists = nextExists
    }
    const nextPaused = Boolean(item.paused)
    if (item.paused !== nextPaused) {
      item.paused = nextPaused
    }
  }

  function calculateDownloadSpeed(previousBytesReceived, nextBytesReceived, previousMetricsUpdatedAt, now, item) {
    if (!item || item.state !== 'in_progress' || item.paused) {
      return 0
    }

    const elapsedSeconds = (now - previousMetricsUpdatedAt) / 1000
    const bytesDelta = nextBytesReceived - previousBytesReceived
    if (elapsedSeconds <= 0 || bytesDelta <= 0) {
      return 0
    }

    return bytesDelta / elapsedSeconds
  }

  function mergeDownloadItem(target, source) {
    const previousBytesReceived = target.bytesReceived || 0
    const previousMetricsUpdatedAt = target.downloadMetricsUpdatedAt || Date.now()
    const nextBytesReceived = source.bytesReceived || 0
    const now = Date.now()
    const pathChanged = target.filename !== source.filename ||
      target.url !== source.url ||
      target.finalUrl !== source.finalUrl
    const timeChanged = target.endTime !== source.endTime ||
      target.startTime !== source.startTime

    Object.keys(source).forEach(key => {
      const nextValue = source[key]
      if (target[key] !== nextValue) {
        target[key] = nextValue
      }
    })

    prepareDownloadItem(target, {
      recomputeBasename: pathChanged,
      recomputeTime: timeChanged
    })

    if (target.previousBytesReceived !== previousBytesReceived) {
      target.previousBytesReceived = previousBytesReceived
    }
    if (target.previousMetricsUpdatedAt !== previousMetricsUpdatedAt) {
      target.previousMetricsUpdatedAt = previousMetricsUpdatedAt
    }
    target.downloadMetricsUpdatedAt = now
    const nextSpeed = calculateDownloadSpeed(
      previousBytesReceived,
      nextBytesReceived,
      previousMetricsUpdatedAt,
      now,
      target
    )
    if (target.downloadSpeedBytesPerSecond !== nextSpeed) {
      target.downloadSpeedBytesPerSecond = nextSpeed
    }
  }

  function insertDownloadItem(item) {
    let insertIndex = downloadItems.length
    for (let i = 0; i < downloadItems.length; i++) {
      if (item.startTime >= downloadItems[i].startTime) {
        insertIndex = i
        break
      }
    }
    downloadItems.splice(insertIndex, 0, item)
    rebuildDownloadItemIndexMap()
  }

  function upsertDownloadItem(item, options = {}) {
    prepareDownloadItem(item)
    const target = getItem(item.id)
    if (target) {
      mergeDownloadItem(target, item)
      return
    }

    if (Array.isArray(options.allowInsertStates) && !options.allowInsertStates.includes(item.state)) {
      return
    }

    insertDownloadItem(item)
  }

  async function queryDownloadsSnapshot(query = null) {
    if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.search) {
      if (query && Array.isArray(query.ids)) {
        const validIds = query.ids.filter(id => typeof id === 'number')
        const results = await Promise.all(
          validIds.map(id => new Promise(resolve => {
            chrome.downloads.search({ id }, items => {
              if (chrome.runtime && chrome.runtime.lastError) {
                resolve(null)
                return
              }
              const item = items && items[0]
              if (!item) {
                resolve(null)
                return
              }
              common.beforeHandler(item)
              resolve(item)
            })
          }))
        )
        return results.filter(Boolean)
      }

      const searchQuery = query ? { ...query } : { orderBy: ['-startTime'] }
      if (!searchQuery.orderBy) {
        searchQuery.orderBy = ['-startTime']
      }
      return await new Promise(resolve => {
        chrome.downloads.search(searchQuery, items => {
          if ((chrome.runtime && chrome.runtime.lastError) || !Array.isArray(items)) {
            resolve([])
            return
          }
          items.forEach(item => {
            if (item) {
              common.beforeHandler(item)
            }
          })
          resolve(items.filter(Boolean))
        })
      })
    }

    return await requestDownloadSnapshot(query)
  }

  async function requestDownloadSnapshot(query = null) {
    if (!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage)) {
      return []
    }

    return await new Promise(resolve => {
      chrome.runtime.sendMessage(JSON.stringify({
        type: 'download_snapshot_request',
        data: query
      }), response => {
        if (chrome.runtime.lastError || !response || !response.success || !Array.isArray(response.data)) {
          resolve([])
          return
        }
        resolve(response.data)
      })
    })
  }

  async function render() {
    const requestId = ++renderRequestId
    const startVersion = downloadUpdateVersion
    const [projection, items] = await Promise.all([
      storage.getSession(DOWNLOADS_PROJECTION_KEY),
      queryDownloadsSnapshot()
    ])

    if (requestId !== renderRequestId) {
      return
    }

    if (downloadUpdateVersion !== startVersion) {
      setTimeout(() => {
        if (requestId === renderRequestId) {
          render()
        }
      }, 0)
      return
    }

    const prepared = []
    items.forEach(item => {
      if (!item) {
        return
      }
      prepareDownloadItem(item)
      prepared.push(item)
    })
    downloadItems = prepared
    rebuildDownloadItemIndexMap()
    applyDownloadsProjection(projection)
    syncActiveDownloadsPolling()
  }

  function handleScrollerUpdate(renderStart, renderEnd, visibleStartIndex, visibleEndIndex) {
    const start = Number.isFinite(visibleStartIndex) ? Math.max(visibleStartIndex, 0) : 0
    const end = Number.isFinite(visibleEndIndex) ? Math.max(visibleEndIndex, -1) : -1
    visibleDownloadRange = { start, end }
    untrack(() => syncActiveDownloadsPolling())
  }

  function handleListScroll(scrollTop) {
    listScrollTop = scrollTop
    hideActionTooltip()
  }

  function getVisibleActiveDownloadIds() {
    if (!showDownloadProgress) {
      return []
    }

    const visibleItems = filteredDownloadItems.slice(
      visibleDownloadRange.start,
      visibleDownloadRange.end + 1
    )

    return visibleItems
      .filter(item => item && item.state === 'in_progress' && !isDangerousDownload(item))
      .map(item => item.id)
  }

  function syncActiveDownloadsPolling() {
    const visibleActiveDownloadIds = getVisibleActiveDownloadIds()
    const signature = visibleActiveDownloadIds.join(',')
    const shouldPoll = visibleActiveDownloadIds.length > 0 && !document.hidden
    if (signature === visibleActiveDownloadIdsSignature && Boolean(activeDownloadsPollTimer) === shouldPoll) {
      return
    }

    visibleActiveDownloadIdsSignature = signature
    if (shouldPoll) {
      startActiveDownloadsPolling()
    } else {
      stopActiveDownloadsPolling()
    }
  }

  function startActiveDownloadsPolling() {
    if (activeDownloadsPollTimer) {
      return
    }

    activeDownloadsPollTimer = setInterval(() => {
      pollActiveDownloads()
    }, ACTIVE_DOWNLOAD_POLL_INTERVAL_MS)
  }

  function stopActiveDownloadsPolling() {
    if (!activeDownloadsPollTimer) {
      return
    }

    clearInterval(activeDownloadsPollTimer)
    activeDownloadsPollTimer = null
    activeDownloadsPollInFlight = false
  }

  async function pollActiveDownloads() {
    if (document.hidden) {
      stopActiveDownloadsPolling()
      return
    }
    const currentActiveIds = getVisibleActiveDownloadIds()
    if (activeDownloadsPollInFlight || currentActiveIds.length === 0) {
      syncActiveDownloadsPolling()
      return
    }

    activeDownloadsPollInFlight = true
    try {
      const items = await queryDownloadsSnapshot({ ids: currentActiveIds })
      const validItems = items.filter(Boolean)
      const activeIds = new Set(validItems.map(item => item.id))
      validItems.forEach(item => {
        upsertDownloadItem(item)
      })
      const hasMissingActiveItem = currentActiveIds.some(id => !activeIds.has(id))
      if (hasMissingActiveItem) {
        await render()
      }
    } finally {
      activeDownloadsPollInFlight = false
      syncActiveDownloadsPolling()
    }
  }

  function resizeTextarea() {
    if (!textareaRef) {
      return
    }
    textareaRef.style.height = 'auto'
    const lineHeight = 21
    const paddingVertical = 10
    const minHeight = lineHeight + paddingVertical
    const maxHeight = lineHeight * 4 + paddingVertical
    const nextHeight = Math.max(minHeight, Math.min(textareaRef.scrollHeight, maxHeight))
    textareaRef.style.height = `${nextHeight}px`
  }

  async function toggleOpenDownload(event) {
    event?.stopPropagation()
    hideActionTooltip()
    openDropdown = null

    if (showPopover) {
      closeOpenDownloadPopover()
      return
    }

    if (downloadBtnRef) {
      const rect = downloadBtnRef.getBoundingClientRect()
      popoverTop = Math.round(rect.bottom + 8)
      popoverArrowLeft = Math.round(rect.left + rect.width / 2 - 4)
    }
    showPopover = true
    await tick()
    if (textareaRef) {
      resizeTextarea()
      textareaRef.focus()
    }
  }

  function closeOpenDownloadPopover() {
    showPopover = false
    downloadUrl = ''
  }

  function toggleDropdown(name, event) {
    event?.stopPropagation()
    hideActionTooltip()
    if (showPopover) {
      closeOpenDownloadPopover()
    }
    openDropdown = openDropdown === name ? null : name
  }

  function handleTextareaKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      enterToDownload(downloadUrl)
    }
  }

  function clearDownloadUrl() {
    downloadUrl = ''
    tick().then(() => {
      resizeTextarea()
      textareaRef?.focus()
    })
  }

  function enterToDownload(url) {
    closeOpenDownloadPopover()
    requestDownload(url, async (downloadId) => {
      if (downloadId !== null) {
        await render()
      }
    }).catch(error => {
      console.warn('Manual download failed', error)
    })
  }

  async function requestDownload(url, afterDownload) {
    const trimUrl = typeof url === 'string' ? url.trim() : ''
    if (!trimUrl) {
      return null
    }

    if (await common.shouldConfirmBeforeDownload()) {
      openDownloadConfirm({
        title: i18data.downloadConfirmTitle,
        message: i18data.downloadConfirmMessage.replace('{}', trimUrl),
        confirmText: i18data.downloadConfirmButton,
        url: trimUrl,
        afterDownload: typeof afterDownload === 'function' ? afterDownload : null
      })
      return null
    }

    const downloadId = await common.download(trimUrl)
    if (typeof afterDownload === 'function') {
      await afterDownload(downloadId)
    }
    return downloadId
  }

  function openDownloadConfirm({ title, message, confirmText, url, afterDownload }) {
    if (deleteConfirm.visible) {
      cancelDeleteConfirm()
    }
    downloadConfirm = {
      visible: true,
      title,
      message,
      confirmText,
      url,
      afterDownload: typeof afterDownload === 'function' ? afterDownload : null
    }
  }

  function cancelDownloadConfirm() {
    downloadConfirm = {
      ...downloadConfirm,
      visible: false,
      url: '',
      afterDownload: null
    }
  }

  async function confirmDownloadStart() {
    const url = downloadConfirm.url
    const afterDownload = downloadConfirm.afterDownload
    cancelDownloadConfirm()
    if (!url) {
      return
    }

    const downloadId = await common.download(url)
    if (typeof afterDownload === 'function') {
      try {
        await afterDownload(downloadId)
      } catch (error) {
        console.warn('Download confirm after action failed', error)
      }
    }
  }

  function openFolder() {
    hideActionTooltip()
    chrome.downloads.showDefaultFolder()
  }

  function openHome() {
    hideActionTooltip()
    chrome.tabs.create({ url: CHROME_DOWNLOAD_PAGE_URL })
  }

  function openOptions() {
    hideActionTooltip()
    chrome.runtime.openOptionsPage()
  }

  function erase(item) {
    return new Promise(resolve => {
      if (!item || typeof item.id !== 'number') {
        resolve(false)
        return
      }

      chrome.downloads.erase({ id: item.id }, async () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          render()
          resolve(false)
          return
        }
        try {
          await removeProjectionItemById(item.id)
        } catch (error) {
          console.warn('Remove projection item failed', error)
        }
        removeItemById(item.id)
        resolve(true)
      })
    })
  }

  async function eraseMany(items) {
    const validItems = Array.isArray(items)
      ? items.filter(item => item && typeof item.id === 'number')
      : []
    if (!validItems.length) {
      return
    }

    const CHUNK_SIZE = 20
    const erasedIds = []
    let hasError = false

    for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
      const chunk = validItems.slice(i, i + CHUNK_SIZE)
      const chunkResults = await Promise.all(chunk.map(item => new Promise(resolve => {
        chrome.downloads.erase({ id: item.id }, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve({ id: item.id, ok: false })
            return
          }
          resolve({ id: item.id, ok: true })
        })
      })))
      chunkResults.forEach(res => {
        if (res.ok) {
          erasedIds.push(res.id)
        } else {
          hasError = true
        }
      })
    }

    if (erasedIds.length > 0) {
      const erasedIdSet = new Set(erasedIds)
      erasedIds.forEach(id => deleteCachedFileIcon(id))
      downloadItems = downloadItems.filter(item => !erasedIdSet.has(item.id))
      rebuildDownloadItemIndexMap()
      try {
        await removeProjectionItemsByIds(erasedIds)
      } catch (error) {
        console.warn('Remove projection items failed', error)
      }
      syncActiveDownloadsPolling()
    }

    if (hasError) {
      await render()
    }
  }

  async function removeProjectionItemById(id) {
    await removeProjectionItemsByIds([id])
  }

  async function removeProjectionItemsByIds(ids) {
    if (!Array.isArray(ids) || !ids.length) {
      return
    }

    const projection = await storage.getSession(DOWNLOADS_PROJECTION_KEY)
    if (!projection || typeof projection !== 'object') {
      return
    }

    const idSet = new Set(ids)
    const itemsById = projection.itemsById && typeof projection.itemsById === 'object'
      ? { ...projection.itemsById }
      : {}
    ids.forEach(id => {
      delete itemsById[id]
    })

    const removedIds = Array.isArray(projection.removedIds)
      ? projection.removedIds.filter(removedId => !idSet.has(removedId))
      : []
    ids.forEach(id => {
      removedIds.push(id)
    })

    await storage.setSession(DOWNLOADS_PROJECTION_KEY, {
      ...projection,
      seq: (typeof projection.seq === 'number' ? projection.seq : 0) + 1,
      updatedAt: Date.now(),
      itemsById,
      removedIds
    })
  }

  function requestRemoveFile(item) {
    if (!item || item.state !== 'complete' || !item.exists) {
      return
    }

    const action = () => removeFileFromDisk(item)
    if (!deleteFileConfirm) {
      const result = action()
      if (result && typeof result.catch === 'function') {
        result.catch(error => {
          console.warn('Delete action failed', error)
          render()
        })
      }
      return
    }

    openDeleteConfirm({
      title: i18data.deleteConfirmTitle,
      message: i18data.deleteConfirmFileMessage.replace('{}', item.basename || item.filename || item.url),
      confirmText: i18data.deleteConfirmButton,
      action
    })
  }

  function requestRemoveAllFiles() {
    const items = downloadItems.filter(item => item.state && item.state !== 'in_progress')
    if (!items.length) {
      return
    }

    openDeleteConfirm({
      title: i18data.deleteConfirmTitle,
      message: i18data.deleteConfirmAllMessage.replace('{}', items.length),
      confirmText: i18data.deleteConfirmButton,
      action: () => removeAllFilesFromDisk(items)
    })
  }

  function openDeleteConfirm({ title, message, confirmText, action }) {
    if (downloadConfirm.visible) {
      cancelDownloadConfirm()
    }
    deleteConfirm = {
      visible: true,
      title,
      message,
      confirmText,
      action
    }
  }

  function cancelDeleteConfirm() {
    deleteConfirm = {
      ...deleteConfirm,
      visible: false,
      action: null
    }
  }

  function confirmDelete() {
    const action = deleteConfirm.action
    cancelDeleteConfirm()
    if (typeof action === 'function') {
      const result = action()
      if (result && typeof result.catch === 'function') {
        result.catch(error => {
          console.warn('Delete confirm action failed', error)
          render()
        })
      }
    }
  }

  async function removeFileFromDisk(item) {
    if (!item || typeof item.id !== 'number') {
      return false
    }

    if (!item.exists) {
      return await erase(item)
    }

    const result = await removeDownloadFile(item)
    if (!result.success) {
      const shouldErase = await shouldEraseAfterRemoveFileFailure(item, result.errorMessage)
      if (!shouldErase) {
        await render()
        return false
      }
    }

    item.exists = false
    return await erase(item)
  }

  function removeDownloadFile(item) {
    return new Promise(resolve => {
      chrome.downloads.removeFile(item.id, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve({
            success: false,
            errorMessage: chrome.runtime.lastError.message || ''
          })
          return
        }
        resolve({
          success: true,
          errorMessage: ''
        })
      })
    })
  }

  async function shouldEraseAfterRemoveFileFailure(item, errorMessage) {
    if (!item.exists || isFileMissingError(errorMessage)) {
      return true
    }

    const refreshedItem = await getDownloadItemById(item.id)
    return !refreshedItem || refreshedItem.exists === false
  }

  function isFileMissingError(errorMessage) {
    return /does(?:\s+not|n't)\s+exist|not\s+found|no\s+such\s+file|file\s+missing|already\s+(?:deleted|removed)|has\s+been\s+(?:deleted|removed)|不存在|找不到|已删除|已移除/i.test(errorMessage || '')
  }

  function getDownloadItemById(id) {
    return new Promise(resolve => {
      chrome.downloads.search({ id }, items => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(null)
          return
        }
        resolve(items && items[0] ? items[0] : null)
      })
    })
  }

  async function removeAllFilesFromDisk(items) {
    const CHUNK_SIZE = 10
    const itemsToErase = []
    let hasFailure = false

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE)
      const results = await Promise.all(chunk.map(async (item) => {
        const currentItem = getItem(item.id)
        if (!currentItem || typeof currentItem.id !== 'number') {
          return { item: null, shouldErase: false, failed: false }
        }
        if (!currentItem.exists) {
          return { item: currentItem, shouldErase: true, failed: false }
        }
        const result = await removeDownloadFile(currentItem)
        if (!result.success) {
          const shouldErase = await shouldEraseAfterRemoveFileFailure(currentItem, result.errorMessage)
          if (!shouldErase) {
            return { item: currentItem, shouldErase: false, failed: true }
          }
        }
        currentItem.exists = false
        return { item: currentItem, shouldErase: true, failed: false }
      }))

      results.forEach(({ item, shouldErase, failed }) => {
        if (shouldErase && item) {
          itemsToErase.push(item)
        }
        if (failed) {
          hasFailure = true
        }
      })
    }

    if (itemsToErase.length > 0) {
      await eraseMany(itemsToErase)
    }
    if (hasFailure) {
      await render()
    }
  }

  function batchDownloadCommand(command) {
    openDropdown = null
    if (command === 'pauseAll') {
      pauseAllDownloads()
      return
    }
    if (command === 'resumeAll') {
      resumeAllDownloads()
      return
    }
    if (command === 'cancelAll') {
      requestCancelAllDownloads()
    }
  }

  function pauseAllDownloads() {
    const targets = [...pausableDownloadItems]
    let remainingCount = targets.length
    if (!remainingCount) {
      return
    }

    targets.forEach(item => {
      chrome.downloads.pause(item.id, () => {
        if (!(chrome.runtime && chrome.runtime.lastError)) {
          const current = getItem(item.id)
          if (current) {
            current.paused = true
          }
        }
        remainingCount -= 1
        if (remainingCount <= 0) {
          render()
        }
      })
    })
  }

  function resumeAllDownloads() {
    const targets = [...resumableDownloadItems]
    let remainingCount = targets.length
    if (!remainingCount) {
      return
    }

    targets.forEach(item => {
      chrome.downloads.resume(item.id, () => {
        if (!(chrome.runtime && chrome.runtime.lastError)) {
          const current = getItem(item.id)
          if (current) {
            current.paused = false
          }
        }
        remainingCount -= 1
        if (remainingCount <= 0) {
          render()
        }
      })
    })
  }

  function requestCancelAllDownloads() {
    const targets = [...inProgressDownloadItems]
    if (!targets.length) {
      return
    }

    openDeleteConfirm({
      title: i18data.cancelAll,
      message: i18data.cancelAllConfirmMessage.replace('{}', targets.length),
      confirmText: i18data.cancelAll,
      action: () => cancelAllDownloads(targets)
    })
  }

  function cancelAllDownloads(targets = [...inProgressDownloadItems]) {
    let remainingCount = targets.length
    if (!remainingCount) {
      return
    }

    targets.forEach(item => {
      chrome.downloads.cancel(item.id, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          // 静默消费错误（例如回调前下载已完成）
        }
        remainingCount -= 1
        if (remainingCount <= 0) {
          render()
        }
      })
    })
  }

  function clearDropdownCommand(command) {
    openDropdown = null
    if (command === 'deleteAll') {
      requestRemoveAllFiles()
      return
    }

    const targets = downloadItems.filter(item => {
      if (!item.state || item.state === 'in_progress') {
        return false
      }
      switch (command) {
        case 'clearAll':
          return true
        case 'clearFailed':
          return Boolean(item.error)
        case 'clearAbsent':
          return !item.exists
        case 'clearCompleted':
          return item.state === 'complete'
        default:
          return false
      }
    })

    eraseMany(targets)
  }

  async function copyToClipboard(text, event) {
    if (!text) {
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      if (event) {
        tipPosition = { x: event.pageX, y: event.pageY }
      }
      showCopiedTip = true
    } catch (e) {
      console.error('failed to copy', e)
    }
  }

  function setTheme(theme) {
    if (!theme) {
      theme = 'light'
    }
    if (!themeData) {
      console.warn('themeData not loaded yet, skipping setTheme')
      return
    }

    const rootStyle = document.documentElement.style
    const bodyStyle = document.body.style
    const panelThemeData = themeData[theme]
    if (!panelThemeData) {
      console.warn(`Theme "${theme}" not found in themeData`)
      return
    }

    Object.keys(panelThemeData).forEach(key => {
      rootStyle.setProperty(key, panelThemeData[key])
      bodyStyle.setProperty(key, panelThemeData[key])
    })
    const bgColor = panelThemeData['--background-color'] || ''
    rootStyle.backgroundColor = bgColor
    bodyStyle.backgroundColor = bgColor
    rootStyle.colorScheme = (theme === 'dark' || theme.endsWith('-dark')) ? 'dark' : 'light'
  }
</script>

<div
  class="home"
  id="home"
  style:width="{downloadPanelPageSize.width}px"
  style:height="{Number(downloadPanelPageSize.height)}px"
>
  <div class="header">
    <div class="search">
      <div class="search-wrapper">
        <input
          class="search-input"
          type="text"
          autocomplete="off"
          aria-label="Search downloads"
          bind:value={searchContent}
        />
        {#if searchContent}
          <button
            type="button"
            class="search-clear-btn"
            aria-label="Clear search"
            onclick={() => { searchContent = '' }}
          >
            <Icon name="Close" size="11px" />
          </button>
        {/if}
        <span class="search-icon">
          <Icon name="Search" />
        </span>
      </div>
    </div>

    <div class="header-operator">
      {#each visibleHeaderButtons as btnKey (btnKey)}
        {#if btnKey === 'newDownload'}
          <button
            type="button"
            class="header-button header-popover-trigger"
            bind:this={downloadBtnRef}
            aria-label={i18data.newDownload}
            onmouseenter={(e) => onHeaderBtnEnter(e, i18data.newDownload)}
            onmouseleave={hideActionTooltip}
            onclick={toggleOpenDownload}
          >
            <Icon name="Download" class="icon-button" />
          </button>
        {:else if btnKey === 'clear'}
          <button
            type="button"
            class="header-button header-dropdown-trigger"
            bind:this={clearBtnRef}
            aria-label={i18data.clearAll}
            onmouseenter={(e) => onHeaderBtnEnter(e, i18data.clearAll)}
            onmouseleave={hideActionTooltip}
            onclick={(e) => toggleDropdown('clear', e)}
          >
            <Icon name="Brush" class="icon-button" />
          </button>
        {:else if btnKey === 'batchActions'}
          <button
            type="button"
            class="header-button header-dropdown-trigger"
            bind:this={batchBtnRef}
            aria-label={i18data.batchDownloadActions}
            onmouseenter={(e) => onHeaderBtnEnter(e, i18data.batchDownloadActions)}
            onmouseleave={hideActionTooltip}
            onclick={(e) => toggleDropdown('batch', e)}
          >
            <Icon name="VideoPause" class="icon-button" />
          </button>
        {:else if btnKey === 'openFolder'}
          <button
            type="button"
            class="header-button"
            aria-label={i18data.openDownloadFolder}
            onmouseenter={(e) => onHeaderBtnEnter(e, i18data.openDownloadFolder)}
            onmouseleave={hideActionTooltip}
            onclick={openFolder}
          >
            <Icon name="FolderOpened" class="icon-button" />
          </button>
        {:else if btnKey === 'openHome'}
          <button
            type="button"
            class="header-button"
            aria-label={i18data.openHome}
            onmouseenter={(e) => onHeaderBtnEnter(e, i18data.openHome)}
            onmouseleave={hideActionTooltip}
            onclick={openHome}
          >
            <Icon name="Position" class="icon-button" />
          </button>
        {/if}
      {/each}

      {#if showNewDownloadBtn && showPopover}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="musk" onclick={closeOpenDownloadPopover}></div>
        <div
          class="open-download-popover"
          style:top="{popoverTop}px"
          style:width="{openDownloadPopoverWidth}px"
        >
          <span class="popover-arrow" style:left="{popoverArrowLeft}px"></span>
          <div class="popover-textarea-wrap">
            <textarea
              class="popover-textarea"
              rows="1"
              placeholder={i18data.newDownloadPlaceholder}
              bind:this={textareaRef}
              bind:value={downloadUrl}
              oninput={resizeTextarea}
              onkeydown={handleTextareaKeydown}
            ></textarea>
            {#if downloadUrl}
              <button
                type="button"
                class="textarea-clear-btn"
                aria-label="Clear"
                onclick={clearDownloadUrl}
              >
                <Icon name="Close" size="12px" />
              </button>
            {/if}
          </div>
        </div>
      {/if}

      <button
        type="button"
        class="header-button"
        aria-label={i18data.openSettings}
        onmouseenter={(e) => onHeaderBtnEnter(e, i18data.openSettings)}
        onmouseleave={hideActionTooltip}
        onclick={openOptions}
      >
        <Icon name="Setting" class="icon-button" />
      </button>
    </div>
  </div>

  {#if openDropdown === 'clear' && showClearBtn}
    <div
      class="header-dropdown-menu"
      class:is-ready={dropdownPos.ready}
      role="menu"
      bind:this={dropdownMenuRef}
      style:top="{dropdownPos.top}px"
      style:left="{dropdownPos.left}px"
    >
      <span class="dropdown-arrow" style:left="{dropdownPos.arrowLeft}px"></span>
      <button type="button" class="dropdown-item" role="menuitem" onclick={() => clearDropdownCommand('clearAll')}>
        {i18data.clearAll}
      </button>
      <button type="button" class="dropdown-item is-danger" role="menuitem" onclick={() => clearDropdownCommand('deleteAll')}>
        {i18data.deleteAll}
      </button>
      <button type="button" class="dropdown-item" role="menuitem" onclick={() => clearDropdownCommand('clearFailed')}>
        {i18data.clearFailed}
      </button>
      <button type="button" class="dropdown-item" role="menuitem" onclick={() => clearDropdownCommand('clearAbsent')}>
        {i18data.clearAbsent}
      </button>
      <button type="button" class="dropdown-item" role="menuitem" onclick={() => clearDropdownCommand('clearCompleted')}>
        {i18data.clearCompleted}
      </button>
    </div>
  {:else if openDropdown === 'batch' && showBatchActionsBtn}
    <div
      class="header-dropdown-menu"
      class:is-ready={dropdownPos.ready}
      role="menu"
      bind:this={dropdownMenuRef}
      style:top="{dropdownPos.top}px"
      style:left="{dropdownPos.left}px"
    >
      <span class="dropdown-arrow" style:left="{dropdownPos.arrowLeft}px"></span>
      <button
        type="button"
        class="dropdown-item"
        class:is-disabled={!hasPausableDownloads}
        disabled={!hasPausableDownloads}
        role="menuitem"
        onclick={() => batchDownloadCommand('pauseAll')}
      >
        {i18data.pauseAll}
      </button>
      <button
        type="button"
        class="dropdown-item"
        class:is-disabled={!hasResumableDownloads}
        disabled={!hasResumableDownloads}
        role="menuitem"
        onclick={() => batchDownloadCommand('resumeAll')}
      >
        {i18data.resumeAll}
      </button>
      <div class="dropdown-divider" role="separator"></div>
      <button
        type="button"
        class="dropdown-item is-danger"
        class:is-disabled={!hasCancelableDownloads}
        disabled={!hasCancelableDownloads}
        role="menuitem"
        onclick={() => batchDownloadCommand('cancelAll')}
      >
        {i18data.cancelAll}
      </button>
    </div>
  {/if}

  <div class="content">
    <VirtualList
      bind:this={virtualListRef}
      items={filteredDownloadItems}
      itemSize={84}
      onupdate={handleScrollerUpdate}
      onscroll={handleListScroll}
    >
      {#snippet children(item)}
        <File
          {item}
          {render}
          {erase}
          requestRemove={requestRemoveFile}
          {requestDownload}
          {copyToClipboard}
          {showActionTooltip}
          {hideActionTooltip}
          {i18data}
          {closeTooltip}
          {leftClickFile}
          {showDownloadProgress}
          {leftClickUrl}
          {rightClickFile}
          {rightClickUrl}
          {enableAnimation}
        />
      {/snippet}
    </VirtualList>

    {#if filteredDownloadItems.length === 0}
      <div class="empty-state" aria-hidden="true">
        <img class="empty-state-illustration" src={emptyStateUrl} alt="" />
      </div>
    {/if}

    {#if listScrollTop > 70}
      <button
        type="button"
        class="backtop-button"
        aria-label="Back to top"
        onclick={() => virtualListRef?.scrollToTop()}
      >
        <Icon name="CaretTop" size="18px" />
      </button>
    {/if}

    {#if !closeTooltip}
      <FloatingTooltip
        visible={actionTooltip.visible}
        content={actionTooltip.content}
        triggerEl={actionTooltip.triggerEl}
        placement={actionTooltip.placement}
      />
    {/if}

    <Tip text={i18data.copied} position={tipPosition} bind:showTip={showCopiedTip} />
  </div>

  {#if deleteConfirm.visible}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="delete-confirm-overlay"
      transition:fade={{ duration: 140 }}
      onclick={(e) => { if (e.target === e.currentTarget) cancelDeleteConfirm() }}
    >
      <section class="delete-confirm-dialog" role="dialog" aria-modal="true">
        <div class="delete-confirm-icon">
          <Icon name="Delete" size="18px" />
        </div>
        <div class="delete-confirm-content">
          <h2>{deleteConfirm.title}</h2>
          <p>{deleteConfirm.message}</p>
        </div>
        <div class="delete-confirm-actions">
          <button class="delete-confirm-button secondary" type="button" onclick={cancelDeleteConfirm}>
            {i18data.cancel}
          </button>
          <button class="delete-confirm-button danger" type="button" onclick={confirmDelete}>
            {deleteConfirm.confirmText}
          </button>
        </div>
      </section>
    </div>
  {/if}

  {#if downloadConfirm.visible}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      class="delete-confirm-overlay"
      transition:fade={{ duration: 140 }}
      onclick={(e) => { if (e.target === e.currentTarget) cancelDownloadConfirm() }}
    >
      <section class="delete-confirm-dialog" role="dialog" aria-modal="true">
        <div class="delete-confirm-icon download-confirm-icon">
          <Icon name="Download" size="18px" />
        </div>
        <div class="delete-confirm-content">
          <h2>{downloadConfirm.title}</h2>
          <p class="download-confirm-message">{downloadConfirm.message}</p>
        </div>
        <div class="delete-confirm-actions">
          <button class="delete-confirm-button secondary" type="button" onclick={cancelDownloadConfirm}>
            {i18data.cancel}
          </button>
          <button class="delete-confirm-button primary" type="button" onclick={confirmDownloadStart}>
            {downloadConfirm.confirmText}
          </button>
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background-color: var(--background-color);
  }

  .home {
    background-color: var(--background-color);
    box-sizing: border-box;
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 10px 7px 8px 8px;
    border-bottom: 1px solid var(--header-divider-color, var(--content-file-border-color));
    box-sizing: border-box;
  }

  /* header 栏搜索框 */
  .header .search {
    flex: 1 1 212px;
    max-width: 360px;
    min-width: 0;
  }

  .header .search-wrapper {
    display: flex;
    align-items: center;
    height: 28px;
    padding: 0 7px;
    border-radius: 8px;
    box-sizing: border-box;
    background-color: var(--header-search-background-color);
    box-shadow: 0 0 0 1px var(--header-search-border-color) inset;
  }

  .header .search-wrapper:hover,
  .header .search-wrapper:focus-within {
    box-shadow: 0 0 0 1px var(--header-search-hover-border-color) inset;
  }

  .header .search-input {
    flex: 1 1 auto;
    min-width: 0;
    height: 26px;
    line-height: 26px;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 13px;
    font-family: inherit;
    color: var(--header-search-color);
  }

  .header .search-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 4px;
    font-size: 14px;
    color: var(--header-icon-color);
    flex-shrink: 0;
  }

  .header .search-clear-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-left: 4px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(144, 147, 153, .22);
    color: var(--header-search-color);
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color .15s ease;
  }

  .header .search-clear-btn:hover {
    background: rgba(144, 147, 153, .38);
  }

  .header .header-operator {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
  }

  .header .header-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    cursor: pointer;
    vertical-align: middle;
    border-radius: 8px;
    box-sizing: border-box;
    color: var(--header-icon-color);
    box-shadow: inset 0 0 0 1px transparent;
    transition: background-color .18s ease, box-shadow .18s ease, color .18s ease;
  }

  .header .header-button:hover,
  .header .header-button:focus-visible {
    background-color: rgba(127, 127, 127, 0.12);
    box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.18);
    color: var(--header-icon-hover-color);
  }

  .header .header-button:active {
    background-color: rgba(127, 127, 127, 0.18);
    box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.24);
  }

  .header :global(.icon-button) {
    font-size: 19px;
    color: inherit;
  }

  /* 显示手动下载文件弹框时的遮蔽层 */
  .musk {
    z-index: 100;
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    opacity: .2;
    background: var(--popover-musk-background-color);
  }

  /* 手动新建下载弹框 */
  .open-download-popover {
    position: fixed;
    left: 4px;
    z-index: 110;
    padding: 8px;
    box-sizing: border-box;
    border-radius: 8px;
    background-color: var(--header-dropdown-menu-background-color);
    border: 1px solid var(--header-dropdown-menu-border-color);
    box-shadow: 0 8px 24px rgba(0, 0, 0, .16);
    animation: popupPopIn .12s ease-out;
  }

  @keyframes popupPopIn {
    from {
      opacity: 0;
      transform: translateY(-2px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .popover-arrow {
    position: absolute;
    top: -5px;
    width: 8px;
    height: 8px;
    background-color: var(--header-dropdown-menu-background-color);
    border-top: 1px solid var(--header-dropdown-menu-border-color);
    border-left: 1px solid var(--header-dropdown-menu-border-color);
    transform: translateX(-50%) rotate(45deg);
    pointer-events: none;
  }

  .popover-textarea-wrap {
    position: relative;
    width: 100%;
  }

  .popover-textarea {
    display: block;
    width: 100%;
    min-height: 31px;
    max-height: 94px;
    padding: 5px 24px 5px 11px;
    border-radius: 8px;
    border: 1px solid var(--header-search-border-color, #dcdfe6);
    outline: none;
    resize: none;
    box-sizing: border-box;
    font-size: 14px;
    line-height: 1.5;
    font-family: inherit;
    color: var(--popover-textarea-color);
    background-color: var(--popover-textarea-background-color);
    transition: border-color .16s ease;
  }

  .popover-textarea:focus {
    border-color: var(--popover-textarea-focus-border-color);
  }

  .popover-textarea::placeholder {
    color: var(--popover-textarea-placeholder-color);
    font-size: 14px;
  }

  .popover-textarea::-webkit-scrollbar {
    width: 5px;
    background-color: transparent;
  }

  .popover-textarea::-webkit-scrollbar-thumb {
    background-color: rgba(144, 147, 153, .3);
    border-radius: 4px;
  }

  .popover-textarea::-webkit-scrollbar-thumb:window-inactive {
    background-color: rgba(157, 165, 183, 0.7);
  }

  .textarea-clear-btn {
    position: absolute;
    top: 7px;
    right: 6px;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(144, 147, 153, .22);
    color: var(--popover-textarea-color);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .textarea-clear-btn:hover {
    background: rgba(144, 147, 153, .38);
  }

  /* 下拉菜单 */
  .header-dropdown-menu {
    position: fixed;
    z-index: 120;
    padding: 5px;
    min-width: 118px;
    border-radius: 8px;
    background-color: var(--header-dropdown-menu-background-color);
    border: 1px solid var(--header-dropdown-menu-border-color);
    box-shadow: 0 8px 24px rgba(0, 0, 0, .16);
    display: flex;
    flex-direction: column;
    opacity: 0;
    transform: translateY(-2px) scale(0.98);
    transition: opacity .12s ease, transform .12s ease;
  }

  .header-dropdown-menu.is-ready {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .dropdown-arrow {
    position: absolute;
    top: -5px;
    width: 8px;
    height: 8px;
    background-color: var(--header-dropdown-menu-background-color);
    border-top: 1px solid var(--header-dropdown-menu-border-color);
    border-left: 1px solid var(--header-dropdown-menu-border-color);
    transform: translateX(-50%) rotate(45deg);
    pointer-events: none;
  }

  .dropdown-item {
    display: block;
    width: 100%;
    border: none;
    outline: none;
    border-radius: 5px;
    background: transparent;
    text-align: left;
    line-height: 30px;
    padding: 0 11px;
    margin: 0;
    font-size: 13px;
    font-family: inherit;
    white-space: nowrap;
    cursor: pointer;
    color: var(--header-dropdown-menu-item-color);
    box-sizing: border-box;
    transition: background-color .14s ease, color .14s ease;
  }

  .dropdown-item:not(.is-disabled):hover,
  .dropdown-item:not(.is-disabled):focus-visible {
    background-color: var(--header-dropdown-menu-item-hover-background-color);
    color: var(--header-dropdown-menu-item-hover-color);
  }

  .dropdown-item.is-danger {
    color: var(--header-dropdown-menu-item-danger-color, #d93025);
  }

  .dropdown-item.is-danger:not(.is-disabled):hover,
  .dropdown-item.is-danger:not(.is-disabled):focus-visible {
    background-color: var(--header-dropdown-menu-item-danger-hover-background-color, rgba(217, 48, 37, 0.08));
    color: var(--header-dropdown-menu-item-danger-color, #d93025);
  }

  .dropdown-item.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .dropdown-divider {
    height: 0;
    margin: 4px 0;
    border-top: 1px solid var(--header-dropdown-menu-border-color);
  }

  /* 下载内容区域 */
  .content {
    position: relative;
    height: calc(100% - 62px);
    margin: 12px 0 0 7px;
  }

  .empty-state {
    position: absolute;
    inset: 0 8px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    color: var(--content-file-filename-gray-color);
  }

  .empty-state-illustration {
    width: clamp(252px, 66%, 300px);
    height: auto;
    filter: var(--empty-state-illustration-filter, none);
    opacity: var(--empty-state-illustration-opacity, 1);
  }

  /* 返回顶部按钮 */
  .backtop-button {
    position: fixed;
    right: 16px;
    bottom: 20px;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid var(--popover-border-color, rgba(0, 0, 0, .08));
    border-radius: 50%;
    background-color: var(--popover-background-color, #ffffff);
    color: var(--content-file-filename-color, #409eff);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, .18);
    cursor: pointer;
    z-index: 5;
    transition: background-color .16s ease, transform .16s ease;
  }

  .backtop-button:hover {
    background-color: var(--content-file-hover-background-color, var(--popover-background-color, #f2f6fc));
    transform: translateY(-1px);
  }

  @media (prefers-reduced-motion: reduce) {
    .open-download-popover,
    .header-dropdown-menu,
    .backtop-button {
      animation: none;
      transition: none;
    }
  }

  /* 确认弹窗 */
  .delete-confirm-overlay {
    position: fixed;
    inset: 0;
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    box-sizing: border-box;
    background-color: rgba(0, 0, 0, .24);
  }

  .delete-confirm-dialog {
    width: min(320px, 100%);
    display: grid;
    grid-template-columns: 34px 1fr;
    column-gap: 10px;
    row-gap: 14px;
    padding: 16px;
    border: 1px solid var(--popover-border-color);
    border-radius: 8px;
    box-sizing: border-box;
    color: var(--popover-color);
    background-color: var(--popover-background-color);
    box-shadow: 0 10px 28px rgba(0, 0, 0, .18);
  }

  .delete-confirm-icon {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    color: var(--delete-confirm-danger-color, var(--header-dropdown-menu-item-danger-color, #d93025));
    background-color: var(--delete-confirm-danger-background-color, rgba(217, 48, 37, .10));
  }

  .delete-confirm-content h2 {
    margin: 0 0 6px;
    line-height: 20px;
    font-size: 14px;
    font-weight: 600;
    color: var(--popover-color);
  }

  .delete-confirm-content p {
    margin: 0;
    line-height: 18px;
    font-size: 12px;
    color: var(--content-file-url-color, var(--popover-color));
    word-break: break-word;
  }

  .delete-confirm-actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .delete-confirm-button {
    min-width: 64px;
    height: 28px;
    padding: 0 12px;
    border-radius: 6px;
    border: 1px solid var(--popover-border-color);
    font-size: 12px;
    line-height: 26px;
    font-family: inherit;
    cursor: pointer;
    transition: background-color .18s ease, border-color .18s ease, color .18s ease;
  }

  .delete-confirm-button.secondary {
    color: var(--popover-color);
    background-color: var(--popover-background-color);
  }

  .delete-confirm-button.secondary:hover {
    color: var(--popover-color);
    background-color: rgba(127, 127, 127, .12);
  }

  .delete-confirm-button.danger {
    color: #fff;
    border-color: var(--delete-confirm-danger-color, #d93025);
    background-color: var(--delete-confirm-danger-color, #d93025);
  }

  .delete-confirm-button.danger:hover {
    border-color: var(--delete-confirm-danger-hover-color, #b3261e);
    background-color: var(--delete-confirm-danger-hover-color, #b3261e);
  }

  .delete-confirm-button.primary {
    color: #fff;
    border-color: var(--download-confirm-primary-color, #1d6fe2);
    background-color: var(--download-confirm-primary-color, #1d6fe2);
  }

  .delete-confirm-button.primary:hover {
    border-color: var(--download-confirm-primary-hover-color, #155ec4);
    background-color: var(--download-confirm-primary-hover-color, #155ec4);
  }

  .download-confirm-icon {
    color: var(--download-confirm-primary-color, var(--content-file-filename-color, #1d6fe2));
    background-color: var(--download-confirm-primary-background-color, rgba(64, 158, 255, .12));
  }

  .download-confirm-message {
    word-break: break-all;
  }
</style>
