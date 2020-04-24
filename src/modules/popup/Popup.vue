<template>
  <div class="home" id="home">
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
          <i class="header-button icon-button el-icon-circle-plus-outline" v-popover:openDownload/>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.clearList"
                    placement="bottom" effect="dark" popper-class="tooltip" :enterable="false">
          <el-popconfirm :title="i18data.clearList" @onConfirm="eraseAll"
                         :confirmButtonText="i18data.clearPopConfirmText"
                         :cancelButtonText="i18data.clearPopCancelText">
            <i class="header-button icon-button el-icon-brush" slot="reference"/>
          </el-popconfirm>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.openDownloadFolder"
                    placement="bottom" effect="dark" popper-class="tooltip" :enterable="false">
          <i class="header-button icon-button el-icon-folder" @click="openFolder"/>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.openSettings"
                    placement="bottom" effect="dark" popper-class="tooltip" :enterable="false">
          <i class="header-button icon-button el-icon-setting" @click="openOptions"/>
        </el-tooltip>
      </div>
    </div>
    <div class="content">
      <el-scrollbar class="content-scrollbar">
        <file v-for="(item, index) in downloadItems" :key="item" class="file"
              :item="item" :timeout="((index+1) / 4) * 180"
              :render="render" :erase="erase" :copyToClipboard="copyToClipboard"
              :i18data="i18data" :close-tooltip="closeTooltip" :left-click-file="leftClickFile"
              :left-click-url="leftClickUrl" :right-click-file="rightClickFile" :right-click-url="rightClickUrl"/>
      </el-scrollbar>
      <el-backtop target=".content .el-scrollbar__wrap" visibilityHeight="100"/>
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
      // 获取主题类型。共3种，white、dark、custom
      let theme = await storage.get('download_panel_theme')
      // 从本地json文件中获取主题数据
      let themeData = (await new Promise(resolve => {
        fetch('/theme/theme.json').then(r => resolve(r.json()))
      }))[theme]

      let bodyStyle = document.querySelector('body').style
      Object.keys(themeData).forEach(key => {
        bodyStyle.setProperty(key, themeData[key])
      })
    },
    async mounted() {
      // 初始化插件设置
      this.closeTooltip = await storage.get('close_tooltip')
      this.leftClickFile = await storage.get('left_click_file')
      this.rightClickFile = await storage.get('right_click_file')
      this.leftClickUrl = await storage.get('left_click_url')
      this.rightClickUrl = await storage.get('right_click_url')

      // 获取下载文件信息
      this.render()

      // 接收来自background发来的数据
      chrome.runtime.onMessage.addListener(message => {
        let received = JSON.parse(message);

        if (received.type === 'download') {
          // data中存放自定义的从background传过来的下载信息
          // 为了解决文件图标闪烁问题，此处不能直接调用请求chrome下载文件的方法
          received.data.forEach((item) => {
            // 在刚创建下载时，文件名称会为空
            if (item.filename) {
              // 当搜索框存在内容时，此时也要搜索下载中的文件
              if (this.searchContent === '' || item.basename.toLowerCase().indexOf(this.searchContent) !== -1) {
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
                } else {
                  common.beforeHandler(item)
                  item.previousBytesReceived = 0

                  let noInsert = true
                  for (let i = 0, len = this.downloadItems.length; i < len; i++) {
                    if (item.startTime >= this.downloadItems[i].startTime) {
                      // 按照下载开始时间降序排列
                      this.downloadItems.splice(i, 0, item)
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
          })
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
        rightClickUrl: true
      }
    },
    watch: {
      /**
       * 搜索框内容改变时触发
       */
      searchContent(val) {
        const tmp = val.trim().toLowerCase()
        if (tmp !== '') {
          // 如果搜索内容不为空，那么先把列表内容清空
          this.downloadItems = []
          chrome.downloads.search({orderBy: ['-startTime']}, (items) => {
            items.forEach(item => {
              common.beforeHandler(item)
              // 以小写字母模式模糊匹配搜索的字段
              if (item.basename.toLowerCase().indexOf(tmp) !== -1) {
                // 将符合条件的数据加入到搜索结果列表
                this.downloadItems.push(item)
              }
            })
          })
        } else {
          this.render()
        }
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
      getItem(id) {
        for (let item of this.downloadItems) {
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
          for (let item of items) {
            common.beforeHandler(item)
            this.downloadItems.push(item)
          }
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
        this.downloadItems.forEach((item) => {
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
            // todo
            console.error('failed to copy', e)
          })
        }
      },
    }
  }
</script>

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
    border-bottom-color: #1a73e8;
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
  body .el-popper[x-placement^=top] .popper__arrow,
  body .el-popper[x-placement^=top] .popper__arrow:after {
    border-bottom-color: var(--popover-background-color);
  }
  body .el-popper[x-placement^=bottom] .popper__arrow,
  body .el-popper[x-placement^=bottom] .popper__arrow:after {
    border-bottom-color: var(--popover-background-color);
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
    width: 365px;
    height: 377px;
    background-color: var(--background-color);
  }

  .header {
    margin: 9px 6px 0 6px;
    display: inline-block;
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
    border-color: var(--header-search-border-color);
  }

  .header .search >>> .el-input__inner:hover,
  .header .search >>> .el-input__inner:focus {
    border-color: var(--header-search-hover-border-color);
  }

  .header .search >>> .el-input__icon.el-icon-search {
    line-height: 24px;
  }

  .header .header-operator {
    float: right;
    margin-left: 45px;
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
    margin: 4px 0 0 10px;
    display: inline-block;
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

  /* 下载内容区域 */
  .content {
    margin-top: 4px;
    height: 340px;
  }

  /* 下载文件区域滚动条 */
  .content-scrollbar {
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  .content-scrollbar >>> .el-scrollbar__wrap {
    overflow: hidden;
    overflow-y: scroll;
  }

  .content-scrollbar >>> .el-scrollbar__bar.is-vertical {
    width: 5px;
    right: 0;
  }

  .content-scrollbar >>> .el-scrollbar__bar.is-horizontal {
    display: none;
  }

  /* 返回顶部按钮 */
  .content >>> .el-backtop {
    right: 16px !important;
    bottom: 20px !important;
    width: 34px;
    height: 34px;
  }

</style>
