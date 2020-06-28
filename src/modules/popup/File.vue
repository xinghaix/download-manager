<!--suppress JSUnresolvedVariable, UnterminatedStatementJS -->
<template>
  <transition class="transition" enter-active-class="transition-enter" leave-active-class="transition-leave">
    <div class="file" v-if="show" :class="shouldBeGray(item)" :key="item">
      <div class="icon">
        <Progress v-if="item.state === 'in_progress'" class="progress"
                  :width="42"
                  :loop="item.totalBytes === 0"
                  :paused="item.paused"
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
                <span class="description small-size">{{i18data.dangerDescription}}</span>
              </div>
              <div class="cell right danger">
                <button class="cancel button small-size" @click="cancel(item)">{{i18data.cancel}}</button>
                <button class="accept button small-size" @click="acceptDanger(item)">{{i18data.reserve}}</button>
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
              <span class="size small-size">{{getFormattedSize(item.totalBytes)}}</span>
            </div>
            <div class="cell right common">
              <span class="endTime small-size">{{dateFormat(item.endTime || item.startTime, 'MM/dd hh:mm')}}</span>
            </div>
          </template>
        </div>
      </div>
      <div class="content-operator-wrapper">
        <div class="content-operator">
          <el-tooltip :disabled="closeTooltip" :content="i18data.openFileInFolder"
                      placement="top" effect="dark" popper-class="tooltip" :enterable="false">
            <i class="icon-button el-icon-folder" v-show="openable(item)" @click="showInFolder(item)"/>
          </el-tooltip>
          <el-tooltip :disabled="closeTooltip" :content="item.paused ? i18data.resume : i18data.pause"
                      placement="top" effect="dark" popper-class="tooltip" :enterable="false">
            <i v-show="item.state === 'in_progress'" @click="pauseOrResume(item)"
               class="icon-button" :class="item.paused ? 'el-icon-video-play' : 'el-icon-video-pause'"/>
          </el-tooltip>
          <el-tooltip :disabled="closeTooltip" :content="i18data.delete"
                      placement="top" effect="dark" popper-class="tooltip" :enterable="false">
            <i class="icon-button el-icon-delete" v-show="removable(item)" @click="remove(item)"/>
          </el-tooltip>
          <el-tooltip :disabled="closeTooltip" :content="i18data.retry"
                      placement="top" effect="dark" popper-class="tooltip" :enterable="false">
            <i class="icon-button el-icon-refresh-right" v-show="retryable(item)" @click="retryDownload(item)"/>
          </el-tooltip>
          <el-tooltip :disabled="closeTooltip" :content="i18data.erase"
                      placement="top" effect="dark" popper-class="tooltip" :enterable="false">
            <i class="icon-button el-icon-close" @click="erase(item)"/>
          </el-tooltip>
        </div>
      </div>
    </div>
  </transition>
</template>

