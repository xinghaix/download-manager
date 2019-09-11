<template>
  <div id="app"></div>
</template>

<script>
/* eslint-disable no-undef */
export default {
  name: 'app',
  mounted () {
    this.disableDownloadBottom()
    // 在文件下载开始时添加
    chrome.downloads.onCreated.addListener(() => {
      this.downloadProgress()
    })
    this.downloadProgress()
  },
  data () {
    return {
      anyInProgress: false,
      tid: -1
    }
  },
  methods: {
    // 禁用每次下载时页面浏览器下方的下载进度提示
    disableDownloadBottom () {
      if (chrome.downloads.setShelfEnabled) {
        chrome.downloads.setShelfEnabled(false)
      }
    },

    // 文件下载进度条
    downloadProgress () {
      this.tid = -1
      this.anyInProgress = false
      chrome.downloads.search({orderBy: ['-startTime']}, (items) => {
        items.forEach((item) => {
          if (item.state === 'in_progress') {
            this.anyInProgress = true
          }
        })

        // 发送数据到popup
        chrome.runtime.sendMessage(JSON.stringify(items))

        if (this.anyInProgress && this.tid < 0) {
          while (this.tid < 0) {
            this.tid = setTimeout(this.downloadProgress, 200)
          }
        }
      })
    }
  }
}
</script>
