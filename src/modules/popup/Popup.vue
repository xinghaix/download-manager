<template>
  <div class="home" id="home" :style="{width: downloadPanelPageSize.width + 'px',
                                      height: downloadPanelPageSize.height - 1 + 'px'}">
    <div class="header">
      <el-input class="search" size="mini" suffix-icon="el-icon-search" v-model="searchContent"/>
      <div class="header-operator">
        <el-popover ref="openDownload" placement="bottom" width="342" trigger="click"
                    v-model="showPopover" @after-enter="textareaFocus">
          <el-input type="textarea" :clearable="true" resize="none"
                    :autosize="{ minRows: 1, maxRows: 4 }"
                    :placeholder="i18data.newDownloadPlaceholder"
                    v-model="downloadUrl" @keydown.enter.native.prevent="enterToDownload(downloadUrl)">
          </el-input>
        </el-popover>
        <div class="musk" v-if="showMusk" @click="() => {this.showMusk = false;this.showPopover = false}"/>
        <el-tooltip :disabled="closeTooltip" :content="i18data.newDownload"
                    placement="bottom" effect="dark" popper-class="tooltip" :enterable="false">
          <i class="header-button icon-button el-icon-download" v-popover:openDownload/>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.clearAll"
                    placement="bottom" effect="dark" popper-class="tooltip" :enterable="false">
          <el-dropdown trigger="click" @command="clearDropdownCommand">
            <span class="el-dropdown-link"><i class="header-button icon-button el-icon-brush"/></span>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="clearAll">{{i18data.clearAll}}</el-dropdown-item>
              <el-dropdown-item command="deleteAll">{{i18data.deleteAll}}</el-dropdown-item>
              <el-dropdown-item command="clearFailed">{{i18data.clearFailed}}</el-dropdown-item>
              <el-dropdown-item command="clearAbsent">{{i18data.clearAbsent}}</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.openDownloadFolder"
                    placement="bottom" effect="dark" popper-class="tooltip" :enterable="false">
          <i class="header-button icon-button el-icon-folder" @click="openFolder"/>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.openHome"
                    placement="bottom" effect="dark" popper-class="tooltip" :enterable="false">
          <i class="header-button icon-button el-icon-position" @click="openHome"/>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.openSettings"
                    placement="bottom" effect="dark" popper-class="tooltip" :enterable="false">
          <i class="header-button icon-button el-icon-setting" @click="openOptions"/>
        </el-tooltip>
      </div>
    </div>

    <div class="content">
      <RecycleScroller id="vue-recycle-scroller" :items="downloadItems"
                       :item-size="78" key-field="id" v-slot="{ item }">
        <transition :enter-active-class="enableAnimation ? 'transition-enter' : ''"
                    :leave-active-class="enableAnimation ? 'transition-leave' : ''">
          <file class="file" :item="item" :key="item.id"
                :render="render" :erase="erase" :copyToClipboard="copyToClipboard"
                :i18data="i18data" :close-tooltip="closeTooltip" :left-click-file="leftClickFile"
                :left-click-url="leftClickUrl" :right-click-file="rightClickFile" :right-click-url="rightClickUrl"/>
        </transition>
      </RecycleScroller>
      <el-backtop target=".content #vue-recycle-scroller" visibilityHeight="70"/>
      <tip :text="i18data.copied" :position="tipPosition"/>
    </div>
  </div>
</template>

