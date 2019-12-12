/* eslint-disable no-undef */

const storage = {
  parseBoolean(value) {
    if (typeof value === 'boolean') {
      return value
    } else if (typeof value === 'string') {
      return value === 'true'
    } else {
      return false
    }
  },

  /**
   * 是否同步设置
   * 利用chrome.storage API实现登录谷歌账户时能够异地同步设置数据
   * @param value
   */
  setSync(value) {
    chrome.storage.sync.set({'sync': this.parseBoolean(value)})
  },
  getSync(callback) {
    chrome.storage.sync.get(['sync'], (result) => {
      callback(result.sync)
    })
  },

  /**
   * 设置语言
   * @param language
   */
  setLanguage(language) {
    chrome.storage.sync.set({'language': language})
  },
  getLanguage(callback) {
    chrome.storage.sync.get(['language'], (result) => {
      callback(result.language)
    })
  },

  /**
   * 设置是否接受下载危险的文件
   * @param value
   */
  setAcceptDanger(value) {
    this.getSync(result => {
      if (result) {
        chrome.storage.sync.set({'accept_danger': this.parseBoolean(value)})
      } else {
        chrome.storage.local.set({'accept_danger': this.parseBoolean(value)})
      }
    })
  },
  getAcceptDanger(callback) {
    this.getSync(result => {
      if (result) {
        chrome.storage.sync.get(['accept_danger'], (result) => {
          callback(result.accept_danger)
        })
      } else {
        chrome.storage.local.get(['accept_danger'], (result) => {
          callback(result.accept_danger)
        })
      }
    })
  },

  /**
   * 当获取配置为null时，实现一些默认设置
   * 只需要执行一次
   */
  defaultSettings() {
    this.getSync(value => {
      if (typeof value === 'undefined' || value === null) {
        // 插件设置默认启用同步
        storage.setSync(true)
      }
    })
  }

}

export default storage
