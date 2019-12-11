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
  // 是否同步设置
  // 利用chrome.storage API实现登录谷歌账户时能够异地同步设置数据
  setSync(value) {
    chrome.storage.sync.set({'sync': this.parseBoolean(value)})
  },
  getSync(callback) {
    chrome.storage.sync.get(['sync'], (result) => {
      callback(result.sync)
    })
  },

  // 是否接受下载危险的文件
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

}

export default storage
