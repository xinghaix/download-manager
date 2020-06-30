<template>
  <div id="app"></div>
</template>

<!--suppress JSUnresolvedVariable, JSUnresolvedFunction, UnterminatedStatementJS -->
<script>
  /* eslint-disable no-undef */
  import storage from "./utils/storage"
  import common from "./utils/common"
  import icon from "./utils/icon"

  export default {
    name: 'app',
    // 插件初始化配置
    async beforeCreate() {
      // 默认设置
      await storage.defaultSettings()

      // 获取主题
      let theme = await storage.get('theme')
      if (theme && theme === 'auto') {
        theme = common.isInDarkMode() ? 'dark' : 'light'
      }
      // 设置图标颜色
      icon.setBrowserActionIcon((await storage.get('icon_color'))[theme], false)

      // 监听浏览器的颜色模式
      // window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
      //   .addEventListener('change', (e) => {
      //   console.log(e, e.matches)
      //   this.isInDarkMode = e.matches
      //   storage.get('theme').then(theme => {
      //     if (theme && theme === 'auto') {
      //       theme = this.isInDarkMode ? 'dark' : 'light'
      //       this.setIcon(this.anyInProgress, theme)
      //     }
      //   })
      // })

      // 由于上述的监听无法在chrome extension的background.html中使用，所以不得不采用以下方式每秒定时获取浏览器的颜色模式。
      setInterval(() => {
        let isDark = common.isInDarkMode()
        if (this.isInDarkMode !== isDark) {
          this.isInDarkMode = isDark
          storage.get('theme').then(theme => {
            if (theme && theme === 'auto') {
              theme = this.isInDarkMode ? 'dark' : 'light'
              storage.get('icon_color').then(iconColor => {
                if (this.anyInProgress) {
                  storage.get('icon_downloading_color').then(iconDownloadingColor => {
                    icon.setColor(iconColor[theme], iconDownloadingColor[theme])
                  })
                } else {
                  icon.setBrowserActionIcon(iconColor[theme], false)
                }
              })
            }
          })
        }
      }, 800)

      // 取消下载时浏览器下方出现的下载信息按钮
      this.disableDownloadBottom()

      this.handleDownloadingNumber(0)
      this.handleDangerousDownloadingNumber(0)
      this.downloadProgress()

      /**
       * 下载通知中按钮事件
       */
      chrome.notifications.onButtonClicked.addListener((notificationId, index) => {
        chrome.notifications.clear(notificationId);

        if (notificationId.indexOf('completed') >= 0) {
          let fileId = parseInt(notificationId.substring(0, notificationId.indexOf('-')))
          if (index === 0) {
            // 下载完成通知中第一个按钮是打开文件
            chrome.downloads.open(fileId)
          } else if (index === 1) {
            // 下载完成通知中第二个按钮是在资源管理器中显示文件位置
            chrome.downloads.show(fileId)
          }
        }
      })

      /**
       * 在文件下载开始时添加监听器
       */
      chrome.downloads.onCreated.addListener((item) => {
        // 浏览器突然停止时，下载中的文件被终止，但是再次打开时此处会出现interrupted的item，所以过滤掉
        if (item.state === 'in_progress') {
          this.downloadProgress()
        }
      })

      /**
       * 如果其他插件或者谷歌浏览器下载界面清除下载文件时，同步搜索数据
       */
      chrome.downloads.onErased.addListener((id) => {
        this.deleteAllDownloadNotificationId(id)
      })

      /**
       * 当点击下载菜单时触发
       */
      chrome.contextMenus.onClicked.addListener((info) => {
        let url
        if (info.menuItemId === 'download-link') {
          url = info.linkUrl
        } else {
          url = info.srcUrl
        }
        common.download(url)
      })

      /**
       * 在启动浏览器时创建浏览器上下文菜单
       */
      storage.get('download_context_menus').then(result => {
        result ? this.createDownloadContextMenus() : this.removeDownloadContextMenus()
      })

      /**
       * 接收来自popup和options发来的数据
       */
      chrome.runtime.onMessage.addListener(message => {
        let received = JSON.parse(message);
        if (received.type) {
          switch (received.type) {
            // 创建或者取消上下文菜单
            case 'downloadMenus':
              received.data ? this.createDownloadContextMenus() : this.removeDownloadContextMenus()
              break
            // 设置图标颜色
            case 'icon_color':
              if (this.anyInProgress) {
                icon.message.color = received.data
              } else {
                icon.setBrowserActionIcon(received.data, false)
              }
              break
            // 设置下载中图标颜色
            case 'icon_downloading_color':
              icon.message.runningColor = received.data
              break
          }
        }
      })
    },
    data() {
      return {
        mediaQueryList: {},

        anyInProgress: false,
        tid: -1,
        downloadingNumber: 0,
        dangerousDownloadingNumber: 0,
        progress: -1,
        downloadMessage: {
          type: 'download',
          data: []
        },

        i18data: common.i18data,

        startedAudio: new Audio('audio/start.mp3'),
        completedAudio: new Audio('audio/completed.wav'),
        warningAudio: new Audio('audio/warning.mp3'),

        notificationList: [],

        contextDownloadMenus: ['link', 'image', 'audio', 'video'],

        isInDarkMode: false
      }
    },
    watch: {
      // 只有当下载文件数量有改动时才重新设置图标badge
      downloadingNumber(val) {
        this.handleDownloadingNumber(val)
      },

      dangerousDownloadingNumber(val) {
        this.handleDangerousDownloadingNumber(val)
      },

      anyInProgress(val) {
        storage.get('theme').then(theme => {
          if (theme && theme === 'auto') {
            theme = this.isInDarkMode ? 'dark' : 'light'
          }

          if (val) {
            storage.get('icon_color').then(iconColor => {
              storage.get('icon_downloading_color').then(iconDownloadingColor => {
                icon.setRunningBrowserActionIcon(iconColor[theme], iconDownloadingColor[theme], val, this.progress)
              })
            })
          } else {
            storage.get('icon_color').then(iconColor => {
              icon.restoreDefaultIcon(iconColor[theme])
            })
          }
        })
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
       * 创建下载相关的上下文菜单
       * 由于存在id字段，所以不存在重复创建的问题
       */
      createDownloadContextMenus() {
        this.contextDownloadMenus.forEach(menus => {
          chrome.contextMenus.create({
            'id': 'download-' + menus,
            'title': this.i18data.prefixMenus + this.i18data[menus],
            'contexts': [menus]
          }, () => {
            if (chrome.runtime.lastError) {
              // todo
            }
          })
        })
      },

      /**
       * 删除下载相关的上下文菜单
       */
      removeDownloadContextMenus() {
        this.contextDownloadMenus.forEach(menus => {
          chrome.contextMenus.remove('download-' + menus, () => {
            if (chrome.runtime.lastError) {
              // todo
            }
          })
        })
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
        chrome.downloads.search({orderBy: ['-startTime']}, (items) => {
          let downloadingNumber = 0
          let dangerousDownloadingNumber = 0
          let anyInProgress = false
          let greaterThanZeroNumber = 0
          let totalProgress = 0.0

          items.forEach((item) => {
            common.beforeHandler(item)
            if (item.state === 'in_progress') {
              downloadingNumber++
              anyInProgress = true

              this.handleDownloadStartedNotification(item)

              if ((item.danger !== 'safe') && (item.danger !== 'accepted')) {
                dangerousDownloadingNumber++
                this.handleDownloadWarningNotification(item)
              }

              let progress = this.getProgress(item)
              if (progress !== -1) {
                greaterThanZeroNumber++
                totalProgress += progress
              }
            } else if (item.state === 'complete') {
              this.handleDownloadCompletedNotification(item)
            } else {
              this.deleteAllDownloadNotificationId(item.id)
            }
          })

          this.anyInProgress = anyInProgress

          // 设置当前所有下载文件总体进度
          if (greaterThanZeroNumber > 0) {
            this.progress = totalProgress / greaterThanZeroNumber
          } else {
            this.progress = -1
          }
          icon.message.progress = this.progress

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
          this.notificationList.push(notificationId)
          this.getIcon(item, (iconUrl) => {
            storage.get('download_started_notification').then(value => {
              if (value) {
                chrome.notifications.getPermissionLevel(level => {
                  if (level === 'granted') {
                    storage.get('download_notification_remain_visible').then(visible => {
                      let option = {
                        type: 'basic',
                        priority: 2,
                        iconUrl: iconUrl || 'img/icon19.png',
                        title: this.i18data.downloadStartedNotification,
                        message: item.basename || item.url,
                        buttons: [{title: this.i18data.deleteNotification}]
                      }
                      visible && common.chromeVersionGreaterThan(50) && (option.requireInteraction = true)
                      chrome.notifications.create(notificationId, option,
                        returnId => this.closeNotification(returnId, option, visible))
                    })
                  }
                })
              }
            })

            storage.get('download_started_tone').then(value => {
              if (value) {
                this.startedAudio.play()
              }
            })
          })
        }
      },

      handleDownloadCompletedNotification(item) {
        let notificationId = item.id + '-completed'
        if (this.notificationList.indexOf(notificationId) < 0
          && this.notificationList.indexOf(item.id + '-started') >= 0) {
          this.notificationList.push(notificationId)
          this.getIcon(item, (iconUrl) => {
            storage.get('download_completed_notification').then(value => {
              if (value) {
                chrome.notifications.getPermissionLevel(level => {
                  if (level === 'granted') {
                    storage.get('download_notification_remain_visible').then(visible => {
                      let option = {
                        type: 'basic',
                        priority: 2,
                        iconUrl: iconUrl || 'img/icon19.png',
                        title: this.i18data.downloadCompletedNotification,
                        message: item.basename || item.url,
                        buttons: [{title: this.i18data.openFile}, {title: this.i18data.openFolderNotification}]
                      }
                      visible && common.chromeVersionGreaterThan(50) && (option.requireInteraction = true)
                      chrome.notifications.create(notificationId, option,
                        returnId => this.closeNotification(returnId, option, visible))
                    })
                  }
                })
              }
            })

            storage.get('download_completed_tone').then(value => {
              if (value) {
                this.completedAudio.play()
              }
            })
          })
        }
      },

      handleDownloadWarningNotification(item) {
        let notificationId = item.id + '-warning'
        if (this.notificationList.indexOf(notificationId) < 0) {
          this.notificationList.push(notificationId)
          this.getIcon(item, (iconUrl) => {
            storage.get('download_warning_notification').then(value => {
              if (value) {
                chrome.notifications.getPermissionLevel(level => {
                  if (level === 'granted') {
                    storage.get('download_notification_remain_visible').then(visible => {
                      let option = {
                        type: 'basic',
                        priority: 2,
                        iconUrl: iconUrl || 'img/icon19.png',
                        title: this.i18data.downloadWarnNotification,
                        message: item.basename || item.url,
                        buttons: [{title: this.i18data.deleteNotification}]
                      }
                      visible && common.chromeVersionGreaterThan(50) && (option.requireInteraction = true)
                      chrome.notifications.create(notificationId, option,
                        returnId => this.closeNotification(returnId, option, visible))
                    })
                  }
                })
              }
            })

            storage.get('download_warning_tone').then(value => {
              if (value) {
                this.warningAudio.play()
              }
            })
          })
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
       * 在指定时间后关闭通知
       * @param id {String} chrome浏览器通知唯一ID
       * @param option {Object}
       * @param visible {boolean}
       */
      closeNotification(id, option, visible) {
        storage.get('download_notification_reserved_time').then(value => {
          if (value !== null && typeof value == 'number' && value >= 0) {
            setTimeout(() => {
              chrome.notifications.clear(id, wasCleared => {
                // 在Win10中，无法清除移入操作中心的通知。等待官方后续解决
                // https://bugs.chromium.org/p/chromium/issues/detail?id=973776
                // 暂时通过创建相同ID的通知然后立刻取消操作来代替清除操作，但也仅尝试操作一次
                if (!wasCleared) {
                  chrome.notifications.getPermissionLevel(level => {
                    if (level === 'granted') {
                      visible && common.chromeVersionGreaterThan(50) && (option.requireInteraction = false)
                      chrome.notifications.create(id, option, returnId => chrome.notifications.clear(returnId))
                    }
                  })
                }
              })
            }, value * 1000)
          }
        })
      },

      /**
       * 获取文件图标
       * @param item {Object}
       * @param callback {function}
       */
      getIcon(item, callback) {
        if (item.iconUrl) {
          callback(item.iconUrl)
        } else {
          common.getCustomFileIcon(item).then(iconUrl => {
            callback(iconUrl)
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
       * 获取文件下载进度
       * @param item
       * @return {number} 下载文件可以提前获取大小的，进度为：0-1（double类型）；不能获取大小的，默认为-1
       */
      getProgress(item) {
        return item.totalBytes != null && item.totalBytes > 0 ?
          parseFloat((1.0 * item.bytesReceived / item.totalBytes).toFixed(2)) : -1
      }
    }
  }
</script>
