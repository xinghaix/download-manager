/* eslint-disable no-undef */

import {
  cloneDefaultDownloadDomainRoutingRules,
  cloneDefaultDownloadFileRoutingRules,
  DEFAULT_DOWNLOAD_ROUTING_PRECEDENCE
} from './downloadFileRouting.js'
import { POPUP_HEADER_BUTTON_KEYS } from './popupHeaderButtons.js'

const LOCAL_STORAGE_PREFIX = '__download_manager__'
const CONFIG_KEYS = [
  'theme',
  'icon_color',
  'icon_downloading_color',
  'download_panel_theme',
  'download_panel_page_size',
  'close_tooltip',
  'left_click_file',
  'right_click_file',
  'left_click_url',
  'right_click_url',
  'enable_animation',
  'show_download_progress',
  'delete_file_confirm',
  'download_confirm_before_start',
  'download_confirm_choose_folder',
  'download_started_notification',
  'download_completed_notification',
  'download_warning_notification',
  'download_started_tone',
  'download_completed_tone',
  'download_warning_tone',
  'download_notification_reserved_time',
  'download_notification_max_count',
  'download_notification_remain_visible',
  'download_context_menus',
  'download_context_menu_contexts',
  'download_file_routing_enabled',
  'download_file_routing_rules',
  'download_domain_routing_rules',
  'download_routing_precedence',
  'ui_theme',
  'ui_theme_series',
  'system_theme',
  'popup_header_buttons_visible',
  'popup_header_buttons',
  'popup_header_buttons_order'
]

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync && chrome.storage.local
}

function hasChromeSessionStorage() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session
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

function getStorageArea(useSync) {
  return chrome.storage[useSync ? 'sync' : 'local']
}

function sessionGet(key) {
  if (!hasChromeSessionStorage()) {
    return Promise.resolve(localGet(`session:${key}`))
  }

  return new Promise(resolve => {
    chrome.storage.session.get([key], result => resolve(result[key]))
  })
}

function sessionGetMany(keys) {
  if (!hasChromeSessionStorage()) {
    const result = {}
    keys.forEach(key => {
      result[key] = localGet(`session:${key}`)
    })
    return Promise.resolve(result)
  }

  return new Promise(resolve => {
    chrome.storage.session.get(keys, result => resolve(result))
  })
}

function sessionSetMany(values) {
  if (!hasChromeSessionStorage()) {
    Object.entries(values).forEach(([key, value]) => localSet(`session:${key}`, value))
    return Promise.resolve()
  }

  return new Promise(resolve => {
    chrome.storage.session.set(values, () => resolve())
  })
}

function sessionRemoveKeys(keys) {
  if (!hasChromeSessionStorage()) {
    keys.forEach(key => {
      try {
        localStorage.removeItem(getLocalKey(`session:${key}`))
      } catch (e) {
        // ignore localStorage errors in non-extension dev environments
      }
    })
    return Promise.resolve()
  }

  return new Promise(resolve => {
    chrome.storage.session.remove(keys, () => resolve())
  })
}

let cachedSyncPreference = null
let syncPreferencePromise = null
let syncListenerRegistered = false

function ensureSyncPreferenceListener() {
  if (syncListenerRegistered || !hasChromeStorage() || !chrome.storage.onChanged) {
    return
  }
  syncListenerRegistered = true
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes && Object.prototype.hasOwnProperty.call(changes, 'sync')) {
      const next = changes.sync.newValue
      cachedSyncPreference = typeof next === 'boolean' ? next : true
    }
  })
}

