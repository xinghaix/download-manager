<template>
  <div class="home">
    <h2 class="title">{{downloadSetting}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content" @click="openFile = !openFile">
          <span class="setting-title">{{leftClickFileSetting}}</span>
        </div>
        <el-switch class="switch" v-model="leftClickFile" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content" @click="copyFileName = !copyFileName">
          <span class="setting-title">{{rightClickFileSetting}}</span>
        </div>
        <el-switch class="switch" v-model="rightClickFile" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content" @click="openUrl = !openUrl">
          <div class="setting-title">{{leftClickUrlSetting}}</div>
        </div>
        <el-switch class="switch" v-model="leftClickUrl" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content" @click="copyFileUrl = !copyFileUrl">
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
    },
    mounted() {
      storage.getSync(value => this.isSync = value)
      storage.getCloseTooltip(value => this.showTooltip = !value)
      storage.getLeftClickFile(value => this.leftClickFile = value)
      storage.getRightClickFile(value => this.rightClickFile = value)
      storage.getLeftClickUrl(value => this.leftClickUrl = value)
      storage.getRightClickUrl(value => this.rightClickUrl = value)
    },
    data() {
      return {
        leftClickFile: true,
        leftClickUrl: true,
        rightClickFile: true,
        rightClickUrl: true,
        showTooltip: false,
        isSync: true,

        downloadSetting: common.loadI18nMessage('downloadSetting'),
        leftClickFileSetting: common.loadI18nMessage('leftClickFileSetting'),
        rightClickFileSetting: common.loadI18nMessage('rightClickFileSetting'),
        leftClickUrlSetting: common.loadI18nMessage('leftClickUrlSetting'),
        rightClickUrlSetting: common.loadI18nMessage('rightClickUrlSetting'),
        showTooltipSetting: common.loadI18nMessage('showTooltipSetting'),
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
  .item .switch.description {
    top: -12px!important;
  }
  .item .switch:not(.description) {
    top: -2px;
  }
  .item:hover {
    cursor: pointer;
  }

  .box-card >>> .el-divider--horizontal {
    margin: 10px 0!important;
  }

</style>
