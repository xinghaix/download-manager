/* eslint-disable no-undef */

const common = {

  /**
   * @param msg {String}
   * @return {String}
   */
  loadI18nMessage(msg) {
    return chrome.i18n.getMessage(msg)
  },

  /**
   * @param item {Object}
   */
  beforeHandler(item) {
    this.handleBasename(item)
    this.handleFileIcon(item)
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
    }
  },

  /**
   * 获取文件图标
   * @param item {Object}
   * @return {Promise<Object>}
   */
  getCustomFileIcon(item) {
    return new Promise(resolve => {
      if (item.filename && !item.iconUrl) {
        chrome.downloads.getFileIcon(item.id, {size: 32}, iconUrl => {
          resolve(iconUrl)
        })
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
    if (url) {
      let trimUrl = url.trim()
      trimUrl !== '' && chrome.downloads.download({url: trimUrl}, () => {
        if (chrome.runtime.lastError) {
          // todo
        }
      })
    }
  },

  /**
   * 检测系统是否是深色模式
   * @return {boolean}
   */
  isInDarkMode() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  },

  // 翻译数据
  i18data: {},

  setI18data() {
    // background 通知
    this.i18data.deleteNotification = this.loadI18nMessage('deleteNotification')
    this.i18data.downloadCompletedNotification = this.loadI18nMessage('downloadCompletedNotification')
    this.i18data.openFolderNotification = this.loadI18nMessage('openFolderNotification')

    // popup 顶栏tooltip
    this.i18data.newDownload = this.loadI18nMessage('newDownload')
    this.i18data.clearList = this.loadI18nMessage('clearList')
    this.i18data.openDownloadFolder = this.loadI18nMessage('openDownloadFolder')
    this.i18data.openSettings = this.loadI18nMessage('openSettings')
    this.i18data.newDownloadPlaceholder = this.loadI18nMessage('newDownloadPlaceholder')

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

    // options settings 上下文菜单
    this.i18data.contextMenus = this.loadI18nMessage('contextMenus')
    this.i18data.downloadContextMenusSetting = this.loadI18nMessage('downloadContextMenusSetting')
    this.i18data.downloadContextMenusDescSetting = this.loadI18nMessage('downloadContextMenusDescSetting')

    // options settings 通知设置
    this.i18data.notificationSetting = this.loadI18nMessage('notificationSetting')
    this.i18data.downloadNotificationSetting = this.loadI18nMessage('downloadNotificationSetting')
    this.i18data.downloadNotificationSetting1 = this.loadI18nMessage('downloadNotificationSetting1')
    this.i18data.downloadNotificationSetting2 = this.loadI18nMessage('downloadNotificationSetting2')
    this.i18data.downloadNotificationSetting3 = this.loadI18nMessage('downloadNotificationSetting3')
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
    this.i18data.iconColorSetting = this.loadI18nMessage('iconColorSetting')
    this.i18data.iconDownloadingColorSetting = this.loadI18nMessage('iconDownloadingColorSetting')
    this.i18data.downloadPanelTitle = this.loadI18nMessage('downloadPanelTitle')
    this.i18data.downloadPanelThemeCustomDescription = this.loadI18nMessage('downloadPanelThemeCustomDescription')

    // options about 关于
    this.i18data.starAbout1 = this.loadI18nMessage('starAbout1')
    this.i18data.pluginShopAbout = this.loadI18nMessage('pluginShopAbout')
    this.i18data.starAbout2 = this.loadI18nMessage('starAbout2')
    this.i18data.versionAbout = this.loadI18nMessage('versionAbout')

    // options about 版本列表
    this.i18data.versionList = [
      this.loadI18nMessage('version1_0_0'),
      this.loadI18nMessage('version0_9_1'),
      this.loadI18nMessage('version0_9_0'),
      this.loadI18nMessage('version0_8_5'),
      this.loadI18nMessage('version0_8_0'),
      this.loadI18nMessage('version0_7_0'),
      this.loadI18nMessage('version0_6_2'),
      this.loadI18nMessage('version0_5_1'),
      this.loadI18nMessage('version0_4'),
    ]
  }

}

// 初始化时设置翻译
common.setI18data()

export default common
