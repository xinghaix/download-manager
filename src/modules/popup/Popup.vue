<template>
  <div class="home" id="home" :style="{width: downloadPanelPageSize.width + 'px',
                                      height: downloadPanelPageSize.height - 1 + 'px'}">
    <div class="header">
      <el-input class="search" size="small" v-model="searchContent">
        <template #suffix>
          <el-icon class="search-icon"><Search /></el-icon>
        </template>
      </el-input>
      <div class="header-operator">
        <el-popover ref="openDownload" placement="bottom" :width="openDownloadPopoverWidth" trigger="manual"
                    popper-class="open-download-popover"
                    v-model:visible="showPopover" @after-enter="textareaFocus">
          <el-input type="textarea" :clearable="true" resize="none"
                    :autosize="{ minRows: 1, maxRows: 4 }"
                    :placeholder="i18data.newDownloadPlaceholder"
                    v-model="downloadUrl" @keydown.enter.prevent="enterToDownload(downloadUrl)">
          </el-input>
          <template #reference>
            <span class="header-button header-popover-trigger"
                  :title="closeTooltip ? '' : i18data.newDownload"
                  @click.stop="toggleOpenDownload">
              <el-icon class="icon-button"><Download /></el-icon>
            </span>
          </template>
        </el-popover>
        <div class="musk" v-if="showMusk" @click="() => { this.showMusk = false; this.showPopover = false }"/>
        <el-tooltip :disabled="closeTooltip" :content="i18data.clearAll"
                    placement="bottom" effect="dark" popper-class="tooltip header-tooltip" :enterable="false">
          <el-dropdown class="header-dropdown" trigger="click" @command="clearDropdownCommand">
            <span class="header-button header-dropdown-trigger">
              <el-icon class="icon-button"><Brush /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="clearAll">{{i18data.clearAll}}</el-dropdown-item>
                <el-dropdown-item command="deleteAll">{{i18data.deleteAll}}</el-dropdown-item>
                <el-dropdown-item command="clearFailed">{{i18data.clearFailed}}</el-dropdown-item>
                <el-dropdown-item command="clearAbsent">{{i18data.clearAbsent}}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.openDownloadFolder"
                    placement="bottom" effect="dark" popper-class="tooltip header-tooltip" :enterable="false">
          <el-icon class="header-button icon-button" @click="openFolder"><FolderOpened /></el-icon>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.openHome"
                    placement="bottom" effect="dark" popper-class="tooltip header-tooltip" :enterable="false">
          <el-icon class="header-button icon-button" @click="openHome"><Position /></el-icon>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.openSettings"
                    placement="bottom" effect="dark" popper-class="tooltip header-tooltip" :enterable="false">
          <el-icon class="header-button icon-button" @click="openOptions"><Setting /></el-icon>
        </el-tooltip>
      </div>
    </div>

    <div class="content">
      <RecycleScroller id="vue-recycle-scroller" :key="recycleScrollerKey" :items="filteredDownloadItems"
                       :item-size="84" key-field="id" v-slot="{ item }">
        <transition :enter-active-class="enableAnimation ? 'transition-enter' : ''"
                    :leave-active-class="enableAnimation ? 'transition-leave' : ''">
          <file class="file" :item="item" :key="item.id"
                :render="render" :erase="erase" :copyToClipboard="copyToClipboard"
                :i18data="i18data" :close-tooltip="closeTooltip" :left-click-file="leftClickFile"
                :left-click-url="leftClickUrl" :right-click-file="rightClickFile" :right-click-url="rightClickUrl"/>
        </transition>
      </RecycleScroller>
      <el-backtop target=".content #vue-recycle-scroller" visibilityHeight="70"/>
      <tip :text="i18data.copied" :position="tipPosition" v-model:showTip="showCopiedTip"/>
    </div>
  </div>
</template>

