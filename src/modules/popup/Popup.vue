<template>
  <div class="home" id="home">
    <div class="header">
      <el-input class="search" size="mini" suffix-icon="el-icon-search" v-model="searchContent"/>
      <div class="header-operator">
        <el-tooltip :disabled="closeTooltip" :content="clearListContent"
                    placement="bottom" effect="dark" popper-class="tooltip" :enterable="false">
            <i class="header-button icon-button el-icon-circle-close" @click="eraseAll"/>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="openDownloadFolderContent"
                    placement="bottom" effect="dark" popper-class="tooltip" :enterable="false">
            <i class="header-button icon-button el-icon-folder" @click="openFolder"/>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="openSettingsContent"
                    placement="bottom" effect="dark" popper-class="tooltip" :enterable="false">
            <i class="header-button icon-button el-icon-setting" @click="openOptions"/>
        </el-tooltip>
      </div>
    </div>
    <div class="content">
      <el-scrollbar class="content-scrollbar">
        <div class="file" :class="shouldBeGray(item)" v-for="item in downloadItems" :key="item">
          <div class="icon">
            <el-progress class="progress" type="circle" stroke-width="3" width="42"
                         :status="item.paused ? 'warning' : ''" v-show="item.state === 'in_progress'"
                         :percentage="getPercentage(item)"/>
            <img :src="item.iconUrl" alt="" draggable="false"/>
          </div>
          <div class="file-content">
            <span class="filename"
                  @click="leftClickFile && openfile(item)"
                  @contextmenu.prevent="rightClickFile && copyToClipboard(item.basename, $event)">{{item.basename}}</span>
            <span class="file-url"
                  @click="leftClickUrl && openUrl(item)"
                  @contextmenu.prevent="rightClickUrl && copyToClipboard(item.finalUrl, $event)">{{item.finalUrl}}</span>
            <div class="info">
              <template v-if="item.state === 'in_progress'">
                <template v-if="dangerous(item)">
                  <div class="cell left danger">
                    <span class="description small-size">{{dangerDescription}}</span>
                  </div>
                  <div class="cell right danger">
                    <button class="cancel button small-size" @click="cancel(item)">{{cancelContent}}</button>
                    <button class="accept button small-size" @click="acceptDanger(item)">{{reserveContent}}</button>
                  </div>
                </template>
                <template v-else-if="item.totalBytes !== 0">
                  <div class="cell left common">
                    <span class="receivedSize small-size">{{getFormattedSize(item.bytesReceived)}}</span>
                    <span class="divider small-size">|</span>
                    <span class="size small-size">{{getFormattedSize(item.totalBytes)}}</span>
                  </div>
                  <div class="cell middle common">
                    <span class="speed small-size">{{getSpeed(item)}}</span>
                  </div>
                  <div class="cell right common">
                    <span class="remaining small-size">{{remaining(item)}}</span>
                  </div>
                </template>
                <template v-else>
                  <div class="cell left common">
                    <span class="receivedSize small-size">{{getFormattedSize(item.bytesReceived)}}</span>
                  </div>
                  <div class="cell right common">
                    <span class="speed small-size">{{getSpeed(item)}}</span>
                  </div>
                </template>
              </template>
              <template v-else>
                <div class="cell left common">
                  <span class="size small-size" v-show="item.totalBytes !== 0">{{getFormattedSize(item.totalBytes)}}</span>
                </div>
                <div class="cell right common">
                  <span class="startTime small-size">{{dateFormat(item.startTime, 'MM/dd hh:mm')}}</span>
                </div>
              </template>
            </div>
          </div>
          <div class="content-operator">
            <el-tooltip :disabled="closeTooltip" :content="openFileInFolderContent"
                        placement="top" effect="dark" popper-class="tooltip" :enterable="false">
              <i class="icon-button el-icon-folder" v-show="openable(item)" @click="showInFolder(item)"/>
            </el-tooltip>
            <el-tooltip :disabled="closeTooltip" :content="item.paused ? resumeContent : pauseContent"
                        placement="top" effect="dark" popper-class="tooltip" :enterable="false">
              <i v-show="item.state === 'in_progress'" @click="pauseOrResume(item)"
                 class="icon-button" :class="item.paused ? 'el-icon-video-play' : 'el-icon-video-pause'"/>
            </el-tooltip>
            <el-tooltip :disabled="closeTooltip" :content="deleteContent"
                        placement="top" effect="dark" popper-class="tooltip" :enterable="false">
              <i class="icon-button el-icon-delete" v-show="removable(item)" @click="remove(item)"/>
            </el-tooltip>
            <el-tooltip :disabled="closeTooltip" :content="retryContent"
                        placement="top" effect="dark" popper-class="tooltip" :enterable="false">
              <i class="icon-button el-icon-refresh-right" v-show="retryable(item)" @click="retryDownload(item)"/>
            </el-tooltip>
            <el-tooltip :disabled="closeTooltip" :content="eraseContent"
                        placement="top" effect="dark" popper-class="tooltip" :enterable="false">
              <i class="icon-button el-icon-close" @click="erase(item)"/>
            </el-tooltip>
          </div>
        </div>
      </el-scrollbar>
      <el-backtop target=".content .el-scrollbar__wrap" visibilityHeight="100"/>
      <tip :text="copiedContent" :x="tipX" :y="tipY"/>
    </div>
  </div>
