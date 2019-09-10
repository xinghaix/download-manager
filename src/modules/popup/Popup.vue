<template>
  <div class="home">
    <el-input class="search" size="mini" placeholder="请输入内容"
              suffix-icon="el-icon-search" v-model="searchContent">
    </el-input>
    <div style="float: right">
      <button class="icon-button header-button">
        <i class="el-icon-circle-close" @click="eraseAll"></i>
      </button>
      <button class="icon-button header-button">
        <i class="el-icon-folder" @click="openFolder"></i>
      </button>
      <button class="icon-button header-button">
        <i class="el-icon-setting" @click="openOptions"></i>
      </button>
    </div>

    <div class="content">
      <el-scrollbar class="content-scrollbar">
        <template v-for="item in downloadItems">
          <div class="file">
            <el-progress class="progress" type="circle" stroke-width="3" width="43"
                         v-show="item.state === 'in_progress'"
                         :percentage="getPercentage(item)"></el-progress>
            <div class="file-img" :class="item.state">
              <img :src="item.iconUrl" alt=""/>
            </div>
            <div class="file-content">
              <div class="filename item">
                <a @click="openfile(item)" class="filename">{{getShortName(item.basename, 40)}}</a>
              </div>
              <div class="file-url item">
                <a @click="openUrl(item)">{{getShortName(item.url, 50)}}</a>
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
        </template>
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
      const tmp = JSON.parse(message)
      tmp.forEach((item) => {
        this.beforeHandler(item)
      })
      this.downloadItems = tmp
      // this.downloadItems = JSON.parse(message)
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
    // 获取所有下载文件列表
    render () {
      chrome.downloads.search({}, (items) => {
        items.forEach((item) => {
          // 调用background中的方法
          this.beforeHandler(item)
        })
        this.downloadItems = items
        console.log(this.downloadItems)
      })
    },

    beforeHandler (item) {
      if (item.filename) {
        this.handleBasename(item)
        this.handleFileIcon(item)
      }
    },

    // 将长文件名转成短文件名
    handleBasename (item) {
      item.basename = item.filename.substring(Math.max(
        item.filename.lastIndexOf('\\'),
        item.filename.lastIndexOf('/')
      ) + 1)
    },

    // 获取文件图标
    handleFileIcon (item) {
      item.iconUrl = null
      chrome.downloads.getFileIcon(item.id, { size: 32 }, (iconUrl) => { item.iconUrl = iconUrl })
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
      chrome.downloads.open(item.id)
    },
    // 在资源管理器中显示文件
    showInFolder (item) {
      chrome.downloads.show(item.id)
    },

    // 从磁盘中删除文件
    remove (item) {
      try {
        chrome.downloads.removeFile(item.id, () => this.erase(item))
      } catch (e) {}
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
      return this.openable(item)
    },

    // 获取文件下载进度
    getPercentage (item) {
      console.log(item.bytesReceived, item.totalBytes)
      return item.totalBytes > 0 ? parseInt((100 * item.bytesReceived / item.totalBytes).toString()) : 0
    }

  }
}
</script>

<!--suppress CssUnusedSymbol -->
<style scoped rel="stylesheet/css">
  .home {
    padding: 6px 0 6px 6px;
    width: 360px;
    height: 400px;
  }

  .search {
    width: 200px;
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

  .header-button {
    line-height: 2;
    margin-right: 18px;
  }
  .header-button i {
    font-size: 17px;
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
    width: 8px;
    right: 0;
  }

  .file {
    position: relative;
    height: 62px;
    margin: 8px 0 2px 0;
    padding: 4px;
  }
  .file:hover {
    box-shadow: 0 0 12px 2px rgba(0, 0, 0, .1);
  }
  .file .icon-button {
    display: none;
  }
  .file:hover .icon-button {
    display: inline-block;
  }

  .file-img {
    float: left;
    width: 42px;
    height: 100%;
    line-height: 82px;
  }
  .file-img.in_progress {
    line-height: 78px;
  }
  .file-img img {
    margin-left: 1px;
    height: 32px;
    width: 32px;
    transition: .3s;
  }
  .file-img.in_progress img {
    margin-left: 4px;
    height: 28px;
    width: 28px;
    transition: .4s;
  }

  .file-content {
    width: 310px;
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
    top: 10px;
    right: 6px;
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

  .progress {
    position: absolute;
    top: 12px;
    left: 0;
    z-index: -1;
  }

  .footer {
    /*height: 6px;*/
  }
</style>