<!--suppress UnterminatedStatementJS, JSUnresolvedVariable, ES6ModulesDependencies, JSUnresolvedFunction -->
<script>
  /* eslint-disable no-undef */
  import common from '../../utils/common'
  import storage from '../../utils/storage'
  import { deleteCachedFileIcon } from '../../utils/fileIconCache'
  import File from './File'
  import Tip from '../../components/Tip'

  const DOWNLOADS_PROJECTION_KEY = 'downloads_projection'

  export default {
    name: 'Popup',
    components: {File, Tip},
    async created() {
      this.runtimeMessageListener = (message => {
        if (typeof message !== 'string') {
          return
        }

        let received
        try {
          received = JSON.parse(message)
        } catch (e) {
          return
        }

        if (received.type === 'ui_theme_changed') {
          this.setTheme(received.data)
        }
      })
      chrome.runtime.onMessage.addListener(this.runtimeMessageListener)

      this.storageChangeListener = (changes, areaName) => {
        if (areaName !== 'session') {
          return
        }
        const projectionChange = changes[DOWNLOADS_PROJECTION_KEY]
        if (!projectionChange || !projectionChange.newValue) {
          return
        }
        if (Array.isArray(projectionChange.newValue.removedIds) && projectionChange.newValue.removedIds.length > 0) {
          this.render()
          return
        }
        this.applyDownloadsProjection(projectionChange.newValue)
      }
      chrome.storage.onChanged.addListener(this.storageChangeListener)

      // 获取页面大小
      this.checkPageSize(await storage.get('download_panel_page_size'))

      // 从本地json文件中获取主题数据
      const themeUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
        ? chrome.runtime.getURL('/theme/theme.json')
        : '/theme/theme.json'
      this.themeData = await new Promise(resolve => {
        fetch(themeUrl).then(r => resolve(r.json()))
      })

      await this.applyStoredTheme()

      // 监听浏览器的颜色模式（在自适应系列或未设置旧版 UI 主题时生效）
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', async (e) => {
        const theme = await storage.get('theme')
        if (theme !== 'auto') {
          return
        }

        const uiThemeSeries = await storage.get('ui_theme_series')
        let uiTheme = await storage.get('ui_theme')
        if (uiThemeSeries && this.themeData && this.themeData[`${uiThemeSeries}-${e.matches ? 'dark' : 'light'}`]) {
          this.setTheme(`${uiThemeSeries}-${e.matches ? 'dark' : 'light'}`)
          return
        }
        if (!uiTheme) {
          this.setTheme(e.matches ? 'dark' : 'light')
        }
      })
    },
    async mounted() {
      // 初始化插件设置
      this.closeTooltip = await storage.get('close_tooltip')
      this.leftClickFile = await storage.get('left_click_file')
      this.rightClickFile = await storage.get('right_click_file')
      this.leftClickUrl = await storage.get('left_click_url')
      this.rightClickUrl = await storage.get('right_click_url')
      // 开启文件移入移出动画
      this.enableAnimation = await storage.get('enable_animation')

      const projection = await storage.getSession(DOWNLOADS_PROJECTION_KEY)
      this.applyDownloadsProjection(projection, { allowInsertStates: ['in_progress'] })

      // 获取下载文件信息
      await this.render()
    },
    beforeUnmount() {
      if (this.runtimeMessageListener) {
        chrome.runtime.onMessage.removeListener(this.runtimeMessageListener)
      }
      if (this.storageChangeListener) {
        chrome.storage.onChanged.removeListener(this.storageChangeListener)
      }
    },
    data() {
      return {
        chromeDownloadPageUrl: 'chrome://downloads',

        downloadPanelPageSize: {
          width: '400',
          height: '420'
        },

        searchContent: '',
        downloadUrl: '',
        downloadItems: [],
        showMusk: false,

        i18data: common.i18data,

        showPopover: false,

        // 复制文件名和文件链接时的弹框设置
        tipPosition: {x: 0, y: 0},
        showCopiedTip: false,

        // 插件设置
        // 鼠标移动到按钮上时是否展示提示信息
        closeTooltip: true,
        leftClickFile: true,
        leftClickUrl: true,
        rightClickFile: true,
        rightClickUrl: true,
        enableAnimation: false,

        themeData: null,
        downloadItemIndexMap: new Map(),
        downloadUpdateVersion: 0,
        renderRequestId: 0
      }
    },
    computed: {
      filteredDownloadItems() {
        const keyword = this.searchContent.trim().toLowerCase()
        if (!keyword) {
          return this.downloadItems
        }
        return this.downloadItems.filter(item => item.basename.toLowerCase().indexOf(keyword) > -1)
      },
      openDownloadPopoverWidth() {
        return Math.max(Number(this.downloadPanelPageSize.width) - 40, 280)
      },
      recycleScrollerKey() {
        return `${this.downloadUpdateVersion}-${this.filteredDownloadItems.length}`
      }
    },
    watch: {
      /**
       * 手动下载文件弹框展示或取消时触发
       * @param val {Boolean}
       */
      showPopover(val) {
        if (val) {
          this.showMusk = true
        } else {
          this.downloadUrl = ''
          this.showMusk = false
        }
      }
    },
    methods: {
      applyDownloadsProjection(projection, options = {}) {
        if (!projection || typeof projection !== 'object') {
          return
        }

        this.downloadUpdateVersion++

        if (Array.isArray(projection.removedIds)) {
          projection.removedIds.forEach(id => this.removeItemById(id))
        }

        const itemsById = projection.itemsById && typeof projection.itemsById === 'object'
          ? projection.itemsById
          : {}

        Object.values(itemsById).forEach(item => {
          if (item) {
            this.upsertDownloadItem(item, options)
          }
        })
      },

      async getStoredEffectiveMode() {
        const theme = await storage.get('theme')
        if (theme === 'dark' || theme === 'light') {
          return theme
        }
        return common.isInDarkMode() ? 'dark' : 'light'
      },
      async getStoredThemeName() {
        const effectiveMode = await this.getStoredEffectiveMode()
        const uiThemeSeries = await storage.get('ui_theme_series')
        const uiTheme = await storage.get('ui_theme')

        if (uiThemeSeries && this.themeData && this.themeData[`${uiThemeSeries}-${effectiveMode}`]) {
          return `${uiThemeSeries}-${effectiveMode}`
        }

        if (uiTheme && this.themeData && this.themeData[uiTheme]) {
          return uiTheme
        }

        let downloadPanelTheme = await storage.get('download_panel_theme')
        if (downloadPanelTheme !== 'dark' && downloadPanelTheme !== 'light') {
          downloadPanelTheme = effectiveMode
        }
        return downloadPanelTheme
      },
      async applyStoredTheme() {
        this.setTheme(await this.getStoredThemeName())
      },
      checkPageSize(downloadPanelPageSize) {
        if (downloadPanelPageSize) {
          let width = downloadPanelPageSize.width
          if (width < 380) {
            width = 380
          }
          if (width > 800) {
            width = 800
          }
          this.downloadPanelPageSize.width = width

          let height = downloadPanelPageSize.height
          if (height < 300) {
            height = 300
          }
          if (height > 600) {
            height = 600
          }
          this.downloadPanelPageSize.height = height
        }
      },

      getItem(id) {
        const index = this.downloadItemIndexMap.get(id)
        if (typeof index === 'number') {
          return this.downloadItems[index] || null
        }
        return null
      },

      rebuildDownloadItemIndexMap() {
        this.downloadItemIndexMap = new Map()
        for (let i = 0; i < this.downloadItems.length; i++) {
          this.downloadItemIndexMap.set(this.downloadItems[i].id, i)
        }
      },

      removeItemById(id) {
        deleteCachedFileIcon(id)
        this.downloadItems = this.downloadItems.filter(item => item.id !== id)
        this.rebuildDownloadItemIndexMap()
      },

      prepareDownloadItem(item) {
        common.beforeHandler(item)
        item.previousBytesReceived = item.previousBytesReceived || 0
        item.error = item.error || null
        item.estimatedEndTime = item.estimatedEndTime || null
        item.endTime = item.endTime || null
        item.exists = typeof item.exists === 'boolean' ? item.exists : true
        item.paused = Boolean(item.paused)
      },

      mergeDownloadItem(target, source) {
        const previousBytesReceived = target.bytesReceived || 0
        Object.assign(target, source)
        this.prepareDownloadItem(target)
        target.previousBytesReceived = previousBytesReceived
      },

      insertDownloadItem(item) {
        let insertIndex = this.downloadItems.length
        for (let i = 0; i < this.downloadItems.length; i++) {
          if (item.startTime >= this.downloadItems[i].startTime) {
            insertIndex = i
            break
          }
        }
        this.downloadItems.splice(insertIndex, 0, item)
        this.rebuildDownloadItemIndexMap()
      },

      upsertDownloadItem(item, options = {}) {
        this.prepareDownloadItem(item)
        const target = this.getItem(item.id)
        if (target) {
          this.mergeDownloadItem(target, item)
          return
        }

        if (Array.isArray(options.allowInsertStates) && !options.allowInsertStates.includes(item.state)) {
          return
        }

        this.insertDownloadItem(item)
      },

      async requestDownloadSnapshot() {
        if (!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage)) {
          return []
        }

        return await new Promise(resolve => {
          chrome.runtime.sendMessage(JSON.stringify({
            type: 'download_snapshot_request'
          }), response => {
            if (chrome.runtime.lastError || !response || !response.success || !Array.isArray(response.data)) {
              resolve([])
              return
            }
            resolve(response.data)
          })
        })
      },

      /**
       * 获取所有下载文件列表
       */
      async render() {
        const requestId = ++this.renderRequestId
        const startVersion = this.downloadUpdateVersion
        const [projection, items] = await Promise.all([
          storage.getSession(DOWNLOADS_PROJECTION_KEY),
          this.requestDownloadSnapshot()
        ])

        if (requestId !== this.renderRequestId) {
          return
        }

        if (this.downloadUpdateVersion !== startVersion) {
          setTimeout(() => {
            if (requestId === this.renderRequestId) {
              this.render()
            }
          }, 0)
          return
        }

        this.downloadItems = []
        items.forEach(item => {
          if (!item) {
            return
          }
          this.prepareDownloadItem(item)
          this.downloadItems.push(item)
        })
        this.rebuildDownloadItemIndexMap()
        this.applyDownloadsProjection(projection)
      },

      toggleOpenDownload() {
        this.showPopover = !this.showPopover
      },

      /**
       * 下载文件
       * @param url {String}
       */
      enterToDownload(url) {
        this.showPopover = false
        common.download(url)
      },

      /**
       * 聚焦到输入框
       */
      textareaFocus() {
        const elements = document.getElementsByClassName('el-textarea__inner')
        if (elements && elements[0]) {
          elements[0].focus()
        }
      },

      /**
       * 清空列表所有文件，除了正在下载的文件
       */
      eraseAll() {
        this.downloadItems.forEach(item => {
          if (item.state && item.state !== 'in_progress') {
            this.erase(item)
          }
        })
      },

      /**
       * 打开默认下载目录
       */
      openFolder() {
        chrome.downloads.showDefaultFolder()
      },

      /**
       * 打开浏览器默认下载页
       */
      openHome() {
        chrome.tabs.create({url: this.chromeDownloadPageUrl})
      },

      /**
       * 打开设置界面
       */
      openOptions() {
        chrome.runtime.openOptionsPage()
      },

      /**
       * 从列表中删除文件
       * @param item {Object}
       */
      erase(item) {
        chrome.downloads.erase({id: item.id}, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            this.render()
            return
          }
          this.removeItemById(item.id)
        })
      },

      /**
       * header栏 - 清除按钮点击事件
       * @param command {String}
       */
      clearDropdownCommand(command) {
        this.downloadItems.forEach(item => {
          if (item.state && item.state !== 'in_progress') {
            switch (command) {
              case 'clearAll':
                this.erase(item)
                break
              case 'deleteAll':
                if (item.exists) {
                  chrome.downloads.removeFile(item.id, () => {
                    if (chrome.runtime && chrome.runtime.lastError) {
                      this.render()
                      return
                    }
                    this.erase(item)
                  })
                } else {
                  this.erase(item)
                }
                break
              case 'clearFailed':
                item.error && this.erase(item)
                break
              case 'clearAbsent':
                !item.exists && this.erase(item)
                break
            }
          }
        })
      },

      /**
       * 复制内容到剪切板
       * @param text {String} 需要复制到剪切板的内容，字符串类型
       * @param event {MouseEvent}
       */
      async copyToClipboard(text, event) {
        if (!text) {
          return
        }

        try {
          await navigator.clipboard.writeText(text)
          if (event) {
            this.tipPosition = {x: event.pageX, y: event.pageY}
          }
          this.showCopiedTip = true
        } catch (e) {
          console.error('failed to copy', e)
        }
      },

      /**
       * 设置下载面板主题
       * @param theme 两种类型：dark，light
       */
      setTheme(theme) {
        if (!theme) {
          theme = 'light'
        }

        // 确保 themeData 已加载
        if (!this.themeData) {
          console.warn('themeData not loaded yet, skipping setTheme');
          return;
        }

        let bodyStyle = document.querySelector('body').style
        let panelThemeData = this.themeData[theme]
        if (!panelThemeData) {
          console.warn(`Theme "${theme}" not found in themeData`);
          return;
        }

        Object.keys(panelThemeData).forEach(key => {
          bodyStyle.setProperty(key, panelThemeData[key])
        })
      }
    }
  }