</template>

<!--suppress UnterminatedStatementJS, JSUnresolvedVariable, ES6ModulesDependencies, JSUnresolvedFunction -->
<script>
  /* eslint-disable no-undef */
  import common from "../../utils/common"
  import Tip from "./Tip"
  import storage from "../../utils/storage";

  export default {
  name: 'Popup',
  components: { Tip },
  async mounted () {
    // 初始化插件设置
    this.closeTooltip = await storage.getCloseTooltip()
    this.leftClickFile = await storage.getLeftClickFile()
    this.rightClickFile = await storage.getRightClickFile()
    this.leftClickUrl = await storage.getLeftClickUrl()
    this.rightClickUrl = await storage.getRightClickUrl()

    // 获取下载文件信息
    this.render()

    // 接收来自background发来的数据
    chrome.runtime.onMessage.addListener(message => {
      let received = JSON.parse(message);

      if (received.type === 'download') {
        // data中存放自定义的从background传过来的下载信息
        // 为了解决闪烁问题，此处不能直接调用请求chrome下载文件的方法
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
                tmpItem.error = item.error ? item.error : null
                tmpItem.estimatedEndTime = item.estimatedEndTime ? item.estimatedEndTime : null
                // 记录上一次接收的文件大小，以便于统一计算2种下载情况下的下载速度
                tmpItem.previousBytesReceived = tmpItem.bytesReceived
                tmpItem.bytesReceived = item.bytesReceived
                tmpItem.totalBytes = item.totalBytes
                tmpItem.state = item.state
                tmpItem.danger = item.danger
                common.beforeHandler(tmpItem)
              } else {
                common.beforeHandler(item)
                item.previousBytesReceived = 0
                // 插入到首位显示
                this.downloadItems.splice(0, 0, item)
              }
            }
          }
        })
        // 按照下载开始时间降序排列
        this.downloadItems.sort((a, b) => b.startTime - a.startTime)
      }
    })

    // 如果其他插件或者谷歌浏览器下载界面清除下载文件时，同步搜索数据
    chrome.downloads.onErased.addListener((id) => {
      let item = this.getItem(id)
      if (item) {
        this.erase(item)
      }
    })

    // 当组件一开始为创建时，tooltip显示内容无法通过I18N读取说明，只能是加载时默认初始化一次
    this.openFileInFolderContent = common.loadI18nMessage('openFileInFolder')
    this.pauseContent = common.loadI18nMessage('pause')
    this.resumeContent = common.loadI18nMessage('resume')
    this.deleteContent = common.loadI18nMessage('delete')
    this.retryContent = common.loadI18nMessage('retry')
    this.eraseContent = common.loadI18nMessage('erase')
  },
  data () {
    return {
      searchContent: '',
      downloadItems: [],

      secondContent: common.loadI18nMessage('second'),
      minuteContent: common.loadI18nMessage('minute'),
      hourContent: common.loadI18nMessage('hour'),
      dayContent: common.loadI18nMessage('day'),

      clearListContent: common.loadI18nMessage('clearList'),
      openDownloadFolderContent: common.loadI18nMessage('openDownloadFolder'),
      openSettingsContent: common.loadI18nMessage('openSettings'),
      dangerDescription: common.loadI18nMessage('dangerDescription'),
      cancelContent: common.loadI18nMessage('cancel'),
      reserveContent: common.loadI18nMessage('reserve'),

      openFileInFolderContent: '',
      pauseContent: '',
      resumeContent: '',
      deleteContent: '',
      retryContent: '',
      eraseContent: '',

      // 复制文件名和文件链接时的弹框设置
      tipX: 0,
      tipY: 0,
      copiedContent: common.loadI18nMessage('copied'),

      // 插件设置
      // 鼠标移动到按钮上时是否展示提示信息
      closeTooltip: true,
      leftClickFile: true,
      leftClickUrl: true,
      rightClickFile: true,
      rightClickUrl: true,
    }
  },
  watch: {
    searchContent (val) {
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
    }
  },
  methods: {
    getItem (id) {
      for (let item of this.downloadItems) {
        if (item.id === id) {
          return item
        }
      }
      return null
    },

    // 获取所有下载文件列表
    render () {
      chrome.downloads.search({orderBy: ['-startTime']}, (items) => {
        items.forEach(item => {
          common.beforeHandler(item)
          console.log(item)
        })
        this.downloadItems = items
      })
    },

    /**
     * 会弹出一个弹框，提示是否接受下载危险的文件
     * 可能接受危险文件下载
     *  DangerType
     *     file
     *      下载项的文件名可疑。
     *     url
     *       下载项的 URL 已知是恶意的。
     *     content
     *       已下载的文件已知是恶意的。
     *     uncommon
     *       下载项的 URL 不常见，可能有风险。
     *     host
     *       下载项来自已知发布恶意软件的主机，可能有风险。
     *     unwanted
     *       下载项可能不是所需要的或者不安全，例如它可能会更改浏览器或计算机设置。
     *     safe
     *       下载项对用户的计算机没有已知风险。
     *     accepted
     *       用户已经接受了有风险的下载
     */
    maybeAcceptDanger(item) {
      if ((item.state !== 'in_progress')
          || (item.danger === 'safe')
          || (item.danger === 'accepted')
          || item.acceptingDanger) {
        return
      }

      item.acceptingDanger = true
      chrome.downloads.acceptDanger(item.id, () => {
        item.acceptingDanger = false
      })
    },

    /**
     * 接受下载危险文件
     *
     * 会弹出一个弹框，提示是否接受下载危险的文件
     * 可能接受危险文件下载
     *  DangerType
     *     file
     *      下载项的文件名可疑。
     *     url
     *       下载项的 URL 已知是恶意的。
     *     content
     *       已下载的文件已知是恶意的。
     *     uncommon
     *       下载项的 URL 不常见，可能有风险。
     *     host
     *       下载项来自已知发布恶意软件的主机，可能有风险。
     *     unwanted
     *       下载项可能不是所需要的或者不安全，例如它可能会更改浏览器或计算机设置。
     *     safe
     *       下载项对用户的计算机没有已知风险。
     *     accepted
     *       用户已经接受了有风险的下载
     * @param item {Object}
     */
    acceptDanger(item) {
      chrome.downloads.acceptDanger(item.id)
    },

    /**
     * 是否是正在下载危险文件
     * @param item {Object}
     */
    dangerous(item) {
      return item.state === 'in_progress' && item.danger !== 'safe' && item.danger !== 'accepted'
    },

    // 打开默认下载目录
    openFolder () {
      chrome.downloads.showDefaultFolder()
    },

    // 打开
    openOptions () {
      chrome.tabs.create({ url: chrome.extension.getURL('options.html') })
    },

    // 在新标签页中打开下载文件链接
    openUrl (item) {
      chrome.tabs.create({ url: item.finalUrl })
    },

    // 打开文件
    openfile (item) {
      if (this.openable(item)) {
        chrome.downloads.open(item.id)
      }
    },

    // 在资源管理器中显示文件
    showInFolder (item) {
      chrome.downloads.show(item.id)
    },

    // 从磁盘中删除文件
    remove (item) {
      chrome.downloads.removeFile(item.id, () => this.erase(item))
    },

    // 从列表中删除文件
    erase (item) {
      chrome.downloads.erase({ id: item.id }, () => this.render())
    },

    // 清空列表所有文件
    eraseAll () {
      this.downloadItems.forEach((item) => {
        this.erase(item)
      })
    },

    // 暂停或恢复下载
    pauseOrResume (item) {
      if (item.paused) {
        this.resume(item)
      } else {
        this.pause(item)
      }
    },

    // 暂停正在下载中的文件
    pause (item) {
      chrome.downloads.pause(item.id, () => { item.paused = true })
    },

    // 恢复已经暂停下载中的文件
    resume (item) {
      chrome.downloads.resume(item.id, () => { item.paused = false })
    },

    /**
     * 重新下载文件
     * @param item {Object}
     */
    retryDownload(item) {
      chrome.downloads.download({url: item.url})
    },

    /**
     * 取消正在下载中的文件
     * @param item {Object}
     */
    cancel (item) {
      chrome.downloads.cancel(item.id)
    },

    // 可在资源管理器中打开
    openable (item) {
      return (item.state === 'complete' || item.state === 'in_progress') && item.exists
    },

    // 可从磁盘中删除
    removable (item) {
      return item.state === 'complete' && item.exists
    },

    /**
     * 是否可以重新下载
     * @param item {Object}
     */
    retryable (item) {
      return item.state === 'interrupted'
    },

    // 获取文件下载进度
    getPercentage (item) {
      return item.totalBytes > 0 ? parseInt((100 * item.bytesReceived / item.totalBytes).toString()) : 0
    },

    getFormattedSize (bytes) {
      if (bytes <= 0) {
        return 0 + 'B'
      }
      const kbSize = bytes / 1024
      if (kbSize < 1) {
        return bytes.toFixed(0) + 'B'
      } else if (kbSize < 1024) {
        return kbSize.toFixed(1) + 'K'
      } else {
        const mbSize = bytes / 1024 / 1024
        if (mbSize < 1024) {
          return mbSize.toFixed(1) + 'M'
        } else {
          const gbSize = bytes / 1024 / 1024 / 1024
          return gbSize.toFixed(1) + 'G'
        }
      }
    },

    // 如果文件不存在，或者文件下载过程中出现错误，那么就把文件图标和文件名称颜色变成灰色
    shouldBeGray (item) {
      return !item.exists || item.error ? 'gray' : 'normal'
    },

    // 获取文件实时下载速度
    getSpeed (item) {
      // 文件下载有两种情况
      // 一种是确定文件的总大小
      if (item.totalBytes !== 0) {
        let speed = '0B'
        if (item.estimatedEndTime) {
          let remainingTime = (new Date(item.estimatedEndTime) - new Date().getTime()) / 1000
          speed = this.getFormattedSize((item.totalBytes - item.bytesReceived) / remainingTime);
        }
        return speed + '/s';
      } else {
        // 另一种是文件大小不确定【每200ms计算一次，有时可能为0，精度较差】
        return this.getFormattedSize((item.bytesReceived - item.previousBytesReceived) / 0.4) + '/s'
      }
    },

    remaining (item) {
      if (!item.estimatedEndTime) {
        return this.secondContent.replace('{}', '0')
      }

      // 预估剩余时间 - 当前时间 = 剩余时间 (ms)
      let remaining = (new Date(item.estimatedEndTime) - new Date().getTime()) / 1000
      if (remaining <= 0) {
        return this.secondContent.replace('{}', '0')
      } else if (remaining < 60) {
        return this.secondContent.replace('{}', remaining.toFixed(0))
      } else {
        remaining = remaining / 60
        if (remaining < 60) {
          return this.minuteContent.replace('{}', remaining.toFixed(0))
        } else {
          remaining = remaining / 60
          if (remaining < 24) {
            return this.minuteContent.replace('{}', remaining.toFixed(0))
          } else {
            return this.minuteContent.replace('{}', (remaining / 24).toFixed(0))
          }
        }
      }
    },

    // 日期格式化
    dateFormat (time, pattern) {
      const date = new Date(time)
      const o = {
        // 月份
        "M+" : date.getMonth() + 1,
        // 日
        "d+" : date.getDate(),
        // 小时
        "h+" : date.getHours(),
        // 分
        "m+" : date.getMinutes(),
        // 秒
        "s+" : date.getSeconds(),
        // 季度
        "q+" : Math.floor((date.getMonth() + 3) / 3),
        // 毫秒
        "S"  : date.getMilliseconds()
      }

      if(/(y+)/.test(pattern))
        pattern = pattern.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length))
      for(let k in o)
        if(new RegExp("("+ k +")").test(pattern))
          pattern = pattern.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) :
            (("00" + o[k]).substr(("" + o[k]).length)))
      return pattern
    },

    /**
     * 复制内容到剪切板
     * @param text String 需要复制到剪切板的内容，字符串类型
     * @param event 鼠标事件
     */
    copyToClipboard(text, event) {
      this.tipX = event.clientX
      this.tipY = event.clientY
      if (text) {
        this.$copyText(text).then(() => {}, e => {
          // todo
          console.log('failed to copy', e)
        })
      }
    }
  }
}
</script>

