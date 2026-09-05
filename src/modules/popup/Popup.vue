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
                    :popper-options="openDownloadPopperOptions"
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
                    placement="bottom" effect="dark" popper-class="tooltip header-tooltip" :enterable="false"
                    :show-after="tooltipShowAfter" :hide-after="tooltipHideAfter">
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
                <el-dropdown-item command="clearCompleted">{{i18data.clearCompleted}}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.batchDownloadActions"
                    placement="bottom" effect="dark" popper-class="tooltip header-tooltip" :enterable="false"
                    :show-after="tooltipShowAfter" :hide-after="tooltipHideAfter">
          <el-dropdown class="header-dropdown" trigger="click" @command="batchDownloadCommand">
            <span class="header-button header-dropdown-trigger">
              <el-icon class="icon-button"><VideoPause /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="pauseAll" :disabled="!hasPausableDownloads">{{i18data.pauseAll}}</el-dropdown-item>
                <el-dropdown-item command="resumeAll" :disabled="!hasResumableDownloads">{{i18data.resumeAll}}</el-dropdown-item>
                <el-dropdown-item command="cancelAll" :disabled="!hasCancelableDownloads" divided>{{i18data.cancelAll}}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.openDownloadFolder"
                    placement="bottom" effect="dark" popper-class="tooltip header-tooltip" :enterable="false"
                    :show-after="tooltipShowAfter" :hide-after="tooltipHideAfter">
          <el-icon class="header-button icon-button" @click="openFolder"><FolderOpened /></el-icon>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.openHome"
                    placement="bottom" effect="dark" popper-class="tooltip header-tooltip" :enterable="false"
                    :show-after="tooltipShowAfter" :hide-after="tooltipHideAfter">
          <el-icon class="header-button icon-button" @click="openHome"><Position /></el-icon>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.openSettings"
                    placement="bottom" effect="dark" popper-class="tooltip header-tooltip" :enterable="false"
                    :show-after="tooltipShowAfter" :hide-after="tooltipHideAfter">
          <el-icon class="header-button icon-button" @click="openOptions"><Setting /></el-icon>
        </el-tooltip>
      </div>
    </div>

    <div class="content">
      <RecycleScroller id="vue-recycle-scroller" :key="recycleScrollerKey" :items="filteredDownloadItems"
                       :item-size="84" key-field="id" :emit-update="true"
                       @update="handleScrollerUpdate" v-slot="{ item }">
        <transition :enter-active-class="enableAnimation ? 'transition-enter' : ''"
                    :leave-active-class="enableAnimation ? 'transition-leave' : ''">
          <file class="file" :item="item" :key="item.id"
                :render="render" :erase="erase" :request-remove="requestRemoveFile"
                :copyToClipboard="copyToClipboard"
                :tooltip-show-after="tooltipShowAfter" :tooltip-hide-after="tooltipHideAfter"
                :i18data="i18data" :close-tooltip="closeTooltip" :left-click-file="leftClickFile"
                :show-download-progress="showDownloadProgress"
                :left-click-url="leftClickUrl" :right-click-file="rightClickFile" :right-click-url="rightClickUrl"/>
        </transition>
      </RecycleScroller>
      <div v-if="filteredDownloadItems.length === 0" class="empty-state" aria-hidden="true">
        <img class="empty-state-illustration" src="../../../.idea/1.svg" alt="">
      </div>
      <el-backtop target=".content #vue-recycle-scroller" visibilityHeight="70"/>
      <tip :text="i18data.copied" :position="tipPosition" v-model:showTip="showCopiedTip"/>
    </div>
    <transition name="delete-confirm-fade">
      <div v-if="deleteConfirm.visible" class="delete-confirm-overlay" @click.self="cancelDeleteConfirm">
        <section class="delete-confirm-dialog" role="dialog" aria-modal="true">
          <div class="delete-confirm-icon">
            <el-icon><Delete /></el-icon>
          </div>
          <div class="delete-confirm-content">
            <h2>{{ deleteConfirm.title }}</h2>
            <p>{{ deleteConfirm.message }}</p>
          </div>
          <div class="delete-confirm-actions">
            <button class="delete-confirm-button secondary" type="button" @click="cancelDeleteConfirm">
              {{ i18data.cancel }}
            </button>
            <button class="delete-confirm-button danger" type="button" @click="confirmDelete">
              {{ deleteConfirm.confirmText }}
            </button>
          </div>
        </section>
      </div>
    </transition>
  </div>
</template>

