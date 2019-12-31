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
      <div class="item" style="cursor: auto!important;">
        <div class="content" style="width: 300px!important">
          <span class="setting-title">{{downloadNotificationSetting}}</span>
        </div>
        <div class="switch">
          <el-checkbox-button :label="downloadNotificationSetting1" v-model="downloadStartedNotification"/>
          <el-checkbox-button :label="downloadNotificationSetting2" v-model="downloadCompletedNotification"/>
          <el-checkbox-button :label="downloadNotificationSetting3" v-model="downloadWarningNotification"/>
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
    mounted() {
      // 获取插件设置
      storage.getLeftClickFile(value => this.leftClickFile = value)
      storage.getRightClickFile(value => this.rightClickFile = value)
      storage.getLeftClickUrl(value => this.leftClickUrl = value)
      storage.getRightClickUrl(value => this.rightClickUrl = value)
      storage.getCloseTooltip(value => this.showTooltip = !value)

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
    display: table;
    height: 100%;
    font-size: 14px;
    width: 567px;
    padding: 4px;
  }
  .box-card .item:hover {
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
  .box-card .item .switch {
    text-align: right;
    display: table-cell;
    vertical-align: middle;
    padding-right: 4px;
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
