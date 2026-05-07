<!--suppress JSUnresolvedVariable, UnterminatedStatementJS -->
<template>
  <div class="file" :class="shouldBeGray(item)">
    <div class="icon">
      <Progress v-if="item.state === 'in_progress'" class="progress"
                :width="46"
                :loop="item.totalBytes === 0"
                :paused="item.paused"
                :percentage="getPercentage(item)"/>
      <img :src="resolvedIconUrl" alt="" draggable="false"/>
    </div>
    <div class="file-content">
      <span class="filename"
            @click="leftClickFile && openfile(item)"
            @contextmenu.prevent="rightClickFile && copyToClipboard(item.basename, $event)">{{ item.basename }}</span>
      <span class="file-url"
            @click="leftClickUrl && openUrl(item)"
            @contextmenu.prevent="rightClickUrl && copyToClipboard(item.finalUrl || item.url, $event)">{{ item.finalUrl || item.url }}</span>
      <div class="info">
        <template v-if="item.state === 'in_progress'">
          <template v-if="dangerous(item)">
            <div class="cell left danger">
              <span class="description small-size">{{ i18data.dangerDescription }}</span>
            </div>
            <div class="cell right danger">
              <button class="cancel button small-size" @click="cancel(item)">{{ i18data.cancel }}</button>
              <button v-if="canAcceptDanger(item)"
                      class="accept button small-size"
                      @click="acceptDanger(item)">{{ i18data.reserve }}
              </button>
            </div>
          </template>
          <template v-else-if="item.totalBytes !== 0">
            <div class="cell left common">
              <span class="receivedSize small-size">{{ getFormattedSize(item.bytesReceived) }}</span>
              <span class="divider small-size">/</span>
              <span class="size small-size">{{ getFormattedSize(item.totalBytes) }}</span>
            </div>
            <div class="cell middle common">
              <span class="speed small-size">{{ getSpeed(item) }}</span>
            </div>
            <div class="cell right common">
              <span class="remaining small-size">{{ remaining(item) }}</span>
            </div>
          </template>
          <template v-else>
            <div class="cell left common">
              <span class="receivedSize small-size">{{ getFormattedSize(item.bytesReceived) }}</span>
            </div>
            <div class="cell right common">
              <span class="speed small-size">{{ getSpeed(item) }}</span>
            </div>
          </template>
        </template>
        <template v-else>
          <div class="cell left common">
            <span class="size small-size">{{ getFormattedSize(item.totalBytes) }}</span>
          </div>
          <div class="cell right common">
            <span class="endTime small-size">{{ dateFormat(item.endTime || item.startTime, 'MM/dd hh:mm') }}</span>
          </div>
        </template>
      </div>
    </div>
    <div class="content-operator-wrapper">
      <div class="content-operator">
        <el-tooltip :disabled="closeTooltip" :content="i18data.openFileInFolder"
                    placement="top" effect="dark" popper-class="tooltip" :enterable="false">
          <el-icon class="icon-button" v-show="folderOpenable(item)" @click.stop="showInFolder(item)">
            <FolderOpened/>
          </el-icon>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="item.paused ? i18data.resume : i18data.pause"
                    placement="top" effect="dark" popper-class="tooltip" :enterable="false">
          <el-icon v-show="item.state === 'in_progress'" @click.stop="pauseOrResume(item)" class="icon-button">
            <VideoPlay v-if="item.paused"/>
            <VideoPause v-else/>
          </el-icon>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.delete"
                    placement="top" effect="dark" popper-class="tooltip" :enterable="false">
          <el-icon class="icon-button" v-show="removable(item)" @click.stop="remove(item)">
            <Delete/>
          </el-icon>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.retry"
                    placement="top" effect="dark" popper-class="tooltip" :enterable="false">
          <el-icon class="icon-button" v-show="retryable(item)" @click.stop="retryDownload(item)">
            <RefreshRight/>
          </el-icon>
        </el-tooltip>
        <el-tooltip :disabled="closeTooltip" :content="i18data.erase"
                    placement="top" effect="dark" popper-class="tooltip" :enterable="false">
          <el-icon class="icon-button" @click.stop="erase(item)">
            <Close/>
          </el-icon>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<!--suppress JSUnresolvedFunction -->