<!--suppress UnterminatedStatementJS, JSUnresolvedVariable, ES6ModulesDependencies, JSUnresolvedFunction -->
<script>
  /* eslint-disable no-undef */
  import common from '../../utils/common'
  import storage from '../../utils/storage'
  import File from './File'
  import Tip from '../../components/Tip'

  export default {
    name: 'Popup',
    components: {File, Tip},
    async beforeCreate() {
      // 获取页面大小
      this.checkPageSize(await storage.get('download_panel_page_size'))

      // 获取主题类型。共3种，light、dark、auto
      let theme = await storage.get('theme')
      // 获取下载面板主题类型。共3种，light、dark、custom
      let downloadPanelTheme = await storage.get('download_panel_theme')

      // 如果主题是自适应的话，就根据浏览器的颜色模式匹配主题
      if (theme === 'auto') {
        downloadPanelTheme = common.isInDarkMode() ? 'dark' : 'light'
      }
      // 从本地json文件中获取主题数据
      this.themeData = await new Promise(resolve => {
        fetch('/theme/theme.json').then(r => resolve(r.json()))
      })
      // 设置下载面板主题
      this.setTheme(downloadPanelTheme)

      // 监听浏览器的颜色模式
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', (e) => {
        storage.get('theme').then(theme => {
          if (theme && theme === 'auto') {
            this.setTheme(e.matches ? 'dark' : 'light')
          }
        })
      })
    },
    async mounted() {
      // 初始化插件设置
      this.closeTooltip = await storage.get('close_tooltip')
      this.leftClickFile = await storage.get('left_click_file')
      this.rightClickFile = await storage.get('right_click_file')
      this.leftClickUrl = await storage.get('left_click_url')
      this.rightClickUrl = await storage.get('right_click_url')
      // 开启文件移入移出动画
      this.enableAnimation = await storage.get('enable_animation')

      // 获取下载文件信息
      this.render()

      // 接收来自background发来的数据
      chrome.runtime.onMessage.addListener(message => {
        let received = JSON.parse(message);

        if (received.type === 'download') {
          // data中存放自定义的从background传过来的下载信息
          // 为了解决文件图标闪烁问题，此处不能直接调用请求chrome下载文件的方法
          for (let i = 0, len1 = received.data.length; i < len1; i++) {
            let item = received.data[i]
            // 在刚创建下载时，文件名称会为空
            if (item.filename) {
              // 当搜索框存在内容时，此时也要搜索下载中的文件
              item.show = this.searchContent === '' || item.basename.toLowerCase().indexOf(this.searchContent) > -1

              // 查看是否存在已经保存的下载的文件
              let tmpItem = this.getItem(item.id)
              if (tmpItem) {
                tmpItem.filename = item.filename
                tmpItem.basename = item.basename
                common.beforeHandler(tmpItem)
                tmpItem.error = item.error ? item.error : null
                tmpItem.estimatedEndTime = item.estimatedEndTime ? item.estimatedEndTime : null
                // 记录上一次接收的文件大小，以便于统一计算2种下载情况下的下载速度
                tmpItem.previousBytesReceived = tmpItem.bytesReceived
                tmpItem.bytesReceived = item.bytesReceived
                tmpItem.totalBytes = item.totalBytes
                tmpItem.state = item.state
                tmpItem.danger = item.danger
                tmpItem.show = item.show
              } else {
                common.beforeHandler(item)
                item.previousBytesReceived = 0

                let noInsert = true
                for (let j = 0, len2 = this.downloadItems.length; j < len2; j++) {
                  if (item.startTime >= this.downloadItems[j].startTime) {
                    // 按照下载开始时间降序排列
                    this.downloadItems.splice(j, 0, item)
                    noInsert = false
                    break
                  }
                }
                if (noInsert) {
                  this.downloadItems.push(item)
                }
              }
            }
          }
        }
      })

      // 如果其他插件或者谷歌浏览器下载界面清除下载文件时，同步搜索数据
      chrome.downloads.onErased.addListener((id) => {
        let item = this.getItem(id)
        if (item) {
          this.erase(item)
        }
      })
    },
    data() {
      return {
        chromeDownloadPageUrl: 'chrome://downloads',

        downloadPanelPageSize: {
          width: '400',
          height: '420'
        },

        searchContent: '',
        downloadUrl: '',
        downloadItems: [],
        showMusk: false,

        i18data: common.i18data,

        showPopover: false,

        // 复制文件名和文件链接时的弹框设置
        tipPosition: {x: 0, y: 0},

        // 插件设置
        // 鼠标移动到按钮上时是否展示提示信息
        closeTooltip: true,
        leftClickFile: true,
        leftClickUrl: true,
        rightClickFile: true,
        rightClickUrl: true,
        enableAnimation: false,

        themeData: {}
      }
    },
    watch: {
      /**
       * 搜索框内容改变时触发
       */
      searchContent(val) {
        let tmp = val.trim().toLowerCase()
        this.downloadItems.forEach(item => {
          common.beforeHandler(item)
          // 以小写字母模式模糊匹配搜索的字段
          item.show = tmp === '' || item.basename.toLowerCase().indexOf(tmp) > -1
        })
      },

      /**
       * 手动下载文件弹框展示或取消时触发
       * @param val {Boolean}
       */
      showPopover(val) {
        if (val) {
          this.showMusk = true
        } else {
          this.downloadUrl = ''
          this.showMusk = false
        }
      }
    },
    methods: {
      checkPageSize(downloadPanelPageSize) {
        if (downloadPanelPageSize) {
          let width = downloadPanelPageSize.width
          if (width < 350) {
            width = 350
          }
          if (width > 800) {
            width = 800
          }
          this.downloadPanelPageSize.width = width

          let height = downloadPanelPageSize.height
          if (height < 300) {
            height = 300
          }
          if (height > 600) {
            height = 600
          }
          this.downloadPanelPageSize.height = height
        }
      },

      getItem(id) {
        for (let i = 0; i < this.downloadItems.length; i++) {
          let item = this.downloadItems[i]
          if (item.id === id) {
            return item
          }
        }
        return null
      },

      /**
       * 获取所有下载文件列表
       */
      render() {
        chrome.downloads.search({orderBy: ['-startTime']}, (items) => {
          this.downloadItems = []
          items.forEach(item => {
            common.beforeHandler(item)
            item.show = true
            this.downloadItems.push(item)
          })
        })
      },

      /**
       * 下载文件
       * @param url {String}
       */
      enterToDownload(url) {
        this.showPopover = false
        common.download(url)
      },

      /**
       * 聚焦到输入框
       */
      textareaFocus() {
        const elements = document.getElementsByClassName('el-textarea__inner')
        if (elements && elements[0]) {
          elements[0].focus()
        }
      },

      /**
       * 清空列表所有文件，除了正在下载的文件
       */
      eraseAll() {
        this.downloadItems.forEach(item => {
          if (item.state && item.state !== 'in_progress') {
            this.erase(item)
          }
        })
      },

      /**
       * 打开默认下载目录
       */
      openFolder() {
        chrome.downloads.showDefaultFolder()
      },

      /**
       * 打开浏览器默认下载页
       */
      openHome() {
        chrome.tabs.create({url: this.chromeDownloadPageUrl})
      },

      /**
       * 打开设置界面
       */
      openOptions() {
        chrome.runtime.openOptionsPage()
      },

      /**
       * 从列表中删除文件
       * @param item {Object}
       */
      erase(item) {
        chrome.downloads.erase({id: item.id}, () => {
          for (let i = 0; i < this.downloadItems.length; i++) {
            if (this.downloadItems[i].id === item.id) {
              this.downloadItems.splice(i, 1)
              break
            }
          }
        })
      },

      /**
       * header栏 - 清除按钮点击事件
       * @param command {String}
       */
      clearDropdownCommand(command) {
        this.downloadItems.forEach(item => {
          if (item.state && item.state !== 'in_progress') {
            switch (command) {
              case 'clearAll':
                this.erase(item)
                break
              case 'deleteAll':
                if (item.exists) {
                  chrome.downloads.removeFile(item.id, () => this.erase(item))
                } else {
                  this.erase(item)
                }
                break
              case 'clearFailed':
                item.error && this.erase(item)
                break
              case 'clearAbsent':
                !item.exists && this.erase(item)
                break
            }
          }
        })
      },

      /**
       * 复制内容到剪切板
       * @param text {String} 需要复制到剪切板的内容，字符串类型
       * @param event {MouseEvent}
       */
      copyToClipboard(text, event) {
        if (text) {
          this.$copyText(text).then(() => {
            // 复制成功时，更新并显示已复制的弹框
            if (event) {
              this.tipPosition = {x: event.pageX, y: event.pageY}
            }
          }, e => {
            console.error('failed to copy', e)
          })
        }
      },

      /**
       * 设置下载面板主题
       * @param theme 两种类型：dark，light
       */
      setTheme(theme) {
        if (!theme) {
          theme = 'light'
        }

        let bodyStyle = document.querySelector('body').style
        let panelThemeData = this.themeData[theme]
        Object.keys(panelThemeData).forEach(key => {
          bodyStyle.setProperty(key, panelThemeData[key])
        })
      }
    }
  }
