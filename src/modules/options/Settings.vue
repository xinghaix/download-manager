<!--suppress UnterminatedStatementJS -->
<template>
  <div class="home" v-if="show">
    <h2 class="title">{{downloadSetting}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item pointer">
        <div class="content" @click="leftClickFile = !leftClickFile">
          <span class="setting-title">{{leftClickFileSetting}}</span>
        </div>
        <el-switch class="switch" v-model="leftClickFile" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item pointer">
        <div class="content" @click="rightClickFile = !rightClickFile">
          <span class="setting-title">{{rightClickFileSetting}}</span>
        </div>
        <el-switch class="switch" v-model="rightClickFile" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item pointer">
        <div class="content" @click="leftClickUrl = !leftClickUrl">
          <div class="setting-title">{{leftClickUrlSetting}}</div>
        </div>
        <el-switch class="switch" v-model="leftClickUrl" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item pointer">
        <div class="content" @click="rightClickUrl = !rightClickUrl">
          <span class="setting-title">{{rightClickUrlSetting}}</span>
        </div>
        <el-switch class="switch" v-model="rightClickUrl" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item pointer">
        <div class="content" @click="showTooltip = !showTooltip">
          <span class="setting-title">{{showTooltipSetting}}</span>
        </div>
        <el-switch class="switch" v-model="showTooltip" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
    </el-card>
    <h2 class="title">{{notificationSetting}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content">
          <span class="setting-title">{{downloadNotificationSetting}}</span>
        </div>
        <div class="switch width">
          <el-checkbox-button :label="downloadNotificationSetting1" v-model="downloadStartedNotification"/>
          <el-checkbox-button :label="downloadNotificationSetting2" v-model="downloadCompletedNotification"/>
          <el-checkbox-button :label="downloadNotificationSetting3" v-model="downloadWarningNotification"/>
        </div>
      </div>
      <el-divider/>
      <div class="item pointer">
        <div class="content" @click="downloadCompletionTone = !downloadCompletionTone">
          <span class="setting-title">{{downloadCompletionToneSetting}}</span>
        </div>
        <el-switch class="switch" v-model="downloadCompletionTone" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
    </el-card>
    <h2 class="title">{{shortcutSetting}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content">
          <span class="setting-title description">
            {{openPopupSetting}}
            <el-tooltip :content="notSyncSetting" placement="top"
                        effect="dark" popper-class="tooltip" :enterable="false"><i class="el-icon-info"/></el-tooltip>
          </span>
          <span class="setting-description">
            {{openPopupDetailsSetting}}
            <a class="link" @click="openUrl(chromePluginShortcutSettingUrl)">{{chromePluginShortcutDescSetting}}</a>
          </span>
        </div>
        <div class="switch width"><a class="code">{{openPopupShortcut}}</a></div>
      </div>
    </el-card>
    <h2 class="title">{{syncSetting}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item pointer">
        <div class="content" @click="isSync = !isSync">
          <span class="setting-title description">{{pluginSyncSetting}}</span>
          <span class="setting-description">{{pluginSyncDetailsSetting}}</span>
        </div>
        <el-switch class="switch description" v-model="isSync" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
    </el-card>
  </div>
</template>

<script>
  import storage from "../../utils/storage";
  import common from "../../utils/common";

  export default {
    name: "Settings",
    props: {
      title: String
    },
    watch: {
      isSync (val) {
        storage.setSync(val)
      },

      showTooltip (val) {
        storage.setCloseTooltip(!val)
      },

      leftClickFile (val) {
        storage.setLeftClickFile(val)
      },

      rightClickFile (val) {
        storage.setRightClickFile(val)
      },

      leftClickUrl (val) {
        storage.setLeftClickUrl(val)
      },

      rightClickUrl (val) {
        storage.setRightClickUrl(val)
      },

      downloadStartedNotification (val) {
        storage.setDownloadStartedNotification(val)
      },

      downloadCompletedNotification (val) {
        storage.setDownloadCompletedNotification(val)
      },

      downloadWarningNotification (val) {
        storage.setDownloadWarningNotification(val)
      },

      downloadCompletionTone (val) {
        storage.setDownloadCompletionTone(val)
      }
    },
    async mounted() {
      // 获取插件设置
      this.leftClickFile = await storage.getLeftClickFile()
      this.rightClickFile = await storage.getRightClickFile()
      this.leftClickUrl = await storage.getLeftClickUrl()
      this.rightClickUrl = await storage.getRightClickUrl()
      this.showTooltip = ! await storage.getCloseTooltip()

      this.downloadStartedNotification = await storage.getDownloadStartedNotification()
      this.downloadCompletedNotification = await storage.getDownloadCompletedNotification()
      this.downloadWarningNotification = await storage.getDownloadWarningNotification()
      this.downloadCompletionTone = await storage.getDownloadCompletionTone()

      this.openPopupShortcut = await this.getOpenPopupShortcut();

      this.isSync = await storage.getSync()

      this.show = true
    },
    data() {
      return {
        show: false,

        chromePluginShortcutSettingUrl: 'chrome://extensions/shortcuts',

        // 下载设置
        downloadSetting: common.loadI18nMessage('downloadSetting'),
        leftClickFileSetting: common.loadI18nMessage('leftClickFileSetting'),
        rightClickFileSetting: common.loadI18nMessage('rightClickFileSetting'),
        leftClickUrlSetting: common.loadI18nMessage('leftClickUrlSetting'),
        rightClickUrlSetting: common.loadI18nMessage('rightClickUrlSetting'),
        showTooltipSetting: common.loadI18nMessage('showTooltipSetting'),
        leftClickFile: true,
        leftClickUrl: true,
        rightClickFile: true,
        rightClickUrl: true,
        showTooltip: false,

        // 通知设置
        notificationSetting: common.loadI18nMessage('notificationSetting'),
        downloadNotificationSetting: common.loadI18nMessage('downloadNotificationSetting'),
        downloadNotificationSetting1: common.loadI18nMessage('downloadNotificationSetting1'),
        downloadNotificationSetting2: common.loadI18nMessage('downloadNotificationSetting2'),
        downloadNotificationSetting3: common.loadI18nMessage('downloadNotificationSetting3'),
        downloadCompletionToneSetting: common.loadI18nMessage('downloadCompletionToneSetting'),
        downloadStartedNotification: false,
        downloadCompletedNotification: false,
        downloadWarningNotification: false,
        downloadCompletionTone: false,

        // 快捷键设置
        shortcutSetting: common.loadI18nMessage('shortcutSetting'),
        openPopupSetting: common.loadI18nMessage('openPopupSetting'),
        openPopupDetailsSetting: common.loadI18nMessage('openPopupDetailsSetting'),
        chromePluginShortcutDescSetting: common.loadI18nMessage('chromePluginShortcutDescSetting'),
        openPopupShortcut: 'Ctrl+Z',

        // 同步设置
        syncSetting: common.loadI18nMessage('syncSetting'),
        pluginSyncSetting: common.loadI18nMessage('pluginSyncSetting'),
        pluginSyncDetailsSetting: common.loadI18nMessage('pluginSyncDetailsSetting'),
        notSyncSetting: common.loadI18nMessage('notSyncSetting'),
        isSync: true,
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
              commands.forEach(command => {
                if (command && command.name === '_execute_browser_action') {
                  resolve(command.shortcut)
                }
              })
            }
          })
        })
      },

      // 在新标签页中打开下载文件链接
      openUrl (url) {
        // eslint-disable-next-line no-undef
        chrome.tabs.create({ url: url })
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
  .box-card .item .content {
    display: table-cell;
    width: 500px;
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
    width: 362px;
  }
  .box-card .item .switch .code {
    background-color: #ececec;
    border-radius: 4px;
    padding: 4px 12px;
    font-family: Consolas,Microsoft YaHei,serif;
  }

  .box-card >>> .el-divider--horizontal {
    margin: 10px 0!important;
  }

  .item >>> .el-checkbox-button__inner {
    padding: 5px 17px;
    font-size: 12px;
    border-radius: 0;
  }

</style>