</script>

<!--suppress CssUnusedSymbol -->
<style rel="stylesheet/scss">
  /* 覆盖vue子组件popper样式 */
  body .tooltip,
  body .tooltip.el-popper {
    --el-popper-bg-color-dark: var(--tooltip-background-color);
    --el-fill-color-blank: var(--tooltip-background-color);
    --el-text-color-primary: var(--tooltip-background-color);
    background: var(--tooltip-background-color)!important;
    color: var(--tooltip-color)!important;
    border-color: var(--tooltip-background-color)!important;
    padding: 4px!important;
    font-size: 11px!important;
    transition: none;
  }
  body .tooltip .el-popper__arrow,
  body .tooltip.el-popper .el-popper__arrow {
    color: var(--tooltip-background-color)!important;
  }
  body .tooltip > .el-popper__arrow::before,
  body .tooltip.el-popper > .el-popper__arrow::before {
    background: var(--tooltip-background-color)!important;
    border-color: var(--tooltip-background-color)!important;
  }

  body .el-popover {
    padding: 6px;
    min-width: 120px;
    font-size: 13px;
    color: var(--popover-color);
    background-color: var(--popover-background-color);
    border-color: var(--popover-border-color);
  }
  body .el-popper[data-popper-placement^=bottom] {
    margin-top: 8px;
  }
  body .header-tooltip.el-popper[data-popper-placement^=bottom] {
    margin-top: 2px !important;
  }
  body .el-popconfirm .el-popconfirm__main {
    height: 0;
  }
  body .el-popconfirm .el-button--small {
    padding: 2px 6px;
    font-size: 11px;
    border-radius: 3px;
  }
  body .el-popper .el-popper__arrow::before {
    background-color: var(--popover-background-color)!important;
    border-color: var(--popover-border-color)!important;
  }

  body .open-download-popover.el-popover {
    padding: 8px 12px;
    box-sizing: border-box;
  }

  body .open-download-popover .el-textarea,
  body .open-download-popover .el-textarea textarea {
    width: 100%;
    box-sizing: border-box;
  }

  .el-dropdown__popper.el-popper[data-popper-placement^=bottom] .el-popper__arrow::before {
    background-color: var(--header-dropdown-menu-background-color)!important;
  }

  body .el-textarea textarea {
    resize: none;
    color: var(--popover-textarea-color);
    background-color: var(--popover-textarea-background-color);
  }
  body .el-textarea textarea:focus {
    border-color: var(--popover-textarea-focus-border-color);
  }
  body .el-textarea textarea::placeholder {
    color: var(--popover-textarea-placeholder-color);
  }
  body .el-textarea textarea::-webkit-input-placeholder {
    font-size: 14px;
  }
  body .el-textarea textarea:-moz-placeholder {
    font-size: 14px;
  }
  body .el-textarea textarea::-moz-placeholder {
    font-size: 14px;
  }
  body .el-textarea textarea::-ms-input-placeholder {
    font-size: 14px;
  }
  body .el-textarea textarea::-webkit-scrollbar {
    width: 5px;
    background-color: transparent;
  }
  body .el-textarea textarea::-webkit-scrollbar:hover {
    cursor: pointer;
  }
  body .el-textarea textarea::-webkit-scrollbar-thumb {
    background-color: rgba(144, 147, 153, .3);
    border-radius: 4px;
  }
  body .el-textarea textarea::-webkit-scrollbar-thumb:hover {
    cursor: pointer;
  }
  body .el-textarea textarea::-webkit-scrollbar-thumb:window-inactive {
    background-color: rgba(157, 165, 183, 0.7);
  }
