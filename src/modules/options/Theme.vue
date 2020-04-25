<template>
  <div class="home" v-if="show">
    <h2 class="about title">{{i18data.iconTitle}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content">
          <span class="setting-title">{{i18data.iconColorSetting}}</span>
        </div>
        <div class="switch">
          <el-color-picker :value="iconColor" size="small" @change="iconColorChange"/>
        </div>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content">
          <span class="setting-title">{{i18data.iconDownloadingColorSetting}}</span>
        </div>
        <div class="switch">
          <el-color-picker :value="iconDownloadingColor" size="small" @change="iconDownloadingColorChange"/>
        </div>
      </div>
    </el-card>

    <h2 class="about title">下载面板</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item custom">
        <div class="content">
          <span class="setting-title">主题</span>
        </div>
        <div class="themes">
          <div class="theme white"
               :class="theme === 'white' ? 'selected' : ''"
               @click="setDownloadPanelTheme('white')">
            <div v-show="theme === 'white'">
              <div class="selected-background"></div>
              <div class="selected"></div>
            </div>
          </div>
          <div class="theme dark"
               :class="theme === 'dark' ? 'selected' : ''"
               @click="setDownloadPanelTheme('dark')">
            <div v-show="theme === 'dark'">
              <div class="selected-background"></div>
              <div class="selected"></div>
            </div>
          </div>
          <div class="theme custom">
            <div class="message">自定义主题，敬请期待！</div>
          </div>
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
      this.iconColor = await storage.get('icon_color')
      this.iconDownloadingColor = await storage.get('icon_downloading_color')
      this.theme = await storage.get('download_panel_theme')
      this.show = true
    },
    data: function () {
      return {
        show: false,
        iconColor: '#000000',
        iconDownloadingColor: '#ffa500',

        theme: 'white',
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
        storage.set('icon_color', val)

        this.iconColor = val
      },

      /**
       * 当图标下载动画颜色更改时，设置插件图标下载动画颜色
       * @param val {String}
       */
      iconDownloadingColorChange(val) {
        // 同步到设置
        storage.set('icon_downloading_color', val)

        this.iconDownloadingColor = val
      },

      /**
       * 设置下载面板主题
       *
       * @param theme {String} white、dark、custom
       */
      setDownloadPanelTheme(theme) {
        // 同步到设置
        storage.set('download_panel_theme', theme)

        this.theme = theme
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
  /* 自定义下载面板主题 */
  .box-card .item.custom {
    display: block;
  }
  .box-card .item .themes {
    margin-top: 16px;
  }
  .box-card .item .theme {
    display: inline-block;
    vertical-align: top;
    width: 178px;
    height: 200px;
    border-radius: 4px;
    border: 2px solid #e8e8e8;
    position: relative;
  }
  .box-card .item .theme.white,
  .box-card .item .theme.dark {
    margin-right: 10px;
    cursor: pointer;
  }
  .box-card .item .theme.white:hover,
  .box-card .item .theme.dark:hover,
  .box-card .item .theme.selected {
    border-color: #008efc;
  }
  .box-card .item .theme.white {
    background: url(/img/white.png) no-repeat;
    background-size: 100% 100%;
  }
  .box-card .item .theme.dark {
    background: url(/img/dark.png) no-repeat;
    background-size: 100% 100%;
  }
  .box-card .item .theme.custom {
    font-size: 12px;
    text-align: center;
  }
  .box-card .item .theme.custom .message {
    margin-top: 81px;
    color: #009688;
    word-wrap: break-word;
    font-weight: bold;
    padding: 0 18px;
  }
  .box-card .item .theme .selected-background {
    height: 24px;
    left: auto;
    right: -8px;
    top: -14px;
    width: 24px;
    position: absolute;
    background-color: white;
    border-radius: 12px;
  }
  .box-card .item .theme .selected {
    height: 26px;
    left: auto;
    right: -8px;
    top: -14px;
    width: 24px;
    background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgdmlld0JveD0iMCAwIDQ4IDQ4IiBmaWxsPSIjNDI4NUY0Ij48cGF0aCBkPSJNMCAwaDQ4djQ4SDB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTI0IDRDMTIuOTUgNCA0IDEyLjk1IDQgMjRjMCAxMS4wNCA4Ljk1IDIwIDIwIDIwIDExLjA0IDAgMjAtOC45NiAyMC0yMCAwLTExLjA1LTguOTYtMjAtMjAtMjB6bS00IDMwTDEwIDI0bDIuODMtMi44M0wyMCAyOC4zNGwxNS4xNy0xNS4xN0wzOCAxNiAyMCAzNHoiLz48L3N2Zz4=) no-repeat 50%;
    background-size: 28px 28px;
    position: absolute;
  }

  .box-card >>> .el-divider--horizontal {
    margin: 10px 0!important;
    height: 0.5px!important;
  }

</style>