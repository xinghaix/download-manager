<script>
  import { onMount } from 'svelte'
  import Icon from '../../components/Icon.svelte'
  import FloatingTooltip from '../../components/FloatingTooltip.svelte'
  import storage from '../../utils/storage'
  import common from '../../utils/common'
  import {
    POPUP_HEADER_BUTTON_KEYS,
    normalizePopupHeaderButtons,
    normalizePopupHeaderButtonsOrder,
    getOrderedVisiblePopupHeaderButtons
  } from '../../utils/popupHeaderButtons'

  let { i18data } = $props()

  const MIN_PREVIEW_WIDTH = 380
  const MAX_PREVIEW_WIDTH = 800
  const MIN_PREVIEW_HEIGHT = 300
  const MAX_PREVIEW_HEIGHT = 600

  const THEME_SETTINGS_KEYS = [
    'ui_theme',
    'ui_theme_series',
    'theme',
    'icon_color',
    'icon_downloading_color',
    'download_panel_theme',
    'download_panel_page_size',
    'popup_header_buttons_visible',
    'popup_header_buttons',
    'popup_header_buttons_order'
  ]

  const previewFileTemplates = [
    {
      name: 'download-manager-v3.zip',
      url: 'github.com/xinghaix/download-manager/releases',
      percent: '68%',
      received: '2.4M',
      total: '3.7M',
      speed: '860K/s',
      statusSeconds: '13',
      previewClass: ''
    },
    {
      name: 'design-assets.sketch',
      url: 'cdn.example.com/assets/design-assets.sketch',
      percent: '31%',
      received: '1.1M',
      total: '5.0M',
      speed: '420K/s',
      statusSeconds: '48',
      previewClass: 'is-hovered'
    },
    {
      name: 'notification-sound-pack.wav',
      url: 'audio.example.com/ui/notification-sound-pack.wav',
      percent: '92%',
      received: '4.8M',
      total: '5.0M',
      speed: '1.2M/s',
      statusSeconds: '2',
      previewClass: ''
    }
  ]

  const previewHeaderIconMap = {
    newDownload: 'Download',
    clear: 'Brush',
    batchActions: 'VideoPause',
    openFolder: 'FolderOpened',
    openHome: 'Position'
  }

  const i18n = common.i18data
  const themeSeries = [
    {
      key: 'terminal',
      title: i18n.themeSeriesTerminalTitle,
      desc: i18n.themeSeriesTerminalDescription,
      options: [
        { value: 'terminal-dark', mode: 'dark' },
        { value: 'terminal-light', mode: 'light' }
      ]
    },
    {
      key: 'github',
      title: i18n.themeSeriesGithubTitle,
      desc: i18n.themeSeriesGithubDescription,
      options: [
        { value: 'github-dark', mode: 'dark' },
        { value: 'github-light', mode: 'light' }
      ]
    },
    {
      key: 'claude',
      title: i18n.themeSeriesClaudeTitle,
      desc: i18n.themeSeriesClaudeDescription,
      options: [
        { value: 'claude-dark', mode: 'dark' },
        { value: 'claude-light', mode: 'light' }
      ]
    },
    {
      key: 'basic',
      title: i18n.themeSeriesBasicTitle,
      desc: i18n.themeSeriesBasicDescription,
      options: [
        { value: 'basic-dark', mode: 'dark' },
        { value: 'basic-light', mode: 'light' }
      ]
    }
  ]

  let show = $state(false)
  let systemTheme = $state('light')
  let uiTheme = $state('')
  let uiThemeSeries = $state('')
  let theme = $state('auto')
  let iconColor = $state({
    icon_color: {
      light: '#000000',
      dark: '#989898'
    },
    icon_downloading_color: {
      light: '#00d032',
      dark: '#ffa500'
    }
  })
  let downloadPanelPageSize = $state({
    width: 400,
    height: 420
  })
  let themeData = $state(null)
  let selectedThemeSeriesKey = $state('basic')
  let previewMode = $state('light')

  // 与真实 Popup 同步的顶部按钮配置
  let popupHeaderButtonsVisible = $state(true)
  let popupHeaderButtons = $state([...POPUP_HEADER_BUTTON_KEYS])
  let popupHeaderButtonsOrder = $state([...POPUP_HEADER_BUTTON_KEYS])

  // 图标配色按钮 Tooltip
  let tooltip = $state({
    visible: false,
    content: '',
    triggerEl: null
  })

  const enableThemeAdaptation = $derived(theme === 'auto')
  const effectiveMode = $derived(theme === 'auto' ? systemTheme : theme)

  const previewHeaderButtons = $derived(
    getOrderedVisiblePopupHeaderButtons(popupHeaderButtonsVisible, popupHeaderButtons, popupHeaderButtonsOrder)
  )

  const previewFiles = $derived(
    previewFileTemplates.map(file => ({
      ...file,
      status: i18data.second.replace('{}', file.statusSeconds)
    }))
  )

  const fixedPreviewViewport = $derived(normalizePreviewSize(downloadPanelPageSize))
  const popupBodyHeight = $derived(fixedPreviewViewport.height - 1)
  const previewContentHeight = $derived(Math.max(popupBodyHeight - 62, 0))

  const previewThemeStyleString = $derived.by(() => {
    const parts = [
      `width: ${fixedPreviewViewport.width}px`,
      `height: ${fixedPreviewViewport.height}px`
    ]
    if (themeData) {
      const mode = theme === 'auto' ? previewMode : effectiveMode
      const themeName = getThemeNameByMode(selectedThemeSeriesKey, mode)
      const vars = themeData[themeName] || {}
      for (const [k, v] of Object.entries(vars)) {
        parts.push(`${k}: ${v}`)
      }
    }
    return parts.join('; ')
  })

  onMount(() => {
    let disposed = false

    const storageChangeListener = (changes) => {
      if (changes.popup_header_buttons_visible) {
        const nextValue = changes.popup_header_buttons_visible.newValue
        popupHeaderButtonsVisible = typeof nextValue === 'boolean' ? nextValue : true
      }
      if (changes.popup_header_buttons_order) {
        popupHeaderButtonsOrder = normalizePopupHeaderButtonsOrder(changes.popup_header_buttons_order.newValue)
        popupHeaderButtons = normalizePopupHeaderButtons(popupHeaderButtons, popupHeaderButtonsOrder)
      }
      if (changes.popup_header_buttons) {
        popupHeaderButtons = normalizePopupHeaderButtons(changes.popup_header_buttons.newValue, popupHeaderButtonsOrder)
      }
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(storageChangeListener)
    }

    ;(async () => {
      systemTheme = common.isInDarkMode() ? 'dark' : 'light'

      const [settings, loadedThemeData] = await Promise.all([
        storage.getMany(THEME_SETTINGS_KEYS),
        loadThemeData()
      ])
      if (disposed) {
        return
      }

      uiTheme = settings.ui_theme || ''
      uiThemeSeries = settings.ui_theme_series || ''
      theme = settings.theme || 'auto'

      iconColor = {
        icon_color: {
          light: '#000000',
          dark: '#989898',
          ...(settings.icon_color || {})
        },
        icon_downloading_color: {
          light: '#00d032',
          dark: '#ffa500',
          ...(settings.icon_downloading_color || {})
        }
      }

      downloadPanelPageSize = normalizePreviewSize({
        width: 400,
        height: 420,
        ...(settings.download_panel_page_size || {})
      })

      popupHeaderButtonsVisible = typeof settings.popup_header_buttons_visible === 'boolean'
        ? settings.popup_header_buttons_visible
        : true
      popupHeaderButtonsOrder = normalizePopupHeaderButtonsOrder(settings.popup_header_buttons_order)
      popupHeaderButtons = normalizePopupHeaderButtons(settings.popup_header_buttons, popupHeaderButtonsOrder)

      themeData = loadedThemeData
      initializeThemeSelection()
      show = true
    })()

    return () => {
      disposed = true
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(storageChangeListener)
      }
    }
  })

  function normalizePreviewSize(size) {
    const width = Math.min(Math.max(Number(size?.width) || 400, MIN_PREVIEW_WIDTH), MAX_PREVIEW_WIDTH)
    const height = Math.min(Math.max(Number(size?.height) || 420, MIN_PREVIEW_HEIGHT), MAX_PREVIEW_HEIGHT)
    return { width, height }
  }

  function getThemeSeriesKey(themeName) {
    if (!themeName || typeof themeName !== 'string') {
      return ''
    }
    if (themeName === 'light' || themeName === 'dark') {
      return 'basic'
    }
    return themeSeries.find(series => series.options.some(option => option.value === themeName))?.key || ''
  }

  function getThemeNameByMode(seriesKey, mode) {
    const series = themeSeries.find(item => item.key === seriesKey)
    if (!series || !series.options.length) {
      return mode
    }
    const matchedOption = series.options.find(option => option.mode.toLowerCase() === mode)
    return (matchedOption || series.options[0]).value
  }

  function syncPreviewModeWithTheme(nextTheme) {
    if (nextTheme === 'auto') {
      previewMode = 'light'
      return
    }
    previewMode = nextTheme === 'dark' ? 'dark' : 'light'
  }

  function initializeThemeSelection() {
    const initialSeriesKey = uiThemeSeries || getThemeSeriesKey(uiTheme) || 'basic'
    uiThemeSeries = initialSeriesKey
    selectedThemeSeriesKey = initialSeriesKey
    syncPreviewModeWithTheme(theme)
  }

  async function selectTheme(nextTheme) {
    const oldVal = theme
    if (nextTheme === oldVal) {
      return
    }
    theme = nextTheme
    await storage.set('theme', nextTheme)
    await setDownloadPanelTheme(nextTheme)
    systemTheme = common.isInDarkMode() ? 'dark' : 'light'
    syncPreviewModeWithTheme(nextTheme)

    const effective = nextTheme === 'auto' ? systemTheme : nextTheme
    if (systemTheme === 'dark') {
      if (!(oldVal === 'auto' && nextTheme === 'dark') && !(oldVal === 'dark' && nextTheme === 'auto')) {
        sendIconColorToBackground(effective)
      }
    } else {
      if (!(oldVal === 'auto' && nextTheme === 'light') && !(oldVal === 'light' && nextTheme === 'auto')) {
        sendIconColorToBackground(effective)
      }
    }

    if (uiThemeSeries) {
      await syncRuntimeThemePreview(uiThemeSeries)
    }
  }

  function toggleThemeAdaptation() {
    if (!enableThemeAdaptation) {
      selectTheme('auto')
      return
    }
    selectTheme(common.isInDarkMode() ? 'dark' : 'light')
  }

  function setPreviewMode(mode) {
    if (theme !== 'auto') {
      return
    }
    previewMode = mode === 'dark' ? 'dark' : 'light'
  }

  function getModeLabel(mode) {
    return mode === 'dark' ? i18data.themeAdaptationOption3 : i18data.themeAdaptationOption2
  }

  async function handlePreviewSeriesChange(event) {
    selectedThemeSeriesKey = event.currentTarget.value
    await applyUIThemeSeries(selectedThemeSeriesKey)
  }

  async function applyUIThemeSeries(seriesKey) {
    const normalizedSeriesKey = seriesKey || 'basic'
    uiThemeSeries = normalizedSeriesKey
    uiTheme = ''
    await storage.set('ui_theme_series', normalizedSeriesKey)
    await storage.set('ui_theme', '')
    await syncRuntimeThemePreview(normalizedSeriesKey)
  }

  async function syncRuntimeThemePreview(seriesKey) {
    const mode = theme === 'auto' ? systemTheme : theme
    const themeName = getThemeNameByMode(seriesKey, mode)
    await setDownloadPanelTheme(mode)

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(JSON.stringify({
        type: 'ui_theme_changed',
        data: themeName
      }), () => {
        if (chrome.runtime.lastError) {
          // ignore
        }
      })
    }
  }

  function setIconColor(val, type, mode) {
    iconColor[type][mode] = val
    const tmpTheme = common.isInDarkMode() ? 'dark' : 'light'
    if (((theme === 'auto' && tmpTheme === mode) || theme === mode)
      && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(JSON.stringify({
        type,
        data: val
      }), () => {
        if (chrome.runtime.lastError) {
          // ignore
        }
      })
    }
    storage.set(type, { ...iconColor[type] })
  }

  function sendIconColorToBackground(mode) {
    if (!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage)) {
      return
    }
    chrome.runtime.sendMessage(JSON.stringify({
      type: 'icon_color',
      data: iconColor.icon_color[mode]
    }), () => {
      if (chrome.runtime.lastError) {
        // ignore
      }
    })
    chrome.runtime.sendMessage(JSON.stringify({
      type: 'icon_downloading_color',
      data: iconColor.icon_downloading_color[mode]
    }), () => {
      if (chrome.runtime.lastError) {
        // ignore
      }
    })
  }

  function setDownloadPanelTheme(val) {
    return storage.set('download_panel_theme', val)
  }

  function commitPageSize() {
    const normalized = normalizePreviewSize(downloadPanelPageSize)
    downloadPanelPageSize = normalized
    storage.set('download_panel_page_size', normalized)
  }

  function handlePageSizeInput(field, event) {
    const raw = Number(event.currentTarget.value)
    if (!Number.isFinite(raw)) {
      return
    }
    downloadPanelPageSize = {
      ...downloadPanelPageSize,
      [field]: raw
    }
    const min = field === 'width' ? MIN_PREVIEW_WIDTH : MIN_PREVIEW_HEIGHT
    const max = field === 'width' ? MAX_PREVIEW_WIDTH : MAX_PREVIEW_HEIGHT
    if (raw >= min && raw <= max) {
      storage.set('download_panel_page_size', normalizePreviewSize(downloadPanelPageSize))
    }
  }

  async function loadThemeData() {
    try {
      const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
        ? chrome.runtime.getURL('/theme/theme.json')
        : '/theme/theme.json'
      const response = await fetch(url)
      return await response.json()
    } catch (e) {
      console.warn('Failed to load theme.json', e)
      return {}
    }
  }

  function showTooltip(event, content) {
    tooltip = {
      visible: true,
      content,
      triggerEl: event.currentTarget
    }
  }

  function hideTooltip() {
    tooltip = {
      ...tooltip,
      visible: false
    }
  }
