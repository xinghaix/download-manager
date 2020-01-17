<template>
  <div class="home">
    <h2 class="about title">{{i18data.aboutTile}}</h2>
    <el-card class="about-card box-card" shadow="hover">
      <div class="text">
        <div class="item">
          <i class="iconfont el-icon-info"/>
          <span class="prefix">{{extName}}</span>
          <a class="suffix link" @click="openUrl(githubUrl)">Github</a>
        </div>
        <div class="item">
          <i class="iconfont el-icon-s-promotion"/>
          <span class="prefix version">{{version}}</span>
        </div>
        <div class="item">
          <i class="iconfont el-icon-star-on"/>
          <span class="prefix">{{i18data.starAbout1}}
            <a class="link" @click="openUrl(chromePluginShopUrl)">{{i18data.pluginShopAbout}}</a>
            {{i18data.starAbout2}}
          </span>
        </div>
      </div>
    </el-card>
    <h2 class="version-header title">{{i18data.versionAbout}}</h2>
    <template v-for="versionData in versionList">
      <el-card class="version-card box-card" shadow="hover" v-bind:key="data = JSON.parse(versionData)">
        <div slot="header" class="card-header">
          <span class="version">{{data.version}}</span>
          <span class="date"><i class="el-icon-date"/>{{data.date}}</span>
        </div>
        <div class="text" v-for="tip in data.data" v-bind:key="tip">
          <div class="item">{{tip}}</div>
        </div>
      </el-card>
    </template>
  </div>
</template>

<script>
  /* eslint-disable no-undef */
  export default {
    name: "About",
    props: {
      i18data: Object
    },
    data() {
      return {
        githubUrl: 'https://github.com/xinghaixuanwo/download-manager',
        chromePluginShopUrl: 'https://chrome.google.com/webstore/detail/ofpglhlcdbjdhlacgbljnildhajfmlei',

        extName: chrome.runtime.getManifest().name,
        version: chrome.runtime.getManifest().version,

        versionList: this.i18data.versionList,
      }
    },
    methods: {
      // 在新标签页中打开下载文件链接
      openUrl (url) {
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
  .box-card .card-header {
    display: table;
    width: 100%;
  }
  .box-card >>> .el-card__header {
    padding: 8px 20px;
  }
  .box-card >>> .el-card__body {
    padding: 16px 20px 10px 20px;
  }
  .box-card .text {
    font-size: 14px;
  }
  .box-card .item {
    display: table;
    width: 100%;
    height: 26px;
  }
  /* 关于 卡片 */
  .box-card.about-card .item {
    font-weight: bold;
  }
  /* 图标 */
  .about-card .item .iconfont {
    display: table-cell;
    font-size: 16px;
    width: 22px;
    color: #409EFF;
    vertical-align: middle;
  }
  .about-card .item .iconfont.el-icon-star-on {
    font-size: 17px!important;
  }
  /* 关于信息 卡片 */
  .about-card .item .prefix {
    font-weight: bold;
    display: table-cell;
    text-align: left;
    vertical-align: middle;
  }
  .about-card .item .suffix {
    font-weight: bold;
    display: table-cell;
    text-align: right;
    vertical-align: middle;
  }
  /* 链接 */
  .about-card .item .link {
    color: #ff8740;
    cursor: pointer;
    text-decoration: underline;
  }

    /* 版本历史信息 卡片 */
  .version-card .card-header span {
    display: table-cell;
    font-weight: bold;
    vertical-align: middle;
    font-family: Consolas, Microsoft YaHei, sans-serif;
  }
  .version-card .card-header .version {
    font-size: 14px;
    text-align: left;
  }
  .version-card .card-header .date {
    font-size: 13px;
    text-align: right;
  }
  .version-card .card-header .date .el-icon-date {
    margin-right: 4px;
  }
</style>
