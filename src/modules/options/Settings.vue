<!--suppress UnterminatedStatementJS -->
<template>
  <div class="home" v-if="show">
    <h2 class="title">{{i18data.downloadSetting}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item pointer">
        <div class="content" @click="leftClickFile = !leftClickFile">
          <span class="setting-title">{{i18data.leftClickFileSetting}}</span>
        </div>
        <el-switch class="switch" v-model="leftClickFile" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item pointer">
        <div class="content" @click="rightClickFile = !rightClickFile">
          <span class="setting-title">{{i18data.rightClickFileSetting}}</span>
        </div>
        <el-switch class="switch" v-model="rightClickFile" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item pointer">
        <div class="content" @click="leftClickUrl = !leftClickUrl">
          <div class="setting-title">{{i18data.leftClickUrlSetting}}</div>
        </div>
        <el-switch class="switch" v-model="leftClickUrl" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item pointer">
        <div class="content" @click="rightClickUrl = !rightClickUrl">
          <span class="setting-title">{{i18data.rightClickUrlSetting}}</span>
        </div>
        <el-switch class="switch" v-model="rightClickUrl" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item pointer">
        <div class="content" @click="showTooltip = !showTooltip">
          <span class="setting-title">{{i18data.showTooltipSetting}}</span>
        </div>
        <el-switch class="switch" v-model="showTooltip" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item pointer">
        <div class="content" @click="enableAnimation = !enableAnimation">
          <span class="setting-title">{{i18data.enableAnimation}}</span>
        </div>
        <el-switch class="switch" v-model="enableAnimation" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item pointer">
        <div class="content" @click="showDownloadProgress = !showDownloadProgress">
          <span class="setting-title">{{i18data.showDownloadProgressSetting}}</span>
          <span class="setting-description">{{i18data.showDownloadProgressDescSetting}}</span>
        </div>
        <el-switch class="switch" v-model="showDownloadProgress" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
    </el-card>

    <h2 class="title">{{i18data.contextMenus}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item pointer">
        <div class="content" @click="downloadContextMenus = !downloadContextMenus">
          <span class="setting-title">{{i18data.downloadContextMenusSetting}}</span>
          <span class="setting-description">{{i18data.downloadContextMenusDescSetting}}</span>
        </div>
        <el-switch class="switch" v-model="downloadContextMenus" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item" :class="{ false: !downloadContextMenus }">
        <div class="content">
          <span class="setting-title">{{i18data.downloadContextMenuContextsSetting}}</span>
          <span class="setting-description">{{i18data.downloadContextMenuContextsDescSetting}}</span>
        </div>
        <div class="switch width">
          <el-checkbox-button :label="i18data.link" v-model="downloadContextMenuLink" :disabled="!downloadContextMenus"/>
          <el-checkbox-button :label="i18data.image" v-model="downloadContextMenuImage" :disabled="!downloadContextMenus"/>
          <el-checkbox-button :label="i18data.audio" v-model="downloadContextMenuAudio" :disabled="!downloadContextMenus"/>
          <el-checkbox-button :label="i18data.video" v-model="downloadContextMenuVideo" :disabled="!downloadContextMenus"/>
        </div>
      </div>
    </el-card>

    <h2 class="title">{{i18data.fileRoutingSetting}}</h2>
    <el-card class="box-card file-routing-card" shadow="hover">
      <div class="item pointer">
        <div class="content" @click="downloadFileRoutingEnabled = !downloadFileRoutingEnabled">
          <span class="setting-title">{{i18data.fileRoutingEnableSetting}}</span>
          <span class="setting-description">{{i18data.fileRoutingDescription}}</span>
        </div>
        <el-switch class="switch" v-model="downloadFileRoutingEnabled" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="file-routing-toolbar">
        <span class="setting-title">{{i18data.fileRoutingRulesSetting}}</span>
        <div class="file-routing-actions">
          <el-button size="small" @click="addFileRoutingRule">
            <el-icon><Plus /></el-icon>
            {{i18data.fileRoutingAddRule}}
          </el-button>
          <el-button size="small" @click="resetFileRoutingRules">
            <el-icon><RefreshLeft /></el-icon>
            {{i18data.fileRoutingResetRules}}
          </el-button>
        </div>
      </div>
      <div class="file-routing-table" role="table">
        <div class="file-routing-table-head" role="row">
          <div role="columnheader">{{i18data.fileRoutingFolderLabel}}</div>
          <div role="columnheader">{{i18data.fileRoutingExtensionsLabel}}</div>
          <div role="columnheader">{{i18data.fileRoutingActionsLabel}}</div>
        </div>
        <div class="file-routing-table-row"
             v-for="rule in downloadFileRoutingRules"
             :key="rule.id"
             role="row"
             :class="{ disabled: !downloadFileRoutingEnabled || !rule.enabled }"
             @focusout="handleRuleFocusOut(rule, $event)">
          <div class="file-routing-table-cell" role="cell" :data-label="i18data.fileRoutingFolderLabel">
            <el-input v-model="rule.folder"
                      :class="{ 'file-routing-field-error': isExistingFileRoutingRuleInvalid(rule) && !isFileRoutingRuleFolderValid(rule) }"
                      size="small"
                      :disabled="!downloadFileRoutingEnabled"
                      :placeholder="i18data.fileRoutingFolderPlaceholder"
                      @input="handleRuleFolderInput(rule)"
                      @blur="handleRuleFolderBlur(rule)"/>
          </div>
          <div class="file-routing-table-cell" role="cell" :data-label="i18data.fileRoutingExtensionsLabel">
            <el-input-tag class="file-routing-extensions"
                          :class="{ 'file-routing-field-error': isExistingFileRoutingRuleInvalid(rule) && !isFileRoutingRuleExtensionsValid(rule) }"
                          :model-value="rule.extensions"
                          size="small"
                          :delimiter="/[\s,;，；]+/"
                          :disabled="!downloadFileRoutingEnabled"
                          :placeholder="i18data.fileRoutingExtensionsPlaceholder"
                          @update:model-value="updateRuleExtensions(rule, $event)"
                          @change="handleRuleExtensionsChange(rule)"
                          @blur="handleRuleExtensionsBlur(rule)"/>
          </div>
          <div class="file-routing-table-cell file-routing-row-actions" role="cell" :data-label="i18data.fileRoutingActionsLabel">
            <div class="file-routing-enable">
              <el-switch v-model="rule.enabled" active-color="#409EFF" inactive-color="#bdc1c6"
                         :aria-label="i18data.fileRoutingRuleEnabledLabel"
                         :title="i18data.fileRoutingRuleEnabledLabel"
                         :disabled="!downloadFileRoutingEnabled || isFileRoutingRuleIncomplete(rule)"
                         @change="flushFileRoutingRules"/>
            </div>
            <el-popconfirm
              :title="i18data.fileRoutingDeleteRuleConfirm"
              :confirm-button-text="i18data.clearPopConfirmText"
              :cancel-button-text="i18data.clearPopCancelText"
              confirm-button-type="danger"
              width="220"
              @confirm="deleteFileRoutingRule(rule.id)">
              <template #reference>
                <el-button class="file-routing-delete" text type="danger"
                           :aria-label="i18data.fileRoutingDeleteRule"
                           :title="i18data.fileRoutingDeleteRule">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </div>
    </el-card>

    <h2 class="title">{{i18data.notificationSetting}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content">
          <span class="setting-title">{{i18data.downloadNotificationSetting}}</span>
        </div>
        <div class="switch width">
          <el-checkbox-button :label="i18data.downloadNotificationSetting1" v-model="downloadStartedNotification"/>
          <el-checkbox-button :label="i18data.downloadNotificationSetting2" v-model="downloadCompletedNotification"/>
          <el-checkbox-button :label="i18data.downloadNotificationSetting3" v-model="downloadWarningNotification"/>
        </div>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content">
          <span class="setting-title">{{i18data.downloadNotificationReservedTimeSetting}}</span>
        </div>
        <div class="switch width">
          <el-input-number v-model="downloadNotificationReservedTime" :controls="false"
                           class="reserved_time" :max="43200" size="small"></el-input-number>
        </div>
      </div>
      <el-divider/>
      <div class="item pointer" :class="chromeVersionGreaterThan50 ? 'true' : 'false'">
        <div class="content" @click="chromeVersionGreaterThan50 && (downloadNotificationRemainVisible = !downloadNotificationRemainVisible)">
          <span class="setting-title">{{i18data.downloadNotificationRemainVisibleSetting}}</span>
          <span class="setting-description">{{i18data.downloadNotificationRemainVisibleDescSetting}}</span>
        </div>
        <el-switch class="switch" v-model="downloadNotificationRemainVisible"
                   active-color="#409EFF" inactive-color="#bdc1c6" :disabled="!chromeVersionGreaterThan50"/>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content">
          <span class="setting-title">{{i18data.downloadToneSetting}}</span>
        </div>
        <div class="switch width">
          <el-checkbox-button :label="i18data.downloadNotificationSetting1" v-model="downloadStartedTone"/>
          <el-checkbox-button :label="i18data.downloadNotificationSetting2" v-model="downloadCompletedTone"/>
          <el-checkbox-button :label="i18data.downloadNotificationSetting3" v-model="downloadWarningTone"/>
        </div>
      </div>
    </el-card>

    <h2 class="title">{{i18data.shortcutSetting}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content">
          <span class="setting-title">
            {{i18data.openPopupSetting}}
            <el-tooltip :content="i18data.notSyncSetting" placement="top"
                        effect="dark" popper-class="tooltip" :enterable="false">
              <el-icon><InfoFilled /></el-icon>
            </el-tooltip>
          </span>
          <span class="setting-description">
            {{i18data.openPopupDetailsSetting}}
            <a class="link" @click="openUrl(chromePluginShortcutSettingUrl)">{{i18data.chromePluginShortcutDescSetting}}</a>
          </span>
        </div>
        <div class="switch width"><a class="code">{{openPopupShortcut}}</a></div>
      </div>
    </el-card>

    <h2 class="title">{{i18data.syncSetting}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item pointer">
        <div class="content" @click="isSync = !isSync">
          <span class="setting-title">{{i18data.pluginSyncSetting}}</span>
          <span class="setting-description">{{i18data.pluginSyncDetailsSetting}}</span>
        </div>
        <el-switch class="switch description" v-model="isSync" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
    </el-card>
  </div>
</template>

<script>
import { Delete, InfoFilled, Plus, RefreshLeft } from '@element-plus/icons-vue'
import storage from '../../utils/storage'
import common from '../../utils/common'
import {
  cloneDefaultDownloadFileRoutingRules,
  normalizeDownloadFileRoutingRules,
  normalizeFolderPath,
  parseExtensions
} from '../../utils/downloadFileRouting'

export default {
  name: 'Settings',
  components: { Delete, InfoFilled, Plus, RefreshLeft },
  props: {
    i18data: Object
  },
  watch: {
    async isSync(val, oldVal) {
      if (this.initializing || this.syncTransitioning) {
        return
      }

      this.syncTransitioning = true
      try {
        await storage.switchStorageMode(val)
      } catch (e) {
        console.warn('Failed to switch storage mode', e)
        this.isSync = oldVal
      } finally {
        this.syncTransitioning = false
      }
    },

    async showTooltip(val) {
      await this.persistSetting('close_tooltip', !val)
    },
    async leftClickFile(val) {
      await this.persistSetting('left_click_file', val)
    },
    async rightClickFile(val) {
      await this.persistSetting('right_click_file', val)
    },
    async leftClickUrl(val) {
      await this.persistSetting('left_click_url', val)
    },
    async rightClickUrl(val) {
      await this.persistSetting('right_click_url', val)
    },
    async enableAnimation(val) {
      await this.persistSetting('enable_animation', val)
    },
    async showDownloadProgress(val) {
      await this.persistSetting('show_download_progress', val)
    },

    async downloadContextMenus(val) {
      await this.persistSetting('download_context_menus', val)
      if (this.initializing) {
        return
      }
      this.notifyContextMenusChanged(val)
    },

    async downloadContextMenuLink() {
      await this.persistContextMenuContexts()
    },
    async downloadContextMenuImage() {
      await this.persistContextMenuContexts()
    },
    async downloadContextMenuAudio() {
      await this.persistContextMenuContexts()
    },
    async downloadContextMenuVideo() {
      await this.persistContextMenuContexts()
    },

    async downloadFileRoutingEnabled(val) {
      await this.persistSetting('download_file_routing_enabled', val)
    },

    downloadFileRoutingRules: {
      handler() {
        this.scheduleFileRoutingRulesPersist()
      },
      deep: true
    },

    async downloadStartedNotification(val) {
      await this.persistSetting('download_started_notification', val)
    },
    async downloadCompletedNotification(val) {
      await this.persistSetting('download_completed_notification', val)
    },
    async downloadWarningNotification(val) {
      await this.persistSetting('download_warning_notification', val)
    },

    async downloadStartedTone(val) {
      await this.persistSetting('download_started_tone', val)
    },
    async downloadCompletedTone(val) {
      await this.persistSetting('download_completed_tone', val)
    },
    async downloadWarningTone(val) {
      await this.persistSetting('download_warning_tone', val)
    },

    async downloadNotificationReservedTime(val) {
      await this.persistSetting('download_notification_reserved_time', val)
    },
    async downloadNotificationRemainVisible(val) {
      await this.persistSetting('download_notification_remain_visible', val)
    }
  },
  async mounted() {
    try {
      // 获取插件设置
      // 下载设置
      this.leftClickFile = await storage.get('left_click_file')
      this.rightClickFile = await storage.get('right_click_file')
      this.leftClickUrl = await storage.get('left_click_url')
      this.rightClickUrl = await storage.get('right_click_url')

      const closeTooltip = await storage.get('close_tooltip')
      this.showTooltip = typeof closeTooltip === 'boolean' ? !closeTooltip : false

      const enableAnimation = await storage.get('enable_animation')
      this.enableAnimation = typeof enableAnimation === 'boolean' ? enableAnimation : false

      const showDownloadProgress = await storage.get('show_download_progress')
      this.showDownloadProgress = typeof showDownloadProgress === 'boolean' ? showDownloadProgress : true

      // 上下文菜单设置
      const downloadContextMenus = await storage.get('download_context_menus')
      this.downloadContextMenus = typeof downloadContextMenus === 'boolean' ? downloadContextMenus : true

      const downloadContextMenuContexts = await storage.get('download_context_menu_contexts')
      this.applyContextMenuContexts(downloadContextMenuContexts)

      // 文件分类下载设置
      const downloadFileRoutingEnabled = await storage.get('download_file_routing_enabled')
      this.downloadFileRoutingEnabled = typeof downloadFileRoutingEnabled === 'boolean' ? downloadFileRoutingEnabled : false

      const downloadFileRoutingRules = await storage.get('download_file_routing_rules')
      this.downloadFileRoutingRules = normalizeDownloadFileRoutingRules(downloadFileRoutingRules)

      // 通知设置
      const downloadStartedNotification = await storage.get('download_started_notification')
      this.downloadStartedNotification = typeof downloadStartedNotification === 'boolean' ? downloadStartedNotification : false

      const downloadCompletedNotification = await storage.get('download_completed_notification')
      this.downloadCompletedNotification = typeof downloadCompletedNotification === 'boolean' ? downloadCompletedNotification : false

      const downloadWarningNotification = await storage.get('download_warning_notification')
      this.downloadWarningNotification = typeof downloadWarningNotification === 'boolean' ? downloadWarningNotification : false

      const downloadStartedTone = await storage.get('download_started_tone')
      this.downloadStartedTone = typeof downloadStartedTone === 'boolean' ? downloadStartedTone : false

      const downloadCompletedTone = await storage.get('download_completed_tone')
      this.downloadCompletedTone = typeof downloadCompletedTone === 'boolean' ? downloadCompletedTone : false

      const downloadWarningTone = await storage.get('download_warning_tone')
      this.downloadWarningTone = typeof downloadWarningTone === 'boolean' ? downloadWarningTone : false

      const downloadNotificationReservedTime = await storage.get('download_notification_reserved_time')
      this.downloadNotificationReservedTime = Number.isFinite(Number(downloadNotificationReservedTime))
        ? Number(downloadNotificationReservedTime)
        : 10

      const downloadNotificationRemainVisible = await storage.get('download_notification_remain_visible')
      this.downloadNotificationRemainVisible = typeof downloadNotificationRemainVisible === 'boolean'
        ? downloadNotificationRemainVisible
        : false

      // 快捷键设置
      this.openPopupShortcut = await this.getOpenPopupShortcut()

      // 同步设置
      const sync = await storage.get('sync')
      this.isSync = typeof sync === 'boolean' ? sync : true

      this.chromeVersionGreaterThan50 = common.chromeVersionGreaterThan(50)
    } catch (e) {
      console.warn('Failed to initialize Settings page', e)
    } finally {
      this.initializing = false
      // 开始渲染页面
      this.show = true
    }
  },
  data() {
    return {
      show: false,

      chromePluginShortcutSettingUrl: 'chrome://extensions/shortcuts',

      // 下载设置
      leftClickFile: true,
      leftClickUrl: true,
      rightClickFile: true,
      rightClickUrl: true,
      showTooltip: false,
      enableAnimation: false,
      showDownloadProgress: true,

      // 上下文菜单
      downloadContextMenus: true,
      downloadContextMenuLink: true,
      downloadContextMenuImage: true,
      downloadContextMenuAudio: true,
      downloadContextMenuVideo: true,
      contextMenusUpdating: false,

      // 文件分类下载
      downloadFileRoutingEnabled: false,
      downloadFileRoutingRules: [],

      // 通知设置
      downloadStartedNotification: false,
      downloadCompletedNotification: false,
      downloadWarningNotification: false,
      downloadStartedTone: false,
      downloadCompletedTone: false,
      downloadWarningTone: false,
      // 通知保留时间
      downloadNotificationReservedTime: 10,
      downloadNotificationRemainVisible: false,

      // 快捷键设置
      openPopupShortcut: 'Alt+X',

      // 同步设置
      isSync: true,
      initializing: true,
      syncTransitioning: false,
      fileRoutingPersistTimer: null,
      fileRoutingPersistQueue: Promise.resolve(),

      chromeVersionGreaterThan50: true
    }
  },
  beforeUnmount() {
    if (!this.initializing && this.fileRoutingPersistTimer) {
      clearTimeout(this.fileRoutingPersistTimer)
      this.fileRoutingPersistTimer = null
      storage.set('download_file_routing_rules', this.getNormalizedFileRoutingRulesForPersist())
    }
  },
  methods: {
    async persistSetting(key, value) {
      if (this.initializing || this.syncTransitioning) {
        return
      }

      await storage.set(key, value)
    },

    applyContextMenuContexts(contexts) {
      const selected = Array.isArray(contexts) ? contexts : ['link', 'image', 'audio', 'video']
      const set = new Set(selected)
      this.downloadContextMenuLink = set.has('link')
      this.downloadContextMenuImage = set.has('image')
      this.downloadContextMenuAudio = set.has('audio')
      this.downloadContextMenuVideo = set.has('video')
      // 至少保留一个上下文，避免空菜单
      if (!this.downloadContextMenuLink && !this.downloadContextMenuImage
        && !this.downloadContextMenuAudio && !this.downloadContextMenuVideo) {
        this.downloadContextMenuLink = true
        this.downloadContextMenuImage = true
        this.downloadContextMenuAudio = true
        this.downloadContextMenuVideo = true
      }
    },

    getSelectedContextMenuContexts() {
      const contexts = []
      if (this.downloadContextMenuLink) contexts.push('link')
      if (this.downloadContextMenuImage) contexts.push('image')
      if (this.downloadContextMenuAudio) contexts.push('audio')
      if (this.downloadContextMenuVideo) contexts.push('video')
      return contexts.length ? contexts : ['link', 'image', 'audio', 'video']
    },

    async persistContextMenuContexts() {
      if (this.initializing || this.syncTransitioning || this.contextMenusUpdating) {
        return
      }

      this.contextMenusUpdating = true
      try {
        let contexts = this.getSelectedContextMenuContexts()
        // 如果用户取消了全部选项，回退为全选并同步 UI
        if (!this.downloadContextMenuLink && !this.downloadContextMenuImage
          && !this.downloadContextMenuAudio && !this.downloadContextMenuVideo) {
          this.applyContextMenuContexts(contexts)
          contexts = this.getSelectedContextMenuContexts()
        }

        await storage.set('download_context_menu_contexts', contexts)
        if (this.downloadContextMenus) {
          this.notifyContextMenusChanged(true, 'downloadMenuContexts')
        }
      } finally {
        this.contextMenusUpdating = false
      }
    },

    notifyContextMenusChanged(enabled, type = 'downloadMenus') {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        return
      }
      chrome.runtime.sendMessage(JSON.stringify({
        type,
        data: enabled
      }), () => {
        if (chrome.runtime.lastError) {
          // 静默处理连接错误
        }
      })
    },

    addFileRoutingRule() {
      this.discardIncompleteNewFileRoutingRules()
      this.downloadFileRoutingRules.push({
        id: `custom-${Date.now()}`,
        isNew: true,
        enabled: true,
        folder: '',
        extensions: []
      })
    },

    deleteFileRoutingRule(id) {
      this.downloadFileRoutingRules = this.downloadFileRoutingRules.filter(rule => rule.id !== id)
      this.flushFileRoutingRules()
    },

    resetFileRoutingRules() {
      this.downloadFileRoutingRules = cloneDefaultDownloadFileRoutingRules()
      this.flushFileRoutingRules()
    },

    updateRuleExtensions(rule, value) {
      rule.extensions = parseExtensions(value)
      this.disableIncompleteExistingFileRoutingRule(rule)
      this.tryCommitNewFileRoutingRule(rule)
    },

    handleRuleFolderInput(rule) {
      this.disableIncompleteExistingFileRoutingRule(rule)
    },

    handleRuleFolderBlur(rule) {
      rule.folder = normalizeFolderPath(rule.folder)
      this.disableIncompleteExistingFileRoutingRule(rule)
      this.tryCommitNewFileRoutingRule(rule)
      this.flushFileRoutingRules()
    },

    handleRuleExtensionsChange(rule) {
      this.disableIncompleteExistingFileRoutingRule(rule)
      this.tryCommitNewFileRoutingRule(rule)
      this.flushFileRoutingRules()
    },

    handleRuleExtensionsBlur(rule) {
      this.disableIncompleteExistingFileRoutingRule(rule)
      this.tryCommitNewFileRoutingRule(rule)
      this.flushFileRoutingRules()
    },

    handleRuleFocusOut(rule, event) {
      const nextTarget = event.relatedTarget
      if (nextTarget && event.currentTarget.contains(nextTarget)) {
        return
      }

      if (rule.isNew && this.isFileRoutingRuleIncomplete(rule)) {
        this.deleteFileRoutingRule(rule.id)
      }
    },

    normalizeFolderPath(value) {
      return normalizeFolderPath(value)
    },

    isFileRoutingRuleFolderValid(rule) {
      return Boolean(normalizeFolderPath(rule && rule.folder))
    },

    isFileRoutingRuleExtensionsValid(rule) {
      return parseExtensions(rule && rule.extensions).length > 0
    },

    isFileRoutingRuleIncomplete(rule) {
      return !this.isFileRoutingRuleFolderValid(rule) || !this.isFileRoutingRuleExtensionsValid(rule)
    },

    isExistingFileRoutingRuleInvalid(rule) {
      return rule && !rule.isNew && this.isFileRoutingRuleIncomplete(rule)
    },

    disableIncompleteExistingFileRoutingRule(rule) {
      if (this.isExistingFileRoutingRuleInvalid(rule) && rule.enabled !== false) {
        rule.enabled = false
      }
    },

    tryCommitNewFileRoutingRule(rule) {
      if (rule && rule.isNew && !this.isFileRoutingRuleIncomplete(rule)) {
        rule.isNew = false
      }
    },

    discardIncompleteNewFileRoutingRules() {
      this.downloadFileRoutingRules = this.downloadFileRoutingRules.filter(rule => {
        return !rule.isNew || !this.isFileRoutingRuleIncomplete(rule)
      })
    },

    getNormalizedFileRoutingRulesForPersist() {
      const rules = this.downloadFileRoutingRules.filter(rule => {
        return !rule.isNew || !this.isFileRoutingRuleIncomplete(rule)
      })
      rules.forEach(rule => this.disableIncompleteExistingFileRoutingRule(rule))
      return normalizeDownloadFileRoutingRules(rules)
    },

    scheduleFileRoutingRulesPersist() {
      if (this.initializing || this.syncTransitioning) {
        return
      }

      if (this.fileRoutingPersistTimer) {
        clearTimeout(this.fileRoutingPersistTimer)
      }

      this.fileRoutingPersistTimer = setTimeout(() => {
        this.fileRoutingPersistTimer = null
        this.persistFileRoutingRules()
      }, 500)
    },

    flushFileRoutingRules() {
      return this.persistFileRoutingRules()
    },

    async persistFileRoutingRules() {
      if (this.initializing || this.syncTransitioning) {
        return
      }

      if (this.fileRoutingPersistTimer) {
        clearTimeout(this.fileRoutingPersistTimer)
        this.fileRoutingPersistTimer = null
      }

      const rules = this.getNormalizedFileRoutingRulesForPersist()
      this.fileRoutingPersistQueue = this.fileRoutingPersistQueue
        .catch(() => {})
        .then(() => storage.set('download_file_routing_rules', rules))

      await this.fileRoutingPersistQueue
    },

    /**
     * 获取打开插件弹框的快捷键
     * @return {Promise<String>}
     */
    getOpenPopupShortcut() {
      return new Promise(resolve => {
        // eslint-disable-next-line no-undef
        chrome.commands.getAll(commands => {
          if (commands) {
            commands.forEach(command => {
              if (command && command.name === '_execute_action') {
                if (command.shortcut) {
                  resolve(command.shortcut)
                } else {
                  resolve('--')
                }
              }
            })
          }
          resolve('--')
        })
      })
    },

    // 在新标签页中打开下载文件链接
    openUrl(url) {
      // eslint-disable-next-line no-undef
      chrome.tabs.create({url})
    }
  }
}
</script>

<!--suppress CssUnusedSymbol -->
<style scoped rel="stylesheet/css">
  .home {
    height: 100%;
    width: 100%;
    padding: 20px;
    box-sizing: border-box;
  }

  .title {
    font-size: 15px;
  }

  /* 通用卡片样式 */
  .box-card {
    width: 100%;
    max-width: 920px;
    margin-bottom: 36px;
    box-sizing: border-box;
  }
  .box-card :deep(.el-card__body) {
    padding: 10px 16px;
  }
  .box-card .item {
    display: table;
    height: 100%;
    font-size: 14px;
    width: 100%;
    padding: 4px;
    box-sizing: border-box;
  }
  .box-card .item.pointer:hover {
    cursor: pointer;
  }
  .box-card .item.false:hover {
    cursor: not-allowed!important;
  }
  .box-card .item .content {
    display: table-cell;
    width: 490px;
    vertical-align: middle;
  }
  .box-card .item .content .setting-title {
    display: block;
  }
  .box-card .item .content .setting-description {
    display: block;
    color: gray;
    font-size: 12px;
  }
  .box-card .item .content .link {
    color: #ff8740;
    cursor: pointer;
    text-decoration: underline;
  }
  .box-card .item .switch {
    text-align: right;
    display: table-cell;
    vertical-align: middle;
    padding-right: 4px;
  }
  .box-card .item .switch.width {
    width: 364px;
  }
  .box-card .item .code {
    background-color: #ececec;
    border-radius: 4px;
    padding: 2px 6px;
  }
  .box-card .item .setting-description .code {
    margin-left: 4px;
  }

  .file-routing-card {
    max-width: 920px;
  }

  .file-routing-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px;
    margin-bottom: 8px;
  }

  .file-routing-toolbar .setting-title {
    font-size: 14px;
  }

  .file-routing-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .file-routing-table {
    border: 1px solid var(--el-border-color-light, #e4e7ed);
    border-radius: var(--el-card-border-radius, var(--el-border-radius-base, 4px));
    overflow: hidden;
  }

  .file-routing-table-head,
  .file-routing-table-row {
    display: grid;
    grid-template-columns: minmax(140px, 200px) minmax(360px, 1fr) 112px;
    align-items: center;
  }

  .file-routing-table-head {
    color: var(--el-text-color-secondary, gray);
    background: var(--el-fill-color-light, #f5f7fa);
    font-size: 12px;
    font-weight: 500;
  }

  .file-routing-table-head > div,
  .file-routing-table-cell {
    min-width: 0;
    padding: 10px 12px;
    box-sizing: border-box;
  }

  .file-routing-table-head > div:last-child {
    text-align: center;
  }

  .file-routing-table-row {
    border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
  }

  .file-routing-table-row.disabled {
    opacity: 0.72;
  }

  .file-routing-row-actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
  }

  .file-routing-enable {
    display: inline-flex;
    align-items: center;
  }

  .file-routing-delete {
    width: 28px;
    height: 28px;
    padding: 0;
    font-size: 16px;
  }

  .file-routing-table :deep(.el-input__inner) {
    font-size: 12px;
  }

  .file-routing-field-error :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--el-color-danger, #f56c6c) inset;
  }

  .file-routing-extensions {
    width: 100%;
    --el-input-tag-padding: 5px 6px;
    --el-input-tag-gap: 6px;
    --el-input-tag-line-height: 20px;
    min-height: 36px;
  }

  .file-routing-extensions.file-routing-field-error {
    box-shadow: 0 0 0 1px var(--el-color-danger, #f56c6c) inset;
  }

  .file-routing-extensions :deep(.el-input-tag__inner) {
    gap: 6px;
    align-items: center;
  }

  .file-routing-extensions :deep(.el-tag) {
    text-transform: lowercase;
    margin-top: 1px;
    margin-bottom: 1px;
  }

  @media (max-width: 760px) {
    .file-routing-table {
      border: none;
      border-radius: 0;
      overflow: visible;
    }

    .file-routing-table-head {
      display: none;
    }

    .file-routing-table-row {
      display: block;
      padding: 10px 0;
      border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
    }

    .file-routing-table-cell {
      padding: 6px 4px;
    }

    .file-routing-table-cell::before {
      content: attr(data-label);
      display: block;
      margin-bottom: 4px;
      color: var(--el-text-color-secondary, gray);
      font-size: 12px;
    }

    .file-routing-row-actions {
      justify-content: flex-start;
    }
  }

  .reserved_time {
    width: 90px;
  }
  .reserved_time :deep(.el-input__inner) {
    border-radius: 0;
  }

  .box-card :deep(.el-divider--horizontal) {
    margin: 10px 0!important;
    height: 0.5px!important;
  }

  .item :deep(.el-checkbox-button__inner) {
    padding: 5px 17px;
    font-size: 12px;
    border-radius: 0;
  }

</style>