</script>

<!--suppress CssUnusedSymbol -->
<style rel="stylesheet/scss">
  /* 覆盖vue子组件popper样式 */
  body .tooltip {
    background: var(--tooltip-background-color)!important;
    color: var(--tooltip-color)!important;
    padding: 4px!important;
    font-size: 12px!important;
    transition: none;
    -webkit-transform-origin-x: 0;
    -webkit-transform: scale(.9);
  }
  body .tooltip .popper__arrow,
  body .tooltip .popper__arrow:after {
    border-bottom-color: var(--tooltip-background-color)!important;
    border-top-color: var(--tooltip-background-color)!important;
  }

  body .el-popover {
    padding: 6px;
    min-width: 120px;
    font-size: 13px;
    color: var(--popover-color);
    background-color: var(--popover-background-color);
    border-color: var(--popover-border-color);
  }
  body .el-popper[x-placement^=bottom] {
    margin-top: 8px;
  }
  body .el-popconfirm .el-popconfirm__main {
    height: 0;
  }
  body .el-popconfirm .el-button--mini {
    padding: 2px 6px;
    font-size: 11px;
    border-radius: 3px;
  }
  body .el-popper .popper__arrow {
    border-bottom-color: var(--popover-border-color)!important;
  }
  body .el-popper .popper__arrow:after {
    border-bottom-color: var(--popover-background-color)!important;
  }

  .el-dropdown-menu.el-popper[x-placement^=bottom] .popper__arrow:after {
    border-bottom-color: var(--header-dropdown-menu-background-color)!important;
  }

  body .el-textarea textarea {
    font-family: Segoe UI, Microsoft YaHei, sans-serif;
    resize: none;
    color: var(--popover-textarea-color);
    background-color: var(--popover-textarea-background-color);
  }
  body .el-textarea textarea:focus {
    border-color: var(--popover-textarea-focus-border-color);
  }
  body .el-textarea textarea::placeholder {
    color: var(--popover-textarea-placeholder-color);
  }
  body .el-textarea textarea::-webkit-input-placeholder {
    font-family: Segoe UI, Microsoft YaHei, sans-serif;
    font-size: 14px;
  }
  body .el-textarea textarea:-moz-placeholder {
    font-family: Segoe UI, Microsoft YaHei, sans-serif;
    font-size: 14px;
  }
  body .el-textarea textarea::-moz-placeholder {
    font-family: Segoe UI, Microsoft YaHei, sans-serif;
    font-size: 14px;
  }
  body .el-textarea textarea::-ms-input-placeholder {
    font-family: Segoe UI, Microsoft YaHei, sans-serif;
    font-size: 14px;
  }
  body .el-textarea textarea::-webkit-scrollbar {
    width: 5px;
    background-color: transparent;
  }
  body .el-textarea textarea::-webkit-scrollbar:hover {
    cursor: pointer;
  }
  body .el-textarea textarea::-webkit-scrollbar-thumb {
    background-color: rgba(144, 147, 153, .3);
    border-radius: 4px;
  }
  body .el-textarea textarea::-webkit-scrollbar-thumb:hover {
    cursor: pointer;
  }
  body .el-textarea textarea::-webkit-scrollbar-thumb:window-inactive {
    background-color: rgba(157, 165, 183, 0.7);
  }
