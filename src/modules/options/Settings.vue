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
      <div class="item pointer">
        <div class="content" @click="downloadCompletionTone = !downloadCompletionTone">
          <span class="setting-title">{{i18data.downloadCompletionToneSetting}}</span>
        </div>
        <el-switch class="switch" v-model="downloadCompletionTone" active-color="#409EFF" inactive-color="#bdc1c6"/>
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
  import storage from "../../utils/storage"

  export default {
    name: "Settings",
    props: {
      i18data: Object
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

      downloadContextMenus (val) {
        storage.setDownloadContextMenus(val)
        // eslint-disable-next-line no-undef
        chrome.runtime.sendMessage(JSON.stringify({type: 'downloadMenus', data: val}))
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
      // 下载设置
      this.leftClickFile = await storage.getLeftClickFile()
      this.rightClickFile = await storage.getRightClickFile()
      this.leftClickUrl = await storage.getLeftClickUrl()
      this.rightClickUrl = await storage.getRightClickUrl()
      this.showTooltip = ! await storage.getCloseTooltip()
      // 上下文菜单设置
      this.downloadContextMenus = await storage.getDownloadContextMenus()
      // 通知设置
      this.downloadStartedNotification = await storage.getDownloadStartedNotification()
      this.downloadCompletedNotification = await storage.getDownloadCompletedNotification()
      this.downloadWarningNotification = await storage.getDownloadWarningNotification()
      this.downloadCompletionTone = await storage.getDownloadCompletionTone()
      // 快捷键设置
      this.openPopupShortcut = await this.getOpenPopupShortcut()
      // 同步设置
      this.isSync = await storage.getSync()

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

        // 上下文菜单
        downloadContextMenus: true,

        // 通知设置
        downloadStartedNotification: false,
        downloadCompletedNotification: false,
        downloadWarningNotification: false,
        downloadCompletionTone: false,

        // 快捷键设置
        openPopupShortcut: 'Ctrl+Z',

        // 同步设置
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
  .box-card .item .code {
    background-color: #ececec;
    border-radius: 4px;
    padding: 2px 6px;
    font-family: Consolas, Microsoft YaHei, sans-serif;
  }
  .box-card .item .setting-description .code {
    margin-left: 4px;
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
