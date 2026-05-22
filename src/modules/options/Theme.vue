<template>
  <div class="home" v-if="show">
    <h2 class="about title">{{i18data.themeTitle}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content" @click="setThemeAdaptation(!enableThemeAdaptation)">
          <span class="setting-title">{{i18data.themeAdaptation}}</span>
          <span class="setting-description">{{i18data.themeAdaptationDescription}}</span>
        </div>
        <div class="switch width">
          <el-radio-group v-model="theme" size="small">
            <el-radio-button value="auto">{{i18data.themeAdaptationOption1}}</el-radio-button>
            <el-radio-button value="light">{{i18data.themeAdaptationOption2}}</el-radio-button>
            <el-radio-button value="dark">{{i18data.themeAdaptationOption3}}</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </el-card>

    <h2 class="about title">{{i18data.iconTitle}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content">
          <span class="setting-title">{{i18data.iconColorSetting}}</span>
        </div>
        <div class="switch width icon">
          <el-tooltip :content="i18data.themeAdaptationOption2 + i18data.themeTitle"
                      placement="top" effect="dark" popper-class="tooltip" :enterable="false">
            <el-color-picker :model-value="iconColor['icon_color']['light']" size="small"
                             :class="theme === 'light' || theme === 'auto' ? 'color' : ''"
                             @change="setIconColor($event, 'icon_color', 'light')"/>
          </el-tooltip>
          <el-tooltip :content="i18data.themeAdaptationOption3 + i18data.themeTitle"
                      placement="top" effect="dark" popper-class="tooltip" :enterable="false">
            <el-color-picker :model-value="iconColor['icon_color']['dark']" size="small"
                             :class="theme === 'dark' || theme === 'auto' ? 'color' : ''"
                             @change="setIconColor($event, 'icon_color', 'dark')"/>
          </el-tooltip>
        </div>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content">
          <span class="setting-title">{{i18data.iconDownloadingColorSetting}}</span>
        </div>
        <div class="switch width icon">
          <el-tooltip :content="i18data.themeAdaptationOption2 + i18data.themeTitle"
                      placement="top" effect="dark" popper-class="tooltip" :enterable="false">
            <el-color-picker :model-value="iconColor['icon_downloading_color']['light']" size="small"
                             :class="theme === 'light' || theme === 'auto' ? 'color' : ''"
                             @change="setIconColor($event, 'icon_downloading_color', 'light')"/>
          </el-tooltip>
          <el-tooltip :content="i18data.themeAdaptationOption3 + i18data.themeTitle"
                      placement="top" effect="dark" popper-class="tooltip" :enterable="false">
            <el-color-picker :model-value="iconColor['icon_downloading_color']['dark']" size="small"
                             :class="theme === 'dark' || theme === 'auto' ? 'color' : ''"
                             @change="setIconColor($event, 'icon_downloading_color', 'dark')"/>
          </el-tooltip>
        </div>
      </div>
    </el-card>

    <h2 class="about title">{{i18data.downloadPanelTitle}}</h2>
    <el-card class="box-card theme-system-card" shadow="hover">
      <div class="item compact-item">
        <div class="content">
          <span class="setting-title">{{i18data.pageSize}}</span>
          <span class="setting-description">{{i18data.pageSizeDescription}}</span>
        </div>
        <div class="switch width page-size">
          <el-input-number v-model="downloadPanelPageSize.width" :controls="false"
                           :min="380" :max="800" size="small"></el-input-number>
          <el-input-number v-model="downloadPanelPageSize.height" :controls="false"
                           :min="300" :max="600" size="small"></el-input-number>
        </div>
      </div>

      <el-divider/>

      <section class="theme-preview-panel">
        <section class="theme-system-head">
          <div class="theme-system-copy">
            <div class="theme-system-title">{{i18data.themeSystemTitle}}</div>
            <div class="theme-system-desc">{{i18data.themeSystemDescription}}</div>
          </div>
          <div class="theme-selector-control theme-system-selector">
            <span class="selector-label">{{i18data.themeSeriesLabel}}</span>
            <el-select v-model="selectedThemeSeriesKey" size="small" @change="handlePreviewSeriesChange">
              <el-option v-for="series in themeSeries"
                         :key="series.key"
                         :label="series.title"
                         :value="series.key"></el-option>
            </el-select>
          </div>
        </section>

        <section class="live-preview-shell">
          <div class="preview-stage">
            <div class="preview-stage-grid"></div>
            <div class="preview-stage-head">
              <div v-if="theme === 'auto'" class="preview-mode-switch" role="tablist" :aria-label="i18data.themePreviewModeAriaLabel">
                <button type="button"
                        class="preview-mode-button"
                        :class="{ active: previewMode === 'light' }"
                        @click="setPreviewMode('light')">{{ getModeLabel('light') }}</button>
                <button type="button"
                        class="preview-mode-button"
                        :class="{ active: previewMode === 'dark' }"
                        @click="setPreviewMode('dark')">{{ getModeLabel('dark') }}</button>
              </div>
              <div v-else class="preview-mode-indicator">{{ getModeLabel(getEffectiveMode()) }}</div>
            </div>
            <div class="popup-preview-wrapper">
              <div class="popup-preview"
                   ref="popupPreview"
                   :style="{
                     width: fixedPreviewViewport.width + 'px',
                     height: fixedPreviewViewport.height + 'px',
                     ...previewThemeStyle
                   }">
                <div class="popup-shell">
                  <div class="home popup-home" :style="{ width: fixedPreviewViewport.width + 'px', height: popupBodyHeight + 'px' }">
                    <div class="header popup-header">
                      <div class="search popup-search">
                        <div class="search-inner">
                          <span class="search-placeholder"></span>
                          <span class="search-icon">⌕</span>
                        </div>
                      </div>
                      <div class="header-operator popup-header-operator">
                        <el-icon class="header-button icon-button"><Download /></el-icon>
                        <el-icon class="header-button icon-button"><Brush /></el-icon>
                        <el-icon class="header-button icon-button"><FolderOpened /></el-icon>
                        <el-icon class="header-button icon-button"><Position /></el-icon>
                        <el-icon class="header-button icon-button"><Setting /></el-icon>
                      </div>
                    </div>

                    <div class="content popup-content">
                      <div class="preview-scroll" :style="{ maxHeight: previewContentHeight + 'px' }">
                        <div class="file" v-for="file in previewFiles" :key="file.name" :class="file.previewClass">
                          <div class="icon">
                            <div class="progress-ring">
                              <div class="progress-ring-inner">{{ file.percent }}</div>
                            </div>
                          </div>
                          <div class="file-content">
                            <span class="filename">{{ file.name }}</span>
                            <span class="file-url">{{ file.url }}</span>
                            <div class="info">
                              <div class="cell left common">
                                <span class="receivedSize small-size">{{ file.received }}</span>
                                <span class="divider small-size">/</span>
                                <span class="size small-size">{{ file.total }}</span>
                              </div>
                              <div class="cell middle common">
                                <span class="speed small-size">{{ file.speed }}</span>
                              </div>
                              <div class="cell right common">
                                <span class="remaining small-size">{{ file.status }}</span>
                              </div>
                            </div>
                          </div>
                          <div class="content-operator-wrapper">
                            <div class="content-operator">
                              <el-icon class="icon-button"><FolderOpened /></el-icon>
                              <el-icon class="icon-button"><VideoPause /></el-icon>
                              <el-icon class="icon-button"><RefreshRight /></el-icon>
                              <el-icon class="icon-button"><Close /></el-icon>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </el-card>
  </div>
</template>

<script>
  /* eslint-disable no-undef */

  import { Brush, Close, Download, FolderOpened, Position, RefreshRight, Setting, VideoPause } from '@element-plus/icons-vue'
  import storage from '../../utils/storage'
  import common from '../../utils/common'

  const MIN_PREVIEW_WIDTH = 380
  const MAX_PREVIEW_WIDTH = 800
  const MIN_PREVIEW_HEIGHT = 300
  const MAX_PREVIEW_HEIGHT = 600
  export default {
    name: 'Theme',
    components: { Brush, Close, Download, FolderOpened, Position, RefreshRight, Setting, VideoPause },
    props: {
      i18data: Object
    },
    async mounted() {
      this.systemTheme = common.isInDarkMode() ? 'dark' : 'light'
      this.uiTheme = await storage.get('ui_theme') || ''
      this.uiThemeSeries = await storage.get('ui_theme_series') || ''
      this.theme = await storage.get('theme') || 'auto'

      const iconColor = await storage.get('icon_color')
      this.iconColor.icon_color = {
        light: '#000000',
        dark: '#989898',
        ...(iconColor || {})
      }

      const iconDownloadingColor = await storage.get('icon_downloading_color')
      this.iconColor.icon_downloading_color = {
        light: '#00d032',
        dark: '#ffa500',
        ...(iconDownloadingColor || {})
      }

      this.downloadPanelTheme = await storage.get('download_panel_theme') || 'light'

      const pageSize = await storage.get('download_panel_page_size')
      this.downloadPanelPageSize = {
        width: 400,
        height: 420,
        ...(pageSize || {})
      }

      await this.loadThemeData()
      this.initializeThemeSelection()
      this.show = true
    },
    data() {
      const i18n = common.i18data
      return {
        show: false,
        systemTheme: 'light',
        uiTheme: '',
        uiThemeSeries: '',
        theme: 'light',
        iconColor: {
          icon_color: {
            light: '#000000',
            dark: '#989898'
          },
          icon_downloading_color: {
            light: '#00d032',
            dark: '#ffa500'
          },
        },
        downloadPanelTheme: 'light',
        downloadPanelPageSize: {
          width: 400,
          height: 420
        },
        themeData: null,
        selectedThemeSeriesKey: 'basic',
        previewMode: 'light',
        previewFileTemplates: [
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
        ],
        themeSeries: [
          {
            key: 'terminal',
            title: i18n.themeSeriesTerminalTitle,
            desc: i18n.themeSeriesTerminalDescription,
            options: [
              { value: 'terminal-dark', previewClass: 'terminal-dark', label: i18n.themeSeriesTerminalDarkLabel, mode: 'dark', badge: i18n.themeSeriesTerminalDarkBadge, note: i18n.themeSeriesTerminalDarkNote },
              { value: 'terminal-light', previewClass: 'terminal-light', label: i18n.themeSeriesTerminalLightLabel, mode: 'light', badge: i18n.themeSeriesTerminalLightBadge, note: i18n.themeSeriesTerminalLightNote }
            ]
          },
          {
            key: 'github',
            title: i18n.themeSeriesGithubTitle,
            desc: i18n.themeSeriesGithubDescription,
            options: [
              { value: 'github-dark', previewClass: 'github-dark', label: i18n.themeSeriesGithubDarkLabel, mode: 'dark', badge: i18n.themeSeriesGithubBadge, note: i18n.themeSeriesGithubDarkNote },
              { value: 'github-light', previewClass: 'github-light', label: i18n.themeSeriesGithubLightLabel, mode: 'light', badge: i18n.themeSeriesGithubBadge, note: i18n.themeSeriesGithubLightNote }
            ]
          },
          {
            key: 'claude',
            title: i18n.themeSeriesClaudeTitle,
            desc: i18n.themeSeriesClaudeDescription,
            options: [
              { value: 'claude-dark', previewClass: 'claude-dark', label: i18n.themeSeriesClaudeDarkLabel, mode: 'dark', badge: i18n.themeSeriesClaudeBadge, note: i18n.themeSeriesClaudeDarkNote },
              { value: 'claude-light', previewClass: 'claude-light', label: i18n.themeSeriesClaudeLightLabel, mode: 'light', badge: i18n.themeSeriesClaudeBadge, note: i18n.themeSeriesClaudeLightNote }
            ]
          },
          {
            key: 'basic',
            title: i18n.themeSeriesBasicTitle,
            desc: i18n.themeSeriesBasicDescription,
            options: [
              { value: 'basic-dark', previewClass: 'basic-dark', label: i18n.themeSeriesBasicDarkLabel, mode: 'dark', badge: i18n.themeSeriesBasicBadge, note: i18n.themeSeriesBasicDarkNote },
              { value: 'basic-light', previewClass: 'basic-light', label: i18n.themeSeriesBasicLightLabel, mode: 'light', badge: i18n.themeSeriesBasicBadge, note: i18n.themeSeriesBasicLightNote }
            ]
          }
        ]
      }
    },
    watch: {
      async theme(val, oldVal) {
        await storage.set('theme', val)
        await this.setDownloadPanelTheme(val)
        this.systemTheme = common.isInDarkMode() ? 'dark' : 'light'
        this.syncPreviewModeWithTheme(val)

        const effective = val === 'auto' ? this.systemTheme : val
        if (this.systemTheme === 'dark') {
          if (!(oldVal === 'auto' && val === 'dark') && !(oldVal === 'dark' && val === 'auto')) {
            this.sendIconColorToBackground(effective)
          }
        } else {
          if (!(oldVal === 'auto' && val === 'light') && !(oldVal === 'light' && val === 'auto')) {
            this.sendIconColorToBackground(effective)
          }
        }

        if (this.uiThemeSeries) {
          this.syncRuntimeThemePreview(this.uiThemeSeries)
        }
      },
      downloadPanelPageSize: {
        handler(val) {
          const normalizedSize = this.normalizePreviewSize(val)
          if (normalizedSize.width !== val.width || normalizedSize.height !== val.height) {
            this.downloadPanelPageSize = normalizedSize
            return
          }
          storage.set('download_panel_page_size', normalizedSize)
        },
        deep: true
      }
    },
    computed: {
      enableThemeAdaptation() {
        return this.theme === 'auto'
      },
      previewFiles() {
        return this.previewFileTemplates.map(file => ({
          ...file,
          status: this.i18data.second.replace('{}', file.statusSeconds)
        }))
      },
      previewThemeStyle() {
        if (!this.themeData) {
          return {}
        }
        const themeName = this.getPreviewThemeName()
        return this.themeData[themeName] || {}
      },
      normalizedPreviewSize() {
        return this.normalizePreviewSize(this.downloadPanelPageSize)
      },
      fixedPreviewViewport() {
        return this.normalizedPreviewSize
      },
      popupBodyHeight() {
        return this.fixedPreviewViewport.height - 1
      },
      previewContentHeight() {
        return Math.max(this.popupBodyHeight - 62, 0)
      }
    },
    methods: {
      normalizePreviewSize(size) {
        const width = Math.min(Math.max(Number(size?.width) || 400, MIN_PREVIEW_WIDTH), MAX_PREVIEW_WIDTH)
        const height = Math.min(Math.max(Number(size?.height) || 420, MIN_PREVIEW_HEIGHT), MAX_PREVIEW_HEIGHT)
        return { width, height }
      },
      setThemeAdaptation(enable) {
        if (enable) {
          this.theme = 'auto'
          return
        }
        this.theme = common.isInDarkMode() ? 'dark' : 'light'
      },
      initializeThemeSelection() {
        const initialSeriesKey = this.uiThemeSeries || this.getThemeSeriesKey(this.uiTheme) || 'basic'
        this.uiThemeSeries = initialSeriesKey
        this.selectedThemeSeriesKey = initialSeriesKey
        this.syncPreviewModeWithTheme(this.theme)
      },
      getThemeSeriesKey(themeName) {
        if (!themeName || typeof themeName !== 'string') {
          return ''
        }
        if (themeName === 'light' || themeName === 'dark') {
          return 'basic'
        }
        return this.themeSeries.find(series => series.options.some(option => option.value === themeName))?.key || ''
      },
      getThemeNameByMode(seriesKey, mode) {
        const series = this.themeSeries.find(item => item.key === seriesKey)
        if (!series || !series.options.length) {
          return mode
        }
        const matchedOption = series.options.find(option => option.mode.toLowerCase() === mode)
        return (matchedOption || series.options[0]).value
      },
      syncPreviewModeWithTheme(theme) {
        if (theme === 'auto') {
          this.previewMode = 'light'
          return
        }
        this.previewMode = theme === 'dark' ? 'dark' : 'light'
      },
      setPreviewMode(mode) {
        if (this.theme !== 'auto') {
          return
        }
        this.previewMode = mode === 'dark' ? 'dark' : 'light'
      },
      getModeLabel(mode) {
        return mode === 'dark' ? this.i18data.themeAdaptationOption3 : this.i18data.themeAdaptationOption2
      },
      async handlePreviewSeriesChange() {
        await this.applyUIThemeSeries(this.selectedThemeSeriesKey)
      },
      async applyUIThemeSeries(seriesKey) {
        const normalizedSeriesKey = seriesKey || 'basic'
        this.uiThemeSeries = normalizedSeriesKey
        this.uiTheme = ''
        await storage.set('ui_theme_series', normalizedSeriesKey)
        await storage.set('ui_theme', '')
        await this.syncRuntimeThemePreview(normalizedSeriesKey)
      },
      async syncRuntimeThemePreview(seriesKey) {
        const themeName = this.getThemeNameByMode(seriesKey, this.getEffectiveMode())
        await this.setDownloadPanelTheme(this.getEffectiveMode())

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
      },
      getEffectiveMode() {
        return this.theme === 'auto' ? this.systemTheme : this.theme
      },
      setIconColor(val, type, theme) {
        this.iconColor[type][theme] = val
        const tmpTheme = common.isInDarkMode() ? 'dark' : 'light'
        if (((this.theme === 'auto' && tmpTheme === theme) || this.theme === theme)
          && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage(JSON.stringify({
            type: type,
            data: val
          }))
        }
        storage.set(type, this.iconColor[type])
      },
      sendIconColorToBackground(theme) {
        if (!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage)) {
          return
        }
        chrome.runtime.sendMessage(JSON.stringify({
          type: 'icon_color',
          data: this.iconColor.icon_color[theme]
        }))
        chrome.runtime.sendMessage(JSON.stringify({
          type: 'icon_downloading_color',
          data: this.iconColor.icon_downloading_color[theme]
        }))
      },
      setDownloadPanelTheme(theme) {
        this.downloadPanelTheme = theme
        return storage.set('download_panel_theme', theme)
      },
      async loadThemeData() {
        try {
          const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
            ? chrome.runtime.getURL('/theme/theme.json')
            : '/theme/theme.json'
          const response = await fetch(url)
          this.themeData = await response.json()
        } catch (e) {
          console.warn('Failed to load theme.json', e)
          this.themeData = {}
        }
      },
      getPreviewThemeName() {
        const previewMode = this.theme === 'auto' ? this.previewMode : this.getEffectiveMode()
        return this.getThemeNameByMode(this.selectedThemeSeriesKey, previewMode)
      }
    }
  }