</style>

<!--suppress CssUnusedSymbol -->
<style scoped rel="stylesheet/scss">
  .home {
    background-color: var(--background-color);
  }

  .header {
    padding: 9px 3px 0 6px;
  }

  /* header栏输入框 */
  .header .search {
    width: 200px;
  }
  .header .search >>> .el-input__inner {
    border-radius: 16px;
    height: 24px;
    line-height: 24px;
    background-color: var(--header-search-background-color);
    color: var(--header-search-color);
    border-color: var(--header-search-border-color)!important;
    transition: border-color 0ms;
  }
  .header .search >>> .el-input__inner:hover,
  .header .search >>> .el-input__inner:focus {
    border-color: var(--header-search-hover-border-color)!important;
  }
  .header .search >>> .el-input__icon.el-icon-search {
    line-height: 24px;
  }

  .header .header-operator {
    float: right;
    display: table;
  }
  .header .header-button {
    display: table-cell;
    padding: 3px 5px;
  }

  /* 显示手动下载文件弹框时的遮蔽层 */
  .header .header-operator .musk {
    z-index: 100;
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    opacity: .2;
    background: var(--popover-musk-background-color);
  }

  /* 图标按钮 */
  .icon-button {
    cursor: pointer;
    font-size: 17px;
    color: var(--header-icon-color);
    -webkit-transition: .2s;
    transition: .2s;
  }
  .icon-button:hover {
    color: var(--header-icon-hover-color);
    font-weight: bold;
    transition: .2s;
  }

  /* 清除按钮下拉菜单 */
  .el-dropdown-menu.el-popper {
    padding: 4px 0;
    margin: 5px 0;
    background-color: var(--header-dropdown-menu-background-color);
    border-color: var(--header-dropdown-menu-border-color);
  }
  .el-dropdown-menu.el-popper .el-dropdown-menu__item {
    line-height: 28px;
    padding: 0 10px;
    margin: 0;
    font-size: 12px;
    color: var(--header-dropdown-menu-item-color);
  }
  .el-dropdown-menu.el-popper .el-dropdown-menu__item:focus,
  .el-dropdown-menu.el-popper .el-dropdown-menu__item:not(.is-disabled):hover {
    background-color: var(--header-dropdown-menu-item-hover-background-color);
    color: var(--header-dropdown-menu-item-hover-color);
  }

  /* 下载内容区域 */
  .content {
    height: calc(100% - 48px);
    margin: 8px 0 0 6px;
  }

  /* 滚动条样式 */
  .content >>> .vue-recycle-scroller::-webkit-scrollbar { /*滚动条整体样式*/
    width: 7px; /*高宽分别对应横竖滚动条的尺寸*/
    height: 7px;
    scrollbar-arrow-color: red;
  }
  .content >>> .vue-recycle-scroller::-webkit-scrollbar-thumb:hover {
    cursor: pointer;
  }
  .content >>> .vue-recycle-scroller::-webkit-scrollbar-thumb { /*滚动条里面小方块*/
    border-radius: 10px;
    -webkit-box-shadow: inset 0 0 4px rgba(123, 123, 123, 0.2);;
    background: var(--scrollbar-thumb-background-color);
  }
  .content >>> .vue-recycle-scroller::-webkit-scrollbar-track { /*滚动条里面轨道*/
    border-radius: 10px;
    -webkit-box-shadow: inset 0 0 4px transparent;
  }
  .content >>> .vue-recycle-scroller {
    height: 100%;
  }

  /* 返回顶部按钮 */
  .content >>> .el-backtop {
    right: 16px !important;
    bottom: 20px !important;
    width: 34px;
    height: 34px;
  }

  /* 动画效果 */
  .transition-enter {
    animation: enter .3s ease alternate forwards;
  }
  @keyframes enter {
    from {
      opacity: 0;
      transform: translateX(-80px);
    }
    to {
      opacity: 1;
      transform: translateX(0px);
    }
  }
  .transition-leave {
    animation: leave .1s ease alternate forwards;
  }
  @keyframes leave {
    from {
      transform: translateX(0px);
    }
    to {
      opacity: 0;
      transform: translateX(160px);
    }
  }
</style>
