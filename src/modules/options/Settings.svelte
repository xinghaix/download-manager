<script>
  import { onMount } from 'svelte'
  import Icon from '../../components/Icon.svelte'
  import Switch from '../../components/Switch.svelte'
  import TagInput from '../../components/TagInput.svelte'
  import Popconfirm from '../../components/Popconfirm.svelte'
  import FloatingTooltip from '../../components/FloatingTooltip.svelte'
  import storage from '../../utils/storage'
  import common from '../../utils/common'
  import {
    POPUP_HEADER_BUTTON_KEYS,
    normalizePopupHeaderButtons,
    normalizePopupHeaderButtonsOrder
  } from '../../utils/popupHeaderButtons'
  import {
    cloneDefaultDownloadFileRoutingRules,
    DEFAULT_DOWNLOAD_ROUTING_PRECEDENCE,
    normalizeDownloadDomainRoutingRules,
    normalizeDownloadFileRoutingRules,
    normalizeDownloadRoutingPrecedence,
    normalizeFolderPath,
    parseDomains,
    parseExtensions
  } from '../../utils/downloadFileRouting'

  let { i18data } = $props()

  const CHROME_SHORTCUT_URL = 'chrome://extensions/shortcuts'
  const SETTINGS_KEYS = [
    'left_click_file',
    'right_click_file',
    'left_click_url',
    'right_click_url',
    'close_tooltip',
    'enable_animation',
    'show_download_progress',
    'delete_file_confirm',
    'download_confirm_before_start',
    'download_confirm_choose_folder',
    'popup_header_buttons_visible',
    'popup_header_buttons',
    'popup_header_buttons_order',
    'download_context_menus',
    'download_context_menu_contexts',
    'download_file_routing_enabled',
    'download_file_routing_rules',
    'download_domain_routing_rules',
    'download_routing_precedence',
    'download_started_notification',
    'download_completed_notification',
    'download_warning_notification',
    'download_started_tone',
    'download_completed_tone',
    'download_warning_tone',
    'download_notification_reserved_time',
    'download_notification_max_count',
    'download_notification_remain_visible',
    'sync'
  ]

  let show = $state(false)

  // 下载设置
  let leftClickFile = $state(true)
  let rightClickFile = $state(true)
  let leftClickUrl = $state(true)
  let rightClickUrl = $state(true)
  let showTooltip = $state(false)
  let enableAnimation = $state(false)
  let showDownloadProgress = $state(true)
  let deleteFileConfirm = $state(true)
  let downloadConfirmBeforeStart = $state(false)
  let downloadConfirmChooseFolder = $state(false)
  let popupHeaderButtonsVisible = $state(true)
  let popupHeaderButtons = $state([...POPUP_HEADER_BUTTON_KEYS])
  let popupHeaderButtonsOrder = $state([...POPUP_HEADER_BUTTON_KEYS])
  let draggingHeaderButtonKey = $state(null)
  let headerButtonOrderChanged = false

  const popupHeaderButtonMeta = $derived({
    newDownload: { key: 'newDownload', icon: 'Download', label: i18data.newDownload },
    clear: { key: 'clear', icon: 'Brush', label: i18data.clearAll },
    batchActions: { key: 'batchActions', icon: 'VideoPause', label: i18data.batchDownloadActions },
    openFolder: { key: 'openFolder', icon: 'FolderOpened', label: i18data.openDownloadFolder },
    openHome: { key: 'openHome', icon: 'Position', label: i18data.openHome }
  })

  const popupHeaderButtonOptions = $derived(
    popupHeaderButtonsOrder.map(key => popupHeaderButtonMeta[key]).filter(Boolean)
  )

  // 上下文菜单
  let downloadContextMenus = $state(true)
  let downloadContextMenuLink = $state(true)
  let downloadContextMenuImage = $state(true)
  let downloadContextMenuAudio = $state(true)
  let downloadContextMenuVideo = $state(true)

  // 文件分类下载
  let downloadFileRoutingEnabled = $state(false)
  let downloadFileRoutingRules = $state([])
  let downloadDomainRoutingRules = $state([])
  let downloadRoutingPrecedence = $state(DEFAULT_DOWNLOAD_ROUTING_PRECEDENCE)

  // 通知设置
  let downloadStartedNotification = $state(false)
  let downloadCompletedNotification = $state(false)
  let downloadWarningNotification = $state(false)
  let downloadStartedTone = $state(false)
  let downloadCompletedTone = $state(false)
  let downloadWarningTone = $state(false)
  let downloadNotificationReservedTime = $state(10)
  let downloadNotificationMaxCount = $state(3)
  let downloadNotificationRemainVisible = $state(false)

  // 快捷键设置
  let openPopupShortcut = $state('Alt+X')

  // 同步设置
  let isSync = $state(true)
  let chromeVersionGreaterThan50 = $state(true)

  // Tooltip 状态
  let tooltip = $state({
    visible: false,
    content: '',
    triggerEl: null
  })

  // 非响应式内部控制状态
  let initializing = true
  let syncTransitioning = false
  let contextMenuPersistQueue = Promise.resolve()
  let fileRoutingPersistTimer = null
  let fileRoutingPersistQueue = Promise.resolve()
  let domainRoutingPersistTimer = null
  let domainRoutingPersistQueue = Promise.resolve()

  onMount(() => {
    ;(async () => {
      try {
        const [settings, shortcut] = await Promise.all([
          storage.getMany(SETTINGS_KEYS),
          getOpenPopupShortcut()
        ])

        leftClickFile = typeof settings.left_click_file === 'boolean' ? settings.left_click_file : true
        rightClickFile = typeof settings.right_click_file === 'boolean' ? settings.right_click_file : true
        leftClickUrl = typeof settings.left_click_url === 'boolean' ? settings.left_click_url : true
        rightClickUrl = typeof settings.right_click_url === 'boolean' ? settings.right_click_url : true
        showTooltip = typeof settings.close_tooltip === 'boolean' ? !settings.close_tooltip : false
        enableAnimation = typeof settings.enable_animation === 'boolean' ? settings.enable_animation : false
        showDownloadProgress = typeof settings.show_download_progress === 'boolean' ? settings.show_download_progress : true
        deleteFileConfirm = typeof settings.delete_file_confirm === 'boolean' ? settings.delete_file_confirm : true
        downloadConfirmBeforeStart = typeof settings.download_confirm_before_start === 'boolean' ? settings.download_confirm_before_start : false
        downloadConfirmChooseFolder = typeof settings.download_confirm_choose_folder === 'boolean' ? settings.download_confirm_choose_folder : false
        popupHeaderButtonsVisible = typeof settings.popup_header_buttons_visible === 'boolean' ? settings.popup_header_buttons_visible : true
        popupHeaderButtonsOrder = normalizePopupHeaderButtonsOrder(settings.popup_header_buttons_order)
        popupHeaderButtons = normalizePopupHeaderButtons(settings.popup_header_buttons, popupHeaderButtonsOrder)

        downloadContextMenus = typeof settings.download_context_menus === 'boolean' ? settings.download_context_menus : true
        applyContextMenuContexts(settings.download_context_menu_contexts)

        downloadFileRoutingEnabled = typeof settings.download_file_routing_enabled === 'boolean' ? settings.download_file_routing_enabled : false
        downloadFileRoutingRules = normalizeDownloadFileRoutingRules(settings.download_file_routing_rules)
        downloadDomainRoutingRules = normalizeDownloadDomainRoutingRules(settings.download_domain_routing_rules)
        downloadRoutingPrecedence = normalizeDownloadRoutingPrecedence(settings.download_routing_precedence)

        downloadStartedNotification = typeof settings.download_started_notification === 'boolean' ? settings.download_started_notification : false
        downloadCompletedNotification = typeof settings.download_completed_notification === 'boolean' ? settings.download_completed_notification : false
        downloadWarningNotification = typeof settings.download_warning_notification === 'boolean' ? settings.download_warning_notification : false
        downloadStartedTone = typeof settings.download_started_tone === 'boolean' ? settings.download_started_tone : false
        downloadCompletedTone = typeof settings.download_completed_tone === 'boolean' ? settings.download_completed_tone : false
        downloadWarningTone = typeof settings.download_warning_tone === 'boolean' ? settings.download_warning_tone : false

        const reservedTime = settings.download_notification_reserved_time
        downloadNotificationReservedTime = Number.isFinite(Number(reservedTime)) ? Number(reservedTime) : 10

        const maxCount = settings.download_notification_max_count
        downloadNotificationMaxCount = Number.isFinite(Number(maxCount))
          ? Math.max(0, Math.min(50, Math.floor(Number(maxCount))))
          : 3

        downloadNotificationRemainVisible = typeof settings.download_notification_remain_visible === 'boolean'
          ? settings.download_notification_remain_visible
          : false

        openPopupShortcut = shortcut
        isSync = typeof settings.sync === 'boolean' ? settings.sync : true
        chromeVersionGreaterThan50 = common.chromeVersionGreaterThan(50)
      } catch (e) {
        console.warn('Failed to initialize Settings page', e)
      } finally {
        initializing = false
        show = true
      }
    })()

    return () => {
      if (!initializing && fileRoutingPersistTimer) {
        clearTimeout(fileRoutingPersistTimer)
        fileRoutingPersistTimer = null
        storage.set('download_file_routing_rules', getNormalizedFileRoutingRulesForPersist())
      }
      if (!initializing && domainRoutingPersistTimer) {
        clearTimeout(domainRoutingPersistTimer)
        domainRoutingPersistTimer = null
        storage.set('download_domain_routing_rules', getNormalizedDomainRoutingRulesForPersist())
      }
    }
  })

  async function persistSetting(key, value) {
    if (initializing || syncTransitioning) {
      return
    }
    await storage.set(key, value)
  }

  async function handleSyncChange(val) {
    if (initializing || syncTransitioning) {
      return
    }
    const previous = !val
    isSync = val
    syncTransitioning = true
    try {
      await storage.switchStorageMode(val)
    } catch (e) {
      console.warn('Failed to switch storage mode', e)
      isSync = previous
    } finally {
      syncTransitioning = false
    }
  }

  // 下载设置变更处理
  function updateLeftClickFile(val) { leftClickFile = val; persistSetting('left_click_file', val) }
  function updateRightClickFile(val) { rightClickFile = val; persistSetting('right_click_file', val) }
  function updateLeftClickUrl(val) { leftClickUrl = val; persistSetting('left_click_url', val) }
  function updateRightClickUrl(val) { rightClickUrl = val; persistSetting('right_click_url', val) }
  function updateShowTooltip(val) { showTooltip = val; persistSetting('close_tooltip', !val) }
  function updateEnableAnimation(val) { enableAnimation = val; persistSetting('enable_animation', val) }
  function updateShowDownloadProgress(val) { showDownloadProgress = val; persistSetting('show_download_progress', val) }
  function updateDeleteFileConfirm(val) { deleteFileConfirm = val; persistSetting('delete_file_confirm', val) }
  function updateDownloadConfirmBeforeStart(val) { downloadConfirmBeforeStart = val; persistSetting('download_confirm_before_start', val) }
  function updateDownloadConfirmChooseFolder(val) { downloadConfirmChooseFolder = val; persistSetting('download_confirm_choose_folder', val) }
  function updatePopupHeaderButtonsVisible(val) {
    popupHeaderButtonsVisible = val
    persistSetting('popup_header_buttons_visible', val)
  }
  function togglePopupHeaderButton(key) {
    if (!popupHeaderButtonsVisible) {
      return
    }
    const exists = popupHeaderButtons.includes(key)
    const next = normalizePopupHeaderButtons(
      exists ? popupHeaderButtons.filter(item => item !== key) : [...popupHeaderButtons, key],
      popupHeaderButtonsOrder
    )
    popupHeaderButtons = next
    persistSetting('popup_header_buttons', next)
  }

  function handleHeaderButtonDragStart(event, key) {
    if (!popupHeaderButtonsVisible) {
      event.preventDefault()
      return
    }
    draggingHeaderButtonKey = key
    headerButtonOrderChanged = false
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', key)
    }
  }

  function handleHeaderButtonDragOver(event, targetKey) {
    if (!popupHeaderButtonsVisible || !draggingHeaderButtonKey) {
      return
    }
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
    if (draggingHeaderButtonKey === targetKey) {
      return
    }

    const fromIndex = popupHeaderButtonsOrder.indexOf(draggingHeaderButtonKey)
    const toIndex = popupHeaderButtonsOrder.indexOf(targetKey)
    if (fromIndex === -1 || toIndex === -1) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const midpoint = rect.left + rect.width / 2
    if ((fromIndex < toIndex && event.clientX <= midpoint) || (fromIndex > toIndex && event.clientX >= midpoint)) {
      return
    }

    const nextOrder = [...popupHeaderButtonsOrder]
    const [moved] = nextOrder.splice(fromIndex, 1)
    nextOrder.splice(toIndex, 0, moved)
    popupHeaderButtonsOrder = nextOrder
    popupHeaderButtons = normalizePopupHeaderButtons(popupHeaderButtons, nextOrder)
    headerButtonOrderChanged = true
  }

  function handleHeaderButtonDrop(event) {
    event.preventDefault()
  }

  function handleHeaderButtonDragEnd() {
    draggingHeaderButtonKey = null
    if (headerButtonOrderChanged) {
      headerButtonOrderChanged = false
      const normalizedOrder = [...popupHeaderButtonsOrder]
      const normalizedEnabled = normalizePopupHeaderButtons(popupHeaderButtons, normalizedOrder)
      popupHeaderButtons = normalizedEnabled
      persistSetting('popup_header_buttons_order', normalizedOrder)
      persistSetting('popup_header_buttons', normalizedEnabled)
    }
  }

  // 上下文菜单设置
  async function updateDownloadContextMenus(val) {
    downloadContextMenus = val
    await persistSetting('download_context_menus', val)
    if (initializing || syncTransitioning) {
      return
    }
    notifyContextMenusChanged(val)
  }

  function applyContextMenuContexts(contexts) {
    const selected = Array.isArray(contexts) ? contexts : ['link', 'image', 'audio', 'video']
    const set = new Set(selected)
    downloadContextMenuLink = set.has('link')
    downloadContextMenuImage = set.has('image')
    downloadContextMenuAudio = set.has('audio')
    downloadContextMenuVideo = set.has('video')
    if (!downloadContextMenuLink && !downloadContextMenuImage && !downloadContextMenuAudio && !downloadContextMenuVideo) {
      downloadContextMenuLink = true
      downloadContextMenuImage = true
      downloadContextMenuAudio = true
      downloadContextMenuVideo = true
    }
  }

  function getRawSelectedContextMenuContexts() {
    const contexts = []
    if (downloadContextMenuLink) contexts.push('link')
    if (downloadContextMenuImage) contexts.push('image')
    if (downloadContextMenuAudio) contexts.push('audio')
    if (downloadContextMenuVideo) contexts.push('video')
    return contexts
  }

  function isOnlySelectedContext(context) {
    const selected = getRawSelectedContextMenuContexts()
    return selected.length === 1 && selected[0] === context
  }

  function getSelectedContextMenuContexts() {
    const contexts = getRawSelectedContextMenuContexts()
    return contexts.length ? contexts : ['link', 'image', 'audio', 'video']
  }

  function toggleContextMenuContext(context) {
    if (!downloadContextMenus || isOnlySelectedContext(context)) {
      return
    }
    if (context === 'link') downloadContextMenuLink = !downloadContextMenuLink
    else if (context === 'image') downloadContextMenuImage = !downloadContextMenuImage
    else if (context === 'audio') downloadContextMenuAudio = !downloadContextMenuAudio
    else if (context === 'video') downloadContextMenuVideo = !downloadContextMenuVideo
    persistContextMenuContexts()
  }

  async function persistContextMenuContexts() {
    if (initializing || syncTransitioning) {
      return
    }

    const rawSelected = getRawSelectedContextMenuContexts()
    if (!rawSelected.length) {
      applyContextMenuContexts(['link', 'image', 'audio', 'video'])
    }

    const contexts = getSelectedContextMenuContexts()
    contextMenuPersistQueue = contextMenuPersistQueue
      .catch(() => {})
      .then(async () => {
        await storage.set('download_context_menu_contexts', contexts)
        if (downloadContextMenus) {
          notifyContextMenusChanged(true, 'downloadMenuContexts')
        }
      })

    await contextMenuPersistQueue
  }

  function notifyContextMenusChanged(enabled, type = 'downloadMenus') {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return
    }
    chrome.runtime.sendMessage(JSON.stringify({
      type,
      data: enabled
    }), () => {
      if (chrome.runtime.lastError) {
        // 静默处理连接错误
      }
    })
  }

  // 文件分类下载设置
  function updateFileRoutingEnabled(val) {
    downloadFileRoutingEnabled = val
    persistSetting('download_file_routing_enabled', val)
  }

  function updateRoutingPrecedence(val) {
    if (!downloadFileRoutingEnabled) {
      return
    }
    const normalized = normalizeDownloadRoutingPrecedence(val)
    downloadRoutingPrecedence = normalized
    persistSetting('download_routing_precedence', normalized)
  }

  function isFileRoutingRuleFolderValid(rule) {
    return Boolean(normalizeFolderPath(rule && rule.folder))
  }

  // 域名规则
  function addDomainRoutingRule() {
    discardIncompleteNewDomainRoutingRules()
    downloadDomainRoutingRules.push({
      id: `domain-custom-${Date.now()}`,
      isNew: true,
      enabled: true,
      folder: '',
      domains: []
    })
    scheduleDomainRoutingRulesPersist()
  }

  function deleteDomainRoutingRule(id) {
    downloadDomainRoutingRules = downloadDomainRoutingRules.filter(rule => rule.id !== id)
    flushDomainRoutingRules()
  }

  function isDomainRoutingRuleDomainsValid(rule) {
    return parseDomains(rule && rule.domains).length > 0
  }

  function isDomainRoutingRuleIncomplete(rule) {
    return !isFileRoutingRuleFolderValid(rule) || !isDomainRoutingRuleDomainsValid(rule)
  }

  function isExistingDomainRoutingRuleInvalid(rule) {
    return Boolean(rule && !rule.isNew && isDomainRoutingRuleIncomplete(rule))
  }

  function disableIncompleteExistingDomainRoutingRule(rule) {
    if (isExistingDomainRoutingRuleInvalid(rule) && rule.enabled !== false) {
      rule.enabled = false
    }
  }

  function tryCommitNewDomainRoutingRule(rule) {
    if (rule && rule.isNew && !isDomainRoutingRuleIncomplete(rule)) {
      rule.isNew = false
    }
  }

  function discardIncompleteNewDomainRoutingRules() {
    downloadDomainRoutingRules = downloadDomainRoutingRules.filter(rule => {
      return !rule.isNew || !isDomainRoutingRuleIncomplete(rule)
    })
  }

  function updateDomainRuleDomains(rule, value) {
    rule.domains = parseDomains(value)
    disableIncompleteExistingDomainRoutingRule(rule)
    tryCommitNewDomainRoutingRule(rule)
    scheduleDomainRoutingRulesPersist()
  }

  function handleDomainRuleFolderInput(rule, event) {
    rule.folder = event.currentTarget.value
    disableIncompleteExistingDomainRoutingRule(rule)
    scheduleDomainRoutingRulesPersist()
  }

  function handleDomainRuleFolderBlur(rule) {
    rule.folder = normalizeFolderPath(rule.folder)
    disableIncompleteExistingDomainRoutingRule(rule)
    tryCommitNewDomainRoutingRule(rule)
    flushDomainRoutingRules()
  }

  function handleDomainRuleDomainsChange(rule) {
    disableIncompleteExistingDomainRoutingRule(rule)
    tryCommitNewDomainRoutingRule(rule)
    flushDomainRoutingRules()
  }

  function handleDomainRuleDomainsBlur(rule) {
    disableIncompleteExistingDomainRoutingRule(rule)
    tryCommitNewDomainRoutingRule(rule)
    flushDomainRoutingRules()
  }

  function handleDomainRuleFocusOut(rule, event) {
    const nextTarget = event.relatedTarget
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return
    }
    if (rule.isNew && isDomainRoutingRuleIncomplete(rule)) {
      deleteDomainRoutingRule(rule.id)
    }
  }

  function getNormalizedDomainRoutingRulesForPersist() {
    const rules = downloadDomainRoutingRules.filter(rule => {
      return !rule.isNew || !isDomainRoutingRuleIncomplete(rule)
    })
    rules.forEach(rule => disableIncompleteExistingDomainRoutingRule(rule))
    return normalizeDownloadDomainRoutingRules(rules)
  }

  function scheduleDomainRoutingRulesPersist() {
    if (initializing || syncTransitioning) {
      return
    }
    if (domainRoutingPersistTimer) {
      clearTimeout(domainRoutingPersistTimer)
    }
    domainRoutingPersistTimer = setTimeout(() => {
      domainRoutingPersistTimer = null
      persistDomainRoutingRules()
    }, 500)
  }

  function flushDomainRoutingRules() {
    return persistDomainRoutingRules()
  }

  async function persistDomainRoutingRules() {
    if (initializing || syncTransitioning) {
      return
    }
    if (domainRoutingPersistTimer) {
      clearTimeout(domainRoutingPersistTimer)
      domainRoutingPersistTimer = null
    }
    const rules = getNormalizedDomainRoutingRulesForPersist()
    domainRoutingPersistQueue = domainRoutingPersistQueue
      .catch(() => {})
      .then(() => storage.set('download_domain_routing_rules', rules))
    await domainRoutingPersistQueue
  }

  // 扩展名规则
  function addFileRoutingRule() {
    discardIncompleteNewFileRoutingRules()
    downloadFileRoutingRules.push({
      id: `custom-${Date.now()}`,
      isNew: true,
      enabled: true,
      folder: '',
      extensions: []
    })
    scheduleFileRoutingRulesPersist()
  }

  function deleteFileRoutingRule(id) {
    downloadFileRoutingRules = downloadFileRoutingRules.filter(rule => rule.id !== id)
    flushFileRoutingRules()
  }

  function resetFileRoutingRules() {
    downloadFileRoutingRules = cloneDefaultDownloadFileRoutingRules()
    flushFileRoutingRules()
  }

  function isFileRoutingRuleExtensionsValid(rule) {
    return parseExtensions(rule && rule.extensions).length > 0
  }

  function isFileRoutingRuleIncomplete(rule) {
    return !isFileRoutingRuleFolderValid(rule) || !isFileRoutingRuleExtensionsValid(rule)
  }

  function isExistingFileRoutingRuleInvalid(rule) {
    return Boolean(rule && !rule.isNew && isFileRoutingRuleIncomplete(rule))
  }

  function disableIncompleteExistingFileRoutingRule(rule) {
    if (isExistingFileRoutingRuleInvalid(rule) && rule.enabled !== false) {
      rule.enabled = false
    }
  }

  function tryCommitNewFileRoutingRule(rule) {
    if (rule && rule.isNew && !isFileRoutingRuleIncomplete(rule)) {
      rule.isNew = false
    }
  }

  function discardIncompleteNewFileRoutingRules() {
    downloadFileRoutingRules = downloadFileRoutingRules.filter(rule => {
      return !rule.isNew || !isFileRoutingRuleIncomplete(rule)
    })
  }

  function updateRuleExtensions(rule, value) {
    rule.extensions = parseExtensions(value)
    disableIncompleteExistingFileRoutingRule(rule)
    tryCommitNewFileRoutingRule(rule)
    scheduleFileRoutingRulesPersist()
  }

  function handleRuleFolderInput(rule, event) {
    rule.folder = event.currentTarget.value
    disableIncompleteExistingFileRoutingRule(rule)
    scheduleFileRoutingRulesPersist()
  }

  function handleRuleFolderBlur(rule) {
    rule.folder = normalizeFolderPath(rule.folder)
    disableIncompleteExistingFileRoutingRule(rule)
    tryCommitNewFileRoutingRule(rule)
    flushFileRoutingRules()
  }

  function handleRuleExtensionsChange(rule) {
    disableIncompleteExistingFileRoutingRule(rule)
    tryCommitNewFileRoutingRule(rule)
    flushFileRoutingRules()
  }

  function handleRuleExtensionsBlur(rule) {
    disableIncompleteExistingFileRoutingRule(rule)
    tryCommitNewFileRoutingRule(rule)
    flushFileRoutingRules()
  }

  function handleRuleFocusOut(rule, event) {
    const nextTarget = event.relatedTarget
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return
    }
    if (rule.isNew && isFileRoutingRuleIncomplete(rule)) {
      deleteFileRoutingRule(rule.id)
    }
  }

  function getNormalizedFileRoutingRulesForPersist() {
    const rules = downloadFileRoutingRules.filter(rule => {
      return !rule.isNew || !isFileRoutingRuleIncomplete(rule)
    })
    rules.forEach(rule => disableIncompleteExistingFileRoutingRule(rule))
    return normalizeDownloadFileRoutingRules(rules)
  }

  function scheduleFileRoutingRulesPersist() {
    if (initializing || syncTransitioning) {
      return
    }
    if (fileRoutingPersistTimer) {
      clearTimeout(fileRoutingPersistTimer)
    }
    fileRoutingPersistTimer = setTimeout(() => {
      fileRoutingPersistTimer = null
      persistFileRoutingRules()
    }, 500)
  }

  function flushFileRoutingRules() {
    return persistFileRoutingRules()
  }

  async function persistFileRoutingRules() {
    if (initializing || syncTransitioning) {
      return
    }
    if (fileRoutingPersistTimer) {
      clearTimeout(fileRoutingPersistTimer)
      fileRoutingPersistTimer = null
    }
    const rules = getNormalizedFileRoutingRulesForPersist()
    fileRoutingPersistQueue = fileRoutingPersistQueue
      .catch(() => {})
      .then(() => storage.set('download_file_routing_rules', rules))
    await fileRoutingPersistQueue
  }

  // 通知设置
  function toggleStartedNotification() {
    downloadStartedNotification = !downloadStartedNotification
    persistSetting('download_started_notification', downloadStartedNotification)
  }
  function toggleCompletedNotification() {
    downloadCompletedNotification = !downloadCompletedNotification
    persistSetting('download_completed_notification', downloadCompletedNotification)
  }
  function toggleWarningNotification() {
    downloadWarningNotification = !downloadWarningNotification
    persistSetting('download_warning_notification', downloadWarningNotification)
  }
  function toggleStartedTone() {
    downloadStartedTone = !downloadStartedTone
    persistSetting('download_started_tone', downloadStartedTone)
  }
  function toggleCompletedTone() {
    downloadCompletedTone = !downloadCompletedTone
    persistSetting('download_completed_tone', downloadCompletedTone)
  }
  function toggleWarningTone() {
    downloadWarningTone = !downloadWarningTone
    persistSetting('download_warning_tone', downloadWarningTone)
  }

  function handleReservedTimeInput(event) {
    const raw = Number(event.currentTarget.value)
    if (!Number.isFinite(raw)) {
      return
    }
    downloadNotificationReservedTime = raw
    if (raw <= 43200) {
      persistSetting('download_notification_reserved_time', raw)
    }
  }

  function commitReservedTime() {
    let val = Number(downloadNotificationReservedTime)
    if (!Number.isFinite(val)) {
      val = 10
    }
    if (val > 43200) {
      val = 43200
    }
    downloadNotificationReservedTime = val
    persistSetting('download_notification_reserved_time', val)
  }

  function handleMaxCountInput(event) {
    const raw = Number(event.currentTarget.value)
    if (!Number.isFinite(raw)) {
      return
    }
    downloadNotificationMaxCount = raw
    const normalized = Math.max(0, Math.min(50, Math.floor(raw)))
    if (normalized === raw) {
      persistSetting('download_notification_max_count', normalized)
    }
  }

  function commitMaxCount() {
    const val = Number(downloadNotificationMaxCount)
    const normalized = Number.isFinite(val) ? Math.max(0, Math.min(50, Math.floor(val))) : 3
    downloadNotificationMaxCount = normalized
    persistSetting('download_notification_max_count', normalized)
  }

  function updateRemainVisible(val) {
    if (!chromeVersionGreaterThan50) {
      return
    }
    downloadNotificationRemainVisible = val
    persistSetting('download_notification_remain_visible', val)
  }

  function getOpenPopupShortcut() {
    return new Promise(resolve => {
      if (!(typeof chrome !== 'undefined' && chrome.commands && chrome.commands.getAll)) {
        resolve('--')
        return
      }
      chrome.commands.getAll(commands => {
        if (commands) {
          for (const command of commands) {
            if (command && command.name === '_execute_action') {
              resolve(command.shortcut || '--')
              return
            }
          }
        }
        resolve('--')
      })
    })
  }

  function openUrl(url, event) {
    event?.preventDefault()
    chrome.tabs.create({ url })
  }

  function showInfoTooltip(event) {
    tooltip = {
      visible: true,
      content: i18data.notSyncSetting,
      triggerEl: event.currentTarget
    }
  }

  function hideInfoTooltip() {
    tooltip = {
      ...tooltip,
      visible: false
    }
  }
