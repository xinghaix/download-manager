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
    </el-card>

    <h2 class="title">{{i18data.contextMenus}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item pointer">
        <div class="content" @click="downloadContextMenus = !downloadContextMenus">
          <span class="setting-title">{{i18data.downloadContextMenusSetting}}</span>
          <span class="setting-description">
            {{i18data.downloadContextMenusDescSetting}}
            <a class="code">{{i18data.link}}</a>
            <a class="code">{{i18data.image}}</a>
            <a class="code">{{i18data.audio}}</a>
            <a class="code">{{i18data.video}}</a>
          </span>
        </div>
        <el-switch class="switch" v-model="downloadContextMenus" active-color="#409EFF" inactive-color="#bdc1c6"/>
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
                           class="reserved_time" :max="43200" size="mini"></el-input-number>
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
                        effect="dark" popper-class="tooltip" :enterable="false"><i class="el-icon-info"/></el-tooltip>
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
import storage from '../../utils/storage'
import common from '../../utils/common'

export default {
  name: "Settings",
  props: {
    i18data: Object
  },
  watch: {
    isSync(val) {
      storage.set('sync', val)
    },

    showTooltip(val) {
      storage.set('close_tooltip', !val)
    },
    leftClickFile(val) {
      storage.set('left_click_file', val)
    },
    rightClickFile(val) {
      storage.set('right_click_file', val)
    },
    leftClickUrl(val) {
      storage.set('left_click_url', val)
    },
    rightClickUrl(val) {
      storage.set('right_click_url', val)
    },
    enableAnimation(val) {
      storage.set('enable_animation', val)
    },

    downloadContextMenus(val) {
      storage.set('download_context_menus', val)
      // eslint-disable-next-line no-undef
      chrome.runtime.sendMessage(JSON.stringify({type: 'downloadMenus', data: val}))
    },

    downloadStartedNotification(val) {
      storage.set('download_started_notification', val)
    },
    downloadCompletedNotification(val) {
      storage.set('download_completed_notification', val)
    },
    downloadWarningNotification(val) {
      storage.set('download_warning_notification', val)
    },

    downloadStartedTone(val) {
      storage.set('download_started_tone', val)
    },
    downloadCompletedTone(val) {
      storage.set('download_completed_tone', val)
    },
    downloadWarningTone(val) {
      storage.set('download_warning_tone', val)
    },

    downloadNotificationReservedTime(val) {
      storage.set('download_notification_reserved_time', val)
    },
    downloadNotificationRemainVisible(val) {
      storage.set('download_notification_remain_visible', val)
    }
  },
  async mounted() {
    // 获取插件设置
    // 下载设置
    this.leftClickFile = await storage.get('left_click_file')
    this.rightClickFile = await storage.get('right_click_file')
    this.leftClickUrl = await storage.get('left_click_url')
    this.rightClickUrl = await storage.get('right_click_url')
    this.showTooltip = !await storage.get('close_tooltip')
    this.enableAnimation = await storage.get('enable_animation')
    // 上下文菜单设置
    this.downloadContextMenus = await storage.get('download_context_menus')
    // 通知设置
    this.downloadStartedNotification = await storage.get('download_started_notification')
    this.downloadCompletedNotification = await storage.get('download_completed_notification')
    this.downloadWarningNotification = await storage.get('download_warning_notification')
    this.downloadStartedTone = await storage.get('download_started_tone')
    this.downloadCompletedTone = await storage.get('download_completed_tone')
    this.downloadWarningTone = await storage.get('download_warning_tone')
    this.downloadNotificationReservedTime = await storage.get('download_notification_reserved_time')
    this.downloadNotificationRemainVisible = await storage.get('download_notification_remain_visible')
    // 快捷键设置
    this.openPopupShortcut = await this.getOpenPopupShortcut()
    // 同步设置
    this.isSync = await storage.get('sync')

    this.chromeVersionGreaterThan50 = common.chromeVersionGreaterThan(50)

    // 开始渲染页面
    this.show = true
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

      // 上下文菜单
      downloadContextMenus: true,

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

      chromeVersionGreaterThan50: true
    }
  },
  methods: {
    /**
     * 获取打开插件弹框的快捷键
     * @return {Promise<String>}
     */
    getOpenPopupShortcut() {
      return new Promise(resolve => {
        // eslint-disable-next-line no-undef
        chrome.commands.getAll(commands => {
          if (commands) {
            for (let i = 0, len = commands.length; i < len; i++) {
              let command = commands[i]
              if (command && command.name === '_execute_browser_action') {
                if (command.shortcut) {
                  resolve(command.shortcut)
                } else {
                  resolve('--')
                }
              }
            }
          }
          resolve('--')
        })
      })
    },

    // 在新标签页中打开下载文件链接
    openUrl(url) {
      // eslint-disable-next-line no-undef
      chrome.tabs.create({url: url})
    },

  }
}
</script>

<!--suppress CssUnusedSymbol -->
<style scoped rel="stylesheet/css">
  .home {
    height: 100%;
    width: 100%;
    padding: 20px;
  }

  .title {
    font-size: 15px;
  }

  /* 通用卡片样式 */
  .box-card {
    width: 600px;
    margin-bottom: 36px;
  }
  .box-card >>> .el-card__body {
    padding: 10px 16px;
  }
  .box-card .item {
    display: table;
    height: 100%;
    font-size: 14px;
    width: 567px;
    padding: 4px;
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
    font-family: Consolas, Microsoft YaHei, sans-serif;
  }
  .box-card .item .setting-description .code {
    margin-left: 4px;
  }

  .reserved_time {
    width: 90px;
  }
  .reserved_time >>> .el-input__inner {
    border-radius: 0;
  }

  .box-card >>> .el-divider--horizontal {
    margin: 10px 0!important;
    height: 0.5px!important;
  }

  .item >>> .el-checkbox-button__inner {
    padding: 5px 17px;
    font-size: 12px;
    border-radius: 0;
  }

</style>