<script>
/* eslint-disable no-undef */
import {Close, Delete, FolderOpened, RefreshRight, VideoPause, VideoPlay} from '@element-plus/icons-vue'
import Progress from './Progress'
import {canAcceptDanger as canAcceptDangerDownload, isDangerousDownload} from '../../utils/downloadDanger'
import common from '../../utils/common'
import { getCachedFileIcon, setCachedFileIcon } from '../../utils/fileIconCache'

export default {
  name: 'File',
  components: {Close, Delete, FolderOpened, Progress, RefreshRight, VideoPause, VideoPlay},
  props: {
    item: {
      type: Object,
      required: true
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
      type: Function,
      required: true
    },
    erase: {
      type: Function,
      required: true
    },
    copyToClipboard: {
      type: Function,
      required: true
    }
  },
  mounted() {
    this.syncResolvedIconUrl()
    this.ensureFileIcon()
  },
  watch: {
    'item.id'() {
      this.syncResolvedIconUrl()
      this.ensureFileIcon()
    },
    'item.filename'() {
      this.ensureFileIcon()
    }
  },
  data() {
    return {
      resolvedIconUrl: null,
      iconLoading: false
    }
  },
  methods: {
    syncResolvedIconUrl() {
      const cachedIconUrl = getCachedFileIcon(this.item?.id)
      this.resolvedIconUrl = cachedIconUrl || this.item?.iconUrl || null
    },

    ensureFileIcon() {
      if (!this.item || !this.item.filename) {
        return
      }

      const cachedIconUrl = getCachedFileIcon(this.item.id)
      if (cachedIconUrl) {
        this.resolvedIconUrl = cachedIconUrl
        return
      }

      if (this.item.iconUrl) {
        this.resolvedIconUrl = this.item.iconUrl
        setCachedFileIcon(this.item.id, this.item.iconUrl)
        return
      }

      if (this.iconLoading) {
        return
      }

      this.resolvedIconUrl = null
      this.iconLoading = true

      common.getCustomFileIcon(this.item).then(iconUrl => {
        this.resolvedIconUrl = iconUrl || null
        if (iconUrl) {
          setCachedFileIcon(this.item.id, iconUrl)
        }
      }).finally(() => {
        this.iconLoading = false
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
    async acceptDanger(item) {
      if (!this.canAcceptDanger(item)) {
        return
      }

      try {
        await chrome.downloads.acceptDanger(item.id)
        this.render()
      } catch (e) {
        console.warn('acceptDanger failed', item?.danger, e)
      }
    },

    /**
     * 是否是正在下载危险文件
     * @param item {Object}
     */
    dangerous(item) {
      return isDangerousDownload(item)
    },

    canAcceptDanger(item) {
      return canAcceptDangerDownload(item)
    },

    // 在新标签页中打开下载文件链接
    openUrl(item) {
      chrome.tabs.create({url: item.finalUrl})
    },

    // 打开文件
    openfile(item) {
      if (this.fileOpenable(item)) {
        try {
          const result = chrome.downloads.open(item.id)
          this.watchDownloadAction('open file', result)
        } catch (error) {
          this.handleDownloadActionError('open file', error)
        }
      }
    },

    // 在资源管理器中显示文件
    showInFolder(item) {
      if (!this.folderOpenable(item)) {
        return
      }

      try {
        const result = chrome.downloads.show(item.id)
        this.watchDownloadAction('show file in folder', result)
      } catch (error) {
        this.handleDownloadActionError('show file in folder', error)
      }
    },

    watchDownloadAction(action, result) {
      if (result && typeof result.catch === 'function') {
        result.catch(error => this.handleDownloadActionError(action, error))
      }
    },

    handleDownloadActionError(action, error) {
      console.warn(`${action} failed`, error)
      this.render()
    },

    // 从磁盘中删除文件
    remove(item) {
      chrome.downloads.removeFile(item.id, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          this.render()
          return
        }
        item.exists = false
        this.erase(item)
      })
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
        if (chrome.runtime && chrome.runtime.lastError) {
          this.render()
          return
        }
        item.paused = true
      })
    },

    // 恢复已经暂停下载中的文件
    resume(item) {
      chrome.downloads.resume(item.id, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          this.render()
          return
        }
        item.paused = false
        this.render()
      })
    },

    /**
     * 重新下载文件
     * @param item {Object}
     */
    async retryDownload(item) {
      if (item.canResume) {
        this.resume(item)
        return
      }

      const retryUrl = item.url || item.finalUrl
      if (retryUrl) {
        const downloadId = await common.download(retryUrl)
        if (downloadId !== null) {
          await this.render()
          setTimeout(() => {
            this.render()
          }, 500)
        }
      }
    },

    /**
     * 取消正在下载中的文件
     * @param item {Object}
     */
    cancel(item) {
      chrome.downloads.cancel(item.id, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          this.render()
        }
      })
    },

    // 可在资源管理器中打开
    folderOpenable(item) {
      return (item.state === 'complete' || item.state === 'in_progress') && item.exists
    },

    // 可打开文件
    fileOpenable(item) {
      return item.state === 'complete' && item.exists
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
      return item.state === 'interrupted' && (!!item.canResume || !!item.url)
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
        // 另一种是文件大小不确定【每400ms计算一次，有时可能为0，精度较差】
        return this.getFormattedSize((item.bytesReceived - item.previousBytesReceived) / (0.4 * 1.6)) + '/s'
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
  height: 76px;
  border-radius: 5px;
  margin-right: 3px;
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
  width: 56px;
  height: 100%;
  border-right: 1px solid var(--content-file-icon-border-right-color);
  float: left;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file .icon img {
  height: 26px;
  width: 26px;
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
  top: 14px;
  left: 5px;
}

/* 文件内容 */
.file .file-content {
  width: calc(100% - 74px);
  float: right;
  padding: 8px 8px 0 0;
}

/* 文件名称 */
.file .filename {
  display: block;
  height: 20px;
  line-height: 20px;
  font-weight: bold;
  font-size: 13px;
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
  height: 20px;
  line-height: 20px;
  font-size: 13px;
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
  height: 26px;
  display: table;
}

.file .info .small-size {
  transition: none;
  font-size: 12px;
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
  width: 118px;
}

.file .info .middle {
  text-align: center;
}

.file .info .middle.common {
  width: 80px;
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
  border-radius: 11px;
  height: 22px;
  line-height: 18px;
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
  margin-right: -4px;
}

.file .info .danger .button.accept:hover {
  background-color: #d2e3fc;
}

/* 内容栏 操作按钮 父元素*/
.file .content-operator-wrapper {
  position: absolute;
  top: 0;
  right: 8px;
  height: 30px;
  line-height: 38px;
  padding-left: 18px;
  background-image: linear-gradient(90deg, rgba(255, 255, 255, 0) 0, var(--content-file-background-color) 24%);
  z-index: 1;
}

.file .content-operator {
  position: relative;
  float: right;
}

.file .content-operator .icon-button {
  width: 24px;
  height: 24px;
  margin: 0 0 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  font-size: 14px !important;
  color: var(--header-icon-color);
  background-color: transparent;
  box-shadow: inset 0 0 0 1px transparent;
  transition: background-color .18s ease, box-shadow .18s ease, color .18s ease;
  box-sizing: border-box;
}

.file .content-operator .icon-button:hover,
.file .content-operator .icon-button:focus-visible {
  color: var(--header-icon-hover-color);
  background-color: rgba(127, 127, 127, 0.12);
  box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.18);
}

.file .content-operator .icon-button:active {
  background-color: rgba(127, 127, 127, 0.18);
  box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.24);
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
  margin: 0;
  display: inline-flex;
  cursor: pointer;
  font-size: 18px;
  color: var(--header-icon-color);
  -webkit-transition: .2s;
  transition: .2s;
}

.icon-button:hover {
  color: var(--header-icon-hover-color);
  background-color: rgba(127, 127, 127, 0.12);
  box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.18);
  transition: .2s;
}

.icon-button:active {
  background-color: rgba(127, 127, 127, 0.18);
  box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.24);
}

.icon-button:focus-visible {
  color: var(--header-icon-hover-color);
  background-color: rgba(127, 127, 127, 0.12);
  box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.18);
  transition: .2s;
}
</style>
