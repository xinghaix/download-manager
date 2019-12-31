<!--suppress UnterminatedStatementJS -->
<template>
  <div class="home">
    <h2 class="title">{{downloadSetting}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content" @click="leftClickFile = !leftClickFile">
          <span class="setting-title">{{leftClickFileSetting}}</span>
        </div>
        <el-switch class="switch" v-model="leftClickFile" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content" @click="rightClickFile = !rightClickFile">
          <span class="setting-title">{{rightClickFileSetting}}</span>
        </div>
        <el-switch class="switch" v-model="rightClickFile" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content" @click="leftClickUrl = !leftClickUrl">
          <div class="setting-title">{{leftClickUrlSetting}}</div>
        </div>
        <el-switch class="switch" v-model="leftClickUrl" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content" @click="rightClickUrl = !rightClickUrl">
          <span class="setting-title">{{rightClickUrlSetting}}</span>
        </div>
        <el-switch class="switch" v-model="rightClickUrl" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content" @click="showTooltip = !showTooltip">
          <span class="setting-title">{{showTooltipSetting}}</span>
        </div>
        <el-switch class="switch" v-model="showTooltip" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
    </el-card>
    <h2 class="title">{{notificationSetting}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content" style="cursor: auto!important;width: 275px!important">
          <span class="setting-title">{{downloadNotificationSetting}}</span>
        </div>
        <div class="switch">
          <el-checkbox-button :label="downloadNotificationSetting1" v-model="closeDownloadNotification"/>
          <el-checkbox-button :label="downloadNotificationSetting2" v-model="downloadStartedNotification"/>
          <el-checkbox-button :label="downloadNotificationSetting3" v-model="downloadCompletedNotification"/>
          <el-checkbox-button :label="downloadNotificationSetting4" v-model="downloadWarningNotification"/>
        </div>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content" @click="downloadCompletionTone = !downloadCompletionTone">
          <span class="setting-title">{{downloadCompletionToneSetting}}</span>
        </div>
        <el-switch class="switch" v-model="downloadCompletionTone" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
    </el-card>
    <h2 class="title">{{syncSetting}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content" @click="isSync = !isSync">
          <span class="setting-title description">{{pluginSyncSetting}}</span>
          <span class="setting-description">{{pluginSyncDetailedSetting}}</span>
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

      closeDownloadNotification (val) {
        if (val) {
          this.downloadStartedNotification = false
          this.downloadCompletedNotification = false
          this.downloadWarningNotification = false
        }
        storage.setCloseDownloadNotification(val)
      },

      downloadStartedNotification (val) {
        if (val) {
          this.closeDownloadNotification = false
        }
        storage.setDownloadStartedNotification(val)
      },

      downloadCompletedNotification (val) {
        if (val) {
          this.closeDownloadNotification = false
        }
        storage.setDownloadCompletedNotification(val)
      },

      downloadWarningNotification (val) {
        if (val) {
          this.closeDownloadNotification = false
        }
        storage.setDownloadWarningNotification(val)
      },

      downloadCompletionTone (val) {
        storage.setDownloadCompletionTone(val)
      }
    },
    mounted() {
      // 获取插件设置
      storage.getLeftClickFile(value => this.leftClickFile = value)
      storage.getRightClickFile(value => this.rightClickFile = value)
      storage.getLeftClickUrl(value => this.leftClickUrl = value)
      storage.getRightClickUrl(value => this.rightClickUrl = value)
      storage.getCloseTooltip(value => this.showTooltip = !value)

      storage.getCloseDownloadNotification(value => this.closeDownloadNotification = value)
      storage.getDownloadStartedNotification(value => this.downloadStartedNotification = value)
      storage.getDownloadCompletedNotification(value => this.downloadCompletedNotification = value)
      storage.getDownloadWarningNotification(value => this.downloadWarningNotification = value)
      storage.getDownloadCompletionTone(value => this.downloadCompletionTone = value)

      storage.getSync(value => this.isSync = value)
    },
    data() {
      return {
        leftClickFile: true,
        leftClickUrl: true,
        rightClickFile: true,
        rightClickUrl: true,
        showTooltip: false,

        closeDownloadNotification: true,
        downloadStartedNotification: false,
        downloadCompletedNotification: false,
        downloadWarningNotification: false,
        downloadCompletionTone: false,

        isSync: true,

        downloadSetting: common.loadI18nMessage('downloadSetting'),
        leftClickFileSetting: common.loadI18nMessage('leftClickFileSetting'),
        rightClickFileSetting: common.loadI18nMessage('rightClickFileSetting'),
        leftClickUrlSetting: common.loadI18nMessage('leftClickUrlSetting'),
        rightClickUrlSetting: common.loadI18nMessage('rightClickUrlSetting'),
        showTooltipSetting: common.loadI18nMessage('showTooltipSetting'),

        notificationSetting: common.loadI18nMessage('notificationSetting'),
        downloadNotificationSetting: common.loadI18nMessage('downloadNotificationSetting'),
        downloadNotificationSetting1: common.loadI18nMessage('downloadNotificationSetting1'),
        downloadNotificationSetting2: common.loadI18nMessage('downloadNotificationSetting2'),
        downloadNotificationSetting3: common.loadI18nMessage('downloadNotificationSetting3'),
        downloadNotificationSetting4: common.loadI18nMessage('downloadNotificationSetting4'),
        downloadCompletionToneSetting: common.loadI18nMessage('downloadCompletionToneSetting'),

        syncSetting: common.loadI18nMessage('syncSetting'),
        pluginSyncSetting: common.loadI18nMessage('pluginSyncSetting'),
        pluginSyncDetailedSetting: common.loadI18nMessage('pluginSyncDetailedSetting'),
      }
    },
    methods: {
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
    display: inline-block;
    height: 32px;
    line-height: 32px;
    font-size: 14px;
  }
  .item .content {
    display: inline-block;
    width: 520px;
  }
  .item .content .setting-title {
    display: block;
  }
  .item .content .setting-title.description {
    height: 22px;
    line-height: 22px;
  }
  .item .content .setting-title:not(.description) {

  }
  .item .content .setting-description {
    display: block;
    color: gray;
    font-size: 12px;
    height: 16px;
    line-height: 16px;
  }
  .item .switch {
    float: right;
  }
  .item .switch.description {
    top: 9px!important;
  }
  .item .switch:not(.description) {
    top: 6px;
  }
  .item:hover {
    cursor: pointer;
  }

  .box-card >>> .el-divider--horizontal {
    margin: 10px 0!important;
  }

  .item >>> .el-checkbox-button__inner {
    padding: 7px 15px;
    font-size: 12px;
    border-radius: 0;
    margin-top: -5px;
  }

</style>