const storage = {
  getConfigKeys() {
    return [...CONFIG_KEYS]
  },

  getSyncPreference() {
    if (!hasChromeStorage()) {
      const localSync = localGet('sync')
      return Promise.resolve(typeof localSync === 'boolean' ? localSync : true)
    }

    ensureSyncPreferenceListener()
    if (typeof cachedSyncPreference === 'boolean') {
      return Promise.resolve(cachedSyncPreference)
    }

    if (syncPreferencePromise) {
      return syncPreferencePromise
    }

    syncPreferencePromise = new Promise(resolve => {
      chrome.storage.sync.get(['sync'], result => {
        const value = result && typeof result.sync === 'boolean' ? result.sync : true
        cachedSyncPreference = value
        syncPreferencePromise = null
        resolve(value)
      })
    })
    return syncPreferencePromise
  },

  setSyncPreference(value) {
    const normalized = Boolean(value)
    if (!hasChromeStorage()) {
      localSet('sync', normalized)
      return Promise.resolve()
    }

    ensureSyncPreferenceListener()
    cachedSyncPreference = normalized
    return new Promise(resolve => {
      chrome.storage.sync.set({ sync: normalized }, () => resolve())
    })
  },

  getFromArea(key, useSync) {
    if (!hasChromeStorage()) {
      return Promise.resolve(localGet(key))
    }

    return new Promise(resolve => {
      getStorageArea(useSync).get([key], result => resolve(result[key]))
    })
  },

  getManyFromArea(keys, useSync) {
    if (!hasChromeStorage()) {
      const result = {}
      keys.forEach(key => {
        result[key] = localGet(key)
      })
      return Promise.resolve(result)
    }

    return new Promise(resolve => {
      getStorageArea(useSync).get(keys, result => resolve(result))
    })
  },

  setManyToArea(values, useSync) {
    if (!hasChromeStorage()) {
      Object.entries(values).forEach(([key, value]) => localSet(key, value))
      return Promise.resolve()
    }

    return new Promise(resolve => {
      getStorageArea(useSync).set(values, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn('Storage set failed:', chrome.runtime.lastError.message)
        }
        resolve()
      })
    })
  },

  async switchStorageMode(targetUseSync) {
    if (!hasChromeStorage()) {
      localSet('sync', targetUseSync)
      return
    }

    const currentUseSync = await this.getSyncPreference()
    if (currentUseSync === targetUseSync) {
      await this.setSyncPreference(targetUseSync)
      return
    }

    const sourceValues = await this.getManyFromArea(CONFIG_KEYS, currentUseSync)
    const valuesToMigrate = {}

    CONFIG_KEYS.forEach(key => {
      if (typeof sourceValues[key] !== 'undefined') {
        valuesToMigrate[key] = sourceValues[key]
      }
    })

    if (Object.keys(valuesToMigrate).length > 0) {
      await this.setManyToArea(valuesToMigrate, targetUseSync)
    }

    await this.setSyncPreference(targetUseSync)
  },

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

    if (key === 'sync') {
      return this.setSyncPreference(Boolean(value))
    }

    return this.getSyncPreference().then(isSync => this.setManyToArea({ [key]: value }, isSync))
  },

  /**
   * 将同步和未同步时的方法统一包装下，方便使用
   * @param keys {String}
   * @return {Promise}
   */
  get(keys) {
    if (keys === 'sync') {
      return this.getSyncPreference()
    }

    if (!hasChromeStorage()) {
      return Promise.resolve(localGet(keys))
    }

    return this.getSyncPreference().then(isSync => this.getFromArea(keys, isSync))
  },

  async getMany(keys) {
    const normalizedKeys = Array.isArray(keys) ? keys : [keys]
    const result = {}
    const configKeys = normalizedKeys.filter(key => key !== 'sync')
    let syncPreference = null

    if (normalizedKeys.includes('sync')) {
      syncPreference = await this.getSyncPreference()
      result.sync = syncPreference
    }

    if (!configKeys.length) {
      return result
    }

    if (!hasChromeStorage()) {
      configKeys.forEach(key => {
        result[key] = localGet(key)
      })
      return result
    }

    const isSync = typeof syncPreference === 'boolean' ? syncPreference : await this.getSyncPreference()
    return {
      ...result,
      ...await this.getManyFromArea(configKeys, isSync)
    }
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
  getSession(key) {
    return sessionGet(key)
  },

  getManySession(keys) {
    return sessionGetMany(keys)
  },

  setSession(key, value) {
    return sessionSetMany({ [key]: value })
  },

  setManySession(values) {
    return sessionSetMany(values)
  },

  removeSession(keys) {
    const normalizedKeys = Array.isArray(keys) ? keys : [keys]
    return sessionRemoveKeys(normalizedKeys)
  },

  async defaultSettings() {
    await this.setDefaultIfNull('sync', true)

    const currentValues = await this.getMany(CONFIG_KEYS)
    const defaults = {
      theme: 'auto',
      download_panel_theme: 'light',
      download_panel_page_size: { width: 400, height: 420 },
      close_tooltip: true,
      left_click_file: true,
      right_click_file: true,
      left_click_url: true,
      right_click_url: true,
      enable_animation: false,
      show_download_progress: true,
      delete_file_confirm: true,
      download_confirm_before_start: false,
      download_confirm_choose_folder: false,
      download_started_notification: false,
      download_completed_notification: false,
      download_warning_notification: false,
      download_started_tone: false,
      download_completed_tone: false,
      download_notification_reserved_time: 10,
      download_notification_max_count: 3,
      download_notification_remain_visible: false,
      download_warning_tone: false,
      download_context_menus: true,
      download_context_menu_contexts: ['link', 'image', 'audio', 'video'],
      download_file_routing_enabled: false,
      download_file_routing_rules: cloneDefaultDownloadFileRoutingRules(),
      download_domain_routing_rules: cloneDefaultDownloadDomainRoutingRules(),
      download_routing_precedence: DEFAULT_DOWNLOAD_ROUTING_PRECEDENCE,
      popup_header_buttons_visible: true,
      popup_header_buttons: [...POPUP_HEADER_BUTTON_KEYS],
      popup_header_buttons_order: [...POPUP_HEADER_BUTTON_KEYS]
    }

    const toWrite = {}

    const iconColor = currentValues.icon_color
    if (iconColor === null || typeof iconColor === 'undefined' || typeof iconColor === 'string') {
      toWrite.icon_color = {
        light: '#000000',
        dark: '#989898'
      }
    }

    const iconDownloadingColor = currentValues.icon_downloading_color
    if (
      iconDownloadingColor === null ||
      typeof iconDownloadingColor === 'undefined' ||
      typeof iconDownloadingColor === 'string'
    ) {
      toWrite.icon_downloading_color = {
        light: '#00d032',
        dark: '#ffa500'
      }
    }

    Object.entries(defaults).forEach(([key, defaultValue]) => {
      const existing = currentValues[key]
      if (existing === null || typeof existing === 'undefined') {
        toWrite[key] = defaultValue
      }
    })

    if (Object.keys(toWrite).length > 0) {
      const isSync = await this.getSyncPreference()
      await this.setManyToArea(toWrite, isSync)
    }
  }

}

export default storage