<!--suppress JSUnresolvedFunction -->
<script>
  /* eslint-disable no-undef */
  import Progress from "./Progress"

  export default {
    name: "File",
    components: { Progress },
    props: {
      item: {
        type: Object,
        required: true
      },
      timeout: {
        default: 0,
        type: Number
      },
      i18data: {
        type: Object,
        required: true
      },
      closeTooltip: {
        type: Boolean,
        required: true
      },
      leftClickFile: {
        type: Boolean,
        required: true
      },
      leftClickUrl: {
        type: Boolean,
        required: true
      },
      rightClickFile: {
        type: Boolean,
        required: true
      },
      rightClickUrl: {
        type: Boolean,
        required: true
      },
      render: {
        type: Function(),
        required: true
      },
      erase: {
        type: Function(),
        required: true
      },
      copyToClipboard: {
        type: Function(),
        required: true
      }
    },
    mounted() {
      if (this.timeout > 0) {
        setTimeout(() => this.show = true, this.timeout)
      } else {
        this.show = true
      }
    },
    data() {
      return {
        show: false
      }
    },
    methods: {
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

      // 在新标签页中打开下载文件链接
      openUrl(item) {
        chrome.tabs.create({url: item.finalUrl})
      },

      // 打开文件
      openfile(item) {
        if (this.openable(item)) {
          chrome.downloads.open(item.id)
        }
      },

      // 在资源管理器中显示文件
      showInFolder(item) {
        chrome.downloads.show(item.id)
      },

      // 从磁盘中删除文件
      remove(item) {
        chrome.downloads.removeFile(item.id, () => this.erase(item))
      },

      // 暂停或恢复下载
      pauseOrResume(item) {
        if (item.paused) {
          this.resume(item)
        } else {
          this.pause(item)
        }
      },

      // 暂停正在下载中的文件
      pause(item) {
        chrome.downloads.pause(item.id, () => {
          item.paused = true
        })
      },

      // 恢复已经暂停下载中的文件
      resume(item) {
        chrome.downloads.resume(item.id, () => {
          item.paused = false
          this.render()
        })
      },

      /**
       * 重新下载文件
       * @param item {Object}
       */
      retryDownload(item) {
        this.resume(item)
        // common.download(item.url)
      },

      /**
       * 取消正在下载中的文件
       * @param item {Object}
       */
      cancel(item) {
        chrome.downloads.cancel(item.id)
      },

      // 可在资源管理器中打开
      openable(item) {
        return (item.state === 'complete' || item.state === 'in_progress') && item.exists
      },

      // 可从磁盘中删除
      removable(item) {
        return item.state === 'complete' && item.exists
      },

      /**
       * 是否可以重新下载
       * @param item {Object}
       */
      retryable(item) {
        return item.state === 'interrupted'
      },

      // 获取文件下载进度
      getPercentage(item) {
        return item.totalBytes > 0 ? parseInt((100 * item.bytesReceived / item.totalBytes).toString()) : 0
      },

      /**
       * 格式化网速
       * @param bytes {Number}
       * @return {String}
       */
      getFormattedSize(bytes) {
        if (!bytes || bytes <= 0) {
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
      shouldBeGray(item) {
        return !item.exists || item.error ? 'gray' : 'normal'
      },

      // 获取文件实时下载速度
      getSpeed(item) {
        // 文件下载有两种情况
        // 一种是确定文件的总大小
        if (item.totalBytes !== 0) {
          let speed = '0B'
          if (item.estimatedEndTime) {
            let remainingTime = (new Date(item.estimatedEndTime) - new Date().getTime()) / 1000
            if (!isNaN(remainingTime)) {
              speed = this.getFormattedSize((item.totalBytes - item.bytesReceived) / remainingTime);
            }
          }
          return speed + '/s';
        } else {
          // 另一种是文件大小不确定【每300ms计算一次，有时可能为0，精度较差】
          return this.getFormattedSize((item.bytesReceived - item.previousBytesReceived) / (0.3 * 1.6)) + '/s'
        }
      },

      remaining(item) {
        if (!item.estimatedEndTime) {
          return this.i18data.second.replace('{}', '0')
        }

        // 预估剩余时间 - 当前时间 = 剩余时间 (ms)
        let remaining = (new Date(item.estimatedEndTime) - new Date().getTime()) / 1000
        if (isNaN(remaining) || remaining <= 0) {
          return this.i18data.second.replace('{}', '0')
        } else if (remaining < 60) {
          return this.i18data.second.replace('{}', remaining.toFixed(0))
        } else {
          remaining = remaining / 60
          if (remaining < 60) {
            return this.i18data.minute.replace('{}', remaining.toFixed(0))
          } else {
            remaining = remaining / 60
            if (remaining < 24) {
              return this.i18data.hour.replace('{}', remaining.toFixed(0))
            } else {
              return this.i18data.day.replace('{}', (remaining / 24).toFixed(0))
            }
          }
        }
      },

      // 日期格式化
      dateFormat(time, pattern) {
        const date = new Date(time)
        const o = {
          // 月份
          "M+": date.getMonth() + 1,
          // 日
          "d+": date.getDate(),
          // 小时
          "h+": date.getHours(),
          // 分
          "m+": date.getMinutes(),
          // 秒
          "s+": date.getSeconds(),
          // 季度
          "q+": Math.floor((date.getMonth() + 3) / 3),
          // 毫秒
          "S": date.getMilliseconds()
        }

        if (/(y+)/.test(pattern))
          pattern = pattern.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length))
        for (let k in o)
          if (new RegExp("(" + k + ")").test(pattern))
            pattern = pattern.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) :
              (("00" + o[k]).substr(("" + o[k]).length)))
        return pattern
      },
    }
  }
</script>

<!--suppress CssUnusedSymbol -->
<style rel="stylesheet/scss" scoped>
  /* 下载文件 */
  .file {
    width: 350px;
    height: 70px;
    margin: 6px 6px 8px 6px;
    border-radius: 4px;
    border: 1px solid var(--content-file-border-color);
    background-color: var(--content-file-background-color);
    overflow: hidden;
    color: var(--content-file-color);
    position: relative;
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
    border-right: 1px solid var(--content-file-icon-border-right-color);
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
    color: var(--content-file-filename-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .file .filename:hover {
    cursor: pointer;
  }
  .file.gray .filename {
    cursor: auto;
    color: var(--content-file-filename-gray-color);
    text-decoration: line-through;
  }

  /* 文件下载链接 */
  .file .file-url {
    display: block;
    height: 19px;
    line-height: 19px;
    font-size: 12px;
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
  .file .content-operator-wrapper {
    position: absolute;
    top: -2px;
    right: 6px;
    height: 28px;
    line-height: 36px;
    padding-left: 16px;
    background-image: linear-gradient(90deg, rgba(255, 255, 255, 0) 0, var(--content-file-background-color) 24%);
    z-index: 1;
  }
  .file .content-operator {
    position: relative;
    float: right;
  }
  .file .content-operator .icon-button {
    font-size: 14px !important;
  }

  /* 内容栏 操作按钮*/
  .file .content-operator-wrapper {
    display: none;
  }
  .file:hover .content-operator-wrapper {
    display: inline-block;
  }

  /* 图标按钮 */
  .icon-button {
    margin: 4px 0 0 12px;
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

  /* 动画效果 */
  .transition-enter {
    animation: enter .2s ease alternate forwards;
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
    animation: leave .2s ease alternate forwards;
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
