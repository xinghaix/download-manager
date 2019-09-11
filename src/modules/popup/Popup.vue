<!--suppress JSDeprecatedSymbols -->
<template>
  <div class="home">
    <div class="header">
      <el-input class="search" size="mini" placeholder="请输入文件名称"
                suffix-icon="el-icon-search" v-model="searchContent">
      </el-input>
      <div class="header-operator">
        <button class="header-button icon-button">
          <i class="el-icon-circle-close" @click="eraseAll"></i>
        </button>
        <button class="header-button icon-button">
          <i class="el-icon-folder" @click="openFolder"></i>
        </button>
        <button class="header-button icon-button">
          <i class="el-icon-setting" @click="openOptions"></i>
        </button>
      </div>
    </div>
    <div class="content">
      <el-scrollbar class="content-scrollbar">
        <div class="file" v-for="item in downloadItems" :key="item">
          <div class="icon">
            <el-progress class="progress" type="circle" stroke-width="3" width="42"
                         v-show="item.state === 'in_progress'"
                         :percentage="getPercentage(item)"></el-progress>
            <img :src="item.iconUrl" alt=""/>
          </div>
          <div class="file-content">
            <div class="filename item">
              <a @click="openfile(item)" class="filename">{{getShortName(item.basename, 32)}}</a>
            </div>
            <div class="file-url item">
              <a @click="openUrl(item)">{{getShortName(item.url, 46)}}</a>
            </div>
          </div>
          <div class="operator">
            <button class="icon-button" v-show="openable(item)">
              <i class="el-icon-folder" @click="showInFolder(item)"></i>
            </button>
            <button class="icon-button" v-show="removable(item)">
              <i class="el-icon-delete" @click="remove(item)"></i>
            </button>
            <button class="icon-button">
              <i class="el-icon-close" @click="erase(item)"></i>
            </button>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <div class="footer">
    </div>
  </div>
</template>

<script>
/* eslint-disable no-undef,no-return-assign */
export default {
  name: 'Popup',
  mounted () {
    // 获取下载文件信息
    this.render()

    // 接收来自background发来的数据
    chrome.runtime.onMessage.addListener((message) => {
      JSON.parse(message).forEach((item) => {
        // 在刚创建下载时，文件名称会为空
        if (item.filename) {
          let tmpItem = this.getItem(item.id)
          if (tmpItem) {
            tmpItem.filename = item.filename
            this.beforeHandler(tmpItem)
            tmpItem.bytesReceived = item.bytesReceived
            tmpItem.totalBytes = item.totalBytes
            tmpItem.state = item.state
          } else {
            this.beforeHandler(item)
            // 插入到第一个位置
            this.downloadItems.splice(0, 0, item)
          }
        }
      })
    })

    // 如果其他插件或者谷歌浏览器下载界面清除下载文件时，同步搜索数据
    chrome.downloads.onErased.addListener((id) => {
      let item = this.getItem(id)
      if (item) {
        this.erase(item)
      }
    })
  },
  data () {
    return {
      searchContent: '',
      downloadItems: []
    }
  },
  watch: {
    searchContent (val) {
      const tmp = val.trim().toLowerCase()
      if (tmp !== '') {
        // 如果搜索内容不为空，那么先把列表内容清空
        this.downloadItems = []
        chrome.downloads.search({}, (items) => {
          items.forEach((item) => {
            this.handleBasename(item)
            // 以小写字母模式模糊匹配搜索的字段
            if (item.basename.toLowerCase().indexOf(tmp) !== -1) {
              this.handleFileIcon(item)
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
      chrome.downloads.search({}, (items) => {
        items.forEach((item) => {
          this.beforeHandler(item)
        })
        this.downloadItems = items
      })
    },

    beforeHandler (item) {
      this.handleBasename(item)
      this.handleFileIcon(item)
    },

    // 将长文件名转成短文件名
    handleBasename (item) {
      if (item.filename) {
        item.basename = item.filename.substring(Math.max(
          item.filename.lastIndexOf('\\'),
          item.filename.lastIndexOf('/')
        ) + 1)
      }
    },

    // 获取文件图标
    handleFileIcon (item) {
      if (item.filename && !item.iconUrl) {
        item.iconUrl = null
        chrome.downloads.getFileIcon(item.id, { size: 32 },
          (iconUrl) => { item.iconUrl = iconUrl })
      }
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
      chrome.tabs.create({ url: item.url })
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

    // 暂停正在下载中的文件
    pause (item) {
      chrome.downloads.pause(item.id)
    },

    // 恢复已经暂停下载中的文件
    resume (item) {
      chrome.downloads.resume(item.id)
    },

    // 取消正在下载中的文件
    cancel (item) {
      chrome.downloads.cancel(item.id)
    },

    // 为了更好地显示文件名和url，截断超出长度的字符串
    getShortName (name, size) {
      return name && name.length > size ? `${name.substring(0, size - 1)}...` : name
    },

    // 可在资源管理器中打开
    openable (item) {
      return (item.state === 'complete' || item.state === 'in_progress') && item.exists
    },

    // 可从磁盘中删除
    removable (item) {
      return item.state === 'complete' && item.exists
    },

    // 获取文件下载进度
    getPercentage (item) {
      return item.totalBytes > 0 ? parseInt((100 * item.bytesReceived / item.totalBytes).toString()) : 0
    }

  }
}
</script>

<!--suppress CssUnusedSymbol -->
<style scoped rel="stylesheet/css">
  .home {
    width: 360px;
    height: 400px;
  }

  .header {
    margin: 6px 6px 0 6px;
  }

  .search {
    width: 200px;
  }
  .search >>> .el-input__inner {
    border-radius: 16px;
  }

  .header .header-button {
    line-height: 2;
    margin-right: 18px;
  }
  .header .header-button i {
    font-size: 17px;
  }
  .header .header-operator {
    float: right;
  }

  .icon-button {
    line-height: 1.5;
    width: 16px;
    border: none;
    background: none;
    outline: 0;
    margin-right: 8px;
    cursor: pointer;
  }
  .icon-button i {
    color: grey;
    font-size: 14px;
    transition: .2s;
  }
  .icon-button i:hover {
    color: black;
    font-weight: bold;
    transition: .2s;
  }

  .content {
    margin-top: 8px;
    height: 340px;
    /*min-height: 50px;*/
    /*max-height: 340px;*/
  }

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
    width: 4px;
    right: 0;
  }

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
  }
  .file .icon-button {
    display: none;
  }
  .file:hover .icon-button {
    display: inline-block;
  }

  .icon {
    text-align: center;
    line-height: 86px;
    width: 54px;
    height: 100%;
    border-right: 1px solid #ebeef5;
    float: left;
  }
  .icon img {
    height: 24px;
    width: 24px;
  }
  .icon img:not([src]) {
    opacity: 0;
  }

  .progress {
    position: absolute;
    top: 15px;
    left: 6px;
  }
  .progress >>> .el-progress__text {
    display: none;
  }

  .file-content {
    width: 280px;
    height: 100%;
    float: right;
  }
  .file-content .item {
    height: 18px;
    margin-top: 8px;
  }

  .filename a {
    font-weight: bold;
    color: #3a8ee6;
    cursor: pointer;
  }
  .filename a:hover {
    text-decoration: underline;
  }

  .operator {
    position: absolute;
    top: 6px;
    right: 2px;
    background-color: white;
    z-index: 1;
  }

  .file-url a {
    cursor: pointer;
    color: gray;
  }
  .file-url a:hover {
    text-decoration: underline;
  }

  .footer {
    /*height: 6px;*/
  }
</style>