</style>

<!--suppress CssUnusedSymbol -->
<style scoped rel="stylesheet/scss">
  .home {
    background-color: var(--background-color);
  }

  .header {
    padding: 10px 4px 0 8px;
  }

  /* header栏输入框 */
  .header .search {
    width: 212px;
  }
  .header .search :deep(.el-input__wrapper) {
    border-radius: 18px;
    min-height: 28px;
    background-color: var(--header-search-background-color);
    box-shadow: 0 0 0 1px var(--header-search-border-color) inset !important;
    transition: box-shadow 0ms;
  }
  .header .search :deep(.el-input__wrapper:hover),
  .header .search :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px var(--header-search-hover-border-color) inset !important;
  }
  .header .search :deep(.el-input__inner) {
    height: 28px;
    line-height: 28px;
    font-size: 13px;
    color: var(--header-search-color);
  }
  .header .search .search-icon {
    line-height: 28px;
    font-size: 14px;
    color: var(--header-search-color);
  }

  .header .header-operator {
    float: right;
    display: flex;
    align-items: center;
  }
  .header .header-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    vertical-align: middle;
    border-radius: 8px;
    box-sizing: border-box;
    color: var(--header-icon-color);
    box-shadow: inset 0 0 0 1px transparent;
    transition: background-color .18s ease, box-shadow .18s ease, color .18s ease;
  }
  .header .header-dropdown,
  .header .header-dropdown-trigger {
    display: inline-flex;
    align-items: center;
  }
  .header .header-dropdown-trigger {
    outline: none;
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

  /* 显示手动下载文件弹框时的遮蔽层 */
  .header .header-operator .musk {
    z-index: 100;
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    opacity: .2;
    background: var(--popover-musk-background-color);
  }

  /* 图标按钮 */
  .icon-button {
    cursor: pointer;
    font-size: 19px;
    color: inherit;
    -webkit-transition: .2s;
    transition: .2s;
  }
  .icon-button:hover {
    color: inherit;
    transition: .2s;
  }

  /* 清除按钮下拉菜单 */
  .el-dropdown-menu.el-popper {
    padding: 4px 0;
    margin: 5px 0;
    background-color: var(--header-dropdown-menu-background-color);
    border-color: var(--header-dropdown-menu-border-color);
  }
  .el-dropdown-menu.el-popper .el-dropdown-menu__item {
    line-height: 28px;
    padding: 0 10px;
    margin: 0;
    font-size: 12px;
    color: var(--header-dropdown-menu-item-color);
  }
  .el-dropdown-menu.el-popper .el-dropdown-menu__item:focus,
  .el-dropdown-menu.el-popper .el-dropdown-menu__item:not(.is-disabled):hover {
    background-color: var(--header-dropdown-menu-item-hover-background-color);
    color: var(--header-dropdown-menu-item-hover-color);
  }

  /* 下载内容区域 */
  .content {
    height: calc(100% - 54px);
    margin: 9px 0 0 7px;
  }

  /* 滚动条样式 */
  .content :deep(.vue-recycle-scroller::-webkit-scrollbar) { /*滚动条整体样式*/
    width: 7px; /*高宽分别对应横竖滚动条的尺寸*/
    height: 7px;
    scrollbar-arrow-color: red;
  }
  .content :deep(.vue-recycle-scroller::-webkit-scrollbar-thumb:hover) {
    cursor: pointer;
  }
  .content :deep(.vue-recycle-scroller::-webkit-scrollbar-thumb) { /*滚动条里面小方块*/
    border-radius: 10px;
    -webkit-box-shadow: inset 0 0 4px rgba(123, 123, 123, 0.2);
    background: var(--scrollbar-thumb-background-color);
  }
  .content :deep(.vue-recycle-scroller::-webkit-scrollbar-track) { /*滚动条里面轨道*/
    border-radius: 10px;
    -webkit-box-shadow: inset 0 0 4px transparent;
  }
  .content :deep(.vue-recycle-scroller) {
    height: 100%;
  }

  /* 返回顶部按钮 */
  .content :deep(.el-backtop) {
    right: 16px !important;
    bottom: 20px !important;
    width: 34px;
    height: 34px;
  }

  /* 动画效果 */
  .transition-enter {
    animation: enter .3s ease alternate forwards;
  }
  @keyframes enter {
    from {
      opacity: 0;
      transform: translateX(-80px);
    }
    to {
      opacity: 1;
      transform: translateX(0px);
    }
  }
  .transition-leave {
    animation: leave .1s ease alternate forwards;
  }
  @keyframes leave {
    from {
      transform: translateX(0px);
    }
    to {
      opacity: 0;
      transform: translateX(160px);
    }
  }
</style>
