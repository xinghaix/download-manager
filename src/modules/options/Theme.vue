<template>
  <div class="home" v-if="show">
    <h2 class="about title">{{i18data.themeTitle}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content" @click="setThemeAdaptation(!enableThemeAdaptation)">
          <span class="setting-title">{{i18data.themeAdaptation}}</span>
          <span class="setting-description">{{i18data.themeAdaptationDescription}}</span>
        </div>
        <div class="switch width">
          <el-radio-group v-model="theme" size="mini">
            <el-radio-button label="auto">{{i18data.themeAdaptationOption1}}</el-radio-button>
            <el-radio-button label="light">{{i18data.themeAdaptationOption2}}</el-radio-button>
            <el-radio-button label="dark">{{i18data.themeAdaptationOption3}}</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </el-card>

    <h2 class="about title">{{i18data.iconTitle}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item">
        <div class="content">
          <span class="setting-title">{{i18data.iconColorSetting}}</span>
        </div>
        <div class="switch width icon">
          <el-tooltip :content="i18data.themeAdaptationOption2 + i18data.themeTitle"
                      placement="top" effect="dark" popper-class="tooltip" :enterable="false">
            <el-color-picker :value="iconColor['icon_color']['light']" size="small"
                             :class="theme === 'light' || theme === 'auto' ? 'color' : ''"
                             @change="setIconColor($event, 'icon_color', 'light')"/>
          </el-tooltip>
          <el-tooltip :content="i18data.themeAdaptationOption3 + i18data.themeTitle"
                      placement="top" effect="dark" popper-class="tooltip" :enterable="false">
            <el-color-picker :value="iconColor['icon_color']['dark']" size="small"
                             :class="theme === 'dark' || theme === 'auto' ? 'color' : ''"
                             @change="setIconColor($event, 'icon_color', 'dark')"/>
          </el-tooltip>
        </div>
      </div>
      <el-divider/>
      <div class="item">
        <div class="content">
          <span class="setting-title">{{i18data.iconDownloadingColorSetting}}</span>
        </div>
        <div class="switch width icon">
          <el-tooltip :content="i18data.themeAdaptationOption2 + i18data.themeTitle"
                      placement="top" effect="dark" popper-class="tooltip" :enterable="false">
            <el-color-picker :value="iconColor['icon_downloading_color']['light']" size="small"
                             :class="theme === 'light' || theme === 'auto' ? 'color' : ''"
                             @change="setIconColor($event, 'icon_downloading_color', 'light')"/>
          </el-tooltip>
          <el-tooltip :content="i18data.themeAdaptationOption3 + i18data.themeTitle"
                      placement="top" effect="dark" popper-class="tooltip" :enterable="false">
            <el-color-picker :value="iconColor['icon_downloading_color']['dark']" size="small"
                             :class="theme === 'dark' || theme === 'auto' ? 'color' : ''"
                             @change="setIconColor($event, 'icon_downloading_color', 'dark')"/>
          </el-tooltip>
        </div>
      </div>
    </el-card>

    <h2 class="about title">{{i18data.downloadPanelTitle}}</h2>
    <el-card class="box-card" shadow="hover">
      <div class="item custom">
        <div class="content">
          <span class="setting-title">{{i18data.themeTitle}}</span>
        </div>
        <div class="themes">
          <div class="theme light"
               :class="downloadPanelTheme === 'light' || theme === 'auto' ? 'selected' : ''"
               @click="setDownloadPanelTheme('light')">
            <div v-show="downloadPanelTheme === 'light' || theme === 'auto'">
              <div class="selected-background"></div>
              <div class="selected"></div>
            </div>
          </div>
          <div class="theme dark"
               :class="downloadPanelTheme === 'dark' || theme === 'auto' ? 'selected' : ''"
               @click="setDownloadPanelTheme('dark')">
            <div v-show="downloadPanelTheme === 'dark' || theme === 'auto'">
              <div class="selected-background"></div>
              <div class="selected"></div>
            </div>
          </div>
          <div class="theme custom">
            <div class="message">{{i18data.downloadPanelThemeCustomDescription}}</div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
  import icon from '../../utils/icon'
  import storage from '../../utils/storage'
  import common from "../../utils/common";

  export default {
    name: "Theme",
    props: {
      i18data: Object
    },
    async mounted() {
      this.theme = await storage.get('theme')

      this.iconColor.icon_color = await storage.get('icon_color')
      this.iconColor.icon_downloading_color = await storage.get('icon_downloading_color')

      this.downloadPanelTheme = await storage.get('download_panel_theme')

      this.show = true
    },
    data: function () {
      return {
        show: false,

        theme: 'light',

        iconColor: {
          icon_color: {
            'light': '#000000',
            'dark': '#989898'
          },
          icon_downloading_color: {
            'light': '#00d032',
            'dark': '#ffa500'
          },
        },

        downloadPanelTheme: 'light',

        should: {
          dark: ['a-l', 'l-a', 'l-d', 'd-l'],
          light: ['a-d', 'l-d', 'd-a', 'd-l']
        }
      }
    },
    watch: {
      /**
       * 设置主题自适应。包含图标和下载面板
       *
       * @param val {String} 更新后的数据。light、dark、auto
       * @param oldVal {String} 更新前的数据。light、dark、auto
       */
      theme(val, oldVal) {
        console.log(val, oldVal)
        storage.set('theme', val)

        // 同时设置下载面板主题
        this.setDownloadPanelTheme(val)

        let systemTheme = common.isInDarkMode() ? 'dark' : 'light'
        if (systemTheme === 'dark') {
          if (!((!(oldVal === 'auto' && val === 'dark')) && (!(oldVal === 'dark' && val === 'auto')))) {
            this.sendIconColorToBackground(val === 'auto' ? systemTheme : val)
          }
        } else {
          if (!((!(oldVal === 'auto' && val === 'light')) && (!(oldVal === 'light' && val === 'auto')))) {
            this.sendIconColorToBackground(val === 'auto' ? systemTheme : val)
          }
        }
      }
    },
    methods: {
      /**
       * 当图标颜色更改时，设置插件图标颜色和下载时图标颜色
       *
       * @param val {String} 16进制颜色值
       * @param type {String} 设置名。2种，icon_color、icon_downloading_color
       * @param theme {String} 主题：2种，dark，light
       */
      setIconColor(val, type, theme) {
        this.iconColor[type][theme] = val

        let tmpTheme = common.isInDarkMode() ? 'dark' : 'light'
        if ((this.theme === 'auto' && tmpTheme === theme ) || this.theme === theme) {
          // 发送图标颜色数据到background，由background设置图标颜色
          chrome.runtime.sendMessage(JSON.stringify({
            type: type,
            data: val
          }))
        }

        // 同步到设置
        storage.set(type, this.iconColor[type])
      },

      sendIconColorToBackground(theme) {
        // 发送图标颜色数据到background，由background设置图标颜色
        chrome.runtime.sendMessage(JSON.stringify({
          type: 'icon_color',
          data: this.iconColor.icon_color[theme]
        }))

        // 发送图标颜色数据到background，由background设置图标颜色
        chrome.runtime.sendMessage(JSON.stringify({
          type: 'icon_downloading_color',
          data: this.iconColor.icon_downloading_color[theme]
        }))
      },

      /**
       * 设置下载面板主题
       *
       * @param theme {String} light、dark、custom
       */
      setDownloadPanelTheme(theme) {
        // 同步到设置
        storage.set('download_panel_theme', theme)
        this.downloadPanelTheme = theme
      }
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
  .box-card .item .switch.icon >>> .el-color-picker:first-child {
    margin-right: 16px;
  }
  .box-card .item .switch.icon >>> .el-color-picker.color .el-color-picker__trigger {
    border-color: #5ba2ff;
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
  .box-card .item .theme.light,
  .box-card .item .theme.dark {
    margin-right: 10px;
    cursor: pointer;
  }
  .box-card .item .theme.light:hover,
  .box-card .item .theme.dark:hover,
  .box-card .item .theme.selected {
    border-color: #008efc;
  }
  .box-card .item .theme.light {
    background: url(/img/light.png) no-repeat;
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
    top: -15px;
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

  .box-card >>> .el-radio-button__inner {
    padding: 5px 17px;
    font-size: 12px;
    border-radius: 0 !important;
  }

  .box-card >>> .el-divider--horizontal {
    margin: 10px 0!important;
    height: 0.5px!important;
  }

</style>