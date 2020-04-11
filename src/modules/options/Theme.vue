<template>
  <div class="home" v-if="show">
    <h2 class="about title">{{i18data.iconTitle}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content">
          <span class="setting-title">{{i18data.iconColorSetting}}</span>
        </div>
        <div class="switch">
          <el-color-picker :value="iconColor" @change="iconColorChange"/>
        </div>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content">
          <span class="setting-title">{{i18data.iconDownloadingColorSetting}}</span>
        </div>
        <div class="switch">
          <el-color-picker :value="iconDownloadingColor" @change="iconDownloadingColorChange"/>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
  import icon from '../../utils/icon'
  import storage from '../../utils/storage'

  export default {
    name: "Theme",
    props: {
      i18data: Object
    },
    async mounted() {
      this.iconColor = await storage.getIconColor()
      this.iconDownloadingColor = await storage.getIconDownloadingColor()
      this.show = true
    },
    data: function () {
      return {
        show: false,
        iconColor: '#000000',
        iconDownloadingColor: '#ffa500'
      }
    },
    methods: {
      /**
       * 当图标颜色更改时，设置插件图标颜色
       * @param val {String}
       */
      iconColorChange(val) {
        // 设置图标颜色
        icon.setBrowserActionIcon(val)
        // 同步到设置
        storage.setIconColor(val)

        this.iconColor = val
      },

      /**
       * 当图标下载动画颜色更改时，设置插件图标下载动画颜色
       * @param val {String}
       */
      iconDownloadingColorChange(val) {
        // 同步到设置
        storage.setIconDownloadingColor(val)

        this.iconDownloadingColor = val
      }
    }
  }
</script>

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
    height: 0.5px!important;
  }

</style>