<!--suppress CssUnusedSymbol -->
<style scoped rel="stylesheet/scss">
  .home {
    width: 360px;
    height: 377px;
  }

  .header {
    margin: 9px 6px 0 6px;
    display: inline-block;
  }

  .search {
    width: 200px;
  }
  .search >>> .el-input__inner {
    border-radius: 16px;
    height: 24px;
    line-height: 24px;
  }
  .search >>> .el-input__icon.el-icon-search {
    line-height: 24px;
  }

  .header .header-operator {
    float: right;
    margin-left: 64px;
  }

  .icon-button {
    margin: 4px 0 0 10px;
    display: inline-block;
    cursor: pointer;
    font-size: 17px;
    color: grey;
    -webkit-transition: .2s;
    transition: .2s;
  }
  .icon-button:hover {
    color: black;
    font-weight: bold;
    transition: .2s;
  }

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
    width: 6px;
    right: 0;
  }

  /* 下载文件 */
  .file {
    border-radius: 4px;
    border: 1px solid #ebeef5;
    background-color: #fff;
    overflow: hidden;
    color: #303133;
    transition: .3s;
    position: relative;
    height: 70px;
    margin: 6px 6px 8px 6px;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, .1);
    user-select: none;
  }
  .file.gray {
    box-shadow: 0 0 0 0 rgba(0, 0, 0, .1);
  }
  /* 文件图标 */
  .file .icon {
    text-align: center;
    line-height: 86px;
    width: 52px;
    height: 100%;
    border-right: 1px solid #ebeef5;
    float: left;
  }
  .file .icon img {
    height: 24px;
    width: 24px;
  }
  .file .icon img:not([src]) {
    opacity: 0;
  }
  .file.gray .icon img {
    -webkit-filter: grayscale(100%);
    filter: grayscale(100%);
    opacity: 0.7;
  }
  /* 图标上面的进度条 */
  .file .progress {
    position: absolute;
    top: 15px;
    left: 5px;
  }
  .file .progress >>> .el-progress__text {
    display: none;
  }
  /* 文件内容 */
  .file .file-content {
    width: 278px;
    height: 100%;
    float: right;
    padding: 6px 8px 0 0;
  }
  /* 文件名称 */
  .file .filename {
    display: block;
    height: 19px;
    line-height: 19px;
    font-weight: bold;
    font-size: 12px;
    color: #3a8ee6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .file .filename:hover {
    cursor: pointer;
  }
  .file.gray .filename {
    cursor: auto;
    color: gray;
    text-decoration: line-through;
  }
  /* 文件下载链接 */
  .file .file-url {
    display: block;
    height: 19px;
    line-height: 19px;
    font-size: 12px;
    color: gray;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .file .file-url:hover {
    cursor: pointer;
  }
  /* 文件信息栏 */
  .file .info {
    width: 100%;
    height: 24px;
    display: table;
    color: gray;
  }
  .file .info .small-size {
    transition: none;
    font-size: 12px;
    -webkit-transform-origin-x: 0;
    -webkit-transform: scale(.9);
    font-family: Consolas, Microsoft YaHei, serif;
  }
  /* 已下载的大小 */
  .file .info .divider {
    width: 16px;
    text-align: center;
    padding: 0 4px;
  }
  .file .info .cell {
    display: table-cell;
    vertical-align: middle;
  }
  .file .info .left {
    text-align: left;
  }
  .file .info .left.danger {
    width: 176px;
  }
  .file .info .left.common {
    width: 110px;
  }
  .file .info .middle {
    text-align: center;
  }
  .file .info .middle.common {
    width: 72px;
  }
  .file .info .right {
    text-align: right;
  }
  /* 下载危险文件时的操作 */
  .file .info .danger .description {
    color: #ec0000;
    line-height: 16px;
  }
  .file .info .danger .button {
    outline: 0;
    border-radius: 4px;
    height: 20px;
    line-height: 16px;
    border: none;
    cursor: pointer;
  }
  .file .info .danger .cancel {
    color: #fff;
    background-color: #1a73e8;
    border: 1px solid #1a73e8;
  }
  .file .info .danger .button.cancel:hover {
    border-color: #63a5e8;
    background-color: #63a5e8;
  }
  .file .info .danger .accept {
    color: #1a73e8;
    background-color: #fff;
    border: 1px solid #dadce0;
    margin-right: -5px;
  }
  .file .info .danger .button.accept:hover {
    background-color: #d2e3fc;
  }
  /* 内容栏 操作按钮 父元素*/
  .file .content-operator {
    position: absolute;
    top: -2px;
    right: 8px;
    background-color: #fff;
    height: 28px;
    line-height: 36px;
    z-index: 1;
  }
  /* 内容栏 操作按钮*/
  .file .content-operator .icon-button {
    font-size: 14px!important;
    display: none;
  }
  .file:hover .content-operator .icon-button {
    display: inline-block;
  }

  .content >>> .el-backtop {
    right: 16px!important;
    bottom: 20px!important;
  }

</style>