</script>

{#if show}
  <div class="home">
    <h2 class="title">{i18data.downloadSetting}</h2>
    <div class="box-card">
      <div class="card-body">
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => updateLeftClickFile(!leftClickFile)}>
            <span class="setting-title">{i18data.leftClickFileSetting}</span>
          </div>
          <div class="switch">
            <Switch checked={leftClickFile} ariaLabel={i18data.leftClickFileSetting} onchange={updateLeftClickFile} />
          </div>
        </div>
        <hr class="divider" />
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => updateRightClickFile(!rightClickFile)}>
            <span class="setting-title">{i18data.rightClickFileSetting}</span>
          </div>
          <div class="switch">
            <Switch checked={rightClickFile} ariaLabel={i18data.rightClickFileSetting} onchange={updateRightClickFile} />
          </div>
        </div>
        <hr class="divider" />
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => updateLeftClickUrl(!leftClickUrl)}>
            <div class="setting-title">{i18data.leftClickUrlSetting}</div>
          </div>
          <div class="switch">
            <Switch checked={leftClickUrl} ariaLabel={i18data.leftClickUrlSetting} onchange={updateLeftClickUrl} />
          </div>
        </div>
        <hr class="divider" />
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => updateRightClickUrl(!rightClickUrl)}>
            <span class="setting-title">{i18data.rightClickUrlSetting}</span>
          </div>
          <div class="switch">
            <Switch checked={rightClickUrl} ariaLabel={i18data.rightClickUrlSetting} onchange={updateRightClickUrl} />
          </div>
        </div>
        <hr class="divider" />
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => updateShowTooltip(!showTooltip)}>
            <span class="setting-title">{i18data.showTooltipSetting}</span>
          </div>
          <div class="switch">
            <Switch checked={showTooltip} ariaLabel={i18data.showTooltipSetting} onchange={updateShowTooltip} />
          </div>
        </div>
        <hr class="divider" />
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => updateEnableAnimation(!enableAnimation)}>
            <span class="setting-title">{i18data.enableAnimation}</span>
          </div>
          <div class="switch">
            <Switch checked={enableAnimation} ariaLabel={i18data.enableAnimation} onchange={updateEnableAnimation} />
          </div>
        </div>
        <hr class="divider" />
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => updateShowDownloadProgress(!showDownloadProgress)}>
            <span class="setting-title">{i18data.showDownloadProgressSetting}</span>
            <span class="setting-description">{i18data.showDownloadProgressDescSetting}</span>
          </div>
          <div class="switch">
            <Switch checked={showDownloadProgress} ariaLabel={i18data.showDownloadProgressSetting} onchange={updateShowDownloadProgress} />
          </div>
        </div>
        <hr class="divider" />
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => updateDeleteFileConfirm(!deleteFileConfirm)}>
            <span class="setting-title">{i18data.deleteFileConfirmSetting}</span>
            <span class="setting-description">{i18data.deleteFileConfirmDescSetting}</span>
          </div>
          <div class="switch">
            <Switch checked={deleteFileConfirm} ariaLabel={i18data.deleteFileConfirmSetting} onchange={updateDeleteFileConfirm} />
          </div>
        </div>
        <hr class="divider" />
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => updateDownloadConfirmBeforeStart(!downloadConfirmBeforeStart)}>
            <span class="setting-title">{i18data.downloadConfirmBeforeStartSetting}</span>
            <span class="setting-description">{i18data.downloadConfirmBeforeStartDescSetting}</span>
          </div>
          <div class="switch">
            <Switch checked={downloadConfirmBeforeStart} ariaLabel={i18data.downloadConfirmBeforeStartSetting} onchange={updateDownloadConfirmBeforeStart} />
          </div>
        </div>
        <hr class="divider" />
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => updateDownloadConfirmChooseFolder(!downloadConfirmChooseFolder)}>
            <span class="setting-title">{i18data.downloadConfirmChooseFolderSetting}</span>
            <span class="setting-description">{i18data.downloadConfirmChooseFolderDescSetting}</span>
          </div>
          <div class="switch">
            <Switch checked={downloadConfirmChooseFolder} ariaLabel={i18data.downloadConfirmChooseFolderSetting} onchange={updateDownloadConfirmChooseFolder} />
          </div>
        </div>
        <hr class="divider" />
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => updatePopupHeaderButtonsVisible(!popupHeaderButtonsVisible)}>
            <span class="setting-title">{i18data.popupHeaderButtonsSetting}</span>
            <span class="setting-description">{i18data.popupHeaderButtonsDescSetting}</span>
          </div>
          <div class="switch">
            <Switch checked={popupHeaderButtonsVisible} ariaLabel={i18data.popupHeaderButtonsSetting} onchange={updatePopupHeaderButtonsVisible} />
          </div>
        </div>
        <hr class="divider" />
        <div class="item header-buttons-row" class:is-disabled-row={!popupHeaderButtonsVisible}>
          <div class="header-buttons-copy">
            <span class="setting-title">{i18data.popupHeaderCustomButtonsSetting}</span>
            <span class="setting-description">{i18data.popupHeaderCustomButtonsDescSetting}</span>
          </div>
          <div class="header-btn-group" role="group" aria-label={i18data.popupHeaderCustomButtonsSetting}>
            {#each popupHeaderButtonOptions as opt (opt.key)}
              <button
                type="button"
                class="header-btn-toggle"
                class:is-checked={popupHeaderButtons.includes(opt.key)}
                class:is-dragging={draggingHeaderButtonKey === opt.key}
                aria-pressed={popupHeaderButtons.includes(opt.key)}
                disabled={!popupHeaderButtonsVisible}
                draggable={popupHeaderButtonsVisible}
                onclick={() => togglePopupHeaderButton(opt.key)}
                ondragstart={(e) => handleHeaderButtonDragStart(e, opt.key)}
                ondragover={(e) => handleHeaderButtonDragOver(e, opt.key)}
                ondrop={handleHeaderButtonDrop}
                ondragend={handleHeaderButtonDragEnd}
              >
                <svg class="header-btn-grip" viewBox="0 0 10 14" width="10" height="14" aria-hidden="true">
                  <circle cx="3" cy="3" r="1.1" fill="currentColor" />
                  <circle cx="7" cy="3" r="1.1" fill="currentColor" />
                  <circle cx="3" cy="7" r="1.1" fill="currentColor" />
                  <circle cx="7" cy="7" r="1.1" fill="currentColor" />
                  <circle cx="3" cy="11" r="1.1" fill="currentColor" />
                  <circle cx="7" cy="11" r="1.1" fill="currentColor" />
                </svg>
                <Icon name={opt.icon} size="14px" />
                <span>{opt.label}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <h2 class="title">{i18data.contextMenus}</h2>
    <div class="box-card">
      <div class="card-body">
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => updateDownloadContextMenus(!downloadContextMenus)}>
            <span class="setting-title">{i18data.downloadContextMenusSetting}</span>
            <span class="setting-description">{i18data.downloadContextMenusDescSetting}</span>
          </div>
          <div class="switch">
            <Switch checked={downloadContextMenus} ariaLabel={i18data.downloadContextMenusSetting} onchange={updateDownloadContextMenus} />
          </div>
        </div>
        <hr class="divider" />
        <div class="item" class:is-disabled-row={!downloadContextMenus}>
          <div class="content">
            <span class="setting-title">{i18data.downloadContextMenuContextsSetting}</span>
            <span class="setting-description">{i18data.downloadContextMenuContextsDescSetting}</span>
          </div>
          <div class="switch width">
            <div class="checkbox-btn-group">
              <button
                type="button"
                class="checkbox-btn"
                class:is-checked={downloadContextMenuLink}
                disabled={!downloadContextMenus || isOnlySelectedContext('link')}
                onclick={() => toggleContextMenuContext('link')}
              >
                {i18data.link}
              </button>
              <button
                type="button"
                class="checkbox-btn"
                class:is-checked={downloadContextMenuImage}
                disabled={!downloadContextMenus || isOnlySelectedContext('image')}
                onclick={() => toggleContextMenuContext('image')}
              >
                {i18data.image}
              </button>
              <button
                type="button"
                class="checkbox-btn"
                class:is-checked={downloadContextMenuAudio}
                disabled={!downloadContextMenus || isOnlySelectedContext('audio')}
                onclick={() => toggleContextMenuContext('audio')}
              >
                {i18data.audio}
              </button>
              <button
                type="button"
                class="checkbox-btn"
                class:is-checked={downloadContextMenuVideo}
                disabled={!downloadContextMenus || isOnlySelectedContext('video')}
                onclick={() => toggleContextMenuContext('video')}
              >
                {i18data.video}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <h2 class="title">{i18data.fileRoutingSetting}</h2>
    <div class="box-card file-routing-card">
      <div class="card-body">
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => updateFileRoutingEnabled(!downloadFileRoutingEnabled)}>
            <span class="setting-title">{i18data.fileRoutingEnableSetting}</span>
            <span class="setting-description">{i18data.fileRoutingDescription}</span>
          </div>
          <div class="switch">
            <Switch checked={downloadFileRoutingEnabled} ariaLabel={i18data.fileRoutingEnableSetting} onchange={updateFileRoutingEnabled} />
          </div>
        </div>
        <hr class="divider" />
        <div class="item">
          <div class="content">
            <span class="setting-title">{i18data.fileRoutingPrecedenceSetting}</span>
            <span class="setting-description">{i18data.fileRoutingPrecedenceDescription}</span>
          </div>
          <div class="switch width">
            <div class="segmented-group" role="radiogroup" aria-label={i18data.fileRoutingPrecedenceSetting}>
              <button
                type="button"
                role="radio"
                aria-checked={downloadRoutingPrecedence === 'domain'}
                class="segmented-btn"
                class:is-active={downloadRoutingPrecedence === 'domain'}
                disabled={!downloadFileRoutingEnabled}
                onclick={() => updateRoutingPrecedence('domain')}
              >
                {i18data.fileRoutingPrecedenceDomain}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={downloadRoutingPrecedence === 'extension'}
                class="segmented-btn"
                class:is-active={downloadRoutingPrecedence === 'extension'}
                disabled={!downloadFileRoutingEnabled}
                onclick={() => updateRoutingPrecedence('extension')}
              >
                {i18data.fileRoutingPrecedenceExtension}
              </button>
            </div>
          </div>
        </div>
        <hr class="divider" />

        <div class="file-routing-toolbar">
          <span class="setting-title">{i18data.fileRoutingDomainRulesSetting}</span>
          <div class="file-routing-actions">
            <button
              type="button"
              class="dm-btn"
              disabled={!downloadFileRoutingEnabled}
              onclick={addDomainRoutingRule}
            >
              <Icon name="Plus" size="12px" />
              <span>{i18data.fileRoutingAddRule}</span>
            </button>
          </div>
        </div>
        <div class="file-routing-table" role="table">
          <div class="file-routing-table-head" role="row">
            <div role="columnheader">{i18data.fileRoutingFolderLabel}</div>
            <div role="columnheader">{i18data.fileRoutingDomainsLabel}</div>
            <div role="columnheader">{i18data.fileRoutingActionsLabel}</div>
          </div>
          {#if !downloadDomainRoutingRules.length}
            <div class="file-routing-empty">{i18data.fileRoutingDomainRulesEmpty}</div>
          {/if}
          {#each downloadDomainRoutingRules as rule (rule.id)}
            <div
              class="file-routing-table-row"
              class:disabled={!downloadFileRoutingEnabled || !rule.enabled}
              role="row"
              onfocusout={(e) => handleDomainRuleFocusOut(rule, e)}
            >
              <div class="file-routing-table-cell" role="cell" data-label={i18data.fileRoutingFolderLabel}>
                <input
                  type="text"
                  class="routing-text-input"
                  class:file-routing-field-error={isExistingDomainRoutingRuleInvalid(rule) && !isFileRoutingRuleFolderValid(rule)}
                  disabled={!downloadFileRoutingEnabled}
                  placeholder={i18data.fileRoutingDomainFolderPlaceholder}
                  value={rule.folder}
                  oninput={(e) => handleDomainRuleFolderInput(rule, e)}
                  onblur={() => handleDomainRuleFolderBlur(rule)}
                />
              </div>
              <div class="file-routing-table-cell" role="cell" data-label={i18data.fileRoutingDomainsLabel}>
                <TagInput
                  values={rule.domains}
                  disabled={!downloadFileRoutingEnabled}
                  invalid={isExistingDomainRoutingRuleInvalid(rule) && !isDomainRoutingRuleDomainsValid(rule)}
                  placeholder={i18data.fileRoutingDomainsPlaceholder}
                  onupdate={(val) => updateDomainRuleDomains(rule, val)}
                  onchange={() => handleDomainRuleDomainsChange(rule)}
                  onblur={() => handleDomainRuleDomainsBlur(rule)}
                />
              </div>
              <div class="file-routing-table-cell file-routing-row-actions" role="cell" data-label={i18data.fileRoutingActionsLabel}>
                <div class="file-routing-enable">
                  <Switch
                    bind:checked={rule.enabled}
                    ariaLabel={i18data.fileRoutingRuleEnabledLabel}
                    title={i18data.fileRoutingRuleEnabledLabel}
                    disabled={!downloadFileRoutingEnabled || isDomainRoutingRuleIncomplete(rule)}
                    onchange={flushDomainRoutingRules}
                  />
                </div>
                <Popconfirm
                  title={i18data.fileRoutingDeleteRuleConfirm}
                  confirmText={i18data.clearPopConfirmText}
                  cancelText={i18data.clearPopCancelText}
                  onconfirm={() => deleteDomainRoutingRule(rule.id)}
                >
                  <button
                    type="button"
                    class="file-routing-delete"
                    aria-label={i18data.fileRoutingDeleteRule}
                    title={i18data.fileRoutingDeleteRule}
                  >
                    <Icon name="Delete" size="16px" />
                  </button>
                </Popconfirm>
              </div>
            </div>
          {/each}
        </div>

        <hr class="divider" />

        <div class="file-routing-toolbar">
          <span class="setting-title">{i18data.fileRoutingRulesSetting}</span>
          <div class="file-routing-actions">
            <button
              type="button"
              class="dm-btn"
              disabled={!downloadFileRoutingEnabled}
              onclick={addFileRoutingRule}
            >
              <Icon name="Plus" size="12px" />
              <span>{i18data.fileRoutingAddRule}</span>
            </button>
            <button
              type="button"
              class="dm-btn"
              disabled={!downloadFileRoutingEnabled}
              onclick={resetFileRoutingRules}
            >
              <Icon name="RefreshLeft" size="12px" />
              <span>{i18data.fileRoutingResetRules}</span>
            </button>
          </div>
        </div>
        <div class="file-routing-table" role="table">
          <div class="file-routing-table-head" role="row">
            <div role="columnheader">{i18data.fileRoutingFolderLabel}</div>
            <div role="columnheader">{i18data.fileRoutingExtensionsLabel}</div>
            <div role="columnheader">{i18data.fileRoutingActionsLabel}</div>
          </div>
          {#each downloadFileRoutingRules as rule (rule.id)}
            <div
              class="file-routing-table-row"
              class:disabled={!downloadFileRoutingEnabled || !rule.enabled}
              role="row"
              onfocusout={(e) => handleRuleFocusOut(rule, e)}
            >
              <div class="file-routing-table-cell" role="cell" data-label={i18data.fileRoutingFolderLabel}>
                <input
                  type="text"
                  class="routing-text-input"
                  class:file-routing-field-error={isExistingFileRoutingRuleInvalid(rule) && !isFileRoutingRuleFolderValid(rule)}
                  disabled={!downloadFileRoutingEnabled}
                  placeholder={i18data.fileRoutingFolderPlaceholder}
                  value={rule.folder}
                  oninput={(e) => handleRuleFolderInput(rule, e)}
                  onblur={() => handleRuleFolderBlur(rule)}
                />
              </div>
              <div class="file-routing-table-cell" role="cell" data-label={i18data.fileRoutingExtensionsLabel}>
                <TagInput
                  values={rule.extensions}
                  disabled={!downloadFileRoutingEnabled}
                  invalid={isExistingFileRoutingRuleInvalid(rule) && !isFileRoutingRuleExtensionsValid(rule)}
                  placeholder={i18data.fileRoutingExtensionsPlaceholder}
                  onupdate={(val) => updateRuleExtensions(rule, val)}
                  onchange={() => handleRuleExtensionsChange(rule)}
                  onblur={() => handleRuleExtensionsBlur(rule)}
                />
              </div>
              <div class="file-routing-table-cell file-routing-row-actions" role="cell" data-label={i18data.fileRoutingActionsLabel}>
                <div class="file-routing-enable">
                  <Switch
                    bind:checked={rule.enabled}
                    ariaLabel={i18data.fileRoutingRuleEnabledLabel}
                    title={i18data.fileRoutingRuleEnabledLabel}
                    disabled={!downloadFileRoutingEnabled || isFileRoutingRuleIncomplete(rule)}
                    onchange={flushFileRoutingRules}
                  />
                </div>
                <Popconfirm
                  title={i18data.fileRoutingDeleteRuleConfirm}
                  confirmText={i18data.clearPopConfirmText}
                  cancelText={i18data.clearPopCancelText}
                  onconfirm={() => deleteFileRoutingRule(rule.id)}
                >
                  <button
                    type="button"
                    class="file-routing-delete"
                    aria-label={i18data.fileRoutingDeleteRule}
                    title={i18data.fileRoutingDeleteRule}
                  >
                    <Icon name="Delete" size="16px" />
                  </button>
                </Popconfirm>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <h2 class="title">{i18data.notificationSetting}</h2>
    <div class="box-card">
      <div class="card-body">
        <div class="item">
          <div class="content">
            <span class="setting-title">{i18data.downloadNotificationSetting}</span>
          </div>
          <div class="switch width">
            <div class="checkbox-btn-group">
              <button
                type="button"
                class="checkbox-btn"
                class:is-checked={downloadStartedNotification}
                onclick={toggleStartedNotification}
              >
                {i18data.downloadNotificationSetting1}
              </button>
              <button
                type="button"
                class="checkbox-btn"
                class:is-checked={downloadCompletedNotification}
                onclick={toggleCompletedNotification}
              >
                {i18data.downloadNotificationSetting2}
              </button>
              <button
                type="button"
                class="checkbox-btn"
                class:is-checked={downloadWarningNotification}
                onclick={toggleWarningNotification}
              >
                {i18data.downloadNotificationSetting3}
              </button>
            </div>
          </div>
        </div>
        <hr class="divider" />
        <div class="item">
          <div class="content">
            <span class="setting-title">{i18data.downloadNotificationReservedTimeSetting}</span>
          </div>
          <div class="switch width">
            <input
              type="number"
              class="reserved_time"
              max="43200"
              aria-label={i18data.downloadNotificationReservedTimeSetting}
              value={downloadNotificationReservedTime}
              oninput={handleReservedTimeInput}
              onblur={commitReservedTime}
              onchange={commitReservedTime}
            />
          </div>
        </div>
        <hr class="divider" />
        <div class="item">
          <div class="content">
            <span class="setting-title">{i18data.downloadNotificationMaxCountSetting}</span>
            <span class="setting-description">{i18data.downloadNotificationMaxCountDescSetting}</span>
          </div>
          <div class="switch width">
            <input
              type="number"
              class="reserved_time"
              min="0"
              max="50"
              aria-label={i18data.downloadNotificationMaxCountSetting}
              value={downloadNotificationMaxCount}
              oninput={handleMaxCountInput}
              onblur={commitMaxCount}
              onchange={commitMaxCount}
            />
          </div>
        </div>
        <hr class="divider" />
        <div class="item pointer" class:is-disabled-row={!chromeVersionGreaterThan50}>
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => chromeVersionGreaterThan50 && updateRemainVisible(!downloadNotificationRemainVisible)}>
            <span class="setting-title">{i18data.downloadNotificationRemainVisibleSetting}</span>
            <span class="setting-description">{i18data.downloadNotificationRemainVisibleDescSetting}</span>
          </div>
          <div class="switch">
            <Switch
              checked={downloadNotificationRemainVisible}
              disabled={!chromeVersionGreaterThan50}
              ariaLabel={i18data.downloadNotificationRemainVisibleSetting}
              onchange={updateRemainVisible}
            />
          </div>
        </div>
        <hr class="divider" />
        <div class="item">
          <div class="content">
            <span class="setting-title">{i18data.downloadToneSetting}</span>
          </div>
          <div class="switch width">
            <div class="checkbox-btn-group">
              <button
                type="button"
                class="checkbox-btn"
                class:is-checked={downloadStartedTone}
                onclick={toggleStartedTone}
              >
                {i18data.downloadNotificationSetting1}
              </button>
              <button
                type="button"
                class="checkbox-btn"
                class:is-checked={downloadCompletedTone}
                onclick={toggleCompletedTone}
              >
                {i18data.downloadNotificationSetting2}
              </button>
              <button
                type="button"
                class="checkbox-btn"
                class:is-checked={downloadWarningTone}
                onclick={toggleWarningTone}
              >
                {i18data.downloadNotificationSetting3}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <h2 class="title">{i18data.shortcutSetting}</h2>
    <div class="box-card">
      <div class="card-body">
        <div class="item">
          <div class="content">
            <span class="setting-title">
              {i18data.openPopupSetting}
              <span
                class="info-icon-trigger"
                role="img"
                aria-label={i18data.notSyncSetting}
                onmouseenter={showInfoTooltip}
                onmouseleave={hideInfoTooltip}
              >
                <Icon name="InfoFilled" size="14px" />
              </span>
            </span>
            <span class="setting-description">
              {i18data.openPopupDetailsSetting}
              <a class="link" href={CHROME_SHORTCUT_URL} onclick={(e) => openUrl(CHROME_SHORTCUT_URL, e)}>
                {i18data.chromePluginShortcutDescSetting}
              </a>
            </span>
          </div>
          <div class="switch width"><span class="code">{openPopupShortcut}</span></div>
        </div>
      </div>
    </div>

    <h2 class="title">{i18data.syncSetting}</h2>
    <div class="box-card">
      <div class="card-body">
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={() => handleSyncChange(!isSync)}>
            <span class="setting-title">{i18data.pluginSyncSetting}</span>
            <span class="setting-description">{i18data.pluginSyncDetailsSetting}</span>
          </div>
          <div class="switch">
            <Switch checked={isSync} ariaLabel={i18data.pluginSyncSetting} onchange={handleSyncChange} />
          </div>
        </div>
      </div>
    </div>

    <FloatingTooltip
      visible={tooltip.visible}
      content={tooltip.content}
      triggerEl={tooltip.triggerEl}
      placement="top"
    />
  </div>
{/if}

<style>
  .home {
    height: 100%;
    width: 100%;
    padding: 20px;
    box-sizing: border-box;
  }

  .title {
    font-size: 15px;
    font-weight: 600;
    color: var(--opt-text-primary, #1f2937);
    margin: 0 0 12px 2px;
  }

  /* 通用卡片样式 */
  .box-card {
    width: 100%;
    max-width: 920px;
    margin-bottom: 32px;
    border-radius: var(--opt-radius-card, 10px);
    border: 1px solid var(--opt-border, #e5eaf3);
    background-color: var(--opt-surface, #ffffff);
    color: var(--opt-text-primary, #1f2937);
    box-shadow: var(--opt-card-shadow, 0 1px 2px rgba(15, 23, 42, 0.04));
    transition: box-shadow 0.24s ease, border-color 0.24s ease;
    box-sizing: border-box;
  }

  .box-card:hover {
    box-shadow: var(--opt-card-shadow-hover, 0 6px 18px rgba(15, 23, 42, 0.07));
  }

  .box-card .card-body {
    padding: 14px 20px;
  }

  .box-card .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    font-size: 14px;
    width: 100%;
    padding: 4px 0;
    box-sizing: border-box;
  }

  .box-card .item.pointer:hover {
    cursor: pointer;
  }

  .box-card .item.is-disabled-row:hover {
    cursor: not-allowed;
  }

  .box-card .item .content {
    flex: 1 1 auto;
    min-width: 0;
  }

  .box-card .item .content .setting-title {
    display: block;
    font-weight: 500;
    color: var(--opt-text-primary, #1f2937);
    line-height: 1.45;
  }

  .box-card .item .content .setting-description {
    display: block;
    color: var(--opt-text-muted, #6b7280);
    font-size: 12px;
    margin-top: 3px;
    line-height: 1.55;
  }

  .box-card .item .content .link {
    color: var(--opt-accent, #409eff);
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
  }

  .box-card .item .content .link:hover {
    color: var(--opt-accent-hover, #2d8cf0);
    text-decoration: underline;
  }

  .box-card .item .switch {
    flex: 0 0 auto;
    text-align: right;
  }

  .box-card .item .code {
    display: inline-flex;
    align-items: center;
    background-color: var(--opt-badge-bg, #eef2f7);
    border: 1px solid var(--opt-badge-border, #dce3ee);
    color: var(--opt-badge-text, #374151);
    border-radius: var(--opt-radius-control, 6px);
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .info-icon-trigger {
    display: inline-flex;
    align-items: center;
    margin-left: 4px;
    color: var(--opt-text-muted, #6b7280);
    vertical-align: middle;
    cursor: help;
  }

  .divider {
    margin: 12px 0;
    height: 0;
    border: none;
    border-top: 1px solid var(--opt-border-subtle, #edf1f7);
  }

  /* 复选按钮组 */
  .checkbox-btn-group {
    display: inline-flex;
    vertical-align: middle;
  }

  .checkbox-btn {
    height: 28px;
    padding: 0 14px;
    font-size: 12px;
    line-height: 1;
    font-weight: 500;
    font-family: inherit;
    border-radius: 0;
    border: 1px solid var(--opt-control-border, #d5dce6);
    background-color: var(--opt-control-bg, #ffffff);
    color: var(--opt-text-secondary, #4b5563);
    margin-left: -1px;
    cursor: pointer;
    box-sizing: border-box;
    transition: background-color 0.16s, border-color 0.16s, color 0.16s;
  }

  .checkbox-btn:first-child {
    margin-left: 0;
    border-top-left-radius: var(--opt-radius-control, 6px);
    border-bottom-left-radius: var(--opt-radius-control, 6px);
  }

  .checkbox-btn:last-child {
    border-top-right-radius: var(--opt-radius-control, 6px);
    border-bottom-right-radius: var(--opt-radius-control, 6px);
  }

  .checkbox-btn:hover:not(:disabled) {
    color: var(--opt-accent, #409eff);
  }

  .checkbox-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--opt-focus-ring, rgba(64, 158, 255, 0.28));
    z-index: 2;
  }

  .checkbox-btn.is-checked {
    background-color: var(--opt-accent, #409eff);
    border-color: var(--opt-accent, #409eff);
    color: #ffffff;
    position: relative;
    z-index: 1;
  }

  .checkbox-btn.is-checked:hover:not(:disabled) {
    background-color: var(--opt-accent-hover, #2d8cf0);
    border-color: var(--opt-accent-hover, #2d8cf0);
    color: #ffffff;
  }

  .checkbox-btn.is-checked + .checkbox-btn.is-checked {
    border-left-color: rgba(255, 255, 255, 0.35);
  }

  .checkbox-btn:disabled {
    color: var(--opt-text-disabled, #9ca3af);
    background-color: var(--opt-control-disabled-bg, #f4f6f9);
    border-color: var(--opt-control-disabled-border, #e6ebf2);
    cursor: not-allowed;
  }

  .checkbox-btn.is-checked:disabled {
    background-color: var(--opt-accent-disabled, #a0cfff);
    border-color: var(--opt-accent-disabled, #a0cfff);
    color: rgba(255, 255, 255, 0.85);
  }

  /* 弹窗顶部按钮显隐与排序控制组 */
  .box-card .item.header-buttons-row {
    display: block;
  }

  .header-buttons-copy .setting-title {
    display: block;
    font-weight: 500;
    color: var(--opt-text-primary, #1f2937);
    line-height: 1.45;
  }

  .header-buttons-copy .setting-description {
    display: block;
    color: var(--opt-text-muted, #6b7280);
    font-size: 12px;
    margin-top: 3px;
    line-height: 1.55;
  }

  .header-btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .header-btn-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 11px;
    font-size: 12px;
    line-height: 1;
    font-weight: 500;
    font-family: inherit;
    border-radius: var(--opt-radius-control, 6px);
    border: 1px solid var(--opt-control-border, #d5dce6);
    background-color: var(--opt-control-bg, #ffffff);
    color: var(--opt-text-secondary, #4b5563);
    cursor: pointer;
    user-select: none;
    box-sizing: border-box;
    transition: background-color 0.16s, border-color 0.16s, color 0.16s, opacity 0.15s;
  }

  .header-btn-toggle:not(:disabled) {
    cursor: grab;
  }

  .header-btn-toggle.is-dragging {
    opacity: 0.45;
    cursor: grabbing;
  }

  .header-btn-grip {
    flex-shrink: 0;
    opacity: 0.55;
    margin-right: 1px;
  }

  .header-btn-toggle:hover:not(:disabled) {
    color: var(--opt-accent, #409eff);
    border-color: var(--opt-accent-soft-border, #b3d8ff);
  }

  .header-btn-toggle:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--opt-focus-ring, rgba(64, 158, 255, 0.28));
  }

  .header-btn-toggle.is-checked {
    background-color: var(--opt-accent, #409eff);
    border-color: var(--opt-accent, #409eff);
    color: #ffffff;
  }

  .header-btn-toggle.is-checked:hover:not(:disabled) {
    color: #ffffff;
    background-color: var(--opt-accent-hover, #2d8cf0);
    border-color: var(--opt-accent-hover, #2d8cf0);
  }

  .header-btn-toggle:disabled {
    color: var(--opt-text-disabled, #9ca3af);
    background-color: var(--opt-control-disabled-bg, #f4f6f9);
    border-color: var(--opt-control-disabled-border, #e6ebf2);
    cursor: not-allowed;
  }

  .header-btn-toggle.is-checked:disabled {
    background-color: var(--opt-accent-disabled, #a0cfff);
    border-color: var(--opt-accent-disabled, #a0cfff);
    color: rgba(255, 255, 255, 0.85);
  }

  /* 分段单选按钮 */
  .segmented-group {
    display: inline-flex;
    vertical-align: middle;
  }

  .segmented-btn {
    height: 28px;
    padding: 0 14px;
    font-size: 12px;
    line-height: 1;
    font-weight: 500;
    font-family: inherit;
    border-radius: 0;
    border: 1px solid var(--opt-control-border, #d5dce6);
    background-color: var(--opt-control-bg, #ffffff);
    color: var(--opt-text-secondary, #4b5563);
    margin-left: -1px;
    cursor: pointer;
    box-sizing: border-box;
    transition: background-color 0.16s, border-color 0.16s, color 0.16s;
  }

  .segmented-btn:first-child {
    margin-left: 0;
    border-top-left-radius: var(--opt-radius-control, 6px);
    border-bottom-left-radius: var(--opt-radius-control, 6px);
  }

  .segmented-btn:last-child {
    border-top-right-radius: var(--opt-radius-control, 6px);
    border-bottom-right-radius: var(--opt-radius-control, 6px);
  }

  .segmented-btn:hover:not(:disabled) {
    color: var(--opt-accent, #409eff);
  }

  .segmented-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--opt-focus-ring, rgba(64, 158, 255, 0.28));
    z-index: 2;
  }

  .segmented-btn.is-active {
    background-color: var(--opt-accent, #409eff);
    border-color: var(--opt-accent, #409eff);
    color: #ffffff;
    position: relative;
    z-index: 1;
  }

  .segmented-btn.is-active:hover:not(:disabled) {
    background-color: var(--opt-accent-hover, #2d8cf0);
    border-color: var(--opt-accent-hover, #2d8cf0);
    color: #ffffff;
  }

  .segmented-btn:disabled {
    color: var(--opt-text-disabled, #9ca3af);
    background-color: var(--opt-control-disabled-bg, #f4f6f9);
    border-color: var(--opt-control-disabled-border, #e6ebf2);
    cursor: not-allowed;
  }

  .segmented-btn.is-active:disabled {
    background-color: var(--opt-accent-disabled, #a0cfff);
    border-color: var(--opt-accent-disabled, #a0cfff);
    color: rgba(255, 255, 255, 0.85);
  }

  /* 通用小按钮 */
  .dm-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
    line-height: 1;
    font-weight: 500;
    font-family: inherit;
    color: var(--opt-text-secondary, #4b5563);
    background-color: var(--opt-control-bg, #ffffff);
    border: 1px solid var(--opt-control-border, #d5dce6);
    border-radius: var(--opt-radius-control, 6px);
    cursor: pointer;
    box-sizing: border-box;
    transition: background-color 0.16s, border-color 0.16s, color 0.16s;
  }

  .dm-btn:hover:not(:disabled) {
    color: var(--opt-accent, #409eff);
    border-color: var(--opt-accent-soft-border, #b3d8ff);
    background-color: var(--opt-accent-soft, #ecf5ff);
  }

  .dm-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--opt-focus-ring, rgba(64, 158, 255, 0.28));
  }

  .dm-btn:disabled {
    color: var(--opt-text-disabled, #9ca3af);
    background-color: var(--opt-control-disabled-bg, #f4f6f9);
    border-color: var(--opt-control-disabled-border, #e6ebf2);
    cursor: not-allowed;
  }

  /* 文件分类下载表格 */
  .file-routing-card {
    max-width: 920px;
  }

  .file-routing-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 0;
    margin-bottom: 10px;
  }

  .file-routing-toolbar .setting-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--opt-text-primary, #1f2937);
  }

  .file-routing-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .file-routing-empty {
    padding: 12px;
    color: var(--opt-text-muted, #6b7280);
    font-size: 13px;
  }

  .file-routing-table {
    border: 1px solid var(--opt-border, #e5eaf3);
    border-radius: var(--opt-radius-inner, 8px);
    overflow: hidden;
  }

  .file-routing-table-head,
  .file-routing-table-row {
    display: grid;
    grid-template-columns: minmax(140px, 200px) minmax(360px, 1fr) 112px;
    align-items: center;
  }

  .file-routing-table-head {
    color: var(--opt-text-muted, #6b7280);
    background: var(--opt-surface-subtle, #f8fafc);
    font-size: 12px;
    font-weight: 500;
  }

  .file-routing-table-head > div,
  .file-routing-table-cell {
    min-width: 0;
    padding: 10px 12px;
    box-sizing: border-box;
  }

  .file-routing-table-head > div:last-child {
    text-align: center;
  }

  .file-routing-table-row {
    border-top: 1px solid var(--opt-border-subtle, #edf1f7);
  }

  .file-routing-table-row.disabled {
    opacity: 0.72;
  }

  .file-routing-row-actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
  }

  .file-routing-enable {
    display: inline-flex;
    align-items: center;
  }

  .file-routing-delete {
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: var(--opt-radius-control, 6px);
    background: transparent;
    color: var(--opt-danger, #f56c6c);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.16s;
  }

  .file-routing-delete:hover {
    background-color: var(--opt-danger-hover-bg, #fef0f0);
  }

  .routing-text-input {
    width: 100%;
    height: 30px;
    padding: 0 9px;
    border: none;
    border-radius: var(--opt-radius-control, 6px);
    font-size: 12px;
    font-family: inherit;
    color: var(--opt-text-secondary, #4b5563);
    background-color: var(--opt-control-bg, #ffffff);
    box-shadow: 0 0 0 1px var(--opt-control-border, #d5dce6) inset;
    outline: none;
    box-sizing: border-box;
    transition: box-shadow 0.16s ease;
  }

  .routing-text-input:hover:not(:disabled) {
    box-shadow: 0 0 0 1px var(--opt-control-border-hover, #b8c4d4) inset;
  }

  .routing-text-input:focus {
    box-shadow: 0 0 0 1px var(--opt-accent, #409eff) inset, 0 0 0 2px var(--opt-focus-ring, rgba(64, 158, 255, 0.25));
  }

  .routing-text-input.file-routing-field-error {
    box-shadow: 0 0 0 1px var(--opt-danger, #f56c6c) inset;
  }

  .routing-text-input:disabled {
    background-color: var(--opt-control-disabled-bg, #f4f6f9);
    color: var(--opt-text-disabled, #9ca3af);
    box-shadow: 0 0 0 1px var(--opt-control-disabled-border, #e6ebf2) inset;
    cursor: not-allowed;
  }

  .routing-text-input::placeholder {
    color: var(--opt-text-disabled, #9ca3af);
  }

  .reserved_time {
    width: 90px;
    height: 28px;
    padding: 0 8px;
    text-align: center;
    border-radius: var(--opt-radius-control, 6px);
    border: 1px solid var(--opt-control-border, #d5dce6);
    font-size: 12px;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    color: var(--opt-text-secondary, #4b5563);
    background-color: var(--opt-control-bg, #ffffff);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.16s, box-shadow 0.16s;
  }

  .reserved_time:hover {
    border-color: var(--opt-control-border-hover, #b8c4d4);
  }

  .reserved_time:focus {
    border-color: var(--opt-accent, #409eff);
    box-shadow: 0 0 0 2px var(--opt-focus-ring, rgba(64, 158, 255, 0.28));
  }

  .reserved_time::-webkit-inner-spin-button,
  .reserved_time::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  @media (max-width: 760px) {
    .file-routing-table {
      border: none;
      border-radius: 0;
      overflow: visible;
    }

    .file-routing-table-head {
      display: none;
    }

    .file-routing-table-row {
      display: block;
      padding: 10px 0;
      border-top: 1px solid var(--opt-border-subtle, #edf1f7);
    }

    .file-routing-table-cell {
      padding: 6px 4px;
    }

    .file-routing-table-cell::before {
      content: attr(data-label);
      display: block;
      margin-bottom: 4px;
      color: var(--opt-text-muted, #6b7280);
      font-size: 12px;
    }

    .file-routing-row-actions {
      justify-content: flex-start;
    }
  }
</style>
