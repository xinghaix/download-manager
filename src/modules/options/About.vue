<template>
  <div class="home">
    <h2 class="about title">{{aboutTile}}</h2>
    <el-card class="about-card box-card" shadow="hover">
      <div class="text">
        <div class="item">
          <i class="iconfont el-icon-info"/>
          <span class="prefix">{{extName}}</span>
          <a class="suffix link" @click="openUrl(githubUrl)">Github</a>
        </div>
        <div class="item">
          <i class="iconfont el-icon-star-on"/>
          <span class="prefix">{{starAbout1}}
            <a class="link" @click="openUrl(chromePluginShopUrl)">{{pluginShopAbout}}</a>
            {{starAbout2}}
          </span>
        </div>
      </div>
    </el-card>
    <h2 class="version-header title">{{versionAbout}}</h2>
    <template v-for="versionData in versionList">
      <el-card class="version-card box-card" shadow="hover" v-bind:key="versionData">
        <div slot="header" class="card-header">
          <span class="version">{{versionData.version}}</span>
          <span class="date"><i class="el-icon-date"/>{{versionData.date}}</span>
        </div>
        <div class="text" v-for="tip in versionData.data" v-bind:key="tip">
          <div class="item">{{tip}}</div>
        </div>
      </el-card>
    </template>
  </div>
</template>

<script>
  /* eslint-disable no-undef */

  import common from "../../utils/common";

  export default {
    name: "About",
    props: {
      title: String
    },
    data() {
      return {
        githubUrl: 'https://github.com/xinghaixuanwo/download-manager',
        chromePluginShopUrl: 'https://chrome.google.com/webstore/detail/ofpglhlcdbjdhlacgbljnildhajfmlei',

        extName: common.loadI18nMessage('extName'),
        aboutTile: common.loadI18nMessage('aboutTile'),
        starAbout1: common.loadI18nMessage('starAbout1'),
        pluginShopAbout: common.loadI18nMessage('pluginShopAbout'),
        starAbout2: common.loadI18nMessage('starAbout2'),
        versionAbout: common.loadI18nMessage('versionAbout'),

        versionList: [
          JSON.parse(common.loadI18nMessage('version0_8_0')),
          JSON.parse(common.loadI18nMessage('version0_7_0')),
          JSON.parse(common.loadI18nMessage('version0_6_2')),
          JSON.parse(common.loadI18nMessage('version0_5_1')),
          JSON.parse(common.loadI18nMessage('version0_4')),
        ],
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
  .box-card .card-header:before,
  .box-card .card-header:after {
    display: table;
    content: "";
  }
  .box-card .card-header:after {
    clear: both
  }
  .box-card >>> .el-card__header {
    padding: 8px 20px;
  }
  .box-card >>> .el-card__body {
    padding: 16px 20px 10px 20px;
  }
  .box-card .card-header {
    display: inline-block;
    line-height: 24px;
  }
  .box-card .text {
    font-size: 14px;
  }
  .box-card .item {
    margin-bottom: 6px;
  }

  /* 关于信息 卡片 */
  .about-card .item .prefix {
    width: 487px;
    font-weight: bold;
    display: inline-block;
  }
  .about-card .item .suffix {
    font-weight: bold;
    display: inline-block;
  }
  .about-card .item .iconfont {
    font-size: 16px;
    margin-right: 12px;
    color: #409EFF;
  }
  .about-card .item .iconfont.el-icon-star-on {
    font-size: 17px!important;
  }
  .about-card .item .link {
    color: #ff8740;
    cursor: pointer;
    text-decoration: underline;
  }

    /* 版本历史信息 卡片 */
  .version-card .version {
    color: #000;
    font-weight: 700;
    font-size: 16px;
    width: 482px;
    display: inline-block;
  }
  .version-card .date {
    display: inline-block;
  }
  .version-card .date .el-icon-date{
    margin-right: 4px;
  }

</style>
