/* eslint-disable no-undef */

const common = {
  /**
   * @param msg {String}
   * @return {String}
   */
  loadI18nMessage (msg) {
    return chrome.i18n.getMessage(msg)
  },

  /**
   * @param item {Object}
   */
  beforeHandler (item) {
    this.handleBasename(item)
    this.handleFileIcon(item)
  },

  /**
   * 将长文件名转成短文件名
   * @param item {Object}
   */
  handleBasename (item) {
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
        chrome.downloads.getFileIcon(item.id, { size: 32 }, iconUrl => {
          resolve(iconUrl)
        })
      }
    })
  },

  /**
   * 异步获取文件图标
   * @param item {Object}
   */
  handleFileIcon (item) {
    if (item.filename && !item.iconUrl) {
      // 置空，让后续改变可以被vue监控到
      item.iconUrl = null
    }

    this.getCustomFileIcon(item).then(iconUrl => {
      item.iconUrl = iconUrl
    })
  },

}

export default common
