/* eslint-disable no-undef */

const common = {

  /**
   * @param msg {String}
   * @return {String}
   */
  loadI18nMessage(msg) {
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const value = chrome.i18n.getMessage(msg)
      return value || msg
    }
    return msg
  },

  /**
   * @param item {Object}
   */
  beforeHandler(item) {
    this.handleBasename(item)
  },

  /**
   * 将长文件名转成短文件名
   * @param item {Object}
   */
  handleBasename(item) {
    if (item.filename && !item.basename) {
      item.basename = item.filename.substring(Math.max(
        item.filename.lastIndexOf('\\'),
        item.filename.lastIndexOf('/')
      ) + 1)
      return
    }

    if (!item.basename) {
      const sourceUrl = item.finalUrl || item.url
      if (sourceUrl) {
        try {
          const parsedUrl = new URL(sourceUrl)
          const pathname = parsedUrl.pathname || ''
          const fallbackName = pathname.substring(pathname.lastIndexOf('/') + 1)
          item.basename = fallbackName || parsedUrl.hostname || sourceUrl
        } catch (e) {
          item.basename = sourceUrl
        }
      }
    }
  },

  /**
   * 获取文件图标
   * @param item {Object}
   * @return {Promise<Object>}
   */
  getCustomFileIcon(item) {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.downloads && item.filename && !item.iconUrl) {
        chrome.downloads.getFileIcon(item.id, {size: 32}, iconUrl => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(null)
            return
          }
          resolve(iconUrl || null)
        })
      } else {
        resolve(item.iconUrl)
      }
    })
  },

  /**
   * 异步获取文件图标
   * @param item {Object}
   */
  handleFileIcon(item) {
    if (item.filename && !item.iconUrl) {
      // 置空，让后续改变可以被vue监控到
      item.iconUrl = null
    }

    this.getCustomFileIcon(item).then(iconUrl => {
      item.iconUrl = iconUrl
    })
  },

  /**
   * 下载文件
   * 有时候当下载频率较高时，谷歌浏览器会自动阻止下载多个文件，需要等待几秒后才能再次下载文件
   * @param url {String}
   */
  download(url) {
    if (url && typeof chrome !== 'undefined' && chrome.downloads) {
      let trimUrl = url.trim()
      if (trimUrl === '') {
        return Promise.resolve(null)
      }

      return new Promise(resolve => {
        chrome.downloads.download({url: trimUrl}, downloadId => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve(null)
            return
          }
          resolve(downloadId)
        })
      })
    }
    return Promise.resolve(null)
  },

  /**
   * 获取chrome版本
   * @return {{patch: number, major: number, minor: number, build: number}|undefined}
   */
  getChromeVersion() {
    let pieces = navigator.userAgent.match(/Chrom(?:e|ium)\/([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)/)
    if (pieces == null || pieces.length !== 5) {
      return undefined
    }
    pieces = pieces.map(piece => parseInt(piece, 10))
    return {
      major: pieces[1],
      minor: pieces[2],
      build: pieces[3],
      patch: pieces[4]
    }
  },

  /**
   * 校验chrome版本是否大于指定数值
   * @param version {Number}
   * @return {boolean}
   */
  chromeVersionGreaterThan(version) {
    if (version && typeof version === 'number') {
      let currentVersion = this.getChromeVersion()
      return currentVersion && currentVersion.major >= version
    }
    return false
  },

  /**
   * 检测系统是否是深色模式
   * 注意：Service Worker 中无法直接检测，返回 false
   * @return {boolean}
   */
  isInDarkMode() {
    // Service Worker 中没有 window 对象
    if (typeof window === 'undefined') {
      return false
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  },

  isInEdge() {
    // Service Worker 中 navigator.userAgent 可用
    return navigator.userAgent.toLowerCase().indexOf('edg') > 0
  },

  // 翻译数据
  i18data: {},

  setI18data() {
    // background 通知
    this.i18data.deleteNotification = this.loadI18nMessage('deleteNotification')
    this.i18data.downloadCompletedNotification = this.loadI18nMessage('downloadCompletedNotification')
    this.i18data.downloadStartedNotification = this.loadI18nMessage('downloadStartedNotification')
    this.i18data.downloadWarnNotification = this.loadI18nMessage('downloadWarnNotification')
    this.i18data.openFolderNotification = this.loadI18nMessage('openFolderNotification')
    this.i18data.openFile = this.loadI18nMessage('openFile')

    // popup 顶栏tooltip
    this.i18data.newDownload = this.loadI18nMessage('newDownload')
    this.i18data.openDownloadFolder = this.loadI18nMessage('openDownloadFolder')
    this.i18data.openSettings = this.loadI18nMessage('openSettings')
    this.i18data.openHome = this.loadI18nMessage('openHome')
    this.i18data.newDownloadPlaceholder = this.loadI18nMessage('newDownloadPlaceholder')
    // 清除按钮下拉菜单
    this.i18data.clearAll = this.loadI18nMessage('clearAll')
    this.i18data.deleteAll = this.loadI18nMessage('deleteAll')
    this.i18data.clearFailed = this.loadI18nMessage('clearFailed')
    this.i18data.clearAbsent = this.loadI18nMessage('clearAbsent')
    this.i18data.clearCompleted = this.loadI18nMessage('clearCompleted')

    // 网速显示
    this.i18data.second = this.loadI18nMessage('second')
    this.i18data.minute = this.loadI18nMessage('minute')
    this.i18data.hour = this.loadI18nMessage('hour')
    this.i18data.day = this.loadI18nMessage('day')

    // popup 下载文件操作栏tooltip
    this.i18data.openFileInFolder = this.loadI18nMessage('openFileInFolder')
    this.i18data.pause = this.loadI18nMessage('pause')
    this.i18data.resume = this.loadI18nMessage('resume')
    this.i18data.delete = this.loadI18nMessage('delete')
    this.i18data.retry = this.loadI18nMessage('retry')
    this.i18data.erase = this.loadI18nMessage('erase')
    this.i18data.deleteConfirmTitle = this.loadI18nMessage('deleteConfirmTitle')
    this.i18data.deleteConfirmFileMessage = this.loadI18nMessage('deleteConfirmFileMessage')
    this.i18data.deleteConfirmAllMessage = this.loadI18nMessage('deleteConfirmAllMessage')
    this.i18data.deleteConfirmButton = this.loadI18nMessage('deleteConfirmButton')
    this.i18data.clearPopConfirmText = this.loadI18nMessage('el_popconfirm_confirmButtonText')
    this.i18data.clearPopCancelText = this.loadI18nMessage('el_popconfirm_cancelButtonText')
    // popup 下载危险文件
    this.i18data.dangerDescription = this.loadI18nMessage('dangerDescription')
    this.i18data.cancel = this.loadI18nMessage('cancel')
    this.i18data.reserve = this.loadI18nMessage('reserve')
    // popup 右键复制
    this.i18data.copied = this.loadI18nMessage('copied')

    // 上下文菜单
    this.i18data.prefixMenus = this.loadI18nMessage('prefixMenus')
    this.i18data.link = this.loadI18nMessage('link')
    this.i18data.image = this.loadI18nMessage('image')
    this.i18data.audio = this.loadI18nMessage('audio')
    this.i18data.video = this.loadI18nMessage('video')

    // options 侧边栏
    this.i18data.extensionName = this.loadI18nMessage('extName')
    this.i18data.settingsTitle = this.loadI18nMessage('settingsTitle')
    this.i18data.themeTitle = this.loadI18nMessage('themeTitle')
    this.i18data.aboutTitle = this.loadI18nMessage('aboutTitle')

    // options settings 下载设置
    this.i18data.downloadSetting = this.loadI18nMessage('downloadSetting')
    this.i18data.leftClickFileSetting = this.loadI18nMessage('leftClickFileSetting')
    this.i18data.rightClickFileSetting = this.loadI18nMessage('rightClickFileSetting')
    this.i18data.leftClickUrlSetting = this.loadI18nMessage('leftClickUrlSetting')
    this.i18data.rightClickUrlSetting = this.loadI18nMessage('rightClickUrlSetting')
    this.i18data.showTooltipSetting = this.loadI18nMessage('showTooltipSetting')
    this.i18data.enableAnimation = this.loadI18nMessage('enableAnimation')

    // options settings 上下文菜单
    this.i18data.contextMenus = this.loadI18nMessage('contextMenus')
    this.i18data.downloadContextMenusSetting = this.loadI18nMessage('downloadContextMenusSetting')
    this.i18data.downloadContextMenusDescSetting = this.loadI18nMessage('downloadContextMenusDescSetting')

    // options settings 文件分类下载
    this.i18data.fileRoutingSetting = this.loadI18nMessage('fileRoutingSetting')
    this.i18data.fileRoutingEnableSetting = this.loadI18nMessage('fileRoutingEnableSetting')
    this.i18data.fileRoutingDescription = this.loadI18nMessage('fileRoutingDescription')
    this.i18data.fileRoutingRulesSetting = this.loadI18nMessage('fileRoutingRulesSetting')
    this.i18data.fileRoutingFolderLabel = this.loadI18nMessage('fileRoutingFolderLabel')
    this.i18data.fileRoutingExtensionsLabel = this.loadI18nMessage('fileRoutingExtensionsLabel')
    this.i18data.fileRoutingActionsLabel = this.loadI18nMessage('fileRoutingActionsLabel')
    this.i18data.fileRoutingRuleEnabledLabel = this.loadI18nMessage('fileRoutingRuleEnabledLabel')
    this.i18data.fileRoutingFolderPlaceholder = this.loadI18nMessage('fileRoutingFolderPlaceholder')
    this.i18data.fileRoutingExtensionsPlaceholder = this.loadI18nMessage('fileRoutingExtensionsPlaceholder')
    this.i18data.fileRoutingAddRule = this.loadI18nMessage('fileRoutingAddRule')
    this.i18data.fileRoutingResetRules = this.loadI18nMessage('fileRoutingResetRules')
    this.i18data.fileRoutingDeleteRule = this.loadI18nMessage('fileRoutingDeleteRule')
    this.i18data.fileRoutingDeleteRuleConfirm = this.loadI18nMessage('fileRoutingDeleteRuleConfirm')

    // options settings 通知设置
    this.i18data.notificationSetting = this.loadI18nMessage('notificationSetting')
    this.i18data.downloadNotificationSetting = this.loadI18nMessage('downloadNotificationSetting')
    this.i18data.downloadNotificationSetting1 = this.loadI18nMessage('downloadNotificationSetting1')
    this.i18data.downloadNotificationSetting2 = this.loadI18nMessage('downloadNotificationSetting2')
    this.i18data.downloadNotificationSetting3 = this.loadI18nMessage('downloadNotificationSetting3')
    this.i18data.downloadNotificationReservedTimeSetting = this.loadI18nMessage('downloadNotificationReservedTimeSetting')
    this.i18data.downloadNotificationRemainVisibleSetting = this.loadI18nMessage('downloadNotificationRemainVisibleSetting')
    this.i18data.downloadNotificationRemainVisibleDescSetting = this.loadI18nMessage('downloadNotificationRemainVisibleDescSetting')
    this.i18data.downloadToneSetting = this.loadI18nMessage('downloadToneSetting')

    // options settings 快捷键设置
    this.i18data.shortcutSetting = this.loadI18nMessage('shortcutSetting')
    this.i18data.openPopupSetting = this.loadI18nMessage('openPopupSetting')
    this.i18data.openPopupDetailsSetting = this.loadI18nMessage('openPopupDetailsSetting')
    this.i18data.chromePluginShortcutDescSetting = this.loadI18nMessage('chromePluginShortcutDescSetting')

    // options settings 同步设置
    this.i18data.syncSetting = this.loadI18nMessage('syncSetting')
    this.i18data.pluginSyncSetting = this.loadI18nMessage('pluginSyncSetting')
    this.i18data.pluginSyncDetailsSetting = this.loadI18nMessage('pluginSyncDetailsSetting')
    this.i18data.notSyncSetting = this.loadI18nMessage('notSyncSetting')

    // options theme 主题设置
    this.i18data.iconTitle = this.loadI18nMessage('iconTitle')
    this.i18data.themeAdaptation = this.loadI18nMessage('themeAdaptation')
    this.i18data.themeAdaptationDescription = this.loadI18nMessage('themeAdaptationDescription')
    this.i18data.themeAdaptationOption1 = this.loadI18nMessage('themeAdaptationOption1')
    this.i18data.themeAdaptationOption2 = this.loadI18nMessage('themeAdaptationOption2')
    this.i18data.themeAdaptationOption3 = this.loadI18nMessage('themeAdaptationOption3')
    this.i18data.iconColorSetting = this.loadI18nMessage('iconColorSetting')
    this.i18data.iconDownloadingColorSetting = this.loadI18nMessage('iconDownloadingColorSetting')
    this.i18data.downloadPanelTitle = this.loadI18nMessage('downloadPanelTitle')
    this.i18data.downloadPanelThemeCustomDescription = this.loadI18nMessage('downloadPanelThemeCustomDescription')
    this.i18data.pageSize = this.loadI18nMessage('pageSize')
    this.i18data.pageSizeDescription = this.loadI18nMessage('pageSizeDescription')
    this.i18data.themeSystemTitle = this.loadI18nMessage('themeSystemTitle')
    this.i18data.themeSystemDescription = this.loadI18nMessage('themeSystemDescription')
    this.i18data.themeSeriesLabel = this.loadI18nMessage('themeSeriesLabel')
    this.i18data.themePreviewModeAriaLabel = this.loadI18nMessage('themePreviewModeAriaLabel')
    this.i18data.themeSeriesTerminalTitle = this.loadI18nMessage('themeSeriesTerminalTitle')
    this.i18data.themeSeriesTerminalDescription = this.loadI18nMessage('themeSeriesTerminalDescription')
    this.i18data.themeSeriesTerminalDarkLabel = this.loadI18nMessage('themeSeriesTerminalDarkLabel')
    this.i18data.themeSeriesTerminalLightLabel = this.loadI18nMessage('themeSeriesTerminalLightLabel')
    this.i18data.themeSeriesTerminalDarkBadge = this.loadI18nMessage('themeSeriesTerminalDarkBadge')
    this.i18data.themeSeriesTerminalLightBadge = this.loadI18nMessage('themeSeriesTerminalLightBadge')
    this.i18data.themeSeriesTerminalDarkNote = this.loadI18nMessage('themeSeriesTerminalDarkNote')
    this.i18data.themeSeriesTerminalLightNote = this.loadI18nMessage('themeSeriesTerminalLightNote')
    this.i18data.themeSeriesGithubTitle = this.loadI18nMessage('themeSeriesGithubTitle')
    this.i18data.themeSeriesGithubDescription = this.loadI18nMessage('themeSeriesGithubDescription')
    this.i18data.themeSeriesGithubDarkLabel = this.loadI18nMessage('themeSeriesGithubDarkLabel')
    this.i18data.themeSeriesGithubLightLabel = this.loadI18nMessage('themeSeriesGithubLightLabel')
    this.i18data.themeSeriesGithubBadge = this.loadI18nMessage('themeSeriesGithubBadge')
    this.i18data.themeSeriesGithubDarkNote = this.loadI18nMessage('themeSeriesGithubDarkNote')
    this.i18data.themeSeriesGithubLightNote = this.loadI18nMessage('themeSeriesGithubLightNote')
    this.i18data.themeSeriesClaudeTitle = this.loadI18nMessage('themeSeriesClaudeTitle')
    this.i18data.themeSeriesClaudeDescription = this.loadI18nMessage('themeSeriesClaudeDescription')
    this.i18data.themeSeriesClaudeDarkLabel = this.loadI18nMessage('themeSeriesClaudeDarkLabel')
    this.i18data.themeSeriesClaudeLightLabel = this.loadI18nMessage('themeSeriesClaudeLightLabel')
    this.i18data.themeSeriesClaudeBadge = this.loadI18nMessage('themeSeriesClaudeBadge')
    this.i18data.themeSeriesClaudeDarkNote = this.loadI18nMessage('themeSeriesClaudeDarkNote')
    this.i18data.themeSeriesClaudeLightNote = this.loadI18nMessage('themeSeriesClaudeLightNote')
    this.i18data.themeSeriesBasicTitle = this.loadI18nMessage('themeSeriesBasicTitle')
    this.i18data.themeSeriesBasicDescription = this.loadI18nMessage('themeSeriesBasicDescription')
    this.i18data.themeSeriesBasicDarkLabel = this.loadI18nMessage('themeSeriesBasicDarkLabel')
    this.i18data.themeSeriesBasicLightLabel = this.loadI18nMessage('themeSeriesBasicLightLabel')
    this.i18data.themeSeriesBasicBadge = this.loadI18nMessage('themeSeriesBasicBadge')
    this.i18data.themeSeriesBasicDarkNote = this.loadI18nMessage('themeSeriesBasicDarkNote')
    this.i18data.themeSeriesBasicLightNote = this.loadI18nMessage('themeSeriesBasicLightNote')

    // options about 关于
    this.i18data.starAbout1 = this.loadI18nMessage('starAbout1')
    this.i18data.pluginShopAbout = this.loadI18nMessage('pluginShopAbout')
    this.i18data.starAbout2 = this.loadI18nMessage('starAbout2')
    this.i18data.versionAbout = this.loadI18nMessage('versionAbout')
  }

}

// 初始化时设置翻译
common.setI18data()

export default common
