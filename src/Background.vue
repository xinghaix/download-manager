<template>
  <div id="app"></div>
</template>

<!--suppress JSUnresolvedVariable, JSUnresolvedFunction, UnterminatedStatementJS -->
<script>
  /* eslint-disable no-undef */
  import storage from "./utils/storage"
  import common from "./utils/common";

  export default {
    name: 'app',
    // 插件初始化配置
    mounted() {
      storage.defaultSettings()

      // 取消下载时浏览器下方出现的下载信息按钮
      this.disableDownloadBottom()

      this.handleDownloadingNumber(0)
      this.handleDangerousDownloadingNumber(0)

      // 下载通知中按钮事件
      chrome.notifications.onButtonClicked.addListener((notificationId, index) => {
        chrome.notifications.clear(notificationId);

        if (index === 1 && notificationId.indexOf('completed') >= 0) {
          // 下载完成通知中第二个按钮是在资源管理器中显示文件位置
          chrome.downloads.show(parseInt(notificationId.substring(0, notificationId.indexOf('-'))))
        }
      })

      // 在文件下载开始时添加监听器
      chrome.downloads.onCreated.addListener((item) => {
        // 浏览器突然停止时，下载中的文件被终止，但是再次打开时此处会出现interrupted的item，所以过滤掉
        if (item.state === 'in_progress') {
          this.downloadProgress()
        }
      })

      // 如果其他插件或者谷歌浏览器下载界面清除下载文件时，同步搜索数据
      chrome.downloads.onErased.addListener((id) => {
        this.deleteAllDownloadNotificationId(id)
      })
    },
    data() {
      return {
        anyInProgress: false,
        tid: -1,
        downloadingNumber: 0,
        dangerousDownloadingNumber: 0,
        downloadMessage: {
          type: 'download',
          data: []
        },

        audio: new Audio('audio/completed.wav'),

        notificationList: [],

        deleteNotification: common.loadI18nMessage('deleteNotification'),
        downloadCompletedNotification: common.loadI18nMessage('downloadCompletedNotification'),
        openFolderNotification: common.loadI18nMessage('openFolderNotification'),

        downloadNotificationSetting1: common.loadI18nMessage('downloadNotificationSetting1'),
        downloadNotificationSetting2: common.loadI18nMessage('downloadNotificationSetting2'),
        downloadNotificationSetting3: common.loadI18nMessage('downloadNotificationSetting3'),
      }
    },
    watch: {
      // 只有当下载文件数量有改动时才重新设置图标badge
      downloadingNumber(val) {
        this.handleDownloadingNumber(val)
      },
      dangerousDownloadingNumber(val) {
        this.handleDangerousDownloadingNumber(val)
      }
    },
    methods: {
      /**
       * 禁用每次下载时页面浏览器下方的下载进度提示
       */
      disableDownloadBottom() {
        if (chrome.downloads.setShelfEnabled) {
          chrome.downloads.setShelfEnabled(false)
        }
      },

      /**
       * 处理正在下载文件的数量
       * @param num {Number}
       */
      handleDownloadingNumber(num) {
        this.setBrowserBadge(num <= 0 ? '' : num)
      },

      /**
       * 处理正在下载危险文件的数量
       * @param num {Number}
       */
      handleDangerousDownloadingNumber(num) {
        if (num > 0) {
          // 在下载危险文件时，将图标正在下载中的数字背景设置为红色
          chrome.browserAction.setBadgeBackgroundColor({color: '#FF0000'})
        } else {
          // 确认下载危险文件时，将图标正在下载中的数字背景重新设置为蓝色
          chrome.browserAction.setBadgeBackgroundColor({color: '#4285F4'})
        }
      },

      /**
       * 文件下载进程
       */
      downloadProgress() {
        this.tid = -1
        this.anyInProgress = false
        chrome.downloads.search({orderBy: ['-startTime']}, (items) => {
          let downloadingNumber = 0
          let dangerousDownloadingNumber = 0
          items.forEach((item) => {
            common.beforeHandler(item)
            if (item.state === 'in_progress') {
              downloadingNumber++
              this.anyInProgress = true

              this.handleDownloadStartedNotification(item)

              if ((item.danger !== 'safe') && (item.danger !== 'accepted')) {
                dangerousDownloadingNumber++
                this.handleDownloadWarningNotification(item)
              }
            } else if (item.state === 'complete') {
              this.handleDownloadCompletedNotification(item)
            } else {
              this.deleteAllDownloadNotificationId(item.id)
            }
          })

          // icon右小角显示正在下载中的文件数量
          this.downloadingNumber = downloadingNumber

          this.dangerousDownloadingNumber = dangerousDownloadingNumber

          // 使用vue.set更新数据
          this.$set(this.downloadMessage, 'data', items)

          // 发送数据到popup
          chrome.runtime.sendMessage(JSON.stringify(this.downloadMessage))

          if (this.anyInProgress && this.tid < 0) {
            while (this.tid < 0) {
              this.tid = setTimeout(this.downloadProgress, 300)
            }
          }
        })
      },

      handleDownloadStartedNotification(item) {
        let notificationId = item.id + '-started'
        if (this.notificationList.indexOf(notificationId) < 0) {
          if (item.basename) {
            this.notificationList.push(notificationId)
            this.getIcon(item, () => {
              storage.getDownloadStartedNotification().then(value => {
                if (value) {
                  chrome.notifications.getPermissionLevel(level => {
                    if (level === 'granted') {
                      chrome.notifications.create(notificationId, {
                          type: 'basic',
                          iconUrl: item.iconUrl || 'img/icon19.png',
                          title: this.downloadNotificationSetting1,
                          message: item.basename,
                          buttons: [{title: this.deleteNotification}]
                        },
                        // eslint-disable-next-line no-unused-vars
                        returnId => {
                        })
                    }
                  })
                }
              })
            })
          }
        }
      },

      handleDownloadCompletedNotification(item) {
        let notificationId = item.id + '-completed'
        if (this.notificationList.indexOf(notificationId) < 0
          && this.notificationList.indexOf(item.id + '-started') >= 0) {
          if (item.basename) {
            this.notificationList.push(notificationId)
            this.getIcon(item, () => {
              storage.getDownloadCompletedNotification().then(value => {
                if (value) {
                  chrome.notifications.getPermissionLevel(level => {
                    if (level === 'granted') {
                      chrome.notifications.create(notificationId, {
                          type: 'basic',
                          iconUrl: item.iconUrl || 'img/icon19.png',
                          title: this.downloadNotificationSetting2,
                          message: item.basename,
                          buttons: [{title: this.deleteNotification}, {title: this.openFolderNotification}]
                        },
                        // eslint-disable-next-line no-unused-vars
                        returnId => {
                        })
                    }
                  })
                }
              })

              storage.getDownloadCompletionTone().then(value => {
                if (value) {
                  this.audio.play()
                }
              })
            })
          }
        }
      },

      handleDownloadWarningNotification(item) {
        let notificationId = item.id + '-warning'
        if (this.notificationList.indexOf(notificationId) < 0) {
          if (item.basename) {
            this.notificationList.push(notificationId)
            this.getIcon(item, () => {
              storage.getDownloadWarningNotification().then(value => {
                if (value) {
                  chrome.notifications.getPermissionLevel(level => {
                    if (level === 'granted') {
                      chrome.notifications.create(notificationId, {
                          type: 'basic',
                          iconUrl: item.iconUrl || 'img/icon19.png',
                          title: this.downloadNotificationSetting3,
                          message: item.basename,
                          buttons: [{title: this.deleteNotification}]
                        },
                        // eslint-disable-next-line no-unused-vars
                        returnId => {
                        })
                    }
                  })
                }
              })
            })
          }
        }
      },

      /**
       * 删除所有指定ID的通知
       * @param item {Object}
       */
      deleteAllDownloadNotificationId(item) {
        this.deleteDownloadStartedNotificationId(item.id)
        this.deleteDownloadCompletedNotificationId(item.id)
        this.deleteDownloadWarningNotificationId(item.id)
      },

      /**
       * 删除之前已经存在的下载开始通知，避免占用新文件的id
       * @param id
       */
      deleteDownloadStartedNotificationId(id) {
        let index = this.notificationList.indexOf(id + '-started')
        if (index >= 0) {
          this.notificationList.splice(index, 1)
        }
      },

      /**
       * 删除之前已经存在的下载完成通知，避免占用新文件的id
       * @param id
       */
      deleteDownloadCompletedNotificationId(id) {
        let index = this.notificationList.indexOf(id + '-completed')
        if (index >= 0) {
          this.notificationList.splice(index, 1)
        }
      },

      /**
       * 删除之前已经存在的下载报警通知，避免占用新文件的id
       * @param id
       */
      deleteDownloadWarningNotificationId(id) {
        let index = this.notificationList.indexOf(id + '-warning')
        if (index >= 0) {
          this.notificationList.splice(index, 1)
        }
      },

      /**
       * 获取文件图标
       * @param item {Object}
       * @param callback {function}
       */
      getIcon(item, callback) {
        if (item.iconUrl) {
          callback()
        } else {
          common.getCustomFileIcon(item).then(iconUrl => {
            item.iconUrl = iconUrl
            callback()
          })
        }
      },

      /**
       * 设置图标右上角显示的正在下载中文件的数量
       * @param number {Number}
       */
      setBrowserBadge(number) {
        let text = ''
        if (number > 0) {
          if (number >= 100) {
            text = '99+'
          } else {
            text = number.toString()
          }
        }
        chrome.browserAction.setBadgeText({text: text})
      },

      /**
       * 获取当前正在活动的页面
       * @return {Promise<Object>}
       */
      getCurrentTab() {
        return new Promise(resolve => {
          chrome.tabs.query({active: true, currentWindow: true}, tabs => {
            if (tabs && tabs.length > 0) {
              resolve(tabs[0])
            }
          })
        })
      },

      /**
       * 在页面里发送开始下载消息通知
       * @param item {Object} downloadItem
       */
      sendDownloadStartMessage(item) {
        this.getCurrentTab().then(tab => {
          chrome.tabs.executeScript(tab.id, {
              // code: this.$notify.info({
              //   title: '下载开始',
              //   message: item.filename
              // })
              code: window.alert("下载开始! " + item.filename)
            }, () => {
            // 可能某些页面没有权限执行脚本
            if (chrome.runtime.lastError) {
              // todo
            }
          })
        })
      },

    }
  }
</script>