<!--suppress UnterminatedStatementJS, JSUnresolvedVariable, ES6ModulesDependencies, JSUnresolvedFunction -->
<script>
  /* eslint-disable no-undef */
  import common from '../../utils/common'
  import storage from '../../utils/storage'
  import { deleteCachedFileIcon } from '../../utils/fileIconCache'
  import { isDangerousDownload } from '../../utils/downloadDanger'
  import File from './File'
  import Tip from '../../components/Tip'

  const DOWNLOADS_PROJECTION_KEY = 'downloads_projection'
  const TOOLTIP_SHOW_AFTER = 700
  const TOOLTIP_HIDE_AFTER = 0
  const ACTIVE_DOWNLOAD_POLL_INTERVAL_MS = 500

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
        if (areaName === 'session') {
          const projectionChange = changes[DOWNLOADS_PROJECTION_KEY]
          if (projectionChange && projectionChange.newValue) {
            this.applyDownloadsProjection(projectionChange.newValue)
          }
        }

        if (changes.show_download_progress) {
          const nextValue = changes.show_download_progress.newValue
          this.showDownloadProgress = typeof nextValue === 'boolean' ? nextValue : true
          this.syncActiveDownloadsPolling()
        }
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
      const settings = await storage.getMany([
        'close_tooltip',
        'left_click_file',
        'right_click_file',
        'left_click_url',
        'right_click_url',
        'enable_animation',
        'show_download_progress'
      ])
      this.closeTooltip = settings.close_tooltip
      this.leftClickFile = settings.left_click_file
      this.rightClickFile = settings.right_click_file
      this.leftClickUrl = settings.left_click_url
      this.rightClickUrl = settings.right_click_url
      // 开启文件移入移出动画
      this.enableAnimation = settings.enable_animation
      const showDownloadProgress = settings.show_download_progress
      this.showDownloadProgress = typeof showDownloadProgress === 'boolean' ? showDownloadProgress : true

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
      this.stopActiveDownloadsPolling()
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
        showDownloadProgress: true,
        tooltipShowAfter: TOOLTIP_SHOW_AFTER,
        tooltipHideAfter: TOOLTIP_HIDE_AFTER,

        themeData: null,
        downloadItemIndexMap: new Map(),
        downloadUpdateVersion: 0,
        renderRequestId: 0,
        activeDownloadsPollTimer: null,
        activeDownloadsPollInFlight: false,
        visibleActiveDownloadIdsSignature: '',
        visibleDownloadRange: {
          start: 0,
          end: -1
        },
        deleteConfirm: {
          visible: false,
          title: '',
          message: '',
          confirmText: '',
          action: null
        }
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
        return Math.max(Number(this.downloadPanelPageSize.width) - 8, 280)
      },
      openDownloadPopperOptions() {
        return {
          modifiers: [
            {
              name: 'alignOpenDownloadPopover',
              enabled: true,
              phase: 'main',
              requires: ['popperOffsets'],
              fn({state}) {
                if (state.modifiersData && state.modifiersData.popperOffsets) {
                  const popperX = 4
                  state.modifiersData.popperOffsets.x = popperX

                  const arrow = state.elements && state.elements.arrow
                  const reference = state.elements && state.elements.reference
                  if (arrow && reference && state.modifiersData.arrow) {
                    const referenceRect = reference.getBoundingClientRect()
                    const arrowWidth = arrow.offsetWidth || 0
                    state.modifiersData.arrow.x = referenceRect.left + referenceRect.width / 2 - popperX - arrowWidth / 2
                  }
                }
              }
            }
          ]
        }
      },
      recycleScrollerKey() {
        return `${this.downloadUpdateVersion}-${this.filteredDownloadItems.length}`
      },
      inProgressDownloadItems() {
        return this.downloadItems.filter(item => item && item.state === 'in_progress')
      },
      hasPausableDownloads() {
        return this.inProgressDownloadItems.some(item => !item.paused)
      },
      hasResumableDownloads() {
        return this.inProgressDownloadItems.some(item => item.paused)
      },
      hasCancelableDownloads() {
        return this.inProgressDownloadItems.length > 0
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

        const removedIds = Array.isArray(projection.removedIds) ? projection.removedIds : []
        const removedIdSet = new Set(removedIds)
        removedIds.forEach(id => this.removeItemById(id))

        const itemsById = projection.itemsById && typeof projection.itemsById === 'object'
          ? projection.itemsById
          : {}

        Object.values(itemsById).forEach(item => {
          if (item && !removedIdSet.has(item.id)) {
            this.upsertDownloadItem(item, options)
          }
        })

        this.syncActiveDownloadsPolling()
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
        const now = Date.now()
        item.previousBytesReceived = typeof item.previousBytesReceived === 'number'
          ? item.previousBytesReceived
          : (item.bytesReceived || 0)
        item.previousMetricsUpdatedAt = typeof item.previousMetricsUpdatedAt === 'number'
          ? item.previousMetricsUpdatedAt
          : now
        item.downloadMetricsUpdatedAt = typeof item.downloadMetricsUpdatedAt === 'number'
          ? item.downloadMetricsUpdatedAt
          : now
        item.downloadSpeedBytesPerSecond = typeof item.downloadSpeedBytesPerSecond === 'number'
          ? item.downloadSpeedBytesPerSecond
          : null
        item.error = item.error || null
        item.estimatedEndTime = item.estimatedEndTime || null
        item.endTime = item.endTime || null
        item.exists = typeof item.exists === 'boolean' ? item.exists : true
        item.paused = Boolean(item.paused)
      },

      mergeDownloadItem(target, source) {
        const previousBytesReceived = target.bytesReceived || 0
        const previousMetricsUpdatedAt = target.downloadMetricsUpdatedAt || Date.now()
        const nextBytesReceived = source.bytesReceived || 0
        const now = Date.now()
        Object.assign(target, source)
        this.prepareDownloadItem(target)
        target.previousBytesReceived = previousBytesReceived
        target.previousMetricsUpdatedAt = previousMetricsUpdatedAt
        target.downloadMetricsUpdatedAt = now
        target.downloadSpeedBytesPerSecond = this.calculateDownloadSpeed(
          previousBytesReceived,
          nextBytesReceived,
          previousMetricsUpdatedAt,
          now,
          target
        )
      },

      calculateDownloadSpeed(previousBytesReceived, nextBytesReceived, previousMetricsUpdatedAt, now, item) {
        if (!item || item.state !== 'in_progress' || item.paused) {
          return 0
        }

        const elapsedSeconds = (now - previousMetricsUpdatedAt) / 1000
        const bytesDelta = nextBytesReceived - previousBytesReceived
        if (elapsedSeconds <= 0 || bytesDelta <= 0) {
          return 0
        }

        return bytesDelta / elapsedSeconds
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

      async requestDownloadSnapshot(query = null) {
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
        this.syncActiveDownloadsPolling()
      },

      handleScrollerUpdate(...range) {
        const visibleStartIndex = Number.isFinite(range[2]) ? range[2] : 0
        const visibleEndIndex = Number.isFinite(range[3]) ? range[3] : -1
        this.visibleDownloadRange = {
          start: Math.max(visibleStartIndex, 0),
          end: Math.max(visibleEndIndex, -1)
        }
        this.syncActiveDownloadsPolling()
      },

      getVisibleActiveDownloadIds() {
        if (!this.showDownloadProgress) {
          return []
        }

        const visibleItems = this.filteredDownloadItems.slice(
          this.visibleDownloadRange.start,
          this.visibleDownloadRange.end + 1
        )

        return visibleItems
          .filter(item => item && item.state === 'in_progress' && !isDangerousDownload(item))
          .map(item => item.id)
      },

      syncActiveDownloadsPolling() {
        const visibleActiveDownloadIds = this.getVisibleActiveDownloadIds()
        const signature = visibleActiveDownloadIds.join(',')
        const shouldPoll = visibleActiveDownloadIds.length > 0
        if (signature === this.visibleActiveDownloadIdsSignature && Boolean(this.activeDownloadsPollTimer) === shouldPoll) {
          return
        }

        this.visibleActiveDownloadIdsSignature = signature
        if (shouldPoll) {
          this.startActiveDownloadsPolling()
        } else {
          this.stopActiveDownloadsPolling()
        }
      },

      startActiveDownloadsPolling() {
        if (this.activeDownloadsPollTimer) {
          return
        }

        this.activeDownloadsPollTimer = setInterval(() => {
          this.pollActiveDownloads()
        }, ACTIVE_DOWNLOAD_POLL_INTERVAL_MS)
      },

      stopActiveDownloadsPolling() {
        if (!this.activeDownloadsPollTimer) {
          return
        }

        clearInterval(this.activeDownloadsPollTimer)
        this.activeDownloadsPollTimer = null
        this.activeDownloadsPollInFlight = false
      },

      async pollActiveDownloads() {
        const currentActiveIds = this.getVisibleActiveDownloadIds()
        if (this.activeDownloadsPollInFlight || currentActiveIds.length === 0) {
          this.syncActiveDownloadsPolling()
          return
        }

        this.activeDownloadsPollInFlight = true
        try {
          const items = await this.requestDownloadSnapshot({ids: currentActiveIds})
          const activeIds = new Set()
          items.forEach(item => {
            if (item) {
              activeIds.add(item.id)
              this.upsertDownloadItem(item)
            }
          })
          const hasMissingActiveItem = currentActiveIds.some(id => !activeIds.has(id))
          if (hasMissingActiveItem) {
            await this.render()
          }
        } finally {
          this.activeDownloadsPollInFlight = false
          this.syncActiveDownloadsPolling()
        }
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
        return new Promise(resolve => {
          if (!item || typeof item.id !== 'number') {
            resolve(false)
            return
          }

          chrome.downloads.erase({id: item.id}, async () => {
            if (chrome.runtime && chrome.runtime.lastError) {
              this.render()
              resolve(false)
              return
            }
            try {
              await this.removeProjectionItemById(item.id)
            } catch (error) {
              console.warn('Remove projection item failed', error)
            }
            this.removeItemById(item.id)
            resolve(true)
          })
        })
      },

      async removeProjectionItemById(id) {
        const projection = await storage.getSession(DOWNLOADS_PROJECTION_KEY)
        if (!projection || typeof projection !== 'object') {
          return
        }

        const itemsById = projection.itemsById && typeof projection.itemsById === 'object'
          ? {...projection.itemsById}
          : {}
        delete itemsById[id]

        const removedIds = Array.isArray(projection.removedIds)
          ? projection.removedIds.filter(removedId => removedId !== id)
          : []
        removedIds.push(id)

        await storage.setSession(DOWNLOADS_PROJECTION_KEY, {
          ...projection,
          seq: (typeof projection.seq === 'number' ? projection.seq : 0) + 1,
          updatedAt: Date.now(),
          itemsById,
          removedIds
        })
      },

      requestRemoveFile(item) {
        if (!item || item.state !== 'complete' || !item.exists) {
          return
        }

        this.openDeleteConfirm({
          title: this.i18data.deleteConfirmTitle,
          message: this.i18data.deleteConfirmFileMessage.replace('{}', item.basename || item.filename || item.url),
          confirmText: this.i18data.deleteConfirmButton,
          action: () => this.removeFileFromDisk(item)
        })
      },

      requestRemoveAllFiles() {
        const items = this.downloadItems.filter(item => item.state && item.state !== 'in_progress')
        if (!items.length) {
          return
        }

        this.openDeleteConfirm({
          title: this.i18data.deleteConfirmTitle,
          message: this.i18data.deleteConfirmAllMessage.replace('{}', items.length),
          confirmText: this.i18data.deleteConfirmButton,
          action: () => this.removeAllFilesFromDisk(items)
        })
      },

      openDeleteConfirm({title, message, confirmText, action}) {
        this.deleteConfirm = {
          visible: true,
          title,
          message,
          confirmText,
          action
        }
      },

      cancelDeleteConfirm() {
        this.deleteConfirm.visible = false
        this.deleteConfirm.action = null
      },

      confirmDelete() {
        const action = this.deleteConfirm.action
        this.cancelDeleteConfirm()
        if (typeof action === 'function') {
          const result = action()
          if (result && typeof result.catch === 'function') {
            result.catch(error => {
              console.warn('Delete confirm action failed', error)
              this.render()
            })
          }
        }
      },

      async removeFileFromDisk(item) {
        if (!item || typeof item.id !== 'number') {
          return false
        }

        if (!item.exists) {
          return await this.erase(item)
        }

        const result = await this.removeDownloadFile(item)
        if (!result.success) {
          const shouldErase = await this.shouldEraseAfterRemoveFileFailure(item, result.errorMessage)
          if (!shouldErase) {
            await this.render()
            return false
          }
        }

        item.exists = false
        return await this.erase(item)
      },

      removeDownloadFile(item) {
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
      },

      async shouldEraseAfterRemoveFileFailure(item, errorMessage) {
        if (!item.exists || this.isFileMissingError(errorMessage)) {
          return true
        }

        const refreshedItem = await this.getDownloadItemById(item.id)
        return !refreshedItem || refreshedItem.exists === false
      },

      isFileMissingError(errorMessage) {
        return /does(?:\s+not|n't)\s+exist|not\s+found|no\s+such\s+file|file\s+missing|already\s+(?:deleted|removed)|has\s+been\s+(?:deleted|removed)|不存在|找不到|已删除|已移除/i.test(errorMessage || '')
      },

      getDownloadItemById(id) {
        return new Promise(resolve => {
          chrome.downloads.search({id}, items => {
            if (chrome.runtime && chrome.runtime.lastError) {
              resolve(null)
              return
            }
            resolve(items && items[0] ? items[0] : null)
          })
        })
      },

      async removeAllFilesFromDisk(items) {
        for (const item of items) {
          const currentItem = this.getItem(item.id)
          if (currentItem) {
            await this.removeFileFromDisk(currentItem)
          }
        }
        await this.render()
      },


      batchDownloadCommand(command) {
        if (command === 'pauseAll') {
          this.pauseAllDownloads()
          return
        }
        if (command === 'resumeAll') {
          this.resumeAllDownloads()
          return
        }
        if (command === 'cancelAll') {
          this.cancelAllDownloads()
        }
      },

      pauseAllDownloads() {
        const targets = this.inProgressDownloadItems.filter(item => !item.paused)
        targets.forEach(item => {
          chrome.downloads.pause(item.id, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
              return
            }
            const current = this.getItem(item.id)
            if (current) {
              current.paused = true
            }
          })
        })
      },

      resumeAllDownloads() {
        const targets = this.inProgressDownloadItems.filter(item => item.paused)
        let remaining = targets.length
        if (!remaining) {
          return
        }

        targets.forEach(item => {
          chrome.downloads.resume(item.id, () => {
            if (!(chrome.runtime && chrome.runtime.lastError)) {
              const current = this.getItem(item.id)
              if (current) {
                current.paused = false
              }
            }
            remaining -= 1
            if (remaining <= 0) {
              this.render()
            }
          })
        })
      },

      cancelAllDownloads() {
        const targets = [...this.inProgressDownloadItems]
        let remaining = targets.length
        if (!remaining) {
          return
        }

        targets.forEach(item => {
          chrome.downloads.cancel(item.id, () => {
            remaining -= 1
            if (remaining <= 0) {
              this.render()
            }
          })
        })
      },

      /**
       * header栏 - 清除按钮点击事件
       * @param command {String}
       */
      clearDropdownCommand(command) {
        if (command === 'deleteAll') {
          this.requestRemoveAllFiles()
          return
        }

        this.downloadItems.forEach(item => {
          if (item.state && item.state !== 'in_progress') {
            switch (command) {
              case 'clearAll':
                this.erase(item)
                break
              case 'clearFailed':
                item.error && this.erase(item)
                break
              case 'clearAbsent':
                !item.exists && this.erase(item)
                break
              case 'clearCompleted':
                item.state === 'complete' && this.erase(item)
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
    --el-popover-bg-color: var(--header-dropdown-menu-background-color);
    --el-popover-border-color: var(--header-dropdown-menu-border-color);
    background-color: var(--header-dropdown-menu-background-color);
    border-color: var(--header-dropdown-menu-border-color);
    padding: 8px;
    box-sizing: border-box;
  }

  body .open-download-popover.el-popper .el-popper__arrow::before {
    background-color: var(--header-dropdown-menu-background-color)!important;
    border: 1px solid var(--header-dropdown-menu-border-color)!important;
  }

  body .open-download-popover.el-popper[data-popper-placement^=bottom] .el-popper__arrow::before {
    border-right-color: transparent!important;
    border-bottom-color: transparent!important;
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 7px 8px 8px;
    border-bottom: 1px solid var(--header-divider-color, var(--content-file-border-color));
    box-sizing: border-box;
  }

  /* header栏输入框 */
  .header .search {
    flex: 1 1 212px;
    max-width: 232px;
    min-width: 0;
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
    display: flex;
    align-items: center;
    flex: 0 0 auto;
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
    color: var(--delete-confirm-danger-color, #d93025);
    background-color: var(--delete-confirm-danger-background-color, rgba(217, 48, 37, .10));
  }

  .delete-confirm-icon .el-icon {
    font-size: 18px;
  }

  .delete-confirm-content h2 {
    margin: 0 0 6px;
    line-height: 20px;
    font-size: 14px;
    font-weight: 600;
    color: var(--content-file-filename-color);
  }

  .delete-confirm-content p {
    margin: 0;
    line-height: 18px;
    font-size: 12px;
    color: var(--popover-color);
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
    cursor: pointer;
    transition: background-color .18s ease, border-color .18s ease, color .18s ease;
  }

  .delete-confirm-button.secondary {
    color: var(--popover-color);
    background-color: var(--popover-background-color);
  }

  .delete-confirm-button.secondary:hover {
    color: var(--header-icon-hover-color);
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

  .delete-confirm-fade-enter-active,
  .delete-confirm-fade-leave-active {
    transition: opacity .14s ease;
  }

  .delete-confirm-fade-enter-from,
  .delete-confirm-fade-leave-to {
    opacity: 0;
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
