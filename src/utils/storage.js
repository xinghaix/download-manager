/* eslint-disable no-undef */

const LOCAL_STORAGE_PREFIX = '__download_manager__'

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync && chrome.storage.local
}

function getLocalKey(key) {
  return `${LOCAL_STORAGE_PREFIX}:${key}`
}

function localGet(key) {
  try {
    const raw = localStorage.getItem(getLocalKey(key))
    if (raw === null || typeof raw === 'undefined') return null
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

function localSet(key, value) {
  try {
    localStorage.setItem(getLocalKey(key), JSON.stringify(value))
  } catch (e) {
    // ignore localStorage errors in non-extension dev environments
  }
}

const storage = {
  /**
   * 设置配置
   * 将同步和未同步时的方法统一包装下，方便使用
   * @param key {String}
   * @param value
   */
  set(key, value) {
    if (!hasChromeStorage()) {
      localSet(key, value)
      return Promise.resolve()
    }

    return new Promise(resolve => {
      chrome.storage.sync.get('sync', result => {
        const isSync = !!(result && result.sync)
        chrome.storage[isSync ? 'sync' : 'local'].set({ [key]: value }, () => resolve())
      })
    })
  },

  /**
   * 将同步和未同步时的方法统一包装下，方便使用
   * @param keys {String}
   * @return {Promise}
   */
  get(keys) {
    if (!hasChromeStorage()) {
      return Promise.resolve(localGet(keys))
    }

    return new Promise(resolve => {
      chrome.storage.sync.get('sync', result => {
        const isSync = !!(result && result.sync)
        chrome.storage[isSync ? 'sync' : 'local'].get([keys], result2 => resolve(result2[keys]))
      })
    })
  },

  /**
   * 如果对应key的value为null的话，就设置默认的value
   * @param key {String}
   * @param defaultValue
   */
  async setDefaultIfNull(key, defaultValue) {
    let value = await this.get(key)
    if (value === null || typeof value === 'undefined') {
      this.set(key, defaultValue)
    }
  },

  /**
   * 当获取配置为null时，提前设置默认配置
   * 只需要执行一次
   */
  async defaultSettings() {
    // 插件设置默认启用同步
    await this.setDefaultIfNull('sync', true)
    // 主题 - 主题自适应
    await this.setDefaultIfNull('theme', 'auto')

    // 主题 - 图标默认颜色
    // 为了解决之前存储的是字符串类型，这里提前设置下
    let iconColor = await this.get('icon_color')
    if (iconColor === null
      || typeof iconColor === 'undefined'
      || typeof iconColor === 'string') {
      await this.set('icon_color', {
        'light': '#000000',
        'dark': '#989898'
      })
    }
    // 主题 - 下载中图标默认颜色
    let iconDownloadingColor = await this.get('icon_downloading_color')
    if (iconDownloadingColor === null
      || typeof iconDownloadingColor === 'undefined'
      || typeof iconDownloadingColor === 'string') {
      this.set('icon_downloading_color', {
        'light': '#00d032',
        'dark': '#ffa500'
      })
    }

    // 主题 - 下载面板主题，默认为亮色
    await this.setDefaultIfNull('download_panel_theme', 'light')
    await this.setDefaultIfNull('download_panel_page_size', { width: 400, height: 420 })
    // 设置 - 下载 - 插件设置默认不展示提示信息
    await this.setDefaultIfNull('close_tooltip', true)
    await this.setDefaultIfNull('left_click_file', true)
    await this.setDefaultIfNull('right_click_file', true)
    await this.setDefaultIfNull('left_click_url', true)
    await this.setDefaultIfNull('right_click_url', true)
    await this.setDefaultIfNull('enable_animation', false)
    await this.setDefaultIfNull('download_started_notification', false)
    await this.setDefaultIfNull('download_completed_notification', false)
    await this.setDefaultIfNull('download_warning_notification', false)
    await this.setDefaultIfNull('download_started_tone', false)
    await this.setDefaultIfNull('download_completed_tone', false)
    await this.setDefaultIfNull('download_notification_reserved_time', 10)
    await this.setDefaultIfNull('download_notification_remain_visible', false)
    await this.setDefaultIfNull('download_warning_tone', false)
    // 插件默认创建下载文件上下文菜单
    await this.setDefaultIfNull('download_context_menus', true)
  }

}

export default storage