</script>

{#if show}
  <div class="home">
    <h2 class="title">{i18data.themeTitle}</h2>
    <div class="box-card">
      <div class="card-body">
        <div class="item pointer">
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="content" onclick={toggleThemeAdaptation}>
            <span class="setting-title">{i18data.themeAdaptation}</span>
            <span class="setting-description">{i18data.themeAdaptationDescription}</span>
          </div>
          <div class="switch">
            <div class="segmented-group" role="radiogroup" aria-label={i18data.themeAdaptation}>
              <button
                type="button"
                role="radio"
                aria-checked={theme === 'auto'}
                class="segmented-btn"
                class:is-active={theme === 'auto'}
                onclick={() => selectTheme('auto')}
              >
                {i18data.themeAdaptationOption1}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={theme === 'light'}
                class="segmented-btn"
                class:is-active={theme === 'light'}
                onclick={() => selectTheme('light')}
              >
                {i18data.themeAdaptationOption2}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={theme === 'dark'}
                class="segmented-btn"
                class:is-active={theme === 'dark'}
                onclick={() => selectTheme('dark')}
              >
                {i18data.themeAdaptationOption3}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <h2 class="title">{i18data.iconTitle}</h2>
    <div class="box-card">
      <div class="card-body">
        <div class="item">
          <div class="content">
            <span class="setting-title">{i18data.iconColorSetting}</span>
          </div>
          <div class="switch icon">
            <label
              class="color-picker"
              class:color={theme === 'light' || theme === 'auto'}
              onmouseenter={(e) => showTooltip(e, i18data.lightThemeTooltip)}
              onmouseleave={hideTooltip}
            >
              <span class="color-swatch" style:background-color={iconColor.icon_color.light}></span>
              <input
                type="color"
                class="color-native-input"
                aria-label={i18data.iconColorSetting + ' - ' + i18data.lightThemeTooltip}
                value={iconColor.icon_color.light}
                onchange={(e) => setIconColor(e.currentTarget.value, 'icon_color', 'light')}
              />
            </label>
            <label
              class="color-picker"
              class:color={theme === 'dark' || theme === 'auto'}
              onmouseenter={(e) => showTooltip(e, i18data.darkThemeTooltip)}
              onmouseleave={hideTooltip}
            >
              <span class="color-swatch" style:background-color={iconColor.icon_color.dark}></span>
              <input
                type="color"
                class="color-native-input"
                aria-label={i18data.iconColorSetting + ' - ' + i18data.darkThemeTooltip}
                value={iconColor.icon_color.dark}
                onchange={(e) => setIconColor(e.currentTarget.value, 'icon_color', 'dark')}
              />
            </label>
          </div>
        </div>
        <hr class="divider" />
        <div class="item">
          <div class="content">
            <span class="setting-title">{i18data.iconDownloadingColorSetting}</span>
          </div>
          <div class="switch icon">
            <label
              class="color-picker"
              class:color={theme === 'light' || theme === 'auto'}
              onmouseenter={(e) => showTooltip(e, i18data.lightThemeTooltip)}
              onmouseleave={hideTooltip}
            >
              <span class="color-swatch" style:background-color={iconColor.icon_downloading_color.light}></span>
              <input
                type="color"
                class="color-native-input"
                aria-label={i18data.iconDownloadingColorSetting + ' - ' + i18data.lightThemeTooltip}
                value={iconColor.icon_downloading_color.light}
                onchange={(e) => setIconColor(e.currentTarget.value, 'icon_downloading_color', 'light')}
              />
            </label>
            <label
              class="color-picker"
              class:color={theme === 'dark' || theme === 'auto'}
              onmouseenter={(e) => showTooltip(e, i18data.darkThemeTooltip)}
              onmouseleave={hideTooltip}
            >
              <span class="color-swatch" style:background-color={iconColor.icon_downloading_color.dark}></span>
              <input
                type="color"
                class="color-native-input"
                aria-label={i18data.iconDownloadingColorSetting + ' - ' + i18data.darkThemeTooltip}
                value={iconColor.icon_downloading_color.dark}
                onchange={(e) => setIconColor(e.currentTarget.value, 'icon_downloading_color', 'dark')}
              />
            </label>
          </div>
        </div>
      </div>
    </div>

    <h2 class="title">{i18data.downloadPanelTitle}</h2>
    <div class="box-card theme-system-card">
      <div class="card-body">
        <div class="item compact-item">
          <div class="content">
            <span class="setting-title">{i18data.pageSize}</span>
            <span class="setting-description">{i18data.pageSizeDescription}</span>
          </div>
          <div class="switch page-size">
            <input
              type="number"
              class="page-size-input"
              min={MIN_PREVIEW_WIDTH}
              max={MAX_PREVIEW_WIDTH}
              aria-label="Popup width"
              value={downloadPanelPageSize.width}
              oninput={(e) => handlePageSizeInput('width', e)}
              onblur={commitPageSize}
              onchange={commitPageSize}
            />
            <input
              type="number"
              class="page-size-input"
              min={MIN_PREVIEW_HEIGHT}
              max={MAX_PREVIEW_HEIGHT}
              aria-label="Popup height"
              value={downloadPanelPageSize.height}
              oninput={(e) => handlePageSizeInput('height', e)}
              onblur={commitPageSize}
              onchange={commitPageSize}
            />
          </div>
        </div>

        <hr class="divider" />

        <section class="theme-preview-panel">
          <section class="theme-system-head">
            <div class="theme-system-copy">
              <div class="theme-system-title">{i18data.themeSystemTitle}</div>
              <div class="theme-system-desc">{i18data.themeSystemDescription}</div>
            </div>
            <div class="theme-selector-control theme-system-selector">
              <label class="selector-label" for="theme-series-select">{i18data.themeSeriesLabel}</label>
              <select
                id="theme-series-select"
                class="theme-series-select"
                value={selectedThemeSeriesKey}
                onchange={handlePreviewSeriesChange}
              >
                {#each themeSeries as series (series.key)}
                  <option value={series.key}>{series.title}</option>
                {/each}
              </select>
            </div>
          </section>

          <section class="live-preview-shell">
            <div class="preview-stage">
              <div class="preview-stage-grid"></div>
              <div class="preview-stage-head">
                {#if theme === 'auto'}
                  <div class="preview-mode-switch" role="tablist" aria-label={i18data.themePreviewModeAriaLabel}>
                    <button
                      type="button"
                      class="preview-mode-button"
                      class:active={previewMode === 'light'}
                      onclick={() => setPreviewMode('light')}
                    >
                      {getModeLabel('light')}
                    </button>
                    <button
                      type="button"
                      class="preview-mode-button"
                      class:active={previewMode === 'dark'}
                      onclick={() => setPreviewMode('dark')}
                    >
                      {getModeLabel('dark')}
                    </button>
                  </div>
                {:else}
                  <div class="preview-mode-indicator">{getModeLabel(effectiveMode)}</div>
                {/if}
              </div>

              <div class="popup-preview-wrapper">
                <div class="popup-preview" style={previewThemeStyleString}>
                  <div class="popup-shell">
                    <div
                      class="popup-home"
                      style:width="{fixedPreviewViewport.width}px"
                      style:height="{popupBodyHeight}px"
                    >
                      <div class="popup-header">
                        <div class="popup-search">
                          <div class="search-inner">
                            <span class="search-placeholder"></span>
                            <span class="search-icon">
                              <Icon name="Search" size="14px" />
                            </span>
                          </div>
                        </div>
                        <div class="popup-header-operator">
                          {#each previewHeaderButtons as btnKey (btnKey)}
                            <span class="header-button icon-button">
                              <Icon name={previewHeaderIconMap[btnKey]} />
                            </span>
                          {/each}
                          <span class="header-button icon-button"><Icon name="Setting" /></span>
                        </div>
                      </div>

                      <div class="popup-content">
                        <div class="preview-scroll" style:max-height="{previewContentHeight}px">
                          {#each previewFiles as file (file.name)}
                            <div class="file {file.previewClass}">
                              <div class="icon">
                                <div class="progress-ring">
                                  <div class="progress-ring-inner">{file.percent}</div>
                                </div>
                              </div>
                              <div class="file-content">
                                <span class="filename">{file.name}</span>
                                <span class="file-url">{file.url}</span>
                                <div class="info">
                                  <div class="cell left common">
                                    <span class="receivedSize small-size">{file.received}</span>
                                    <span class="divider-sep small-size">/</span>
                                    <span class="size small-size">{file.total}</span>
                                  </div>
                                  <div class="cell middle common">
                                    <span class="speed small-size">{file.speed}</span>
                                  </div>
                                  <div class="cell right common">
                                    <span class="remaining small-size">{file.status}</span>
                                  </div>
                                </div>
                              </div>
                              <div class="content-operator-wrapper">
                                <div class="content-operator">
                                  <span class="icon-button"><Icon name="FolderOpened" /></span>
                                  <span class="icon-button"><Icon name="VideoPause" /></span>
                                  <span class="icon-button"><Icon name="RefreshRight" /></span>
                                  <span class="icon-button"><Icon name="Close" /></span>
                                </div>
                              </div>
                            </div>
                          {/each}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>
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
    max-width: 960px;
    padding: 20px;
    box-sizing: border-box;
  }

  .title {
    font-size: 15px;
    font-weight: 600;
    color: var(--opt-text-primary, #1f2937);
    margin: 0 0 12px 2px;
  }

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

  .box-card .item .switch {
    flex: 0 0 auto;
    text-align: right;
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

  .segmented-btn:hover {
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

  .segmented-btn.is-active:hover {
    background-color: var(--opt-accent-hover, #2d8cf0);
    border-color: var(--opt-accent-hover, #2d8cf0);
    color: #ffffff;
  }

  /* 图标颜色选择器 */
  .color-picker {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 3px;
    border: 1px solid var(--opt-control-border, #d5dce6);
    border-radius: var(--opt-radius-control, 6px);
    background-color: var(--opt-control-bg, #ffffff);
    box-sizing: border-box;
    cursor: pointer;
    vertical-align: middle;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .color-picker:first-child {
    margin-right: 12px;
  }

  .color-picker:hover {
    border-color: var(--opt-control-border-hover, #b8c4d4);
  }

  .color-picker.color {
    border-color: var(--opt-accent, #409eff);
    box-shadow: 0 0 0 1px var(--opt-focus-ring, rgba(64, 158, 255, 0.22));
  }

  .color-swatch {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.16);
    box-sizing: border-box;
  }

  .color-native-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    padding: 0;
    border: none;
  }

  .divider {
    margin: 12px 0;
    height: 0;
    border: none;
    border-top: 1px solid var(--opt-border-subtle, #edf1f7);
  }

  /* 尺寸输入框 */
  .page-size-input {
    width: 78px;
    height: 28px;
    padding: 0 8px;
    text-align: center;
    font-size: 12px;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    color: var(--opt-text-primary, #1f2937);
    background-color: var(--opt-control-bg, #ffffff);
    border: 1px solid var(--opt-control-border, #d5dce6);
    border-radius: var(--opt-radius-control, 6px);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.16s, box-shadow 0.16s;
  }

  .page-size-input + .page-size-input {
    margin-left: 8px;
  }

  .page-size-input:hover {
    border-color: var(--opt-control-border-hover, #b8c4d4);
  }

  .page-size-input:focus {
    border-color: var(--opt-accent, #409eff);
    box-shadow: 0 0 0 2px var(--opt-focus-ring, rgba(64, 158, 255, 0.28));
  }

  .page-size-input::-webkit-inner-spin-button,
  .page-size-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .theme-preview-panel {
    margin-bottom: 4px;
    border: 1px solid var(--opt-border, #e5eaf3);
    border-radius: var(--opt-radius-inner, 8px);
    background: var(--opt-surface, #ffffff);
    overflow: hidden;
  }

  .theme-system-head {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 18px;
    padding: 14px 18px;
    margin-bottom: 0;
    background: var(--opt-stage-head-bg);
    box-shadow: inset 0 1px 0 var(--opt-stage-head-highlight);
    flex-wrap: wrap;
  }

  .theme-system-copy {
    flex: 1;
    min-width: 260px;
  }

  .theme-system-title {
    font-size: 14px;
    line-height: 1.4;
    font-weight: 600;
    color: var(--opt-text-primary, #1f2937);
  }

  .theme-system-desc {
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.55;
    color: var(--opt-text-muted, #6b7280);
    max-width: 560px;
  }

  .theme-selector-control {
    min-width: 220px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .theme-system-selector {
    width: min(240px, 100%);
  }

  .selector-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--opt-text-secondary, #4b5563);
  }

  .theme-series-select {
    width: 100%;
    height: 28px;
    padding: 0 24px 0 8px;
    font-size: 12px;
    font-family: inherit;
    color: var(--opt-text-primary, #1f2937);
    background-color: var(--opt-control-bg, #ffffff);
    border: 1px solid var(--opt-control-border, #d5dce6);
    border-radius: var(--opt-radius-control, 6px);
    outline: none;
    cursor: pointer;
    box-sizing: border-box;
    transition: border-color 0.16s, box-shadow 0.16s;
  }

  .theme-series-select:hover {
    border-color: var(--opt-control-border-hover, #b8c4d4);
  }

  .theme-series-select:focus {
    border-color: var(--opt-accent, #409eff);
    box-shadow: 0 0 0 2px var(--opt-focus-ring, rgba(64, 158, 255, 0.28));
  }

  .live-preview-shell {
    margin-bottom: 0;
    padding: 0;
    border-top: 1px solid var(--opt-border, #e5eaf3);
  }

  .preview-stage {
    position: relative;
    border-radius: 0;
    overflow: hidden;
    padding: 0;
    border: none;
    background: var(--opt-stage-bg);
    min-height: 560px;
  }

  .preview-stage-head {
    position: absolute;
    z-index: 2;
    top: 16px;
    left: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 0;
    pointer-events: none;
  }

  .preview-stage-grid {
    position: absolute;
    inset: 0;
    opacity: 0.45;
    background-image:
      linear-gradient(var(--opt-stage-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--opt-stage-grid) 1px, transparent 1px);
    background-size: 24px 24px;
    pointer-events: none;
  }

  .preview-mode-switch {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    border-radius: 999px;
    background: var(--opt-stage-pill-bg);
    border: 1px solid var(--opt-stage-pill-border);
    box-shadow: 0 10px 24px rgba(26, 38, 58, 0.08);
    pointer-events: auto;
  }

  .preview-mode-button {
    border: none;
    background: transparent;
    color: var(--opt-stage-pill-text);
    height: 32px;
    padding: 0 16px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  }

  .preview-mode-button.active {
    color: #ffffff;
    background: linear-gradient(135deg, #2f6dff 0%, #7b61ff 100%);
    box-shadow: 0 10px 20px rgba(82, 108, 255, 0.26);
  }

  .preview-mode-indicator {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 14px;
    border-radius: 999px;
    background: var(--opt-stage-pill-bg);
    border: 1px solid var(--opt-stage-pill-border);
    color: var(--opt-stage-pill-text);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    pointer-events: auto;
  }

  .popup-preview-wrapper {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 560px;
    padding: 72px 24px 40px;
    box-sizing: border-box;
  }

  .popup-preview {
    transform-origin: top center;
    transform: scale(0.92);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 24px 56px rgba(15, 23, 42, 0.22), 0 8px 24px rgba(15, 23, 42, 0.1);
    position: relative;
    background: var(--background-color, #ffffff);
    color: var(--content-file-color, #20262e);
  }

  .popup-shell {
    width: 100%;
    height: 100%;
    background: var(--background-color);
  }

  .popup-home {
    background-color: var(--background-color);
    overflow: hidden;
  }

  .popup-header {
    padding: 10px 7px 8px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    border-bottom: 1px solid var(--header-divider-color, var(--content-file-border-color));
    box-sizing: border-box;
  }

  .popup-search {
    flex: 1 1 212px;
    max-width: 360px;
    min-width: 0;
  }

  .popup-search .search-inner {
    height: 28px;
    border-radius: 8px;
    background-color: var(--header-search-background-color);
    color: var(--header-search-color);
    box-shadow: 0 0 0 1px var(--header-search-border-color) inset;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 7px;
    font-size: 13px;
    box-sizing: border-box;
  }

  .popup-search .search-inner:hover {
    box-shadow: 0 0 0 1px var(--header-search-hover-border-color) inset;
  }

  .popup-search .search-placeholder {
    opacity: 0.82;
  }

  .popup-search .search-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--header-icon-color);
  }

  .popup-header-operator {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
  }

  .popup-header-operator .header-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 8px;
    box-sizing: border-box;
    color: var(--header-icon-color);
    box-shadow: inset 0 0 0 1px transparent;
    transition: background-color .18s ease, box-shadow .18s ease, color .18s ease;
    cursor: pointer;
  }

  .popup-header-operator .header-button:hover {
    background-color: rgba(127, 127, 127, 0.12);
    box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.18);
    color: var(--header-icon-hover-color);
  }

  .popup-header-operator .header-button:active {
    background-color: rgba(127, 127, 127, 0.18);
    box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.24);
  }

  .popup-header-operator .icon-button {
    margin: 0;
    font-size: 19px;
  }

  .popup-content {
    height: calc(100% - 62px);
    margin: 12px 0 0 7px;
  }

  .preview-scroll {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 4px;
    box-sizing: border-box;
  }

  .popup-preview .file {
    --file-surface-color: var(--content-file-background-color);
    height: 74px;
    border-radius: 6px;
    margin-right: 4px;
    margin-bottom: 8px;
    border: 1px solid var(--content-file-border-color);
    background-color: var(--file-surface-color);
    overflow: hidden;
    color: var(--content-file-color);
    position: relative;
    box-shadow: 0 1px 2px 0 var(--content-file-shadow-color, rgba(0, 0, 0, .05));
    user-select: none;
    transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease;
  }

  .popup-preview .file:hover {
    --file-surface-color: var(--content-file-hover-background-color, var(--content-file-background-color));
    border-color: var(--content-file-hover-border-color, var(--content-file-border-color));
    background-color: var(--file-surface-color);
  }

  .popup-preview .file.is-hovered .content-operator-wrapper,
  .popup-preview .file:hover .content-operator-wrapper {
    display: inline-flex;
    align-items: center;
  }

  .popup-preview .file .icon {
    text-align: center;
    width: 52px;
    height: 100%;
    border-right: 1px solid var(--content-file-icon-border-right-color);
    float: left;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .popup-preview .progress-ring {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid var(--content-file-border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--content-file-filename-color);
    font-size: 10px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    box-sizing: border-box;
  }

  .popup-preview .file .file-content {
    width: calc(100% - 68px);
    float: right;
    padding: 7px 10px 0 0;
    box-sizing: border-box;
  }

  .popup-preview .file .filename {
    display: block;
    height: 20px;
    line-height: 20px;
    font-weight: 500;
    font-size: 13px;
    color: var(--content-file-filename-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .popup-preview .file .file-url {
    display: block;
    height: 20px;
    line-height: 20px;
    font-size: var(--content-file-url-font-size, 12px);
    font-family: var(--content-file-meta-font-family, inherit);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--content-file-url-color, var(--content-file-color));
  }

  .popup-preview .file .info {
    width: 100%;
    height: 25px;
    display: table;
    font-family: var(--content-file-meta-font-family, inherit);
    font-variant-numeric: tabular-nums;
    color: var(--content-file-muted-color, var(--content-file-content-color));
  }

  .popup-preview .file .info .small-size {
    transition: none;
    font-size: var(--content-file-info-font-size, 11.5px);
  }

  .popup-preview .file .info .cell {
    display: table-cell;
    vertical-align: middle;
  }

  .popup-preview .file .info .left {
    text-align: left;
  }

  .popup-preview .file .info .left.common {
    width: 118px;
  }

  .popup-preview .file .info .middle {
    text-align: center;
  }

  .popup-preview .file .info .middle.common {
    width: 80px;
  }

  .popup-preview .file .info .right {
    text-align: right;
  }

  .popup-preview .file .info .divider-sep {
    width: 16px;
    text-align: center;
    padding: 0 4px;
  }

  .popup-preview .file .content-operator-wrapper {
    position: absolute;
    top: 5px;
    right: 8px;
    height: 24px;
    padding-left: 18px;
    background-image: linear-gradient(90deg, transparent 0, var(--file-surface-color) 24%);
    z-index: 1;
    display: none;
  }

  .popup-preview .file .content-operator {
    position: relative;
    display: inline-flex;
    align-items: center;
    height: 100%;
  }

  .popup-preview .file .content-operator .icon-button {
    width: 24px;
    height: 24px;
    margin: 0 0 0 5px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    color: var(--header-icon-color);
    border-radius: 7px;
    background-color: transparent;
    box-shadow: inset 0 0 0 1px transparent;
    transition: background-color .18s ease, box-shadow .18s ease, color .18s ease;
    box-sizing: border-box;
  }

  .popup-preview .file .content-operator .icon-button:hover {
    color: var(--header-icon-hover-color);
    background-color: rgba(127, 127, 127, 0.12);
    box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.18);
  }

  .popup-preview .file .content-operator .icon-button:active {
    background-color: rgba(127, 127, 127, 0.18);
    box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.24);
  }
</style>
