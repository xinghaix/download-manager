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
   * 设置是否关闭tooltip
   * @param value Boolean
   */
  setCloseTooltip(value) {
    this.getSync(result => {
      if (result) {
        chrome.storage.sync.set({'close_tooltip': this.parseBoolean(value)})
      } else {
        chrome.storage.local.set({'close_tooltip': this.parseBoolean(value)})
      }
    })
  },
  getCloseTooltip(callback) {
    this.getSync(result => {
      if (result) {
        chrome.storage.sync.get(['close_tooltip'], (result) => {
          callback(result.close_tooltip)
        })
      } else {
        chrome.storage.local.get(['close_tooltip'], (result) => {
          callback(result.close_tooltip)
        })
      }
    })
  },

  /**
   * 是否关闭左键打开文件
   * @param value Boolean
   */
  setLeftClickFile(value) {
    this.getSync(result => {
      if (result) {
        chrome.storage.sync.set({'left_click_file': this.parseBoolean(value)})
      } else {
        chrome.storage.local.set({'left_click_file': this.parseBoolean(value)})
      }
    })
  },
  getLeftClickFile(callback) {
    this.getSync(result => {
      if (result) {
        chrome.storage.sync.get(['left_click_file'], (result) => {
          callback(result.left_click_file)
        })
      } else {
        chrome.storage.local.get(['left_click_file'], (result) => {
          callback(result.left_click_file)
        })
      }
    })
  },

  /**
   * 是否启用右键复制文件名
   * @param value Boolean
   */
  setRightClickFile(value) {
    this.getSync(result => {
      if (result) {
        chrome.storage.sync.set({'right_click_file': this.parseBoolean(value)})
      } else {
        chrome.storage.local.set({'right_click_file': this.parseBoolean(value)})
      }
    })
  },
  getRightClickFile(callback) {
    this.getSync(result => {
      if (result) {
        chrome.storage.sync.get(['right_click_file'], (result) => {
          callback(result.right_click_file)
        })
      } else {
        chrome.storage.local.get(['right_click_file'], (result) => {
          callback(result.right_click_file)
        })
      }
    })
  },

  /**
   * 是否启用左键打开文件下载链接
   * @param value Boolean
   */
  setLeftClickUrl(value) {
    this.getSync(result => {
      if (result) {
        chrome.storage.sync.set({'left_click_url': this.parseBoolean(value)})
      } else {
        chrome.storage.local.set({'left_click_url': this.parseBoolean(value)})
      }
    })
  },
  getLeftClickUrl(callback) {
    this.getSync(result => {
      if (result) {
        chrome.storage.sync.get(['left_click_url'], (result) => {
          callback(result.left_click_url)
        })
      } else {
        chrome.storage.local.get(['left_click_url'], (result) => {
          callback(result.left_click_url)
        })
      }
    })
  },

  /**
   * 是否启用右键复制下载链接
   * @param value Boolean
   */
  setRightClickUrl(value) {
    this.getSync(result => {
      if (result) {
        chrome.storage.sync.set({'right_click_url': this.parseBoolean(value)})
      } else {
        chrome.storage.local.set({'right_click_url': this.parseBoolean(value)})
      }
    })
  },
  getRightClickUrl(callback) {
    this.getSync(result => {
      if (result) {
        chrome.storage.sync.get(['right_click_url'], (result) => {
          callback(result.right_click_url)
        })
      } else {
        chrome.storage.local.get(['right_click_url'], (result) => {
          callback(result.right_click_url)
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

    this.getCloseTooltip(value => {
      if (typeof value === 'undefined' || value === null) {
        // 插件设置默认不展示提示信息
        storage.setCloseTooltip(true)
      }
    })

    this.getLeftClickFile(value => {
      if (typeof value === 'undefined' || value === null) {
        storage.setLeftClickFile(true)
      }
    })

    this.getRightClickFile(value => {
      if (typeof value === 'undefined' || value === null) {
        storage.setRightClickFile(true)
      }
    })

    this.getLeftClickUrl(value => {
      if (typeof value === 'undefined' || value === null) {
        storage.setLeftClickUrl(true)
      }
    })

    this.getRightClickUrl(value => {
      if (typeof value === 'undefined' || value === null) {
        storage.setRightClickUrl(true)
      }
    })
  }

}

export default storage