</script>

<style scoped rel="stylesheet/css">
  .home {
    height: 100%;
    width: 100%;
    max-width: 960px;
    padding: 20px;
    box-sizing: border-box;
    --settings-card-radius: var(--el-card-border-radius, var(--el-border-radius-base, 4px));
  }

  .title {
    font-size: 15px;
  }

  .box-card {
    width: 100%;
    max-width: 920px;
    margin-bottom: 36px;
    border-radius: var(--settings-card-radius);
    box-sizing: border-box;
  }

  .box-card :deep(.el-card__body) {
    padding: 16px 18px;
  }

  .box-card .item {
    display: table;
    height: 100%;
    font-size: 14px;
    width: 100%;
    padding: 4px;
    box-sizing: border-box;
  }

  .box-card .item.pointer:hover {
    cursor: pointer;
  }

  .box-card .item .content {
    display: table-cell;
    width: 500px;
    vertical-align: middle;
  }

  .box-card .item .content .setting-title {
    display: block;
    font-weight: 600;
    color: #20262e;
  }

  .box-card .item .content .setting-description {
    display: block;
    color: #7b8694;
    font-size: 12px;
    margin-top: 4px;
    line-height: 1.55;
  }

  .box-card .item .content .link {
    color: #ff8740;
    cursor: pointer;
    text-decoration: underline;
  }

  .box-card .item .switch {
    text-align: right;
    display: table-cell;
    vertical-align: middle;
    padding-right: 4px;
  }

  .box-card .item .switch.width {
    width: 362px;
  }

  .box-card .item .switch.icon :deep(.el-color-picker:first-child) {
    margin-right: 16px;
  }

  .box-card .item .switch.icon :deep(.el-color-picker.color .el-color-picker__trigger) {
    border-color: #5ba2ff;
  }

  .box-card :deep(.el-radio-button__inner) {
    padding: 6px 18px;
    font-size: 12px;
    border-radius: 0 !important;
  }

  .box-card :deep(.el-divider--horizontal) {
    margin: 14px 0 !important;
    height: 0.5px !important;
  }

  .compact-item {
    align-items: center;
  }

  .page-size :deep(.el-input-number) {
    width: 78px;
    margin-left: 0;
  }

  .page-size :deep(.el-input-number + .el-input-number) {
    margin-left: 8px;
  }

  .page-size :deep(.el-input__inner) {
    border-radius: 10px;
  }

  .theme-preview-panel {
    margin-bottom: 22px;
    border: 1px solid #e7ecf4;
    border-radius: var(--settings-card-radius);
    background: #ffffff;
    overflow: hidden;
  }

  .theme-system-head {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 18px;
    padding: 14px 18px;
    margin-bottom: 0;
    background:
      linear-gradient(135deg, rgba(123, 97, 255, 0.05) 0%, rgba(64, 158, 255, 0.04) 100%),
      linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
    flex-wrap: wrap;
  }

  .theme-system-copy {
    flex: 1;
    min-width: 260px;
  }

  .theme-system-title {
    font-size: 15px;
    line-height: 1.35;
    font-weight: 600;
    color: #20262e;
  }

  .theme-system-desc {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.55;
    color: #7b8694;
    max-width: 560px;
  }

  .theme-meta-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
  }

  .theme-meta-item {
    min-width: 118px;
    padding: 10px 12px;
    border-radius: var(--settings-card-radius);
    background: linear-gradient(180deg, #fbfcfe 0%, #f3f6fb 100%);
    border: 1px solid #e7ecf4;
  }

  .meta-label {
    display: block;
    font-size: 11px;
    color: #8a93a0;
    margin-bottom: 4px;
  }

  .meta-value {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: #20262e;
    text-transform: capitalize;
  }

  .theme-hero-actions {
    width: min(200px, 100%);
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex-shrink: 0;
  }

  .scale-panel {
    border: 1px solid #e7ecf4;
    background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%);
    border-radius: var(--settings-card-radius);
    padding: 12px 14px;
  }

  .fixed-panel {
    min-height: 88px;
  }

  .scale-label,
  .scale-value,
  .scale-hint {
    display: block;
    font-size: 12px;
    color: #5c6775;
  }

  .scale-label {
    font-weight: 600;
    margin-bottom: 10px;
  }

  .scale-value {
    margin-top: 4px;
    font-weight: 700;
    color: #20262e;
  }

  .scale-hint {
    margin-top: 8px;
    line-height: 1.5;
    color: #7b8694;
  }

  .live-preview-shell {
    margin-bottom: 0;
    padding: 0;
    border-top: 1px solid #e7ecf4;
  }

  .theme-system-selector {
    width: min(240px, 100%);
  }

  .preview-stage {
    position: relative;
    border-radius: 0;
    overflow: hidden;
    padding: 0;
    border: none;
    background: radial-gradient(circle at top left, #ffffff 0%, #f5f8ff 46%, #eef3fb 100%);
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
      linear-gradient(rgba(125, 145, 180, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(125, 145, 180, 0.08) 1px, transparent 1px);
    background-size: 24px 24px;
    pointer-events: none;
  }

  .preview-stage-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.84);
    border: 1px solid rgba(160, 175, 201, 0.28);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #5c6775;
  }

  .preview-mode-switch {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.78);
    border: 1px solid rgba(160, 175, 201, 0.3);
    box-shadow: 0 10px 24px rgba(26, 38, 58, 0.08);
    pointer-events: auto;
  }

  .preview-mode-button {
    border: none;
    background: transparent;
    color: #647084;
    height: 34px;
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
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.78);
    border: 1px solid rgba(160, 175, 201, 0.3);
    color: #556173;
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
    border-radius: 24px;
    overflow: hidden;
    box-shadow: 0 24px 56px rgba(33, 43, 60, 0.16), 0 8px 24px rgba(33, 43, 60, 0.08);
    position: relative;
    background: var(--background-color, #ffffff);
    color: var(--content-file-color, #20262e);
  }

  .preview-window-chrome {
    height: 26px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 14px;
    background: rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(130, 145, 170, 0.12);
  }

  .preview-window-chrome span {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: rgba(130, 145, 170, 0.28);
  }

  .preview-popup-header {
    height: 74px;
    padding: 16px 18px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--header-border-color, rgba(0,0,0,0.06));
    background: var(--header-background-color, rgba(255,255,255,0.88));
  }

  .preview-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .preview-brand-mark {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: #fff;
    background: linear-gradient(135deg, #7b61ff 0%, #409eff 100%);
    box-shadow: 0 10px 24px rgba(123, 97, 255, 0.28);
  }

  .brand-title {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.15;
    color: var(--content-text-color, #20262e);
  }

  .brand-subtitle {
    font-size: 11px;
    text-transform: capitalize;
    color: var(--secondary-text-color, #7b8694);
    margin-top: 4px;
  }

  .preview-header-icons {
    display: flex;
    gap: 8px;
  }

  .preview-icon {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    border-radius: 10px;
    border: 1px solid var(--header-icon-border-color, rgba(0,0,0,0.08));
    background: var(--header-icon-background-color, rgba(255,255,255,0.75));
    color: var(--header-icon-color, inherit);
  }

  .preview-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 18px 0;
  }

  .preview-search {
    flex: 1;
    height: 40px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    padding: 0 14px;
    background: var(--search-background-color, rgba(0, 0, 0, 0.04));
    border: 1px solid var(--search-border-color, rgba(0, 0, 0, 0.05));
  }

  .preview-search-icon {
    font-size: 13px;
    margin-right: 10px;
    opacity: 0.7;
  }

  .preview-search-input {
    font-size: 13px;
    color: var(--secondary-text-color, #7b8694);
  }

  .preview-toolbar-pill {
    padding: 8px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    color: var(--secondary-text-color, #7b8694);
    background: var(--tag-background-color, rgba(0,0,0,0.04));
    border: 1px solid var(--tag-border-color, rgba(0,0,0,0.05));
  }

  .preview-popup-content {
    padding: 14px 18px 18px;
  }

  .preview-section-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--secondary-text-color, #8a93a0);
    margin-bottom: 12px;
    font-weight: 700;
  }

  .preview-file {
    position: relative;
    min-height: 92px;
    border-radius: 18px;
    margin-bottom: 12px;
    border: 1px solid var(--content-file-border-color, rgba(0,0,0,0.06));
    background: var(--content-file-background-color, rgba(255,255,255,0.88));
    display: flex;
    align-items: stretch;
    box-shadow: 0 8px 20px rgba(20, 26, 38, 0.05);
    overflow: hidden;
  }

  .preview-file.is-active {
    transform: translateY(0);
  }

  .preview-file-accent {
    width: 4px;
    background: var(--progress-bar-color, #409eff);
  }

  .preview-file-icon {
    width: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: var(--content-file-icon-color, inherit);
  }

  .preview-file-info {
    flex: 1;
    padding: 14px 12px 12px 0;
    min-width: 0;
  }

  .preview-file-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 4px;
  }

  .preview-file-name {
    font-weight: 700;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--content-file-name-color, inherit);
  }

  .preview-file-percent {
    font-size: 11px;
    font-weight: 700;
    color: var(--progress-bar-color, #409eff);
  }

  .preview-file-url {
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 10px;
    opacity: 0.78;
    color: var(--content-file-url-color, inherit);
  }

  .preview-file-progress {
    height: 6px;
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 8px;
    background: var(--progress-track-color, rgba(64, 158, 255, 0.14));
  }

  .preview-file-progress-bar {
    height: 100%;
    border-radius: 999px;
    background: var(--progress-bar-color, #409eff);
  }

  .preview-file-foot {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--secondary-text-color, #7b8694);
  }

  .preview-file-actions {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    padding: 10px 12px 10px 0;
  }

  .preview-file-action {
    width: 28px;
    height: 28px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    background: var(--action-button-background-color, rgba(0,0,0,0.04));
    color: var(--action-button-color, inherit);
    border: 1px solid var(--action-button-border-color, rgba(0,0,0,0.05));
  }

  .preview-file-action.danger {
    color: #ff5c5c;
  }

  .theme-series {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .series-group {
    border-top: 1px solid #eef2f7;
    padding-top: 20px;
  }

  .series-group:first-child {
    border-top: none;
    padding-top: 0;
  }

  .series-title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 14px;
  }

  .series-title {
    font-size: 18px;
    font-weight: 700;
    color: #20262e;
  }

  .series-desc {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.6;
    color: #7b8694;
  }

  .theme-selector-control {
    min-width: 220px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .selector-label {
    font-size: 12px;
    font-weight: 600;
    color: #5c6775;
  }

  .selection-meta-list {
    margin-bottom: 0;
  }

  .theme-actions-row {
    margin-top: 16px;
  }

  .theme-actions-hint {
    font-size: 12px;
    line-height: 1.6;
    color: #7b8694;
  }

  .theme-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .single-grid {
    grid-template-columns: 1fr;
  }

  .theme-option {
    position: relative;
    padding: 14px;
    border-radius: var(--settings-card-radius);
    border: 1px solid #e8edf5;
    background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
    cursor: pointer;
    transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  }

  .theme-option:hover {
    transform: translateY(-3px);
    border-color: #cdd8ea;
    box-shadow: 0 18px 34px rgba(26, 38, 58, 0.08);
  }

  .theme-option.active {
    border-color: rgba(123, 97, 255, 0.42);
    box-shadow: 0 20px 40px rgba(123, 97, 255, 0.14);
    background: linear-gradient(180deg, #ffffff 0%, #f7f4ff 100%);
  }

  .theme-option.previewing {
    border-color: rgba(64, 158, 255, 0.34);
    box-shadow: 0 16px 32px rgba(64, 158, 255, 0.12);
  }

  .theme-option.active::after {
    content: '✓';
    position: absolute;
    top: 14px;
    right: 14px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(135deg, #7b61ff 0%, #409eff 100%);
    box-shadow: 0 8px 18px rgba(123, 97, 255, 0.28);
  }

  .option-topline {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .theme-badge,
  .theme-state {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
  }

  .theme-badge {
    background: #f3f6fb;
    color: #5c6775;
    border: 1px solid #e1e7f0;
  }

  .theme-state {
    background: rgba(123, 97, 255, 0.08);
    color: #6f57ea;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .theme-preview {
    width: 100%;
    height: 122px;
    border-radius: var(--settings-card-radius);
    margin-bottom: 12px;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.06);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
  }

  .mini-ui {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .mini-ui .preview-header {
    height: 28px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    font-size: 9px;
    font-weight: 700;
    border-bottom: 1px solid;
  }

  .mini-ui .preview-item {
    flex: 1;
    padding: 10px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .mini-ui .preview-filename {
    font-size: 10px;
    font-weight: 700;
    margin-bottom: 5px;
  }

  .mini-ui .preview-progress {
    height: 5px;
    border-radius: 999px;
    margin-bottom: 5px;
    overflow: hidden;
  }

  .mini-ui .preview-progress-bar {
    height: 100%;
  }

  .mini-ui .preview-size {
    font-size: 8px;
    opacity: 0.8;
  }

  .theme-option-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .theme-label {
    font-size: 14px;
    font-weight: 700;
    color: #20262e;
  }

  .theme-note {
    font-size: 12px;
    line-height: 1.55;
    color: #7b8694;
  }

  .featured-group .theme-option {
    padding: 16px;
  }

  .hero-option .theme-preview {
    height: 132px;
  }

  .theme-preview.follow-mode {
    background: linear-gradient(135deg, #f8fbff 0%, #eef3fb 100%);
    color: #586474;
  }

  .theme-preview.follow-mode .preview-header {
    background: rgba(255,255,255,0.58);
    border-bottom-color: rgba(182, 193, 209, 0.8);
  }

  .theme-preview.follow-mode .preview-progress {
    background: rgba(64, 158, 255, 0.16);
  }

  .theme-preview.follow-mode .preview-progress-bar {
    background: #409eff;
  }

  .theme-preview.terminal-dark {
    background: linear-gradient(135deg, #0a0e14 0%, #141b22 100%);
    color: #00ff7a;
    border-color: rgba(0, 255, 122, 0.2);
  }

  .theme-preview.terminal-dark .preview-header {
    background: rgba(3, 10, 14, 0.88);
    border-bottom-color: rgba(0, 255, 122, 0.25);
  }

  .theme-preview.terminal-dark .preview-progress {
    background: rgba(0, 255, 122, 0.16);
  }

  .theme-preview.terminal-dark .preview-progress-bar {
    background: #00ff7a;
  }

  .theme-preview.terminal-light {
    background: linear-gradient(135deg, #eef7f1 0%, #dfece3 100%);
    color: #0d7a46;
    border-color: rgba(13, 122, 70, 0.16);
  }

  .theme-preview.terminal-light .preview-header {
    background: rgba(255,255,255,0.6);
    border-bottom-color: rgba(13, 122, 70, 0.2);
  }

  .theme-preview.terminal-light .preview-progress {
    background: rgba(13, 122, 70, 0.14);
  }

  .theme-preview.terminal-light .preview-progress-bar {
    background: #0d7a46;
  }

  .theme-preview.github-dark {
    background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
    color: #9ecbff;
    border-color: rgba(88, 166, 255, 0.16);
  }

  .theme-preview.github-dark .preview-header {
    background: rgba(13, 17, 23, 0.86);
    border-bottom-color: rgba(88, 166, 255, 0.18);
  }

  .theme-preview.github-dark .preview-progress {
    background: rgba(88, 166, 255, 0.16);
  }

  .theme-preview.github-dark .preview-progress-bar {
    background: #58a6ff;
  }

  .theme-preview.github-light {
    background: linear-gradient(135deg, #ffffff 0%, #f6f8fa 100%);
    color: #0969da;
    border-color: rgba(9, 105, 218, 0.12);
  }

  .theme-preview.github-light .preview-header {
    background: rgba(255,255,255,0.86);
    border-bottom-color: rgba(9, 105, 218, 0.16);
  }

  .theme-preview.github-light .preview-progress {
    background: rgba(9, 105, 218, 0.12);
  }

  .theme-preview.github-light .preview-progress-bar {
    background: #0969da;
  }

  .theme-preview.claude-dark {
    background: linear-gradient(135deg, #241811 0%, #3d2418 100%);
    color: #f3b394;
    border-color: rgba(243, 179, 148, 0.15);
  }

  .theme-preview.claude-dark .preview-header {
    background: rgba(36, 24, 17, 0.85);
    border-bottom-color: rgba(243, 179, 148, 0.16);
  }

  .theme-preview.claude-dark .preview-progress {
    background: rgba(243, 179, 148, 0.14);
  }

  .theme-preview.claude-dark .preview-progress-bar {
    background: #cc785c;
  }

  .theme-preview.claude-light {
    background: linear-gradient(135deg, #f7f1ea 0%, #eee5dc 100%);
    color: #b4634a;
    border-color: rgba(180, 99, 74, 0.12);
  }

  .theme-preview.claude-light .preview-header {
    background: rgba(255, 251, 246, 0.78);
    border-bottom-color: rgba(180, 99, 74, 0.14);
  }

  .theme-preview.claude-light .preview-progress {
    background: rgba(204, 120, 92, 0.14);
  }

  .theme-preview.claude-light .preview-progress-bar {
    background: #cc785c;
  }

  .theme-preview.basic-dark {
    background: linear-gradient(135deg, #171c22 0%, #2a3340 100%);
    color: #9dc5ff;
    border-color: rgba(76, 140, 255, 0.16);
  }

  .theme-preview.basic-dark .preview-header {
    background: rgba(23, 28, 34, 0.84);
    border-bottom-color: rgba(76, 140, 255, 0.16);
  }

  .theme-preview.basic-dark .preview-progress {
    background: rgba(76, 140, 255, 0.14);
  }

  .theme-preview.basic-dark .preview-progress-bar {
    background: #4c8cff;
  }

  .theme-preview.basic-light {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    color: #3b82f6;
    border-color: rgba(59, 130, 246, 0.12);
  }

  .theme-preview.basic-light .preview-header {
    background: rgba(255,255,255,0.84);
    border-bottom-color: rgba(59, 130, 246, 0.12);
  }

  .theme-preview.basic-light .preview-progress {
    background: rgba(59, 130, 246, 0.12);
  }

  .theme-preview.basic-light .preview-progress-bar {
    background: #3b82f6;
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
    gap: 8px;
    border-bottom: 1px solid var(--header-divider-color, var(--content-file-border-color));
    box-sizing: border-box;
  }

  .popup-search {
    flex: 1 1 212px;
    max-width: 232px;
    min-width: 0;
  }

  .popup-search .search-inner {
    height: 28px;
    border-radius: 18px;
    background-color: var(--header-search-background-color);
    color: var(--header-search-color);
    box-shadow: 0 0 0 1px var(--header-search-border-color) inset;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 11px 0 13px;
    font-size: 13px;
    box-sizing: border-box;
    transition: box-shadow 0ms;
  }

  .popup-search .search-inner:hover {
    box-shadow: 0 0 0 1px var(--header-search-hover-border-color) inset;
  }

  .popup-search .search-placeholder {
    opacity: 0.82;
  }

  .popup-search .search-icon {
    font-size: 14px;
    opacity: 0.7;
  }

  .popup-header-operator {
    display: flex;
    align-items: center;
  }

  .popup-header-operator .header-button {
    display: inline-flex;
    width: 30px;
    height: 30px;
    padding: 0;
    border-radius: 8px;
    box-sizing: border-box;
    color: var(--header-icon-color);
    box-shadow: inset 0 0 0 1px transparent;
    transition: background-color .18s ease, box-shadow .18s ease, color .18s ease;
    cursor: pointer;
  }

  .popup-header-operator .header-button:hover,
  .popup-header-operator .header-button:focus-visible {
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
    color: inherit;
    cursor: pointer;
    transition: .2s;
  }

  .popup-header-operator .icon-button:hover {
    color: inherit;
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
  .popup-preview .file.is-hovered .content-operator-wrapper {
    display: inline-block;
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
    font-weight: 600;
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
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--content-file-url-color, var(--content-file-color));
  }

  .popup-preview .file .info {
    width: 100%;
    height: 25px;
    display: table;
    color: var(--content-file-muted-color, var(--content-file-content-color));
  }

  .popup-preview .file .info .small-size {
    transition: none;
    font-size: 12px;
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

  .popup-preview .file .info .divider {
    width: 16px;
    text-align: center;
    padding: 0 4px;
  }

  .popup-preview .file .content-operator-wrapper {
    position: absolute;
    top: 0;
    right: 8px;
    height: 30px;
    line-height: 38px;
    padding-left: 18px;
    background-image: linear-gradient(90deg, transparent 0, var(--file-surface-color) 24%);
    z-index: 1;
    display: none;
  }

  .popup-preview .file .content-operator {
    position: relative;
    float: right;
  }

  .popup-preview .file .content-operator .icon-button {
    width: 24px;
    height: 24px;
    margin: 0 0 0 5px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px !important;
    color: var(--header-icon-color);
    border-radius: 7px;
    background-color: transparent;
    box-shadow: inset 0 0 0 1px transparent;
    transition: background-color .18s ease, box-shadow .18s ease, color .18s ease;
    box-sizing: border-box;
  }

  .popup-preview .file .content-operator .icon-button:hover,
  .popup-preview .file .content-operator .icon-button:focus-visible {
    color: var(--header-icon-hover-color);
    background-color: rgba(127, 127, 127, 0.12);
    box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.18);
  }

  .popup-preview .file .content-operator .icon-button:active {
    background-color: rgba(127, 127, 127, 0.18);
    box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.24);
  }
</style>
