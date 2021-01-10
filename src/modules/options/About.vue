<template>
  <div class="home">
    <h2 class="about title">{{i18data.aboutTitle}}</h2>
    <el-card class="about-card box-card" shadow="hover">
      <div class="text">
        <div class="item">
          <i class="iconfont el-icon-info"/>
          <span class="prefix">{{extName}}<span class="version">{{version}}</span></span>
          <a class="suffix link" @click="openUrl(githubUrl)">Github</a>
        </div>
        <div class="item">
          <i class="iconfont el-icon-star-on"/>
          <span class="prefix">{{i18data.starAbout1}}
            <a class="link" @click="openPluginShop">{{i18data.pluginShopAbout}}</a>
            {{i18data.starAbout2}}
          </span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
  /* eslint-disable no-undef */
  import common from '../../utils/common'

  export default {
    name: "About",
    props: {
      i18data: Object
    },
    data() {
      return {
        githubUrl: 'https://github.com/xinghaix/download-manager',
        edgePluginShopUrl: 'https://microsoftedge.microsoft.com/addons/detail/phalbpghhjknlmomkmimbamfceiddlic',
        chromePluginShopUrl: 'https://chrome.google.com/webstore/detail/ofpglhlcdbjdhlacgbljnildhajfmlei',

        extName: chrome.runtime.getManifest().name,
        version: chrome.runtime.getManifest().version,
      }
    },
    methods: {
      // 打开插件商店链接
      openPluginShop() {
        // 如果浏览器是新版Edge浏览器，那么将商店链接指向Edge商店
        let url = common.isInEdge() ? this.edgePluginShopUrl : this.chromePluginShopUrl
        this.openUrl(url)
      },
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
    padding: 3px 0;
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
  .about-card .item .version {
    background-color: rgb(228, 231, 237);
    padding: 1px 6px;
    margin-left: 4px;
    border-radius: 2px;
    font-size: 13px;
    font-family: consolas, Microsoft YaHei, sans-serif;
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
