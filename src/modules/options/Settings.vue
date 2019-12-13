<template>
  <div class="home">
    <h2 class="title">下载</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content">
          <span class="setting-title">鼠标左键点击文件名时打开文件</span>
        </div>
        <el-switch class="switch" v-model="openFile" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content">
          <span class="setting-title">鼠标右键点击文件名时复制到剪切板</span>
        </div>
        <el-switch class="switch" v-model="copyFileName" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content">
          <div class="setting-title">鼠标左键点击下载链接时可在新界面打开</div>
        </div>
        <el-switch class="switch" v-model="openUrl" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content">
          <span class="setting-title">鼠标右键点击下载链接时复制到剪切板</span>
        </div>
        <el-switch class="switch" v-model="copyFileUrl" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
    </el-card>
    <h2 class="title">同步</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content">
          <span class="setting-title description">同步插件设置</span>
          <span class="setting-description">已登录谷歌账号时，可在不同的基于谷歌内核的浏览器之间同步插件设置</span>
        </div>
        <el-switch class="switch description" v-model="isSync" active-color="#409EFF" inactive-color="#bdc1c6"/>
      </div>
    </el-card>
  </div>
</template>

<script>
  import storage from "../../utils/storage";

  export default {
    name: "Settings",
    props: {
      title: String
    },
    watch: {
      isSync(val) {
        storage.setSync(val)
      }
    },
    data() {
      return {
        openFile: true,
        copyFileName: true,
        copyFileUrl: true,
        openUrl: true,
        isSync: true
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

  .box-card >>> .el-divider--horizontal {
    margin: 10px 0!important;
  }

</style>
