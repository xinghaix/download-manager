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

      let all = ''
      for (let points of this.jsonData.data.cmScopes) {
        for (let point of points) {
          all += point.lon + ',' + point.lat + ';'
        }
        all += '|'
      }
      console.log(all)

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
      this.handleDangerousDownloading(false)
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
      chrome.downloads.onCreated.addListener(item => {
        console.log(item)
        // 浏览器突然停止时，下载中的文件被终止，但是再次打开时此处会出现interrupted的item，所以过滤掉
        if (item.state === 'in_progress') {
          this.downloadProgress()
        }
      })

      /**
       * 修改文件路径
       */
      // chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
      //   let filename = item.filename
      //   let urlName = new URL(item.url).searchParams.get("filename")
      //   if (urlName && urlName.length > 0) {
      //     filename = urlName
      //   }
      //
      //   suggest({
      //     filename: 'files/' + filename,
      //     conflictAction: "uniquify"
      //   })
      // })

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
        anyInDangerous: false,
        tid: -1,
        downloadingNumber: 0,
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

        isInDarkMode: false,

        jsonData: {
          "code": 200,
          "message": "操作成功",
          "data": {
            "cmScopes": [
              [
                {
                  "lon": 116.0175,
                  "lat": 25.0956
                },
                {
                  "lon": 114.2301,
                  "lat": 25.0956
                },
                {
                  "lon": 114.2301,
                  "lat": 24.9158
                },
                {
                  "lon": 116.2161,
                  "lat": 24.9158
                },
                {
                  "lon": 116.2161,
                  "lat": 25.0956
                },
                {
                  "lon": 116.0175,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 117.1496,
                  "lat": 38.5806
                },
                {
                  "lon": 118.7638,
                  "lat": 38.5806
                },
                {
                  "lon": 118.7638,
                  "lat": 38.7604
                },
                {
                  "lon": 108.6174,
                  "lat": 38.7604
                },
                {
                  "lon": 108.6174,
                  "lat": 38.5806
                },
                {
                  "lon": 117.1496,
                  "lat": 38.5806
                }
              ],
              [
                {
                  "lon": 83.7922,
                  "lat": 44.8736
                },
                {
                  "lon": 83.7922,
                  "lat": 45.0534
                },
                {
                  "lon": 86.0836,
                  "lat": 45.0534
                },
                {
                  "lon": 86.0836,
                  "lat": 44.8736
                },
                {
                  "lon": 83.7922,
                  "lat": 44.8736
                }
              ],
              [
                {
                  "lon": 108.6358,
                  "lat": 40.019
                },
                {
                  "lon": 107.6966,
                  "lat": 40.019
                },
                {
                  "lon": 107.6966,
                  "lat": 39.8392
                },
                {
                  "lon": 120.3758,
                  "lat": 39.8392
                },
                {
                  "lon": 120.3758,
                  "lat": 40.019
                },
                {
                  "lon": 108.6358,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 118.0175,
                  "lat": 34.8048
                },
                {
                  "lon": 120.4265,
                  "lat": 34.8048
                },
                {
                  "lon": 120.4265,
                  "lat": 34.625
                },
                {
                  "lon": 103.7825,
                  "lat": 34.625
                },
                {
                  "lon": 103.7825,
                  "lat": 34.8048
                },
                {
                  "lon": 118.0175,
                  "lat": 34.8048
                }
              ],
              [
                {
                  "lon": 95.9125,
                  "lat": 36.423
                },
                {
                  "lon": 94.5685,
                  "lat": 36.423
                },
                {
                  "lon": 94.5685,
                  "lat": 36.6028
                },
                {
                  "lon": 96.1365,
                  "lat": 36.6028
                },
                {
                  "lon": 96.1365,
                  "lat": 36.423
                },
                {
                  "lon": 95.9125,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 110.9524,
                  "lat": 33.0068
                },
                {
                  "lon": 121.6774,
                  "lat": 33.0068
                },
                {
                  "lon": 121.6774,
                  "lat": 32.827
                },
                {
                  "lon": 110.9524,
                  "lat": 32.827
                },
                {
                  "lon": 110.9524,
                  "lat": 33.0068
                }
              ],
              [
                {
                  "lon": 107.0854,
                  "lat": 28.5118
                },
                {
                  "lon": 109.5454,
                  "lat": 28.5118
                },
                {
                  "lon": 109.5454,
                  "lat": 28.6916
                },
                {
                  "lon": 105.0354,
                  "lat": 28.6916
                },
                {
                  "lon": 105.0354,
                  "lat": 28.5118
                },
                {
                  "lon": 107.0854,
                  "lat": 28.5118
                }
              ],
              [
                {
                  "lon": 115.4021,
                  "lat": 27.433
                },
                {
                  "lon": 117.0229,
                  "lat": 27.433
                },
                {
                  "lon": 117.0229,
                  "lat": 27.2532
                },
                {
                  "lon": 113.5787,
                  "lat": 27.2532
                },
                {
                  "lon": 113.5787,
                  "lat": 27.433
                },
                {
                  "lon": 115.4021,
                  "lat": 27.433
                }
              ],
              [
                {
                  "lon": 81.3429,
                  "lat": 41.0978
                },
                {
                  "lon": 81.5816,
                  "lat": 41.0978
                },
                {
                  "lon": 81.5816,
                  "lat": 40.918
                },
                {
                  "lon": 80.8655,
                  "lat": 40.918
                },
                {
                  "lon": 80.8655,
                  "lat": 41.0978
                },
                {
                  "lon": 81.3429,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 120.4104,
                  "lat": 28.5118
                },
                {
                  "lon": 122.2554,
                  "lat": 28.5118
                },
                {
                  "lon": 122.2554,
                  "lat": 28.6916
                },
                {
                  "lon": 116.9254,
                  "lat": 28.6916
                },
                {
                  "lon": 116.9254,
                  "lat": 28.5118
                },
                {
                  "lon": 120.4104,
                  "lat": 28.5118
                }
              ],
              [
                {
                  "lon": 116.8703,
                  "lat": 24.3764
                },
                {
                  "lon": 115.2903,
                  "lat": 24.3764
                },
                {
                  "lon": 115.2903,
                  "lat": 24.1966
                },
                {
                  "lon": 118.8453,
                  "lat": 24.1966
                },
                {
                  "lon": 118.8453,
                  "lat": 24.3764
                },
                {
                  "lon": 116.8703,
                  "lat": 24.3764
                }
              ],
              [
                {
                  "lon": 116.6596,
                  "lat": 29.7704
                },
                {
                  "lon": 122.4724,
                  "lat": 29.7704
                },
                {
                  "lon": 122.4724,
                  "lat": 29.9502
                },
                {
                  "lon": 115.414,
                  "lat": 29.9502
                },
                {
                  "lon": 115.414,
                  "lat": 29.7704
                },
                {
                  "lon": 116.6596,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 120.4908,
                  "lat": 45.5928
                },
                {
                  "lon": 122.0376,
                  "lat": 45.5928
                },
                {
                  "lon": 122.0376,
                  "lat": 45.7726
                },
                {
                  "lon": 120.4908,
                  "lat": 45.7726
                },
                {
                  "lon": 120.4908,
                  "lat": 45.5928
                }
              ],
              [
                {
                  "lon": 125.6878,
                  "lat": 49.009
                },
                {
                  "lon": 124.8652,
                  "lat": 49.009
                },
                {
                  "lon": 124.8652,
                  "lat": 48.8292
                },
                {
                  "lon": 127.333,
                  "lat": 48.8292
                },
                {
                  "lon": 127.333,
                  "lat": 49.009
                },
                {
                  "lon": 125.6878,
                  "lat": 49.009
                }
              ],
              [
                {
                  "lon": 120.025,
                  "lat": 30.6694
                },
                {
                  "lon": 122.116,
                  "lat": 30.6694
                },
                {
                  "lon": 122.116,
                  "lat": 30.4896
                },
                {
                  "lon": 115.6339,
                  "lat": 30.4896
                },
                {
                  "lon": 115.6339,
                  "lat": 30.6694
                },
                {
                  "lon": 120.025,
                  "lat": 30.6694
                }
              ],
              [
                {
                  "lon": 112.5483,
                  "lat": 28.1522
                },
                {
                  "lon": 115.6083,
                  "lat": 28.1522
                },
                {
                  "lon": 115.6083,
                  "lat": 27.9724
                },
                {
                  "lon": 111.1203,
                  "lat": 27.9724
                },
                {
                  "lon": 111.1203,
                  "lat": 28.1522
                },
                {
                  "lon": 112.5483,
                  "lat": 28.1522
                }
              ],
              [
                {
                  "lon": 127.187,
                  "lat": 44.1544
                },
                {
                  "lon": 124.1702,
                  "lat": 44.1544
                },
                {
                  "lon": 124.1702,
                  "lat": 44.3342
                },
                {
                  "lon": 132.215,
                  "lat": 44.3342
                },
                {
                  "lon": 132.215,
                  "lat": 44.1544
                },
                {
                  "lon": 127.187,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 105.5503,
                  "lat": 33.5462
                },
                {
                  "lon": 107.2799,
                  "lat": 33.5462
                },
                {
                  "lon": 107.2799,
                  "lat": 33.726
                },
                {
                  "lon": 104.2531,
                  "lat": 33.726
                },
                {
                  "lon": 104.2531,
                  "lat": 33.5462
                },
                {
                  "lon": 105.5503,
                  "lat": 33.5462
                }
              ],
              [
                {
                  "lon": 123.3266,
                  "lat": 45.5928
                },
                {
                  "lon": 125.6468,
                  "lat": 45.5928
                },
                {
                  "lon": 125.6468,
                  "lat": 45.7726
                },
                {
                  "lon": 122.2954,
                  "lat": 45.7726
                },
                {
                  "lon": 122.2954,
                  "lat": 45.5928
                },
                {
                  "lon": 123.3266,
                  "lat": 45.5928
                }
              ],
              [
                {
                  "lon": 115.0005,
                  "lat": 35.1644
                },
                {
                  "lon": 120.2805,
                  "lat": 35.1644
                },
                {
                  "lon": 120.2805,
                  "lat": 34.9846
                },
                {
                  "lon": 110.3805,
                  "lat": 34.9846
                },
                {
                  "lon": 110.3805,
                  "lat": 35.1644
                },
                {
                  "lon": 115.0005,
                  "lat": 35.1644
                }
              ],
              [
                {
                  "lon": 121.9219,
                  "lat": 40.918
                },
                {
                  "lon": 121.6832,
                  "lat": 40.918
                },
                {
                  "lon": 121.6832,
                  "lat": 41.0978
                },
                {
                  "lon": 123.3541,
                  "lat": 41.0978
                },
                {
                  "lon": 123.3541,
                  "lat": 40.918
                },
                {
                  "lon": 121.9219,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 109.1641,
                  "lat": 36.7826
                },
                {
                  "lon": 107.8135,
                  "lat": 36.7826
                },
                {
                  "lon": 107.8135,
                  "lat": 36.9624
                },
                {
                  "lon": 109.1641,
                  "lat": 36.9624
                },
                {
                  "lon": 109.1641,
                  "lat": 36.7826
                }
              ],
              [
                {
                  "lon": 129.2133,
                  "lat": 46.312
                },
                {
                  "lon": 128.9529,
                  "lat": 46.312
                },
                {
                  "lon": 128.9529,
                  "lat": 46.1322
                },
                {
                  "lon": 131.0361,
                  "lat": 46.1322
                },
                {
                  "lon": 131.0361,
                  "lat": 46.312
                },
                {
                  "lon": 129.2133,
                  "lat": 46.312
                }
              ],
              [
                {
                  "lon": 118.5035,
                  "lat": 35.524
                },
                {
                  "lon": 113.409,
                  "lat": 35.524
                },
                {
                  "lon": 113.409,
                  "lat": 35.7038
                },
                {
                  "lon": 120.2755,
                  "lat": 35.7038
                },
                {
                  "lon": 120.2755,
                  "lat": 35.524
                },
                {
                  "lon": 118.5035,
                  "lat": 35.524
                }
              ],
              [
                {
                  "lon": 97.6876,
                  "lat": 29.7704
                },
                {
                  "lon": 97.4804,
                  "lat": 29.7704
                },
                {
                  "lon": 97.4804,
                  "lat": 29.5906
                },
                {
                  "lon": 98.7236,
                  "lat": 29.5906
                },
                {
                  "lon": 98.7236,
                  "lat": 29.7704
                },
                {
                  "lon": 97.6876,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 115.5546,
                  "lat": 38.0412
                },
                {
                  "lon": 111.4344,
                  "lat": 38.0412
                },
                {
                  "lon": 111.4344,
                  "lat": 38.221
                },
                {
                  "lon": 118.7592,
                  "lat": 38.221
                },
                {
                  "lon": 118.7592,
                  "lat": 38.0412
                },
                {
                  "lon": 115.5546,
                  "lat": 38.0412
                }
              ],
              [
                {
                  "lon": 125.1827,
                  "lat": 47.0312
                },
                {
                  "lon": 125.1827,
                  "lat": 46.8514
                },
                {
                  "lon": 124.391,
                  "lat": 46.8514
                },
                {
                  "lon": 124.391,
                  "lat": 47.0312
                },
                {
                  "lon": 125.1827,
                  "lat": 47.0312
                }
              ],
              [
                {
                  "lon": 102.7335,
                  "lat": 25.9946
                },
                {
                  "lon": 103.5351,
                  "lat": 25.9946
                },
                {
                  "lon": 103.5351,
                  "lat": 26.1744
                },
                {
                  "lon": 102.7335,
                  "lat": 26.1744
                },
                {
                  "lon": 102.7335,
                  "lat": 25.9946
                }
              ],
              [
                {
                  "lon": 82.1227,
                  "lat": 43.615
                },
                {
                  "lon": 81.6259,
                  "lat": 43.615
                },
                {
                  "lon": 81.6259,
                  "lat": 43.4352
                },
                {
                  "lon": 84.8551,
                  "lat": 43.4352
                },
                {
                  "lon": 84.8551,
                  "lat": 43.615
                },
                {
                  "lon": 82.1227,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 108.3003,
                  "lat": 26.3542
                },
                {
                  "lon": 108.3003,
                  "lat": 26.534
                },
                {
                  "lon": 104.4813,
                  "lat": 26.534
                },
                {
                  "lon": 104.4813,
                  "lat": 26.3542
                },
                {
                  "lon": 108.3003,
                  "lat": 26.3542
                }
              ],
              [
                {
                  "lon": 103.3929,
                  "lat": 25.8148
                },
                {
                  "lon": 102.1941,
                  "lat": 25.8148
                },
                {
                  "lon": 102.1941,
                  "lat": 25.635
                },
                {
                  "lon": 103.9923,
                  "lat": 25.635
                },
                {
                  "lon": 103.9923,
                  "lat": 25.8148
                },
                {
                  "lon": 103.3929,
                  "lat": 25.8148
                }
              ],
              [
                {
                  "lon": 111.9234,
                  "lat": 28.5118
                },
                {
                  "lon": 114.5845,
                  "lat": 28.5118
                },
                {
                  "lon": 114.5845,
                  "lat": 28.332
                },
                {
                  "lon": 111.9234,
                  "lat": 28.332
                },
                {
                  "lon": 111.9234,
                  "lat": 28.5118
                }
              ],
              [
                {
                  "lon": 118.8175,
                  "lat": 34.9846
                },
                {
                  "lon": 103.8915,
                  "lat": 34.9846
                },
                {
                  "lon": 103.8915,
                  "lat": 34.8048
                },
                {
                  "lon": 119.6955,
                  "lat": 34.8048
                },
                {
                  "lon": 119.6955,
                  "lat": 34.9846
                },
                {
                  "lon": 118.8175,
                  "lat": 34.9846
                }
              ],
              [
                {
                  "lon": 94.0025,
                  "lat": 35.8836
                },
                {
                  "lon": 95.1125,
                  "lat": 35.8836
                },
                {
                  "lon": 95.1125,
                  "lat": 35.7038
                },
                {
                  "lon": 93.5585,
                  "lat": 35.7038
                },
                {
                  "lon": 93.5585,
                  "lat": 35.8836
                },
                {
                  "lon": 94.0025,
                  "lat": 35.8836
                }
              ],
              [
                {
                  "lon": 118.2455,
                  "lat": 37.1422
                },
                {
                  "lon": 109.4237,
                  "lat": 37.1422
                },
                {
                  "lon": 109.4237,
                  "lat": 37.322
                },
                {
                  "lon": 122.9957,
                  "lat": 37.322
                },
                {
                  "lon": 122.9957,
                  "lat": 37.1422
                },
                {
                  "lon": 118.2455,
                  "lat": 37.1422
                }
              ],
              [
                {
                  "lon": 117.4584,
                  "lat": 32.827
                },
                {
                  "lon": 113.3924,
                  "lat": 32.827
                },
                {
                  "lon": 113.3924,
                  "lat": 32.6472
                },
                {
                  "lon": 121.3104,
                  "lat": 32.6472
                },
                {
                  "lon": 121.3104,
                  "lat": 32.827
                },
                {
                  "lon": 117.4584,
                  "lat": 32.827
                }
              ],
              [
                {
                  "lon": 128.4632,
                  "lat": 42.716
                },
                {
                  "lon": 128.4632,
                  "lat": 42.8958
                },
                {
                  "lon": 128.2177,
                  "lat": 42.8958
                },
                {
                  "lon": 128.2177,
                  "lat": 42.716
                },
                {
                  "lon": 128.4632,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 111.5163,
                  "lat": 26.3542
                },
                {
                  "lon": 111.5163,
                  "lat": 26.534
                },
                {
                  "lon": 112.5213,
                  "lat": 26.534
                },
                {
                  "lon": 112.5213,
                  "lat": 26.3542
                },
                {
                  "lon": 111.5163,
                  "lat": 26.3542
                }
              ],
              [
                {
                  "lon": 112.4266,
                  "lat": 39.4796
                },
                {
                  "lon": 111.9606,
                  "lat": 39.4796
                },
                {
                  "lon": 111.9606,
                  "lat": 39.2998
                },
                {
                  "lon": 119.4166,
                  "lat": 39.2998
                },
                {
                  "lon": 119.4166,
                  "lat": 39.4796
                },
                {
                  "lon": 112.4266,
                  "lat": 39.4796
                }
              ],
              [
                {
                  "lon": 120.5991,
                  "lat": 28.332
                },
                {
                  "lon": 122.0292,
                  "lat": 28.332
                },
                {
                  "lon": 122.0292,
                  "lat": 28.1522
                },
                {
                  "lon": 115.9002,
                  "lat": 28.1522
                },
                {
                  "lon": 115.9002,
                  "lat": 28.332
                },
                {
                  "lon": 120.5991,
                  "lat": 28.332
                }
              ],
              [
                {
                  "lon": 127.2242,
                  "lat": 41.817
                },
                {
                  "lon": 127.4655,
                  "lat": 41.817
                },
                {
                  "lon": 127.4655,
                  "lat": 41.6372
                },
                {
                  "lon": 114.194,
                  "lat": 41.6372
                },
                {
                  "lon": 114.194,
                  "lat": 41.817
                },
                {
                  "lon": 127.2242,
                  "lat": 41.817
                }
              ],
              [
                {
                  "lon": 128.3472,
                  "lat": 45.0534
                },
                {
                  "lon": 129.111,
                  "lat": 45.0534
                },
                {
                  "lon": 129.111,
                  "lat": 44.8736
                },
                {
                  "lon": 123.0006,
                  "lat": 44.8736
                },
                {
                  "lon": 123.0006,
                  "lat": 45.0534
                },
                {
                  "lon": 128.3472,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 95.9036,
                  "lat": 40.918
                },
                {
                  "lon": 96.381,
                  "lat": 40.918
                },
                {
                  "lon": 96.381,
                  "lat": 41.0978
                },
                {
                  "lon": 95.1875,
                  "lat": 41.0978
                },
                {
                  "lon": 95.1875,
                  "lat": 40.918
                },
                {
                  "lon": 95.9036,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 117.0905,
                  "lat": 35.7038
                },
                {
                  "lon": 113.5385,
                  "lat": 35.7038
                },
                {
                  "lon": 113.5385,
                  "lat": 35.8836
                },
                {
                  "lon": 119.7545,
                  "lat": 35.8836
                },
                {
                  "lon": 119.7545,
                  "lat": 35.7038
                },
                {
                  "lon": 117.0905,
                  "lat": 35.7038
                }
              ],
              [
                {
                  "lon": 104.8539,
                  "lat": 30.6694
                },
                {
                  "lon": 105.0634,
                  "lat": 30.6694
                },
                {
                  "lon": 105.0634,
                  "lat": 30.8492
                },
                {
                  "lon": 102.5494,
                  "lat": 30.8492
                },
                {
                  "lon": 102.5494,
                  "lat": 30.6694
                },
                {
                  "lon": 104.8539,
                  "lat": 30.6694
                }
              ],
              [
                {
                  "lon": 113.4007,
                  "lat": 41.2776
                },
                {
                  "lon": 112.2007,
                  "lat": 41.2776
                },
                {
                  "lon": 112.2007,
                  "lat": 41.4574
                },
                {
                  "lon": 115.0807,
                  "lat": 41.4574
                },
                {
                  "lon": 115.0807,
                  "lat": 41.2776
                },
                {
                  "lon": 113.4007,
                  "lat": 41.2776
                }
              ],
              [
                {
                  "lon": 108.5959,
                  "lat": 29.0512
                },
                {
                  "lon": 105.5044,
                  "lat": 29.0512
                },
                {
                  "lon": 105.5044,
                  "lat": 29.231
                },
                {
                  "lon": 109.6264,
                  "lat": 29.231
                },
                {
                  "lon": 109.6264,
                  "lat": 29.0512
                },
                {
                  "lon": 108.5959,
                  "lat": 29.0512
                }
              ],
              [
                {
                  "lon": 107.1005,
                  "lat": 35.7038
                },
                {
                  "lon": 101.7725,
                  "lat": 35.7038
                },
                {
                  "lon": 101.7725,
                  "lat": 35.8836
                },
                {
                  "lon": 109.7645,
                  "lat": 35.8836
                },
                {
                  "lon": 109.7645,
                  "lat": 35.7038
                },
                {
                  "lon": 107.1005,
                  "lat": 35.7038
                }
              ],
              [
                {
                  "lon": 109.9066,
                  "lat": 39.6594
                },
                {
                  "lon": 120.2114,
                  "lat": 39.6594
                },
                {
                  "lon": 120.2114,
                  "lat": 39.8392
                },
                {
                  "lon": 108.2672,
                  "lat": 39.8392
                },
                {
                  "lon": 108.2672,
                  "lat": 39.6594
                },
                {
                  "lon": 109.9066,
                  "lat": 39.6594
                }
              ],
              [
                {
                  "lon": 118.3938,
                  "lat": 37.8614
                },
                {
                  "lon": 119.079,
                  "lat": 37.8614
                },
                {
                  "lon": 119.079,
                  "lat": 38.0412
                },
                {
                  "lon": 111.3134,
                  "lat": 38.0412
                },
                {
                  "lon": 111.3134,
                  "lat": 37.8614
                },
                {
                  "lon": 118.3938,
                  "lat": 37.8614
                }
              ],
              [
                {
                  "lon": 129.9329,
                  "lat": 46.8514
                },
                {
                  "lon": 128.8773,
                  "lat": 46.8514
                },
                {
                  "lon": 128.8773,
                  "lat": 47.0312
                },
                {
                  "lon": 134.4192,
                  "lat": 47.0312
                },
                {
                  "lon": 134.4192,
                  "lat": 46.8514
                },
                {
                  "lon": 129.9329,
                  "lat": 46.8514
                }
              ],
              [
                {
                  "lon": 108.9486,
                  "lat": 30.13
                },
                {
                  "lon": 108.9486,
                  "lat": 30.3098
                },
                {
                  "lon": 105.4075,
                  "lat": 30.3098
                },
                {
                  "lon": 105.4075,
                  "lat": 30.13
                },
                {
                  "lon": 108.9486,
                  "lat": 30.13
                }
              ],
              [
                {
                  "lon": 85.3727,
                  "lat": 43.9746
                },
                {
                  "lon": 85.8741,
                  "lat": 43.9746
                },
                {
                  "lon": 85.8741,
                  "lat": 44.1544
                },
                {
                  "lon": 85.3727,
                  "lat": 44.1544
                },
                {
                  "lon": 85.3727,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 105.0945,
                  "lat": 25.0956
                },
                {
                  "lon": 105.8889,
                  "lat": 25.0956
                },
                {
                  "lon": 105.8889,
                  "lat": 24.9158
                },
                {
                  "lon": 104.1015,
                  "lat": 24.9158
                },
                {
                  "lon": 104.1015,
                  "lat": 25.0956
                },
                {
                  "lon": 105.0945,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 116.6352,
                  "lat": 23.4774
                },
                {
                  "lon": 111.1444,
                  "lat": 23.4774
                },
                {
                  "lon": 111.1444,
                  "lat": 23.2976
                },
                {
                  "lon": 117.6157,
                  "lat": 23.2976
                },
                {
                  "lon": 117.6157,
                  "lat": 23.4774
                },
                {
                  "lon": 116.6352,
                  "lat": 23.4774
                }
              ],
              [
                {
                  "lon": 122.9777,
                  "lat": 44.1544
                },
                {
                  "lon": 121.2228,
                  "lat": 44.1544
                },
                {
                  "lon": 121.2228,
                  "lat": 43.9746
                },
                {
                  "lon": 122.9777,
                  "lat": 43.9746
                },
                {
                  "lon": 122.9777,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 120.6798,
                  "lat": 39.8392
                },
                {
                  "lon": 124.8954,
                  "lat": 39.8392
                },
                {
                  "lon": 124.8954,
                  "lat": 39.6594
                },
                {
                  "lon": 120.6798,
                  "lat": 39.6594
                },
                {
                  "lon": 120.6798,
                  "lat": 39.8392
                }
              ],
              [
                {
                  "lon": 123.1446,
                  "lat": 39.2998
                },
                {
                  "lon": 123.1446,
                  "lat": 39.4796
                },
                {
                  "lon": 121.0476,
                  "lat": 39.4796
                },
                {
                  "lon": 121.0476,
                  "lat": 39.2998
                },
                {
                  "lon": 123.1446,
                  "lat": 39.2998
                }
              ],
              [
                {
                  "lon": 99.3786,
                  "lat": 39.4796
                },
                {
                  "lon": 98.2136,
                  "lat": 39.4796
                },
                {
                  "lon": 98.2136,
                  "lat": 39.2998
                },
                {
                  "lon": 100.7766,
                  "lat": 39.2998
                },
                {
                  "lon": 100.7766,
                  "lat": 39.4796
                },
                {
                  "lon": 99.3786,
                  "lat": 39.4796
                }
              ],
              [
                {
                  "lon": 115.2721,
                  "lat": 32.1078
                },
                {
                  "lon": 122.4903,
                  "lat": 32.1078
                },
                {
                  "lon": 122.4903,
                  "lat": 31.928
                },
                {
                  "lon": 113.5737,
                  "lat": 31.928
                },
                {
                  "lon": 113.5737,
                  "lat": 32.1078
                },
                {
                  "lon": 115.2721,
                  "lat": 32.1078
                }
              ],
              [
                {
                  "lon": 94.313,
                  "lat": 40.019
                },
                {
                  "lon": 94.313,
                  "lat": 39.8392
                },
                {
                  "lon": 95.0174,
                  "lat": 39.8392
                },
                {
                  "lon": 95.0174,
                  "lat": 40.019
                },
                {
                  "lon": 94.313,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 122.7018,
                  "lat": 48.6494
                },
                {
                  "lon": 122.1554,
                  "lat": 48.6494
                },
                {
                  "lon": 122.1554,
                  "lat": 48.8292
                },
                {
                  "lon": 123.7946,
                  "lat": 48.8292
                },
                {
                  "lon": 123.7946,
                  "lat": 48.6494
                },
                {
                  "lon": 122.7018,
                  "lat": 48.6494
                }
              ],
              [
                {
                  "lon": 121.3959,
                  "lat": 27.9724
                },
                {
                  "lon": 118.5455,
                  "lat": 27.9724
                },
                {
                  "lon": 118.5455,
                  "lat": 27.7926
                },
                {
                  "lon": 121.8031,
                  "lat": 27.7926
                },
                {
                  "lon": 121.8031,
                  "lat": 27.9724
                },
                {
                  "lon": 121.3959,
                  "lat": 27.9724
                }
              ],
              [
                {
                  "lon": 109.9083,
                  "lat": 26.3542
                },
                {
                  "lon": 110.3103,
                  "lat": 26.3542
                },
                {
                  "lon": 110.3103,
                  "lat": 26.534
                },
                {
                  "lon": 109.3053,
                  "lat": 26.534
                },
                {
                  "lon": 109.3053,
                  "lat": 26.3542
                },
                {
                  "lon": 109.9083,
                  "lat": 26.3542
                }
              ],
              [
                {
                  "lon": 127.0738,
                  "lat": 42.5362
                },
                {
                  "lon": 122.1918,
                  "lat": 42.5362
                },
                {
                  "lon": 122.1918,
                  "lat": 42.3564
                },
                {
                  "lon": 128.2943,
                  "lat": 42.3564
                },
                {
                  "lon": 128.2943,
                  "lat": 42.5362
                },
                {
                  "lon": 127.0738,
                  "lat": 42.5362
                }
              ],
              [
                {
                  "lon": 101.8284,
                  "lat": 37.6816
                },
                {
                  "lon": 102.0562,
                  "lat": 37.6816
                },
                {
                  "lon": 102.0562,
                  "lat": 37.8614
                },
                {
                  "lon": 101.8284,
                  "lat": 37.8614
                },
                {
                  "lon": 101.8284,
                  "lat": 37.6816
                }
              ],
              [
                {
                  "lon": 119.9068,
                  "lat": 32.4674
                },
                {
                  "lon": 111.1492,
                  "lat": 32.4674
                },
                {
                  "lon": 111.1492,
                  "lat": 32.6472
                },
                {
                  "lon": 121.402,
                  "lat": 32.6472
                },
                {
                  "lon": 121.402,
                  "lat": 32.4674
                },
                {
                  "lon": 119.9068,
                  "lat": 32.4674
                }
              ],
              [
                {
                  "lon": 98.1966,
                  "lat": 39.6594
                },
                {
                  "lon": 99.6018,
                  "lat": 39.6594
                },
                {
                  "lon": 99.6018,
                  "lat": 39.8392
                },
                {
                  "lon": 97.494,
                  "lat": 39.8392
                },
                {
                  "lon": 97.494,
                  "lat": 39.6594
                },
                {
                  "lon": 98.1966,
                  "lat": 39.6594
                }
              ],
              [
                {
                  "lon": 106.667,
                  "lat": 26.7138
                },
                {
                  "lon": 105.6585,
                  "lat": 26.7138
                },
                {
                  "lon": 105.6585,
                  "lat": 26.8936
                },
                {
                  "lon": 108.2806,
                  "lat": 26.8936
                },
                {
                  "lon": 108.2806,
                  "lat": 26.7138
                },
                {
                  "lon": 106.667,
                  "lat": 26.7138
                }
              ],
              [
                {
                  "lon": 124.4361,
                  "lat": 42.1766
                },
                {
                  "lon": 124.4361,
                  "lat": 42.3564
                },
                {
                  "lon": 122.7323,
                  "lat": 42.3564
                },
                {
                  "lon": 122.7323,
                  "lat": 42.1766
                },
                {
                  "lon": 124.4361,
                  "lat": 42.1766
                }
              ],
              [
                {
                  "lon": 107.1228,
                  "lat": 38.5806
                },
                {
                  "lon": 108.0432,
                  "lat": 38.5806
                },
                {
                  "lon": 108.0432,
                  "lat": 38.4008
                },
                {
                  "lon": 104.5917,
                  "lat": 38.4008
                },
                {
                  "lon": 104.5917,
                  "lat": 38.5806
                },
                {
                  "lon": 107.1228,
                  "lat": 38.5806
                }
              ],
              [
                {
                  "lon": 109.8654,
                  "lat": 33.3664
                },
                {
                  "lon": 114.1714,
                  "lat": 33.3664
                },
                {
                  "lon": 114.1714,
                  "lat": 33.1866
                },
                {
                  "lon": 109.6501,
                  "lat": 33.1866
                },
                {
                  "lon": 109.6501,
                  "lat": 33.3664
                },
                {
                  "lon": 109.8654,
                  "lat": 33.3664
                }
              ],
              [
                {
                  "lon": 116.7157,
                  "lat": 42.1766
                },
                {
                  "lon": 114.2887,
                  "lat": 42.1766
                },
                {
                  "lon": 114.2887,
                  "lat": 41.9968
                },
                {
                  "lon": 116.9584,
                  "lat": 41.9968
                },
                {
                  "lon": 116.9584,
                  "lat": 42.1766
                },
                {
                  "lon": 116.7157,
                  "lat": 42.1766
                }
              ],
              [
                {
                  "lon": 121.215,
                  "lat": 39.4796
                },
                {
                  "lon": 123.551,
                  "lat": 39.4796
                },
                {
                  "lon": 123.551,
                  "lat": 39.6594
                },
                {
                  "lon": 120.9814,
                  "lat": 39.6594
                },
                {
                  "lon": 120.9814,
                  "lat": 39.4796
                },
                {
                  "lon": 121.215,
                  "lat": 39.4796
                }
              ],
              [
                {
                  "lon": 119.1546,
                  "lat": 40.1988
                },
                {
                  "lon": 125.0421,
                  "lat": 40.1988
                },
                {
                  "lon": 125.0421,
                  "lat": 40.019
                },
                {
                  "lon": 110.9121,
                  "lat": 40.019
                },
                {
                  "lon": 110.9121,
                  "lat": 40.1988
                },
                {
                  "lon": 119.1546,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 96.1612,
                  "lat": 40.5584
                },
                {
                  "lon": 95.2116,
                  "lat": 40.5584
                },
                {
                  "lon": 95.2116,
                  "lat": 40.7382
                },
                {
                  "lon": 97.1108,
                  "lat": 40.7382
                },
                {
                  "lon": 97.1108,
                  "lat": 40.5584
                },
                {
                  "lon": 96.1612,
                  "lat": 40.5584
                }
              ],
              [
                {
                  "lon": 104.5445,
                  "lat": 36.9624
                },
                {
                  "lon": 104.9957,
                  "lat": 36.9624
                },
                {
                  "lon": 104.9957,
                  "lat": 37.1422
                },
                {
                  "lon": 102.7397,
                  "lat": 37.1422
                },
                {
                  "lon": 102.7397,
                  "lat": 36.9624
                },
                {
                  "lon": 104.5445,
                  "lat": 36.9624
                }
              ],
              [
                {
                  "lon": 112.2508,
                  "lat": 22.2188
                },
                {
                  "lon": 114.7793,
                  "lat": 22.2188
                },
                {
                  "lon": 114.7793,
                  "lat": 22.3986
                },
                {
                  "lon": 109.9168,
                  "lat": 22.3986
                },
                {
                  "lon": 109.9168,
                  "lat": 22.2188
                },
                {
                  "lon": 112.2508,
                  "lat": 22.2188
                }
              ],
              [
                {
                  "lon": 94.1385,
                  "lat": 35.524
                },
                {
                  "lon": 93.917,
                  "lat": 35.524
                },
                {
                  "lon": 93.917,
                  "lat": 35.7038
                },
                {
                  "lon": 94.803,
                  "lat": 35.7038
                },
                {
                  "lon": 94.803,
                  "lat": 35.524
                },
                {
                  "lon": 94.1385,
                  "lat": 35.524
                }
              ],
              [
                {
                  "lon": 113.9971,
                  "lat": 23.1178
                },
                {
                  "lon": 111.2559,
                  "lat": 23.1178
                },
                {
                  "lon": 111.2559,
                  "lat": 23.2976
                },
                {
                  "lon": 117.3257,
                  "lat": 23.2976
                },
                {
                  "lon": 117.3257,
                  "lat": 23.1178
                },
                {
                  "lon": 113.9971,
                  "lat": 23.1178
                }
              ],
              [
                {
                  "lon": 114.4913,
                  "lat": 34.2654
                },
                {
                  "lon": 106.8578,
                  "lat": 34.2654
                },
                {
                  "lon": 106.8578,
                  "lat": 34.4452
                },
                {
                  "lon": 120.5981,
                  "lat": 34.4452
                },
                {
                  "lon": 120.5981,
                  "lat": 34.2654
                },
                {
                  "lon": 114.4913,
                  "lat": 34.2654
                }
              ],
              [
                {
                  "lon": 91.9018,
                  "lat": 29.231
                },
                {
                  "lon": 92.1079,
                  "lat": 29.231
                },
                {
                  "lon": 92.1079,
                  "lat": 29.0512
                },
                {
                  "lon": 90.4591,
                  "lat": 29.0512
                },
                {
                  "lon": 90.4591,
                  "lat": 29.231
                },
                {
                  "lon": 91.9018,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 112.4059,
                  "lat": 32.1078
                },
                {
                  "lon": 112.1932,
                  "lat": 32.1078
                },
                {
                  "lon": 112.1932,
                  "lat": 32.2876
                },
                {
                  "lon": 112.6186,
                  "lat": 32.2876
                },
                {
                  "lon": 112.6186,
                  "lat": 32.1078
                },
                {
                  "lon": 112.4059,
                  "lat": 32.1078
                }
              ],
              [
                {
                  "lon": 106.1828,
                  "lat": 29.7704
                },
                {
                  "lon": 108.2548,
                  "lat": 29.7704
                },
                {
                  "lon": 108.2548,
                  "lat": 29.5906
                },
                {
                  "lon": 105.354,
                  "lat": 29.5906
                },
                {
                  "lon": 105.354,
                  "lat": 29.7704
                },
                {
                  "lon": 106.1828,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 105.213,
                  "lat": 36.0634
                },
                {
                  "lon": 105.658,
                  "lat": 36.0634
                },
                {
                  "lon": 105.658,
                  "lat": 35.8836
                },
                {
                  "lon": 104.768,
                  "lat": 35.8836
                },
                {
                  "lon": 104.768,
                  "lat": 36.0634
                },
                {
                  "lon": 105.213,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 105.5163,
                  "lat": 25.635
                },
                {
                  "lon": 104.3193,
                  "lat": 25.635
                },
                {
                  "lon": 104.3193,
                  "lat": 25.4552
                },
                {
                  "lon": 106.9128,
                  "lat": 25.4552
                },
                {
                  "lon": 106.9128,
                  "lat": 25.635
                },
                {
                  "lon": 105.5163,
                  "lat": 25.635
                }
              ],
              [
                {
                  "lon": 104.5743,
                  "lat": 30.13
                },
                {
                  "lon": 105.1992,
                  "lat": 30.13
                },
                {
                  "lon": 105.1992,
                  "lat": 30.3098
                },
                {
                  "lon": 102.9079,
                  "lat": 30.3098
                },
                {
                  "lon": 102.9079,
                  "lat": 30.13
                },
                {
                  "lon": 104.5743,
                  "lat": 30.13
                }
              ],
              [
                {
                  "lon": 119.0675,
                  "lat": 36.2432
                },
                {
                  "lon": 121.526,
                  "lat": 36.2432
                },
                {
                  "lon": 121.526,
                  "lat": 36.423
                },
                {
                  "lon": 110.5745,
                  "lat": 36.423
                },
                {
                  "lon": 110.5745,
                  "lat": 36.2432
                },
                {
                  "lon": 119.0675,
                  "lat": 36.2432
                }
              ],
              [
                {
                  "lon": 103.646,
                  "lat": 36.423
                },
                {
                  "lon": 104.54,
                  "lat": 36.423
                },
                {
                  "lon": 104.54,
                  "lat": 36.2432
                },
                {
                  "lon": 101.411,
                  "lat": 36.2432
                },
                {
                  "lon": 101.411,
                  "lat": 36.423
                },
                {
                  "lon": 103.646,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 120.1819,
                  "lat": 31.2088
                },
                {
                  "lon": 122.0746,
                  "lat": 31.2088
                },
                {
                  "lon": 122.0746,
                  "lat": 31.029
                },
                {
                  "lon": 114.0832,
                  "lat": 31.029
                },
                {
                  "lon": 114.0832,
                  "lat": 31.2088
                },
                {
                  "lon": 120.1819,
                  "lat": 31.2088
                }
              ],
              [
                {
                  "lon": 112.9444,
                  "lat": 24.0168
                },
                {
                  "lon": 113.3382,
                  "lat": 24.0168
                },
                {
                  "lon": 113.3382,
                  "lat": 23.837
                },
                {
                  "lon": 111.1723,
                  "lat": 23.837
                },
                {
                  "lon": 111.1723,
                  "lat": 24.0168
                },
                {
                  "lon": 112.9444,
                  "lat": 24.0168
                }
              ],
              [
                {
                  "lon": 133.8975,
                  "lat": 47.9302
                },
                {
                  "lon": 132.5505,
                  "lat": 47.9302
                },
                {
                  "lon": 132.5505,
                  "lat": 48.11
                },
                {
                  "lon": 134.9751,
                  "lat": 48.11
                },
                {
                  "lon": 134.9751,
                  "lat": 47.9302
                },
                {
                  "lon": 133.8975,
                  "lat": 47.9302
                }
              ],
              [
                {
                  "lon": 113.6085,
                  "lat": 36.423
                },
                {
                  "lon": 108.4565,
                  "lat": 36.423
                },
                {
                  "lon": 108.4565,
                  "lat": 36.6028
                },
                {
                  "lon": 121.4485,
                  "lat": 36.6028
                },
                {
                  "lon": 121.4485,
                  "lat": 36.423
                },
                {
                  "lon": 113.6085,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 108.7728,
                  "lat": 24.1966
                },
                {
                  "lon": 109.9578,
                  "lat": 24.1966
                },
                {
                  "lon": 109.9578,
                  "lat": 24.3764
                },
                {
                  "lon": 108.1803,
                  "lat": 24.3764
                },
                {
                  "lon": 108.1803,
                  "lat": 24.1966
                },
                {
                  "lon": 108.7728,
                  "lat": 24.1966
                }
              ],
              [
                {
                  "lon": 108.2337,
                  "lat": 27.2532
                },
                {
                  "lon": 108.2337,
                  "lat": 27.0734
                },
                {
                  "lon": 106.2107,
                  "lat": 27.0734
                },
                {
                  "lon": 106.2107,
                  "lat": 27.2532
                },
                {
                  "lon": 108.2337,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 131.7878,
                  "lat": 46.4918
                },
                {
                  "lon": 134.4088,
                  "lat": 46.4918
                },
                {
                  "lon": 134.4088,
                  "lat": 46.6716
                },
                {
                  "lon": 129.1668,
                  "lat": 46.6716
                },
                {
                  "lon": 129.1668,
                  "lat": 46.4918
                },
                {
                  "lon": 131.7878,
                  "lat": 46.4918
                }
              ],
              [
                {
                  "lon": 77.5318,
                  "lat": 39.6594
                },
                {
                  "lon": 77.5318,
                  "lat": 39.4796
                },
                {
                  "lon": 78.4662,
                  "lat": 39.4796
                },
                {
                  "lon": 78.4662,
                  "lat": 39.6594
                },
                {
                  "lon": 77.5318,
                  "lat": 39.6594
                }
              ],
              [
                {
                  "lon": 89.5747,
                  "lat": 43.4352
                },
                {
                  "lon": 86.3455,
                  "lat": 43.4352
                },
                {
                  "lon": 86.3455,
                  "lat": 43.615
                },
                {
                  "lon": 90.0715,
                  "lat": 43.615
                },
                {
                  "lon": 90.0715,
                  "lat": 43.4352
                },
                {
                  "lon": 89.5747,
                  "lat": 43.4352
                }
              ],
              [
                {
                  "lon": 116.5166,
                  "lat": 43.7948
                },
                {
                  "lon": 117.5162,
                  "lat": 43.7948
                },
                {
                  "lon": 117.5162,
                  "lat": 43.9746
                },
                {
                  "lon": 115.0172,
                  "lat": 43.9746
                },
                {
                  "lon": 115.0172,
                  "lat": 43.7948
                },
                {
                  "lon": 116.5166,
                  "lat": 43.7948
                }
              ],
              [
                {
                  "lon": 102.9674,
                  "lat": 37.6816
                },
                {
                  "lon": 102.284,
                  "lat": 37.6816
                },
                {
                  "lon": 102.284,
                  "lat": 37.8614
                },
                {
                  "lon": 103.6508,
                  "lat": 37.8614
                },
                {
                  "lon": 103.6508,
                  "lat": 37.6816
                },
                {
                  "lon": 102.9674,
                  "lat": 37.6816
                }
              ],
              [
                {
                  "lon": 111.5794,
                  "lat": 28.8714
                },
                {
                  "lon": 110.9623,
                  "lat": 28.8714
                },
                {
                  "lon": 110.9623,
                  "lat": 29.0512
                },
                {
                  "lon": 112.1965,
                  "lat": 29.0512
                },
                {
                  "lon": 112.1965,
                  "lat": 28.8714
                },
                {
                  "lon": 111.5794,
                  "lat": 28.8714
                }
              ],
              [
                {
                  "lon": 124.4206,
                  "lat": 52.7848
                },
                {
                  "lon": 125.0178,
                  "lat": 52.7848
                },
                {
                  "lon": 125.0178,
                  "lat": 52.9646
                },
                {
                  "lon": 123.8234,
                  "lat": 52.9646
                },
                {
                  "lon": 123.8234,
                  "lat": 52.7848
                },
                {
                  "lon": 124.4206,
                  "lat": 52.7848
                }
              ],
              [
                {
                  "lon": 83.7902,
                  "lat": 41.817
                },
                {
                  "lon": 84.9967,
                  "lat": 41.817
                },
                {
                  "lon": 84.9967,
                  "lat": 41.6372
                },
                {
                  "lon": 83.7902,
                  "lat": 41.6372
                },
                {
                  "lon": 83.7902,
                  "lat": 41.817
                }
              ],
              [
                {
                  "lon": 129.5547,
                  "lat": 43.615
                },
                {
                  "lon": 130.0531,
                  "lat": 43.615
                },
                {
                  "lon": 130.0531,
                  "lat": 43.7948
                },
                {
                  "lon": 128.0595,
                  "lat": 43.7948
                },
                {
                  "lon": 128.0595,
                  "lat": 43.615
                },
                {
                  "lon": 129.5547,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 114.4406,
                  "lat": 39.6594
                },
                {
                  "lon": 119.5798,
                  "lat": 39.6594
                },
                {
                  "lon": 119.5798,
                  "lat": 39.4796
                },
                {
                  "lon": 107.6662,
                  "lat": 39.4796
                },
                {
                  "lon": 107.6662,
                  "lat": 39.6594
                },
                {
                  "lon": 114.4406,
                  "lat": 39.6594
                }
              ],
              [
                {
                  "lon": 126.8931,
                  "lat": 48.11
                },
                {
                  "lon": 124.1991,
                  "lat": 48.11
                },
                {
                  "lon": 124.1991,
                  "lat": 47.9302
                },
                {
                  "lon": 127.9707,
                  "lat": 47.9302
                },
                {
                  "lon": 127.9707,
                  "lat": 48.11
                },
                {
                  "lon": 126.8931,
                  "lat": 48.11
                }
              ],
              [
                {
                  "lon": 120.2802,
                  "lat": 37.8614
                },
                {
                  "lon": 105.9288,
                  "lat": 37.8614
                },
                {
                  "lon": 105.9288,
                  "lat": 37.6816
                },
                {
                  "lon": 121.647,
                  "lat": 37.6816
                },
                {
                  "lon": 121.647,
                  "lat": 37.8614
                },
                {
                  "lon": 120.2802,
                  "lat": 37.8614
                }
              ],
              [
                {
                  "lon": 126.7482,
                  "lat": 49.1888
                },
                {
                  "lon": 125.9196,
                  "lat": 49.1888
                },
                {
                  "lon": 125.9196,
                  "lat": 49.3686
                },
                {
                  "lon": 129.5102,
                  "lat": 49.3686
                },
                {
                  "lon": 129.5102,
                  "lat": 49.1888
                },
                {
                  "lon": 126.7482,
                  "lat": 49.1888
                }
              ],
              [
                {
                  "lon": 118.0524,
                  "lat": 30.6694
                },
                {
                  "lon": 122.6614,
                  "lat": 30.6694
                },
                {
                  "lon": 122.6614,
                  "lat": 30.8492
                },
                {
                  "lon": 115.5384,
                  "lat": 30.8492
                },
                {
                  "lon": 115.5384,
                  "lat": 30.6694
                },
                {
                  "lon": 118.0524,
                  "lat": 30.6694
                }
              ],
              [
                {
                  "lon": 114.2453,
                  "lat": 36.9624
                },
                {
                  "lon": 111.3125,
                  "lat": 36.9624
                },
                {
                  "lon": 111.3125,
                  "lat": 37.1422
                },
                {
                  "lon": 123.4949,
                  "lat": 37.1422
                },
                {
                  "lon": 123.4949,
                  "lat": 36.9624
                },
                {
                  "lon": 114.2453,
                  "lat": 36.9624
                }
              ],
              [
                {
                  "lon": 108.8899,
                  "lat": 24.1966
                },
                {
                  "lon": 108.6927,
                  "lat": 24.1966
                },
                {
                  "lon": 108.6927,
                  "lat": 24.0168
                },
                {
                  "lon": 110.2703,
                  "lat": 24.0168
                },
                {
                  "lon": 110.2703,
                  "lat": 24.1966
                },
                {
                  "lon": 108.8899,
                  "lat": 24.1966
                }
              ],
              [
                {
                  "lon": 111.9659,
                  "lat": 36.6028
                },
                {
                  "lon": 121.8483,
                  "lat": 36.6028
                },
                {
                  "lon": 121.8483,
                  "lat": 36.7826
                },
                {
                  "lon": 111.9659,
                  "lat": 36.7826
                },
                {
                  "lon": 111.9659,
                  "lat": 36.6028
                }
              ],
              [
                {
                  "lon": 99.9965,
                  "lat": 35.7038
                },
                {
                  "lon": 99.3305,
                  "lat": 35.7038
                },
                {
                  "lon": 99.3305,
                  "lat": 35.8836
                },
                {
                  "lon": 101.5505,
                  "lat": 35.8836
                },
                {
                  "lon": 101.5505,
                  "lat": 35.7038
                },
                {
                  "lon": 99.9965,
                  "lat": 35.7038
                }
              ],
              [
                {
                  "lon": 110.6183,
                  "lat": 36.6028
                },
                {
                  "lon": 111.2921,
                  "lat": 36.6028
                },
                {
                  "lon": 111.2921,
                  "lat": 36.7826
                },
                {
                  "lon": 107.9231,
                  "lat": 36.7826
                },
                {
                  "lon": 107.9231,
                  "lat": 36.6028
                },
                {
                  "lon": 110.6183,
                  "lat": 36.6028
                }
              ],
              [
                {
                  "lon": 110.6616,
                  "lat": 38.4008
                },
                {
                  "lon": 110.6616,
                  "lat": 38.221
                },
                {
                  "lon": 109.2846,
                  "lat": 38.221
                },
                {
                  "lon": 109.2846,
                  "lat": 38.4008
                },
                {
                  "lon": 110.6616,
                  "lat": 38.4008
                }
              ],
              [
                {
                  "lon": 111.9112,
                  "lat": 26.8936
                },
                {
                  "lon": 112.1129,
                  "lat": 26.8936
                },
                {
                  "lon": 112.1129,
                  "lat": 26.7138
                },
                {
                  "lon": 111.3061,
                  "lat": 26.7138
                },
                {
                  "lon": 111.3061,
                  "lat": 26.8936
                },
                {
                  "lon": 111.9112,
                  "lat": 26.8936
                }
              ],
              [
                {
                  "lon": 120.0932,
                  "lat": 31.2088
                },
                {
                  "lon": 122.6216,
                  "lat": 31.2088
                },
                {
                  "lon": 122.6216,
                  "lat": 31.3886
                },
                {
                  "lon": 118.4076,
                  "lat": 31.3886
                },
                {
                  "lon": 118.4076,
                  "lat": 31.2088
                },
                {
                  "lon": 120.0932,
                  "lat": 31.2088
                }
              ],
              [
                {
                  "lon": 100.1966,
                  "lat": 39.12
                },
                {
                  "lon": 100.6614,
                  "lat": 39.12
                },
                {
                  "lon": 100.6614,
                  "lat": 39.2998
                },
                {
                  "lon": 98.5698,
                  "lat": 39.2998
                },
                {
                  "lon": 98.5698,
                  "lat": 39.12
                },
                {
                  "lon": 100.1966,
                  "lat": 39.12
                }
              ],
              [
                {
                  "lon": 115.4689,
                  "lat": 41.4574
                },
                {
                  "lon": 115.2283,
                  "lat": 41.4574
                },
                {
                  "lon": 115.2283,
                  "lat": 41.6372
                },
                {
                  "lon": 126.2959,
                  "lat": 41.6372
                },
                {
                  "lon": 126.2959,
                  "lat": 41.4574
                },
                {
                  "lon": 115.4689,
                  "lat": 41.4574
                }
              ],
              [
                {
                  "lon": 119.9473,
                  "lat": 43.4352
                },
                {
                  "lon": 120.195,
                  "lat": 43.4352
                },
                {
                  "lon": 120.195,
                  "lat": 43.2554
                },
                {
                  "lon": 115.7364,
                  "lat": 43.2554
                },
                {
                  "lon": 115.7364,
                  "lat": 43.4352
                },
                {
                  "lon": 119.9473,
                  "lat": 43.4352
                }
              ],
              [
                {
                  "lon": 104.7372,
                  "lat": 30.8492
                },
                {
                  "lon": 104.9471,
                  "lat": 30.8492
                },
                {
                  "lon": 104.9471,
                  "lat": 31.029
                },
                {
                  "lon": 103.058,
                  "lat": 31.029
                },
                {
                  "lon": 103.058,
                  "lat": 30.8492
                },
                {
                  "lon": 104.7372,
                  "lat": 30.8492
                }
              ],
              [
                {
                  "lon": 112.9107,
                  "lat": 41.9968
                },
                {
                  "lon": 112.4267,
                  "lat": 41.9968
                },
                {
                  "lon": 112.4267,
                  "lat": 41.817
                },
                {
                  "lon": 113.8787,
                  "lat": 41.817
                },
                {
                  "lon": 113.8787,
                  "lat": 41.9968
                },
                {
                  "lon": 112.9107,
                  "lat": 41.9968
                }
              ],
              [
                {
                  "lon": 105.2181,
                  "lat": 34.0856
                },
                {
                  "lon": 121.1029,
                  "lat": 34.0856
                },
                {
                  "lon": 121.1029,
                  "lat": 34.2654
                },
                {
                  "lon": 103.4773,
                  "lat": 34.2654
                },
                {
                  "lon": 103.4773,
                  "lat": 34.0856
                },
                {
                  "lon": 105.2181,
                  "lat": 34.0856
                }
              ],
              [
                {
                  "lon": 107.185,
                  "lat": 28.8714
                },
                {
                  "lon": 108.4174,
                  "lat": 28.8714
                },
                {
                  "lon": 108.4174,
                  "lat": 28.6916
                },
                {
                  "lon": 106.5688,
                  "lat": 28.6916
                },
                {
                  "lon": 106.5688,
                  "lat": 28.8714
                },
                {
                  "lon": 107.185,
                  "lat": 28.8714
                }
              ],
              [
                {
                  "lon": 125.9383,
                  "lat": 41.9968
                },
                {
                  "lon": 127.8799,
                  "lat": 41.9968
                },
                {
                  "lon": 127.8799,
                  "lat": 42.1766
                },
                {
                  "lon": 125.2102,
                  "lat": 42.1766
                },
                {
                  "lon": 125.2102,
                  "lat": 41.9968
                },
                {
                  "lon": 125.9383,
                  "lat": 41.9968
                }
              ],
              [
                {
                  "lon": 109.4419,
                  "lat": 33.5462
                },
                {
                  "lon": 109.0095,
                  "lat": 33.5462
                },
                {
                  "lon": 109.0095,
                  "lat": 33.726
                },
                {
                  "lon": 121.3329,
                  "lat": 33.726
                },
                {
                  "lon": 121.3329,
                  "lat": 33.5462
                },
                {
                  "lon": 109.4419,
                  "lat": 33.5462
                }
              ],
              [
                {
                  "lon": 102.794,
                  "lat": 34.9846
                },
                {
                  "lon": 102.355,
                  "lat": 34.9846
                },
                {
                  "lon": 102.355,
                  "lat": 34.8048
                },
                {
                  "lon": 103.672,
                  "lat": 34.8048
                },
                {
                  "lon": 103.672,
                  "lat": 34.9846
                },
                {
                  "lon": 102.794,
                  "lat": 34.9846
                }
              ],
              [
                {
                  "lon": 116.1411,
                  "lat": 24.5562
                },
                {
                  "lon": 116.7342,
                  "lat": 24.5562
                },
                {
                  "lon": 116.7342,
                  "lat": 24.3764
                },
                {
                  "lon": 115.548,
                  "lat": 24.3764
                },
                {
                  "lon": 115.548,
                  "lat": 24.5562
                },
                {
                  "lon": 116.1411,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 114.1207,
                  "lat": 41.9968
                },
                {
                  "lon": 116.5407,
                  "lat": 41.9968
                },
                {
                  "lon": 116.5407,
                  "lat": 41.817
                },
                {
                  "lon": 114.1207,
                  "lat": 41.817
                },
                {
                  "lon": 114.1207,
                  "lat": 41.9968
                }
              ],
              [
                {
                  "lon": 108.8915,
                  "lat": 36.0634
                },
                {
                  "lon": 110.2295,
                  "lat": 36.0634
                },
                {
                  "lon": 110.2295,
                  "lat": 36.2432
                },
                {
                  "lon": 107.5535,
                  "lat": 36.2432
                },
                {
                  "lon": 107.5535,
                  "lat": 36.0634
                },
                {
                  "lon": 108.8915,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 123.4791,
                  "lat": 43.9746
                },
                {
                  "lon": 123.4791,
                  "lat": 44.1544
                },
                {
                  "lon": 126.9889,
                  "lat": 44.1544
                },
                {
                  "lon": 126.9889,
                  "lat": 43.9746
                },
                {
                  "lon": 123.4791,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 108.7744,
                  "lat": 29.4108
                },
                {
                  "lon": 104.8452,
                  "lat": 29.4108
                },
                {
                  "lon": 104.8452,
                  "lat": 29.5906
                },
                {
                  "lon": 109.6016,
                  "lat": 29.5906
                },
                {
                  "lon": 109.6016,
                  "lat": 29.4108
                },
                {
                  "lon": 108.7744,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 84.449,
                  "lat": 44.3342
                },
                {
                  "lon": 85.9574,
                  "lat": 44.3342
                },
                {
                  "lon": 85.9574,
                  "lat": 44.1544
                },
                {
                  "lon": 83.6948,
                  "lat": 44.1544
                },
                {
                  "lon": 83.6948,
                  "lat": 44.3342
                },
                {
                  "lon": 84.449,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 105.8163,
                  "lat": 27.9724
                },
                {
                  "lon": 105.6123,
                  "lat": 27.9724
                },
                {
                  "lon": 105.6123,
                  "lat": 28.1522
                },
                {
                  "lon": 108.0603,
                  "lat": 28.1522
                },
                {
                  "lon": 108.0603,
                  "lat": 27.9724
                },
                {
                  "lon": 105.8163,
                  "lat": 27.9724
                }
              ],
              [
                {
                  "lon": 85.4746,
                  "lat": 41.0978
                },
                {
                  "lon": 85.4746,
                  "lat": 41.2776
                },
                {
                  "lon": 86.6711,
                  "lat": 41.2776
                },
                {
                  "lon": 86.6711,
                  "lat": 41.0978
                },
                {
                  "lon": 85.4746,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 119.5445,
                  "lat": 35.3442
                },
                {
                  "lon": 110.063,
                  "lat": 35.3442
                },
                {
                  "lon": 110.063,
                  "lat": 35.1644
                },
                {
                  "lon": 120.206,
                  "lat": 35.1644
                },
                {
                  "lon": 120.206,
                  "lat": 35.3442
                },
                {
                  "lon": 119.5445,
                  "lat": 35.3442
                }
              ],
              [
                {
                  "lon": 115.7705,
                  "lat": 33.9058
                },
                {
                  "lon": 107.7341,
                  "lat": 33.9058
                },
                {
                  "lon": 107.7341,
                  "lat": 34.0856
                },
                {
                  "lon": 120.5489,
                  "lat": 34.0856
                },
                {
                  "lon": 120.5489,
                  "lat": 33.9058
                },
                {
                  "lon": 115.7705,
                  "lat": 33.9058
                }
              ],
              [
                {
                  "lon": 130.2872,
                  "lat": 45.5928
                },
                {
                  "lon": 129.5138,
                  "lat": 45.5928
                },
                {
                  "lon": 129.5138,
                  "lat": 45.7726
                },
                {
                  "lon": 133.3808,
                  "lat": 45.7726
                },
                {
                  "lon": 133.3808,
                  "lat": 45.5928
                },
                {
                  "lon": 130.2872,
                  "lat": 45.5928
                }
              ],
              [
                {
                  "lon": 119.4894,
                  "lat": 25.2754
                },
                {
                  "lon": 116.9037,
                  "lat": 25.2754
                },
                {
                  "lon": 116.9037,
                  "lat": 25.0956
                },
                {
                  "lon": 119.8872,
                  "lat": 25.0956
                },
                {
                  "lon": 119.8872,
                  "lat": 25.2754
                },
                {
                  "lon": 119.4894,
                  "lat": 25.2754
                }
              ],
              [
                {
                  "lon": 124.2534,
                  "lat": 47.7504
                },
                {
                  "lon": 121.8459,
                  "lat": 47.7504
                },
                {
                  "lon": 121.8459,
                  "lat": 47.5706
                },
                {
                  "lon": 125.5909,
                  "lat": 47.5706
                },
                {
                  "lon": 125.5909,
                  "lat": 47.7504
                },
                {
                  "lon": 124.2534,
                  "lat": 47.7504
                }
              ],
              [
                {
                  "lon": 100.3405,
                  "lat": 35.524
                },
                {
                  "lon": 99.8975,
                  "lat": 35.524
                },
                {
                  "lon": 99.8975,
                  "lat": 35.7038
                },
                {
                  "lon": 101.448,
                  "lat": 35.7038
                },
                {
                  "lon": 101.448,
                  "lat": 35.524
                },
                {
                  "lon": 100.3405,
                  "lat": 35.524
                }
              ],
              [
                {
                  "lon": 110.2086,
                  "lat": 18.0834
                },
                {
                  "lon": 110.2086,
                  "lat": 18.2632
                },
                {
                  "lon": 108.6934,
                  "lat": 18.2632
                },
                {
                  "lon": 108.6934,
                  "lat": 18.0834
                },
                {
                  "lon": 110.2086,
                  "lat": 18.0834
                }
              ],
              [
                {
                  "lon": 113.9559,
                  "lat": 26.1744
                },
                {
                  "lon": 113.5551,
                  "lat": 26.1744
                },
                {
                  "lon": 113.5551,
                  "lat": 25.9946
                },
                {
                  "lon": 116.3607,
                  "lat": 25.9946
                },
                {
                  "lon": 116.3607,
                  "lat": 26.1744
                },
                {
                  "lon": 113.9559,
                  "lat": 26.1744
                }
              ],
              [
                {
                  "lon": 109.8353,
                  "lat": 27.433
                },
                {
                  "lon": 110.4443,
                  "lat": 27.433
                },
                {
                  "lon": 110.4443,
                  "lat": 27.6128
                },
                {
                  "lon": 108.8203,
                  "lat": 27.6128
                },
                {
                  "lon": 108.8203,
                  "lat": 27.433
                },
                {
                  "lon": 109.8353,
                  "lat": 27.433
                }
              ],
              [
                {
                  "lon": 81.1108,
                  "lat": 44.1544
                },
                {
                  "lon": 80.108,
                  "lat": 44.1544
                },
                {
                  "lon": 80.108,
                  "lat": 43.9746
                },
                {
                  "lon": 82.8657,
                  "lat": 43.9746
                },
                {
                  "lon": 82.8657,
                  "lat": 44.1544
                },
                {
                  "lon": 81.1108,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 118.2659,
                  "lat": 43.9746
                },
                {
                  "lon": 117.7661,
                  "lat": 43.9746
                },
                {
                  "lon": 117.7661,
                  "lat": 43.7948
                },
                {
                  "lon": 118.5158,
                  "lat": 43.7948
                },
                {
                  "lon": 118.5158,
                  "lat": 43.9746
                },
                {
                  "lon": 118.2659,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 110.7629,
                  "lat": 29.4108
                },
                {
                  "lon": 110.7629,
                  "lat": 29.231
                },
                {
                  "lon": 110.1434,
                  "lat": 29.231
                },
                {
                  "lon": 110.1434,
                  "lat": 29.4108
                },
                {
                  "lon": 110.7629,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 118.0194,
                  "lat": 41.2776
                },
                {
                  "lon": 112.2762,
                  "lat": 41.2776
                },
                {
                  "lon": 112.2762,
                  "lat": 41.0978
                },
                {
                  "lon": 126.6342,
                  "lat": 41.0978
                },
                {
                  "lon": 126.6342,
                  "lat": 41.2776
                },
                {
                  "lon": 118.0194,
                  "lat": 41.2776
                }
              ],
              [
                {
                  "lon": 114.6895,
                  "lat": 36.0634
                },
                {
                  "lon": 112.4595,
                  "lat": 36.0634
                },
                {
                  "lon": 112.4595,
                  "lat": 36.2432
                },
                {
                  "lon": 118.0345,
                  "lat": 36.2432
                },
                {
                  "lon": 118.0345,
                  "lat": 36.0634
                },
                {
                  "lon": 114.6895,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 106.5425,
                  "lat": 35.524
                },
                {
                  "lon": 108.7575,
                  "lat": 35.524
                },
                {
                  "lon": 108.7575,
                  "lat": 35.7038
                },
                {
                  "lon": 101.6695,
                  "lat": 35.7038
                },
                {
                  "lon": 101.6695,
                  "lat": 35.524
                },
                {
                  "lon": 106.5425,
                  "lat": 35.524
                }
              ],
              [
                {
                  "lon": 123.8202,
                  "lat": 45.9524
                },
                {
                  "lon": 124.0789,
                  "lat": 45.9524
                },
                {
                  "lon": 124.0789,
                  "lat": 45.7726
                },
                {
                  "lon": 121.2332,
                  "lat": 45.7726
                },
                {
                  "lon": 121.2332,
                  "lat": 45.9524
                },
                {
                  "lon": 123.8202,
                  "lat": 45.9524
                }
              ],
              [
                {
                  "lon": 116.9167,
                  "lat": 27.9724
                },
                {
                  "lon": 117.1203,
                  "lat": 27.9724
                },
                {
                  "lon": 117.1203,
                  "lat": 27.7926
                },
                {
                  "lon": 105.5151,
                  "lat": 27.7926
                },
                {
                  "lon": 105.5151,
                  "lat": 27.9724
                },
                {
                  "lon": 116.9167,
                  "lat": 27.9724
                }
              ],
              [
                {
                  "lon": 111.7905,
                  "lat": 36.2432
                },
                {
                  "lon": 112.2365,
                  "lat": 36.2432
                },
                {
                  "lon": 112.2365,
                  "lat": 36.0634
                },
                {
                  "lon": 110.4525,
                  "lat": 36.0634
                },
                {
                  "lon": 110.4525,
                  "lat": 36.2432
                },
                {
                  "lon": 111.7905,
                  "lat": 36.2432
                }
              ],
              [
                {
                  "lon": 111.7625,
                  "lat": 35.7038
                },
                {
                  "lon": 110.2085,
                  "lat": 35.7038
                },
                {
                  "lon": 110.2085,
                  "lat": 35.8836
                },
                {
                  "lon": 112.2065,
                  "lat": 35.8836
                },
                {
                  "lon": 112.2065,
                  "lat": 35.7038
                },
                {
                  "lon": 111.7625,
                  "lat": 35.7038
                }
              ],
              [
                {
                  "lon": 108.2081,
                  "lat": 41.2776
                },
                {
                  "lon": 107.7295,
                  "lat": 41.2776
                },
                {
                  "lon": 107.7295,
                  "lat": 41.0978
                },
                {
                  "lon": 108.6867,
                  "lat": 41.0978
                },
                {
                  "lon": 108.6867,
                  "lat": 41.2776
                },
                {
                  "lon": 108.2081,
                  "lat": 41.2776
                }
              ],
              [
                {
                  "lon": 118.6927,
                  "lat": 33.1866
                },
                {
                  "lon": 120.8457,
                  "lat": 33.1866
                },
                {
                  "lon": 120.8457,
                  "lat": 33.3664
                },
                {
                  "lon": 114.3867,
                  "lat": 33.3664
                },
                {
                  "lon": 114.3867,
                  "lat": 33.1866
                },
                {
                  "lon": 118.6927,
                  "lat": 33.1866
                }
              ],
              [
                {
                  "lon": 96.1014,
                  "lat": 29.4108
                },
                {
                  "lon": 97.3404,
                  "lat": 29.4108
                },
                {
                  "lon": 97.3404,
                  "lat": 29.231
                },
                {
                  "lon": 96.1014,
                  "lat": 29.231
                },
                {
                  "lon": 96.1014,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 124.0678,
                  "lat": 48.8292
                },
                {
                  "lon": 128.1658,
                  "lat": 48.8292
                },
                {
                  "lon": 128.1658,
                  "lat": 48.6494
                },
                {
                  "lon": 124.0678,
                  "lat": 48.6494
                },
                {
                  "lon": 124.0678,
                  "lat": 48.8292
                }
              ],
              [
                {
                  "lon": 127.4831,
                  "lat": 50.4474
                },
                {
                  "lon": 127.7666,
                  "lat": 50.4474
                },
                {
                  "lon": 127.7666,
                  "lat": 50.6272
                },
                {
                  "lon": 126.6326,
                  "lat": 50.6272
                },
                {
                  "lon": 126.6326,
                  "lat": 50.4474
                },
                {
                  "lon": 127.4831,
                  "lat": 50.4474
                }
              ],
              [
                {
                  "lon": 80.1494,
                  "lat": 41.0978
                },
                {
                  "lon": 78.9559,
                  "lat": 41.0978
                },
                {
                  "lon": 78.9559,
                  "lat": 40.918
                },
                {
                  "lon": 80.6268,
                  "lat": 40.918
                },
                {
                  "lon": 80.6268,
                  "lat": 41.0978
                },
                {
                  "lon": 80.1494,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 118.3948,
                  "lat": 39.12
                },
                {
                  "lon": 109.3546,
                  "lat": 39.12
                },
                {
                  "lon": 109.3546,
                  "lat": 38.9402
                },
                {
                  "lon": 119.322,
                  "lat": 38.9402
                },
                {
                  "lon": 119.322,
                  "lat": 39.12
                },
                {
                  "lon": 118.3948,
                  "lat": 39.12
                }
              ],
              [
                {
                  "lon": 133.6548,
                  "lat": 45.5928
                },
                {
                  "lon": 129.2858,
                  "lat": 45.5928
                },
                {
                  "lon": 129.2858,
                  "lat": 45.413
                },
                {
                  "lon": 133.9118,
                  "lat": 45.413
                },
                {
                  "lon": 133.9118,
                  "lat": 45.5928
                },
                {
                  "lon": 133.6548,
                  "lat": 45.5928
                }
              ],
              [
                {
                  "lon": 107.4008,
                  "lat": 33.3664
                },
                {
                  "lon": 108.9114,
                  "lat": 33.3664
                },
                {
                  "lon": 108.9114,
                  "lat": 33.5462
                },
                {
                  "lon": 104.3796,
                  "lat": 33.5462
                },
                {
                  "lon": 104.3796,
                  "lat": 33.3664
                },
                {
                  "lon": 107.4008,
                  "lat": 33.3664
                }
              ],
              [
                {
                  "lon": 91.5135,
                  "lat": 31.029
                },
                {
                  "lon": 91.7234,
                  "lat": 31.029
                },
                {
                  "lon": 91.7234,
                  "lat": 30.8492
                },
                {
                  "lon": 91.3036,
                  "lat": 30.8492
                },
                {
                  "lon": 91.3036,
                  "lat": 31.029
                },
                {
                  "lon": 91.5135,
                  "lat": 31.029
                }
              ],
              [
                {
                  "lon": 108.3093,
                  "lat": 25.4552
                },
                {
                  "lon": 108.3093,
                  "lat": 25.635
                },
                {
                  "lon": 107.1123,
                  "lat": 25.635
                },
                {
                  "lon": 107.1123,
                  "lat": 25.4552
                },
                {
                  "lon": 108.3093,
                  "lat": 25.4552
                }
              ],
              [
                {
                  "lon": 134.718,
                  "lat": 48.4696
                },
                {
                  "lon": 133.3615,
                  "lat": 48.4696
                },
                {
                  "lon": 133.3615,
                  "lat": 48.2898
                },
                {
                  "lon": 135.2606,
                  "lat": 48.2898
                },
                {
                  "lon": 135.2606,
                  "lat": 48.4696
                },
                {
                  "lon": 134.718,
                  "lat": 48.4696
                }
              ],
              [
                {
                  "lon": 111.1194,
                  "lat": 39.2998
                },
                {
                  "lon": 109.0278,
                  "lat": 39.2998
                },
                {
                  "lon": 109.0278,
                  "lat": 39.12
                },
                {
                  "lon": 119.7182,
                  "lat": 39.12
                },
                {
                  "lon": 119.7182,
                  "lat": 39.2998
                },
                {
                  "lon": 111.1194,
                  "lat": 39.2998
                }
              ],
              [
                {
                  "lon": 104.9135,
                  "lat": 33.1866
                },
                {
                  "lon": 104.4829,
                  "lat": 33.1866
                },
                {
                  "lon": 104.4829,
                  "lat": 33.3664
                },
                {
                  "lon": 108.3583,
                  "lat": 33.3664
                },
                {
                  "lon": 108.3583,
                  "lat": 33.1866
                },
                {
                  "lon": 104.9135,
                  "lat": 33.1866
                }
              ],
              [
                {
                  "lon": 117.9932,
                  "lat": 29.5906
                },
                {
                  "lon": 115.9212,
                  "lat": 29.5906
                },
                {
                  "lon": 115.9212,
                  "lat": 29.7704
                },
                {
                  "lon": 122.966,
                  "lat": 29.7704
                },
                {
                  "lon": 122.966,
                  "lat": 29.5906
                },
                {
                  "lon": 117.9932,
                  "lat": 29.5906
                }
              ],
              [
                {
                  "lon": 83.7019,
                  "lat": 43.615
                },
                {
                  "lon": 83.9511,
                  "lat": 43.615
                },
                {
                  "lon": 83.9511,
                  "lat": 43.7948
                },
                {
                  "lon": 80.9607,
                  "lat": 43.7948
                },
                {
                  "lon": 80.9607,
                  "lat": 43.615
                },
                {
                  "lon": 83.7019,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 130.3622,
                  "lat": 45.2332
                },
                {
                  "lon": 123.4664,
                  "lat": 45.2332
                },
                {
                  "lon": 123.4664,
                  "lat": 45.0534
                },
                {
                  "lon": 133.1716,
                  "lat": 45.0534
                },
                {
                  "lon": 133.1716,
                  "lat": 45.2332
                },
                {
                  "lon": 130.3622,
                  "lat": 45.2332
                }
              ],
              [
                {
                  "lon": 109.5536,
                  "lat": 32.2876
                },
                {
                  "lon": 107.848,
                  "lat": 32.2876
                },
                {
                  "lon": 107.848,
                  "lat": 32.4674
                },
                {
                  "lon": 110.4064,
                  "lat": 32.4674
                },
                {
                  "lon": 110.4064,
                  "lat": 32.2876
                },
                {
                  "lon": 109.5536,
                  "lat": 32.2876
                }
              ],
              [
                {
                  "lon": 101.3805,
                  "lat": 37.5018
                },
                {
                  "lon": 102.2873,
                  "lat": 37.5018
                },
                {
                  "lon": 102.2873,
                  "lat": 37.322
                },
                {
                  "lon": 101.1538,
                  "lat": 37.322
                },
                {
                  "lon": 101.1538,
                  "lat": 37.5018
                },
                {
                  "lon": 101.3805,
                  "lat": 37.5018
                }
              ],
              [
                {
                  "lon": 79.4145,
                  "lat": 40.3786
                },
                {
                  "lon": 79.4145,
                  "lat": 40.1988
                },
                {
                  "lon": 78.7062,
                  "lat": 40.1988
                },
                {
                  "lon": 78.7062,
                  "lat": 40.3786
                },
                {
                  "lon": 79.4145,
                  "lat": 40.3786
                }
              ],
              [
                {
                  "lon": 95.3455,
                  "lat": 36.6028
                },
                {
                  "lon": 96.0193,
                  "lat": 36.6028
                },
                {
                  "lon": 96.0193,
                  "lat": 36.7826
                },
                {
                  "lon": 94.6717,
                  "lat": 36.7826
                },
                {
                  "lon": 94.6717,
                  "lat": 36.6028
                },
                {
                  "lon": 95.3455,
                  "lat": 36.6028
                }
              ],
              [
                {
                  "lon": 112.067,
                  "lat": 40.5584
                },
                {
                  "lon": 121.563,
                  "lat": 40.5584
                },
                {
                  "lon": 121.563,
                  "lat": 40.7382
                },
                {
                  "lon": 108.2686,
                  "lat": 40.7382
                },
                {
                  "lon": 108.2686,
                  "lat": 40.5584
                },
                {
                  "lon": 112.067,
                  "lat": 40.5584
                }
              ],
              [
                {
                  "lon": 119.0678,
                  "lat": 30.4896
                },
                {
                  "lon": 115.9373,
                  "lat": 30.4896
                },
                {
                  "lon": 115.9373,
                  "lat": 30.3098
                },
                {
                  "lon": 121.5722,
                  "lat": 30.3098
                },
                {
                  "lon": 121.5722,
                  "lat": 30.4896
                },
                {
                  "lon": 119.0678,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 119.5192,
                  "lat": 29.0512
                },
                {
                  "lon": 118.0765,
                  "lat": 29.0512
                },
                {
                  "lon": 118.0765,
                  "lat": 29.231
                },
                {
                  "lon": 121.9924,
                  "lat": 29.231
                },
                {
                  "lon": 121.9924,
                  "lat": 29.0512
                },
                {
                  "lon": 119.5192,
                  "lat": 29.0512
                }
              ],
              [
                {
                  "lon": 113.8421,
                  "lat": 29.0512
                },
                {
                  "lon": 112.6079,
                  "lat": 29.0512
                },
                {
                  "lon": 112.6079,
                  "lat": 28.8714
                },
                {
                  "lon": 114.2535,
                  "lat": 28.8714
                },
                {
                  "lon": 114.2535,
                  "lat": 29.0512
                },
                {
                  "lon": 113.8421,
                  "lat": 29.0512
                }
              ],
              [
                {
                  "lon": 111.8103,
                  "lat": 22.5784
                },
                {
                  "lon": 116.2953,
                  "lat": 22.5784
                },
                {
                  "lon": 116.2953,
                  "lat": 22.7582
                },
                {
                  "lon": 110.6403,
                  "lat": 22.7582
                },
                {
                  "lon": 110.6403,
                  "lat": 22.5784
                },
                {
                  "lon": 111.8103,
                  "lat": 22.5784
                }
              ],
              [
                {
                  "lon": 116.9551,
                  "lat": 29.9502
                },
                {
                  "lon": 116.1235,
                  "lat": 29.9502
                },
                {
                  "lon": 116.1235,
                  "lat": 30.13
                },
                {
                  "lon": 122.9842,
                  "lat": 30.13
                },
                {
                  "lon": 122.9842,
                  "lat": 29.9502
                },
                {
                  "lon": 116.9551,
                  "lat": 29.9502
                }
              ],
              [
                {
                  "lon": 113.2276,
                  "lat": 29.7704
                },
                {
                  "lon": 113.2276,
                  "lat": 29.5906
                },
                {
                  "lon": 112.3988,
                  "lat": 29.5906
                },
                {
                  "lon": 112.3988,
                  "lat": 29.7704
                },
                {
                  "lon": 113.2276,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 119.3812,
                  "lat": 48.8292
                },
                {
                  "lon": 119.107,
                  "lat": 48.8292
                },
                {
                  "lon": 119.107,
                  "lat": 49.009
                },
                {
                  "lon": 121.849,
                  "lat": 49.009
                },
                {
                  "lon": 121.849,
                  "lat": 48.8292
                },
                {
                  "lon": 119.3812,
                  "lat": 48.8292
                }
              ],
              [
                {
                  "lon": 125.7595,
                  "lat": 46.6716
                },
                {
                  "lon": 125.7595,
                  "lat": 46.4918
                },
                {
                  "lon": 124.7111,
                  "lat": 46.4918
                },
                {
                  "lon": 124.7111,
                  "lat": 46.6716
                },
                {
                  "lon": 125.7595,
                  "lat": 46.6716
                }
              ],
              [
                {
                  "lon": 129.1122,
                  "lat": 43.4352
                },
                {
                  "lon": 129.3599,
                  "lat": 43.4352
                },
                {
                  "lon": 129.3599,
                  "lat": 43.2554
                },
                {
                  "lon": 127.1306,
                  "lat": 43.2554
                },
                {
                  "lon": 127.1306,
                  "lat": 43.4352
                },
                {
                  "lon": 129.1122,
                  "lat": 43.4352
                }
              ],
              [
                {
                  "lon": 128.6697,
                  "lat": 42.8958
                },
                {
                  "lon": 128.4235,
                  "lat": 42.8958
                },
                {
                  "lon": 128.4235,
                  "lat": 43.0756
                },
                {
                  "lon": 131.1317,
                  "lat": 43.0756
                },
                {
                  "lon": 131.1317,
                  "lat": 42.8958
                },
                {
                  "lon": 128.6697,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 109.7684,
                  "lat": 37.322
                },
                {
                  "lon": 119.2898,
                  "lat": 37.322
                },
                {
                  "lon": 119.2898,
                  "lat": 37.5018
                },
                {
                  "lon": 109.315,
                  "lat": 37.5018
                },
                {
                  "lon": 109.315,
                  "lat": 37.322
                },
                {
                  "lon": 109.7684,
                  "lat": 37.322
                }
              ],
              [
                {
                  "lon": 110.5081,
                  "lat": 31.029
                },
                {
                  "lon": 109.2463,
                  "lat": 31.029
                },
                {
                  "lon": 109.2463,
                  "lat": 31.2088
                },
                {
                  "lon": 110.7184,
                  "lat": 31.2088
                },
                {
                  "lon": 110.7184,
                  "lat": 31.029
                },
                {
                  "lon": 110.5081,
                  "lat": 31.029
                }
              ],
              [
                {
                  "lon": 96.5303,
                  "lat": 37.1422
                },
                {
                  "lon": 96.5303,
                  "lat": 37.322
                },
                {
                  "lon": 95.1731,
                  "lat": 37.322
                },
                {
                  "lon": 95.1731,
                  "lat": 37.1422
                },
                {
                  "lon": 96.5303,
                  "lat": 37.1422
                }
              ],
              [
                {
                  "lon": 126.2169,
                  "lat": 52.4252
                },
                {
                  "lon": 122.9598,
                  "lat": 52.4252
                },
                {
                  "lon": 122.9598,
                  "lat": 52.605
                },
                {
                  "lon": 126.8091,
                  "lat": 52.605
                },
                {
                  "lon": 126.8091,
                  "lat": 52.4252
                },
                {
                  "lon": 126.2169,
                  "lat": 52.4252
                }
              ],
              [
                {
                  "lon": 88.7228,
                  "lat": 44.3342
                },
                {
                  "lon": 86.4602,
                  "lat": 44.3342
                },
                {
                  "lon": 86.4602,
                  "lat": 44.1544
                },
                {
                  "lon": 89.477,
                  "lat": 44.1544
                },
                {
                  "lon": 89.477,
                  "lat": 44.3342
                },
                {
                  "lon": 88.7228,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 129.2218,
                  "lat": 49.3686
                },
                {
                  "lon": 126.1726,
                  "lat": 49.3686
                },
                {
                  "lon": 126.1726,
                  "lat": 49.5484
                },
                {
                  "lon": 129.499,
                  "lat": 49.5484
                },
                {
                  "lon": 129.499,
                  "lat": 49.3686
                },
                {
                  "lon": 129.2218,
                  "lat": 49.3686
                }
              ],
              [
                {
                  "lon": 115.5607,
                  "lat": 41.4574
                },
                {
                  "lon": 126.8407,
                  "lat": 41.4574
                },
                {
                  "lon": 126.8407,
                  "lat": 41.2776
                },
                {
                  "lon": 115.3207,
                  "lat": 41.2776
                },
                {
                  "lon": 115.3207,
                  "lat": 41.4574
                },
                {
                  "lon": 115.5607,
                  "lat": 41.4574
                }
              ],
              [
                {
                  "lon": 110.9313,
                  "lat": 27.6128
                },
                {
                  "lon": 109.7115,
                  "lat": 27.6128
                },
                {
                  "lon": 109.7115,
                  "lat": 27.7926
                },
                {
                  "lon": 117.0303,
                  "lat": 27.7926
                },
                {
                  "lon": 117.0303,
                  "lat": 27.6128
                },
                {
                  "lon": 110.9313,
                  "lat": 27.6128
                }
              ],
              [
                {
                  "lon": 115.701,
                  "lat": 23.837
                },
                {
                  "lon": 115.8979,
                  "lat": 23.837
                },
                {
                  "lon": 115.8979,
                  "lat": 24.0168
                },
                {
                  "lon": 115.3072,
                  "lat": 24.0168
                },
                {
                  "lon": 115.3072,
                  "lat": 23.837
                },
                {
                  "lon": 115.701,
                  "lat": 23.837
                }
              ],
              [
                {
                  "lon": 125.2179,
                  "lat": 40.3786
                },
                {
                  "lon": 125.6901,
                  "lat": 40.3786
                },
                {
                  "lon": 125.6901,
                  "lat": 40.1988
                },
                {
                  "lon": 121.6764,
                  "lat": 40.1988
                },
                {
                  "lon": 121.6764,
                  "lat": 40.3786
                },
                {
                  "lon": 125.2179,
                  "lat": 40.3786
                }
              ],
              [
                {
                  "lon": 106.4407,
                  "lat": 41.4574
                },
                {
                  "lon": 108.6007,
                  "lat": 41.4574
                },
                {
                  "lon": 108.6007,
                  "lat": 41.2776
                },
                {
                  "lon": 106.4407,
                  "lat": 41.2776
                },
                {
                  "lon": 106.4407,
                  "lat": 41.4574
                }
              ],
              [
                {
                  "lon": 126.8079,
                  "lat": 46.4918
                },
                {
                  "lon": 126.0216,
                  "lat": 46.4918
                },
                {
                  "lon": 126.0216,
                  "lat": 46.6716
                },
                {
                  "lon": 127.8563,
                  "lat": 46.6716
                },
                {
                  "lon": 127.8563,
                  "lat": 46.4918
                },
                {
                  "lon": 126.8079,
                  "lat": 46.4918
                }
              ],
              [
                {
                  "lon": 113.4404,
                  "lat": 28.5118
                },
                {
                  "lon": 113.2354,
                  "lat": 28.5118
                },
                {
                  "lon": 113.2354,
                  "lat": 28.6916
                },
                {
                  "lon": 114.0554,
                  "lat": 28.6916
                },
                {
                  "lon": 114.0554,
                  "lat": 28.5118
                },
                {
                  "lon": 113.4404,
                  "lat": 28.5118
                }
              ],
              [
                {
                  "lon": 91.3519,
                  "lat": 29.231
                },
                {
                  "lon": 90.1129,
                  "lat": 29.231
                },
                {
                  "lon": 90.1129,
                  "lat": 29.4108
                },
                {
                  "lon": 92.5909,
                  "lat": 29.4108
                },
                {
                  "lon": 92.5909,
                  "lat": 29.231
                },
                {
                  "lon": 91.3519,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 132.8337,
                  "lat": 46.312
                },
                {
                  "lon": 133.6173,
                  "lat": 46.312
                },
                {
                  "lon": 133.6173,
                  "lat": 46.4918
                },
                {
                  "lon": 129.1769,
                  "lat": 46.4918
                },
                {
                  "lon": 129.1769,
                  "lat": 46.312
                },
                {
                  "lon": 132.8337,
                  "lat": 46.312
                }
              ],
              [
                {
                  "lon": 126.9065,
                  "lat": 50.6272
                },
                {
                  "lon": 126.9065,
                  "lat": 50.807
                },
                {
                  "lon": 127.1911,
                  "lat": 50.807
                },
                {
                  "lon": 127.1911,
                  "lat": 50.6272
                },
                {
                  "lon": 126.9065,
                  "lat": 50.6272
                }
              ],
              [
                {
                  "lon": 92.0056,
                  "lat": 30.4896
                },
                {
                  "lon": 92.4238,
                  "lat": 30.4896
                },
                {
                  "lon": 92.4238,
                  "lat": 30.6694
                },
                {
                  "lon": 90.751,
                  "lat": 30.6694
                },
                {
                  "lon": 90.751,
                  "lat": 30.4896
                },
                {
                  "lon": 92.0056,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 106.1263,
                  "lat": 36.7826
                },
                {
                  "lon": 100.7359,
                  "lat": 36.7826
                },
                {
                  "lon": 100.7359,
                  "lat": 36.6028
                },
                {
                  "lon": 107.0247,
                  "lat": 36.6028
                },
                {
                  "lon": 107.0247,
                  "lat": 36.7826
                },
                {
                  "lon": 106.1263,
                  "lat": 36.7826
                }
              ],
              [
                {
                  "lon": 125.2881,
                  "lat": 47.9302
                },
                {
                  "lon": 127.9721,
                  "lat": 47.9302
                },
                {
                  "lon": 127.9721,
                  "lat": 47.7504
                },
                {
                  "lon": 122.0673,
                  "lat": 47.7504
                },
                {
                  "lon": 122.0673,
                  "lat": 47.9302
                },
                {
                  "lon": 125.2881,
                  "lat": 47.9302
                }
              ],
              [
                {
                  "lon": 109.2053,
                  "lat": 37.6816
                },
                {
                  "lon": 106.2517,
                  "lat": 37.6816
                },
                {
                  "lon": 106.2517,
                  "lat": 37.5018
                },
                {
                  "lon": 119.2021,
                  "lat": 37.5018
                },
                {
                  "lon": 119.2021,
                  "lat": 37.6816
                },
                {
                  "lon": 109.2053,
                  "lat": 37.6816
                }
              ],
              [
                {
                  "lon": 131.9981,
                  "lat": 47.7504
                },
                {
                  "lon": 135.4873,
                  "lat": 47.7504
                },
                {
                  "lon": 135.4873,
                  "lat": 47.9302
                },
                {
                  "lon": 130.1193,
                  "lat": 47.9302
                },
                {
                  "lon": 130.1193,
                  "lat": 47.7504
                },
                {
                  "lon": 131.9981,
                  "lat": 47.7504
                }
              ],
              [
                {
                  "lon": 109.253,
                  "lat": 21.14
                },
                {
                  "lon": 110.7954,
                  "lat": 21.14
                },
                {
                  "lon": 110.7954,
                  "lat": 20.9602
                },
                {
                  "lon": 109.253,
                  "lat": 20.9602
                },
                {
                  "lon": 109.253,
                  "lat": 21.14
                }
              ],
              [
                {
                  "lon": 117.4855,
                  "lat": 42.716
                },
                {
                  "lon": 117.7303,
                  "lat": 42.716
                },
                {
                  "lon": 117.7303,
                  "lat": 42.5362
                },
                {
                  "lon": 117.4855,
                  "lat": 42.5362
                },
                {
                  "lon": 117.4855,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 114.1126,
                  "lat": 40.918
                },
                {
                  "lon": 121.4906,
                  "lat": 40.918
                },
                {
                  "lon": 121.4906,
                  "lat": 40.7382
                },
                {
                  "lon": 106.7346,
                  "lat": 40.7382
                },
                {
                  "lon": 106.7346,
                  "lat": 40.918
                },
                {
                  "lon": 114.1126,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 107.9883,
                  "lat": 25.8148
                },
                {
                  "lon": 104.1921,
                  "lat": 25.8148
                },
                {
                  "lon": 104.1921,
                  "lat": 25.635
                },
                {
                  "lon": 108.7875,
                  "lat": 25.635
                },
                {
                  "lon": 108.7875,
                  "lat": 25.8148
                },
                {
                  "lon": 107.9883,
                  "lat": 25.8148
                }
              ],
              [
                {
                  "lon": 108.6996,
                  "lat": 29.0512
                },
                {
                  "lon": 109.3167,
                  "lat": 29.0512
                },
                {
                  "lon": 109.3167,
                  "lat": 28.8714
                },
                {
                  "lon": 108.4939,
                  "lat": 28.8714
                },
                {
                  "lon": 108.4939,
                  "lat": 29.0512
                },
                {
                  "lon": 108.6996,
                  "lat": 29.0512
                }
              ],
              [
                {
                  "lon": 89.9197,
                  "lat": 42.716
                },
                {
                  "lon": 88.2012,
                  "lat": 42.716
                },
                {
                  "lon": 88.2012,
                  "lat": 42.8958
                },
                {
                  "lon": 89.9197,
                  "lat": 42.8958
                },
                {
                  "lon": 89.9197,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 127.2353,
                  "lat": 50.2676
                },
                {
                  "lon": 126.6725,
                  "lat": 50.2676
                },
                {
                  "lon": 126.6725,
                  "lat": 50.0878
                },
                {
                  "lon": 128.6423,
                  "lat": 50.0878
                },
                {
                  "lon": 128.6423,
                  "lat": 50.2676
                },
                {
                  "lon": 127.2353,
                  "lat": 50.2676
                }
              ],
              [
                {
                  "lon": 109.5505,
                  "lat": 33.0068
                },
                {
                  "lon": 109.1207,
                  "lat": 33.0068
                },
                {
                  "lon": 109.1207,
                  "lat": 33.1866
                },
                {
                  "lon": 110.4101,
                  "lat": 33.1866
                },
                {
                  "lon": 110.4101,
                  "lat": 33.0068
                },
                {
                  "lon": 109.5505,
                  "lat": 33.0068
                }
              ],
              [
                {
                  "lon": 114.8928,
                  "lat": 25.635
                },
                {
                  "lon": 116.0898,
                  "lat": 25.635
                },
                {
                  "lon": 116.0898,
                  "lat": 25.4552
                },
                {
                  "lon": 113.6958,
                  "lat": 25.4552
                },
                {
                  "lon": 113.6958,
                  "lat": 25.635
                },
                {
                  "lon": 114.8928,
                  "lat": 25.635
                }
              ],
              [
                {
                  "lon": 110.8664,
                  "lat": 20.0612
                },
                {
                  "lon": 109.3328,
                  "lat": 20.0612
                },
                {
                  "lon": 109.3328,
                  "lat": 20.241
                },
                {
                  "lon": 111.0581,
                  "lat": 20.241
                },
                {
                  "lon": 111.0581,
                  "lat": 20.0612
                },
                {
                  "lon": 110.8664,
                  "lat": 20.0612
                }
              ],
              [
                {
                  "lon": 110.9739,
                  "lat": 22.5784
                },
                {
                  "lon": 115.8439,
                  "lat": 22.5784
                },
                {
                  "lon": 115.8439,
                  "lat": 22.3986
                },
                {
                  "lon": 110.1947,
                  "lat": 22.3986
                },
                {
                  "lon": 110.1947,
                  "lat": 22.5784
                },
                {
                  "lon": 110.9739,
                  "lat": 22.5784
                }
              ],
              [
                {
                  "lon": 75.1958,
                  "lat": 39.4796
                },
                {
                  "lon": 77.2982,
                  "lat": 39.4796
                },
                {
                  "lon": 77.2982,
                  "lat": 39.6594
                },
                {
                  "lon": 75.1958,
                  "lat": 39.6594
                },
                {
                  "lon": 75.1958,
                  "lat": 39.4796
                }
              ],
              [
                {
                  "lon": 110.5518,
                  "lat": 19.1622
                },
                {
                  "lon": 108.074,
                  "lat": 19.1622
                },
                {
                  "lon": 108.074,
                  "lat": 19.342
                },
                {
                  "lon": 110.933,
                  "lat": 19.342
                },
                {
                  "lon": 110.933,
                  "lat": 19.1622
                },
                {
                  "lon": 110.5518,
                  "lat": 19.1622
                }
              ],
              [
                {
                  "lon": 102.8391,
                  "lat": 24.736
                },
                {
                  "lon": 103.2357,
                  "lat": 24.736
                },
                {
                  "lon": 103.2357,
                  "lat": 24.9158
                },
                {
                  "lon": 102.2442,
                  "lat": 24.9158
                },
                {
                  "lon": 102.2442,
                  "lat": 24.736
                },
                {
                  "lon": 102.8391,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 80.4493,
                  "lat": 41.0978
                },
                {
                  "lon": 78.7742,
                  "lat": 41.0978
                },
                {
                  "lon": 78.7742,
                  "lat": 41.2776
                },
                {
                  "lon": 80.6886,
                  "lat": 41.2776
                },
                {
                  "lon": 80.6886,
                  "lat": 41.0978
                },
                {
                  "lon": 80.4493,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 90.4356,
                  "lat": 29.5906
                },
                {
                  "lon": 90.4356,
                  "lat": 29.7704
                },
                {
                  "lon": 91.6788,
                  "lat": 29.7704
                },
                {
                  "lon": 91.6788,
                  "lat": 29.5906
                },
                {
                  "lon": 90.4356,
                  "lat": 29.5906
                }
              ],
              [
                {
                  "lon": 88.5391,
                  "lat": 42.8958
                },
                {
                  "lon": 88.2929,
                  "lat": 42.8958
                },
                {
                  "lon": 88.2929,
                  "lat": 43.0756
                },
                {
                  "lon": 90.2625,
                  "lat": 43.0756
                },
                {
                  "lon": 90.2625,
                  "lat": 42.8958
                },
                {
                  "lon": 88.5391,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 114.486,
                  "lat": 38.5806
                },
                {
                  "lon": 111.2646,
                  "lat": 38.5806
                },
                {
                  "lon": 111.2646,
                  "lat": 38.4008
                },
                {
                  "lon": 118.1676,
                  "lat": 38.4008
                },
                {
                  "lon": 118.1676,
                  "lat": 38.5806
                },
                {
                  "lon": 114.486,
                  "lat": 38.5806
                }
              ],
              [
                {
                  "lon": 116.8455,
                  "lat": 43.615
                },
                {
                  "lon": 117.0947,
                  "lat": 43.615
                },
                {
                  "lon": 117.0947,
                  "lat": 43.7948
                },
                {
                  "lon": 115.8487,
                  "lat": 43.7948
                },
                {
                  "lon": 115.8487,
                  "lat": 43.615
                },
                {
                  "lon": 116.8455,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 106.4216,
                  "lat": 34.2654
                },
                {
                  "lon": 106.6397,
                  "lat": 34.2654
                },
                {
                  "lon": 106.6397,
                  "lat": 34.4452
                },
                {
                  "lon": 104.8949,
                  "lat": 34.4452
                },
                {
                  "lon": 104.8949,
                  "lat": 34.2654
                },
                {
                  "lon": 106.4216,
                  "lat": 34.2654
                }
              ],
              [
                {
                  "lon": 109.1518,
                  "lat": 30.4896
                },
                {
                  "lon": 108.9427,
                  "lat": 30.4896
                },
                {
                  "lon": 108.9427,
                  "lat": 30.6694
                },
                {
                  "lon": 109.7791,
                  "lat": 30.6694
                },
                {
                  "lon": 109.7791,
                  "lat": 30.4896
                },
                {
                  "lon": 109.1518,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 116.9544,
                  "lat": 40.1988
                },
                {
                  "lon": 106.566,
                  "lat": 40.1988
                },
                {
                  "lon": 106.566,
                  "lat": 40.3786
                },
                {
                  "lon": 120.9681,
                  "lat": 40.3786
                },
                {
                  "lon": 120.9681,
                  "lat": 40.1988
                },
                {
                  "lon": 116.9544,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 118.4805,
                  "lat": 36.0634
                },
                {
                  "lon": 120.9335,
                  "lat": 36.0634
                },
                {
                  "lon": 120.9335,
                  "lat": 36.2432
                },
                {
                  "lon": 118.2575,
                  "lat": 36.2432
                },
                {
                  "lon": 118.2575,
                  "lat": 36.0634
                },
                {
                  "lon": 118.4805,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 108.8406,
                  "lat": 27.2532
                },
                {
                  "lon": 108.6383,
                  "lat": 27.2532
                },
                {
                  "lon": 108.6383,
                  "lat": 27.0734
                },
                {
                  "lon": 109.2452,
                  "lat": 27.0734
                },
                {
                  "lon": 109.2452,
                  "lat": 27.2532
                },
                {
                  "lon": 108.8406,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 115.9004,
                  "lat": 28.6916
                },
                {
                  "lon": 115.4904,
                  "lat": 28.6916
                },
                {
                  "lon": 115.4904,
                  "lat": 28.5118
                },
                {
                  "lon": 116.5154,
                  "lat": 28.5118
                },
                {
                  "lon": 116.5154,
                  "lat": 28.6916
                },
                {
                  "lon": 115.9004,
                  "lat": 28.6916
                }
              ],
              [
                {
                  "lon": 104.33,
                  "lat": 35.3442
                },
                {
                  "lon": 101.684,
                  "lat": 35.3442
                },
                {
                  "lon": 101.684,
                  "lat": 35.1644
                },
                {
                  "lon": 104.9915,
                  "lat": 35.1644
                },
                {
                  "lon": 104.9915,
                  "lat": 35.3442
                },
                {
                  "lon": 104.33,
                  "lat": 35.3442
                }
              ],
              [
                {
                  "lon": 124.6799,
                  "lat": 48.2898
                },
                {
                  "lon": 122.5095,
                  "lat": 48.2898
                },
                {
                  "lon": 122.5095,
                  "lat": 48.4696
                },
                {
                  "lon": 127.1216,
                  "lat": 48.4696
                },
                {
                  "lon": 127.1216,
                  "lat": 48.2898
                },
                {
                  "lon": 124.6799,
                  "lat": 48.2898
                }
              ],
              [
                {
                  "lon": 108.2611,
                  "lat": 33.1866
                },
                {
                  "lon": 104.3929,
                  "lat": 33.1866
                },
                {
                  "lon": 104.3929,
                  "lat": 33.0068
                },
                {
                  "lon": 108.9058,
                  "lat": 33.0068
                },
                {
                  "lon": 108.9058,
                  "lat": 33.1866
                },
                {
                  "lon": 108.2611,
                  "lat": 33.1866
                }
              ],
              [
                {
                  "lon": 117.8853,
                  "lat": 25.635
                },
                {
                  "lon": 117.2868,
                  "lat": 25.635
                },
                {
                  "lon": 117.2868,
                  "lat": 25.4552
                },
                {
                  "lon": 120.0798,
                  "lat": 25.4552
                },
                {
                  "lon": 120.0798,
                  "lat": 25.635
                },
                {
                  "lon": 117.8853,
                  "lat": 25.635
                }
              ],
              [
                {
                  "lon": 102.0085,
                  "lat": 35.3442
                },
                {
                  "lon": 109.5225,
                  "lat": 35.3442
                },
                {
                  "lon": 109.5225,
                  "lat": 35.524
                },
                {
                  "lon": 100.0195,
                  "lat": 35.524
                },
                {
                  "lon": 100.0195,
                  "lat": 35.3442
                },
                {
                  "lon": 102.0085,
                  "lat": 35.3442
                }
              ],
              [
                {
                  "lon": 122.5334,
                  "lat": 29.4108
                },
                {
                  "lon": 122.5334,
                  "lat": 29.231
                },
                {
                  "lon": 117.9904,
                  "lat": 29.231
                },
                {
                  "lon": 117.9904,
                  "lat": 29.4108
                },
                {
                  "lon": 122.5334,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 116.8907,
                  "lat": 42.3564
                },
                {
                  "lon": 116.6473,
                  "lat": 42.3564
                },
                {
                  "lon": 116.6473,
                  "lat": 42.1766
                },
                {
                  "lon": 122.2455,
                  "lat": 42.1766
                },
                {
                  "lon": 122.2455,
                  "lat": 42.3564
                },
                {
                  "lon": 116.8907,
                  "lat": 42.3564
                }
              ],
              [
                {
                  "lon": 121.4335,
                  "lat": 43.2554
                },
                {
                  "lon": 120.4427,
                  "lat": 43.2554
                },
                {
                  "lon": 120.4427,
                  "lat": 43.4352
                },
                {
                  "lon": 126.1398,
                  "lat": 43.4352
                },
                {
                  "lon": 126.1398,
                  "lat": 43.2554
                },
                {
                  "lon": 121.4335,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 104.2205,
                  "lat": 35.1644
                },
                {
                  "lon": 110.1605,
                  "lat": 35.1644
                },
                {
                  "lon": 110.1605,
                  "lat": 34.9846
                },
                {
                  "lon": 103.5605,
                  "lat": 34.9846
                },
                {
                  "lon": 103.5605,
                  "lat": 35.1644
                },
                {
                  "lon": 104.2205,
                  "lat": 35.1644
                }
              ],
              [
                {
                  "lon": 119.0489,
                  "lat": 27.2532
                },
                {
                  "lon": 119.0489,
                  "lat": 27.433
                },
                {
                  "lon": 120.6697,
                  "lat": 27.433
                },
                {
                  "lon": 120.6697,
                  "lat": 27.2532
                },
                {
                  "lon": 119.0489,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 112.3955,
                  "lat": 35.3442
                },
                {
                  "lon": 112.3955,
                  "lat": 35.524
                },
                {
                  "lon": 119.9095,
                  "lat": 35.524
                },
                {
                  "lon": 119.9095,
                  "lat": 35.3442
                },
                {
                  "lon": 112.3955,
                  "lat": 35.3442
                }
              ],
              [
                {
                  "lon": 115.0443,
                  "lat": 24.736
                },
                {
                  "lon": 115.6383,
                  "lat": 24.736
                },
                {
                  "lon": 115.6383,
                  "lat": 24.5562
                },
                {
                  "lon": 114.2523,
                  "lat": 24.5562
                },
                {
                  "lon": 114.2523,
                  "lat": 24.736
                },
                {
                  "lon": 115.0443,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 97.4631,
                  "lat": 40.3786
                },
                {
                  "lon": 97.4631,
                  "lat": 40.5584
                },
                {
                  "lon": 94.6227,
                  "lat": 40.5584
                },
                {
                  "lon": 94.6227,
                  "lat": 40.3786
                },
                {
                  "lon": 97.4631,
                  "lat": 40.3786
                }
              ],
              [
                {
                  "lon": 105.6411,
                  "lat": 25.4552
                },
                {
                  "lon": 106.4379,
                  "lat": 25.4552
                },
                {
                  "lon": 106.4379,
                  "lat": 25.2754
                },
                {
                  "lon": 101.6571,
                  "lat": 25.2754
                },
                {
                  "lon": 101.6571,
                  "lat": 25.4552
                },
                {
                  "lon": 105.6411,
                  "lat": 25.4552
                }
              ],
              [
                {
                  "lon": 124.2847,
                  "lat": 41.817
                },
                {
                  "lon": 128.1567,
                  "lat": 41.817
                },
                {
                  "lon": 128.1567,
                  "lat": 41.9968
                },
                {
                  "lon": 122.8327,
                  "lat": 41.9968
                },
                {
                  "lon": 122.8327,
                  "lat": 41.817
                },
                {
                  "lon": 124.2847,
                  "lat": 41.817
                }
              ],
              [
                {
                  "lon": 115.893,
                  "lat": 36.0634
                },
                {
                  "lon": 112.5555,
                  "lat": 36.0634
                },
                {
                  "lon": 112.5555,
                  "lat": 35.8836
                },
                {
                  "lon": 121.0105,
                  "lat": 35.8836
                },
                {
                  "lon": 121.0105,
                  "lat": 36.0634
                },
                {
                  "lon": 115.893,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 76.6174,
                  "lat": 38.9402
                },
                {
                  "lon": 76.6174,
                  "lat": 38.7604
                },
                {
                  "lon": 75.4614,
                  "lat": 38.7604
                },
                {
                  "lon": 75.4614,
                  "lat": 38.9402
                },
                {
                  "lon": 76.6174,
                  "lat": 38.9402
                }
              ],
              [
                {
                  "lon": 128.0781,
                  "lat": 50.0878
                },
                {
                  "lon": 128.0781,
                  "lat": 49.908
                },
                {
                  "lon": 128.3584,
                  "lat": 49.908
                },
                {
                  "lon": 128.3584,
                  "lat": 50.0878
                },
                {
                  "lon": 128.0781,
                  "lat": 50.0878
                }
              ],
              [
                {
                  "lon": 109.4015,
                  "lat": 35.1644
                },
                {
                  "lon": 109.4015,
                  "lat": 35.3442
                },
                {
                  "lon": 109.8425,
                  "lat": 35.3442
                },
                {
                  "lon": 109.8425,
                  "lat": 35.1644
                },
                {
                  "lon": 109.4015,
                  "lat": 35.1644
                }
              ],
              [
                {
                  "lon": 124.2734,
                  "lat": 51.1666
                },
                {
                  "lon": 123.6976,
                  "lat": 51.1666
                },
                {
                  "lon": 123.6976,
                  "lat": 51.3464
                },
                {
                  "lon": 125.1371,
                  "lat": 51.3464
                },
                {
                  "lon": 125.1371,
                  "lat": 51.1666
                },
                {
                  "lon": 124.2734,
                  "lat": 51.1666
                }
              ],
              [
                {
                  "lon": 125.7627,
                  "lat": 42.8958
                },
                {
                  "lon": 127.2357,
                  "lat": 42.8958
                },
                {
                  "lon": 127.2357,
                  "lat": 42.716
                },
                {
                  "lon": 121.5892,
                  "lat": 42.716
                },
                {
                  "lon": 121.5892,
                  "lat": 42.8958
                },
                {
                  "lon": 125.7627,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 117.0105,
                  "lat": 25.0956
                },
                {
                  "lon": 119.7909,
                  "lat": 25.0956
                },
                {
                  "lon": 119.7909,
                  "lat": 24.9158
                },
                {
                  "lon": 116.8119,
                  "lat": 24.9158
                },
                {
                  "lon": 116.8119,
                  "lat": 25.0956
                },
                {
                  "lon": 117.0105,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 112.9648,
                  "lat": 32.2876
                },
                {
                  "lon": 111.6856,
                  "lat": 32.2876
                },
                {
                  "lon": 111.6856,
                  "lat": 32.4674
                },
                {
                  "lon": 121.706,
                  "lat": 32.4674
                },
                {
                  "lon": 121.706,
                  "lat": 32.2876
                },
                {
                  "lon": 112.9648,
                  "lat": 32.2876
                }
              ],
              [
                {
                  "lon": 118.769,
                  "lat": 26.8936
                },
                {
                  "lon": 120.3826,
                  "lat": 26.8936
                },
                {
                  "lon": 120.3826,
                  "lat": 26.7138
                },
                {
                  "lon": 118.1639,
                  "lat": 26.7138
                },
                {
                  "lon": 118.1639,
                  "lat": 26.8936
                },
                {
                  "lon": 118.769,
                  "lat": 26.8936
                }
              ],
              [
                {
                  "lon": 95.5205,
                  "lat": 36.9624
                },
                {
                  "lon": 94.3925,
                  "lat": 36.9624
                },
                {
                  "lon": 94.3925,
                  "lat": 37.1422
                },
                {
                  "lon": 95.5205,
                  "lat": 37.1422
                },
                {
                  "lon": 95.5205,
                  "lat": 36.9624
                }
              ],
              [
                {
                  "lon": 84.9127,
                  "lat": 41.6372
                },
                {
                  "lon": 84.9127,
                  "lat": 41.4574
                },
                {
                  "lon": 83.9503,
                  "lat": 41.4574
                },
                {
                  "lon": 83.9503,
                  "lat": 41.6372
                },
                {
                  "lon": 84.9127,
                  "lat": 41.6372
                }
              ],
              [
                {
                  "lon": 123.2513,
                  "lat": 45.9524
                },
                {
                  "lon": 121.4348,
                  "lat": 45.9524
                },
                {
                  "lon": 121.4348,
                  "lat": 46.1322
                },
                {
                  "lon": 131.2958,
                  "lat": 46.1322
                },
                {
                  "lon": 131.2958,
                  "lat": 45.9524
                },
                {
                  "lon": 123.2513,
                  "lat": 45.9524
                }
              ],
              [
                {
                  "lon": 122.6806,
                  "lat": 40.918
                },
                {
                  "lon": 121.7286,
                  "lat": 40.918
                },
                {
                  "lon": 121.7286,
                  "lat": 40.7382
                },
                {
                  "lon": 125.5366,
                  "lat": 40.7382
                },
                {
                  "lon": 125.5366,
                  "lat": 40.918
                },
                {
                  "lon": 122.6806,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 108.9822,
                  "lat": 26.7138
                },
                {
                  "lon": 105.9627,
                  "lat": 26.7138
                },
                {
                  "lon": 105.9627,
                  "lat": 26.534
                },
                {
                  "lon": 109.9887,
                  "lat": 26.534
                },
                {
                  "lon": 109.9887,
                  "lat": 26.7138
                },
                {
                  "lon": 108.9822,
                  "lat": 26.7138
                }
              ],
              [
                {
                  "lon": 83.1607,
                  "lat": 41.2776
                },
                {
                  "lon": 82.9207,
                  "lat": 41.2776
                },
                {
                  "lon": 82.9207,
                  "lat": 41.4574
                },
                {
                  "lon": 83.1607,
                  "lat": 41.4574
                },
                {
                  "lon": 83.1607,
                  "lat": 41.2776
                }
              ],
              [
                {
                  "lon": 94.3671,
                  "lat": 38.221
                },
                {
                  "lon": 95.0556,
                  "lat": 38.221
                },
                {
                  "lon": 95.0556,
                  "lat": 38.4008
                },
                {
                  "lon": 94.1376,
                  "lat": 38.4008
                },
                {
                  "lon": 94.1376,
                  "lat": 38.221
                },
                {
                  "lon": 94.3671,
                  "lat": 38.221
                }
              ],
              [
                {
                  "lon": 116.2917,
                  "lat": 24.0168
                },
                {
                  "lon": 118.2607,
                  "lat": 24.0168
                },
                {
                  "lon": 118.2607,
                  "lat": 23.837
                },
                {
                  "lon": 116.2917,
                  "lat": 23.837
                },
                {
                  "lon": 116.2917,
                  "lat": 24.0168
                }
              ],
              [
                {
                  "lon": 121.3301,
                  "lat": 37.322
                },
                {
                  "lon": 119.5165,
                  "lat": 37.322
                },
                {
                  "lon": 119.5165,
                  "lat": 37.5018
                },
                {
                  "lon": 122.917,
                  "lat": 37.5018
                },
                {
                  "lon": 122.917,
                  "lat": 37.322
                },
                {
                  "lon": 121.3301,
                  "lat": 37.322
                }
              ],
              [
                {
                  "lon": 79.0807,
                  "lat": 41.2776
                },
                {
                  "lon": 78.8407,
                  "lat": 41.2776
                },
                {
                  "lon": 78.8407,
                  "lat": 41.4574
                },
                {
                  "lon": 79.5607,
                  "lat": 41.4574
                },
                {
                  "lon": 79.5607,
                  "lat": 41.2776
                },
                {
                  "lon": 79.0807,
                  "lat": 41.2776
                }
              ],
              [
                {
                  "lon": 118.7112,
                  "lat": 24.5562
                },
                {
                  "lon": 119.3043,
                  "lat": 24.5562
                },
                {
                  "lon": 119.3043,
                  "lat": 24.3764
                },
                {
                  "lon": 116.9319,
                  "lat": 24.3764
                },
                {
                  "lon": 116.9319,
                  "lat": 24.5562
                },
                {
                  "lon": 118.7112,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 107.5564,
                  "lat": 40.7382
                },
                {
                  "lon": 107.7938,
                  "lat": 40.7382
                },
                {
                  "lon": 107.7938,
                  "lat": 40.5584
                },
                {
                  "lon": 106.8442,
                  "lat": 40.5584
                },
                {
                  "lon": 106.8442,
                  "lat": 40.7382
                },
                {
                  "lon": 107.5564,
                  "lat": 40.7382
                }
              ],
              [
                {
                  "lon": 117.8736,
                  "lat": 29.4108
                },
                {
                  "lon": 122.4232,
                  "lat": 29.4108
                },
                {
                  "lon": 122.4232,
                  "lat": 29.5906
                },
                {
                  "lon": 115.392,
                  "lat": 29.5906
                },
                {
                  "lon": 115.392,
                  "lat": 29.4108
                },
                {
                  "lon": 117.8736,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 124.2288,
                  "lat": 51.8858
                },
                {
                  "lon": 123.9374,
                  "lat": 51.8858
                },
                {
                  "lon": 123.9374,
                  "lat": 51.706
                },
                {
                  "lon": 125.103,
                  "lat": 51.706
                },
                {
                  "lon": 125.103,
                  "lat": 51.8858
                },
                {
                  "lon": 124.2288,
                  "lat": 51.8858
                }
              ],
              [
                {
                  "lon": 96.5809,
                  "lat": 29.9502
                },
                {
                  "lon": 97.6204,
                  "lat": 29.9502
                },
                {
                  "lon": 97.6204,
                  "lat": 30.13
                },
                {
                  "lon": 96.5809,
                  "lat": 30.13
                },
                {
                  "lon": 96.5809,
                  "lat": 29.9502
                }
              ],
              [
                {
                  "lon": 128.0767,
                  "lat": 43.615
                },
                {
                  "lon": 127.8283,
                  "lat": 43.615
                },
                {
                  "lon": 127.8283,
                  "lat": 43.4352
                },
                {
                  "lon": 129.3187,
                  "lat": 43.4352
                },
                {
                  "lon": 129.3187,
                  "lat": 43.615
                },
                {
                  "lon": 128.0767,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 116.1135,
                  "lat": 43.0756
                },
                {
                  "lon": 115.3749,
                  "lat": 43.0756
                },
                {
                  "lon": 115.3749,
                  "lat": 42.8958
                },
                {
                  "lon": 116.3597,
                  "lat": 42.8958
                },
                {
                  "lon": 116.3597,
                  "lat": 43.0756
                },
                {
                  "lon": 116.1135,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 106.4479,
                  "lat": 32.827
                },
                {
                  "lon": 106.2334,
                  "lat": 32.827
                },
                {
                  "lon": 106.2334,
                  "lat": 33.0068
                },
                {
                  "lon": 110.3089,
                  "lat": 33.0068
                },
                {
                  "lon": 110.3089,
                  "lat": 32.827
                },
                {
                  "lon": 106.4479,
                  "lat": 32.827
                }
              ],
              [
                {
                  "lon": 83.0262,
                  "lat": 44.3342
                },
                {
                  "lon": 81.0086,
                  "lat": 44.3342
                },
                {
                  "lon": 81.0086,
                  "lat": 44.514
                },
                {
                  "lon": 83.2784,
                  "lat": 44.514
                },
                {
                  "lon": 83.2784,
                  "lat": 44.3342
                },
                {
                  "lon": 83.0262,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 111.9328,
                  "lat": 24.1966
                },
                {
                  "lon": 112.9203,
                  "lat": 24.1966
                },
                {
                  "lon": 112.9203,
                  "lat": 24.3764
                },
                {
                  "lon": 111.9328,
                  "lat": 24.3764
                },
                {
                  "lon": 111.9328,
                  "lat": 24.1966
                }
              ],
              [
                {
                  "lon": 105.6651,
                  "lat": 25.9946
                },
                {
                  "lon": 108.2664,
                  "lat": 25.9946
                },
                {
                  "lon": 108.2664,
                  "lat": 25.8148
                },
                {
                  "lon": 103.8642,
                  "lat": 25.8148
                },
                {
                  "lon": 103.8642,
                  "lat": 25.9946
                },
                {
                  "lon": 105.6651,
                  "lat": 25.9946
                }
              ],
              [
                {
                  "lon": 105.9798,
                  "lat": 38.7604
                },
                {
                  "lon": 105.2862,
                  "lat": 38.7604
                },
                {
                  "lon": 105.2862,
                  "lat": 38.9402
                },
                {
                  "lon": 106.4422,
                  "lat": 38.9402
                },
                {
                  "lon": 106.4422,
                  "lat": 38.7604
                },
                {
                  "lon": 105.9798,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 106.4629,
                  "lat": 36.7826
                },
                {
                  "lon": 106.4629,
                  "lat": 36.9624
                },
                {
                  "lon": 105.3374,
                  "lat": 36.9624
                },
                {
                  "lon": 105.3374,
                  "lat": 36.7826
                },
                {
                  "lon": 106.4629,
                  "lat": 36.7826
                }
              ],
              [
                {
                  "lon": 122.5126,
                  "lat": 40.5584
                },
                {
                  "lon": 121.8004,
                  "lat": 40.5584
                },
                {
                  "lon": 121.8004,
                  "lat": 40.7382
                },
                {
                  "lon": 125.3614,
                  "lat": 40.7382
                },
                {
                  "lon": 125.3614,
                  "lat": 40.5584
                },
                {
                  "lon": 122.5126,
                  "lat": 40.5584
                }
              ],
              [
                {
                  "lon": 91.102,
                  "lat": 30.4896
                },
                {
                  "lon": 90.2672,
                  "lat": 30.4896
                },
                {
                  "lon": 90.2672,
                  "lat": 30.3098
                },
                {
                  "lon": 92.3542,
                  "lat": 30.3098
                },
                {
                  "lon": 92.3542,
                  "lat": 30.4896
                },
                {
                  "lon": 91.102,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 80.9294,
                  "lat": 44.3342
                },
                {
                  "lon": 79.421,
                  "lat": 44.3342
                },
                {
                  "lon": 79.421,
                  "lat": 44.1544
                },
                {
                  "lon": 81.4322,
                  "lat": 44.1544
                },
                {
                  "lon": 81.4322,
                  "lat": 44.3342
                },
                {
                  "lon": 80.9294,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 102.7113,
                  "lat": 25.0956
                },
                {
                  "lon": 103.1085,
                  "lat": 25.0956
                },
                {
                  "lon": 103.1085,
                  "lat": 24.9158
                },
                {
                  "lon": 102.3141,
                  "lat": 24.9158
                },
                {
                  "lon": 102.3141,
                  "lat": 25.0956
                },
                {
                  "lon": 102.7113,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 113.0304,
                  "lat": 28.6916
                },
                {
                  "lon": 112.0054,
                  "lat": 28.6916
                },
                {
                  "lon": 112.0054,
                  "lat": 28.5118
                },
                {
                  "lon": 113.0304,
                  "lat": 28.5118
                },
                {
                  "lon": 113.0304,
                  "lat": 28.6916
                }
              ],
              [
                {
                  "lon": 110.5803,
                  "lat": 27.0734
                },
                {
                  "lon": 110.7823,
                  "lat": 27.0734
                },
                {
                  "lon": 110.7823,
                  "lat": 26.8936
                },
                {
                  "lon": 109.3683,
                  "lat": 26.8936
                },
                {
                  "lon": 109.3683,
                  "lat": 27.0734
                },
                {
                  "lon": 110.5803,
                  "lat": 27.0734
                }
              ],
              [
                {
                  "lon": 87.7427,
                  "lat": 41.817
                },
                {
                  "lon": 84.8387,
                  "lat": 41.817
                },
                {
                  "lon": 84.8387,
                  "lat": 41.9968
                },
                {
                  "lon": 87.7427,
                  "lat": 41.9968
                },
                {
                  "lon": 87.7427,
                  "lat": 41.817
                }
              ],
              [
                {
                  "lon": 77.1186,
                  "lat": 39.6594
                },
                {
                  "lon": 76.416,
                  "lat": 39.6594
                },
                {
                  "lon": 76.416,
                  "lat": 39.8392
                },
                {
                  "lon": 77.3528,
                  "lat": 39.8392
                },
                {
                  "lon": 77.3528,
                  "lat": 39.6594
                },
                {
                  "lon": 77.1186,
                  "lat": 39.6594
                }
              ],
              [
                {
                  "lon": 114.6087,
                  "lat": 24.0168
                },
                {
                  "lon": 115.0031,
                  "lat": 24.0168
                },
                {
                  "lon": 115.0031,
                  "lat": 24.1966
                },
                {
                  "lon": 114.6087,
                  "lat": 24.1966
                },
                {
                  "lon": 114.6087,
                  "lat": 24.0168
                }
              ],
              [
                {
                  "lon": 114.0983,
                  "lat": 27.433
                },
                {
                  "lon": 113.4893,
                  "lat": 27.433
                },
                {
                  "lon": 113.4893,
                  "lat": 27.6128
                },
                {
                  "lon": 116.5343,
                  "lat": 27.6128
                },
                {
                  "lon": 116.5343,
                  "lat": 27.433
                },
                {
                  "lon": 114.0983,
                  "lat": 27.433
                }
              ],
              [
                {
                  "lon": 114.738,
                  "lat": 33.3664
                },
                {
                  "lon": 109.7746,
                  "lat": 33.3664
                },
                {
                  "lon": 109.7746,
                  "lat": 33.5462
                },
                {
                  "lon": 121.4278,
                  "lat": 33.5462
                },
                {
                  "lon": 121.4278,
                  "lat": 33.3664
                },
                {
                  "lon": 114.738,
                  "lat": 33.3664
                }
              ],
              [
                {
                  "lon": 108.3513,
                  "lat": 40.5584
                },
                {
                  "lon": 121.1331,
                  "lat": 40.5584
                },
                {
                  "lon": 121.1331,
                  "lat": 40.3786
                },
                {
                  "lon": 108.3513,
                  "lat": 40.3786
                },
                {
                  "lon": 108.3513,
                  "lat": 40.5584
                }
              ],
              [
                {
                  "lon": 122.4429,
                  "lat": 46.1322
                },
                {
                  "lon": 121.1409,
                  "lat": 46.1322
                },
                {
                  "lon": 121.1409,
                  "lat": 46.312
                },
                {
                  "lon": 125.3073,
                  "lat": 46.312
                },
                {
                  "lon": 125.3073,
                  "lat": 46.1322
                },
                {
                  "lon": 122.4429,
                  "lat": 46.1322
                }
              ],
              [
                {
                  "lon": 107.5252,
                  "lat": 29.7704
                },
                {
                  "lon": 108.3556,
                  "lat": 29.7704
                },
                {
                  "lon": 108.3556,
                  "lat": 29.9502
                },
                {
                  "lon": 106.2796,
                  "lat": 29.9502
                },
                {
                  "lon": 106.2796,
                  "lat": 29.7704
                },
                {
                  "lon": 107.5252,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 129.2359,
                  "lat": 42.716
                },
                {
                  "lon": 128.5015,
                  "lat": 42.716
                },
                {
                  "lon": 128.5015,
                  "lat": 42.5362
                },
                {
                  "lon": 129.7255,
                  "lat": 42.5362
                },
                {
                  "lon": 129.7255,
                  "lat": 42.716
                },
                {
                  "lon": 129.2359,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 127.1401,
                  "lat": 51.5262
                },
                {
                  "lon": 127.1401,
                  "lat": 51.706
                },
                {
                  "lon": 125.6891,
                  "lat": 51.706
                },
                {
                  "lon": 125.6891,
                  "lat": 51.5262
                },
                {
                  "lon": 127.1401,
                  "lat": 51.5262
                }
              ],
              [
                {
                  "lon": 106.9759,
                  "lat": 29.9502
                },
                {
                  "lon": 105.5206,
                  "lat": 29.9502
                },
                {
                  "lon": 105.5206,
                  "lat": 30.13
                },
                {
                  "lon": 108.2233,
                  "lat": 30.13
                },
                {
                  "lon": 108.2233,
                  "lat": 29.9502
                },
                {
                  "lon": 106.9759,
                  "lat": 29.9502
                }
              ],
              [
                {
                  "lon": 107.3984,
                  "lat": 33.726
                },
                {
                  "lon": 107.3984,
                  "lat": 33.9058
                },
                {
                  "lon": 107.6151,
                  "lat": 33.9058
                },
                {
                  "lon": 107.6151,
                  "lat": 33.726
                },
                {
                  "lon": 107.3984,
                  "lat": 33.726
                }
              ],
              [
                {
                  "lon": 115.4303,
                  "lat": 42.3564
                },
                {
                  "lon": 113.9699,
                  "lat": 42.3564
                },
                {
                  "lon": 113.9699,
                  "lat": 42.1766
                },
                {
                  "lon": 116.4039,
                  "lat": 42.1766
                },
                {
                  "lon": 116.4039,
                  "lat": 42.3564
                },
                {
                  "lon": 115.4303,
                  "lat": 42.3564
                }
              ],
              [
                {
                  "lon": 118.7655,
                  "lat": 26.1744
                },
                {
                  "lon": 117.7635,
                  "lat": 26.1744
                },
                {
                  "lon": 117.7635,
                  "lat": 25.9946
                },
                {
                  "lon": 120.5691,
                  "lat": 25.9946
                },
                {
                  "lon": 120.5691,
                  "lat": 26.1744
                },
                {
                  "lon": 118.7655,
                  "lat": 26.1744
                }
              ],
              [
                {
                  "lon": 88.2619,
                  "lat": 42.5362
                },
                {
                  "lon": 88.7501,
                  "lat": 42.5362
                },
                {
                  "lon": 88.7501,
                  "lat": 42.3564
                },
                {
                  "lon": 85.5768,
                  "lat": 42.3564
                },
                {
                  "lon": 85.5768,
                  "lat": 42.5362
                },
                {
                  "lon": 88.2619,
                  "lat": 42.5362
                }
              ],
              [
                {
                  "lon": 108.749,
                  "lat": 18.2632
                },
                {
                  "lon": 110.645,
                  "lat": 18.2632
                },
                {
                  "lon": 110.645,
                  "lat": 18.443
                },
                {
                  "lon": 108.1802,
                  "lat": 18.443
                },
                {
                  "lon": 108.1802,
                  "lat": 18.2632
                },
                {
                  "lon": 108.749,
                  "lat": 18.2632
                }
              ],
              [
                {
                  "lon": 124.0951,
                  "lat": 42.5362
                },
                {
                  "lon": 128.2567,
                  "lat": 42.5362
                },
                {
                  "lon": 128.2567,
                  "lat": 42.716
                },
                {
                  "lon": 122.3815,
                  "lat": 42.716
                },
                {
                  "lon": 122.3815,
                  "lat": 42.5362
                },
                {
                  "lon": 124.0951,
                  "lat": 42.5362
                }
              ],
              [
                {
                  "lon": 106.158,
                  "lat": 28.8714
                },
                {
                  "lon": 105.131,
                  "lat": 28.8714
                },
                {
                  "lon": 105.131,
                  "lat": 28.6916
                },
                {
                  "lon": 106.3634,
                  "lat": 28.6916
                },
                {
                  "lon": 106.3634,
                  "lat": 28.8714
                },
                {
                  "lon": 106.158,
                  "lat": 28.8714
                }
              ],
              [
                {
                  "lon": 119.7503,
                  "lat": 33.726
                },
                {
                  "lon": 121.2672,
                  "lat": 33.726
                },
                {
                  "lon": 121.2672,
                  "lat": 33.9058
                },
                {
                  "lon": 107.8318,
                  "lat": 33.9058
                },
                {
                  "lon": 107.8318,
                  "lat": 33.726
                },
                {
                  "lon": 119.7503,
                  "lat": 33.726
                }
              ],
              [
                {
                  "lon": 124.8148,
                  "lat": 49.3686
                },
                {
                  "lon": 124.8148,
                  "lat": 49.1888
                },
                {
                  "lon": 125.6434,
                  "lat": 49.1888
                },
                {
                  "lon": 125.6434,
                  "lat": 49.3686
                },
                {
                  "lon": 124.8148,
                  "lat": 49.3686
                }
              ],
              [
                {
                  "lon": 76.9026,
                  "lat": 38.9402
                },
                {
                  "lon": 75.7436,
                  "lat": 38.9402
                },
                {
                  "lon": 75.7436,
                  "lat": 39.12
                },
                {
                  "lon": 78.0616,
                  "lat": 39.12
                },
                {
                  "lon": 78.0616,
                  "lat": 38.9402
                },
                {
                  "lon": 76.9026,
                  "lat": 38.9402
                }
              ],
              [
                {
                  "lon": 109.3264,
                  "lat": 32.827
                },
                {
                  "lon": 106.5444,
                  "lat": 32.827
                },
                {
                  "lon": 106.5444,
                  "lat": 32.6472
                },
                {
                  "lon": 110.8244,
                  "lat": 32.6472
                },
                {
                  "lon": 110.8244,
                  "lat": 32.827
                },
                {
                  "lon": 109.3264,
                  "lat": 32.827
                }
              ],
              [
                {
                  "lon": 121.7846,
                  "lat": 39.8392
                },
                {
                  "lon": 121.315,
                  "lat": 39.8392
                },
                {
                  "lon": 121.315,
                  "lat": 40.019
                },
                {
                  "lon": 124.837,
                  "lat": 40.019
                },
                {
                  "lon": 124.837,
                  "lat": 39.8392
                },
                {
                  "lon": 121.7846,
                  "lat": 39.8392
                }
              ],
              [
                {
                  "lon": 102.743,
                  "lat": 38.9402
                },
                {
                  "lon": 103.4366,
                  "lat": 38.9402
                },
                {
                  "lon": 103.4366,
                  "lat": 38.7604
                },
                {
                  "lon": 102.743,
                  "lat": 38.7604
                },
                {
                  "lon": 102.743,
                  "lat": 38.9402
                }
              ],
              [
                {
                  "lon": 115.8122,
                  "lat": 44.3342
                },
                {
                  "lon": 115.3078,
                  "lat": 44.3342
                },
                {
                  "lon": 115.3078,
                  "lat": 44.514
                },
                {
                  "lon": 116.5688,
                  "lat": 44.514
                },
                {
                  "lon": 116.5688,
                  "lat": 44.3342
                },
                {
                  "lon": 115.8122,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 118.3149,
                  "lat": 31.5684
                },
                {
                  "lon": 122.748,
                  "lat": 31.5684
                },
                {
                  "lon": 122.748,
                  "lat": 31.3886
                },
                {
                  "lon": 114.5151,
                  "lat": 31.3886
                },
                {
                  "lon": 114.5151,
                  "lat": 31.5684
                },
                {
                  "lon": 118.3149,
                  "lat": 31.5684
                }
              ],
              [
                {
                  "lon": 122.7316,
                  "lat": 47.3908
                },
                {
                  "lon": 121.9345,
                  "lat": 47.3908
                },
                {
                  "lon": 121.9345,
                  "lat": 47.211
                },
                {
                  "lon": 127.5142,
                  "lat": 47.211
                },
                {
                  "lon": 127.5142,
                  "lat": 47.3908
                },
                {
                  "lon": 122.7316,
                  "lat": 47.3908
                }
              ],
              [
                {
                  "lon": 87.3783,
                  "lat": 44.1544
                },
                {
                  "lon": 86.3755,
                  "lat": 44.1544
                },
                {
                  "lon": 86.3755,
                  "lat": 43.9746
                },
                {
                  "lon": 88.3811,
                  "lat": 43.9746
                },
                {
                  "lon": 88.3811,
                  "lat": 44.1544
                },
                {
                  "lon": 87.3783,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 133.3467,
                  "lat": 48.11
                },
                {
                  "lon": 134.9685,
                  "lat": 48.11
                },
                {
                  "lon": 134.9685,
                  "lat": 48.2898
                },
                {
                  "lon": 132.8061,
                  "lat": 48.2898
                },
                {
                  "lon": 132.8061,
                  "lat": 48.11
                },
                {
                  "lon": 133.3467,
                  "lat": 48.11
                }
              ],
              [
                {
                  "lon": 91.3324,
                  "lat": 29.7704
                },
                {
                  "lon": 92.1628,
                  "lat": 29.7704
                },
                {
                  "lon": 92.1628,
                  "lat": 29.9502
                },
                {
                  "lon": 89.8792,
                  "lat": 29.9502
                },
                {
                  "lon": 89.8792,
                  "lat": 29.7704
                },
                {
                  "lon": 91.3324,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 101.5125,
                  "lat": 36.6028
                },
                {
                  "lon": 99.9445,
                  "lat": 36.6028
                },
                {
                  "lon": 99.9445,
                  "lat": 36.423
                },
                {
                  "lon": 108.0085,
                  "lat": 36.423
                },
                {
                  "lon": 108.0085,
                  "lat": 36.6028
                },
                {
                  "lon": 101.5125,
                  "lat": 36.6028
                }
              ],
              [
                {
                  "lon": 115.2383,
                  "lat": 40.918
                },
                {
                  "lon": 110.9417,
                  "lat": 40.918
                },
                {
                  "lon": 110.9417,
                  "lat": 41.0978
                },
                {
                  "lon": 121.4445,
                  "lat": 41.0978
                },
                {
                  "lon": 121.4445,
                  "lat": 40.918
                },
                {
                  "lon": 115.2383,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 126.7771,
                  "lat": 41.6372
                },
                {
                  "lon": 126.5365,
                  "lat": 41.6372
                },
                {
                  "lon": 126.5365,
                  "lat": 41.4574
                },
                {
                  "lon": 127.2583,
                  "lat": 41.4574
                },
                {
                  "lon": 127.2583,
                  "lat": 41.6372
                },
                {
                  "lon": 126.7771,
                  "lat": 41.6372
                }
              ],
              [
                {
                  "lon": 109.9847,
                  "lat": 31.029
                },
                {
                  "lon": 107.4659,
                  "lat": 31.029
                },
                {
                  "lon": 107.4659,
                  "lat": 30.8492
                },
                {
                  "lon": 110.1946,
                  "lat": 30.8492
                },
                {
                  "lon": 110.1946,
                  "lat": 31.029
                },
                {
                  "lon": 109.9847,
                  "lat": 31.029
                }
              ],
              [
                {
                  "lon": 100.4499,
                  "lat": 38.5806
                },
                {
                  "lon": 100.4499,
                  "lat": 38.4008
                },
                {
                  "lon": 103.4412,
                  "lat": 38.4008
                },
                {
                  "lon": 103.4412,
                  "lat": 38.5806
                },
                {
                  "lon": 100.4499,
                  "lat": 38.5806
                }
              ],
              [
                {
                  "lon": 122.7641,
                  "lat": 43.7948
                },
                {
                  "lon": 122.0144,
                  "lat": 43.7948
                },
                {
                  "lon": 122.0144,
                  "lat": 43.9746
                },
                {
                  "lon": 123.014,
                  "lat": 43.9746
                },
                {
                  "lon": 123.014,
                  "lat": 43.7948
                },
                {
                  "lon": 122.7641,
                  "lat": 43.7948
                }
              ],
              [
                {
                  "lon": 110.7566,
                  "lat": 29.0512
                },
                {
                  "lon": 110.7566,
                  "lat": 28.8714
                },
                {
                  "lon": 110.1395,
                  "lat": 28.8714
                },
                {
                  "lon": 110.1395,
                  "lat": 29.0512
                },
                {
                  "lon": 110.7566,
                  "lat": 29.0512
                }
              ],
              [
                {
                  "lon": 123.3388,
                  "lat": 44.514
                },
                {
                  "lon": 123.0858,
                  "lat": 44.514
                },
                {
                  "lon": 123.0858,
                  "lat": 44.6938
                },
                {
                  "lon": 127.3868,
                  "lat": 44.6938
                },
                {
                  "lon": 127.3868,
                  "lat": 44.514
                },
                {
                  "lon": 123.3388,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 123.8862,
                  "lat": 48.2898
                },
                {
                  "lon": 121.7238,
                  "lat": 48.2898
                },
                {
                  "lon": 121.7238,
                  "lat": 48.11
                },
                {
                  "lon": 123.8862,
                  "lat": 48.11
                },
                {
                  "lon": 123.8862,
                  "lat": 48.2898
                }
              ],
              [
                {
                  "lon": 116.2226,
                  "lat": 28.6916
                },
                {
                  "lon": 115.6064,
                  "lat": 28.6916
                },
                {
                  "lon": 115.6064,
                  "lat": 28.8714
                },
                {
                  "lon": 116.2226,
                  "lat": 28.8714
                },
                {
                  "lon": 116.2226,
                  "lat": 28.6916
                }
              ],
              [
                {
                  "lon": 129.0607,
                  "lat": 42.3564
                },
                {
                  "lon": 129.3041,
                  "lat": 42.3564
                },
                {
                  "lon": 129.3041,
                  "lat": 42.1766
                },
                {
                  "lon": 128.8173,
                  "lat": 42.1766
                },
                {
                  "lon": 128.8173,
                  "lat": 42.3564
                },
                {
                  "lon": 129.0607,
                  "lat": 42.3564
                }
              ],
              [
                {
                  "lon": 103.0638,
                  "lat": 25.9946
                },
                {
                  "lon": 102.6636,
                  "lat": 25.9946
                },
                {
                  "lon": 102.6636,
                  "lat": 25.8148
                },
                {
                  "lon": 103.464,
                  "lat": 25.8148
                },
                {
                  "lon": 103.464,
                  "lat": 25.9946
                },
                {
                  "lon": 103.0638,
                  "lat": 25.9946
                }
              ],
              [
                {
                  "lon": 126.5223,
                  "lat": 52.2454
                },
                {
                  "lon": 123.8682,
                  "lat": 52.2454
                },
                {
                  "lon": 123.8682,
                  "lat": 52.4252
                },
                {
                  "lon": 126.5223,
                  "lat": 52.4252
                },
                {
                  "lon": 126.5223,
                  "lat": 52.2454
                }
              ],
              [
                {
                  "lon": 127.8709,
                  "lat": 46.312
                },
                {
                  "lon": 128.6545,
                  "lat": 46.312
                },
                {
                  "lon": 128.6545,
                  "lat": 46.4918
                },
                {
                  "lon": 127.8709,
                  "lat": 46.4918
                },
                {
                  "lon": 127.8709,
                  "lat": 46.312
                }
              ],
              [
                {
                  "lon": 112.5364,
                  "lat": 32.6472
                },
                {
                  "lon": 113.1784,
                  "lat": 32.6472
                },
                {
                  "lon": 113.1784,
                  "lat": 32.827
                },
                {
                  "lon": 111.2524,
                  "lat": 32.827
                },
                {
                  "lon": 111.2524,
                  "lat": 32.6472
                },
                {
                  "lon": 112.5364,
                  "lat": 32.6472
                }
              ],
              [
                {
                  "lon": 110.0932,
                  "lat": 19.5218
                },
                {
                  "lon": 108.9472,
                  "lat": 19.5218
                },
                {
                  "lon": 108.9472,
                  "lat": 19.7016
                },
                {
                  "lon": 111.6212,
                  "lat": 19.7016
                },
                {
                  "lon": 111.6212,
                  "lat": 19.5218
                },
                {
                  "lon": 110.0932,
                  "lat": 19.5218
                }
              ],
              [
                {
                  "lon": 110.2948,
                  "lat": 32.6472
                },
                {
                  "lon": 110.2948,
                  "lat": 32.4674
                },
                {
                  "lon": 108.1588,
                  "lat": 32.4674
                },
                {
                  "lon": 108.1588,
                  "lat": 32.6472
                },
                {
                  "lon": 110.2948,
                  "lat": 32.6472
                }
              ],
              [
                {
                  "lon": 115.4083,
                  "lat": 43.615
                },
                {
                  "lon": 119.1343,
                  "lat": 43.615
                },
                {
                  "lon": 119.1343,
                  "lat": 43.4352
                },
                {
                  "lon": 115.1599,
                  "lat": 43.4352
                },
                {
                  "lon": 115.1599,
                  "lat": 43.615
                },
                {
                  "lon": 115.4083,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 106.7723,
                  "lat": 41.0978
                },
                {
                  "lon": 107.4902,
                  "lat": 41.0978
                },
                {
                  "lon": 107.4902,
                  "lat": 41.2776
                },
                {
                  "lon": 106.2937,
                  "lat": 41.2776
                },
                {
                  "lon": 106.2937,
                  "lat": 41.0978
                },
                {
                  "lon": 106.7723,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 115.8619,
                  "lat": 30.8492
                },
                {
                  "lon": 115.652,
                  "lat": 30.8492
                },
                {
                  "lon": 115.652,
                  "lat": 31.029
                },
                {
                  "lon": 122.1589,
                  "lat": 31.029
                },
                {
                  "lon": 122.1589,
                  "lat": 30.8492
                },
                {
                  "lon": 115.8619,
                  "lat": 30.8492
                }
              ],
              [
                {
                  "lon": 109.5638,
                  "lat": 18.443
                },
                {
                  "lon": 108.425,
                  "lat": 18.443
                },
                {
                  "lon": 108.425,
                  "lat": 18.6228
                },
                {
                  "lon": 110.8924,
                  "lat": 18.6228
                },
                {
                  "lon": 110.8924,
                  "lat": 18.443
                },
                {
                  "lon": 109.5638,
                  "lat": 18.443
                }
              ],
              [
                {
                  "lon": 111.3812,
                  "lat": 21.6794
                },
                {
                  "lon": 109.2527,
                  "lat": 21.6794
                },
                {
                  "lon": 109.2527,
                  "lat": 21.4996
                },
                {
                  "lon": 112.5422,
                  "lat": 21.4996
                },
                {
                  "lon": 112.5422,
                  "lat": 21.6794
                },
                {
                  "lon": 111.3812,
                  "lat": 21.6794
                }
              ],
              [
                {
                  "lon": 114.3303,
                  "lat": 26.534
                },
                {
                  "lon": 116.1393,
                  "lat": 26.534
                },
                {
                  "lon": 116.1393,
                  "lat": 26.3542
                },
                {
                  "lon": 113.7273,
                  "lat": 26.3542
                },
                {
                  "lon": 113.7273,
                  "lat": 26.534
                },
                {
                  "lon": 114.3303,
                  "lat": 26.534
                }
              ],
              [
                {
                  "lon": 128.969,
                  "lat": 49.1888
                },
                {
                  "lon": 128.6938,
                  "lat": 49.1888
                },
                {
                  "lon": 128.6938,
                  "lat": 49.009
                },
                {
                  "lon": 129.7946,
                  "lat": 49.009
                },
                {
                  "lon": 129.7946,
                  "lat": 49.1888
                },
                {
                  "lon": 128.969,
                  "lat": 49.1888
                }
              ],
              [
                {
                  "lon": 117.5869,
                  "lat": 31.7482
                },
                {
                  "lon": 114.4144,
                  "lat": 31.7482
                },
                {
                  "lon": 114.4144,
                  "lat": 31.5684
                },
                {
                  "lon": 122.6629,
                  "lat": 31.5684
                },
                {
                  "lon": 122.6629,
                  "lat": 31.7482
                },
                {
                  "lon": 117.5869,
                  "lat": 31.7482
                }
              ],
              [
                {
                  "lon": 105.6627,
                  "lat": 34.4452
                },
                {
                  "lon": 103.6953,
                  "lat": 34.4452
                },
                {
                  "lon": 103.6953,
                  "lat": 34.625
                },
                {
                  "lon": 106.5371,
                  "lat": 34.625
                },
                {
                  "lon": 106.5371,
                  "lat": 34.4452
                },
                {
                  "lon": 105.6627,
                  "lat": 34.4452
                }
              ],
              [
                {
                  "lon": 117.2859,
                  "lat": 23.4774
                },
                {
                  "lon": 118.0711,
                  "lat": 23.4774
                },
                {
                  "lon": 118.0711,
                  "lat": 23.6572
                },
                {
                  "lon": 115.5192,
                  "lat": 23.6572
                },
                {
                  "lon": 115.5192,
                  "lat": 23.4774
                },
                {
                  "lon": 117.2859,
                  "lat": 23.4774
                }
              ],
              [
                {
                  "lon": 105.4568,
                  "lat": 26.8936
                },
                {
                  "lon": 104.4483,
                  "lat": 26.8936
                },
                {
                  "lon": 104.4483,
                  "lat": 26.7138
                },
                {
                  "lon": 105.4568,
                  "lat": 26.7138
                },
                {
                  "lon": 105.4568,
                  "lat": 26.8936
                }
              ],
              [
                {
                  "lon": 108.3583,
                  "lat": 27.0734
                },
                {
                  "lon": 108.7623,
                  "lat": 27.0734
                },
                {
                  "lon": 108.7623,
                  "lat": 26.8936
                },
                {
                  "lon": 105.9343,
                  "lat": 26.8936
                },
                {
                  "lon": 105.9343,
                  "lat": 27.0734
                },
                {
                  "lon": 108.3583,
                  "lat": 27.0734
                }
              ],
              [
                {
                  "lon": 97.9645,
                  "lat": 36.2432
                },
                {
                  "lon": 98.4105,
                  "lat": 36.2432
                },
                {
                  "lon": 98.4105,
                  "lat": 36.0634
                },
                {
                  "lon": 96.8495,
                  "lat": 36.0634
                },
                {
                  "lon": 96.8495,
                  "lat": 36.2432
                },
                {
                  "lon": 97.9645,
                  "lat": 36.2432
                }
              ],
              [
                {
                  "lon": 110.2256,
                  "lat": 41.0978
                },
                {
                  "lon": 109.5095,
                  "lat": 41.0978
                },
                {
                  "lon": 109.5095,
                  "lat": 40.918
                },
                {
                  "lon": 110.4643,
                  "lat": 40.918
                },
                {
                  "lon": 110.4643,
                  "lat": 41.0978
                },
                {
                  "lon": 110.2256,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 108.0735,
                  "lat": 25.0956
                },
                {
                  "lon": 107.8749,
                  "lat": 25.0956
                },
                {
                  "lon": 107.8749,
                  "lat": 24.9158
                },
                {
                  "lon": 108.2721,
                  "lat": 24.9158
                },
                {
                  "lon": 108.2721,
                  "lat": 25.0956
                },
                {
                  "lon": 108.0735,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 108.1447,
                  "lat": 33.5462
                },
                {
                  "lon": 108.3609,
                  "lat": 33.5462
                },
                {
                  "lon": 108.3609,
                  "lat": 33.726
                },
                {
                  "lon": 107.4961,
                  "lat": 33.726
                },
                {
                  "lon": 107.4961,
                  "lat": 33.5462
                },
                {
                  "lon": 108.1447,
                  "lat": 33.5462
                }
              ],
              [
                {
                  "lon": 104.08,
                  "lat": 31.3886
                },
                {
                  "lon": 103.4479,
                  "lat": 31.3886
                },
                {
                  "lon": 103.4479,
                  "lat": 31.2088
                },
                {
                  "lon": 104.2907,
                  "lat": 31.2088
                },
                {
                  "lon": 104.2907,
                  "lat": 31.3886
                },
                {
                  "lon": 104.08,
                  "lat": 31.3886
                }
              ],
              [
                {
                  "lon": 102.8952,
                  "lat": 24.5562
                },
                {
                  "lon": 102.3021,
                  "lat": 24.5562
                },
                {
                  "lon": 102.3021,
                  "lat": 24.3764
                },
                {
                  "lon": 102.8952,
                  "lat": 24.3764
                },
                {
                  "lon": 102.8952,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 127.6097,
                  "lat": 46.312
                },
                {
                  "lon": 127.6097,
                  "lat": 46.4918
                },
                {
                  "lon": 125.7813,
                  "lat": 46.4918
                },
                {
                  "lon": 125.7813,
                  "lat": 46.312
                },
                {
                  "lon": 127.6097,
                  "lat": 46.312
                }
              ],
              [
                {
                  "lon": 78.2904,
                  "lat": 40.3786
                },
                {
                  "lon": 80.184,
                  "lat": 40.3786
                },
                {
                  "lon": 80.184,
                  "lat": 40.5584
                },
                {
                  "lon": 78.2904,
                  "lat": 40.5584
                },
                {
                  "lon": 78.2904,
                  "lat": 40.3786
                }
              ],
              [
                {
                  "lon": 109.2376,
                  "lat": 31.3886
                },
                {
                  "lon": 108.1821,
                  "lat": 31.3886
                },
                {
                  "lon": 108.1821,
                  "lat": 31.5684
                },
                {
                  "lon": 110.2931,
                  "lat": 31.5684
                },
                {
                  "lon": 110.2931,
                  "lat": 31.3886
                },
                {
                  "lon": 109.2376,
                  "lat": 31.3886
                }
              ],
              [
                {
                  "lon": 103.6518,
                  "lat": 38.0412
                },
                {
                  "lon": 101.5917,
                  "lat": 38.0412
                },
                {
                  "lon": 101.5917,
                  "lat": 38.221
                },
                {
                  "lon": 103.6518,
                  "lat": 38.221
                },
                {
                  "lon": 103.6518,
                  "lat": 38.0412
                }
              ],
              [
                {
                  "lon": 99.6505,
                  "lat": 36.0634
                },
                {
                  "lon": 100.763,
                  "lat": 36.0634
                },
                {
                  "lon": 100.763,
                  "lat": 35.8836
                },
                {
                  "lon": 99.6505,
                  "lat": 35.8836
                },
                {
                  "lon": 99.6505,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 134.6865,
                  "lat": 47.211
                },
                {
                  "lon": 126.2129,
                  "lat": 47.211
                },
                {
                  "lon": 126.2129,
                  "lat": 47.0312
                },
                {
                  "lon": 135.2161,
                  "lat": 47.0312
                },
                {
                  "lon": 135.2161,
                  "lat": 47.211
                },
                {
                  "lon": 134.6865,
                  "lat": 47.211
                }
              ],
              [
                {
                  "lon": 109.444,
                  "lat": 20.6006
                },
                {
                  "lon": 110.5966,
                  "lat": 20.6006
                },
                {
                  "lon": 110.5966,
                  "lat": 20.4208
                },
                {
                  "lon": 109.0598,
                  "lat": 20.4208
                },
                {
                  "lon": 109.0598,
                  "lat": 20.6006
                },
                {
                  "lon": 109.444,
                  "lat": 20.6006
                }
              ],
              [
                {
                  "lon": 110.7927,
                  "lat": 28.1522
                },
                {
                  "lon": 110.3841,
                  "lat": 28.1522
                },
                {
                  "lon": 110.3841,
                  "lat": 28.332
                },
                {
                  "lon": 110.7927,
                  "lat": 28.332
                },
                {
                  "lon": 110.7927,
                  "lat": 28.1522
                }
              ],
              [
                {
                  "lon": 117.8163,
                  "lat": 24.5562
                },
                {
                  "lon": 119.0043,
                  "lat": 24.5562
                },
                {
                  "lon": 119.0043,
                  "lat": 24.736
                },
                {
                  "lon": 117.0243,
                  "lat": 24.736
                },
                {
                  "lon": 117.0243,
                  "lat": 24.5562
                },
                {
                  "lon": 117.8163,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 131.1656,
                  "lat": 44.8736
                },
                {
                  "lon": 131.1656,
                  "lat": 44.6938
                },
                {
                  "lon": 128.12,
                  "lat": 44.6938
                },
                {
                  "lon": 128.12,
                  "lat": 44.8736
                },
                {
                  "lon": 131.1656,
                  "lat": 44.8736
                }
              ],
              [
                {
                  "lon": 115.0364,
                  "lat": 31.3886
                },
                {
                  "lon": 114.615,
                  "lat": 31.3886
                },
                {
                  "lon": 114.615,
                  "lat": 31.2088
                },
                {
                  "lon": 118.1969,
                  "lat": 31.2088
                },
                {
                  "lon": 118.1969,
                  "lat": 31.3886
                },
                {
                  "lon": 115.0364,
                  "lat": 31.3886
                }
              ],
              [
                {
                  "lon": 126.5578,
                  "lat": 51.8858
                },
                {
                  "lon": 127.4356,
                  "lat": 51.8858
                },
                {
                  "lon": 127.4356,
                  "lat": 52.0656
                },
                {
                  "lon": 125.3874,
                  "lat": 52.0656
                },
                {
                  "lon": 125.3874,
                  "lat": 51.8858
                },
                {
                  "lon": 126.5578,
                  "lat": 51.8858
                }
              ],
              [
                {
                  "lon": 106.6167,
                  "lat": 26.3542
                },
                {
                  "lon": 108.2223,
                  "lat": 26.3542
                },
                {
                  "lon": 108.2223,
                  "lat": 26.1744
                },
                {
                  "lon": 104.409,
                  "lat": 26.1744
                },
                {
                  "lon": 104.409,
                  "lat": 26.3542
                },
                {
                  "lon": 106.6167,
                  "lat": 26.3542
                }
              ],
              [
                {
                  "lon": 107.438,
                  "lat": 35.8836
                },
                {
                  "lon": 105.8805,
                  "lat": 35.8836
                },
                {
                  "lon": 105.8805,
                  "lat": 36.0634
                },
                {
                  "lon": 109.8855,
                  "lat": 36.0634
                },
                {
                  "lon": 109.8855,
                  "lat": 35.8836
                },
                {
                  "lon": 107.438,
                  "lat": 35.8836
                }
              ],
              [
                {
                  "lon": 81.6798,
                  "lat": 40.7382
                },
                {
                  "lon": 80.4928,
                  "lat": 40.7382
                },
                {
                  "lon": 80.4928,
                  "lat": 40.5584
                },
                {
                  "lon": 81.6798,
                  "lat": 40.5584
                },
                {
                  "lon": 81.6798,
                  "lat": 40.7382
                }
              ],
              [
                {
                  "lon": 105.9642,
                  "lat": 25.2754
                },
                {
                  "lon": 106.362,
                  "lat": 25.2754
                },
                {
                  "lon": 106.362,
                  "lat": 25.0956
                },
                {
                  "lon": 104.373,
                  "lat": 25.0956
                },
                {
                  "lon": 104.373,
                  "lat": 25.2754
                },
                {
                  "lon": 105.9642,
                  "lat": 25.2754
                }
              ],
              [
                {
                  "lon": 123.2985,
                  "lat": 52.0656
                },
                {
                  "lon": 123.8859,
                  "lat": 52.0656
                },
                {
                  "lon": 123.8859,
                  "lat": 52.2454
                },
                {
                  "lon": 123.0048,
                  "lat": 52.2454
                },
                {
                  "lon": 123.0048,
                  "lat": 52.0656
                },
                {
                  "lon": 123.2985,
                  "lat": 52.0656
                }
              ],
              [
                {
                  "lon": 91.1755,
                  "lat": 30.13
                },
                {
                  "lon": 90.3439,
                  "lat": 30.13
                },
                {
                  "lon": 90.3439,
                  "lat": 29.9502
                },
                {
                  "lon": 91.5913,
                  "lat": 29.9502
                },
                {
                  "lon": 91.5913,
                  "lat": 30.13
                },
                {
                  "lon": 91.1755,
                  "lat": 30.13
                }
              ],
              [
                {
                  "lon": 122.1404,
                  "lat": 45.2332
                },
                {
                  "lon": 122.1404,
                  "lat": 45.413
                },
                {
                  "lon": 125.471,
                  "lat": 45.413
                },
                {
                  "lon": 125.471,
                  "lat": 45.2332
                },
                {
                  "lon": 122.1404,
                  "lat": 45.2332
                }
              ],
              [
                {
                  "lon": 119.2655,
                  "lat": 43.9746
                },
                {
                  "lon": 119.0156,
                  "lat": 43.9746
                },
                {
                  "lon": 119.0156,
                  "lat": 43.7948
                },
                {
                  "lon": 119.7653,
                  "lat": 43.7948
                },
                {
                  "lon": 119.7653,
                  "lat": 43.9746
                },
                {
                  "lon": 119.2655,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 113.7509,
                  "lat": 34.4452
                },
                {
                  "lon": 106.7557,
                  "lat": 34.4452
                },
                {
                  "lon": 106.7557,
                  "lat": 34.625
                },
                {
                  "lon": 120.3089,
                  "lat": 34.625
                },
                {
                  "lon": 120.3089,
                  "lat": 34.4452
                },
                {
                  "lon": 113.7509,
                  "lat": 34.4452
                }
              ],
              [
                {
                  "lon": 115.5027,
                  "lat": 23.1178
                },
                {
                  "lon": 111.3951,
                  "lat": 23.1178
                },
                {
                  "lon": 111.3951,
                  "lat": 22.938
                },
                {
                  "lon": 116.8719,
                  "lat": 22.938
                },
                {
                  "lon": 116.8719,
                  "lat": 23.1178
                },
                {
                  "lon": 115.5027,
                  "lat": 23.1178
                }
              ],
              [
                {
                  "lon": 133.4392,
                  "lat": 45.0534
                },
                {
                  "lon": 133.4392,
                  "lat": 44.8736
                },
                {
                  "lon": 132.4208,
                  "lat": 44.8736
                },
                {
                  "lon": 132.4208,
                  "lat": 45.0534
                },
                {
                  "lon": 133.4392,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 114.923,
                  "lat": 33.0068
                },
                {
                  "lon": 110.8399,
                  "lat": 33.0068
                },
                {
                  "lon": 110.8399,
                  "lat": 33.1866
                },
                {
                  "lon": 121.5849,
                  "lat": 33.1866
                },
                {
                  "lon": 121.5849,
                  "lat": 33.0068
                },
                {
                  "lon": 114.923,
                  "lat": 33.0068
                }
              ],
              [
                {
                  "lon": 81.5938,
                  "lat": 44.514
                },
                {
                  "lon": 80.8348,
                  "lat": 44.514
                },
                {
                  "lon": 80.8348,
                  "lat": 44.6938
                },
                {
                  "lon": 83.3648,
                  "lat": 44.6938
                },
                {
                  "lon": 83.3648,
                  "lat": 44.514
                },
                {
                  "lon": 81.5938,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 111.2616,
                  "lat": 39.2998
                },
                {
                  "lon": 111.7276,
                  "lat": 39.2998
                },
                {
                  "lon": 111.7276,
                  "lat": 39.4796
                },
                {
                  "lon": 109.1646,
                  "lat": 39.4796
                },
                {
                  "lon": 109.1646,
                  "lat": 39.2998
                },
                {
                  "lon": 111.2616,
                  "lat": 39.2998
                }
              ],
              [
                {
                  "lon": 102.098,
                  "lat": 35.8836
                },
                {
                  "lon": 102.098,
                  "lat": 36.0634
                },
                {
                  "lon": 104.5455,
                  "lat": 36.0634
                },
                {
                  "lon": 104.5455,
                  "lat": 35.8836
                },
                {
                  "lon": 102.098,
                  "lat": 35.8836
                }
              ],
              [
                {
                  "lon": 91.0094,
                  "lat": 29.0512
                },
                {
                  "lon": 91.0094,
                  "lat": 28.8714
                },
                {
                  "lon": 92.0379,
                  "lat": 28.8714
                },
                {
                  "lon": 92.0379,
                  "lat": 29.0512
                },
                {
                  "lon": 91.0094,
                  "lat": 29.0512
                }
              ],
              [
                {
                  "lon": 120.8967,
                  "lat": 41.9968
                },
                {
                  "lon": 117.0247,
                  "lat": 41.9968
                },
                {
                  "lon": 117.0247,
                  "lat": 41.817
                },
                {
                  "lon": 122.5907,
                  "lat": 41.817
                },
                {
                  "lon": 122.5907,
                  "lat": 41.9968
                },
                {
                  "lon": 120.8967,
                  "lat": 41.9968
                }
              ],
              [
                {
                  "lon": 115.608,
                  "lat": 28.5118
                },
                {
                  "lon": 121.749,
                  "lat": 28.5118
                },
                {
                  "lon": 121.749,
                  "lat": 28.332
                },
                {
                  "lon": 115.608,
                  "lat": 28.332
                },
                {
                  "lon": 115.608,
                  "lat": 28.5118
                }
              ],
              [
                {
                  "lon": 104.9562,
                  "lat": 26.7138
                },
                {
                  "lon": 105.5601,
                  "lat": 26.7138
                },
                {
                  "lon": 105.5601,
                  "lat": 26.534
                },
                {
                  "lon": 103.9497,
                  "lat": 26.534
                },
                {
                  "lon": 103.9497,
                  "lat": 26.7138
                },
                {
                  "lon": 104.9562,
                  "lat": 26.7138
                }
              ],
              [
                {
                  "lon": 103.0041,
                  "lat": 26.1744
                },
                {
                  "lon": 103.8069,
                  "lat": 26.1744
                },
                {
                  "lon": 103.8069,
                  "lat": 26.3542
                },
                {
                  "lon": 102.6027,
                  "lat": 26.3542
                },
                {
                  "lon": 102.6027,
                  "lat": 26.1744
                },
                {
                  "lon": 103.0041,
                  "lat": 26.1744
                }
              ],
              [
                {
                  "lon": 105.3449,
                  "lat": 33.9058
                },
                {
                  "lon": 106.8653,
                  "lat": 33.9058
                },
                {
                  "lon": 106.8653,
                  "lat": 34.0856
                },
                {
                  "lon": 104.0417,
                  "lat": 34.0856
                },
                {
                  "lon": 104.0417,
                  "lat": 33.9058
                },
                {
                  "lon": 105.3449,
                  "lat": 33.9058
                }
              ],
              [
                {
                  "lon": 110.0595,
                  "lat": 25.0956
                },
                {
                  "lon": 109.6623,
                  "lat": 25.0956
                },
                {
                  "lon": 109.6623,
                  "lat": 24.9158
                },
                {
                  "lon": 110.0595,
                  "lat": 24.9158
                },
                {
                  "lon": 110.0595,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 121.0937,
                  "lat": 31.7482
                },
                {
                  "lon": 113.8891,
                  "lat": 31.7482
                },
                {
                  "lon": 113.8891,
                  "lat": 31.928
                },
                {
                  "lon": 122.577,
                  "lat": 31.928
                },
                {
                  "lon": 122.577,
                  "lat": 31.7482
                },
                {
                  "lon": 121.0937,
                  "lat": 31.7482
                }
              ],
              [
                {
                  "lon": 113.1636,
                  "lat": 23.4774
                },
                {
                  "lon": 115.3229,
                  "lat": 23.4774
                },
                {
                  "lon": 115.3229,
                  "lat": 23.6572
                },
                {
                  "lon": 111.2006,
                  "lat": 23.6572
                },
                {
                  "lon": 111.2006,
                  "lat": 23.4774
                },
                {
                  "lon": 113.1636,
                  "lat": 23.4774
                }
              ],
              [
                {
                  "lon": 81.3033,
                  "lat": 40.1988
                },
                {
                  "lon": 80.595,
                  "lat": 40.1988
                },
                {
                  "lon": 80.595,
                  "lat": 40.3786
                },
                {
                  "lon": 81.5394,
                  "lat": 40.3786
                },
                {
                  "lon": 81.5394,
                  "lat": 40.1988
                },
                {
                  "lon": 81.3033,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 127.0627,
                  "lat": 43.615
                },
                {
                  "lon": 121.8295,
                  "lat": 43.615
                },
                {
                  "lon": 121.8295,
                  "lat": 43.7948
                },
                {
                  "lon": 127.5611,
                  "lat": 43.7948
                },
                {
                  "lon": 127.5611,
                  "lat": 43.615
                },
                {
                  "lon": 127.0627,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 82.7059,
                  "lat": 43.0756
                },
                {
                  "lon": 83.1997,
                  "lat": 43.0756
                },
                {
                  "lon": 83.1997,
                  "lat": 43.2554
                },
                {
                  "lon": 82.7059,
                  "lat": 43.2554
                },
                {
                  "lon": 82.7059,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 117.8559,
                  "lat": 26.1744
                },
                {
                  "lon": 117.8559,
                  "lat": 26.3542
                },
                {
                  "lon": 120.6657,
                  "lat": 26.3542
                },
                {
                  "lon": 120.6657,
                  "lat": 26.1744
                },
                {
                  "lon": 117.8559,
                  "lat": 26.1744
                }
              ],
              [
                {
                  "lon": 113.6103,
                  "lat": 27.0734
                },
                {
                  "lon": 113.6103,
                  "lat": 26.8936
                },
                {
                  "lon": 114.2163,
                  "lat": 26.8936
                },
                {
                  "lon": 114.2163,
                  "lat": 27.0734
                },
                {
                  "lon": 113.6103,
                  "lat": 27.0734
                }
              ],
              [
                {
                  "lon": 99.023,
                  "lat": 39.4796
                },
                {
                  "lon": 97.6214,
                  "lat": 39.4796
                },
                {
                  "lon": 97.6214,
                  "lat": 39.6594
                },
                {
                  "lon": 100.191,
                  "lat": 39.6594
                },
                {
                  "lon": 100.191,
                  "lat": 39.4796
                },
                {
                  "lon": 99.023,
                  "lat": 39.4796
                }
              ],
              [
                {
                  "lon": 109.01,
                  "lat": 36.423
                },
                {
                  "lon": 110.351,
                  "lat": 36.423
                },
                {
                  "lon": 110.351,
                  "lat": 36.2432
                },
                {
                  "lon": 107.669,
                  "lat": 36.2432
                },
                {
                  "lon": 107.669,
                  "lat": 36.423
                },
                {
                  "lon": 109.01,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 114.2658,
                  "lat": 28.1522
                },
                {
                  "lon": 114.8787,
                  "lat": 28.1522
                },
                {
                  "lon": 114.8787,
                  "lat": 28.332
                },
                {
                  "lon": 111.8142,
                  "lat": 28.332
                },
                {
                  "lon": 111.8142,
                  "lat": 28.1522
                },
                {
                  "lon": 114.2658,
                  "lat": 28.1522
                }
              ],
              [
                {
                  "lon": 112.1146,
                  "lat": 28.8714
                },
                {
                  "lon": 112.7308,
                  "lat": 28.8714
                },
                {
                  "lon": 112.7308,
                  "lat": 28.6916
                },
                {
                  "lon": 111.0876,
                  "lat": 28.6916
                },
                {
                  "lon": 111.0876,
                  "lat": 28.8714
                },
                {
                  "lon": 112.1146,
                  "lat": 28.8714
                }
              ],
              [
                {
                  "lon": 116.5218,
                  "lat": 24.736
                },
                {
                  "lon": 116.5218,
                  "lat": 24.9158
                },
                {
                  "lon": 119.0997,
                  "lat": 24.9158
                },
                {
                  "lon": 119.0997,
                  "lat": 24.736
                },
                {
                  "lon": 116.5218,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 95.8996,
                  "lat": 29.7704
                },
                {
                  "lon": 95.0692,
                  "lat": 29.7704
                },
                {
                  "lon": 95.0692,
                  "lat": 29.9502
                },
                {
                  "lon": 96.1072,
                  "lat": 29.9502
                },
                {
                  "lon": 96.1072,
                  "lat": 29.7704
                },
                {
                  "lon": 95.8996,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 116.1422,
                  "lat": 36.7826
                },
                {
                  "lon": 123.1203,
                  "lat": 36.7826
                },
                {
                  "lon": 123.1203,
                  "lat": 36.9624
                },
                {
                  "lon": 111.8653,
                  "lat": 36.9624
                },
                {
                  "lon": 111.8653,
                  "lat": 36.7826
                },
                {
                  "lon": 116.1422,
                  "lat": 36.7826
                }
              ],
              [
                {
                  "lon": 123.8826,
                  "lat": 44.3342
                },
                {
                  "lon": 126.1524,
                  "lat": 44.3342
                },
                {
                  "lon": 126.1524,
                  "lat": 44.514
                },
                {
                  "lon": 123.8826,
                  "lat": 44.514
                },
                {
                  "lon": 123.8826,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 127.1612,
                  "lat": 44.514
                },
                {
                  "lon": 127.4134,
                  "lat": 44.514
                },
                {
                  "lon": 127.4134,
                  "lat": 44.3342
                },
                {
                  "lon": 126.4046,
                  "lat": 44.3342
                },
                {
                  "lon": 126.4046,
                  "lat": 44.514
                },
                {
                  "lon": 127.1612,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 131.4194,
                  "lat": 44.8736
                },
                {
                  "lon": 131.4194,
                  "lat": 44.6938
                },
                {
                  "lon": 132.4346,
                  "lat": 44.6938
                },
                {
                  "lon": 132.4346,
                  "lat": 44.8736
                },
                {
                  "lon": 131.4194,
                  "lat": 44.8736
                }
              ],
              [
                {
                  "lon": 126.8697,
                  "lat": 46.1322
                },
                {
                  "lon": 125.5677,
                  "lat": 46.1322
                },
                {
                  "lon": 125.5677,
                  "lat": 46.312
                },
                {
                  "lon": 128.1717,
                  "lat": 46.312
                },
                {
                  "lon": 128.1717,
                  "lat": 46.1322
                },
                {
                  "lon": 126.8697,
                  "lat": 46.1322
                }
              ],
              [
                {
                  "lon": 120.22,
                  "lat": 43.9746
                },
                {
                  "lon": 120.22,
                  "lat": 44.1544
                },
                {
                  "lon": 118.9665,
                  "lat": 44.1544
                },
                {
                  "lon": 118.9665,
                  "lat": 43.9746
                },
                {
                  "lon": 120.22,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 120.5451,
                  "lat": 43.0756
                },
                {
                  "lon": 121.5299,
                  "lat": 43.0756
                },
                {
                  "lon": 121.5299,
                  "lat": 42.8958
                },
                {
                  "lon": 120.2989,
                  "lat": 42.8958
                },
                {
                  "lon": 120.2989,
                  "lat": 43.0756
                },
                {
                  "lon": 120.5451,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 111.0737,
                  "lat": 21.14
                },
                {
                  "lon": 109.1427,
                  "lat": 21.14
                },
                {
                  "lon": 109.1427,
                  "lat": 21.3198
                },
                {
                  "lon": 111.4599,
                  "lat": 21.3198
                },
                {
                  "lon": 111.4599,
                  "lat": 21.14
                },
                {
                  "lon": 111.0737,
                  "lat": 21.14
                }
              ],
              [
                {
                  "lon": 110.3042,
                  "lat": 21.8592
                },
                {
                  "lon": 109.9166,
                  "lat": 21.8592
                },
                {
                  "lon": 109.9166,
                  "lat": 21.6794
                },
                {
                  "lon": 113.5988,
                  "lat": 21.6794
                },
                {
                  "lon": 113.5988,
                  "lat": 21.8592
                },
                {
                  "lon": 110.3042,
                  "lat": 21.8592
                }
              ],
              [
                {
                  "lon": 103.7152,
                  "lat": 30.6694
                },
                {
                  "lon": 105.1789,
                  "lat": 30.6694
                },
                {
                  "lon": 105.1789,
                  "lat": 30.4896
                },
                {
                  "lon": 102.8788,
                  "lat": 30.4896
                },
                {
                  "lon": 102.8788,
                  "lat": 30.6694
                },
                {
                  "lon": 103.7152,
                  "lat": 30.6694
                }
              ],
              [
                {
                  "lon": 107.5431,
                  "lat": 25.9946
                },
                {
                  "lon": 108.7455,
                  "lat": 25.9946
                },
                {
                  "lon": 108.7455,
                  "lat": 26.1744
                },
                {
                  "lon": 104.3367,
                  "lat": 26.1744
                },
                {
                  "lon": 104.3367,
                  "lat": 25.9946
                },
                {
                  "lon": 107.5431,
                  "lat": 25.9946
                }
              ],
              [
                {
                  "lon": 109.4265,
                  "lat": 26.1744
                },
                {
                  "lon": 109.8279,
                  "lat": 26.1744
                },
                {
                  "lon": 109.8279,
                  "lat": 26.3542
                },
                {
                  "lon": 109.4265,
                  "lat": 26.3542
                },
                {
                  "lon": 109.4265,
                  "lat": 26.1744
                }
              ],
              [
                {
                  "lon": 120.6803,
                  "lat": 26.8936
                },
                {
                  "lon": 118.6603,
                  "lat": 26.8936
                },
                {
                  "lon": 118.6603,
                  "lat": 27.0734
                },
                {
                  "lon": 120.8823,
                  "lat": 27.0734
                },
                {
                  "lon": 120.8823,
                  "lat": 26.8936
                },
                {
                  "lon": 120.6803,
                  "lat": 26.8936
                }
              ],
              [
                {
                  "lon": 106.9086,
                  "lat": 40.1988
                },
                {
                  "lon": 106.6731,
                  "lat": 40.1988
                },
                {
                  "lon": 106.6731,
                  "lat": 40.019
                },
                {
                  "lon": 107.3796,
                  "lat": 40.019
                },
                {
                  "lon": 107.3796,
                  "lat": 40.1988
                },
                {
                  "lon": 106.9086,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 114.3202,
                  "lat": 32.1078
                },
                {
                  "lon": 113.044,
                  "lat": 32.1078
                },
                {
                  "lon": 113.044,
                  "lat": 32.2876
                },
                {
                  "lon": 122.1901,
                  "lat": 32.2876
                },
                {
                  "lon": 122.1901,
                  "lat": 32.1078
                },
                {
                  "lon": 114.3202,
                  "lat": 32.1078
                }
              ],
              [
                {
                  "lon": 116.7514,
                  "lat": 29.231
                },
                {
                  "lon": 115.3059,
                  "lat": 29.231
                },
                {
                  "lon": 115.3059,
                  "lat": 29.4108
                },
                {
                  "lon": 117.7839,
                  "lat": 29.4108
                },
                {
                  "lon": 117.7839,
                  "lat": 29.231
                },
                {
                  "lon": 116.7514,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 123.9967,
                  "lat": 42.1766
                },
                {
                  "lon": 124.7248,
                  "lat": 42.1766
                },
                {
                  "lon": 124.7248,
                  "lat": 41.9968
                },
                {
                  "lon": 122.7832,
                  "lat": 41.9968
                },
                {
                  "lon": 122.7832,
                  "lat": 42.1766
                },
                {
                  "lon": 123.9967,
                  "lat": 42.1766
                }
              ],
              [
                {
                  "lon": 124.0154,
                  "lat": 49.009
                },
                {
                  "lon": 127.593,
                  "lat": 49.009
                },
                {
                  "lon": 127.593,
                  "lat": 49.1888
                },
                {
                  "lon": 124.0154,
                  "lat": 49.1888
                },
                {
                  "lon": 124.0154,
                  "lat": 49.009
                }
              ],
              [
                {
                  "lon": 122.6119,
                  "lat": 43.615
                },
                {
                  "lon": 126.8347,
                  "lat": 43.615
                },
                {
                  "lon": 126.8347,
                  "lat": 43.4352
                },
                {
                  "lon": 121.3699,
                  "lat": 43.4352
                },
                {
                  "lon": 121.3699,
                  "lat": 43.615
                },
                {
                  "lon": 122.6119,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 113.4474,
                  "lat": 29.231
                },
                {
                  "lon": 113.6539,
                  "lat": 29.231
                },
                {
                  "lon": 113.6539,
                  "lat": 29.4108
                },
                {
                  "lon": 112.6214,
                  "lat": 29.4108
                },
                {
                  "lon": 112.6214,
                  "lat": 29.231
                },
                {
                  "lon": 113.4474,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 112.9701,
                  "lat": 22.039
                },
                {
                  "lon": 110.0556,
                  "lat": 22.039
                },
                {
                  "lon": 110.0556,
                  "lat": 22.2188
                },
                {
                  "lon": 113.9416,
                  "lat": 22.2188
                },
                {
                  "lon": 113.9416,
                  "lat": 22.039
                },
                {
                  "lon": 112.9701,
                  "lat": 22.039
                }
              ],
              [
                {
                  "lon": 106.072,
                  "lat": 29.9502
                },
                {
                  "lon": 105.4492,
                  "lat": 29.9502
                },
                {
                  "lon": 105.4492,
                  "lat": 29.7704
                },
                {
                  "lon": 106.072,
                  "lat": 29.7704
                },
                {
                  "lon": 106.072,
                  "lat": 29.9502
                }
              ],
              [
                {
                  "lon": 125.9989,
                  "lat": 46.8514
                },
                {
                  "lon": 128.3659,
                  "lat": 46.8514
                },
                {
                  "lon": 128.3659,
                  "lat": 46.6716
                },
                {
                  "lon": 125.9989,
                  "lat": 46.6716
                },
                {
                  "lon": 125.9989,
                  "lat": 46.8514
                }
              ],
              [
                {
                  "lon": 75.8722,
                  "lat": 38.7604
                },
                {
                  "lon": 76.7946,
                  "lat": 38.7604
                },
                {
                  "lon": 76.7946,
                  "lat": 38.5806
                },
                {
                  "lon": 75.8722,
                  "lat": 38.5806
                },
                {
                  "lon": 75.8722,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 84.2785,
                  "lat": 43.2554
                },
                {
                  "lon": 81.8015,
                  "lat": 43.2554
                },
                {
                  "lon": 81.8015,
                  "lat": 43.4352
                },
                {
                  "lon": 85.0216,
                  "lat": 43.4352
                },
                {
                  "lon": 85.0216,
                  "lat": 43.2554
                },
                {
                  "lon": 84.2785,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 111.1982,
                  "lat": 18.9824
                },
                {
                  "lon": 108.3452,
                  "lat": 18.9824
                },
                {
                  "lon": 108.3452,
                  "lat": 18.8026
                },
                {
                  "lon": 111.1982,
                  "lat": 18.8026
                },
                {
                  "lon": 111.1982,
                  "lat": 18.9824
                }
              ],
              [
                {
                  "lon": 77.8862,
                  "lat": 39.2998
                },
                {
                  "lon": 78.5834,
                  "lat": 39.2998
                },
                {
                  "lon": 78.5834,
                  "lat": 39.12
                },
                {
                  "lon": 77.4214,
                  "lat": 39.12
                },
                {
                  "lon": 77.4214,
                  "lat": 39.2998
                },
                {
                  "lon": 77.8862,
                  "lat": 39.2998
                }
              ],
              [
                {
                  "lon": 110.2807,
                  "lat": 41.2776
                },
                {
                  "lon": 110.2807,
                  "lat": 41.4574
                },
                {
                  "lon": 110.0407,
                  "lat": 41.4574
                },
                {
                  "lon": 110.0407,
                  "lat": 41.2776
                },
                {
                  "lon": 110.2807,
                  "lat": 41.2776
                }
              ],
              [
                {
                  "lon": 128.577,
                  "lat": 47.211
                },
                {
                  "lon": 129.1084,
                  "lat": 47.211
                },
                {
                  "lon": 129.1084,
                  "lat": 47.3908
                },
                {
                  "lon": 127.7799,
                  "lat": 47.3908
                },
                {
                  "lon": 127.7799,
                  "lat": 47.211
                },
                {
                  "lon": 128.577,
                  "lat": 47.211
                }
              ],
              [
                {
                  "lon": 107.8506,
                  "lat": 40.1988
                },
                {
                  "lon": 109.0281,
                  "lat": 40.1988
                },
                {
                  "lon": 109.0281,
                  "lat": 40.019
                },
                {
                  "lon": 107.8506,
                  "lat": 40.019
                },
                {
                  "lon": 107.8506,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 82.9027,
                  "lat": 41.9968
                },
                {
                  "lon": 82.6607,
                  "lat": 41.9968
                },
                {
                  "lon": 82.6607,
                  "lat": 41.817
                },
                {
                  "lon": 83.3867,
                  "lat": 41.817
                },
                {
                  "lon": 83.3867,
                  "lat": 41.9968
                },
                {
                  "lon": 82.9027,
                  "lat": 41.9968
                }
              ],
              [
                {
                  "lon": 114.3793,
                  "lat": 30.6694
                },
                {
                  "lon": 113.752,
                  "lat": 30.6694
                },
                {
                  "lon": 113.752,
                  "lat": 30.4896
                },
                {
                  "lon": 115.4248,
                  "lat": 30.4896
                },
                {
                  "lon": 115.4248,
                  "lat": 30.6694
                },
                {
                  "lon": 114.3793,
                  "lat": 30.6694
                }
              ],
              [
                {
                  "lon": 105.3693,
                  "lat": 27.6128
                },
                {
                  "lon": 105.5723,
                  "lat": 27.6128
                },
                {
                  "lon": 105.5723,
                  "lat": 27.433
                },
                {
                  "lon": 104.9633,
                  "lat": 27.433
                },
                {
                  "lon": 104.9633,
                  "lat": 27.6128
                },
                {
                  "lon": 105.3693,
                  "lat": 27.6128
                }
              ],
              [
                {
                  "lon": 119.7823,
                  "lat": 27.6128
                },
                {
                  "lon": 121.2033,
                  "lat": 27.6128
                },
                {
                  "lon": 121.2033,
                  "lat": 27.433
                },
                {
                  "lon": 119.1733,
                  "lat": 27.433
                },
                {
                  "lon": 119.1733,
                  "lat": 27.6128
                },
                {
                  "lon": 119.7823,
                  "lat": 27.6128
                }
              ],
              [
                {
                  "lon": 121.7283,
                  "lat": 27.9724
                },
                {
                  "lon": 118.6683,
                  "lat": 27.9724
                },
                {
                  "lon": 118.6683,
                  "lat": 28.1522
                },
                {
                  "lon": 121.9323,
                  "lat": 28.1522
                },
                {
                  "lon": 121.9323,
                  "lat": 27.9724
                },
                {
                  "lon": 121.7283,
                  "lat": 27.9724
                }
              ],
              [
                {
                  "lon": 83.8613,
                  "lat": 42.8958
                },
                {
                  "lon": 83.3689,
                  "lat": 42.8958
                },
                {
                  "lon": 83.3689,
                  "lat": 43.0756
                },
                {
                  "lon": 84.1075,
                  "lat": 43.0756
                },
                {
                  "lon": 84.1075,
                  "lat": 42.8958
                },
                {
                  "lon": 83.8613,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 120.7894,
                  "lat": 48.8292
                },
                {
                  "lon": 121.609,
                  "lat": 48.8292
                },
                {
                  "lon": 121.609,
                  "lat": 48.6494
                },
                {
                  "lon": 120.7894,
                  "lat": 48.6494
                },
                {
                  "lon": 120.7894,
                  "lat": 48.8292
                }
              ],
              [
                {
                  "lon": 101.4816,
                  "lat": 38.221
                },
                {
                  "lon": 103.3176,
                  "lat": 38.221
                },
                {
                  "lon": 103.3176,
                  "lat": 38.4008
                },
                {
                  "lon": 100.1046,
                  "lat": 38.4008
                },
                {
                  "lon": 100.1046,
                  "lat": 38.221
                },
                {
                  "lon": 101.4816,
                  "lat": 38.221
                }
              ],
              [
                {
                  "lon": 111.3302,
                  "lat": 22.039
                },
                {
                  "lon": 113.6582,
                  "lat": 22.039
                },
                {
                  "lon": 113.6582,
                  "lat": 21.8592
                },
                {
                  "lon": 109.5842,
                  "lat": 21.8592
                },
                {
                  "lon": 109.5842,
                  "lat": 22.039
                },
                {
                  "lon": 111.3302,
                  "lat": 22.039
                }
              ],
              [
                {
                  "lon": 128.7617,
                  "lat": 43.9746
                },
                {
                  "lon": 129.5114,
                  "lat": 43.9746
                },
                {
                  "lon": 129.5114,
                  "lat": 43.7948
                },
                {
                  "lon": 128.2619,
                  "lat": 43.7948
                },
                {
                  "lon": 128.2619,
                  "lat": 43.9746
                },
                {
                  "lon": 128.7617,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 115.0243,
                  "lat": 26.8936
                },
                {
                  "lon": 114.4183,
                  "lat": 26.8936
                },
                {
                  "lon": 114.4183,
                  "lat": 27.0734
                },
                {
                  "lon": 116.0343,
                  "lat": 27.0734
                },
                {
                  "lon": 116.0343,
                  "lat": 26.8936
                },
                {
                  "lon": 115.0243,
                  "lat": 26.8936
                }
              ],
              [
                {
                  "lon": 110.9694,
                  "lat": 29.231
                },
                {
                  "lon": 110.9694,
                  "lat": 29.4108
                },
                {
                  "lon": 112.0019,
                  "lat": 29.4108
                },
                {
                  "lon": 112.0019,
                  "lat": 29.231
                },
                {
                  "lon": 110.9694,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 115.7188,
                  "lat": 27.2532
                },
                {
                  "lon": 116.1234,
                  "lat": 27.2532
                },
                {
                  "lon": 116.1234,
                  "lat": 27.0734
                },
                {
                  "lon": 113.0889,
                  "lat": 27.0734
                },
                {
                  "lon": 113.0889,
                  "lat": 27.2532
                },
                {
                  "lon": 115.7188,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 94.9944,
                  "lat": 37.6816
                },
                {
                  "lon": 94.5388,
                  "lat": 37.6816
                },
                {
                  "lon": 94.5388,
                  "lat": 37.8614
                },
                {
                  "lon": 95.6778,
                  "lat": 37.8614
                },
                {
                  "lon": 95.6778,
                  "lat": 37.6816
                },
                {
                  "lon": 94.9944,
                  "lat": 37.6816
                }
              ],
              [
                {
                  "lon": 82.5192,
                  "lat": 45.0534
                },
                {
                  "lon": 82.5192,
                  "lat": 44.8736
                },
                {
                  "lon": 80.2278,
                  "lat": 44.8736
                },
                {
                  "lon": 80.2278,
                  "lat": 45.0534
                },
                {
                  "lon": 82.5192,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 101.9349,
                  "lat": 37.5018
                },
                {
                  "lon": 101.9349,
                  "lat": 37.6816
                },
                {
                  "lon": 101.2533,
                  "lat": 37.6816
                },
                {
                  "lon": 101.2533,
                  "lat": 37.5018
                },
                {
                  "lon": 101.9349,
                  "lat": 37.5018
                }
              ],
              [
                {
                  "lon": 119.9949,
                  "lat": 42.3564
                },
                {
                  "lon": 117.3098,
                  "lat": 42.3564
                },
                {
                  "lon": 117.3098,
                  "lat": 42.5362
                },
                {
                  "lon": 121.4595,
                  "lat": 42.5362
                },
                {
                  "lon": 121.4595,
                  "lat": 42.3564
                },
                {
                  "lon": 119.9949,
                  "lat": 42.3564
                }
              ],
              [
                {
                  "lon": 135.4884,
                  "lat": 47.7504
                },
                {
                  "lon": 130.4059,
                  "lat": 47.7504
                },
                {
                  "lon": 130.4059,
                  "lat": 47.5706
                },
                {
                  "lon": 135.4884,
                  "lat": 47.5706
                },
                {
                  "lon": 135.4884,
                  "lat": 47.7504
                }
              ],
              [
                {
                  "lon": 78.1188,
                  "lat": 40.7382
                },
                {
                  "lon": 80.2554,
                  "lat": 40.7382
                },
                {
                  "lon": 80.2554,
                  "lat": 40.5584
                },
                {
                  "lon": 78.1188,
                  "lat": 40.5584
                },
                {
                  "lon": 78.1188,
                  "lat": 40.7382
                }
              ],
              [
                {
                  "lon": 111.7553,
                  "lat": 27.433
                },
                {
                  "lon": 112.7683,
                  "lat": 27.433
                },
                {
                  "lon": 112.7683,
                  "lat": 27.2532
                },
                {
                  "lon": 111.7553,
                  "lat": 27.2532
                },
                {
                  "lon": 111.7553,
                  "lat": 27.433
                }
              ],
              [
                {
                  "lon": 120.6718,
                  "lat": 49.1888
                },
                {
                  "lon": 119.2908,
                  "lat": 49.1888
                },
                {
                  "lon": 119.2908,
                  "lat": 49.3686
                },
                {
                  "lon": 121.7766,
                  "lat": 49.3686
                },
                {
                  "lon": 121.7766,
                  "lat": 49.1888
                },
                {
                  "lon": 120.6718,
                  "lat": 49.1888
                }
              ],
              [
                {
                  "lon": 96.9805,
                  "lat": 36.0634
                },
                {
                  "lon": 98.538,
                  "lat": 36.0634
                },
                {
                  "lon": 98.538,
                  "lat": 35.8836
                },
                {
                  "lon": 96.758,
                  "lat": 35.8836
                },
                {
                  "lon": 96.758,
                  "lat": 36.0634
                },
                {
                  "lon": 96.9805,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 110.3042,
                  "lat": 19.1622
                },
                {
                  "lon": 111.2562,
                  "lat": 19.1622
                },
                {
                  "lon": 111.2562,
                  "lat": 18.9824
                },
                {
                  "lon": 107.829,
                  "lat": 18.9824
                },
                {
                  "lon": 107.829,
                  "lat": 19.1622
                },
                {
                  "lon": 110.3042,
                  "lat": 19.1622
                }
              ],
              [
                {
                  "lon": 116.5063,
                  "lat": 42.5362
                },
                {
                  "lon": 114.7927,
                  "lat": 42.5362
                },
                {
                  "lon": 114.7927,
                  "lat": 42.716
                },
                {
                  "lon": 116.7511,
                  "lat": 42.716
                },
                {
                  "lon": 116.7511,
                  "lat": 42.5362
                },
                {
                  "lon": 116.5063,
                  "lat": 42.5362
                }
              ],
              [
                {
                  "lon": 114.8237,
                  "lat": 23.6572
                },
                {
                  "lon": 115.4135,
                  "lat": 23.6572
                },
                {
                  "lon": 115.4135,
                  "lat": 23.837
                },
                {
                  "lon": 113.0543,
                  "lat": 23.837
                },
                {
                  "lon": 113.0543,
                  "lat": 23.6572
                },
                {
                  "lon": 114.8237,
                  "lat": 23.6572
                }
              ],
              [
                {
                  "lon": 122.5533,
                  "lat": 40.3786
                },
                {
                  "lon": 125.8671,
                  "lat": 40.3786
                },
                {
                  "lon": 125.8671,
                  "lat": 40.5584
                },
                {
                  "lon": 121.3698,
                  "lat": 40.5584
                },
                {
                  "lon": 121.3698,
                  "lat": 40.3786
                },
                {
                  "lon": 122.5533,
                  "lat": 40.3786
                }
              ],
              [
                {
                  "lon": 116.2216,
                  "lat": 29.231
                },
                {
                  "lon": 115.3972,
                  "lat": 29.231
                },
                {
                  "lon": 115.3972,
                  "lat": 29.0512
                },
                {
                  "lon": 116.6338,
                  "lat": 29.0512
                },
                {
                  "lon": 116.6338,
                  "lat": 29.231
                },
                {
                  "lon": 116.2216,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 126.1603,
                  "lat": 43.0756
                },
                {
                  "lon": 126.1603,
                  "lat": 43.2554
                },
                {
                  "lon": 123.9382,
                  "lat": 43.2554
                },
                {
                  "lon": 123.9382,
                  "lat": 43.0756
                },
                {
                  "lon": 126.1603,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 80.531,
                  "lat": 43.7948
                },
                {
                  "lon": 80.2811,
                  "lat": 43.7948
                },
                {
                  "lon": 80.2811,
                  "lat": 43.9746
                },
                {
                  "lon": 83.03,
                  "lat": 43.9746
                },
                {
                  "lon": 83.03,
                  "lat": 43.7948
                },
                {
                  "lon": 80.531,
                  "lat": 43.7948
                }
              ],
              [
                {
                  "lon": 111.1058,
                  "lat": 19.8814
                },
                {
                  "lon": 108.429,
                  "lat": 19.8814
                },
                {
                  "lon": 108.429,
                  "lat": 19.7016
                },
                {
                  "lon": 111.6794,
                  "lat": 19.7016
                },
                {
                  "lon": 111.6794,
                  "lat": 19.8814
                },
                {
                  "lon": 111.1058,
                  "lat": 19.8814
                }
              ],
              [
                {
                  "lon": 105.417,
                  "lat": 24.736
                },
                {
                  "lon": 105.6153,
                  "lat": 24.736
                },
                {
                  "lon": 105.6153,
                  "lat": 24.9158
                },
                {
                  "lon": 104.6238,
                  "lat": 24.9158
                },
                {
                  "lon": 104.6238,
                  "lat": 24.736
                },
                {
                  "lon": 105.417,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 130.1557,
                  "lat": 47.5706
                },
                {
                  "lon": 129.8891,
                  "lat": 47.5706
                },
                {
                  "lon": 129.8891,
                  "lat": 47.3908
                },
                {
                  "lon": 134.6879,
                  "lat": 47.3908
                },
                {
                  "lon": 134.6879,
                  "lat": 47.5706
                },
                {
                  "lon": 130.1557,
                  "lat": 47.5706
                }
              ],
              [
                {
                  "lon": 105.389,
                  "lat": 38.7604
                },
                {
                  "lon": 104.6972,
                  "lat": 38.7604
                },
                {
                  "lon": 104.6972,
                  "lat": 38.5806
                },
                {
                  "lon": 106.0808,
                  "lat": 38.5806
                },
                {
                  "lon": 106.0808,
                  "lat": 38.7604
                },
                {
                  "lon": 105.389,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 123.6627,
                  "lat": 46.6716
                },
                {
                  "lon": 124.449,
                  "lat": 46.6716
                },
                {
                  "lon": 124.449,
                  "lat": 46.4918
                },
                {
                  "lon": 121.3038,
                  "lat": 46.4918
                },
                {
                  "lon": 121.3038,
                  "lat": 46.6716
                },
                {
                  "lon": 123.6627,
                  "lat": 46.6716
                }
              ],
              [
                {
                  "lon": 129.1231,
                  "lat": 43.0756
                },
                {
                  "lon": 127.8886,
                  "lat": 43.0756
                },
                {
                  "lon": 127.8886,
                  "lat": 43.2554
                },
                {
                  "lon": 129.8638,
                  "lat": 43.2554
                },
                {
                  "lon": 129.8638,
                  "lat": 43.0756
                },
                {
                  "lon": 129.1231,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 110.7602,
                  "lat": 18.8026
                },
                {
                  "lon": 110.9502,
                  "lat": 18.8026
                },
                {
                  "lon": 110.9502,
                  "lat": 18.6228
                },
                {
                  "lon": 108.4802,
                  "lat": 18.6228
                },
                {
                  "lon": 108.4802,
                  "lat": 18.8026
                },
                {
                  "lon": 110.7602,
                  "lat": 18.8026
                }
              ],
              [
                {
                  "lon": 123.2978,
                  "lat": 44.6938
                },
                {
                  "lon": 123.044,
                  "lat": 44.6938
                },
                {
                  "lon": 123.044,
                  "lat": 44.8736
                },
                {
                  "lon": 127.6124,
                  "lat": 44.8736
                },
                {
                  "lon": 127.6124,
                  "lat": 44.6938
                },
                {
                  "lon": 123.2978,
                  "lat": 44.6938
                }
              ],
              [
                {
                  "lon": 109.1215,
                  "lat": 27.2532
                },
                {
                  "lon": 109.1215,
                  "lat": 27.433
                },
                {
                  "lon": 109.3241,
                  "lat": 27.433
                },
                {
                  "lon": 109.3241,
                  "lat": 27.2532
                },
                {
                  "lon": 109.1215,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 123.0071,
                  "lat": 42.8958
                },
                {
                  "lon": 127.1925,
                  "lat": 42.8958
                },
                {
                  "lon": 127.1925,
                  "lat": 43.0756
                },
                {
                  "lon": 123.0071,
                  "lat": 43.0756
                },
                {
                  "lon": 123.0071,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 85.3385,
                  "lat": 42.8958
                },
                {
                  "lon": 84.3537,
                  "lat": 42.8958
                },
                {
                  "lon": 84.3537,
                  "lat": 43.0756
                },
                {
                  "lon": 85.3385,
                  "lat": 43.0756
                },
                {
                  "lon": 85.3385,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 100.6103,
                  "lat": 36.9624
                },
                {
                  "lon": 100.6103,
                  "lat": 36.7826
                },
                {
                  "lon": 102.186,
                  "lat": 36.7826
                },
                {
                  "lon": 102.186,
                  "lat": 36.9624
                },
                {
                  "lon": 100.6103,
                  "lat": 36.9624
                }
              ],
              [
                {
                  "lon": 128.0948,
                  "lat": 49.5484
                },
                {
                  "lon": 129.764,
                  "lat": 49.5484
                },
                {
                  "lon": 129.764,
                  "lat": 49.7282
                },
                {
                  "lon": 126.982,
                  "lat": 49.7282
                },
                {
                  "lon": 126.982,
                  "lat": 49.5484
                },
                {
                  "lon": 128.0948,
                  "lat": 49.5484
                }
              ],
              [
                {
                  "lon": 115.2468,
                  "lat": 26.1744
                },
                {
                  "lon": 115.6482,
                  "lat": 26.1744
                },
                {
                  "lon": 115.6482,
                  "lat": 26.3542
                },
                {
                  "lon": 114.0426,
                  "lat": 26.3542
                },
                {
                  "lon": 114.0426,
                  "lat": 26.1744
                },
                {
                  "lon": 115.2468,
                  "lat": 26.1744
                }
              ],
              [
                {
                  "lon": 110.2567,
                  "lat": 27.2532
                },
                {
                  "lon": 109.4475,
                  "lat": 27.2532
                },
                {
                  "lon": 109.4475,
                  "lat": 27.0734
                },
                {
                  "lon": 110.459,
                  "lat": 27.0734
                },
                {
                  "lon": 110.459,
                  "lat": 27.2532
                },
                {
                  "lon": 110.2567,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 113.3035,
                  "lat": 41.4574
                },
                {
                  "lon": 113.5441,
                  "lat": 41.4574
                },
                {
                  "lon": 113.5441,
                  "lat": 41.6372
                },
                {
                  "lon": 112.3411,
                  "lat": 41.6372
                },
                {
                  "lon": 112.3411,
                  "lat": 41.4574
                },
                {
                  "lon": 113.3035,
                  "lat": 41.4574
                }
              ],
              [
                {
                  "lon": 109.8458,
                  "lat": 19.5218
                },
                {
                  "lon": 111.3722,
                  "lat": 19.5218
                },
                {
                  "lon": 111.3722,
                  "lat": 19.342
                },
                {
                  "lon": 108.5102,
                  "lat": 19.342
                },
                {
                  "lon": 108.5102,
                  "lat": 19.5218
                },
                {
                  "lon": 109.8458,
                  "lat": 19.5218
                }
              ],
              [
                {
                  "lon": 121.0618,
                  "lat": 45.413
                },
                {
                  "lon": 122.0898,
                  "lat": 45.413
                },
                {
                  "lon": 122.0898,
                  "lat": 45.5928
                },
                {
                  "lon": 120.5478,
                  "lat": 45.5928
                },
                {
                  "lon": 120.5478,
                  "lat": 45.413
                },
                {
                  "lon": 121.0618,
                  "lat": 45.413
                }
              ],
              [
                {
                  "lon": 123.8632,
                  "lat": 47.0312
                },
                {
                  "lon": 121.4881,
                  "lat": 47.0312
                },
                {
                  "lon": 121.4881,
                  "lat": 46.8514
                },
                {
                  "lon": 124.1271,
                  "lat": 46.8514
                },
                {
                  "lon": 124.1271,
                  "lat": 47.0312
                },
                {
                  "lon": 123.8632,
                  "lat": 47.0312
                }
              ],
              [
                {
                  "lon": 103.1476,
                  "lat": 31.2088
                },
                {
                  "lon": 102.9373,
                  "lat": 31.2088
                },
                {
                  "lon": 102.9373,
                  "lat": 31.029
                },
                {
                  "lon": 104.6197,
                  "lat": 31.029
                },
                {
                  "lon": 104.6197,
                  "lat": 31.2088
                },
                {
                  "lon": 103.1476,
                  "lat": 31.2088
                }
              ],
              [
                {
                  "lon": 124.3632,
                  "lat": 48.4696
                },
                {
                  "lon": 123.8188,
                  "lat": 48.4696
                },
                {
                  "lon": 123.8188,
                  "lat": 48.6494
                },
                {
                  "lon": 128.174,
                  "lat": 48.6494
                },
                {
                  "lon": 128.174,
                  "lat": 48.4696
                },
                {
                  "lon": 124.3632,
                  "lat": 48.4696
                }
              ],
              [
                {
                  "lon": 126.56,
                  "lat": 51.8858
                },
                {
                  "lon": 125.6858,
                  "lat": 51.8858
                },
                {
                  "lon": 125.6858,
                  "lat": 51.706
                },
                {
                  "lon": 127.1428,
                  "lat": 51.706
                },
                {
                  "lon": 127.1428,
                  "lat": 51.8858
                },
                {
                  "lon": 126.56,
                  "lat": 51.8858
                }
              ],
              [
                {
                  "lon": 101.4305,
                  "lat": 36.0634
                },
                {
                  "lon": 100.9855,
                  "lat": 36.0634
                },
                {
                  "lon": 100.9855,
                  "lat": 35.8836
                },
                {
                  "lon": 101.653,
                  "lat": 35.8836
                },
                {
                  "lon": 101.653,
                  "lat": 36.0634
                },
                {
                  "lon": 101.4305,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 114.4909,
                  "lat": 30.8492
                },
                {
                  "lon": 113.4434,
                  "lat": 30.8492
                },
                {
                  "lon": 113.4434,
                  "lat": 30.6694
                },
                {
                  "lon": 115.3289,
                  "lat": 30.6694
                },
                {
                  "lon": 115.3289,
                  "lat": 30.8492
                },
                {
                  "lon": 114.4909,
                  "lat": 30.8492
                }
              ],
              [
                {
                  "lon": 128.8016,
                  "lat": 45.2332
                },
                {
                  "lon": 125.7272,
                  "lat": 45.2332
                },
                {
                  "lon": 125.7272,
                  "lat": 45.413
                },
                {
                  "lon": 128.8016,
                  "lat": 45.413
                },
                {
                  "lon": 128.8016,
                  "lat": 45.2332
                }
              ],
              [
                {
                  "lon": 97.7241,
                  "lat": 40.1988
                },
                {
                  "lon": 98.1951,
                  "lat": 40.1988
                },
                {
                  "lon": 98.1951,
                  "lat": 40.019
                },
                {
                  "lon": 97.7241,
                  "lat": 40.019
                },
                {
                  "lon": 97.7241,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 84.4664,
                  "lat": 44.6938
                },
                {
                  "lon": 84.2126,
                  "lat": 44.6938
                },
                {
                  "lon": 84.2126,
                  "lat": 44.8736
                },
                {
                  "lon": 85.2278,
                  "lat": 44.8736
                },
                {
                  "lon": 85.2278,
                  "lat": 44.6938
                },
                {
                  "lon": 84.4664,
                  "lat": 44.6938
                }
              ],
              [
                {
                  "lon": 119.9583,
                  "lat": 26.534
                },
                {
                  "lon": 117.9483,
                  "lat": 26.534
                },
                {
                  "lon": 117.9483,
                  "lat": 26.3542
                },
                {
                  "lon": 120.1593,
                  "lat": 26.3542
                },
                {
                  "lon": 120.1593,
                  "lat": 26.534
                },
                {
                  "lon": 119.9583,
                  "lat": 26.534
                }
              ],
              [
                {
                  "lon": 121.2771,
                  "lat": 38.0412
                },
                {
                  "lon": 121.2771,
                  "lat": 38.221
                },
                {
                  "lon": 120.5904,
                  "lat": 38.221
                },
                {
                  "lon": 120.5904,
                  "lat": 38.0412
                },
                {
                  "lon": 121.2771,
                  "lat": 38.0412
                }
              ],
              [
                {
                  "lon": 107.9964,
                  "lat": 30.6694
                },
                {
                  "lon": 109.8819,
                  "lat": 30.6694
                },
                {
                  "lon": 109.8819,
                  "lat": 30.8492
                },
                {
                  "lon": 107.3679,
                  "lat": 30.8492
                },
                {
                  "lon": 107.3679,
                  "lat": 30.6694
                },
                {
                  "lon": 107.9964,
                  "lat": 30.6694
                }
              ],
              [
                {
                  "lon": 115.1384,
                  "lat": 26.7138
                },
                {
                  "lon": 116.1469,
                  "lat": 26.7138
                },
                {
                  "lon": 116.1469,
                  "lat": 26.8936
                },
                {
                  "lon": 114.5333,
                  "lat": 26.8936
                },
                {
                  "lon": 114.5333,
                  "lat": 26.7138
                },
                {
                  "lon": 115.1384,
                  "lat": 26.7138
                }
              ],
              [
                {
                  "lon": 109.9087,
                  "lat": 23.837
                },
                {
                  "lon": 109.9087,
                  "lat": 23.6572
                },
                {
                  "lon": 108.7291,
                  "lat": 23.6572
                },
                {
                  "lon": 108.7291,
                  "lat": 23.837
                },
                {
                  "lon": 109.9087,
                  "lat": 23.837
                }
              ],
              [
                {
                  "lon": 102.6342,
                  "lat": 37.8614
                },
                {
                  "lon": 101.7206,
                  "lat": 37.8614
                },
                {
                  "lon": 101.7206,
                  "lat": 38.0412
                },
                {
                  "lon": 103.7762,
                  "lat": 38.0412
                },
                {
                  "lon": 103.7762,
                  "lat": 37.8614
                },
                {
                  "lon": 102.6342,
                  "lat": 37.8614
                }
              ],
              [
                {
                  "lon": 134.1567,
                  "lat": 47.211
                },
                {
                  "lon": 135.2195,
                  "lat": 47.211
                },
                {
                  "lon": 135.2195,
                  "lat": 47.3908
                },
                {
                  "lon": 129.3741,
                  "lat": 47.3908
                },
                {
                  "lon": 129.3741,
                  "lat": 47.211
                },
                {
                  "lon": 134.1567,
                  "lat": 47.211
                }
              ],
              [
                {
                  "lon": 105.7973,
                  "lat": 37.6816
                },
                {
                  "lon": 105.3429,
                  "lat": 37.6816
                },
                {
                  "lon": 105.3429,
                  "lat": 37.5018
                },
                {
                  "lon": 105.7973,
                  "lat": 37.5018
                },
                {
                  "lon": 105.7973,
                  "lat": 37.6816
                }
              ],
              [
                {
                  "lon": 123.5466,
                  "lat": 48.4696
                },
                {
                  "lon": 122.4578,
                  "lat": 48.4696
                },
                {
                  "lon": 122.4578,
                  "lat": 48.6494
                },
                {
                  "lon": 123.5466,
                  "lat": 48.6494
                },
                {
                  "lon": 123.5466,
                  "lat": 48.4696
                }
              ],
              [
                {
                  "lon": 121.7013,
                  "lat": 37.6816
                },
                {
                  "lon": 119.8837,
                  "lat": 37.6816
                },
                {
                  "lon": 119.8837,
                  "lat": 37.5018
                },
                {
                  "lon": 121.9285,
                  "lat": 37.5018
                },
                {
                  "lon": 121.9285,
                  "lat": 37.6816
                },
                {
                  "lon": 121.7013,
                  "lat": 37.6816
                }
              ],
              [
                {
                  "lon": 129.5116,
                  "lat": 45.7726
                },
                {
                  "lon": 133.3921,
                  "lat": 45.7726
                },
                {
                  "lon": 133.3921,
                  "lat": 45.9524
                },
                {
                  "lon": 125.6311,
                  "lat": 45.9524
                },
                {
                  "lon": 125.6311,
                  "lat": 45.7726
                },
                {
                  "lon": 129.5116,
                  "lat": 45.7726
                }
              ],
              [
                {
                  "lon": 114.435,
                  "lat": 22.938
                },
                {
                  "lon": 116.5833,
                  "lat": 22.938
                },
                {
                  "lon": 116.5833,
                  "lat": 22.7582
                },
                {
                  "lon": 110.529,
                  "lat": 22.7582
                },
                {
                  "lon": 110.529,
                  "lat": 22.938
                },
                {
                  "lon": 114.435,
                  "lat": 22.938
                }
              ],
              [
                {
                  "lon": 100.8281,
                  "lat": 37.322
                },
                {
                  "lon": 101.0543,
                  "lat": 37.322
                },
                {
                  "lon": 101.0543,
                  "lat": 37.1422
                },
                {
                  "lon": 100.8281,
                  "lat": 37.1422
                },
                {
                  "lon": 100.8281,
                  "lat": 37.322
                }
              ],
              [
                {
                  "lon": 126.7661,
                  "lat": 46.8514
                },
                {
                  "lon": 125.9744,
                  "lat": 46.8514
                },
                {
                  "lon": 125.9744,
                  "lat": 47.0312
                },
                {
                  "lon": 128.6134,
                  "lat": 47.0312
                },
                {
                  "lon": 128.6134,
                  "lat": 46.8514
                },
                {
                  "lon": 126.7661,
                  "lat": 46.8514
                }
              ],
              [
                {
                  "lon": 117.3445,
                  "lat": 43.0756
                },
                {
                  "lon": 116.8521,
                  "lat": 43.0756
                },
                {
                  "lon": 116.8521,
                  "lat": 42.8958
                },
                {
                  "lon": 117.8369,
                  "lat": 42.8958
                },
                {
                  "lon": 117.8369,
                  "lat": 43.0756
                },
                {
                  "lon": 117.3445,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 80.2807,
                  "lat": 41.4574
                },
                {
                  "lon": 79.8007,
                  "lat": 41.4574
                },
                {
                  "lon": 79.8007,
                  "lat": 41.2776
                },
                {
                  "lon": 81.0007,
                  "lat": 41.2776
                },
                {
                  "lon": 81.0007,
                  "lat": 41.4574
                },
                {
                  "lon": 80.2807,
                  "lat": 41.4574
                }
              ],
              [
                {
                  "lon": 106.0602,
                  "lat": 38.0412
                },
                {
                  "lon": 107.8874,
                  "lat": 38.0412
                },
                {
                  "lon": 107.8874,
                  "lat": 37.8614
                },
                {
                  "lon": 105.8318,
                  "lat": 37.8614
                },
                {
                  "lon": 105.8318,
                  "lat": 38.0412
                },
                {
                  "lon": 106.0602,
                  "lat": 38.0412
                }
              ],
              [
                {
                  "lon": 118.8217,
                  "lat": 43.0756
                },
                {
                  "lon": 119.5603,
                  "lat": 43.0756
                },
                {
                  "lon": 119.5603,
                  "lat": 42.8958
                },
                {
                  "lon": 118.3293,
                  "lat": 42.8958
                },
                {
                  "lon": 118.3293,
                  "lat": 43.0756
                },
                {
                  "lon": 118.8217,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 121.6587,
                  "lat": 28.8714
                },
                {
                  "lon": 116.7219,
                  "lat": 28.8714
                },
                {
                  "lon": 116.7219,
                  "lat": 29.0512
                },
                {
                  "lon": 122.4815,
                  "lat": 29.0512
                },
                {
                  "lon": 122.4815,
                  "lat": 28.8714
                },
                {
                  "lon": 121.6587,
                  "lat": 28.8714
                }
              ],
              [
                {
                  "lon": 121.4082,
                  "lat": 39.12
                },
                {
                  "lon": 120.481,
                  "lat": 39.12
                },
                {
                  "lon": 120.481,
                  "lat": 38.9402
                },
                {
                  "lon": 122.3354,
                  "lat": 38.9402
                },
                {
                  "lon": 122.3354,
                  "lat": 39.12
                },
                {
                  "lon": 121.4082,
                  "lat": 39.12
                }
              ],
              [
                {
                  "lon": 109.3904,
                  "lat": 20.9602
                },
                {
                  "lon": 109.0052,
                  "lat": 20.9602
                },
                {
                  "lon": 109.0052,
                  "lat": 20.7804
                },
                {
                  "lon": 110.7386,
                  "lat": 20.7804
                },
                {
                  "lon": 110.7386,
                  "lat": 20.9602
                },
                {
                  "lon": 109.3904,
                  "lat": 20.9602
                }
              ],
              [
                {
                  "lon": 127.5175,
                  "lat": 49.908
                },
                {
                  "lon": 126.116,
                  "lat": 49.908
                },
                {
                  "lon": 126.116,
                  "lat": 50.0878
                },
                {
                  "lon": 127.7978,
                  "lat": 50.0878
                },
                {
                  "lon": 127.7978,
                  "lat": 49.908
                },
                {
                  "lon": 127.5175,
                  "lat": 49.908
                }
              ],
              [
                {
                  "lon": 87.1959,
                  "lat": 42.1766
                },
                {
                  "lon": 88.8997,
                  "lat": 42.1766
                },
                {
                  "lon": 88.8997,
                  "lat": 42.3564
                },
                {
                  "lon": 85.9789,
                  "lat": 42.3564
                },
                {
                  "lon": 85.9789,
                  "lat": 42.1766
                },
                {
                  "lon": 87.1959,
                  "lat": 42.1766
                }
              ],
              [
                {
                  "lon": 110.4903,
                  "lat": 24.736
                },
                {
                  "lon": 110.6883,
                  "lat": 24.736
                },
                {
                  "lon": 110.6883,
                  "lat": 24.5562
                },
                {
                  "lon": 108.9063,
                  "lat": 24.5562
                },
                {
                  "lon": 108.9063,
                  "lat": 24.736
                },
                {
                  "lon": 110.4903,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 114.6704,
                  "lat": 28.5118
                },
                {
                  "lon": 114.8754,
                  "lat": 28.5118
                },
                {
                  "lon": 114.8754,
                  "lat": 28.6916
                },
                {
                  "lon": 114.2604,
                  "lat": 28.6916
                },
                {
                  "lon": 114.2604,
                  "lat": 28.5118
                },
                {
                  "lon": 114.6704,
                  "lat": 28.5118
                }
              ],
              [
                {
                  "lon": 111.6342,
                  "lat": 26.3542
                },
                {
                  "lon": 112.0356,
                  "lat": 26.3542
                },
                {
                  "lon": 112.0356,
                  "lat": 26.1744
                },
                {
                  "lon": 111.6342,
                  "lat": 26.1744
                },
                {
                  "lon": 111.6342,
                  "lat": 26.3542
                }
              ],
              [
                {
                  "lon": 94.1916,
                  "lat": 40.019
                },
                {
                  "lon": 95.8401,
                  "lat": 40.019
                },
                {
                  "lon": 95.8401,
                  "lat": 40.1988
                },
                {
                  "lon": 93.9561,
                  "lat": 40.1988
                },
                {
                  "lon": 93.9561,
                  "lat": 40.019
                },
                {
                  "lon": 94.1916,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 126.3934,
                  "lat": 47.5706
                },
                {
                  "lon": 127.1959,
                  "lat": 47.5706
                },
                {
                  "lon": 127.1959,
                  "lat": 47.7504
                },
                {
                  "lon": 126.3934,
                  "lat": 47.7504
                },
                {
                  "lon": 126.3934,
                  "lat": 47.5706
                }
              ],
              [
                {
                  "lon": 106.965,
                  "lat": 33.726
                },
                {
                  "lon": 103.7145,
                  "lat": 33.726
                },
                {
                  "lon": 103.7145,
                  "lat": 33.9058
                },
                {
                  "lon": 107.1817,
                  "lat": 33.9058
                },
                {
                  "lon": 107.1817,
                  "lat": 33.726
                },
                {
                  "lon": 106.965,
                  "lat": 33.726
                }
              ],
              [
                {
                  "lon": 112.9566,
                  "lat": 38.4008
                },
                {
                  "lon": 118.2351,
                  "lat": 38.4008
                },
                {
                  "lon": 118.2351,
                  "lat": 38.221
                },
                {
                  "lon": 110.8911,
                  "lat": 38.221
                },
                {
                  "lon": 110.8911,
                  "lat": 38.4008
                },
                {
                  "lon": 112.9566,
                  "lat": 38.4008
                }
              ],
              [
                {
                  "lon": 116.8707,
                  "lat": 25.9946
                },
                {
                  "lon": 113.6691,
                  "lat": 25.9946
                },
                {
                  "lon": 113.6691,
                  "lat": 25.8148
                },
                {
                  "lon": 116.8707,
                  "lat": 25.8148
                },
                {
                  "lon": 116.8707,
                  "lat": 25.9946
                }
              ],
              [
                {
                  "lon": 116.4303,
                  "lat": 26.7138
                },
                {
                  "lon": 113.6121,
                  "lat": 26.7138
                },
                {
                  "lon": 113.6121,
                  "lat": 26.534
                },
                {
                  "lon": 116.6316,
                  "lat": 26.534
                },
                {
                  "lon": 116.6316,
                  "lat": 26.7138
                },
                {
                  "lon": 116.4303,
                  "lat": 26.7138
                }
              ],
              [
                {
                  "lon": 84.928,
                  "lat": 43.2554
                },
                {
                  "lon": 83.4466,
                  "lat": 43.2554
                },
                {
                  "lon": 83.4466,
                  "lat": 43.0756
                },
                {
                  "lon": 85.4218,
                  "lat": 43.0756
                },
                {
                  "lon": 85.4218,
                  "lat": 43.2554
                },
                {
                  "lon": 84.928,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 103.7748,
                  "lat": 38.7604
                },
                {
                  "lon": 103.7748,
                  "lat": 38.5806
                },
                {
                  "lon": 102.6218,
                  "lat": 38.5806
                },
                {
                  "lon": 102.6218,
                  "lat": 38.7604
                },
                {
                  "lon": 103.7748,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 85.4793,
                  "lat": 41.6372
                },
                {
                  "lon": 85.238,
                  "lat": 41.6372
                },
                {
                  "lon": 85.238,
                  "lat": 41.817
                },
                {
                  "lon": 85.9619,
                  "lat": 41.817
                },
                {
                  "lon": 85.9619,
                  "lat": 41.6372
                },
                {
                  "lon": 85.4793,
                  "lat": 41.6372
                }
              ],
              [
                {
                  "lon": 120.8217,
                  "lat": 30.3098
                },
                {
                  "lon": 116.0308,
                  "lat": 30.3098
                },
                {
                  "lon": 116.0308,
                  "lat": 30.13
                },
                {
                  "lon": 122.9047,
                  "lat": 30.13
                },
                {
                  "lon": 122.9047,
                  "lat": 30.3098
                },
                {
                  "lon": 120.8217,
                  "lat": 30.3098
                }
              ],
              [
                {
                  "lon": 108.9261,
                  "lat": 31.3886
                },
                {
                  "lon": 110.1903,
                  "lat": 31.3886
                },
                {
                  "lon": 110.1903,
                  "lat": 31.2088
                },
                {
                  "lon": 108.0833,
                  "lat": 31.2088
                },
                {
                  "lon": 108.0833,
                  "lat": 31.3886
                },
                {
                  "lon": 108.9261,
                  "lat": 31.3886
                }
              ],
              [
                {
                  "lon": 129.9973,
                  "lat": 43.9746
                },
                {
                  "lon": 130.248,
                  "lat": 43.9746
                },
                {
                  "lon": 130.248,
                  "lat": 44.1544
                },
                {
                  "lon": 128.7438,
                  "lat": 44.1544
                },
                {
                  "lon": 128.7438,
                  "lat": 43.9746
                },
                {
                  "lon": 129.9973,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 106.976,
                  "lat": 35.1644
                },
                {
                  "lon": 109.181,
                  "lat": 35.1644
                },
                {
                  "lon": 109.181,
                  "lat": 35.3442
                },
                {
                  "lon": 106.3145,
                  "lat": 35.3442
                },
                {
                  "lon": 106.3145,
                  "lat": 35.1644
                },
                {
                  "lon": 106.976,
                  "lat": 35.1644
                }
              ],
              [
                {
                  "lon": 107.9325,
                  "lat": 28.332
                },
                {
                  "lon": 105.4809,
                  "lat": 28.332
                },
                {
                  "lon": 105.4809,
                  "lat": 28.1522
                },
                {
                  "lon": 108.1368,
                  "lat": 28.1522
                },
                {
                  "lon": 108.1368,
                  "lat": 28.332
                },
                {
                  "lon": 107.9325,
                  "lat": 28.332
                }
              ],
              [
                {
                  "lon": 124.7365,
                  "lat": 46.4918
                },
                {
                  "lon": 124.7365,
                  "lat": 46.312
                },
                {
                  "lon": 125.5201,
                  "lat": 46.312
                },
                {
                  "lon": 125.5201,
                  "lat": 46.4918
                },
                {
                  "lon": 124.7365,
                  "lat": 46.4918
                }
              ],
              [
                {
                  "lon": 121.7014,
                  "lat": 38.9402
                },
                {
                  "lon": 122.1638,
                  "lat": 38.9402
                },
                {
                  "lon": 122.1638,
                  "lat": 38.7604
                },
                {
                  "lon": 120.7766,
                  "lat": 38.7604
                },
                {
                  "lon": 120.7766,
                  "lat": 38.9402
                },
                {
                  "lon": 121.7014,
                  "lat": 38.9402
                }
              ],
              [
                {
                  "lon": 121.6245,
                  "lat": 47.3908
                },
                {
                  "lon": 121.3579,
                  "lat": 47.3908
                },
                {
                  "lon": 121.3579,
                  "lat": 47.5706
                },
                {
                  "lon": 125.0903,
                  "lat": 47.5706
                },
                {
                  "lon": 125.0903,
                  "lat": 47.3908
                },
                {
                  "lon": 121.6245,
                  "lat": 47.3908
                }
              ],
              [
                {
                  "lon": 125.591,
                  "lat": 49.7282
                },
                {
                  "lon": 124.2,
                  "lat": 49.7282
                },
                {
                  "lon": 124.2,
                  "lat": 49.5484
                },
                {
                  "lon": 125.591,
                  "lat": 49.5484
                },
                {
                  "lon": 125.591,
                  "lat": 49.7282
                }
              ],
              [
                {
                  "lon": 111.19,
                  "lat": 36.9624
                },
                {
                  "lon": 111.4151,
                  "lat": 36.9624
                },
                {
                  "lon": 111.4151,
                  "lat": 36.7826
                },
                {
                  "lon": 109.3892,
                  "lat": 36.7826
                },
                {
                  "lon": 109.3892,
                  "lat": 36.9624
                },
                {
                  "lon": 111.19,
                  "lat": 36.9624
                }
              ],
              [
                {
                  "lon": 116.3334,
                  "lat": 42.5362
                },
                {
                  "lon": 115.6011,
                  "lat": 42.5362
                },
                {
                  "lon": 115.6011,
                  "lat": 42.3564
                },
                {
                  "lon": 116.3334,
                  "lat": 42.3564
                },
                {
                  "lon": 116.3334,
                  "lat": 42.5362
                }
              ],
              [
                {
                  "lon": 104.6545,
                  "lat": 36.2432
                },
                {
                  "lon": 105.3235,
                  "lat": 36.2432
                },
                {
                  "lon": 105.3235,
                  "lat": 36.0634
                },
                {
                  "lon": 102.2015,
                  "lat": 36.0634
                },
                {
                  "lon": 102.2015,
                  "lat": 36.2432
                },
                {
                  "lon": 104.6545,
                  "lat": 36.2432
                }
              ],
              [
                {
                  "lon": 116.1254,
                  "lat": 44.1544
                },
                {
                  "lon": 116.8796,
                  "lat": 44.1544
                },
                {
                  "lon": 116.8796,
                  "lat": 44.3342
                },
                {
                  "lon": 115.6226,
                  "lat": 44.3342
                },
                {
                  "lon": 115.6226,
                  "lat": 44.1544
                },
                {
                  "lon": 116.1254,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 115.4517,
                  "lat": 42.8958
                },
                {
                  "lon": 116.1882,
                  "lat": 42.8958
                },
                {
                  "lon": 116.1882,
                  "lat": 42.716
                },
                {
                  "lon": 114.9607,
                  "lat": 42.716
                },
                {
                  "lon": 114.9607,
                  "lat": 42.8958
                },
                {
                  "lon": 115.4517,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 108.7881,
                  "lat": 24.736
                },
                {
                  "lon": 110.1762,
                  "lat": 24.736
                },
                {
                  "lon": 110.1762,
                  "lat": 24.9158
                },
                {
                  "lon": 108.5898,
                  "lat": 24.9158
                },
                {
                  "lon": 108.5898,
                  "lat": 24.736
                },
                {
                  "lon": 108.7881,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 126.4246,
                  "lat": 49.7282
                },
                {
                  "lon": 126.1453,
                  "lat": 49.7282
                },
                {
                  "lon": 126.1453,
                  "lat": 49.908
                },
                {
                  "lon": 129.2176,
                  "lat": 49.908
                },
                {
                  "lon": 129.2176,
                  "lat": 49.7282
                },
                {
                  "lon": 126.4246,
                  "lat": 49.7282
                }
              ],
              [
                {
                  "lon": 109.865,
                  "lat": 35.7038
                },
                {
                  "lon": 109.6435,
                  "lat": 35.7038
                },
                {
                  "lon": 109.6435,
                  "lat": 35.524
                },
                {
                  "lon": 109.865,
                  "lat": 35.524
                },
                {
                  "lon": 109.865,
                  "lat": 35.7038
                }
              ],
              [
                {
                  "lon": 119.3854,
                  "lat": 42.1766
                },
                {
                  "lon": 117.2011,
                  "lat": 42.1766
                },
                {
                  "lon": 117.2011,
                  "lat": 41.9968
                },
                {
                  "lon": 122.5405,
                  "lat": 41.9968
                },
                {
                  "lon": 122.5405,
                  "lat": 42.1766
                },
                {
                  "lon": 119.3854,
                  "lat": 42.1766
                }
              ],
              [
                {
                  "lon": 125.6182,
                  "lat": 49.3686
                },
                {
                  "lon": 124.2322,
                  "lat": 49.3686
                },
                {
                  "lon": 124.2322,
                  "lat": 49.5484
                },
                {
                  "lon": 125.6182,
                  "lat": 49.5484
                },
                {
                  "lon": 125.6182,
                  "lat": 49.3686
                }
              ],
              [
                {
                  "lon": 95.8228,
                  "lat": 29.7704
                },
                {
                  "lon": 96.03,
                  "lat": 29.7704
                },
                {
                  "lon": 96.03,
                  "lat": 29.5906
                },
                {
                  "lon": 95.4084,
                  "lat": 29.5906
                },
                {
                  "lon": 95.4084,
                  "lat": 29.7704
                },
                {
                  "lon": 95.8228,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 110.2899,
                  "lat": 38.0412
                },
                {
                  "lon": 108.9165,
                  "lat": 38.0412
                },
                {
                  "lon": 108.9165,
                  "lat": 38.221
                },
                {
                  "lon": 111.2055,
                  "lat": 38.221
                },
                {
                  "lon": 111.2055,
                  "lat": 38.0412
                },
                {
                  "lon": 110.2899,
                  "lat": 38.0412
                }
              ],
              [
                {
                  "lon": 128.9982,
                  "lat": 45.7726
                },
                {
                  "lon": 126.1624,
                  "lat": 45.7726
                },
                {
                  "lon": 126.1624,
                  "lat": 45.5928
                },
                {
                  "lon": 129.256,
                  "lat": 45.5928
                },
                {
                  "lon": 129.256,
                  "lat": 45.7726
                },
                {
                  "lon": 128.9982,
                  "lat": 45.7726
                }
              ],
              [
                {
                  "lon": 96.2705,
                  "lat": 36.423
                },
                {
                  "lon": 96.494,
                  "lat": 36.423
                },
                {
                  "lon": 96.494,
                  "lat": 36.2432
                },
                {
                  "lon": 94.4825,
                  "lat": 36.2432
                },
                {
                  "lon": 94.4825,
                  "lat": 36.423
                },
                {
                  "lon": 96.2705,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 118.6432,
                  "lat": 42.8958
                },
                {
                  "lon": 121.3437,
                  "lat": 42.8958
                },
                {
                  "lon": 121.3437,
                  "lat": 42.716
                },
                {
                  "lon": 117.6612,
                  "lat": 42.716
                },
                {
                  "lon": 117.6612,
                  "lat": 42.8958
                },
                {
                  "lon": 118.6432,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 110.7754,
                  "lat": 28.6916
                },
                {
                  "lon": 110.5704,
                  "lat": 28.6916
                },
                {
                  "lon": 110.5704,
                  "lat": 28.5118
                },
                {
                  "lon": 111.8004,
                  "lat": 28.5118
                },
                {
                  "lon": 111.8004,
                  "lat": 28.6916
                },
                {
                  "lon": 110.7754,
                  "lat": 28.6916
                }
              ],
              [
                {
                  "lon": 127.1298,
                  "lat": 48.11
                },
                {
                  "lon": 124.1565,
                  "lat": 48.11
                },
                {
                  "lon": 124.1565,
                  "lat": 48.2898
                },
                {
                  "lon": 127.9407,
                  "lat": 48.2898
                },
                {
                  "lon": 127.9407,
                  "lat": 48.11
                },
                {
                  "lon": 127.1298,
                  "lat": 48.11
                }
              ],
              [
                {
                  "lon": 109.2195,
                  "lat": 33.3664
                },
                {
                  "lon": 109.2195,
                  "lat": 33.1866
                },
                {
                  "lon": 108.7889,
                  "lat": 33.1866
                },
                {
                  "lon": 108.7889,
                  "lat": 33.3664
                },
                {
                  "lon": 109.2195,
                  "lat": 33.3664
                }
              ],
              [
                {
                  "lon": 107.8818,
                  "lat": 27.6128
                },
                {
                  "lon": 106.0521,
                  "lat": 27.6128
                },
                {
                  "lon": 106.0521,
                  "lat": 27.7926
                },
                {
                  "lon": 109.5082,
                  "lat": 27.7926
                },
                {
                  "lon": 109.5082,
                  "lat": 27.6128
                },
                {
                  "lon": 107.8818,
                  "lat": 27.6128
                }
              ],
              [
                {
                  "lon": 94.4118,
                  "lat": 38.0412
                },
                {
                  "lon": 96.0106,
                  "lat": 38.0412
                },
                {
                  "lon": 96.0106,
                  "lat": 37.8614
                },
                {
                  "lon": 94.4118,
                  "lat": 37.8614
                },
                {
                  "lon": 94.4118,
                  "lat": 38.0412
                }
              ],
              [
                {
                  "lon": 83.0284,
                  "lat": 44.8736
                },
                {
                  "lon": 83.0284,
                  "lat": 45.0534
                },
                {
                  "lon": 82.7738,
                  "lat": 45.0534
                },
                {
                  "lon": 82.7738,
                  "lat": 44.8736
                },
                {
                  "lon": 83.0284,
                  "lat": 44.8736
                }
              ],
              [
                {
                  "lon": 105.2344,
                  "lat": 37.5018
                },
                {
                  "lon": 105.6878,
                  "lat": 37.5018
                },
                {
                  "lon": 105.6878,
                  "lat": 37.322
                },
                {
                  "lon": 102.514,
                  "lat": 37.322
                },
                {
                  "lon": 102.514,
                  "lat": 37.5018
                },
                {
                  "lon": 105.2344,
                  "lat": 37.5018
                }
              ],
              [
                {
                  "lon": 120.5757,
                  "lat": 25.635
                },
                {
                  "lon": 117.9783,
                  "lat": 25.635
                },
                {
                  "lon": 117.9783,
                  "lat": 25.8148
                },
                {
                  "lon": 120.5757,
                  "lat": 25.8148
                },
                {
                  "lon": 120.5757,
                  "lat": 25.635
                }
              ],
              [
                {
                  "lon": 96.3334,
                  "lat": 36.7826
                },
                {
                  "lon": 96.3334,
                  "lat": 36.9624
                },
                {
                  "lon": 94.3075,
                  "lat": 36.9624
                },
                {
                  "lon": 94.3075,
                  "lat": 36.7826
                },
                {
                  "lon": 96.3334,
                  "lat": 36.7826
                }
              ],
              [
                {
                  "lon": 102.7683,
                  "lat": 24.736
                },
                {
                  "lon": 102.9663,
                  "lat": 24.736
                },
                {
                  "lon": 102.9663,
                  "lat": 24.5562
                },
                {
                  "lon": 101.9763,
                  "lat": 24.5562
                },
                {
                  "lon": 101.9763,
                  "lat": 24.736
                },
                {
                  "lon": 102.7683,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 109.6498,
                  "lat": 28.6916
                },
                {
                  "lon": 108.6228,
                  "lat": 28.6916
                },
                {
                  "lon": 108.6228,
                  "lat": 28.8714
                },
                {
                  "lon": 109.6498,
                  "lat": 28.8714
                },
                {
                  "lon": 109.6498,
                  "lat": 28.6916
                }
              ],
              [
                {
                  "lon": 109.6539,
                  "lat": 38.4008
                },
                {
                  "lon": 109.1937,
                  "lat": 38.4008
                },
                {
                  "lon": 109.1937,
                  "lat": 38.5806
                },
                {
                  "lon": 110.5743,
                  "lat": 38.5806
                },
                {
                  "lon": 110.5743,
                  "lat": 38.4008
                },
                {
                  "lon": 109.6539,
                  "lat": 38.4008
                }
              ],
              [
                {
                  "lon": 111.6874,
                  "lat": 29.231
                },
                {
                  "lon": 110.0386,
                  "lat": 29.231
                },
                {
                  "lon": 110.0386,
                  "lat": 29.0512
                },
                {
                  "lon": 112.0996,
                  "lat": 29.0512
                },
                {
                  "lon": 112.0996,
                  "lat": 29.231
                },
                {
                  "lon": 111.6874,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 110.8999,
                  "lat": 28.5118
                },
                {
                  "lon": 111.1046,
                  "lat": 28.5118
                },
                {
                  "lon": 111.1046,
                  "lat": 28.332
                },
                {
                  "lon": 110.4905,
                  "lat": 28.332
                },
                {
                  "lon": 110.4905,
                  "lat": 28.5118
                },
                {
                  "lon": 110.8999,
                  "lat": 28.5118
                }
              ],
              [
                {
                  "lon": 98.4425,
                  "lat": 35.7038
                },
                {
                  "lon": 98.8865,
                  "lat": 35.7038
                },
                {
                  "lon": 98.8865,
                  "lat": 35.8836
                },
                {
                  "lon": 96.8885,
                  "lat": 35.8836
                },
                {
                  "lon": 96.8885,
                  "lat": 35.7038
                },
                {
                  "lon": 98.4425,
                  "lat": 35.7038
                }
              ],
              [
                {
                  "lon": 118.2714,
                  "lat": 25.8148
                },
                {
                  "lon": 118.2714,
                  "lat": 25.9946
                },
                {
                  "lon": 119.8722,
                  "lat": 25.9946
                },
                {
                  "lon": 119.8722,
                  "lat": 25.8148
                },
                {
                  "lon": 118.2714,
                  "lat": 25.8148
                }
              ],
              [
                {
                  "lon": 130.3507,
                  "lat": 43.2554
                },
                {
                  "lon": 129.6076,
                  "lat": 43.2554
                },
                {
                  "lon": 129.6076,
                  "lat": 43.4352
                },
                {
                  "lon": 130.3507,
                  "lat": 43.4352
                },
                {
                  "lon": 130.3507,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 85.8928,
                  "lat": 41.9968
                },
                {
                  "lon": 88.8052,
                  "lat": 41.9968
                },
                {
                  "lon": 88.8052,
                  "lat": 42.1766
                },
                {
                  "lon": 84.922,
                  "lat": 42.1766
                },
                {
                  "lon": 84.922,
                  "lat": 41.9968
                },
                {
                  "lon": 85.8928,
                  "lat": 41.9968
                }
              ],
              [
                {
                  "lon": 108.1678,
                  "lat": 31.928
                },
                {
                  "lon": 107.744,
                  "lat": 31.928
                },
                {
                  "lon": 107.744,
                  "lat": 31.7482
                },
                {
                  "lon": 109.0154,
                  "lat": 31.7482
                },
                {
                  "lon": 109.0154,
                  "lat": 31.928
                },
                {
                  "lon": 108.1678,
                  "lat": 31.928
                }
              ],
              [
                {
                  "lon": 115.3125,
                  "lat": 25.0956
                },
                {
                  "lon": 114.1191,
                  "lat": 25.0956
                },
                {
                  "lon": 114.1191,
                  "lat": 25.2754
                },
                {
                  "lon": 116.1081,
                  "lat": 25.2754
                },
                {
                  "lon": 116.1081,
                  "lat": 25.0956
                },
                {
                  "lon": 115.3125,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 106.6615,
                  "lat": 36.2432
                },
                {
                  "lon": 105.7695,
                  "lat": 36.2432
                },
                {
                  "lon": 105.7695,
                  "lat": 36.0634
                },
                {
                  "lon": 106.8845,
                  "lat": 36.0634
                },
                {
                  "lon": 106.8845,
                  "lat": 36.2432
                },
                {
                  "lon": 106.6615,
                  "lat": 36.2432
                }
              ],
              [
                {
                  "lon": 85.1564,
                  "lat": 45.0534
                },
                {
                  "lon": 83.8794,
                  "lat": 45.0534
                },
                {
                  "lon": 83.8794,
                  "lat": 45.2332
                },
                {
                  "lon": 86.178,
                  "lat": 45.2332
                },
                {
                  "lon": 86.178,
                  "lat": 45.0534
                },
                {
                  "lon": 85.1564,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 123.8484,
                  "lat": 52.7848
                },
                {
                  "lon": 124.7406,
                  "lat": 52.7848
                },
                {
                  "lon": 124.7406,
                  "lat": 52.605
                },
                {
                  "lon": 123.2536,
                  "lat": 52.605
                },
                {
                  "lon": 123.2536,
                  "lat": 52.7848
                },
                {
                  "lon": 123.8484,
                  "lat": 52.7848
                }
              ],
              [
                {
                  "lon": 113.324,
                  "lat": 29.5906
                },
                {
                  "lon": 113.324,
                  "lat": 29.4108
                },
                {
                  "lon": 112.29,
                  "lat": 29.4108
                },
                {
                  "lon": 112.29,
                  "lat": 29.5906
                },
                {
                  "lon": 113.324,
                  "lat": 29.5906
                }
              ],
              [
                {
                  "lon": 123.22,
                  "lat": 48.8292
                },
                {
                  "lon": 123.22,
                  "lat": 49.009
                },
                {
                  "lon": 122.6716,
                  "lat": 49.009
                },
                {
                  "lon": 122.6716,
                  "lat": 48.8292
                },
                {
                  "lon": 123.22,
                  "lat": 48.8292
                }
              ],
              [
                {
                  "lon": 113.347,
                  "lat": 28.8714
                },
                {
                  "lon": 114.1686,
                  "lat": 28.8714
                },
                {
                  "lon": 114.1686,
                  "lat": 28.6916
                },
                {
                  "lon": 112.9362,
                  "lat": 28.6916
                },
                {
                  "lon": 112.9362,
                  "lat": 28.8714
                },
                {
                  "lon": 113.347,
                  "lat": 28.8714
                }
              ],
              [
                {
                  "lon": 83.8707,
                  "lat": 41.817
                },
                {
                  "lon": 84.5967,
                  "lat": 41.817
                },
                {
                  "lon": 84.5967,
                  "lat": 41.9968
                },
                {
                  "lon": 83.8707,
                  "lat": 41.9968
                },
                {
                  "lon": 83.8707,
                  "lat": 41.817
                }
              ],
              [
                {
                  "lon": 125.1663,
                  "lat": 42.3564
                },
                {
                  "lon": 124.6795,
                  "lat": 42.3564
                },
                {
                  "lon": 124.6795,
                  "lat": 42.1766
                },
                {
                  "lon": 128.0871,
                  "lat": 42.1766
                },
                {
                  "lon": 128.0871,
                  "lat": 42.3564
                },
                {
                  "lon": 125.1663,
                  "lat": 42.3564
                }
              ],
              [
                {
                  "lon": 83.8708,
                  "lat": 44.514
                },
                {
                  "lon": 85.8948,
                  "lat": 44.514
                },
                {
                  "lon": 85.8948,
                  "lat": 44.6938
                },
                {
                  "lon": 83.6178,
                  "lat": 44.6938
                },
                {
                  "lon": 83.6178,
                  "lat": 44.514
                },
                {
                  "lon": 83.8708,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 124.2995,
                  "lat": 51.1666
                },
                {
                  "lon": 123.7259,
                  "lat": 51.1666
                },
                {
                  "lon": 123.7259,
                  "lat": 50.9868
                },
                {
                  "lon": 125.4467,
                  "lat": 50.9868
                },
                {
                  "lon": 125.4467,
                  "lat": 51.1666
                },
                {
                  "lon": 124.2995,
                  "lat": 51.1666
                }
              ],
              [
                {
                  "lon": 108.1815,
                  "lat": 37.322
                },
                {
                  "lon": 106.5946,
                  "lat": 37.322
                },
                {
                  "lon": 106.5946,
                  "lat": 37.5018
                },
                {
                  "lon": 109.0883,
                  "lat": 37.5018
                },
                {
                  "lon": 109.0883,
                  "lat": 37.322
                },
                {
                  "lon": 108.1815,
                  "lat": 37.322
                }
              ],
              [
                {
                  "lon": 103.0743,
                  "lat": 26.534
                },
                {
                  "lon": 103.2753,
                  "lat": 26.534
                },
                {
                  "lon": 103.2753,
                  "lat": 26.3542
                },
                {
                  "lon": 103.0743,
                  "lat": 26.3542
                },
                {
                  "lon": 103.0743,
                  "lat": 26.534
                }
              ],
              [
                {
                  "lon": 119.3936,
                  "lat": 44.1544
                },
                {
                  "lon": 119.645,
                  "lat": 44.1544
                },
                {
                  "lon": 119.645,
                  "lat": 44.3342
                },
                {
                  "lon": 119.1422,
                  "lat": 44.3342
                },
                {
                  "lon": 119.1422,
                  "lat": 44.1544
                },
                {
                  "lon": 119.3936,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 122.3829,
                  "lat": 37.6816
                },
                {
                  "lon": 122.3829,
                  "lat": 37.5018
                },
                {
                  "lon": 123.0645,
                  "lat": 37.5018
                },
                {
                  "lon": 123.0645,
                  "lat": 37.6816
                },
                {
                  "lon": 122.3829,
                  "lat": 37.6816
                }
              ],
              [
                {
                  "lon": 109.0836,
                  "lat": 29.5906
                },
                {
                  "lon": 108.462,
                  "lat": 29.5906
                },
                {
                  "lon": 108.462,
                  "lat": 29.7704
                },
                {
                  "lon": 109.0836,
                  "lat": 29.7704
                },
                {
                  "lon": 109.0836,
                  "lat": 29.5906
                }
              ],
              [
                {
                  "lon": 107.6711,
                  "lat": 28.8714
                },
                {
                  "lon": 105.2027,
                  "lat": 28.8714
                },
                {
                  "lon": 105.2027,
                  "lat": 29.0512
                },
                {
                  "lon": 108.0825,
                  "lat": 29.0512
                },
                {
                  "lon": 108.0825,
                  "lat": 28.8714
                },
                {
                  "lon": 107.6711,
                  "lat": 28.8714
                }
              ],
              [
                {
                  "lon": 104.4811,
                  "lat": 30.13
                },
                {
                  "lon": 103.8574,
                  "lat": 30.13
                },
                {
                  "lon": 103.8574,
                  "lat": 29.9502
                },
                {
                  "lon": 104.689,
                  "lat": 29.9502
                },
                {
                  "lon": 104.689,
                  "lat": 30.13
                },
                {
                  "lon": 104.4811,
                  "lat": 30.13
                }
              ],
              [
                {
                  "lon": 84.6206,
                  "lat": 43.9746
                },
                {
                  "lon": 84.6206,
                  "lat": 44.1544
                },
                {
                  "lon": 85.122,
                  "lat": 44.1544
                },
                {
                  "lon": 85.122,
                  "lat": 43.9746
                },
                {
                  "lon": 84.6206,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 124.8185,
                  "lat": 51.706
                },
                {
                  "lon": 123.9479,
                  "lat": 51.706
                },
                {
                  "lon": 123.9479,
                  "lat": 51.5262
                },
                {
                  "lon": 125.3989,
                  "lat": 51.5262
                },
                {
                  "lon": 125.3989,
                  "lat": 51.706
                },
                {
                  "lon": 124.8185,
                  "lat": 51.706
                }
              ],
              [
                {
                  "lon": 114.5196,
                  "lat": 23.837
                },
                {
                  "lon": 115.1103,
                  "lat": 23.837
                },
                {
                  "lon": 115.1103,
                  "lat": 24.0168
                },
                {
                  "lon": 113.5351,
                  "lat": 24.0168
                },
                {
                  "lon": 113.5351,
                  "lat": 23.837
                },
                {
                  "lon": 114.5196,
                  "lat": 23.837
                }
              ],
              [
                {
                  "lon": 117.6483,
                  "lat": 27.9724
                },
                {
                  "lon": 117.8523,
                  "lat": 27.9724
                },
                {
                  "lon": 117.8523,
                  "lat": 28.1522
                },
                {
                  "lon": 115.8123,
                  "lat": 28.1522
                },
                {
                  "lon": 115.8123,
                  "lat": 27.9724
                },
                {
                  "lon": 117.6483,
                  "lat": 27.9724
                }
              ],
              [
                {
                  "lon": 108.7954,
                  "lat": 39.12
                },
                {
                  "lon": 108.7954,
                  "lat": 39.2998
                },
                {
                  "lon": 108.0982,
                  "lat": 39.2998
                },
                {
                  "lon": 108.0982,
                  "lat": 39.12
                },
                {
                  "lon": 108.7954,
                  "lat": 39.12
                }
              ],
              [
                {
                  "lon": 130.1876,
                  "lat": 44.3342
                },
                {
                  "lon": 132.2052,
                  "lat": 44.3342
                },
                {
                  "lon": 132.2052,
                  "lat": 44.514
                },
                {
                  "lon": 128.4222,
                  "lat": 44.514
                },
                {
                  "lon": 128.4222,
                  "lat": 44.3342
                },
                {
                  "lon": 130.1876,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 111.7598,
                  "lat": 38.7604
                },
                {
                  "lon": 110.1414,
                  "lat": 38.7604
                },
                {
                  "lon": 110.1414,
                  "lat": 38.9402
                },
                {
                  "lon": 118.0022,
                  "lat": 38.9402
                },
                {
                  "lon": 118.0022,
                  "lat": 38.7604
                },
                {
                  "lon": 111.7598,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 119.5625,
                  "lat": 27.2532
                },
                {
                  "lon": 118.7533,
                  "lat": 27.2532
                },
                {
                  "lon": 118.7533,
                  "lat": 27.0734
                },
                {
                  "lon": 120.574,
                  "lat": 27.0734
                },
                {
                  "lon": 120.574,
                  "lat": 27.2532
                },
                {
                  "lon": 119.5625,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 125.0948,
                  "lat": 51.8858
                },
                {
                  "lon": 123.0466,
                  "lat": 51.8858
                },
                {
                  "lon": 123.0466,
                  "lat": 52.0656
                },
                {
                  "lon": 125.0948,
                  "lat": 52.0656
                },
                {
                  "lon": 125.0948,
                  "lat": 51.8858
                }
              ],
              [
                {
                  "lon": 110.156,
                  "lat": 20.4208
                },
                {
                  "lon": 109.5803,
                  "lat": 20.4208
                },
                {
                  "lon": 109.5803,
                  "lat": 20.241
                },
                {
                  "lon": 110.5398,
                  "lat": 20.241
                },
                {
                  "lon": 110.5398,
                  "lat": 20.4208
                },
                {
                  "lon": 110.156,
                  "lat": 20.4208
                }
              ],
              [
                {
                  "lon": 103.5379,
                  "lat": 31.3886
                },
                {
                  "lon": 103.3268,
                  "lat": 31.3886
                },
                {
                  "lon": 103.3268,
                  "lat": 31.5684
                },
                {
                  "lon": 103.9601,
                  "lat": 31.5684
                },
                {
                  "lon": 103.9601,
                  "lat": 31.3886
                },
                {
                  "lon": 103.5379,
                  "lat": 31.3886
                }
              ],
              [
                {
                  "lon": 127.4387,
                  "lat": 42.8958
                },
                {
                  "lon": 127.9311,
                  "lat": 42.8958
                },
                {
                  "lon": 127.9311,
                  "lat": 43.0756
                },
                {
                  "lon": 127.4387,
                  "lat": 43.0756
                },
                {
                  "lon": 127.4387,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 130.6727,
                  "lat": 42.8958
                },
                {
                  "lon": 131.1637,
                  "lat": 42.8958
                },
                {
                  "lon": 131.1637,
                  "lat": 42.716
                },
                {
                  "lon": 128.7087,
                  "lat": 42.716
                },
                {
                  "lon": 128.7087,
                  "lat": 42.8958
                },
                {
                  "lon": 130.6727,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 103.5863,
                  "lat": 34.2654
                },
                {
                  "lon": 104.6768,
                  "lat": 34.2654
                },
                {
                  "lon": 104.6768,
                  "lat": 34.4452
                },
                {
                  "lon": 103.1501,
                  "lat": 34.4452
                },
                {
                  "lon": 103.1501,
                  "lat": 34.2654
                },
                {
                  "lon": 103.5863,
                  "lat": 34.2654
                }
              ],
              [
                {
                  "lon": 123.5347,
                  "lat": 50.4474
                },
                {
                  "lon": 123.2523,
                  "lat": 50.4474
                },
                {
                  "lon": 123.2523,
                  "lat": 50.2676
                },
                {
                  "lon": 124.0995,
                  "lat": 50.2676
                },
                {
                  "lon": 124.0995,
                  "lat": 50.4474
                },
                {
                  "lon": 123.5347,
                  "lat": 50.4474
                }
              ],
              [
                {
                  "lon": 91.2431,
                  "lat": 30.3098
                },
                {
                  "lon": 90.4099,
                  "lat": 30.3098
                },
                {
                  "lon": 90.4099,
                  "lat": 30.13
                },
                {
                  "lon": 91.4514,
                  "lat": 30.13
                },
                {
                  "lon": 91.4514,
                  "lat": 30.3098
                },
                {
                  "lon": 91.2431,
                  "lat": 30.3098
                }
              ],
              [
                {
                  "lon": 94.7555,
                  "lat": 36.0634
                },
                {
                  "lon": 95.2005,
                  "lat": 36.0634
                },
                {
                  "lon": 95.2005,
                  "lat": 35.8836
                },
                {
                  "lon": 93.643,
                  "lat": 35.8836
                },
                {
                  "lon": 93.643,
                  "lat": 36.0634
                },
                {
                  "lon": 94.7555,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 98.4344,
                  "lat": 29.4108
                },
                {
                  "lon": 96.3664,
                  "lat": 29.4108
                },
                {
                  "lon": 96.3664,
                  "lat": 29.5906
                },
                {
                  "lon": 98.4344,
                  "lat": 29.5906
                },
                {
                  "lon": 98.4344,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 114.059,
                  "lat": 30.4896
                },
                {
                  "lon": 113.4329,
                  "lat": 30.4896
                },
                {
                  "lon": 113.4329,
                  "lat": 30.3098
                },
                {
                  "lon": 115.1025,
                  "lat": 30.3098
                },
                {
                  "lon": 115.1025,
                  "lat": 30.4896
                },
                {
                  "lon": 114.059,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 114.9549,
                  "lat": 24.5562
                },
                {
                  "lon": 115.1526,
                  "lat": 24.5562
                },
                {
                  "lon": 115.1526,
                  "lat": 24.3764
                },
                {
                  "lon": 114.9549,
                  "lat": 24.3764
                },
                {
                  "lon": 114.9549,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 130.8932,
                  "lat": 45.0534
                },
                {
                  "lon": 131.657,
                  "lat": 45.0534
                },
                {
                  "lon": 131.657,
                  "lat": 44.8736
                },
                {
                  "lon": 129.6202,
                  "lat": 44.8736
                },
                {
                  "lon": 129.6202,
                  "lat": 45.0534
                },
                {
                  "lon": 130.8932,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 105.1123,
                  "lat": 36.7826
                },
                {
                  "lon": 105.1123,
                  "lat": 36.9624
                },
                {
                  "lon": 103.9868,
                  "lat": 36.9624
                },
                {
                  "lon": 103.9868,
                  "lat": 36.7826
                },
                {
                  "lon": 105.1123,
                  "lat": 36.7826
                }
              ],
              [
                {
                  "lon": 121.4048,
                  "lat": 44.3342
                },
                {
                  "lon": 120.6506,
                  "lat": 44.3342
                },
                {
                  "lon": 120.6506,
                  "lat": 44.1544
                },
                {
                  "lon": 122.4104,
                  "lat": 44.1544
                },
                {
                  "lon": 122.4104,
                  "lat": 44.3342
                },
                {
                  "lon": 121.4048,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 106.3965,
                  "lat": 28.332
                },
                {
                  "lon": 108.2388,
                  "lat": 28.332
                },
                {
                  "lon": 108.2388,
                  "lat": 28.5118
                },
                {
                  "lon": 105.373,
                  "lat": 28.5118
                },
                {
                  "lon": 105.373,
                  "lat": 28.332
                },
                {
                  "lon": 106.3965,
                  "lat": 28.332
                }
              ],
              [
                {
                  "lon": 130.6045,
                  "lat": 43.2554
                },
                {
                  "lon": 130.1107,
                  "lat": 43.2554
                },
                {
                  "lon": 130.1107,
                  "lat": 43.0756
                },
                {
                  "lon": 130.6045,
                  "lat": 43.0756
                },
                {
                  "lon": 130.6045,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 125.9448,
                  "lat": 45.413
                },
                {
                  "lon": 129.0288,
                  "lat": 45.413
                },
                {
                  "lon": 129.0288,
                  "lat": 45.5928
                },
                {
                  "lon": 125.9448,
                  "lat": 45.5928
                },
                {
                  "lon": 125.9448,
                  "lat": 45.413
                }
              ],
              [
                {
                  "lon": 118.8391,
                  "lat": 43.615
                },
                {
                  "lon": 117.5931,
                  "lat": 43.615
                },
                {
                  "lon": 117.5931,
                  "lat": 43.7948
                },
                {
                  "lon": 119.5867,
                  "lat": 43.7948
                },
                {
                  "lon": 119.5867,
                  "lat": 43.615
                },
                {
                  "lon": 118.8391,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 101.6117,
                  "lat": 37.1422
                },
                {
                  "lon": 100.7093,
                  "lat": 37.1422
                },
                {
                  "lon": 100.7093,
                  "lat": 36.9624
                },
                {
                  "lon": 102.0629,
                  "lat": 36.9624
                },
                {
                  "lon": 102.0629,
                  "lat": 37.1422
                },
                {
                  "lon": 101.6117,
                  "lat": 37.1422
                }
              ],
              [
                {
                  "lon": 85.2476,
                  "lat": 45.413
                },
                {
                  "lon": 84.2228,
                  "lat": 45.413
                },
                {
                  "lon": 84.2228,
                  "lat": 45.2332
                },
                {
                  "lon": 85.5038,
                  "lat": 45.2332
                },
                {
                  "lon": 85.5038,
                  "lat": 45.413
                },
                {
                  "lon": 85.2476,
                  "lat": 45.413
                }
              ],
              [
                {
                  "lon": 109.7198,
                  "lat": 20.7804
                },
                {
                  "lon": 109.5274,
                  "lat": 20.7804
                },
                {
                  "lon": 109.5274,
                  "lat": 20.6006
                },
                {
                  "lon": 111.0666,
                  "lat": 20.6006
                },
                {
                  "lon": 111.0666,
                  "lat": 20.7804
                },
                {
                  "lon": 109.7198,
                  "lat": 20.7804
                }
              ],
              [
                {
                  "lon": 110.7123,
                  "lat": 27.9724
                },
                {
                  "lon": 110.9163,
                  "lat": 27.9724
                },
                {
                  "lon": 110.9163,
                  "lat": 28.1522
                },
                {
                  "lon": 110.3043,
                  "lat": 28.1522
                },
                {
                  "lon": 110.3043,
                  "lat": 27.9724
                },
                {
                  "lon": 110.7123,
                  "lat": 27.9724
                }
              ],
              [
                {
                  "lon": 120.6726,
                  "lat": 25.9946
                },
                {
                  "lon": 120.6726,
                  "lat": 25.8148
                },
                {
                  "lon": 120.0723,
                  "lat": 25.8148
                },
                {
                  "lon": 120.0723,
                  "lat": 25.9946
                },
                {
                  "lon": 120.6726,
                  "lat": 25.9946
                }
              ],
              [
                {
                  "lon": 108.4308,
                  "lat": 24.5562
                },
                {
                  "lon": 108.2331,
                  "lat": 24.5562
                },
                {
                  "lon": 108.2331,
                  "lat": 24.3764
                },
                {
                  "lon": 110.4078,
                  "lat": 24.3764
                },
                {
                  "lon": 110.4078,
                  "lat": 24.5562
                },
                {
                  "lon": 108.4308,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 123.6917,
                  "lat": 46.4918
                },
                {
                  "lon": 124.4753,
                  "lat": 46.4918
                },
                {
                  "lon": 124.4753,
                  "lat": 46.312
                },
                {
                  "lon": 121.8633,
                  "lat": 46.312
                },
                {
                  "lon": 121.8633,
                  "lat": 46.4918
                },
                {
                  "lon": 123.6917,
                  "lat": 46.4918
                }
              ],
              [
                {
                  "lon": 91.1964,
                  "lat": 29.5906
                },
                {
                  "lon": 92.0236,
                  "lat": 29.5906
                },
                {
                  "lon": 92.0236,
                  "lat": 29.4108
                },
                {
                  "lon": 90.3692,
                  "lat": 29.4108
                },
                {
                  "lon": 90.3692,
                  "lat": 29.5906
                },
                {
                  "lon": 91.1964,
                  "lat": 29.5906
                }
              ],
              [
                {
                  "lon": 105.4747,
                  "lat": 27.2532
                },
                {
                  "lon": 105.6773,
                  "lat": 27.2532
                },
                {
                  "lon": 105.6773,
                  "lat": 27.433
                },
                {
                  "lon": 104.6643,
                  "lat": 27.433
                },
                {
                  "lon": 104.6643,
                  "lat": 27.2532
                },
                {
                  "lon": 105.4747,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 116.7779,
                  "lat": 24.0168
                },
                {
                  "lon": 115.7919,
                  "lat": 24.0168
                },
                {
                  "lon": 115.7919,
                  "lat": 24.1966
                },
                {
                  "lon": 118.3555,
                  "lat": 24.1966
                },
                {
                  "lon": 118.3555,
                  "lat": 24.0168
                },
                {
                  "lon": 116.7779,
                  "lat": 24.0168
                }
              ],
              [
                {
                  "lon": 123.5138,
                  "lat": 43.9746
                },
                {
                  "lon": 123.2639,
                  "lat": 43.9746
                },
                {
                  "lon": 123.2639,
                  "lat": 43.7948
                },
                {
                  "lon": 127.0124,
                  "lat": 43.7948
                },
                {
                  "lon": 127.0124,
                  "lat": 43.9746
                },
                {
                  "lon": 123.5138,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 120.6478,
                  "lat": 39.2998
                },
                {
                  "lon": 123.2042,
                  "lat": 39.2998
                },
                {
                  "lon": 123.2042,
                  "lat": 39.12
                },
                {
                  "lon": 120.6478,
                  "lat": 39.12
                },
                {
                  "lon": 120.6478,
                  "lat": 39.2998
                }
              ],
              [
                {
                  "lon": 116.7608,
                  "lat": 44.514
                },
                {
                  "lon": 116.7608,
                  "lat": 44.6938
                },
                {
                  "lon": 115.7488,
                  "lat": 44.6938
                },
                {
                  "lon": 115.7488,
                  "lat": 44.514
                },
                {
                  "lon": 116.7608,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 124.3593,
                  "lat": 47.0312
                },
                {
                  "lon": 123.3001,
                  "lat": 47.0312
                },
                {
                  "lon": 123.3001,
                  "lat": 47.211
                },
                {
                  "lon": 125.9481,
                  "lat": 47.211
                },
                {
                  "lon": 125.9481,
                  "lat": 47.0312
                },
                {
                  "lon": 124.3593,
                  "lat": 47.0312
                }
              ],
              [
                {
                  "lon": 121.628,
                  "lat": 45.413
                },
                {
                  "lon": 121.8842,
                  "lat": 45.413
                },
                {
                  "lon": 121.8842,
                  "lat": 45.2332
                },
                {
                  "lon": 121.1156,
                  "lat": 45.2332
                },
                {
                  "lon": 121.1156,
                  "lat": 45.413
                },
                {
                  "lon": 121.628,
                  "lat": 45.413
                }
              ],
              [
                {
                  "lon": 117.0442,
                  "lat": 28.6916
                },
                {
                  "lon": 122.3846,
                  "lat": 28.6916
                },
                {
                  "lon": 122.3846,
                  "lat": 28.8714
                },
                {
                  "lon": 116.8388,
                  "lat": 28.8714
                },
                {
                  "lon": 116.8388,
                  "lat": 28.6916
                },
                {
                  "lon": 117.0442,
                  "lat": 28.6916
                }
              ],
              [
                {
                  "lon": 107.6412,
                  "lat": 40.5584
                },
                {
                  "lon": 107.6412,
                  "lat": 40.3786
                },
                {
                  "lon": 105.9843,
                  "lat": 40.3786
                },
                {
                  "lon": 105.9843,
                  "lat": 40.5584
                },
                {
                  "lon": 107.6412,
                  "lat": 40.5584
                }
              ],
              [
                {
                  "lon": 120.4494,
                  "lat": 38.0412
                },
                {
                  "lon": 121.1346,
                  "lat": 38.0412
                },
                {
                  "lon": 121.1346,
                  "lat": 37.8614
                },
                {
                  "lon": 120.221,
                  "lat": 37.8614
                },
                {
                  "lon": 120.221,
                  "lat": 38.0412
                },
                {
                  "lon": 120.4494,
                  "lat": 38.0412
                }
              ],
              [
                {
                  "lon": 108.2927,
                  "lat": 37.322
                },
                {
                  "lon": 108.2927,
                  "lat": 37.1422
                },
                {
                  "lon": 106.7093,
                  "lat": 37.1422
                },
                {
                  "lon": 106.7093,
                  "lat": 37.322
                },
                {
                  "lon": 108.2927,
                  "lat": 37.322
                }
              ],
              [
                {
                  "lon": 98.4306,
                  "lat": 40.019
                },
                {
                  "lon": 98.4306,
                  "lat": 40.1988
                },
                {
                  "lon": 99.3726,
                  "lat": 40.1988
                },
                {
                  "lon": 99.3726,
                  "lat": 40.019
                },
                {
                  "lon": 98.4306,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 123.0353,
                  "lat": 47.0312
                },
                {
                  "lon": 122.2409,
                  "lat": 47.0312
                },
                {
                  "lon": 122.2409,
                  "lat": 47.211
                },
                {
                  "lon": 123.0353,
                  "lat": 47.211
                },
                {
                  "lon": 123.0353,
                  "lat": 47.0312
                }
              ],
              [
                {
                  "lon": 108.8942,
                  "lat": 19.8814
                },
                {
                  "lon": 108.7027,
                  "lat": 19.8814
                },
                {
                  "lon": 108.7027,
                  "lat": 20.0612
                },
                {
                  "lon": 111.1922,
                  "lat": 20.0612
                },
                {
                  "lon": 111.1922,
                  "lat": 19.8814
                },
                {
                  "lon": 108.8942,
                  "lat": 19.8814
                }
              ],
              [
                {
                  "lon": 85.0818,
                  "lat": 45.5928
                },
                {
                  "lon": 85.3388,
                  "lat": 45.5928
                },
                {
                  "lon": 85.3388,
                  "lat": 45.413
                },
                {
                  "lon": 84.8248,
                  "lat": 45.413
                },
                {
                  "lon": 84.8248,
                  "lat": 45.5928
                },
                {
                  "lon": 85.0818,
                  "lat": 45.5928
                }
              ],
              [
                {
                  "lon": 115.7805,
                  "lat": 25.635
                },
                {
                  "lon": 116.3799,
                  "lat": 25.635
                },
                {
                  "lon": 116.3799,
                  "lat": 25.8148
                },
                {
                  "lon": 114.1821,
                  "lat": 25.8148
                },
                {
                  "lon": 114.1821,
                  "lat": 25.635
                },
                {
                  "lon": 115.7805,
                  "lat": 25.635
                }
              ],
              [
                {
                  "lon": 111.5991,
                  "lat": 26.534
                },
                {
                  "lon": 111.1965,
                  "lat": 26.534
                },
                {
                  "lon": 111.1965,
                  "lat": 26.7138
                },
                {
                  "lon": 112.203,
                  "lat": 26.7138
                },
                {
                  "lon": 112.203,
                  "lat": 26.534
                },
                {
                  "lon": 111.5991,
                  "lat": 26.534
                }
              ],
              [
                {
                  "lon": 121.4232,
                  "lat": 45.2332
                },
                {
                  "lon": 121.934,
                  "lat": 45.2332
                },
                {
                  "lon": 121.934,
                  "lat": 45.0534
                },
                {
                  "lon": 120.4016,
                  "lat": 45.0534
                },
                {
                  "lon": 120.4016,
                  "lat": 45.2332
                },
                {
                  "lon": 121.4232,
                  "lat": 45.2332
                }
              ],
              [
                {
                  "lon": 108.1521,
                  "lat": 25.0956
                },
                {
                  "lon": 108.7488,
                  "lat": 25.0956
                },
                {
                  "lon": 108.7488,
                  "lat": 25.2754
                },
                {
                  "lon": 107.7543,
                  "lat": 25.2754
                },
                {
                  "lon": 107.7543,
                  "lat": 25.0956
                },
                {
                  "lon": 108.1521,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 88.6318,
                  "lat": 43.9746
                },
                {
                  "lon": 88.6318,
                  "lat": 44.1544
                },
                {
                  "lon": 89.6346,
                  "lat": 44.1544
                },
                {
                  "lon": 89.6346,
                  "lat": 43.9746
                },
                {
                  "lon": 88.6318,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 105.653,
                  "lat": 35.1644
                },
                {
                  "lon": 106.094,
                  "lat": 35.1644
                },
                {
                  "lon": 106.094,
                  "lat": 35.3442
                },
                {
                  "lon": 105.4325,
                  "lat": 35.3442
                },
                {
                  "lon": 105.4325,
                  "lat": 35.1644
                },
                {
                  "lon": 105.653,
                  "lat": 35.1644
                }
              ],
              [
                {
                  "lon": 112.8577,
                  "lat": 23.6572
                },
                {
                  "lon": 112.8577,
                  "lat": 23.837
                },
                {
                  "lon": 111.2849,
                  "lat": 23.837
                },
                {
                  "lon": 111.2849,
                  "lat": 23.6572
                },
                {
                  "lon": 112.8577,
                  "lat": 23.6572
                }
              ],
              [
                {
                  "lon": 121.1084,
                  "lat": 44.514
                },
                {
                  "lon": 120.0996,
                  "lat": 44.514
                },
                {
                  "lon": 120.0996,
                  "lat": 44.3342
                },
                {
                  "lon": 122.6216,
                  "lat": 44.3342
                },
                {
                  "lon": 122.6216,
                  "lat": 44.514
                },
                {
                  "lon": 121.1084,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 130.8512,
                  "lat": 45.2332
                },
                {
                  "lon": 129.8264,
                  "lat": 45.2332
                },
                {
                  "lon": 129.8264,
                  "lat": 45.413
                },
                {
                  "lon": 133.9256,
                  "lat": 45.413
                },
                {
                  "lon": 133.9256,
                  "lat": 45.2332
                },
                {
                  "lon": 130.8512,
                  "lat": 45.2332
                }
              ],
              [
                {
                  "lon": 106.0716,
                  "lat": 38.221
                },
                {
                  "lon": 104.6946,
                  "lat": 38.221
                },
                {
                  "lon": 104.6946,
                  "lat": 38.4008
                },
                {
                  "lon": 107.9076,
                  "lat": 38.4008
                },
                {
                  "lon": 107.9076,
                  "lat": 38.221
                },
                {
                  "lon": 106.0716,
                  "lat": 38.221
                }
              ],
              [
                {
                  "lon": 108.3646,
                  "lat": 32.2876
                },
                {
                  "lon": 108.3646,
                  "lat": 32.1078
                },
                {
                  "lon": 109.6408,
                  "lat": 32.1078
                },
                {
                  "lon": 109.6408,
                  "lat": 32.2876
                },
                {
                  "lon": 108.3646,
                  "lat": 32.2876
                }
              ],
              [
                {
                  "lon": 102.9807,
                  "lat": 25.0956
                },
                {
                  "lon": 103.3785,
                  "lat": 25.0956
                },
                {
                  "lon": 103.3785,
                  "lat": 25.2754
                },
                {
                  "lon": 101.7873,
                  "lat": 25.2754
                },
                {
                  "lon": 101.7873,
                  "lat": 25.0956
                },
                {
                  "lon": 102.9807,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 103.5635,
                  "lat": 34.625
                },
                {
                  "lon": 103.3445,
                  "lat": 34.625
                },
                {
                  "lon": 103.3445,
                  "lat": 34.8048
                },
                {
                  "lon": 103.5635,
                  "lat": 34.8048
                },
                {
                  "lon": 103.5635,
                  "lat": 34.625
                }
              ],
              [
                {
                  "lon": 114.6247,
                  "lat": 42.5362
                },
                {
                  "lon": 114.6247,
                  "lat": 42.3564
                },
                {
                  "lon": 115.357,
                  "lat": 42.3564
                },
                {
                  "lon": 115.357,
                  "lat": 42.5362
                },
                {
                  "lon": 114.6247,
                  "lat": 42.5362
                }
              ],
              [
                {
                  "lon": 97.5604,
                  "lat": 29.7704
                },
                {
                  "lon": 98.1832,
                  "lat": 29.7704
                },
                {
                  "lon": 98.1832,
                  "lat": 29.9502
                },
                {
                  "lon": 97.5604,
                  "lat": 29.9502
                },
                {
                  "lon": 97.5604,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 95.9056,
                  "lat": 37.6816
                },
                {
                  "lon": 95.9056,
                  "lat": 37.8614
                },
                {
                  "lon": 96.3612,
                  "lat": 37.8614
                },
                {
                  "lon": 96.3612,
                  "lat": 37.6816
                },
                {
                  "lon": 95.9056,
                  "lat": 37.6816
                }
              ],
              [
                {
                  "lon": 109.9589,
                  "lat": 36.9624
                },
                {
                  "lon": 110.8613,
                  "lat": 36.9624
                },
                {
                  "lon": 110.8613,
                  "lat": 37.1422
                },
                {
                  "lon": 109.5077,
                  "lat": 37.1422
                },
                {
                  "lon": 109.5077,
                  "lat": 36.9624
                },
                {
                  "lon": 109.9589,
                  "lat": 36.9624
                }
              ],
              [
                {
                  "lon": 125.3074,
                  "lat": 49.7282
                },
                {
                  "lon": 124.1902,
                  "lat": 49.7282
                },
                {
                  "lon": 124.1902,
                  "lat": 49.908
                },
                {
                  "lon": 125.5867,
                  "lat": 49.908
                },
                {
                  "lon": 125.5867,
                  "lat": 49.7282
                },
                {
                  "lon": 125.3074,
                  "lat": 49.7282
                }
              ],
              [
                {
                  "lon": 127.4897,
                  "lat": 47.3908
                },
                {
                  "lon": 126.4233,
                  "lat": 47.3908
                },
                {
                  "lon": 126.4233,
                  "lat": 47.5706
                },
                {
                  "lon": 127.4897,
                  "lat": 47.5706
                },
                {
                  "lon": 127.4897,
                  "lat": 47.3908
                }
              ],
              [
                {
                  "lon": 91.6554,
                  "lat": 30.6694
                },
                {
                  "lon": 91.8649,
                  "lat": 30.6694
                },
                {
                  "lon": 91.8649,
                  "lat": 30.8492
                },
                {
                  "lon": 90.8174,
                  "lat": 30.8492
                },
                {
                  "lon": 90.8174,
                  "lat": 30.6694
                },
                {
                  "lon": 91.6554,
                  "lat": 30.6694
                }
              ],
              [
                {
                  "lon": 117.046,
                  "lat": 29.231
                },
                {
                  "lon": 116.8399,
                  "lat": 29.231
                },
                {
                  "lon": 116.8399,
                  "lat": 29.0512
                },
                {
                  "lon": 117.8704,
                  "lat": 29.0512
                },
                {
                  "lon": 117.8704,
                  "lat": 29.231
                },
                {
                  "lon": 117.046,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 111.2905,
                  "lat": 35.3442
                },
                {
                  "lon": 109.7435,
                  "lat": 35.3442
                },
                {
                  "lon": 109.7435,
                  "lat": 35.524
                },
                {
                  "lon": 112.1745,
                  "lat": 35.524
                },
                {
                  "lon": 112.1745,
                  "lat": 35.3442
                },
                {
                  "lon": 111.2905,
                  "lat": 35.3442
                }
              ],
              [
                {
                  "lon": 133.6313,
                  "lat": 46.1322
                },
                {
                  "lon": 131.5553,
                  "lat": 46.1322
                },
                {
                  "lon": 131.5553,
                  "lat": 45.9524
                },
                {
                  "lon": 134.1503,
                  "lat": 45.9524
                },
                {
                  "lon": 134.1503,
                  "lat": 46.1322
                },
                {
                  "lon": 133.6313,
                  "lat": 46.1322
                }
              ],
              [
                {
                  "lon": 107.7033,
                  "lat": 27.433
                },
                {
                  "lon": 106.2851,
                  "lat": 27.433
                },
                {
                  "lon": 106.2851,
                  "lat": 27.2532
                },
                {
                  "lon": 108.7163,
                  "lat": 27.2532
                },
                {
                  "lon": 108.7163,
                  "lat": 27.433
                },
                {
                  "lon": 107.7033,
                  "lat": 27.433
                }
              ],
              [
                {
                  "lon": 116.5971,
                  "lat": 25.2754
                },
                {
                  "lon": 114.0075,
                  "lat": 25.2754
                },
                {
                  "lon": 114.0075,
                  "lat": 25.4552
                },
                {
                  "lon": 116.5971,
                  "lat": 25.4552
                },
                {
                  "lon": 116.5971,
                  "lat": 25.2754
                }
              ],
              [
                {
                  "lon": 121.4403,
                  "lat": 40.1988
                },
                {
                  "lon": 121.2042,
                  "lat": 40.1988
                },
                {
                  "lon": 121.2042,
                  "lat": 40.3786
                },
                {
                  "lon": 121.4403,
                  "lat": 40.3786
                },
                {
                  "lon": 121.4403,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 115.4916,
                  "lat": 28.332
                },
                {
                  "lon": 115.083,
                  "lat": 28.332
                },
                {
                  "lon": 115.083,
                  "lat": 28.1522
                },
                {
                  "lon": 115.6959,
                  "lat": 28.1522
                },
                {
                  "lon": 115.6959,
                  "lat": 28.332
                },
                {
                  "lon": 115.4916,
                  "lat": 28.332
                }
              ],
              [
                {
                  "lon": 108.4587,
                  "lat": 38.221
                },
                {
                  "lon": 105.483,
                  "lat": 38.221
                },
                {
                  "lon": 105.483,
                  "lat": 38.0412
                },
                {
                  "lon": 108.4587,
                  "lat": 38.0412
                },
                {
                  "lon": 108.4587,
                  "lat": 38.221
                }
              ],
              [
                {
                  "lon": 103.7525,
                  "lat": 37.6816
                },
                {
                  "lon": 103.9797,
                  "lat": 37.6816
                },
                {
                  "lon": 103.9797,
                  "lat": 37.5018
                },
                {
                  "lon": 102.3893,
                  "lat": 37.5018
                },
                {
                  "lon": 102.3893,
                  "lat": 37.6816
                },
                {
                  "lon": 103.7525,
                  "lat": 37.6816
                }
              ],
              [
                {
                  "lon": 122.2368,
                  "lat": 45.0534
                },
                {
                  "lon": 120.9638,
                  "lat": 45.0534
                },
                {
                  "lon": 120.9638,
                  "lat": 44.8736
                },
                {
                  "lon": 122.2368,
                  "lat": 44.8736
                },
                {
                  "lon": 122.2368,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 96.7093,
                  "lat": 37.5018
                },
                {
                  "lon": 96.9365,
                  "lat": 37.5018
                },
                {
                  "lon": 96.9365,
                  "lat": 37.6816
                },
                {
                  "lon": 95.1189,
                  "lat": 37.6816
                },
                {
                  "lon": 95.1189,
                  "lat": 37.5018
                },
                {
                  "lon": 96.7093,
                  "lat": 37.5018
                }
              ],
              [
                {
                  "lon": 100.964,
                  "lat": 36.2432
                },
                {
                  "lon": 100.07,
                  "lat": 36.2432
                },
                {
                  "lon": 100.07,
                  "lat": 36.423
                },
                {
                  "lon": 100.964,
                  "lat": 36.423
                },
                {
                  "lon": 100.964,
                  "lat": 36.2432
                }
              ],
              [
                {
                  "lon": 126.2185,
                  "lat": 41.0978
                },
                {
                  "lon": 126.9346,
                  "lat": 41.0978
                },
                {
                  "lon": 126.9346,
                  "lat": 40.918
                },
                {
                  "lon": 124.5476,
                  "lat": 40.918
                },
                {
                  "lon": 124.5476,
                  "lat": 41.0978
                },
                {
                  "lon": 126.2185,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 107.3044,
                  "lat": 32.4674
                },
                {
                  "lon": 107.518,
                  "lat": 32.4674
                },
                {
                  "lon": 107.518,
                  "lat": 32.6472
                },
                {
                  "lon": 106.6636,
                  "lat": 32.6472
                },
                {
                  "lon": 106.6636,
                  "lat": 32.4674
                },
                {
                  "lon": 107.3044,
                  "lat": 32.4674
                }
              ],
              [
                {
                  "lon": 133.8902,
                  "lat": 48.6494
                },
                {
                  "lon": 134.7068,
                  "lat": 48.6494
                },
                {
                  "lon": 134.7068,
                  "lat": 48.4696
                },
                {
                  "lon": 133.8902,
                  "lat": 48.4696
                },
                {
                  "lon": 133.8902,
                  "lat": 48.6494
                }
              ],
              [
                {
                  "lon": 119.9878,
                  "lat": 43.0756
                },
                {
                  "lon": 118.2595,
                  "lat": 43.0756
                },
                {
                  "lon": 118.2595,
                  "lat": 43.2554
                },
                {
                  "lon": 119.9878,
                  "lat": 43.2554
                },
                {
                  "lon": 119.9878,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 123.8888,
                  "lat": 45.5928
                },
                {
                  "lon": 122.3468,
                  "lat": 45.5928
                },
                {
                  "lon": 122.3468,
                  "lat": 45.413
                },
                {
                  "lon": 125.6878,
                  "lat": 45.413
                },
                {
                  "lon": 125.6878,
                  "lat": 45.5928
                },
                {
                  "lon": 123.8888,
                  "lat": 45.5928
                }
              ],
              [
                {
                  "lon": 109.7776,
                  "lat": 21.4996
                },
                {
                  "lon": 111.7106,
                  "lat": 21.4996
                },
                {
                  "lon": 111.7106,
                  "lat": 21.3198
                },
                {
                  "lon": 109.1977,
                  "lat": 21.3198
                },
                {
                  "lon": 109.1977,
                  "lat": 21.4996
                },
                {
                  "lon": 109.7776,
                  "lat": 21.4996
                }
              ],
              [
                {
                  "lon": 78.8886,
                  "lat": 40.918
                },
                {
                  "lon": 80.3166,
                  "lat": 40.918
                },
                {
                  "lon": 80.3166,
                  "lat": 40.7382
                },
                {
                  "lon": 78.8886,
                  "lat": 40.7382
                },
                {
                  "lon": 78.8886,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 83.7031,
                  "lat": 42.716
                },
                {
                  "lon": 84.4375,
                  "lat": 42.716
                },
                {
                  "lon": 84.4375,
                  "lat": 42.5362
                },
                {
                  "lon": 83.2135,
                  "lat": 42.5362
                },
                {
                  "lon": 83.2135,
                  "lat": 42.716
                },
                {
                  "lon": 83.7031,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 123.8315,
                  "lat": 40.918
                },
                {
                  "lon": 123.5928,
                  "lat": 40.918
                },
                {
                  "lon": 123.5928,
                  "lat": 41.0978
                },
                {
                  "lon": 124.3089,
                  "lat": 41.0978
                },
                {
                  "lon": 124.3089,
                  "lat": 40.918
                },
                {
                  "lon": 123.8315,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 113.3761,
                  "lat": 27.433
                },
                {
                  "lon": 113.3761,
                  "lat": 27.2532
                },
                {
                  "lon": 113.1735,
                  "lat": 27.2532
                },
                {
                  "lon": 113.1735,
                  "lat": 27.433
                },
                {
                  "lon": 113.3761,
                  "lat": 27.433
                }
              ],
              [
                {
                  "lon": 105.8981,
                  "lat": 37.1422
                },
                {
                  "lon": 106.3493,
                  "lat": 37.1422
                },
                {
                  "lon": 106.3493,
                  "lat": 36.9624
                },
                {
                  "lon": 105.2213,
                  "lat": 36.9624
                },
                {
                  "lon": 105.2213,
                  "lat": 37.1422
                },
                {
                  "lon": 105.8981,
                  "lat": 37.1422
                }
              ],
              [
                {
                  "lon": 80.252,
                  "lat": 44.514
                },
                {
                  "lon": 79.4954,
                  "lat": 44.514
                },
                {
                  "lon": 79.4954,
                  "lat": 44.3342
                },
                {
                  "lon": 80.7564,
                  "lat": 44.3342
                },
                {
                  "lon": 80.7564,
                  "lat": 44.514
                },
                {
                  "lon": 80.252,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 104.6675,
                  "lat": 30.4896
                },
                {
                  "lon": 102.3718,
                  "lat": 30.4896
                },
                {
                  "lon": 102.3718,
                  "lat": 30.3098
                },
                {
                  "lon": 105.2936,
                  "lat": 30.3098
                },
                {
                  "lon": 105.2936,
                  "lat": 30.4896
                },
                {
                  "lon": 104.6675,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 97.835,
                  "lat": 40.019
                },
                {
                  "lon": 99.9482,
                  "lat": 40.019
                },
                {
                  "lon": 99.9482,
                  "lat": 39.8392
                },
                {
                  "lon": 97.6002,
                  "lat": 39.8392
                },
                {
                  "lon": 97.6002,
                  "lat": 40.019
                },
                {
                  "lon": 97.835,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 118.7095,
                  "lat": 42.716
                },
                {
                  "lon": 122.1367,
                  "lat": 42.716
                },
                {
                  "lon": 122.1367,
                  "lat": 42.5362
                },
                {
                  "lon": 118.2199,
                  "lat": 42.5362
                },
                {
                  "lon": 118.2199,
                  "lat": 42.716
                },
                {
                  "lon": 118.7095,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 111.6507,
                  "lat": 24.0168
                },
                {
                  "lon": 111.6507,
                  "lat": 24.1966
                },
                {
                  "lon": 113.0311,
                  "lat": 24.1966
                },
                {
                  "lon": 113.0311,
                  "lat": 24.0168
                },
                {
                  "lon": 111.6507,
                  "lat": 24.0168
                }
              ],
              [
                {
                  "lon": 77.5422,
                  "lat": 38.9402
                },
                {
                  "lon": 78.0046,
                  "lat": 38.9402
                },
                {
                  "lon": 78.0046,
                  "lat": 38.7604
                },
                {
                  "lon": 76.8486,
                  "lat": 38.7604
                },
                {
                  "lon": 76.8486,
                  "lat": 38.9402
                },
                {
                  "lon": 77.5422,
                  "lat": 38.9402
                }
              ],
              [
                {
                  "lon": 89.0887,
                  "lat": 42.716
                },
                {
                  "lon": 88.1095,
                  "lat": 42.716
                },
                {
                  "lon": 88.1095,
                  "lat": 42.5362
                },
                {
                  "lon": 89.3335,
                  "lat": 42.5362
                },
                {
                  "lon": 89.3335,
                  "lat": 42.716
                },
                {
                  "lon": 89.0887,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 125.4662,
                  "lat": 50.807
                },
                {
                  "lon": 123.4663,
                  "lat": 50.807
                },
                {
                  "lon": 123.4663,
                  "lat": 50.9868
                },
                {
                  "lon": 125.4662,
                  "lat": 50.9868
                },
                {
                  "lon": 125.4662,
                  "lat": 50.807
                }
              ],
              [
                {
                  "lon": 95.3335,
                  "lat": 30.13
                },
                {
                  "lon": 95.1256,
                  "lat": 30.13
                },
                {
                  "lon": 95.1256,
                  "lat": 29.9502
                },
                {
                  "lon": 96.373,
                  "lat": 29.9502
                },
                {
                  "lon": 96.373,
                  "lat": 30.13
                },
                {
                  "lon": 95.3335,
                  "lat": 30.13
                }
              ],
              [
                {
                  "lon": 120.6286,
                  "lat": 49.3686
                },
                {
                  "lon": 119.5198,
                  "lat": 49.3686
                },
                {
                  "lon": 119.5198,
                  "lat": 49.5484
                },
                {
                  "lon": 120.9058,
                  "lat": 49.5484
                },
                {
                  "lon": 120.9058,
                  "lat": 49.3686
                },
                {
                  "lon": 120.6286,
                  "lat": 49.3686
                }
              ],
              [
                {
                  "lon": 99.8508,
                  "lat": 39.12
                },
                {
                  "lon": 101.4734,
                  "lat": 39.12
                },
                {
                  "lon": 101.4734,
                  "lat": 38.9402
                },
                {
                  "lon": 99.619,
                  "lat": 38.9402
                },
                {
                  "lon": 99.619,
                  "lat": 39.12
                },
                {
                  "lon": 99.8508,
                  "lat": 39.12
                }
              ],
              [
                {
                  "lon": 119.4699,
                  "lat": 27.7926
                },
                {
                  "lon": 119.2666,
                  "lat": 27.7926
                },
                {
                  "lon": 119.2666,
                  "lat": 27.6128
                },
                {
                  "lon": 121.0963,
                  "lat": 27.6128
                },
                {
                  "lon": 121.0963,
                  "lat": 27.7926
                },
                {
                  "lon": 119.4699,
                  "lat": 27.7926
                }
              ],
              [
                {
                  "lon": 128.5561,
                  "lat": 47.5706
                },
                {
                  "lon": 128.0229,
                  "lat": 47.5706
                },
                {
                  "lon": 128.0229,
                  "lat": 47.3908
                },
                {
                  "lon": 128.5561,
                  "lat": 47.3908
                },
                {
                  "lon": 128.5561,
                  "lat": 47.5706
                }
              ],
              [
                {
                  "lon": 126.4886,
                  "lat": 40.918
                },
                {
                  "lon": 126.0126,
                  "lat": 40.918
                },
                {
                  "lon": 126.0126,
                  "lat": 40.7382
                },
                {
                  "lon": 126.4886,
                  "lat": 40.7382
                },
                {
                  "lon": 126.4886,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 126.9235,
                  "lat": 50.2676
                },
                {
                  "lon": 126.6411,
                  "lat": 50.2676
                },
                {
                  "lon": 126.6411,
                  "lat": 50.4474
                },
                {
                  "lon": 128.3355,
                  "lat": 50.4474
                },
                {
                  "lon": 128.3355,
                  "lat": 50.2676
                },
                {
                  "lon": 126.9235,
                  "lat": 50.2676
                }
              ],
              [
                {
                  "lon": 109.8832,
                  "lat": 41.2776
                },
                {
                  "lon": 109.6439,
                  "lat": 41.2776
                },
                {
                  "lon": 109.6439,
                  "lat": 41.0978
                },
                {
                  "lon": 110.3618,
                  "lat": 41.0978
                },
                {
                  "lon": 110.3618,
                  "lat": 41.2776
                },
                {
                  "lon": 109.8832,
                  "lat": 41.2776
                }
              ],
              [
                {
                  "lon": 129.5702,
                  "lat": 45.2332
                },
                {
                  "lon": 129.0578,
                  "lat": 45.2332
                },
                {
                  "lon": 129.0578,
                  "lat": 45.413
                },
                {
                  "lon": 129.5702,
                  "lat": 45.413
                },
                {
                  "lon": 129.5702,
                  "lat": 45.2332
                }
              ],
              [
                {
                  "lon": 110.1345,
                  "lat": 27.2532
                },
                {
                  "lon": 110.5397,
                  "lat": 27.2532
                },
                {
                  "lon": 110.5397,
                  "lat": 27.433
                },
                {
                  "lon": 109.5267,
                  "lat": 27.433
                },
                {
                  "lon": 109.5267,
                  "lat": 27.2532
                },
                {
                  "lon": 110.1345,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 82.8917,
                  "lat": 42.3564
                },
                {
                  "lon": 83.624,
                  "lat": 42.3564
                },
                {
                  "lon": 83.624,
                  "lat": 42.5362
                },
                {
                  "lon": 82.8917,
                  "lat": 42.5362
                },
                {
                  "lon": 82.8917,
                  "lat": 42.3564
                }
              ],
              [
                {
                  "lon": 85.6345,
                  "lat": 41.6372
                },
                {
                  "lon": 86.5969,
                  "lat": 41.6372
                },
                {
                  "lon": 86.5969,
                  "lat": 41.4574
                },
                {
                  "lon": 85.3939,
                  "lat": 41.4574
                },
                {
                  "lon": 85.3939,
                  "lat": 41.6372
                },
                {
                  "lon": 85.6345,
                  "lat": 41.6372
                }
              ],
              [
                {
                  "lon": 103.3163,
                  "lat": 37.1422
                },
                {
                  "lon": 102.6377,
                  "lat": 37.1422
                },
                {
                  "lon": 102.6377,
                  "lat": 37.322
                },
                {
                  "lon": 105.3521,
                  "lat": 37.322
                },
                {
                  "lon": 105.3521,
                  "lat": 37.1422
                },
                {
                  "lon": 103.3163,
                  "lat": 37.1422
                }
              ],
              [
                {
                  "lon": 98.282,
                  "lat": 36.423
                },
                {
                  "lon": 96.941,
                  "lat": 36.423
                },
                {
                  "lon": 96.941,
                  "lat": 36.2432
                },
                {
                  "lon": 98.5055,
                  "lat": 36.2432
                },
                {
                  "lon": 98.5055,
                  "lat": 36.423
                },
                {
                  "lon": 98.282,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 114.1422,
                  "lat": 24.736
                },
                {
                  "lon": 115.5303,
                  "lat": 24.736
                },
                {
                  "lon": 115.5303,
                  "lat": 24.9158
                },
                {
                  "lon": 114.1422,
                  "lat": 24.9158
                },
                {
                  "lon": 114.1422,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 109.0874,
                  "lat": 26.7138
                },
                {
                  "lon": 110.0959,
                  "lat": 26.7138
                },
                {
                  "lon": 110.0959,
                  "lat": 26.8936
                },
                {
                  "lon": 108.8857,
                  "lat": 26.8936
                },
                {
                  "lon": 108.8857,
                  "lat": 26.7138
                },
                {
                  "lon": 109.0874,
                  "lat": 26.7138
                }
              ],
              [
                {
                  "lon": 108.8529,
                  "lat": 28.332
                },
                {
                  "lon": 109.0576,
                  "lat": 28.332
                },
                {
                  "lon": 109.0576,
                  "lat": 28.5118
                },
                {
                  "lon": 108.8529,
                  "lat": 28.5118
                },
                {
                  "lon": 108.8529,
                  "lat": 28.332
                }
              ],
              [
                {
                  "lon": 109.1272,
                  "lat": 33.3664
                },
                {
                  "lon": 109.5588,
                  "lat": 33.3664
                },
                {
                  "lon": 109.5588,
                  "lat": 33.5462
                },
                {
                  "lon": 109.1272,
                  "lat": 33.5462
                },
                {
                  "lon": 109.1272,
                  "lat": 33.3664
                }
              ],
              [
                {
                  "lon": 124.6643,
                  "lat": 50.4474
                },
                {
                  "lon": 125.5115,
                  "lat": 50.4474
                },
                {
                  "lon": 125.5115,
                  "lat": 50.2676
                },
                {
                  "lon": 124.3819,
                  "lat": 50.2676
                },
                {
                  "lon": 124.3819,
                  "lat": 50.4474
                },
                {
                  "lon": 124.6643,
                  "lat": 50.4474
                }
              ],
              [
                {
                  "lon": 83.8685,
                  "lat": 44.1544
                },
                {
                  "lon": 83.8685,
                  "lat": 43.9746
                },
                {
                  "lon": 84.3699,
                  "lat": 43.9746
                },
                {
                  "lon": 84.3699,
                  "lat": 44.1544
                },
                {
                  "lon": 83.8685,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 95.6403,
                  "lat": 38.221
                },
                {
                  "lon": 94.038,
                  "lat": 38.221
                },
                {
                  "lon": 94.038,
                  "lat": 38.0412
                },
                {
                  "lon": 95.6403,
                  "lat": 38.0412
                },
                {
                  "lon": 95.6403,
                  "lat": 38.221
                }
              ],
              [
                {
                  "lon": 84.2003,
                  "lat": 43.615
                },
                {
                  "lon": 84.2003,
                  "lat": 43.7948
                },
                {
                  "lon": 84.9479,
                  "lat": 43.7948
                },
                {
                  "lon": 84.9479,
                  "lat": 43.615
                },
                {
                  "lon": 84.2003,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 126.4256,
                  "lat": 49.7282
                },
                {
                  "lon": 126.7038,
                  "lat": 49.7282
                },
                {
                  "lon": 126.7038,
                  "lat": 49.5484
                },
                {
                  "lon": 125.8692,
                  "lat": 49.5484
                },
                {
                  "lon": 125.8692,
                  "lat": 49.7282
                },
                {
                  "lon": 126.4256,
                  "lat": 49.7282
                }
              ],
              [
                {
                  "lon": 120.713,
                  "lat": 49.009
                },
                {
                  "lon": 121.5386,
                  "lat": 49.009
                },
                {
                  "lon": 121.5386,
                  "lat": 49.1888
                },
                {
                  "lon": 119.337,
                  "lat": 49.1888
                },
                {
                  "lon": 119.337,
                  "lat": 49.009
                },
                {
                  "lon": 120.713,
                  "lat": 49.009
                }
              ],
              [
                {
                  "lon": 106.4264,
                  "lat": 29.231
                },
                {
                  "lon": 109.1109,
                  "lat": 29.231
                },
                {
                  "lon": 109.1109,
                  "lat": 29.4108
                },
                {
                  "lon": 104.9809,
                  "lat": 29.4108
                },
                {
                  "lon": 104.9809,
                  "lat": 29.231
                },
                {
                  "lon": 106.4264,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 101.7329,
                  "lat": 37.322
                },
                {
                  "lon": 101.2805,
                  "lat": 37.322
                },
                {
                  "lon": 101.2805,
                  "lat": 37.1422
                },
                {
                  "lon": 101.9591,
                  "lat": 37.1422
                },
                {
                  "lon": 101.9591,
                  "lat": 37.322
                },
                {
                  "lon": 101.7329,
                  "lat": 37.322
                }
              ],
              [
                {
                  "lon": 103.3115,
                  "lat": 36.9624
                },
                {
                  "lon": 102.6362,
                  "lat": 36.9624
                },
                {
                  "lon": 102.6362,
                  "lat": 36.7826
                },
                {
                  "lon": 103.5366,
                  "lat": 36.7826
                },
                {
                  "lon": 103.5366,
                  "lat": 36.9624
                },
                {
                  "lon": 103.3115,
                  "lat": 36.9624
                }
              ],
              [
                {
                  "lon": 126.2276,
                  "lat": 52.7848
                },
                {
                  "lon": 125.038,
                  "lat": 52.7848
                },
                {
                  "lon": 125.038,
                  "lat": 52.605
                },
                {
                  "lon": 126.2276,
                  "lat": 52.605
                },
                {
                  "lon": 126.2276,
                  "lat": 52.7848
                }
              ],
              [
                {
                  "lon": 100.6405,
                  "lat": 36.0634
                },
                {
                  "lon": 99.7485,
                  "lat": 36.0634
                },
                {
                  "lon": 99.7485,
                  "lat": 36.2432
                },
                {
                  "lon": 101.5325,
                  "lat": 36.2432
                },
                {
                  "lon": 101.5325,
                  "lat": 36.0634
                },
                {
                  "lon": 100.6405,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 99.8546,
                  "lat": 38.5806
                },
                {
                  "lon": 101.6994,
                  "lat": 38.5806
                },
                {
                  "lon": 101.6994,
                  "lat": 38.7604
                },
                {
                  "lon": 99.624,
                  "lat": 38.7604
                },
                {
                  "lon": 99.624,
                  "lat": 38.5806
                },
                {
                  "lon": 99.8546,
                  "lat": 38.5806
                }
              ],
              [
                {
                  "lon": 121.7645,
                  "lat": 43.7948
                },
                {
                  "lon": 121.5146,
                  "lat": 43.7948
                },
                {
                  "lon": 121.5146,
                  "lat": 43.9746
                },
                {
                  "lon": 121.7645,
                  "lat": 43.9746
                },
                {
                  "lon": 121.7645,
                  "lat": 43.7948
                }
              ],
              [
                {
                  "lon": 115.2322,
                  "lat": 30.8492
                },
                {
                  "lon": 115.2322,
                  "lat": 31.029
                },
                {
                  "lon": 113.9728,
                  "lat": 31.029
                },
                {
                  "lon": 113.9728,
                  "lat": 30.8492
                },
                {
                  "lon": 115.2322,
                  "lat": 30.8492
                }
              ],
              [
                {
                  "lon": 125.0607,
                  "lat": 52.0656
                },
                {
                  "lon": 124.1796,
                  "lat": 52.0656
                },
                {
                  "lon": 124.1796,
                  "lat": 52.2454
                },
                {
                  "lon": 126.5292,
                  "lat": 52.2454
                },
                {
                  "lon": 126.5292,
                  "lat": 52.0656
                },
                {
                  "lon": 125.0607,
                  "lat": 52.0656
                }
              ],
              [
                {
                  "lon": 123.6905,
                  "lat": 51.5262
                },
                {
                  "lon": 124.8469,
                  "lat": 51.5262
                },
                {
                  "lon": 124.8469,
                  "lat": 51.3464
                },
                {
                  "lon": 123.4014,
                  "lat": 51.3464
                },
                {
                  "lon": 123.4014,
                  "lat": 51.5262
                },
                {
                  "lon": 123.6905,
                  "lat": 51.5262
                }
              ],
              [
                {
                  "lon": 125.4835,
                  "lat": 50.6272
                },
                {
                  "lon": 123.2067,
                  "lat": 50.6272
                },
                {
                  "lon": 123.2067,
                  "lat": 50.807
                },
                {
                  "lon": 125.4835,
                  "lat": 50.807
                },
                {
                  "lon": 125.4835,
                  "lat": 50.6272
                }
              ],
              [
                {
                  "lon": 105.1263,
                  "lat": 26.8936
                },
                {
                  "lon": 104.5203,
                  "lat": 26.8936
                },
                {
                  "lon": 104.5203,
                  "lat": 27.0734
                },
                {
                  "lon": 105.5303,
                  "lat": 27.0734
                },
                {
                  "lon": 105.5303,
                  "lat": 26.8936
                },
                {
                  "lon": 105.1263,
                  "lat": 26.8936
                }
              ],
              [
                {
                  "lon": 112.5118,
                  "lat": 29.231
                },
                {
                  "lon": 112.3057,
                  "lat": 29.231
                },
                {
                  "lon": 112.3057,
                  "lat": 29.0512
                },
                {
                  "lon": 113.1301,
                  "lat": 29.0512
                },
                {
                  "lon": 113.1301,
                  "lat": 29.231
                },
                {
                  "lon": 112.5118,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 107.1963,
                  "lat": 27.6128
                },
                {
                  "lon": 108.2113,
                  "lat": 27.6128
                },
                {
                  "lon": 108.2113,
                  "lat": 27.433
                },
                {
                  "lon": 106.1813,
                  "lat": 27.433
                },
                {
                  "lon": 106.1813,
                  "lat": 27.6128
                },
                {
                  "lon": 107.1963,
                  "lat": 27.6128
                }
              ],
              [
                {
                  "lon": 95.0726,
                  "lat": 40.918
                },
                {
                  "lon": 96.9766,
                  "lat": 40.918
                },
                {
                  "lon": 96.9766,
                  "lat": 40.7382
                },
                {
                  "lon": 94.5966,
                  "lat": 40.7382
                },
                {
                  "lon": 94.5966,
                  "lat": 40.918
                },
                {
                  "lon": 95.0726,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 111.443,
                  "lat": 35.8836
                },
                {
                  "lon": 110.108,
                  "lat": 35.8836
                },
                {
                  "lon": 110.108,
                  "lat": 36.0634
                },
                {
                  "lon": 112.333,
                  "lat": 36.0634
                },
                {
                  "lon": 112.333,
                  "lat": 35.8836
                },
                {
                  "lon": 111.443,
                  "lat": 35.8836
                }
              ],
              [
                {
                  "lon": 117.5275,
                  "lat": 27.7926
                },
                {
                  "lon": 117.7311,
                  "lat": 27.7926
                },
                {
                  "lon": 117.7311,
                  "lat": 27.9724
                },
                {
                  "lon": 117.3239,
                  "lat": 27.9724
                },
                {
                  "lon": 117.3239,
                  "lat": 27.7926
                },
                {
                  "lon": 117.5275,
                  "lat": 27.7926
                }
              ],
              [
                {
                  "lon": 108.4241,
                  "lat": 30.3098
                },
                {
                  "lon": 107.1719,
                  "lat": 30.3098
                },
                {
                  "lon": 107.1719,
                  "lat": 30.4896
                },
                {
                  "lon": 108.4241,
                  "lat": 30.4896
                },
                {
                  "lon": 108.4241,
                  "lat": 30.3098
                }
              ],
              [
                {
                  "lon": 131.2508,
                  "lat": 44.1544
                },
                {
                  "lon": 131.5015,
                  "lat": 44.1544
                },
                {
                  "lon": 131.5015,
                  "lat": 43.9746
                },
                {
                  "lon": 130.4987,
                  "lat": 43.9746
                },
                {
                  "lon": 130.4987,
                  "lat": 44.1544
                },
                {
                  "lon": 131.2508,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 134.1519,
                  "lat": 46.6716
                },
                {
                  "lon": 134.4149,
                  "lat": 46.6716
                },
                {
                  "lon": 134.4149,
                  "lat": 46.8514
                },
                {
                  "lon": 129.4179,
                  "lat": 46.8514
                },
                {
                  "lon": 129.4179,
                  "lat": 46.6716
                },
                {
                  "lon": 134.1519,
                  "lat": 46.6716
                }
              ],
              [
                {
                  "lon": 105.6458,
                  "lat": 39.12
                },
                {
                  "lon": 106.1094,
                  "lat": 39.12
                },
                {
                  "lon": 106.1094,
                  "lat": 38.9402
                },
                {
                  "lon": 105.414,
                  "lat": 38.9402
                },
                {
                  "lon": 105.414,
                  "lat": 39.12
                },
                {
                  "lon": 105.6458,
                  "lat": 39.12
                }
              ],
              [
                {
                  "lon": 124.6481,
                  "lat": 50.4474
                },
                {
                  "lon": 123.2306,
                  "lat": 50.4474
                },
                {
                  "lon": 123.2306,
                  "lat": 50.6272
                },
                {
                  "lon": 124.6481,
                  "lat": 50.6272
                },
                {
                  "lon": 124.6481,
                  "lat": 50.4474
                }
              ],
              [
                {
                  "lon": 112.2797,
                  "lat": 27.2532
                },
                {
                  "lon": 111.8751,
                  "lat": 27.2532
                },
                {
                  "lon": 111.8751,
                  "lat": 27.0734
                },
                {
                  "lon": 112.6843,
                  "lat": 27.0734
                },
                {
                  "lon": 112.6843,
                  "lat": 27.2532
                },
                {
                  "lon": 112.2797,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 82.347,
                  "lat": 45.0534
                },
                {
                  "lon": 82.347,
                  "lat": 45.2332
                },
                {
                  "lon": 81.8362,
                  "lat": 45.2332
                },
                {
                  "lon": 81.8362,
                  "lat": 45.0534
                },
                {
                  "lon": 82.347,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 77.2558,
                  "lat": 38.7604
                },
                {
                  "lon": 77.0252,
                  "lat": 38.7604
                },
                {
                  "lon": 77.0252,
                  "lat": 38.5806
                },
                {
                  "lon": 77.9476,
                  "lat": 38.5806
                },
                {
                  "lon": 77.9476,
                  "lat": 38.7604
                },
                {
                  "lon": 77.2558,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 85.9892,
                  "lat": 44.6938
                },
                {
                  "lon": 85.4816,
                  "lat": 44.6938
                },
                {
                  "lon": 85.4816,
                  "lat": 44.8736
                },
                {
                  "lon": 86.243,
                  "lat": 44.8736
                },
                {
                  "lon": 86.243,
                  "lat": 44.6938
                },
                {
                  "lon": 85.9892,
                  "lat": 44.6938
                }
              ],
              [
                {
                  "lon": 81.8409,
                  "lat": 40.5584
                },
                {
                  "lon": 82.0776,
                  "lat": 40.5584
                },
                {
                  "lon": 82.0776,
                  "lat": 40.3786
                },
                {
                  "lon": 80.8941,
                  "lat": 40.3786
                },
                {
                  "lon": 80.8941,
                  "lat": 40.5584
                },
                {
                  "lon": 81.8409,
                  "lat": 40.5584
                }
              ],
              [
                {
                  "lon": 119.9835,
                  "lat": 25.2754
                },
                {
                  "lon": 117.3939,
                  "lat": 25.2754
                },
                {
                  "lon": 117.3939,
                  "lat": 25.4552
                },
                {
                  "lon": 120.3819,
                  "lat": 25.4552
                },
                {
                  "lon": 120.3819,
                  "lat": 25.2754
                },
                {
                  "lon": 119.9835,
                  "lat": 25.2754
                }
              ],
              [
                {
                  "lon": 124.7027,
                  "lat": 50.2676
                },
                {
                  "lon": 124.7027,
                  "lat": 50.0878
                },
                {
                  "lon": 125.5469,
                  "lat": 50.0878
                },
                {
                  "lon": 125.5469,
                  "lat": 50.2676
                },
                {
                  "lon": 124.7027,
                  "lat": 50.2676
                }
              ],
              [
                {
                  "lon": 114.5065,
                  "lat": 41.6372
                },
                {
                  "lon": 114.7471,
                  "lat": 41.6372
                },
                {
                  "lon": 114.7471,
                  "lat": 41.4574
                },
                {
                  "lon": 114.2659,
                  "lat": 41.4574
                },
                {
                  "lon": 114.2659,
                  "lat": 41.6372
                },
                {
                  "lon": 114.5065,
                  "lat": 41.6372
                }
              ],
              [
                {
                  "lon": 77.9426,
                  "lat": 39.4796
                },
                {
                  "lon": 78.1756,
                  "lat": 39.4796
                },
                {
                  "lon": 78.1756,
                  "lat": 39.2998
                },
                {
                  "lon": 75.1466,
                  "lat": 39.2998
                },
                {
                  "lon": 75.1466,
                  "lat": 39.4796
                },
                {
                  "lon": 77.9426,
                  "lat": 39.4796
                }
              ],
              [
                {
                  "lon": 125.3724,
                  "lat": 45.9524
                },
                {
                  "lon": 124.3376,
                  "lat": 45.9524
                },
                {
                  "lon": 124.3376,
                  "lat": 45.7726
                },
                {
                  "lon": 125.3724,
                  "lat": 45.7726
                },
                {
                  "lon": 125.3724,
                  "lat": 45.9524
                }
              ],
              [
                {
                  "lon": 108.8309,
                  "lat": 37.1422
                },
                {
                  "lon": 107.2517,
                  "lat": 37.1422
                },
                {
                  "lon": 107.2517,
                  "lat": 36.9624
                },
                {
                  "lon": 109.0565,
                  "lat": 36.9624
                },
                {
                  "lon": 109.0565,
                  "lat": 37.1422
                },
                {
                  "lon": 108.8309,
                  "lat": 37.1422
                }
              ],
              [
                {
                  "lon": 96.5224,
                  "lat": 29.9502
                },
                {
                  "lon": 97.3528,
                  "lat": 29.9502
                },
                {
                  "lon": 97.3528,
                  "lat": 29.7704
                },
                {
                  "lon": 96.5224,
                  "lat": 29.7704
                },
                {
                  "lon": 96.5224,
                  "lat": 29.9502
                }
              ],
              [
                {
                  "lon": 80.3038,
                  "lat": 45.0534
                },
                {
                  "lon": 80.3038,
                  "lat": 45.2332
                },
                {
                  "lon": 81.5808,
                  "lat": 45.2332
                },
                {
                  "lon": 81.5808,
                  "lat": 45.0534
                },
                {
                  "lon": 80.3038,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 96.1805,
                  "lat": 36.0634
                },
                {
                  "lon": 94.3965,
                  "lat": 36.0634
                },
                {
                  "lon": 94.3965,
                  "lat": 36.2432
                },
                {
                  "lon": 96.4035,
                  "lat": 36.2432
                },
                {
                  "lon": 96.4035,
                  "lat": 36.0634
                },
                {
                  "lon": 96.1805,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 124.4213,
                  "lat": 50.0878
                },
                {
                  "lon": 124.4213,
                  "lat": 50.2676
                },
                {
                  "lon": 124.1399,
                  "lat": 50.2676
                },
                {
                  "lon": 124.1399,
                  "lat": 50.0878
                },
                {
                  "lon": 124.4213,
                  "lat": 50.0878
                }
              ],
              [
                {
                  "lon": 120.4816,
                  "lat": 43.2554
                },
                {
                  "lon": 120.4816,
                  "lat": 43.0756
                },
                {
                  "lon": 123.1975,
                  "lat": 43.0756
                },
                {
                  "lon": 123.1975,
                  "lat": 43.2554
                },
                {
                  "lon": 120.4816,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 110.7317,
                  "lat": 20.241
                },
                {
                  "lon": 110.7317,
                  "lat": 20.4208
                },
                {
                  "lon": 111.3074,
                  "lat": 20.4208
                },
                {
                  "lon": 111.3074,
                  "lat": 20.241
                },
                {
                  "lon": 110.7317,
                  "lat": 20.241
                }
              ],
              [
                {
                  "lon": 121.5212,
                  "lat": 44.8736
                },
                {
                  "lon": 121.775,
                  "lat": 44.8736
                },
                {
                  "lon": 121.775,
                  "lat": 44.6938
                },
                {
                  "lon": 120.506,
                  "lat": 44.6938
                },
                {
                  "lon": 120.506,
                  "lat": 44.8736
                },
                {
                  "lon": 121.5212,
                  "lat": 44.8736
                }
              ],
              [
                {
                  "lon": 109.3946,
                  "lat": 17.9036
                },
                {
                  "lon": 109.2054,
                  "lat": 17.9036
                },
                {
                  "lon": 109.2054,
                  "lat": 18.0834
                },
                {
                  "lon": 109.773,
                  "lat": 18.0834
                },
                {
                  "lon": 109.773,
                  "lat": 17.9036
                },
                {
                  "lon": 109.3946,
                  "lat": 17.9036
                }
              ],
              [
                {
                  "lon": 104.562,
                  "lat": 37.6816
                },
                {
                  "lon": 105.2454,
                  "lat": 37.6816
                },
                {
                  "lon": 105.2454,
                  "lat": 37.8614
                },
                {
                  "lon": 104.562,
                  "lat": 37.8614
                },
                {
                  "lon": 104.562,
                  "lat": 37.6816
                }
              ],
              [
                {
                  "lon": 116.9609,
                  "lat": 43.9746
                },
                {
                  "lon": 116.9609,
                  "lat": 44.1544
                },
                {
                  "lon": 115.7074,
                  "lat": 44.1544
                },
                {
                  "lon": 115.7074,
                  "lat": 43.9746
                },
                {
                  "lon": 116.9609,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 121.0618,
                  "lat": 44.514
                },
                {
                  "lon": 121.3148,
                  "lat": 44.514
                },
                {
                  "lon": 121.3148,
                  "lat": 44.6938
                },
                {
                  "lon": 120.0498,
                  "lat": 44.6938
                },
                {
                  "lon": 120.0498,
                  "lat": 44.514
                },
                {
                  "lon": 121.0618,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 96.6516,
                  "lat": 29.5906
                },
                {
                  "lon": 97.066,
                  "lat": 29.5906
                },
                {
                  "lon": 97.066,
                  "lat": 29.7704
                },
                {
                  "lon": 96.4444,
                  "lat": 29.7704
                },
                {
                  "lon": 96.4444,
                  "lat": 29.5906
                },
                {
                  "lon": 96.6516,
                  "lat": 29.5906
                }
              ],
              [
                {
                  "lon": 81.9652,
                  "lat": 43.2554
                },
                {
                  "lon": 82.459,
                  "lat": 43.2554
                },
                {
                  "lon": 82.459,
                  "lat": 43.0756
                },
                {
                  "lon": 81.9652,
                  "lat": 43.0756
                },
                {
                  "lon": 81.9652,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 95.4693,
                  "lat": 40.1988
                },
                {
                  "lon": 94.2888,
                  "lat": 40.1988
                },
                {
                  "lon": 94.2888,
                  "lat": 40.3786
                },
                {
                  "lon": 97.8303,
                  "lat": 40.3786
                },
                {
                  "lon": 97.8303,
                  "lat": 40.1988
                },
                {
                  "lon": 95.4693,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 131.1818,
                  "lat": 44.514
                },
                {
                  "lon": 128.3988,
                  "lat": 44.514
                },
                {
                  "lon": 128.3988,
                  "lat": 44.6938
                },
                {
                  "lon": 131.4348,
                  "lat": 44.6938
                },
                {
                  "lon": 131.4348,
                  "lat": 44.514
                },
                {
                  "lon": 131.1818,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 107.5999,
                  "lat": 41.0978
                },
                {
                  "lon": 109.0321,
                  "lat": 41.0978
                },
                {
                  "lon": 109.0321,
                  "lat": 40.918
                },
                {
                  "lon": 106.6451,
                  "lat": 40.918
                },
                {
                  "lon": 106.6451,
                  "lat": 41.0978
                },
                {
                  "lon": 107.5999,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 107.9996,
                  "lat": 39.2998
                },
                {
                  "lon": 107.9996,
                  "lat": 39.4796
                },
                {
                  "lon": 108.9316,
                  "lat": 39.4796
                },
                {
                  "lon": 108.9316,
                  "lat": 39.2998
                },
                {
                  "lon": 107.9996,
                  "lat": 39.2998
                }
              ],
              [
                {
                  "lon": 126.6541,
                  "lat": 43.2554
                },
                {
                  "lon": 127.1479,
                  "lat": 43.2554
                },
                {
                  "lon": 127.1479,
                  "lat": 43.0756
                },
                {
                  "lon": 126.4072,
                  "lat": 43.0756
                },
                {
                  "lon": 126.4072,
                  "lat": 43.2554
                },
                {
                  "lon": 126.6541,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 83.3671,
                  "lat": 44.1544
                },
                {
                  "lon": 83.1164,
                  "lat": 44.1544
                },
                {
                  "lon": 83.1164,
                  "lat": 43.9746
                },
                {
                  "lon": 83.6178,
                  "lat": 43.9746
                },
                {
                  "lon": 83.6178,
                  "lat": 44.1544
                },
                {
                  "lon": 83.3671,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 106.1284,
                  "lat": 30.4896
                },
                {
                  "lon": 105.5023,
                  "lat": 30.4896
                },
                {
                  "lon": 105.5023,
                  "lat": 30.3098
                },
                {
                  "lon": 106.1284,
                  "lat": 30.3098
                },
                {
                  "lon": 106.1284,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 95.7645,
                  "lat": 41.0978
                },
                {
                  "lon": 95.5252,
                  "lat": 41.0978
                },
                {
                  "lon": 95.5252,
                  "lat": 41.2776
                },
                {
                  "lon": 95.7645,
                  "lat": 41.2776
                },
                {
                  "lon": 95.7645,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 125.2751,
                  "lat": 50.0878
                },
                {
                  "lon": 123.8736,
                  "lat": 50.0878
                },
                {
                  "lon": 123.8736,
                  "lat": 49.908
                },
                {
                  "lon": 125.2751,
                  "lat": 49.908
                },
                {
                  "lon": 125.2751,
                  "lat": 50.0878
                }
              ],
              [
                {
                  "lon": 95.2522,
                  "lat": 40.019
                },
                {
                  "lon": 95.2522,
                  "lat": 39.8392
                },
                {
                  "lon": 95.487,
                  "lat": 39.8392
                },
                {
                  "lon": 95.487,
                  "lat": 40.019
                },
                {
                  "lon": 95.2522,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 122.5147,
                  "lat": 42.8958
                },
                {
                  "lon": 122.5147,
                  "lat": 43.0756
                },
                {
                  "lon": 121.7761,
                  "lat": 43.0756
                },
                {
                  "lon": 121.7761,
                  "lat": 42.8958
                },
                {
                  "lon": 122.5147,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 103.0258,
                  "lat": 30.13
                },
                {
                  "lon": 103.0258,
                  "lat": 29.9502
                },
                {
                  "lon": 103.6495,
                  "lat": 29.9502
                },
                {
                  "lon": 103.6495,
                  "lat": 30.13
                },
                {
                  "lon": 103.0258,
                  "lat": 30.13
                }
              ],
              [
                {
                  "lon": 84.2732,
                  "lat": 42.8958
                },
                {
                  "lon": 83.2912,
                  "lat": 42.8958
                },
                {
                  "lon": 83.2912,
                  "lat": 42.716
                },
                {
                  "lon": 84.5187,
                  "lat": 42.716
                },
                {
                  "lon": 84.5187,
                  "lat": 42.8958
                },
                {
                  "lon": 84.2732,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 76.027,
                  "lat": 39.2998
                },
                {
                  "lon": 75.5622,
                  "lat": 39.2998
                },
                {
                  "lon": 75.5622,
                  "lat": 39.12
                },
                {
                  "lon": 76.9566,
                  "lat": 39.12
                },
                {
                  "lon": 76.9566,
                  "lat": 39.2998
                },
                {
                  "lon": 76.027,
                  "lat": 39.2998
                }
              ],
              [
                {
                  "lon": 88.4367,
                  "lat": 43.7948
                },
                {
                  "lon": 86.9415,
                  "lat": 43.7948
                },
                {
                  "lon": 86.9415,
                  "lat": 43.615
                },
                {
                  "lon": 88.4367,
                  "lat": 43.615
                },
                {
                  "lon": 88.4367,
                  "lat": 43.7948
                }
              ],
              [
                {
                  "lon": 80.9132,
                  "lat": 44.8736
                },
                {
                  "lon": 80.6594,
                  "lat": 44.8736
                },
                {
                  "lon": 80.6594,
                  "lat": 44.6938
                },
                {
                  "lon": 83.705,
                  "lat": 44.6938
                },
                {
                  "lon": 83.705,
                  "lat": 44.8736
                },
                {
                  "lon": 80.9132,
                  "lat": 44.8736
                }
              ],
              [
                {
                  "lon": 120.4205,
                  "lat": 35.8836
                },
                {
                  "lon": 120.8645,
                  "lat": 35.8836
                },
                {
                  "lon": 120.8645,
                  "lat": 35.7038
                },
                {
                  "lon": 119.9765,
                  "lat": 35.7038
                },
                {
                  "lon": 119.9765,
                  "lat": 35.8836
                },
                {
                  "lon": 120.4205,
                  "lat": 35.8836
                }
              ],
              [
                {
                  "lon": 84.7793,
                  "lat": 43.9746
                },
                {
                  "lon": 83.7797,
                  "lat": 43.9746
                },
                {
                  "lon": 83.7797,
                  "lat": 43.7948
                },
                {
                  "lon": 85.0292,
                  "lat": 43.7948
                },
                {
                  "lon": 85.0292,
                  "lat": 43.9746
                },
                {
                  "lon": 84.7793,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 105.434,
                  "lat": 36.2432
                },
                {
                  "lon": 105.2105,
                  "lat": 36.2432
                },
                {
                  "lon": 105.2105,
                  "lat": 36.423
                },
                {
                  "lon": 107.222,
                  "lat": 36.423
                },
                {
                  "lon": 107.222,
                  "lat": 36.2432
                },
                {
                  "lon": 105.434,
                  "lat": 36.2432
                }
              ],
              [
                {
                  "lon": 95.9397,
                  "lat": 37.322
                },
                {
                  "lon": 96.6198,
                  "lat": 37.322
                },
                {
                  "lon": 96.6198,
                  "lat": 37.5018
                },
                {
                  "lon": 95.0329,
                  "lat": 37.5018
                },
                {
                  "lon": 95.0329,
                  "lat": 37.322
                },
                {
                  "lon": 95.9397,
                  "lat": 37.322
                }
              ],
              [
                {
                  "lon": 118.0126,
                  "lat": 43.0756
                },
                {
                  "lon": 116.7781,
                  "lat": 43.0756
                },
                {
                  "lon": 116.7781,
                  "lat": 43.2554
                },
                {
                  "lon": 118.0126,
                  "lat": 43.2554
                },
                {
                  "lon": 118.0126,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 102.9065,
                  "lat": 34.8048
                },
                {
                  "lon": 102.6875,
                  "lat": 34.8048
                },
                {
                  "lon": 102.6875,
                  "lat": 34.625
                },
                {
                  "lon": 103.1255,
                  "lat": 34.625
                },
                {
                  "lon": 103.1255,
                  "lat": 34.8048
                },
                {
                  "lon": 102.9065,
                  "lat": 34.8048
                }
              ],
              [
                {
                  "lon": 108.847,
                  "lat": 29.9502
                },
                {
                  "lon": 108.4312,
                  "lat": 29.9502
                },
                {
                  "lon": 108.4312,
                  "lat": 30.13
                },
                {
                  "lon": 109.0549,
                  "lat": 30.13
                },
                {
                  "lon": 109.0549,
                  "lat": 29.9502
                },
                {
                  "lon": 108.847,
                  "lat": 29.9502
                }
              ],
              [
                {
                  "lon": 88.2417,
                  "lat": 43.4352
                },
                {
                  "lon": 88.7371,
                  "lat": 43.4352
                },
                {
                  "lon": 88.7371,
                  "lat": 43.2554
                },
                {
                  "lon": 87.0032,
                  "lat": 43.2554
                },
                {
                  "lon": 87.0032,
                  "lat": 43.4352
                },
                {
                  "lon": 88.2417,
                  "lat": 43.4352
                }
              ],
              [
                {
                  "lon": 88.8784,
                  "lat": 43.2554
                },
                {
                  "lon": 88.8784,
                  "lat": 43.0756
                },
                {
                  "lon": 90.1129,
                  "lat": 43.0756
                },
                {
                  "lon": 90.1129,
                  "lat": 43.2554
                },
                {
                  "lon": 88.8784,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 113.5248,
                  "lat": 26.8936
                },
                {
                  "lon": 114.3316,
                  "lat": 26.8936
                },
                {
                  "lon": 114.3316,
                  "lat": 26.7138
                },
                {
                  "lon": 113.1214,
                  "lat": 26.7138
                },
                {
                  "lon": 113.1214,
                  "lat": 26.8936
                },
                {
                  "lon": 113.5248,
                  "lat": 26.8936
                }
              ],
              [
                {
                  "lon": 127.3929,
                  "lat": 48.4696
                },
                {
                  "lon": 127.3929,
                  "lat": 48.2898
                },
                {
                  "lon": 127.6642,
                  "lat": 48.2898
                },
                {
                  "lon": 127.6642,
                  "lat": 48.4696
                },
                {
                  "lon": 127.3929,
                  "lat": 48.4696
                }
              ],
              [
                {
                  "lon": 111.194,
                  "lat": 35.7038
                },
                {
                  "lon": 110.0865,
                  "lat": 35.7038
                },
                {
                  "lon": 110.0865,
                  "lat": 35.524
                },
                {
                  "lon": 112.08,
                  "lat": 35.524
                },
                {
                  "lon": 112.08,
                  "lat": 35.7038
                },
                {
                  "lon": 111.194,
                  "lat": 35.7038
                }
              ],
              [
                {
                  "lon": 118.8459,
                  "lat": 26.7138
                },
                {
                  "lon": 120.255,
                  "lat": 26.7138
                },
                {
                  "lon": 120.255,
                  "lat": 26.534
                },
                {
                  "lon": 118.0407,
                  "lat": 26.534
                },
                {
                  "lon": 118.0407,
                  "lat": 26.7138
                },
                {
                  "lon": 118.8459,
                  "lat": 26.7138
                }
              ],
              [
                {
                  "lon": 105.1609,
                  "lat": 33.0068
                },
                {
                  "lon": 104.3029,
                  "lat": 33.0068
                },
                {
                  "lon": 104.3029,
                  "lat": 32.827
                },
                {
                  "lon": 105.3754,
                  "lat": 32.827
                },
                {
                  "lon": 105.3754,
                  "lat": 33.0068
                },
                {
                  "lon": 105.1609,
                  "lat": 33.0068
                }
              ],
              [
                {
                  "lon": 96.7821,
                  "lat": 40.019
                },
                {
                  "lon": 96.7821,
                  "lat": 40.1988
                },
                {
                  "lon": 97.4886,
                  "lat": 40.1988
                },
                {
                  "lon": 97.4886,
                  "lat": 40.019
                },
                {
                  "lon": 96.7821,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 87.9847,
                  "lat": 41.9968
                },
                {
                  "lon": 87.9847,
                  "lat": 41.817
                },
                {
                  "lon": 88.2267,
                  "lat": 41.817
                },
                {
                  "lon": 88.2267,
                  "lat": 41.9968
                },
                {
                  "lon": 87.9847,
                  "lat": 41.9968
                }
              ],
              [
                {
                  "lon": 83.5489,
                  "lat": 41.817
                },
                {
                  "lon": 82.5837,
                  "lat": 41.817
                },
                {
                  "lon": 82.5837,
                  "lat": 41.6372
                },
                {
                  "lon": 83.5489,
                  "lat": 41.6372
                },
                {
                  "lon": 83.5489,
                  "lat": 41.817
                }
              ],
              [
                {
                  "lon": 114.1561,
                  "lat": 30.13
                },
                {
                  "lon": 114.1561,
                  "lat": 30.3098
                },
                {
                  "lon": 114.9893,
                  "lat": 30.3098
                },
                {
                  "lon": 114.9893,
                  "lat": 30.13
                },
                {
                  "lon": 114.1561,
                  "lat": 30.13
                }
              ],
              [
                {
                  "lon": 126.5815,
                  "lat": 51.5262
                },
                {
                  "lon": 126.8706,
                  "lat": 51.5262
                },
                {
                  "lon": 126.8706,
                  "lat": 51.3464
                },
                {
                  "lon": 126.2924,
                  "lat": 51.3464
                },
                {
                  "lon": 126.2924,
                  "lat": 51.5262
                },
                {
                  "lon": 126.5815,
                  "lat": 51.5262
                }
              ],
              [
                {
                  "lon": 86.2807,
                  "lat": 41.4574
                },
                {
                  "lon": 87.0007,
                  "lat": 41.4574
                },
                {
                  "lon": 87.0007,
                  "lat": 41.2776
                },
                {
                  "lon": 85.8007,
                  "lat": 41.2776
                },
                {
                  "lon": 85.8007,
                  "lat": 41.4574
                },
                {
                  "lon": 86.2807,
                  "lat": 41.4574
                }
              ],
              [
                {
                  "lon": 85.5482,
                  "lat": 44.514
                },
                {
                  "lon": 83.5306,
                  "lat": 44.514
                },
                {
                  "lon": 83.5306,
                  "lat": 44.3342
                },
                {
                  "lon": 86.0526,
                  "lat": 44.3342
                },
                {
                  "lon": 86.0526,
                  "lat": 44.514
                },
                {
                  "lon": 85.5482,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 133.1193,
                  "lat": 46.1322
                },
                {
                  "lon": 131.5569,
                  "lat": 46.1322
                },
                {
                  "lon": 131.5569,
                  "lat": 46.312
                },
                {
                  "lon": 134.1609,
                  "lat": 46.312
                },
                {
                  "lon": 134.1609,
                  "lat": 46.1322
                },
                {
                  "lon": 133.1193,
                  "lat": 46.1322
                }
              ],
              [
                {
                  "lon": 108.2809,
                  "lat": 31.7482
                },
                {
                  "lon": 108.2809,
                  "lat": 31.5684
                },
                {
                  "lon": 107.6464,
                  "lat": 31.5684
                },
                {
                  "lon": 107.6464,
                  "lat": 31.7482
                },
                {
                  "lon": 108.2809,
                  "lat": 31.7482
                }
              ],
              [
                {
                  "lon": 83.7085,
                  "lat": 42.1766
                },
                {
                  "lon": 83.7085,
                  "lat": 41.9968
                },
                {
                  "lon": 82.2523,
                  "lat": 41.9968
                },
                {
                  "lon": 82.2523,
                  "lat": 42.1766
                },
                {
                  "lon": 83.7085,
                  "lat": 42.1766
                }
              ],
              [
                {
                  "lon": 86.3959,
                  "lat": 42.716
                },
                {
                  "lon": 86.1511,
                  "lat": 42.716
                },
                {
                  "lon": 86.1511,
                  "lat": 42.5362
                },
                {
                  "lon": 86.6407,
                  "lat": 42.5362
                },
                {
                  "lon": 86.6407,
                  "lat": 42.716
                },
                {
                  "lon": 86.3959,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 102.2405,
                  "lat": 35.1644
                },
                {
                  "lon": 102.0205,
                  "lat": 35.1644
                },
                {
                  "lon": 102.0205,
                  "lat": 34.9846
                },
                {
                  "lon": 103.3405,
                  "lat": 34.9846
                },
                {
                  "lon": 103.3405,
                  "lat": 35.1644
                },
                {
                  "lon": 102.2405,
                  "lat": 35.1644
                }
              ],
              [
                {
                  "lon": 83.9512,
                  "lat": 42.1766
                },
                {
                  "lon": 84.4366,
                  "lat": 42.1766
                },
                {
                  "lon": 84.4366,
                  "lat": 41.9968
                },
                {
                  "lon": 83.9512,
                  "lat": 41.9968
                },
                {
                  "lon": 83.9512,
                  "lat": 42.1766
                }
              ],
              [
                {
                  "lon": 80.7926,
                  "lat": 40.918
                },
                {
                  "lon": 80.7926,
                  "lat": 40.7382
                },
                {
                  "lon": 80.5546,
                  "lat": 40.7382
                },
                {
                  "lon": 80.5546,
                  "lat": 40.918
                },
                {
                  "lon": 80.7926,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 86.3556,
                  "lat": 41.0978
                },
                {
                  "lon": 86.3556,
                  "lat": 40.918
                },
                {
                  "lon": 86.1169,
                  "lat": 40.918
                },
                {
                  "lon": 86.1169,
                  "lat": 41.0978
                },
                {
                  "lon": 86.3556,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 103.1223,
                  "lat": 25.635
                },
                {
                  "lon": 103.3218,
                  "lat": 25.635
                },
                {
                  "lon": 103.3218,
                  "lat": 25.4552
                },
                {
                  "lon": 102.1248,
                  "lat": 25.4552
                },
                {
                  "lon": 102.1248,
                  "lat": 25.635
                },
                {
                  "lon": 103.1223,
                  "lat": 25.635
                }
              ],
              [
                {
                  "lon": 116.428,
                  "lat": 28.6916
                },
                {
                  "lon": 116.428,
                  "lat": 28.8714
                },
                {
                  "lon": 116.6334,
                  "lat": 28.8714
                },
                {
                  "lon": 116.6334,
                  "lat": 28.6916
                },
                {
                  "lon": 116.428,
                  "lat": 28.6916
                }
              ],
              [
                {
                  "lon": 111.6099,
                  "lat": 28.332
                },
                {
                  "lon": 110.997,
                  "lat": 28.332
                },
                {
                  "lon": 110.997,
                  "lat": 28.1522
                },
                {
                  "lon": 111.6099,
                  "lat": 28.1522
                },
                {
                  "lon": 111.6099,
                  "lat": 28.332
                }
              ],
              [
                {
                  "lon": 111.4593,
                  "lat": 27.6128
                },
                {
                  "lon": 111.0533,
                  "lat": 27.6128
                },
                {
                  "lon": 111.0533,
                  "lat": 27.433
                },
                {
                  "lon": 113.2863,
                  "lat": 27.433
                },
                {
                  "lon": 113.2863,
                  "lat": 27.6128
                },
                {
                  "lon": 111.4593,
                  "lat": 27.6128
                }
              ],
              [
                {
                  "lon": 106.0307,
                  "lat": 37.1422
                },
                {
                  "lon": 105.5783,
                  "lat": 37.1422
                },
                {
                  "lon": 105.5783,
                  "lat": 37.322
                },
                {
                  "lon": 106.2569,
                  "lat": 37.322
                },
                {
                  "lon": 106.2569,
                  "lat": 37.1422
                },
                {
                  "lon": 106.0307,
                  "lat": 37.1422
                }
              ],
              [
                {
                  "lon": 114.5595,
                  "lat": 24.5562
                },
                {
                  "lon": 114.7572,
                  "lat": 24.5562
                },
                {
                  "lon": 114.7572,
                  "lat": 24.3764
                },
                {
                  "lon": 114.3618,
                  "lat": 24.3764
                },
                {
                  "lon": 114.3618,
                  "lat": 24.5562
                },
                {
                  "lon": 114.5595,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 116.1999,
                  "lat": 23.837
                },
                {
                  "lon": 115.6101,
                  "lat": 23.837
                },
                {
                  "lon": 115.6101,
                  "lat": 23.6572
                },
                {
                  "lon": 117.9693,
                  "lat": 23.6572
                },
                {
                  "lon": 117.9693,
                  "lat": 23.837
                },
                {
                  "lon": 116.1999,
                  "lat": 23.837
                }
              ],
              [
                {
                  "lon": 107.6881,
                  "lat": 30.4896
                },
                {
                  "lon": 107.2699,
                  "lat": 30.4896
                },
                {
                  "lon": 107.2699,
                  "lat": 30.6694
                },
                {
                  "lon": 108.7336,
                  "lat": 30.6694
                },
                {
                  "lon": 108.7336,
                  "lat": 30.4896
                },
                {
                  "lon": 107.6881,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 111.085,
                  "lat": 38.0412
                },
                {
                  "lon": 111.085,
                  "lat": 37.8614
                },
                {
                  "lon": 110.6282,
                  "lat": 37.8614
                },
                {
                  "lon": 110.6282,
                  "lat": 38.0412
                },
                {
                  "lon": 111.085,
                  "lat": 38.0412
                }
              ],
              [
                {
                  "lon": 109.4339,
                  "lat": 23.4774
                },
                {
                  "lon": 109.4339,
                  "lat": 23.6572
                },
                {
                  "lon": 109.2376,
                  "lat": 23.6572
                },
                {
                  "lon": 109.2376,
                  "lat": 23.4774
                },
                {
                  "lon": 109.4339,
                  "lat": 23.4774
                }
              ],
              [
                {
                  "lon": 121.7616,
                  "lat": 38.7604
                },
                {
                  "lon": 121.7616,
                  "lat": 38.5806
                },
                {
                  "lon": 121.3004,
                  "lat": 38.5806
                },
                {
                  "lon": 121.3004,
                  "lat": 38.7604
                },
                {
                  "lon": 121.7616,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 122.2975,
                  "lat": 36.6028
                },
                {
                  "lon": 122.7467,
                  "lat": 36.6028
                },
                {
                  "lon": 122.7467,
                  "lat": 36.7826
                },
                {
                  "lon": 122.0729,
                  "lat": 36.7826
                },
                {
                  "lon": 122.0729,
                  "lat": 36.6028
                },
                {
                  "lon": 122.2975,
                  "lat": 36.6028
                }
              ],
              [
                {
                  "lon": 124.9469,
                  "lat": 46.8514
                },
                {
                  "lon": 125.4729,
                  "lat": 46.8514
                },
                {
                  "lon": 125.4729,
                  "lat": 46.6716
                },
                {
                  "lon": 124.6839,
                  "lat": 46.6716
                },
                {
                  "lon": 124.6839,
                  "lat": 46.8514
                },
                {
                  "lon": 124.9469,
                  "lat": 46.8514
                }
              ],
              [
                {
                  "lon": 95.9717,
                  "lat": 37.1422
                },
                {
                  "lon": 95.9717,
                  "lat": 36.9624
                },
                {
                  "lon": 95.7461,
                  "lat": 36.9624
                },
                {
                  "lon": 95.7461,
                  "lat": 37.1422
                },
                {
                  "lon": 95.9717,
                  "lat": 37.1422
                }
              ],
              [
                {
                  "lon": 112.966,
                  "lat": 35.524
                },
                {
                  "lon": 112.523,
                  "lat": 35.524
                },
                {
                  "lon": 112.523,
                  "lat": 35.7038
                },
                {
                  "lon": 113.1875,
                  "lat": 35.7038
                },
                {
                  "lon": 113.1875,
                  "lat": 35.524
                },
                {
                  "lon": 112.966,
                  "lat": 35.524
                }
              ],
              [
                {
                  "lon": 108.7708,
                  "lat": 29.7704
                },
                {
                  "lon": 108.5632,
                  "lat": 29.7704
                },
                {
                  "lon": 108.5632,
                  "lat": 29.9502
                },
                {
                  "lon": 108.9784,
                  "lat": 29.9502
                },
                {
                  "lon": 108.9784,
                  "lat": 29.7704
                },
                {
                  "lon": 108.7708,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 82.7473,
                  "lat": 41.4574
                },
                {
                  "lon": 82.2661,
                  "lat": 41.4574
                },
                {
                  "lon": 82.2661,
                  "lat": 41.6372
                },
                {
                  "lon": 83.7097,
                  "lat": 41.6372
                },
                {
                  "lon": 83.7097,
                  "lat": 41.4574
                },
                {
                  "lon": 82.7473,
                  "lat": 41.4574
                }
              ],
              [
                {
                  "lon": 89.7279,
                  "lat": 43.2554
                },
                {
                  "lon": 89.4802,
                  "lat": 43.2554
                },
                {
                  "lon": 89.4802,
                  "lat": 43.4352
                },
                {
                  "lon": 90.2233,
                  "lat": 43.4352
                },
                {
                  "lon": 90.2233,
                  "lat": 43.2554
                },
                {
                  "lon": 89.7279,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 97.9599,
                  "lat": 29.4108
                },
                {
                  "lon": 97.9599,
                  "lat": 29.231
                },
                {
                  "lon": 97.7534,
                  "lat": 29.231
                },
                {
                  "lon": 97.7534,
                  "lat": 29.4108
                },
                {
                  "lon": 97.9599,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 81.5066,
                  "lat": 40.7382
                },
                {
                  "lon": 81.0306,
                  "lat": 40.7382
                },
                {
                  "lon": 81.0306,
                  "lat": 40.918
                },
                {
                  "lon": 81.5066,
                  "lat": 40.918
                },
                {
                  "lon": 81.5066,
                  "lat": 40.7382
                }
              ],
              [
                {
                  "lon": 108.8257,
                  "lat": 31.2088
                },
                {
                  "lon": 107.9845,
                  "lat": 31.2088
                },
                {
                  "lon": 107.9845,
                  "lat": 31.029
                },
                {
                  "lon": 109.036,
                  "lat": 31.029
                },
                {
                  "lon": 109.036,
                  "lat": 31.2088
                },
                {
                  "lon": 108.8257,
                  "lat": 31.2088
                }
              ],
              [
                {
                  "lon": 86.2032,
                  "lat": 41.6372
                },
                {
                  "lon": 86.9271,
                  "lat": 41.6372
                },
                {
                  "lon": 86.9271,
                  "lat": 41.817
                },
                {
                  "lon": 86.2032,
                  "lat": 41.817
                },
                {
                  "lon": 86.2032,
                  "lat": 41.6372
                }
              ],
              [
                {
                  "lon": 86.7785,
                  "lat": 43.9746
                },
                {
                  "lon": 88.2779,
                  "lat": 43.9746
                },
                {
                  "lon": 88.2779,
                  "lat": 43.7948
                },
                {
                  "lon": 86.5286,
                  "lat": 43.7948
                },
                {
                  "lon": 86.5286,
                  "lat": 43.9746
                },
                {
                  "lon": 86.7785,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 100.6761,
                  "lat": 38.221
                },
                {
                  "lon": 101.1339,
                  "lat": 38.221
                },
                {
                  "lon": 101.1339,
                  "lat": 38.0412
                },
                {
                  "lon": 100.6761,
                  "lat": 38.0412
                },
                {
                  "lon": 100.6761,
                  "lat": 38.221
                }
              ],
              [
                {
                  "lon": 106.0084,
                  "lat": 27.0734
                },
                {
                  "lon": 105.8061,
                  "lat": 27.0734
                },
                {
                  "lon": 105.8061,
                  "lat": 27.2532
                },
                {
                  "lon": 106.0084,
                  "lat": 27.2532
                },
                {
                  "lon": 106.0084,
                  "lat": 27.0734
                }
              ],
              [
                {
                  "lon": 98.7747,
                  "lat": 40.3786
                },
                {
                  "lon": 98.7747,
                  "lat": 40.1988
                },
                {
                  "lon": 99.2469,
                  "lat": 40.1988
                },
                {
                  "lon": 99.2469,
                  "lat": 40.3786
                },
                {
                  "lon": 98.7747,
                  "lat": 40.3786
                }
              ],
              [
                {
                  "lon": 99.9686,
                  "lat": 38.7604
                },
                {
                  "lon": 99.9686,
                  "lat": 38.9402
                },
                {
                  "lon": 101.587,
                  "lat": 38.9402
                },
                {
                  "lon": 101.587,
                  "lat": 38.7604
                },
                {
                  "lon": 99.9686,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 82.4378,
                  "lat": 44.1544
                },
                {
                  "lon": 82.1864,
                  "lat": 44.1544
                },
                {
                  "lon": 82.1864,
                  "lat": 44.3342
                },
                {
                  "lon": 82.4378,
                  "lat": 44.3342
                },
                {
                  "lon": 82.4378,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 129.0266,
                  "lat": 42.3564
                },
                {
                  "lon": 128.5384,
                  "lat": 42.3564
                },
                {
                  "lon": 128.5384,
                  "lat": 42.5362
                },
                {
                  "lon": 129.7589,
                  "lat": 42.5362
                },
                {
                  "lon": 129.7589,
                  "lat": 42.3564
                },
                {
                  "lon": 129.0266,
                  "lat": 42.3564
                }
              ],
              [
                {
                  "lon": 116.5312,
                  "lat": 43.2554
                },
                {
                  "lon": 115.7905,
                  "lat": 43.2554
                },
                {
                  "lon": 115.7905,
                  "lat": 43.0756
                },
                {
                  "lon": 116.5312,
                  "lat": 43.0756
                },
                {
                  "lon": 116.5312,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 104.6184,
                  "lat": 32.827
                },
                {
                  "lon": 105.0464,
                  "lat": 32.827
                },
                {
                  "lon": 105.0464,
                  "lat": 32.6472
                },
                {
                  "lon": 104.4044,
                  "lat": 32.6472
                },
                {
                  "lon": 104.4044,
                  "lat": 32.827
                },
                {
                  "lon": 104.6184,
                  "lat": 32.827
                }
              ],
              [
                {
                  "lon": 123.9297,
                  "lat": 47.9302
                },
                {
                  "lon": 123.9297,
                  "lat": 48.11
                },
                {
                  "lon": 122.3133,
                  "lat": 48.11
                },
                {
                  "lon": 122.3133,
                  "lat": 47.9302
                },
                {
                  "lon": 123.9297,
                  "lat": 47.9302
                }
              ],
              [
                {
                  "lon": 80.8922,
                  "lat": 45.2332
                },
                {
                  "lon": 80.8922,
                  "lat": 45.413
                },
                {
                  "lon": 81.1484,
                  "lat": 45.413
                },
                {
                  "lon": 81.1484,
                  "lat": 45.2332
                },
                {
                  "lon": 80.8922,
                  "lat": 45.2332
                }
              ],
              [
                {
                  "lon": 109.6763,
                  "lat": 30.4896
                },
                {
                  "lon": 109.6763,
                  "lat": 30.3098
                },
                {
                  "lon": 108.8415,
                  "lat": 30.3098
                },
                {
                  "lon": 108.8415,
                  "lat": 30.4896
                },
                {
                  "lon": 109.6763,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 122.3268,
                  "lat": 44.6938
                },
                {
                  "lon": 121.8208,
                  "lat": 44.6938
                },
                {
                  "lon": 121.8208,
                  "lat": 44.514
                },
                {
                  "lon": 122.5798,
                  "lat": 44.514
                },
                {
                  "lon": 122.5798,
                  "lat": 44.6938
                },
                {
                  "lon": 122.3268,
                  "lat": 44.6938
                }
              ],
              [
                {
                  "lon": 122.5799,
                  "lat": 46.8514
                },
                {
                  "lon": 124.1579,
                  "lat": 46.8514
                },
                {
                  "lon": 124.1579,
                  "lat": 46.6716
                },
                {
                  "lon": 122.3169,
                  "lat": 46.6716
                },
                {
                  "lon": 122.3169,
                  "lat": 46.8514
                },
                {
                  "lon": 122.5799,
                  "lat": 46.8514
                }
              ],
              [
                {
                  "lon": 98.3765,
                  "lat": 36.423
                },
                {
                  "lon": 97.4805,
                  "lat": 36.423
                },
                {
                  "lon": 97.4805,
                  "lat": 36.6028
                },
                {
                  "lon": 98.3765,
                  "lat": 36.6028
                },
                {
                  "lon": 98.3765,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 123.7846,
                  "lat": 39.6594
                },
                {
                  "lon": 123.7846,
                  "lat": 39.4796
                },
                {
                  "lon": 124.719,
                  "lat": 39.4796
                },
                {
                  "lon": 124.719,
                  "lat": 39.6594
                },
                {
                  "lon": 123.7846,
                  "lat": 39.6594
                }
              ],
              [
                {
                  "lon": 126.3875,
                  "lat": 43.2554
                },
                {
                  "lon": 126.6352,
                  "lat": 43.2554
                },
                {
                  "lon": 126.6352,
                  "lat": 43.4352
                },
                {
                  "lon": 126.3875,
                  "lat": 43.4352
                },
                {
                  "lon": 126.3875,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 105.1992,
                  "lat": 27.2532
                },
                {
                  "lon": 105.6038,
                  "lat": 27.2532
                },
                {
                  "lon": 105.6038,
                  "lat": 27.0734
                },
                {
                  "lon": 104.9969,
                  "lat": 27.0734
                },
                {
                  "lon": 104.9969,
                  "lat": 27.2532
                },
                {
                  "lon": 105.1992,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 108.8095,
                  "lat": 24.0168
                },
                {
                  "lon": 108.6126,
                  "lat": 24.0168
                },
                {
                  "lon": 108.6126,
                  "lat": 23.837
                },
                {
                  "lon": 109.5971,
                  "lat": 23.837
                },
                {
                  "lon": 109.5971,
                  "lat": 24.0168
                },
                {
                  "lon": 108.8095,
                  "lat": 24.0168
                }
              ],
              [
                {
                  "lon": 116.6403,
                  "lat": 27.0734
                },
                {
                  "lon": 116.8423,
                  "lat": 27.0734
                },
                {
                  "lon": 116.8423,
                  "lat": 26.8936
                },
                {
                  "lon": 116.2363,
                  "lat": 26.8936
                },
                {
                  "lon": 116.2363,
                  "lat": 27.0734
                },
                {
                  "lon": 116.6403,
                  "lat": 27.0734
                }
              ],
              [
                {
                  "lon": 119.8795,
                  "lat": 43.4352
                },
                {
                  "lon": 119.3827,
                  "lat": 43.4352
                },
                {
                  "lon": 119.3827,
                  "lat": 43.615
                },
                {
                  "lon": 120.1279,
                  "lat": 43.615
                },
                {
                  "lon": 120.1279,
                  "lat": 43.4352
                },
                {
                  "lon": 119.8795,
                  "lat": 43.4352
                }
              ],
              [
                {
                  "lon": 86.8092,
                  "lat": 44.514
                },
                {
                  "lon": 88.3224,
                  "lat": 44.514
                },
                {
                  "lon": 88.3224,
                  "lat": 44.3342
                },
                {
                  "lon": 86.557,
                  "lat": 44.3342
                },
                {
                  "lon": 86.557,
                  "lat": 44.514
                },
                {
                  "lon": 86.8092,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 96.9456,
                  "lat": 30.3098
                },
                {
                  "lon": 96.7369,
                  "lat": 30.3098
                },
                {
                  "lon": 96.7369,
                  "lat": 30.4896
                },
                {
                  "lon": 96.9456,
                  "lat": 30.4896
                },
                {
                  "lon": 96.9456,
                  "lat": 30.3098
                }
              ],
              [
                {
                  "lon": 123.211,
                  "lat": 45.0534
                },
                {
                  "lon": 123.211,
                  "lat": 45.2332
                },
                {
                  "lon": 122.4448,
                  "lat": 45.2332
                },
                {
                  "lon": 122.4448,
                  "lat": 45.0534
                },
                {
                  "lon": 123.211,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 131.5106,
                  "lat": 43.9746
                },
                {
                  "lon": 130.7609,
                  "lat": 43.9746
                },
                {
                  "lon": 130.7609,
                  "lat": 43.7948
                },
                {
                  "lon": 131.5106,
                  "lat": 43.7948
                },
                {
                  "lon": 131.5106,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 97.904,
                  "lat": 35.524
                },
                {
                  "lon": 97.904,
                  "lat": 35.7038
                },
                {
                  "lon": 98.347,
                  "lat": 35.7038
                },
                {
                  "lon": 98.347,
                  "lat": 35.524
                },
                {
                  "lon": 97.904,
                  "lat": 35.524
                }
              ],
              [
                {
                  "lon": 98.9236,
                  "lat": 39.12
                },
                {
                  "lon": 98.9236,
                  "lat": 38.9402
                },
                {
                  "lon": 99.3872,
                  "lat": 38.9402
                },
                {
                  "lon": 99.3872,
                  "lat": 39.12
                },
                {
                  "lon": 98.9236,
                  "lat": 39.12
                }
              ],
              [
                {
                  "lon": 108.4299,
                  "lat": 25.2754
                },
                {
                  "lon": 108.4299,
                  "lat": 25.4552
                },
                {
                  "lon": 107.4339,
                  "lat": 25.4552
                },
                {
                  "lon": 107.4339,
                  "lat": 25.2754
                },
                {
                  "lon": 108.4299,
                  "lat": 25.2754
                }
              ],
              [
                {
                  "lon": 109.2005,
                  "lat": 35.7038
                },
                {
                  "lon": 108.979,
                  "lat": 35.7038
                },
                {
                  "lon": 108.979,
                  "lat": 35.524
                },
                {
                  "lon": 109.2005,
                  "lat": 35.524
                },
                {
                  "lon": 109.2005,
                  "lat": 35.7038
                }
              ],
              [
                {
                  "lon": 127.9722,
                  "lat": 42.716
                },
                {
                  "lon": 127.4812,
                  "lat": 42.716
                },
                {
                  "lon": 127.4812,
                  "lat": 42.8958
                },
                {
                  "lon": 127.9722,
                  "lat": 42.8958
                },
                {
                  "lon": 127.9722,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 108.4924,
                  "lat": 31.7482
                },
                {
                  "lon": 109.7614,
                  "lat": 31.7482
                },
                {
                  "lon": 109.7614,
                  "lat": 31.5684
                },
                {
                  "lon": 108.4924,
                  "lat": 31.5684
                },
                {
                  "lon": 108.4924,
                  "lat": 31.7482
                }
              ],
              [
                {
                  "lon": 129.9703,
                  "lat": 42.716
                },
                {
                  "lon": 129.9703,
                  "lat": 42.5362
                },
                {
                  "lon": 130.7047,
                  "lat": 42.5362
                },
                {
                  "lon": 130.7047,
                  "lat": 42.716
                },
                {
                  "lon": 129.9703,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 88.7777,
                  "lat": 43.9746
                },
                {
                  "lon": 88.7777,
                  "lat": 43.7948
                },
                {
                  "lon": 89.5274,
                  "lat": 43.7948
                },
                {
                  "lon": 89.5274,
                  "lat": 43.9746
                },
                {
                  "lon": 88.7777,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 109.943,
                  "lat": 37.8614
                },
                {
                  "lon": 110.3998,
                  "lat": 37.8614
                },
                {
                  "lon": 110.3998,
                  "lat": 38.0412
                },
                {
                  "lon": 108.5726,
                  "lat": 38.0412
                },
                {
                  "lon": 108.5726,
                  "lat": 37.8614
                },
                {
                  "lon": 109.943,
                  "lat": 37.8614
                }
              ],
              [
                {
                  "lon": 120.8327,
                  "lat": 43.7948
                },
                {
                  "lon": 120.8327,
                  "lat": 43.615
                },
                {
                  "lon": 121.5803,
                  "lat": 43.615
                },
                {
                  "lon": 121.5803,
                  "lat": 43.7948
                },
                {
                  "lon": 120.8327,
                  "lat": 43.7948
                }
              ],
              [
                {
                  "lon": 113.9527,
                  "lat": 41.817
                },
                {
                  "lon": 112.7462,
                  "lat": 41.817
                },
                {
                  "lon": 112.7462,
                  "lat": 41.6372
                },
                {
                  "lon": 113.9527,
                  "lat": 41.6372
                },
                {
                  "lon": 113.9527,
                  "lat": 41.817
                }
              ],
              [
                {
                  "lon": 113.5423,
                  "lat": 29.0512
                },
                {
                  "lon": 113.5423,
                  "lat": 29.231
                },
                {
                  "lon": 114.1606,
                  "lat": 29.231
                },
                {
                  "lon": 114.1606,
                  "lat": 29.0512
                },
                {
                  "lon": 113.5423,
                  "lat": 29.0512
                }
              ],
              [
                {
                  "lon": 108.4785,
                  "lat": 31.928
                },
                {
                  "lon": 108.2662,
                  "lat": 31.928
                },
                {
                  "lon": 108.2662,
                  "lat": 32.1078
                },
                {
                  "lon": 109.1154,
                  "lat": 32.1078
                },
                {
                  "lon": 109.1154,
                  "lat": 31.928
                },
                {
                  "lon": 108.4785,
                  "lat": 31.928
                }
              ],
              [
                {
                  "lon": 109.9701,
                  "lat": 40.1988
                },
                {
                  "lon": 109.7346,
                  "lat": 40.1988
                },
                {
                  "lon": 109.7346,
                  "lat": 40.019
                },
                {
                  "lon": 110.2056,
                  "lat": 40.019
                },
                {
                  "lon": 110.2056,
                  "lat": 40.1988
                },
                {
                  "lon": 109.9701,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 79.3789,
                  "lat": 41.6372
                },
                {
                  "lon": 79.1383,
                  "lat": 41.6372
                },
                {
                  "lon": 79.1383,
                  "lat": 41.4574
                },
                {
                  "lon": 79.3789,
                  "lat": 41.4574
                },
                {
                  "lon": 79.3789,
                  "lat": 41.6372
                }
              ],
              [
                {
                  "lon": 88.9351,
                  "lat": 43.7948
                },
                {
                  "lon": 89.4335,
                  "lat": 43.7948
                },
                {
                  "lon": 89.4335,
                  "lat": 43.615
                },
                {
                  "lon": 88.9351,
                  "lat": 43.615
                },
                {
                  "lon": 88.9351,
                  "lat": 43.7948
                }
              ],
              [
                {
                  "lon": 113.0945,
                  "lat": 35.8836
                },
                {
                  "lon": 113.3165,
                  "lat": 35.8836
                },
                {
                  "lon": 113.3165,
                  "lat": 35.7038
                },
                {
                  "lon": 112.6505,
                  "lat": 35.7038
                },
                {
                  "lon": 112.6505,
                  "lat": 35.8836
                },
                {
                  "lon": 113.0945,
                  "lat": 35.8836
                }
              ],
              [
                {
                  "lon": 108.3666,
                  "lat": 38.221
                },
                {
                  "lon": 108.3666,
                  "lat": 38.4008
                },
                {
                  "lon": 109.0551,
                  "lat": 38.4008
                },
                {
                  "lon": 109.0551,
                  "lat": 38.221
                },
                {
                  "lon": 108.3666,
                  "lat": 38.221
                }
              ],
              [
                {
                  "lon": 83.3015,
                  "lat": 42.3564
                },
                {
                  "lon": 82.8147,
                  "lat": 42.3564
                },
                {
                  "lon": 82.8147,
                  "lat": 42.1766
                },
                {
                  "lon": 84.0317,
                  "lat": 42.1766
                },
                {
                  "lon": 84.0317,
                  "lat": 42.3564
                },
                {
                  "lon": 83.3015,
                  "lat": 42.3564
                }
              ],
              [
                {
                  "lon": 110.4411,
                  "lat": 40.019
                },
                {
                  "lon": 110.6766,
                  "lat": 40.019
                },
                {
                  "lon": 110.6766,
                  "lat": 40.1988
                },
                {
                  "lon": 110.4411,
                  "lat": 40.1988
                },
                {
                  "lon": 110.4411,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 104.6613,
                  "lat": 37.5018
                },
                {
                  "lon": 105.1157,
                  "lat": 37.5018
                },
                {
                  "lon": 105.1157,
                  "lat": 37.6816
                },
                {
                  "lon": 104.2069,
                  "lat": 37.6816
                },
                {
                  "lon": 104.2069,
                  "lat": 37.5018
                },
                {
                  "lon": 104.6613,
                  "lat": 37.5018
                }
              ],
              [
                {
                  "lon": 114.0171,
                  "lat": 24.1966
                },
                {
                  "lon": 113.8199,
                  "lat": 24.1966
                },
                {
                  "lon": 113.8199,
                  "lat": 24.0168
                },
                {
                  "lon": 114.0171,
                  "lat": 24.0168
                },
                {
                  "lon": 114.0171,
                  "lat": 24.1966
                }
              ],
              [
                {
                  "lon": 116.1048,
                  "lat": 29.0512
                },
                {
                  "lon": 115.6934,
                  "lat": 29.0512
                },
                {
                  "lon": 115.6934,
                  "lat": 28.8714
                },
                {
                  "lon": 116.3105,
                  "lat": 28.8714
                },
                {
                  "lon": 116.3105,
                  "lat": 29.0512
                },
                {
                  "lon": 116.1048,
                  "lat": 29.0512
                }
              ],
              [
                {
                  "lon": 111.514,
                  "lat": 28.332
                },
                {
                  "lon": 111.3093,
                  "lat": 28.332
                },
                {
                  "lon": 111.3093,
                  "lat": 28.5118
                },
                {
                  "lon": 111.514,
                  "lat": 28.5118
                },
                {
                  "lon": 111.514,
                  "lat": 28.332
                }
              ],
              [
                {
                  "lon": 123.6913,
                  "lat": 43.2554
                },
                {
                  "lon": 123.4444,
                  "lat": 43.2554
                },
                {
                  "lon": 123.4444,
                  "lat": 43.0756
                },
                {
                  "lon": 123.6913,
                  "lat": 43.0756
                },
                {
                  "lon": 123.6913,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 116.0343,
                  "lat": 24.5562
                },
                {
                  "lon": 116.2323,
                  "lat": 24.5562
                },
                {
                  "lon": 116.2323,
                  "lat": 24.736
                },
                {
                  "lon": 116.0343,
                  "lat": 24.736
                },
                {
                  "lon": 116.0343,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 104.7483,
                  "lat": 24.5562
                },
                {
                  "lon": 104.7483,
                  "lat": 24.736
                },
                {
                  "lon": 105.1443,
                  "lat": 24.736
                },
                {
                  "lon": 105.1443,
                  "lat": 24.5562
                },
                {
                  "lon": 104.7483,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 94.4945,
                  "lat": 35.3442
                },
                {
                  "lon": 94.0525,
                  "lat": 35.3442
                },
                {
                  "lon": 94.0525,
                  "lat": 35.524
                },
                {
                  "lon": 94.4945,
                  "lat": 35.524
                },
                {
                  "lon": 94.4945,
                  "lat": 35.3442
                }
              ],
              [
                {
                  "lon": 109.1975,
                  "lat": 37.1422
                },
                {
                  "lon": 108.9713,
                  "lat": 37.1422
                },
                {
                  "lon": 108.9713,
                  "lat": 37.322
                },
                {
                  "lon": 109.1975,
                  "lat": 37.322
                },
                {
                  "lon": 109.1975,
                  "lat": 37.1422
                }
              ],
              [
                {
                  "lon": 112.3983,
                  "lat": 27.0734
                },
                {
                  "lon": 112.3983,
                  "lat": 26.8936
                },
                {
                  "lon": 112.1963,
                  "lat": 26.8936
                },
                {
                  "lon": 112.1963,
                  "lat": 27.0734
                },
                {
                  "lon": 112.3983,
                  "lat": 27.0734
                }
              ],
              [
                {
                  "lon": 109.2651,
                  "lat": 25.0956
                },
                {
                  "lon": 109.2651,
                  "lat": 24.9158
                },
                {
                  "lon": 109.0665,
                  "lat": 24.9158
                },
                {
                  "lon": 109.0665,
                  "lat": 25.0956
                },
                {
                  "lon": 109.2651,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 96.8672,
                  "lat": 30.3098
                },
                {
                  "lon": 96.2423,
                  "lat": 30.3098
                },
                {
                  "lon": 96.2423,
                  "lat": 30.13
                },
                {
                  "lon": 97.2838,
                  "lat": 30.13
                },
                {
                  "lon": 97.2838,
                  "lat": 30.3098
                },
                {
                  "lon": 96.8672,
                  "lat": 30.3098
                }
              ],
              [
                {
                  "lon": 109.9102,
                  "lat": 38.7604
                },
                {
                  "lon": 109.9102,
                  "lat": 38.9402
                },
                {
                  "lon": 109.2166,
                  "lat": 38.9402
                },
                {
                  "lon": 109.2166,
                  "lat": 38.7604
                },
                {
                  "lon": 109.9102,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 106.3679,
                  "lat": 37.322
                },
                {
                  "lon": 106.1412,
                  "lat": 37.322
                },
                {
                  "lon": 106.1412,
                  "lat": 37.5018
                },
                {
                  "lon": 106.3679,
                  "lat": 37.5018
                },
                {
                  "lon": 106.3679,
                  "lat": 37.322
                }
              ],
              [
                {
                  "lon": 87.397,
                  "lat": 43.0756
                },
                {
                  "lon": 87.397,
                  "lat": 43.2554
                },
                {
                  "lon": 87.1501,
                  "lat": 43.2554
                },
                {
                  "lon": 87.1501,
                  "lat": 43.0756
                },
                {
                  "lon": 87.397,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 88.3846,
                  "lat": 43.2554
                },
                {
                  "lon": 88.6315,
                  "lat": 43.2554
                },
                {
                  "lon": 88.6315,
                  "lat": 43.0756
                },
                {
                  "lon": 87.8908,
                  "lat": 43.0756
                },
                {
                  "lon": 87.8908,
                  "lat": 43.2554
                },
                {
                  "lon": 88.3846,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 83.2799,
                  "lat": 43.9746
                },
                {
                  "lon": 83.2799,
                  "lat": 43.7948
                },
                {
                  "lon": 83.5298,
                  "lat": 43.7948
                },
                {
                  "lon": 83.5298,
                  "lat": 43.9746
                },
                {
                  "lon": 83.2799,
                  "lat": 43.9746
                }
              ]
            ],
            "dmScopes": [
              [
                {
                  "lon": 89.2325,
                  "lat": 43.4352
                },
                {
                  "lon": 90.2233,
                  "lat": 43.4352
                },
                {
                  "lon": 90.2233,
                  "lat": 43.2554
                },
                {
                  "lon": 86.7555,
                  "lat": 43.2554
                },
                {
                  "lon": 86.7555,
                  "lat": 43.4352
                },
                {
                  "lon": 89.2325,
                  "lat": 43.4352
                }
              ],
              [
                {
                  "lon": 116.0175,
                  "lat": 25.0956
                },
                {
                  "lon": 114.0315,
                  "lat": 25.0956
                },
                {
                  "lon": 114.0315,
                  "lat": 24.9158
                },
                {
                  "lon": 116.2161,
                  "lat": 24.9158
                },
                {
                  "lon": 116.2161,
                  "lat": 25.0956
                },
                {
                  "lon": 116.0175,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 117.1496,
                  "lat": 38.5806
                },
                {
                  "lon": 118.7638,
                  "lat": 38.5806
                },
                {
                  "lon": 118.7638,
                  "lat": 38.7604
                },
                {
                  "lon": 108.6174,
                  "lat": 38.7604
                },
                {
                  "lon": 108.6174,
                  "lat": 38.5806
                },
                {
                  "lon": 117.1496,
                  "lat": 38.5806
                }
              ],
              [
                {
                  "lon": 83.7922,
                  "lat": 44.8736
                },
                {
                  "lon": 83.7922,
                  "lat": 45.0534
                },
                {
                  "lon": 86.0836,
                  "lat": 45.0534
                },
                {
                  "lon": 86.0836,
                  "lat": 44.8736
                },
                {
                  "lon": 83.7922,
                  "lat": 44.8736
                }
              ],
              [
                {
                  "lon": 108.6358,
                  "lat": 40.019
                },
                {
                  "lon": 107.6966,
                  "lat": 40.019
                },
                {
                  "lon": 107.6966,
                  "lat": 39.8392
                },
                {
                  "lon": 120.6106,
                  "lat": 39.8392
                },
                {
                  "lon": 120.6106,
                  "lat": 40.019
                },
                {
                  "lon": 108.6358,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 118.0175,
                  "lat": 34.8048
                },
                {
                  "lon": 120.4265,
                  "lat": 34.8048
                },
                {
                  "lon": 120.4265,
                  "lat": 34.625
                },
                {
                  "lon": 102.4685,
                  "lat": 34.625
                },
                {
                  "lon": 102.4685,
                  "lat": 34.8048
                },
                {
                  "lon": 118.0175,
                  "lat": 34.8048
                }
              ],
              [
                {
                  "lon": 103.1643,
                  "lat": 24.736
                },
                {
                  "lon": 103.1643,
                  "lat": 24.5562
                },
                {
                  "lon": 101.9763,
                  "lat": 24.5562
                },
                {
                  "lon": 101.9763,
                  "lat": 24.736
                },
                {
                  "lon": 103.1643,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 95.9125,
                  "lat": 36.423
                },
                {
                  "lon": 94.3445,
                  "lat": 36.423
                },
                {
                  "lon": 94.3445,
                  "lat": 36.6028
                },
                {
                  "lon": 96.3605,
                  "lat": 36.6028
                },
                {
                  "lon": 96.3605,
                  "lat": 36.423
                },
                {
                  "lon": 95.9125,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 110.9524,
                  "lat": 33.0068
                },
                {
                  "lon": 110.7379,
                  "lat": 33.0068
                },
                {
                  "lon": 110.7379,
                  "lat": 32.827
                },
                {
                  "lon": 121.6774,
                  "lat": 32.827
                },
                {
                  "lon": 121.6774,
                  "lat": 33.0068
                },
                {
                  "lon": 110.9524,
                  "lat": 33.0068
                }
              ],
              [
                {
                  "lon": 107.0854,
                  "lat": 28.5118
                },
                {
                  "lon": 109.5454,
                  "lat": 28.5118
                },
                {
                  "lon": 109.5454,
                  "lat": 28.6916
                },
                {
                  "lon": 105.0354,
                  "lat": 28.6916
                },
                {
                  "lon": 105.0354,
                  "lat": 28.5118
                },
                {
                  "lon": 107.0854,
                  "lat": 28.5118
                }
              ],
              [
                {
                  "lon": 115.4021,
                  "lat": 27.433
                },
                {
                  "lon": 117.0229,
                  "lat": 27.433
                },
                {
                  "lon": 117.0229,
                  "lat": 27.2532
                },
                {
                  "lon": 111.1475,
                  "lat": 27.2532
                },
                {
                  "lon": 111.1475,
                  "lat": 27.433
                },
                {
                  "lon": 115.4021,
                  "lat": 27.433
                }
              ],
              [
                {
                  "lon": 81.3429,
                  "lat": 41.0978
                },
                {
                  "lon": 81.5816,
                  "lat": 41.0978
                },
                {
                  "lon": 81.5816,
                  "lat": 40.918
                },
                {
                  "lon": 78.7172,
                  "lat": 40.918
                },
                {
                  "lon": 78.7172,
                  "lat": 41.0978
                },
                {
                  "lon": 81.3429,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 120.4104,
                  "lat": 28.5118
                },
                {
                  "lon": 122.2554,
                  "lat": 28.5118
                },
                {
                  "lon": 122.2554,
                  "lat": 28.6916
                },
                {
                  "lon": 115.2854,
                  "lat": 28.6916
                },
                {
                  "lon": 115.2854,
                  "lat": 28.5118
                },
                {
                  "lon": 120.4104,
                  "lat": 28.5118
                }
              ],
              [
                {
                  "lon": 116.8703,
                  "lat": 24.3764
                },
                {
                  "lon": 115.2903,
                  "lat": 24.3764
                },
                {
                  "lon": 115.2903,
                  "lat": 24.1966
                },
                {
                  "lon": 119.0428,
                  "lat": 24.1966
                },
                {
                  "lon": 119.0428,
                  "lat": 24.3764
                },
                {
                  "lon": 116.8703,
                  "lat": 24.3764
                }
              ],
              [
                {
                  "lon": 116.6596,
                  "lat": 29.7704
                },
                {
                  "lon": 122.68,
                  "lat": 29.7704
                },
                {
                  "lon": 122.68,
                  "lat": 29.9502
                },
                {
                  "lon": 115.414,
                  "lat": 29.9502
                },
                {
                  "lon": 115.414,
                  "lat": 29.7704
                },
                {
                  "lon": 116.6596,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 120.4908,
                  "lat": 45.5928
                },
                {
                  "lon": 133.6386,
                  "lat": 45.5928
                },
                {
                  "lon": 133.6386,
                  "lat": 45.7726
                },
                {
                  "lon": 120.4908,
                  "lat": 45.7726
                },
                {
                  "lon": 120.4908,
                  "lat": 45.5928
                }
              ],
              [
                {
                  "lon": 125.6878,
                  "lat": 49.009
                },
                {
                  "lon": 124.3168,
                  "lat": 49.009
                },
                {
                  "lon": 124.3168,
                  "lat": 48.8292
                },
                {
                  "lon": 127.6072,
                  "lat": 48.8292
                },
                {
                  "lon": 127.6072,
                  "lat": 49.009
                },
                {
                  "lon": 125.6878,
                  "lat": 49.009
                }
              ],
              [
                {
                  "lon": 120.025,
                  "lat": 30.6694
                },
                {
                  "lon": 122.3251,
                  "lat": 30.6694
                },
                {
                  "lon": 122.3251,
                  "lat": 30.4896
                },
                {
                  "lon": 113.5429,
                  "lat": 30.4896
                },
                {
                  "lon": 113.5429,
                  "lat": 30.6694
                },
                {
                  "lon": 120.025,
                  "lat": 30.6694
                }
              ],
              [
                {
                  "lon": 112.5483,
                  "lat": 28.1522
                },
                {
                  "lon": 121.9323,
                  "lat": 28.1522
                },
                {
                  "lon": 121.9323,
                  "lat": 27.9724
                },
                {
                  "lon": 110.1003,
                  "lat": 27.9724
                },
                {
                  "lon": 110.1003,
                  "lat": 28.1522
                },
                {
                  "lon": 112.5483,
                  "lat": 28.1522
                }
              ],
              [
                {
                  "lon": 127.187,
                  "lat": 44.1544
                },
                {
                  "lon": 123.416,
                  "lat": 44.1544
                },
                {
                  "lon": 123.416,
                  "lat": 44.3342
                },
                {
                  "lon": 132.215,
                  "lat": 44.3342
                },
                {
                  "lon": 132.215,
                  "lat": 44.1544
                },
                {
                  "lon": 127.187,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 105.5503,
                  "lat": 33.5462
                },
                {
                  "lon": 121.3329,
                  "lat": 33.5462
                },
                {
                  "lon": 121.3329,
                  "lat": 33.726
                },
                {
                  "lon": 104.0369,
                  "lat": 33.726
                },
                {
                  "lon": 104.0369,
                  "lat": 33.5462
                },
                {
                  "lon": 105.5503,
                  "lat": 33.5462
                }
              ],
              [
                {
                  "lon": 115.0005,
                  "lat": 35.1644
                },
                {
                  "lon": 120.2805,
                  "lat": 35.1644
                },
                {
                  "lon": 120.2805,
                  "lat": 34.9846
                },
                {
                  "lon": 101.8005,
                  "lat": 34.9846
                },
                {
                  "lon": 101.8005,
                  "lat": 35.1644
                },
                {
                  "lon": 115.0005,
                  "lat": 35.1644
                }
              ],
              [
                {
                  "lon": 121.9219,
                  "lat": 40.918
                },
                {
                  "lon": 106.4064,
                  "lat": 40.918
                },
                {
                  "lon": 106.4064,
                  "lat": 41.0978
                },
                {
                  "lon": 126.9346,
                  "lat": 41.0978
                },
                {
                  "lon": 126.9346,
                  "lat": 40.918
                },
                {
                  "lon": 121.9219,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 109.1641,
                  "lat": 36.7826
                },
                {
                  "lon": 107.5884,
                  "lat": 36.7826
                },
                {
                  "lon": 107.5884,
                  "lat": 36.9624
                },
                {
                  "lon": 123.1203,
                  "lat": 36.9624
                },
                {
                  "lon": 123.1203,
                  "lat": 36.7826
                },
                {
                  "lon": 109.1641,
                  "lat": 36.7826
                }
              ],
              [
                {
                  "lon": 129.2133,
                  "lat": 46.312
                },
                {
                  "lon": 121.1409,
                  "lat": 46.312
                },
                {
                  "lon": 121.1409,
                  "lat": 46.1322
                },
                {
                  "lon": 134.1609,
                  "lat": 46.1322
                },
                {
                  "lon": 134.1609,
                  "lat": 46.312
                },
                {
                  "lon": 129.2133,
                  "lat": 46.312
                }
              ],
              [
                {
                  "lon": 118.5035,
                  "lat": 35.524
                },
                {
                  "lon": 99.676,
                  "lat": 35.524
                },
                {
                  "lon": 99.676,
                  "lat": 35.7038
                },
                {
                  "lon": 120.497,
                  "lat": 35.7038
                },
                {
                  "lon": 120.497,
                  "lat": 35.524
                },
                {
                  "lon": 118.5035,
                  "lat": 35.524
                }
              ],
              [
                {
                  "lon": 97.6876,
                  "lat": 29.7704
                },
                {
                  "lon": 95.2012,
                  "lat": 29.7704
                },
                {
                  "lon": 95.2012,
                  "lat": 29.5906
                },
                {
                  "lon": 98.7236,
                  "lat": 29.5906
                },
                {
                  "lon": 98.7236,
                  "lat": 29.7704
                },
                {
                  "lon": 97.6876,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 115.5546,
                  "lat": 38.0412
                },
                {
                  "lon": 108.6876,
                  "lat": 38.0412
                },
                {
                  "lon": 108.6876,
                  "lat": 38.221
                },
                {
                  "lon": 118.9881,
                  "lat": 38.221
                },
                {
                  "lon": 118.9881,
                  "lat": 38.0412
                },
                {
                  "lon": 115.5546,
                  "lat": 38.0412
                }
              ],
              [
                {
                  "lon": 125.1827,
                  "lat": 47.0312
                },
                {
                  "lon": 125.4466,
                  "lat": 47.0312
                },
                {
                  "lon": 125.4466,
                  "lat": 46.8514
                },
                {
                  "lon": 121.4881,
                  "lat": 46.8514
                },
                {
                  "lon": 121.4881,
                  "lat": 47.0312
                },
                {
                  "lon": 125.1827,
                  "lat": 47.0312
                }
              ],
              [
                {
                  "lon": 102.7335,
                  "lat": 25.9946
                },
                {
                  "lon": 102.5331,
                  "lat": 25.9946
                },
                {
                  "lon": 102.5331,
                  "lat": 26.1744
                },
                {
                  "lon": 103.7355,
                  "lat": 26.1744
                },
                {
                  "lon": 103.7355,
                  "lat": 25.9946
                },
                {
                  "lon": 102.7335,
                  "lat": 25.9946
                }
              ],
              [
                {
                  "lon": 82.1227,
                  "lat": 43.615
                },
                {
                  "lon": 80.8807,
                  "lat": 43.615
                },
                {
                  "lon": 80.8807,
                  "lat": 43.4352
                },
                {
                  "lon": 85.1035,
                  "lat": 43.4352
                },
                {
                  "lon": 85.1035,
                  "lat": 43.615
                },
                {
                  "lon": 82.1227,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 108.3003,
                  "lat": 26.3542
                },
                {
                  "lon": 108.5013,
                  "lat": 26.3542
                },
                {
                  "lon": 108.5013,
                  "lat": 26.534
                },
                {
                  "lon": 104.2803,
                  "lat": 26.534
                },
                {
                  "lon": 104.2803,
                  "lat": 26.3542
                },
                {
                  "lon": 108.3003,
                  "lat": 26.3542
                }
              ],
              [
                {
                  "lon": 113.3362,
                  "lat": 29.231
                },
                {
                  "lon": 114.3667,
                  "lat": 29.231
                },
                {
                  "lon": 114.3667,
                  "lat": 29.0512
                },
                {
                  "lon": 109.8325,
                  "lat": 29.0512
                },
                {
                  "lon": 109.8325,
                  "lat": 29.231
                },
                {
                  "lon": 113.3362,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 103.3929,
                  "lat": 25.8148
                },
                {
                  "lon": 101.9943,
                  "lat": 25.8148
                },
                {
                  "lon": 101.9943,
                  "lat": 25.635
                },
                {
                  "lon": 108.7875,
                  "lat": 25.635
                },
                {
                  "lon": 108.7875,
                  "lat": 25.8148
                },
                {
                  "lon": 103.3929,
                  "lat": 25.8148
                }
              ],
              [
                {
                  "lon": 111.9234,
                  "lat": 28.5118
                },
                {
                  "lon": 114.7892,
                  "lat": 28.5118
                },
                {
                  "lon": 114.7892,
                  "lat": 28.332
                },
                {
                  "lon": 110.4905,
                  "lat": 28.332
                },
                {
                  "lon": 110.4905,
                  "lat": 28.5118
                },
                {
                  "lon": 111.9234,
                  "lat": 28.5118
                }
              ],
              [
                {
                  "lon": 118.8175,
                  "lat": 34.9846
                },
                {
                  "lon": 102.1355,
                  "lat": 34.9846
                },
                {
                  "lon": 102.1355,
                  "lat": 34.8048
                },
                {
                  "lon": 120.1345,
                  "lat": 34.8048
                },
                {
                  "lon": 120.1345,
                  "lat": 34.9846
                },
                {
                  "lon": 118.8175,
                  "lat": 34.9846
                }
              ],
              [
                {
                  "lon": 94.0025,
                  "lat": 35.8836
                },
                {
                  "lon": 95.3345,
                  "lat": 35.8836
                },
                {
                  "lon": 95.3345,
                  "lat": 35.7038
                },
                {
                  "lon": 93.5585,
                  "lat": 35.7038
                },
                {
                  "lon": 93.5585,
                  "lat": 35.8836
                },
                {
                  "lon": 94.0025,
                  "lat": 35.8836
                }
              ],
              [
                {
                  "lon": 118.2455,
                  "lat": 37.1422
                },
                {
                  "lon": 102.4115,
                  "lat": 37.1422
                },
                {
                  "lon": 102.4115,
                  "lat": 37.322
                },
                {
                  "lon": 123.2219,
                  "lat": 37.322
                },
                {
                  "lon": 123.2219,
                  "lat": 37.1422
                },
                {
                  "lon": 118.2455,
                  "lat": 37.1422
                }
              ],
              [
                {
                  "lon": 117.4584,
                  "lat": 32.827
                },
                {
                  "lon": 111.0384,
                  "lat": 32.827
                },
                {
                  "lon": 111.0384,
                  "lat": 32.6472
                },
                {
                  "lon": 121.5244,
                  "lat": 32.6472
                },
                {
                  "lon": 121.5244,
                  "lat": 32.827
                },
                {
                  "lon": 117.4584,
                  "lat": 32.827
                }
              ],
              [
                {
                  "lon": 128.4632,
                  "lat": 42.716
                },
                {
                  "lon": 131.1637,
                  "lat": 42.716
                },
                {
                  "lon": 131.1637,
                  "lat": 42.8958
                },
                {
                  "lon": 117.4157,
                  "lat": 42.8958
                },
                {
                  "lon": 117.4157,
                  "lat": 42.716
                },
                {
                  "lon": 128.4632,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 111.5163,
                  "lat": 26.3542
                },
                {
                  "lon": 111.3153,
                  "lat": 26.3542
                },
                {
                  "lon": 111.3153,
                  "lat": 26.534
                },
                {
                  "lon": 112.5213,
                  "lat": 26.534
                },
                {
                  "lon": 112.5213,
                  "lat": 26.3542
                },
                {
                  "lon": 111.5163,
                  "lat": 26.3542
                }
              ],
              [
                {
                  "lon": 112.4266,
                  "lat": 39.4796
                },
                {
                  "lon": 107.7666,
                  "lat": 39.4796
                },
                {
                  "lon": 107.7666,
                  "lat": 39.2998
                },
                {
                  "lon": 119.6496,
                  "lat": 39.2998
                },
                {
                  "lon": 119.6496,
                  "lat": 39.4796
                },
                {
                  "lon": 112.4266,
                  "lat": 39.4796
                }
              ],
              [
                {
                  "lon": 120.5991,
                  "lat": 28.332
                },
                {
                  "lon": 122.0292,
                  "lat": 28.332
                },
                {
                  "lon": 122.0292,
                  "lat": 28.1522
                },
                {
                  "lon": 110.1798,
                  "lat": 28.1522
                },
                {
                  "lon": 110.1798,
                  "lat": 28.332
                },
                {
                  "lon": 120.5991,
                  "lat": 28.332
                }
              ],
              [
                {
                  "lon": 127.2242,
                  "lat": 41.817
                },
                {
                  "lon": 127.7068,
                  "lat": 41.817
                },
                {
                  "lon": 127.7068,
                  "lat": 41.6372
                },
                {
                  "lon": 112.5049,
                  "lat": 41.6372
                },
                {
                  "lon": 112.5049,
                  "lat": 41.817
                },
                {
                  "lon": 127.2242,
                  "lat": 41.817
                }
              ],
              [
                {
                  "lon": 128.3472,
                  "lat": 45.0534
                },
                {
                  "lon": 133.4392,
                  "lat": 45.0534
                },
                {
                  "lon": 133.4392,
                  "lat": 44.8736
                },
                {
                  "lon": 122.4914,
                  "lat": 44.8736
                },
                {
                  "lon": 122.4914,
                  "lat": 45.0534
                },
                {
                  "lon": 128.3472,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 95.9036,
                  "lat": 40.918
                },
                {
                  "lon": 96.381,
                  "lat": 40.918
                },
                {
                  "lon": 96.381,
                  "lat": 41.0978
                },
                {
                  "lon": 94.9488,
                  "lat": 41.0978
                },
                {
                  "lon": 94.9488,
                  "lat": 40.918
                },
                {
                  "lon": 95.9036,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 117.0905,
                  "lat": 35.7038
                },
                {
                  "lon": 99.3305,
                  "lat": 35.7038
                },
                {
                  "lon": 99.3305,
                  "lat": 35.8836
                },
                {
                  "lon": 121.0865,
                  "lat": 35.8836
                },
                {
                  "lon": 121.0865,
                  "lat": 35.7038
                },
                {
                  "lon": 117.0905,
                  "lat": 35.7038
                }
              ],
              [
                {
                  "lon": 104.8539,
                  "lat": 30.6694
                },
                {
                  "lon": 105.2729,
                  "lat": 30.6694
                },
                {
                  "lon": 105.2729,
                  "lat": 30.8492
                },
                {
                  "lon": 102.5494,
                  "lat": 30.8492
                },
                {
                  "lon": 102.5494,
                  "lat": 30.6694
                },
                {
                  "lon": 104.8539,
                  "lat": 30.6694
                }
              ],
              [
                {
                  "lon": 120.3603,
                  "lat": 26.534
                },
                {
                  "lon": 120.3603,
                  "lat": 26.3542
                },
                {
                  "lon": 117.9483,
                  "lat": 26.3542
                },
                {
                  "lon": 117.9483,
                  "lat": 26.534
                },
                {
                  "lon": 120.3603,
                  "lat": 26.534
                }
              ],
              [
                {
                  "lon": 115.7286,
                  "lat": 24.9158
                },
                {
                  "lon": 113.9439,
                  "lat": 24.9158
                },
                {
                  "lon": 113.9439,
                  "lat": 24.736
                },
                {
                  "lon": 115.7286,
                  "lat": 24.736
                },
                {
                  "lon": 115.7286,
                  "lat": 24.9158
                }
              ],
              [
                {
                  "lon": 112.7357,
                  "lat": 21.6794
                },
                {
                  "lon": 109.2527,
                  "lat": 21.6794
                },
                {
                  "lon": 109.2527,
                  "lat": 21.4996
                },
                {
                  "lon": 113.5097,
                  "lat": 21.4996
                },
                {
                  "lon": 113.5097,
                  "lat": 21.6794
                },
                {
                  "lon": 112.7357,
                  "lat": 21.6794
                }
              ],
              [
                {
                  "lon": 113.4007,
                  "lat": 41.2776
                },
                {
                  "lon": 111.9607,
                  "lat": 41.2776
                },
                {
                  "lon": 111.9607,
                  "lat": 41.4574
                },
                {
                  "lon": 127.0807,
                  "lat": 41.4574
                },
                {
                  "lon": 127.0807,
                  "lat": 41.2776
                },
                {
                  "lon": 113.4007,
                  "lat": 41.2776
                }
              ],
              [
                {
                  "lon": 119.0633,
                  "lat": 27.7926
                },
                {
                  "lon": 118.86,
                  "lat": 27.7926
                },
                {
                  "lon": 118.86,
                  "lat": 27.6128
                },
                {
                  "lon": 121.5029,
                  "lat": 27.6128
                },
                {
                  "lon": 121.5029,
                  "lat": 27.7926
                },
                {
                  "lon": 119.0633,
                  "lat": 27.7926
                }
              ],
              [
                {
                  "lon": 108.5959,
                  "lat": 29.0512
                },
                {
                  "lon": 105.2983,
                  "lat": 29.0512
                },
                {
                  "lon": 105.2983,
                  "lat": 29.231
                },
                {
                  "lon": 109.6264,
                  "lat": 29.231
                },
                {
                  "lon": 109.6264,
                  "lat": 29.0512
                },
                {
                  "lon": 108.5959,
                  "lat": 29.0512
                }
              ],
              [
                {
                  "lon": 109.9066,
                  "lat": 39.6594
                },
                {
                  "lon": 120.4456,
                  "lat": 39.6594
                },
                {
                  "lon": 120.4456,
                  "lat": 39.8392
                },
                {
                  "lon": 108.033,
                  "lat": 39.8392
                },
                {
                  "lon": 108.033,
                  "lat": 39.6594
                },
                {
                  "lon": 109.9066,
                  "lat": 39.6594
                }
              ],
              [
                {
                  "lon": 118.3938,
                  "lat": 37.8614
                },
                {
                  "lon": 119.3074,
                  "lat": 37.8614
                },
                {
                  "lon": 119.3074,
                  "lat": 38.0412
                },
                {
                  "lon": 105.6034,
                  "lat": 38.0412
                },
                {
                  "lon": 105.6034,
                  "lat": 37.8614
                },
                {
                  "lon": 118.3938,
                  "lat": 37.8614
                }
              ],
              [
                {
                  "lon": 129.9329,
                  "lat": 46.8514
                },
                {
                  "lon": 125.7105,
                  "lat": 46.8514
                },
                {
                  "lon": 125.7105,
                  "lat": 47.0312
                },
                {
                  "lon": 134.6831,
                  "lat": 47.0312
                },
                {
                  "lon": 134.6831,
                  "lat": 46.8514
                },
                {
                  "lon": 129.9329,
                  "lat": 46.8514
                }
              ],
              [
                {
                  "lon": 108.9486,
                  "lat": 30.13
                },
                {
                  "lon": 108.9486,
                  "lat": 30.3098
                },
                {
                  "lon": 102.6996,
                  "lat": 30.3098
                },
                {
                  "lon": 102.6996,
                  "lat": 30.13
                },
                {
                  "lon": 108.9486,
                  "lat": 30.13
                }
              ],
              [
                {
                  "lon": 85.3727,
                  "lat": 43.9746
                },
                {
                  "lon": 79.8573,
                  "lat": 43.9746
                },
                {
                  "lon": 79.8573,
                  "lat": 44.1544
                },
                {
                  "lon": 89.8853,
                  "lat": 44.1544
                },
                {
                  "lon": 89.8853,
                  "lat": 43.9746
                },
                {
                  "lon": 85.3727,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 105.0945,
                  "lat": 25.0956
                },
                {
                  "lon": 106.2861,
                  "lat": 25.0956
                },
                {
                  "lon": 106.2861,
                  "lat": 24.9158
                },
                {
                  "lon": 104.1015,
                  "lat": 24.9158
                },
                {
                  "lon": 104.1015,
                  "lat": 25.0956
                },
                {
                  "lon": 105.0945,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 116.6352,
                  "lat": 23.4774
                },
                {
                  "lon": 110.9483,
                  "lat": 23.4774
                },
                {
                  "lon": 110.9483,
                  "lat": 23.2976
                },
                {
                  "lon": 117.8118,
                  "lat": 23.2976
                },
                {
                  "lon": 117.8118,
                  "lat": 23.4774
                },
                {
                  "lon": 116.6352,
                  "lat": 23.4774
                }
              ],
              [
                {
                  "lon": 122.9777,
                  "lat": 44.1544
                },
                {
                  "lon": 120.9721,
                  "lat": 44.1544
                },
                {
                  "lon": 120.9721,
                  "lat": 43.9746
                },
                {
                  "lon": 122.9777,
                  "lat": 43.9746
                },
                {
                  "lon": 122.9777,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 120.6798,
                  "lat": 39.8392
                },
                {
                  "lon": 124.8954,
                  "lat": 39.8392
                },
                {
                  "lon": 124.8954,
                  "lat": 39.6594
                },
                {
                  "lon": 120.6798,
                  "lat": 39.6594
                },
                {
                  "lon": 120.6798,
                  "lat": 39.8392
                }
              ],
              [
                {
                  "lon": 123.1446,
                  "lat": 39.2998
                },
                {
                  "lon": 123.3776,
                  "lat": 39.2998
                },
                {
                  "lon": 123.3776,
                  "lat": 39.4796
                },
                {
                  "lon": 120.8146,
                  "lat": 39.4796
                },
                {
                  "lon": 120.8146,
                  "lat": 39.2998
                },
                {
                  "lon": 123.1446,
                  "lat": 39.2998
                }
              ],
              [
                {
                  "lon": 99.3786,
                  "lat": 39.4796
                },
                {
                  "lon": 97.9806,
                  "lat": 39.4796
                },
                {
                  "lon": 97.9806,
                  "lat": 39.2998
                },
                {
                  "lon": 100.7766,
                  "lat": 39.2998
                },
                {
                  "lon": 100.7766,
                  "lat": 39.4796
                },
                {
                  "lon": 99.3786,
                  "lat": 39.4796
                }
              ],
              [
                {
                  "lon": 115.2721,
                  "lat": 32.1078
                },
                {
                  "lon": 122.4903,
                  "lat": 32.1078
                },
                {
                  "lon": 122.4903,
                  "lat": 31.928
                },
                {
                  "lon": 113.1491,
                  "lat": 31.928
                },
                {
                  "lon": 113.1491,
                  "lat": 32.1078
                },
                {
                  "lon": 115.2721,
                  "lat": 32.1078
                }
              ],
              [
                {
                  "lon": 94.313,
                  "lat": 40.019
                },
                {
                  "lon": 94.0782,
                  "lat": 40.019
                },
                {
                  "lon": 94.0782,
                  "lat": 39.8392
                },
                {
                  "lon": 95.7218,
                  "lat": 39.8392
                },
                {
                  "lon": 95.7218,
                  "lat": 40.019
                },
                {
                  "lon": 94.313,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 122.7018,
                  "lat": 48.6494
                },
                {
                  "lon": 122.1554,
                  "lat": 48.6494
                },
                {
                  "lon": 122.1554,
                  "lat": 48.8292
                },
                {
                  "lon": 128.1658,
                  "lat": 48.8292
                },
                {
                  "lon": 128.1658,
                  "lat": 48.6494
                },
                {
                  "lon": 122.7018,
                  "lat": 48.6494
                }
              ],
              [
                {
                  "lon": 121.3959,
                  "lat": 27.9724
                },
                {
                  "lon": 118.5455,
                  "lat": 27.9724
                },
                {
                  "lon": 118.5455,
                  "lat": 27.7926
                },
                {
                  "lon": 121.8031,
                  "lat": 27.7926
                },
                {
                  "lon": 121.8031,
                  "lat": 27.9724
                },
                {
                  "lon": 121.3959,
                  "lat": 27.9724
                }
              ],
              [
                {
                  "lon": 109.9083,
                  "lat": 26.3542
                },
                {
                  "lon": 110.3103,
                  "lat": 26.3542
                },
                {
                  "lon": 110.3103,
                  "lat": 26.534
                },
                {
                  "lon": 109.1043,
                  "lat": 26.534
                },
                {
                  "lon": 109.1043,
                  "lat": 26.3542
                },
                {
                  "lon": 109.9083,
                  "lat": 26.3542
                }
              ],
              [
                {
                  "lon": 127.0738,
                  "lat": 42.5362
                },
                {
                  "lon": 122.1918,
                  "lat": 42.5362
                },
                {
                  "lon": 122.1918,
                  "lat": 42.3564
                },
                {
                  "lon": 129.7589,
                  "lat": 42.3564
                },
                {
                  "lon": 129.7589,
                  "lat": 42.5362
                },
                {
                  "lon": 127.0738,
                  "lat": 42.5362
                }
              ],
              [
                {
                  "lon": 101.8284,
                  "lat": 37.6816
                },
                {
                  "lon": 103.8786,
                  "lat": 37.6816
                },
                {
                  "lon": 103.8786,
                  "lat": 37.8614
                },
                {
                  "lon": 101.3728,
                  "lat": 37.8614
                },
                {
                  "lon": 101.3728,
                  "lat": 37.6816
                },
                {
                  "lon": 101.8284,
                  "lat": 37.6816
                }
              ],
              [
                {
                  "lon": 119.9068,
                  "lat": 32.4674
                },
                {
                  "lon": 111.1492,
                  "lat": 32.4674
                },
                {
                  "lon": 111.1492,
                  "lat": 32.6472
                },
                {
                  "lon": 121.6156,
                  "lat": 32.6472
                },
                {
                  "lon": 121.6156,
                  "lat": 32.4674
                },
                {
                  "lon": 119.9068,
                  "lat": 32.4674
                }
              ],
              [
                {
                  "lon": 98.1966,
                  "lat": 39.6594
                },
                {
                  "lon": 100.0702,
                  "lat": 39.6594
                },
                {
                  "lon": 100.0702,
                  "lat": 39.8392
                },
                {
                  "lon": 97.2598,
                  "lat": 39.8392
                },
                {
                  "lon": 97.2598,
                  "lat": 39.6594
                },
                {
                  "lon": 98.1966,
                  "lat": 39.6594
                }
              ],
              [
                {
                  "lon": 102.1621,
                  "lat": 37.5018
                },
                {
                  "lon": 101.0261,
                  "lat": 37.5018
                },
                {
                  "lon": 101.0261,
                  "lat": 37.6816
                },
                {
                  "lon": 119.4293,
                  "lat": 37.6816
                },
                {
                  "lon": 119.4293,
                  "lat": 37.5018
                },
                {
                  "lon": 102.1621,
                  "lat": 37.5018
                }
              ],
              [
                {
                  "lon": 106.667,
                  "lat": 26.7138
                },
                {
                  "lon": 104.2466,
                  "lat": 26.7138
                },
                {
                  "lon": 104.2466,
                  "lat": 26.8936
                },
                {
                  "lon": 108.4823,
                  "lat": 26.8936
                },
                {
                  "lon": 108.4823,
                  "lat": 26.7138
                },
                {
                  "lon": 106.667,
                  "lat": 26.7138
                }
              ],
              [
                {
                  "lon": 124.4361,
                  "lat": 42.1766
                },
                {
                  "lon": 128.3305,
                  "lat": 42.1766
                },
                {
                  "lon": 128.3305,
                  "lat": 42.3564
                },
                {
                  "lon": 113.9699,
                  "lat": 42.3564
                },
                {
                  "lon": 113.9699,
                  "lat": 42.1766
                },
                {
                  "lon": 124.4361,
                  "lat": 42.1766
                }
              ],
              [
                {
                  "lon": 107.1228,
                  "lat": 38.5806
                },
                {
                  "lon": 108.0432,
                  "lat": 38.5806
                },
                {
                  "lon": 108.0432,
                  "lat": 38.4008
                },
                {
                  "lon": 104.5917,
                  "lat": 38.4008
                },
                {
                  "lon": 104.5917,
                  "lat": 38.5806
                },
                {
                  "lon": 107.1228,
                  "lat": 38.5806
                }
              ],
              [
                {
                  "lon": 109.8654,
                  "lat": 33.3664
                },
                {
                  "lon": 121.061,
                  "lat": 33.3664
                },
                {
                  "lon": 121.061,
                  "lat": 33.1866
                },
                {
                  "lon": 104.2676,
                  "lat": 33.1866
                },
                {
                  "lon": 104.2676,
                  "lat": 33.3664
                },
                {
                  "lon": 109.8654,
                  "lat": 33.3664
                }
              ],
              [
                {
                  "lon": 116.7157,
                  "lat": 42.1766
                },
                {
                  "lon": 114.046,
                  "lat": 42.1766
                },
                {
                  "lon": 114.046,
                  "lat": 41.9968
                },
                {
                  "lon": 128.1226,
                  "lat": 41.9968
                },
                {
                  "lon": 128.1226,
                  "lat": 42.1766
                },
                {
                  "lon": 116.7157,
                  "lat": 42.1766
                }
              ],
              [
                {
                  "lon": 121.215,
                  "lat": 39.4796
                },
                {
                  "lon": 124.719,
                  "lat": 39.4796
                },
                {
                  "lon": 124.719,
                  "lat": 39.6594
                },
                {
                  "lon": 120.7478,
                  "lat": 39.6594
                },
                {
                  "lon": 120.7478,
                  "lat": 39.4796
                },
                {
                  "lon": 121.215,
                  "lat": 39.4796
                }
              ],
              [
                {
                  "lon": 119.1546,
                  "lat": 40.1988
                },
                {
                  "lon": 125.2776,
                  "lat": 40.1988
                },
                {
                  "lon": 125.2776,
                  "lat": 40.019
                },
                {
                  "lon": 107.8506,
                  "lat": 40.019
                },
                {
                  "lon": 107.8506,
                  "lat": 40.1988
                },
                {
                  "lon": 119.1546,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 96.1612,
                  "lat": 40.5584
                },
                {
                  "lon": 94.9742,
                  "lat": 40.5584
                },
                {
                  "lon": 94.9742,
                  "lat": 40.7382
                },
                {
                  "lon": 97.3482,
                  "lat": 40.7382
                },
                {
                  "lon": 97.3482,
                  "lat": 40.5584
                },
                {
                  "lon": 96.1612,
                  "lat": 40.5584
                }
              ],
              [
                {
                  "lon": 104.5445,
                  "lat": 36.9624
                },
                {
                  "lon": 106.5749,
                  "lat": 36.9624
                },
                {
                  "lon": 106.5749,
                  "lat": 37.1422
                },
                {
                  "lon": 102.5141,
                  "lat": 37.1422
                },
                {
                  "lon": 102.5141,
                  "lat": 36.9624
                },
                {
                  "lon": 104.5445,
                  "lat": 36.9624
                }
              ],
              [
                {
                  "lon": 112.2508,
                  "lat": 22.2188
                },
                {
                  "lon": 114.7793,
                  "lat": 22.2188
                },
                {
                  "lon": 114.7793,
                  "lat": 22.3986
                },
                {
                  "lon": 109.9168,
                  "lat": 22.3986
                },
                {
                  "lon": 109.9168,
                  "lat": 22.2188
                },
                {
                  "lon": 112.2508,
                  "lat": 22.2188
                }
              ],
              [
                {
                  "lon": 94.1385,
                  "lat": 35.524
                },
                {
                  "lon": 93.6955,
                  "lat": 35.524
                },
                {
                  "lon": 93.6955,
                  "lat": 35.7038
                },
                {
                  "lon": 95.0245,
                  "lat": 35.7038
                },
                {
                  "lon": 95.0245,
                  "lat": 35.524
                },
                {
                  "lon": 94.1385,
                  "lat": 35.524
                }
              ],
              [
                {
                  "lon": 113.9971,
                  "lat": 23.1178
                },
                {
                  "lon": 111.0601,
                  "lat": 23.1178
                },
                {
                  "lon": 111.0601,
                  "lat": 23.2976
                },
                {
                  "lon": 117.5215,
                  "lat": 23.2976
                },
                {
                  "lon": 117.5215,
                  "lat": 23.1178
                },
                {
                  "lon": 113.9971,
                  "lat": 23.1178
                }
              ],
              [
                {
                  "lon": 114.4913,
                  "lat": 34.2654
                },
                {
                  "lon": 103.1501,
                  "lat": 34.2654
                },
                {
                  "lon": 103.1501,
                  "lat": 34.4452
                },
                {
                  "lon": 120.8162,
                  "lat": 34.4452
                },
                {
                  "lon": 120.8162,
                  "lat": 34.2654
                },
                {
                  "lon": 114.4913,
                  "lat": 34.2654
                }
              ],
              [
                {
                  "lon": 91.9018,
                  "lat": 29.231
                },
                {
                  "lon": 92.314,
                  "lat": 29.231
                },
                {
                  "lon": 92.314,
                  "lat": 29.0512
                },
                {
                  "lon": 90.253,
                  "lat": 29.0512
                },
                {
                  "lon": 90.253,
                  "lat": 29.231
                },
                {
                  "lon": 91.9018,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 112.4059,
                  "lat": 32.1078
                },
                {
                  "lon": 111.9805,
                  "lat": 32.1078
                },
                {
                  "lon": 111.9805,
                  "lat": 32.2876
                },
                {
                  "lon": 122.1901,
                  "lat": 32.2876
                },
                {
                  "lon": 122.1901,
                  "lat": 32.1078
                },
                {
                  "lon": 112.4059,
                  "lat": 32.1078
                }
              ],
              [
                {
                  "lon": 106.1828,
                  "lat": 29.7704
                },
                {
                  "lon": 109.2908,
                  "lat": 29.7704
                },
                {
                  "lon": 109.2908,
                  "lat": 29.5906
                },
                {
                  "lon": 105.1468,
                  "lat": 29.5906
                },
                {
                  "lon": 105.1468,
                  "lat": 29.7704
                },
                {
                  "lon": 106.1828,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 105.213,
                  "lat": 36.0634
                },
                {
                  "lon": 121.233,
                  "lat": 36.0634
                },
                {
                  "lon": 121.233,
                  "lat": 35.8836
                },
                {
                  "lon": 101.8755,
                  "lat": 35.8836
                },
                {
                  "lon": 101.8755,
                  "lat": 36.0634
                },
                {
                  "lon": 105.213,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 105.5163,
                  "lat": 25.635
                },
                {
                  "lon": 104.1198,
                  "lat": 25.635
                },
                {
                  "lon": 104.1198,
                  "lat": 25.4552
                },
                {
                  "lon": 108.5088,
                  "lat": 25.4552
                },
                {
                  "lon": 108.5088,
                  "lat": 25.635
                },
                {
                  "lon": 105.5163,
                  "lat": 25.635
                }
              ],
              [
                {
                  "lon": 119.0675,
                  "lat": 36.2432
                },
                {
                  "lon": 121.526,
                  "lat": 36.2432
                },
                {
                  "lon": 121.526,
                  "lat": 36.423
                },
                {
                  "lon": 107.4455,
                  "lat": 36.423
                },
                {
                  "lon": 107.4455,
                  "lat": 36.2432
                },
                {
                  "lon": 119.0675,
                  "lat": 36.2432
                }
              ],
              [
                {
                  "lon": 103.646,
                  "lat": 36.423
                },
                {
                  "lon": 107.222,
                  "lat": 36.423
                },
                {
                  "lon": 107.222,
                  "lat": 36.2432
                },
                {
                  "lon": 99.8465,
                  "lat": 36.2432
                },
                {
                  "lon": 99.8465,
                  "lat": 36.423
                },
                {
                  "lon": 103.646,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 120.1819,
                  "lat": 31.2088
                },
                {
                  "lon": 122.2849,
                  "lat": 31.2088
                },
                {
                  "lon": 122.2849,
                  "lat": 31.029
                },
                {
                  "lon": 113.8729,
                  "lat": 31.029
                },
                {
                  "lon": 113.8729,
                  "lat": 31.2088
                },
                {
                  "lon": 120.1819,
                  "lat": 31.2088
                }
              ],
              [
                {
                  "lon": 112.9444,
                  "lat": 24.0168
                },
                {
                  "lon": 118.4576,
                  "lat": 24.0168
                },
                {
                  "lon": 118.4576,
                  "lat": 23.837
                },
                {
                  "lon": 111.1723,
                  "lat": 23.837
                },
                {
                  "lon": 111.1723,
                  "lat": 24.0168
                },
                {
                  "lon": 112.9444,
                  "lat": 24.0168
                }
              ],
              [
                {
                  "lon": 133.8975,
                  "lat": 47.9302
                },
                {
                  "lon": 132.0117,
                  "lat": 47.9302
                },
                {
                  "lon": 132.0117,
                  "lat": 48.11
                },
                {
                  "lon": 135.2445,
                  "lat": 48.11
                },
                {
                  "lon": 135.2445,
                  "lat": 47.9302
                },
                {
                  "lon": 133.8975,
                  "lat": 47.9302
                }
              ],
              [
                {
                  "lon": 113.6085,
                  "lat": 36.423
                },
                {
                  "lon": 99.9445,
                  "lat": 36.423
                },
                {
                  "lon": 99.9445,
                  "lat": 36.6028
                },
                {
                  "lon": 121.8965,
                  "lat": 36.6028
                },
                {
                  "lon": 121.8965,
                  "lat": 36.423
                },
                {
                  "lon": 113.6085,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 108.7728,
                  "lat": 24.1966
                },
                {
                  "lon": 110.1553,
                  "lat": 24.1966
                },
                {
                  "lon": 110.1553,
                  "lat": 24.3764
                },
                {
                  "lon": 108.1803,
                  "lat": 24.3764
                },
                {
                  "lon": 108.1803,
                  "lat": 24.1966
                },
                {
                  "lon": 108.7728,
                  "lat": 24.1966
                }
              ],
              [
                {
                  "lon": 108.2337,
                  "lat": 27.2532
                },
                {
                  "lon": 108.436,
                  "lat": 27.2532
                },
                {
                  "lon": 108.436,
                  "lat": 27.0734
                },
                {
                  "lon": 104.7946,
                  "lat": 27.0734
                },
                {
                  "lon": 104.7946,
                  "lat": 27.2532
                },
                {
                  "lon": 108.2337,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 131.7878,
                  "lat": 46.4918
                },
                {
                  "lon": 134.6709,
                  "lat": 46.4918
                },
                {
                  "lon": 134.6709,
                  "lat": 46.6716
                },
                {
                  "lon": 128.9047,
                  "lat": 46.6716
                },
                {
                  "lon": 128.9047,
                  "lat": 46.4918
                },
                {
                  "lon": 131.7878,
                  "lat": 46.4918
                }
              ],
              [
                {
                  "lon": 77.5318,
                  "lat": 39.6594
                },
                {
                  "lon": 75.1958,
                  "lat": 39.6594
                },
                {
                  "lon": 75.1958,
                  "lat": 39.4796
                },
                {
                  "lon": 78.4662,
                  "lat": 39.4796
                },
                {
                  "lon": 78.4662,
                  "lat": 39.6594
                },
                {
                  "lon": 77.5318,
                  "lat": 39.6594
                }
              ],
              [
                {
                  "lon": 89.5747,
                  "lat": 43.4352
                },
                {
                  "lon": 86.3455,
                  "lat": 43.4352
                },
                {
                  "lon": 86.3455,
                  "lat": 43.615
                },
                {
                  "lon": 90.0715,
                  "lat": 43.615
                },
                {
                  "lon": 90.0715,
                  "lat": 43.4352
                },
                {
                  "lon": 89.5747,
                  "lat": 43.4352
                }
              ],
              [
                {
                  "lon": 91.886,
                  "lat": 29.7704
                },
                {
                  "lon": 90.2284,
                  "lat": 29.7704
                },
                {
                  "lon": 90.2284,
                  "lat": 29.5906
                },
                {
                  "lon": 91.886,
                  "lat": 29.5906
                },
                {
                  "lon": 91.886,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 116.5166,
                  "lat": 43.7948
                },
                {
                  "lon": 120.0152,
                  "lat": 43.7948
                },
                {
                  "lon": 120.0152,
                  "lat": 43.9746
                },
                {
                  "lon": 115.0172,
                  "lat": 43.9746
                },
                {
                  "lon": 115.0172,
                  "lat": 43.7948
                },
                {
                  "lon": 116.5166,
                  "lat": 43.7948
                }
              ],
              [
                {
                  "lon": 111.5794,
                  "lat": 28.8714
                },
                {
                  "lon": 109.9338,
                  "lat": 28.8714
                },
                {
                  "lon": 109.9338,
                  "lat": 29.0512
                },
                {
                  "lon": 114.4592,
                  "lat": 29.0512
                },
                {
                  "lon": 114.4592,
                  "lat": 28.8714
                },
                {
                  "lon": 111.5794,
                  "lat": 28.8714
                }
              ],
              [
                {
                  "lon": 124.4206,
                  "lat": 52.7848
                },
                {
                  "lon": 125.0178,
                  "lat": 52.7848
                },
                {
                  "lon": 125.0178,
                  "lat": 52.9646
                },
                {
                  "lon": 123.5248,
                  "lat": 52.9646
                },
                {
                  "lon": 123.5248,
                  "lat": 52.7848
                },
                {
                  "lon": 124.4206,
                  "lat": 52.7848
                }
              ],
              [
                {
                  "lon": 83.7902,
                  "lat": 41.817
                },
                {
                  "lon": 87.1684,
                  "lat": 41.817
                },
                {
                  "lon": 87.1684,
                  "lat": 41.6372
                },
                {
                  "lon": 82.3424,
                  "lat": 41.6372
                },
                {
                  "lon": 82.3424,
                  "lat": 41.817
                },
                {
                  "lon": 83.7902,
                  "lat": 41.817
                }
              ],
              [
                {
                  "lon": 129.5547,
                  "lat": 43.615
                },
                {
                  "lon": 130.0531,
                  "lat": 43.615
                },
                {
                  "lon": 130.0531,
                  "lat": 43.7948
                },
                {
                  "lon": 127.8103,
                  "lat": 43.7948
                },
                {
                  "lon": 127.8103,
                  "lat": 43.615
                },
                {
                  "lon": 129.5547,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 114.4406,
                  "lat": 39.6594
                },
                {
                  "lon": 119.8134,
                  "lat": 39.6594
                },
                {
                  "lon": 119.8134,
                  "lat": 39.4796
                },
                {
                  "lon": 107.6662,
                  "lat": 39.4796
                },
                {
                  "lon": 107.6662,
                  "lat": 39.6594
                },
                {
                  "lon": 114.4406,
                  "lat": 39.6594
                }
              ],
              [
                {
                  "lon": 126.8931,
                  "lat": 48.11
                },
                {
                  "lon": 122.0439,
                  "lat": 48.11
                },
                {
                  "lon": 122.0439,
                  "lat": 47.9302
                },
                {
                  "lon": 128.2401,
                  "lat": 47.9302
                },
                {
                  "lon": 128.2401,
                  "lat": 48.11
                },
                {
                  "lon": 126.8931,
                  "lat": 48.11
                }
              ],
              [
                {
                  "lon": 120.2802,
                  "lat": 37.8614
                },
                {
                  "lon": 105.701,
                  "lat": 37.8614
                },
                {
                  "lon": 105.701,
                  "lat": 37.6816
                },
                {
                  "lon": 121.8748,
                  "lat": 37.6816
                },
                {
                  "lon": 121.8748,
                  "lat": 37.8614
                },
                {
                  "lon": 120.2802,
                  "lat": 37.8614
                }
              ],
              [
                {
                  "lon": 126.7482,
                  "lat": 49.1888
                },
                {
                  "lon": 124.5386,
                  "lat": 49.1888
                },
                {
                  "lon": 124.5386,
                  "lat": 49.3686
                },
                {
                  "lon": 129.7864,
                  "lat": 49.3686
                },
                {
                  "lon": 129.7864,
                  "lat": 49.1888
                },
                {
                  "lon": 126.7482,
                  "lat": 49.1888
                }
              ],
              [
                {
                  "lon": 130.511,
                  "lat": 43.9746
                },
                {
                  "lon": 131.7605,
                  "lat": 43.9746
                },
                {
                  "lon": 131.7605,
                  "lat": 43.7948
                },
                {
                  "lon": 130.511,
                  "lat": 43.7948
                },
                {
                  "lon": 130.511,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 118.0524,
                  "lat": 30.6694
                },
                {
                  "lon": 122.6614,
                  "lat": 30.6694
                },
                {
                  "lon": 122.6614,
                  "lat": 30.8492
                },
                {
                  "lon": 113.4434,
                  "lat": 30.8492
                },
                {
                  "lon": 113.4434,
                  "lat": 30.6694
                },
                {
                  "lon": 118.0524,
                  "lat": 30.6694
                }
              ],
              [
                {
                  "lon": 114.2453,
                  "lat": 36.9624
                },
                {
                  "lon": 106.8005,
                  "lat": 36.9624
                },
                {
                  "lon": 106.8005,
                  "lat": 37.1422
                },
                {
                  "lon": 123.4949,
                  "lat": 37.1422
                },
                {
                  "lon": 123.4949,
                  "lat": 36.9624
                },
                {
                  "lon": 114.2453,
                  "lat": 36.9624
                }
              ],
              [
                {
                  "lon": 108.8899,
                  "lat": 24.1966
                },
                {
                  "lon": 108.4955,
                  "lat": 24.1966
                },
                {
                  "lon": 108.4955,
                  "lat": 24.0168
                },
                {
                  "lon": 110.2703,
                  "lat": 24.0168
                },
                {
                  "lon": 110.2703,
                  "lat": 24.1966
                },
                {
                  "lon": 108.8899,
                  "lat": 24.1966
                }
              ],
              [
                {
                  "lon": 111.9659,
                  "lat": 36.6028
                },
                {
                  "lon": 107.6985,
                  "lat": 36.6028
                },
                {
                  "lon": 107.6985,
                  "lat": 36.7826
                },
                {
                  "lon": 122.9713,
                  "lat": 36.7826
                },
                {
                  "lon": 122.9713,
                  "lat": 36.6028
                },
                {
                  "lon": 111.9659,
                  "lat": 36.6028
                }
              ],
              [
                {
                  "lon": 110.6616,
                  "lat": 38.4008
                },
                {
                  "lon": 118.4646,
                  "lat": 38.4008
                },
                {
                  "lon": 118.4646,
                  "lat": 38.221
                },
                {
                  "lon": 108.3666,
                  "lat": 38.221
                },
                {
                  "lon": 108.3666,
                  "lat": 38.4008
                },
                {
                  "lon": 110.6616,
                  "lat": 38.4008
                }
              ],
              [
                {
                  "lon": 111.9112,
                  "lat": 26.8936
                },
                {
                  "lon": 112.3146,
                  "lat": 26.8936
                },
                {
                  "lon": 112.3146,
                  "lat": 26.7138
                },
                {
                  "lon": 111.3061,
                  "lat": 26.7138
                },
                {
                  "lon": 111.3061,
                  "lat": 26.8936
                },
                {
                  "lon": 111.9112,
                  "lat": 26.8936
                }
              ],
              [
                {
                  "lon": 116.4903,
                  "lat": 22.5784
                },
                {
                  "lon": 116.6853,
                  "lat": 22.5784
                },
                {
                  "lon": 116.6853,
                  "lat": 22.7582
                },
                {
                  "lon": 110.4453,
                  "lat": 22.7582
                },
                {
                  "lon": 110.4453,
                  "lat": 22.5784
                },
                {
                  "lon": 116.4903,
                  "lat": 22.5784
                }
              ],
              [
                {
                  "lon": 120.0932,
                  "lat": 31.2088
                },
                {
                  "lon": 122.6216,
                  "lat": 31.2088
                },
                {
                  "lon": 122.6216,
                  "lat": 31.3886
                },
                {
                  "lon": 114.1936,
                  "lat": 31.3886
                },
                {
                  "lon": 114.1936,
                  "lat": 31.2088
                },
                {
                  "lon": 120.0932,
                  "lat": 31.2088
                }
              ],
              [
                {
                  "lon": 100.1966,
                  "lat": 39.12
                },
                {
                  "lon": 101.3586,
                  "lat": 39.12
                },
                {
                  "lon": 101.3586,
                  "lat": 39.2998
                },
                {
                  "lon": 98.3374,
                  "lat": 39.2998
                },
                {
                  "lon": 98.3374,
                  "lat": 39.12
                },
                {
                  "lon": 100.1966,
                  "lat": 39.12
                }
              ],
              [
                {
                  "lon": 115.4689,
                  "lat": 41.4574
                },
                {
                  "lon": 112.1005,
                  "lat": 41.4574
                },
                {
                  "lon": 112.1005,
                  "lat": 41.6372
                },
                {
                  "lon": 127.4989,
                  "lat": 41.6372
                },
                {
                  "lon": 127.4989,
                  "lat": 41.4574
                },
                {
                  "lon": 115.4689,
                  "lat": 41.4574
                }
              ],
              [
                {
                  "lon": 119.9473,
                  "lat": 43.4352
                },
                {
                  "lon": 120.195,
                  "lat": 43.4352
                },
                {
                  "lon": 120.195,
                  "lat": 43.2554
                },
                {
                  "lon": 115.4887,
                  "lat": 43.2554
                },
                {
                  "lon": 115.4887,
                  "lat": 43.4352
                },
                {
                  "lon": 119.9473,
                  "lat": 43.4352
                }
              ],
              [
                {
                  "lon": 104.7372,
                  "lat": 30.8492
                },
                {
                  "lon": 105.157,
                  "lat": 30.8492
                },
                {
                  "lon": 105.157,
                  "lat": 31.029
                },
                {
                  "lon": 102.8481,
                  "lat": 31.029
                },
                {
                  "lon": 102.8481,
                  "lat": 30.8492
                },
                {
                  "lon": 104.7372,
                  "lat": 30.8492
                }
              ],
              [
                {
                  "lon": 112.9107,
                  "lat": 41.9968
                },
                {
                  "lon": 112.4267,
                  "lat": 41.9968
                },
                {
                  "lon": 112.4267,
                  "lat": 41.817
                },
                {
                  "lon": 128.1567,
                  "lat": 41.817
                },
                {
                  "lon": 128.1567,
                  "lat": 41.9968
                },
                {
                  "lon": 112.9107,
                  "lat": 41.9968
                }
              ],
              [
                {
                  "lon": 105.2181,
                  "lat": 34.0856
                },
                {
                  "lon": 121.1029,
                  "lat": 34.0856
                },
                {
                  "lon": 121.1029,
                  "lat": 34.2654
                },
                {
                  "lon": 103.4773,
                  "lat": 34.2654
                },
                {
                  "lon": 103.4773,
                  "lat": 34.0856
                },
                {
                  "lon": 105.2181,
                  "lat": 34.0856
                }
              ],
              [
                {
                  "lon": 107.185,
                  "lat": 28.8714
                },
                {
                  "lon": 109.6498,
                  "lat": 28.8714
                },
                {
                  "lon": 109.6498,
                  "lat": 28.6916
                },
                {
                  "lon": 105.131,
                  "lat": 28.6916
                },
                {
                  "lon": 105.131,
                  "lat": 28.8714
                },
                {
                  "lon": 107.185,
                  "lat": 28.8714
                }
              ],
              [
                {
                  "lon": 116.1411,
                  "lat": 24.5562
                },
                {
                  "lon": 119.3043,
                  "lat": 24.5562
                },
                {
                  "lon": 119.3043,
                  "lat": 24.3764
                },
                {
                  "lon": 115.548,
                  "lat": 24.3764
                },
                {
                  "lon": 115.548,
                  "lat": 24.5562
                },
                {
                  "lon": 116.1411,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 108.8915,
                  "lat": 36.0634
                },
                {
                  "lon": 121.1565,
                  "lat": 36.0634
                },
                {
                  "lon": 121.1565,
                  "lat": 36.2432
                },
                {
                  "lon": 107.3305,
                  "lat": 36.2432
                },
                {
                  "lon": 107.3305,
                  "lat": 36.0634
                },
                {
                  "lon": 108.8915,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 123.4791,
                  "lat": 43.9746
                },
                {
                  "lon": 127.2396,
                  "lat": 43.9746
                },
                {
                  "lon": 127.2396,
                  "lat": 44.1544
                },
                {
                  "lon": 123.2284,
                  "lat": 44.1544
                },
                {
                  "lon": 123.2284,
                  "lat": 43.9746
                },
                {
                  "lon": 123.4791,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 108.7744,
                  "lat": 29.4108
                },
                {
                  "lon": 104.8452,
                  "lat": 29.4108
                },
                {
                  "lon": 104.8452,
                  "lat": 29.5906
                },
                {
                  "lon": 109.6016,
                  "lat": 29.5906
                },
                {
                  "lon": 109.6016,
                  "lat": 29.4108
                },
                {
                  "lon": 108.7744,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 84.449,
                  "lat": 44.3342
                },
                {
                  "lon": 89.7284,
                  "lat": 44.3342
                },
                {
                  "lon": 89.7284,
                  "lat": 44.1544
                },
                {
                  "lon": 83.4434,
                  "lat": 44.1544
                },
                {
                  "lon": 83.4434,
                  "lat": 44.3342
                },
                {
                  "lon": 84.449,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 105.8163,
                  "lat": 27.9724
                },
                {
                  "lon": 105.4083,
                  "lat": 27.9724
                },
                {
                  "lon": 105.4083,
                  "lat": 28.1522
                },
                {
                  "lon": 108.2643,
                  "lat": 28.1522
                },
                {
                  "lon": 108.2643,
                  "lat": 27.9724
                },
                {
                  "lon": 105.8163,
                  "lat": 27.9724
                }
              ],
              [
                {
                  "lon": 85.4746,
                  "lat": 41.0978
                },
                {
                  "lon": 85.4746,
                  "lat": 41.2776
                },
                {
                  "lon": 86.9104,
                  "lat": 41.2776
                },
                {
                  "lon": 86.9104,
                  "lat": 41.0978
                },
                {
                  "lon": 85.4746,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 119.5445,
                  "lat": 35.3442
                },
                {
                  "lon": 101.4635,
                  "lat": 35.3442
                },
                {
                  "lon": 101.4635,
                  "lat": 35.1644
                },
                {
                  "lon": 120.206,
                  "lat": 35.1644
                },
                {
                  "lon": 120.206,
                  "lat": 35.3442
                },
                {
                  "lon": 119.5445,
                  "lat": 35.3442
                }
              ],
              [
                {
                  "lon": 115.7705,
                  "lat": 33.9058
                },
                {
                  "lon": 103.8245,
                  "lat": 33.9058
                },
                {
                  "lon": 103.8245,
                  "lat": 34.0856
                },
                {
                  "lon": 120.7661,
                  "lat": 34.0856
                },
                {
                  "lon": 120.7661,
                  "lat": 33.9058
                },
                {
                  "lon": 115.7705,
                  "lat": 33.9058
                }
              ],
              [
                {
                  "lon": 119.4894,
                  "lat": 25.2754
                },
                {
                  "lon": 116.9037,
                  "lat": 25.2754
                },
                {
                  "lon": 116.9037,
                  "lat": 25.0956
                },
                {
                  "lon": 120.0861,
                  "lat": 25.0956
                },
                {
                  "lon": 120.0861,
                  "lat": 25.2754
                },
                {
                  "lon": 119.4894,
                  "lat": 25.2754
                }
              ],
              [
                {
                  "lon": 124.2534,
                  "lat": 47.7504
                },
                {
                  "lon": 121.5784,
                  "lat": 47.7504
                },
                {
                  "lon": 121.5784,
                  "lat": 47.5706
                },
                {
                  "lon": 127.7309,
                  "lat": 47.5706
                },
                {
                  "lon": 127.7309,
                  "lat": 47.7504
                },
                {
                  "lon": 124.2534,
                  "lat": 47.7504
                }
              ],
              [
                {
                  "lon": 115.7286,
                  "lat": 30.4896
                },
                {
                  "lon": 115.7286,
                  "lat": 30.3098
                },
                {
                  "lon": 122.407,
                  "lat": 30.3098
                },
                {
                  "lon": 122.407,
                  "lat": 30.4896
                },
                {
                  "lon": 115.7286,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 110.2086,
                  "lat": 18.0834
                },
                {
                  "lon": 110.398,
                  "lat": 18.0834
                },
                {
                  "lon": 110.398,
                  "lat": 18.2632
                },
                {
                  "lon": 108.504,
                  "lat": 18.2632
                },
                {
                  "lon": 108.504,
                  "lat": 18.0834
                },
                {
                  "lon": 110.2086,
                  "lat": 18.0834
                }
              ],
              [
                {
                  "lon": 105.0356,
                  "lat": 27.7926
                },
                {
                  "lon": 105.0356,
                  "lat": 27.6128
                },
                {
                  "lon": 105.4422,
                  "lat": 27.6128
                },
                {
                  "lon": 105.4422,
                  "lat": 27.7926
                },
                {
                  "lon": 105.0356,
                  "lat": 27.7926
                }
              ],
              [
                {
                  "lon": 113.9559,
                  "lat": 26.1744
                },
                {
                  "lon": 113.5551,
                  "lat": 26.1744
                },
                {
                  "lon": 113.5551,
                  "lat": 25.9946
                },
                {
                  "lon": 116.5611,
                  "lat": 25.9946
                },
                {
                  "lon": 116.5611,
                  "lat": 26.1744
                },
                {
                  "lon": 113.9559,
                  "lat": 26.1744
                }
              ],
              [
                {
                  "lon": 109.8353,
                  "lat": 27.433
                },
                {
                  "lon": 116.9403,
                  "lat": 27.433
                },
                {
                  "lon": 116.9403,
                  "lat": 27.6128
                },
                {
                  "lon": 108.6173,
                  "lat": 27.6128
                },
                {
                  "lon": 108.6173,
                  "lat": 27.433
                },
                {
                  "lon": 109.8353,
                  "lat": 27.433
                }
              ],
              [
                {
                  "lon": 110.7629,
                  "lat": 29.4108
                },
                {
                  "lon": 112.2084,
                  "lat": 29.4108
                },
                {
                  "lon": 112.2084,
                  "lat": 29.231
                },
                {
                  "lon": 109.9369,
                  "lat": 29.231
                },
                {
                  "lon": 109.9369,
                  "lat": 29.4108
                },
                {
                  "lon": 110.7629,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 118.0194,
                  "lat": 41.2776
                },
                {
                  "lon": 111.319,
                  "lat": 41.2776
                },
                {
                  "lon": 111.319,
                  "lat": 41.0978
                },
                {
                  "lon": 126.8735,
                  "lat": 41.0978
                },
                {
                  "lon": 126.8735,
                  "lat": 41.2776
                },
                {
                  "lon": 118.0194,
                  "lat": 41.2776
                }
              ],
              [
                {
                  "lon": 123.8202,
                  "lat": 45.9524
                },
                {
                  "lon": 133.6508,
                  "lat": 45.9524
                },
                {
                  "lon": 133.6508,
                  "lat": 45.7726
                },
                {
                  "lon": 120.9745,
                  "lat": 45.7726
                },
                {
                  "lon": 120.9745,
                  "lat": 45.9524
                },
                {
                  "lon": 123.8202,
                  "lat": 45.9524
                }
              ],
              [
                {
                  "lon": 116.9167,
                  "lat": 27.9724
                },
                {
                  "lon": 117.9347,
                  "lat": 27.9724
                },
                {
                  "lon": 117.9347,
                  "lat": 27.7926
                },
                {
                  "lon": 105.5151,
                  "lat": 27.7926
                },
                {
                  "lon": 105.5151,
                  "lat": 27.9724
                },
                {
                  "lon": 116.9167,
                  "lat": 27.9724
                }
              ],
              [
                {
                  "lon": 108.2081,
                  "lat": 41.2776
                },
                {
                  "lon": 106.2937,
                  "lat": 41.2776
                },
                {
                  "lon": 106.2937,
                  "lat": 41.0978
                },
                {
                  "lon": 108.926,
                  "lat": 41.0978
                },
                {
                  "lon": 108.926,
                  "lat": 41.2776
                },
                {
                  "lon": 108.2081,
                  "lat": 41.2776
                }
              ],
              [
                {
                  "lon": 96.1014,
                  "lat": 29.4108
                },
                {
                  "lon": 97.3404,
                  "lat": 29.4108
                },
                {
                  "lon": 97.3404,
                  "lat": 29.231
                },
                {
                  "lon": 96.1014,
                  "lat": 29.231
                },
                {
                  "lon": 96.1014,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 127.4831,
                  "lat": 50.4474
                },
                {
                  "lon": 128.0501,
                  "lat": 50.4474
                },
                {
                  "lon": 128.0501,
                  "lat": 50.6272
                },
                {
                  "lon": 126.3491,
                  "lat": 50.6272
                },
                {
                  "lon": 126.3491,
                  "lat": 50.4474
                },
                {
                  "lon": 127.4831,
                  "lat": 50.4474
                }
              ],
              [
                {
                  "lon": 105.8136,
                  "lat": 24.9158
                },
                {
                  "lon": 104.4255,
                  "lat": 24.9158
                },
                {
                  "lon": 104.4255,
                  "lat": 24.736
                },
                {
                  "lon": 105.8136,
                  "lat": 24.736
                },
                {
                  "lon": 105.8136,
                  "lat": 24.9158
                }
              ],
              [
                {
                  "lon": 118.3948,
                  "lat": 39.12
                },
                {
                  "lon": 109.1228,
                  "lat": 39.12
                },
                {
                  "lon": 109.1228,
                  "lat": 38.9402
                },
                {
                  "lon": 119.5538,
                  "lat": 38.9402
                },
                {
                  "lon": 119.5538,
                  "lat": 39.12
                },
                {
                  "lon": 118.3948,
                  "lat": 39.12
                }
              ],
              [
                {
                  "lon": 121.0802,
                  "lat": 40.019
                },
                {
                  "lon": 125.0718,
                  "lat": 40.019
                },
                {
                  "lon": 125.0718,
                  "lat": 39.8392
                },
                {
                  "lon": 121.0802,
                  "lat": 39.8392
                },
                {
                  "lon": 121.0802,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 133.6548,
                  "lat": 45.5928
                },
                {
                  "lon": 120.5478,
                  "lat": 45.5928
                },
                {
                  "lon": 120.5478,
                  "lat": 45.413
                },
                {
                  "lon": 133.9118,
                  "lat": 45.413
                },
                {
                  "lon": 133.9118,
                  "lat": 45.5928
                },
                {
                  "lon": 133.6548,
                  "lat": 45.5928
                }
              ],
              [
                {
                  "lon": 107.4008,
                  "lat": 33.3664
                },
                {
                  "lon": 121.4278,
                  "lat": 33.3664
                },
                {
                  "lon": 121.4278,
                  "lat": 33.5462
                },
                {
                  "lon": 104.1638,
                  "lat": 33.5462
                },
                {
                  "lon": 104.1638,
                  "lat": 33.3664
                },
                {
                  "lon": 107.4008,
                  "lat": 33.3664
                }
              ],
              [
                {
                  "lon": 91.5135,
                  "lat": 31.029
                },
                {
                  "lon": 91.9333,
                  "lat": 31.029
                },
                {
                  "lon": 91.9333,
                  "lat": 30.8492
                },
                {
                  "lon": 91.0937,
                  "lat": 30.8492
                },
                {
                  "lon": 91.0937,
                  "lat": 31.029
                },
                {
                  "lon": 91.5135,
                  "lat": 31.029
                }
              ],
              [
                {
                  "lon": 134.718,
                  "lat": 48.4696
                },
                {
                  "lon": 132.8189,
                  "lat": 48.4696
                },
                {
                  "lon": 132.8189,
                  "lat": 48.2898
                },
                {
                  "lon": 135.2606,
                  "lat": 48.2898
                },
                {
                  "lon": 135.2606,
                  "lat": 48.4696
                },
                {
                  "lon": 134.718,
                  "lat": 48.4696
                }
              ],
              [
                {
                  "lon": 110.625,
                  "lat": 33.0068
                },
                {
                  "lon": 104.178,
                  "lat": 33.0068
                },
                {
                  "lon": 104.178,
                  "lat": 33.1866
                },
                {
                  "lon": 121.5849,
                  "lat": 33.1866
                },
                {
                  "lon": 121.5849,
                  "lat": 33.0068
                },
                {
                  "lon": 110.625,
                  "lat": 33.0068
                }
              ],
              [
                {
                  "lon": 111.1194,
                  "lat": 39.2998
                },
                {
                  "lon": 107.8658,
                  "lat": 39.2998
                },
                {
                  "lon": 107.8658,
                  "lat": 39.12
                },
                {
                  "lon": 119.7182,
                  "lat": 39.12
                },
                {
                  "lon": 119.7182,
                  "lat": 39.2998
                },
                {
                  "lon": 111.1194,
                  "lat": 39.2998
                }
              ],
              [
                {
                  "lon": 117.9932,
                  "lat": 29.5906
                },
                {
                  "lon": 115.714,
                  "lat": 29.5906
                },
                {
                  "lon": 115.714,
                  "lat": 29.7704
                },
                {
                  "lon": 122.966,
                  "lat": 29.7704
                },
                {
                  "lon": 122.966,
                  "lat": 29.5906
                },
                {
                  "lon": 117.9932,
                  "lat": 29.5906
                }
              ],
              [
                {
                  "lon": 83.7019,
                  "lat": 43.615
                },
                {
                  "lon": 84.9479,
                  "lat": 43.615
                },
                {
                  "lon": 84.9479,
                  "lat": 43.7948
                },
                {
                  "lon": 80.4623,
                  "lat": 43.7948
                },
                {
                  "lon": 80.4623,
                  "lat": 43.615
                },
                {
                  "lon": 83.7019,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 130.3622,
                  "lat": 45.2332
                },
                {
                  "lon": 120.4016,
                  "lat": 45.2332
                },
                {
                  "lon": 120.4016,
                  "lat": 45.0534
                },
                {
                  "lon": 133.427,
                  "lat": 45.0534
                },
                {
                  "lon": 133.427,
                  "lat": 45.2332
                },
                {
                  "lon": 130.3622,
                  "lat": 45.2332
                }
              ],
              [
                {
                  "lon": 109.5536,
                  "lat": 32.2876
                },
                {
                  "lon": 107.848,
                  "lat": 32.2876
                },
                {
                  "lon": 107.848,
                  "lat": 32.4674
                },
                {
                  "lon": 110.4064,
                  "lat": 32.4674
                },
                {
                  "lon": 110.4064,
                  "lat": 32.2876
                },
                {
                  "lon": 109.5536,
                  "lat": 32.2876
                }
              ],
              [
                {
                  "lon": 101.3805,
                  "lat": 37.5018
                },
                {
                  "lon": 123.1437,
                  "lat": 37.5018
                },
                {
                  "lon": 123.1437,
                  "lat": 37.322
                },
                {
                  "lon": 100.9271,
                  "lat": 37.322
                },
                {
                  "lon": 100.9271,
                  "lat": 37.5018
                },
                {
                  "lon": 101.3805,
                  "lat": 37.5018
                }
              ],
              [
                {
                  "lon": 79.4145,
                  "lat": 40.3786
                },
                {
                  "lon": 80.1228,
                  "lat": 40.3786
                },
                {
                  "lon": 80.1228,
                  "lat": 40.1988
                },
                {
                  "lon": 78.4701,
                  "lat": 40.1988
                },
                {
                  "lon": 78.4701,
                  "lat": 40.3786
                },
                {
                  "lon": 79.4145,
                  "lat": 40.3786
                }
              ],
              [
                {
                  "lon": 95.3455,
                  "lat": 36.6028
                },
                {
                  "lon": 96.2439,
                  "lat": 36.6028
                },
                {
                  "lon": 96.2439,
                  "lat": 36.7826
                },
                {
                  "lon": 94.4471,
                  "lat": 36.7826
                },
                {
                  "lon": 94.4471,
                  "lat": 36.6028
                },
                {
                  "lon": 95.3455,
                  "lat": 36.6028
                }
              ],
              [
                {
                  "lon": 109.8535,
                  "lat": 32.2876
                },
                {
                  "lon": 108.1519,
                  "lat": 32.2876
                },
                {
                  "lon": 108.1519,
                  "lat": 32.1078
                },
                {
                  "lon": 109.8535,
                  "lat": 32.1078
                },
                {
                  "lon": 109.8535,
                  "lat": 32.2876
                }
              ],
              [
                {
                  "lon": 112.067,
                  "lat": 40.5584
                },
                {
                  "lon": 125.5988,
                  "lat": 40.5584
                },
                {
                  "lon": 125.5988,
                  "lat": 40.7382
                },
                {
                  "lon": 106.6068,
                  "lat": 40.7382
                },
                {
                  "lon": 106.6068,
                  "lat": 40.5584
                },
                {
                  "lon": 112.067,
                  "lat": 40.5584
                }
              ],
              [
                {
                  "lon": 119.5192,
                  "lat": 29.0512
                },
                {
                  "lon": 115.3972,
                  "lat": 29.0512
                },
                {
                  "lon": 115.3972,
                  "lat": 29.231
                },
                {
                  "lon": 122.1985,
                  "lat": 29.231
                },
                {
                  "lon": 122.1985,
                  "lat": 29.0512
                },
                {
                  "lon": 119.5192,
                  "lat": 29.0512
                }
              ],
              [
                {
                  "lon": 116.9551,
                  "lat": 29.9502
                },
                {
                  "lon": 115.9156,
                  "lat": 29.9502
                },
                {
                  "lon": 115.9156,
                  "lat": 30.13
                },
                {
                  "lon": 122.9842,
                  "lat": 30.13
                },
                {
                  "lon": 122.9842,
                  "lat": 29.9502
                },
                {
                  "lon": 116.9551,
                  "lat": 29.9502
                }
              ],
              [
                {
                  "lon": 113.2276,
                  "lat": 29.7704
                },
                {
                  "lon": 113.4348,
                  "lat": 29.7704
                },
                {
                  "lon": 113.4348,
                  "lat": 29.5906
                },
                {
                  "lon": 112.3988,
                  "lat": 29.5906
                },
                {
                  "lon": 112.3988,
                  "lat": 29.7704
                },
                {
                  "lon": 113.2276,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 114.1641,
                  "lat": 24.3764
                },
                {
                  "lon": 115.3503,
                  "lat": 24.3764
                },
                {
                  "lon": 115.3503,
                  "lat": 24.5562
                },
                {
                  "lon": 114.1641,
                  "lat": 24.5562
                },
                {
                  "lon": 114.1641,
                  "lat": 24.3764
                }
              ],
              [
                {
                  "lon": 119.3812,
                  "lat": 48.8292
                },
                {
                  "lon": 119.107,
                  "lat": 48.8292
                },
                {
                  "lon": 119.107,
                  "lat": 49.009
                },
                {
                  "lon": 121.849,
                  "lat": 49.009
                },
                {
                  "lon": 121.849,
                  "lat": 48.8292
                },
                {
                  "lon": 119.3812,
                  "lat": 48.8292
                }
              ],
              [
                {
                  "lon": 125.7595,
                  "lat": 46.6716
                },
                {
                  "lon": 121.3038,
                  "lat": 46.6716
                },
                {
                  "lon": 121.3038,
                  "lat": 46.4918
                },
                {
                  "lon": 128.3805,
                  "lat": 46.4918
                },
                {
                  "lon": 128.3805,
                  "lat": 46.6716
                },
                {
                  "lon": 125.7595,
                  "lat": 46.6716
                }
              ],
              [
                {
                  "lon": 129.1122,
                  "lat": 43.4352
                },
                {
                  "lon": 130.3507,
                  "lat": 43.4352
                },
                {
                  "lon": 130.3507,
                  "lat": 43.2554
                },
                {
                  "lon": 120.4427,
                  "lat": 43.2554
                },
                {
                  "lon": 120.4427,
                  "lat": 43.4352
                },
                {
                  "lon": 129.1122,
                  "lat": 43.4352
                }
              ],
              [
                {
                  "lon": 128.6697,
                  "lat": 42.8958
                },
                {
                  "lon": 116.8521,
                  "lat": 42.8958
                },
                {
                  "lon": 116.8521,
                  "lat": 43.0756
                },
                {
                  "lon": 131.1317,
                  "lat": 43.0756
                },
                {
                  "lon": 131.1317,
                  "lat": 42.8958
                },
                {
                  "lon": 128.6697,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 110.5081,
                  "lat": 31.029
                },
                {
                  "lon": 107.5639,
                  "lat": 31.029
                },
                {
                  "lon": 107.5639,
                  "lat": 31.2088
                },
                {
                  "lon": 110.7184,
                  "lat": 31.2088
                },
                {
                  "lon": 110.7184,
                  "lat": 31.029
                },
                {
                  "lon": 110.5081,
                  "lat": 31.029
                }
              ],
              [
                {
                  "lon": 96.5303,
                  "lat": 37.1422
                },
                {
                  "lon": 96.7565,
                  "lat": 37.1422
                },
                {
                  "lon": 96.7565,
                  "lat": 37.322
                },
                {
                  "lon": 94.9469,
                  "lat": 37.322
                },
                {
                  "lon": 94.9469,
                  "lat": 37.1422
                },
                {
                  "lon": 96.5303,
                  "lat": 37.1422
                }
              ],
              [
                {
                  "lon": 126.2169,
                  "lat": 52.4252
                },
                {
                  "lon": 122.9598,
                  "lat": 52.4252
                },
                {
                  "lon": 122.9598,
                  "lat": 52.605
                },
                {
                  "lon": 126.8091,
                  "lat": 52.605
                },
                {
                  "lon": 126.8091,
                  "lat": 52.4252
                },
                {
                  "lon": 126.2169,
                  "lat": 52.4252
                }
              ],
              [
                {
                  "lon": 129.2218,
                  "lat": 49.3686
                },
                {
                  "lon": 123.955,
                  "lat": 49.3686
                },
                {
                  "lon": 123.955,
                  "lat": 49.5484
                },
                {
                  "lon": 129.7762,
                  "lat": 49.5484
                },
                {
                  "lon": 129.7762,
                  "lat": 49.3686
                },
                {
                  "lon": 129.2218,
                  "lat": 49.3686
                }
              ],
              [
                {
                  "lon": 108.9636,
                  "lat": 38.4008
                },
                {
                  "lon": 108.9636,
                  "lat": 38.5806
                },
                {
                  "lon": 110.8044,
                  "lat": 38.5806
                },
                {
                  "lon": 110.8044,
                  "lat": 38.4008
                },
                {
                  "lon": 108.9636,
                  "lat": 38.4008
                }
              ],
              [
                {
                  "lon": 110.9313,
                  "lat": 27.6128
                },
                {
                  "lon": 105.8488,
                  "lat": 27.6128
                },
                {
                  "lon": 105.8488,
                  "lat": 27.7926
                },
                {
                  "lon": 117.2336,
                  "lat": 27.7926
                },
                {
                  "lon": 117.2336,
                  "lat": 27.6128
                },
                {
                  "lon": 110.9313,
                  "lat": 27.6128
                }
              ],
              [
                {
                  "lon": 125.2179,
                  "lat": 40.3786
                },
                {
                  "lon": 125.6901,
                  "lat": 40.3786
                },
                {
                  "lon": 125.6901,
                  "lat": 40.1988
                },
                {
                  "lon": 106.3299,
                  "lat": 40.1988
                },
                {
                  "lon": 106.3299,
                  "lat": 40.3786
                },
                {
                  "lon": 125.2179,
                  "lat": 40.3786
                }
              ],
              [
                {
                  "lon": 106.4407,
                  "lat": 41.4574
                },
                {
                  "lon": 108.8407,
                  "lat": 41.4574
                },
                {
                  "lon": 108.8407,
                  "lat": 41.2776
                },
                {
                  "lon": 106.4407,
                  "lat": 41.2776
                },
                {
                  "lon": 106.4407,
                  "lat": 41.4574
                }
              ],
              [
                {
                  "lon": 113.4404,
                  "lat": 28.5118
                },
                {
                  "lon": 110.5704,
                  "lat": 28.5118
                },
                {
                  "lon": 110.5704,
                  "lat": 28.6916
                },
                {
                  "lon": 114.8754,
                  "lat": 28.6916
                },
                {
                  "lon": 114.8754,
                  "lat": 28.5118
                },
                {
                  "lon": 113.4404,
                  "lat": 28.5118
                }
              ],
              [
                {
                  "lon": 102.4635,
                  "lat": 25.9946
                },
                {
                  "lon": 102.0633,
                  "lat": 25.9946
                },
                {
                  "lon": 102.0633,
                  "lat": 25.8148
                },
                {
                  "lon": 103.6641,
                  "lat": 25.8148
                },
                {
                  "lon": 103.6641,
                  "lat": 25.9946
                },
                {
                  "lon": 102.4635,
                  "lat": 25.9946
                }
              ],
              [
                {
                  "lon": 91.3519,
                  "lat": 29.231
                },
                {
                  "lon": 90.1129,
                  "lat": 29.231
                },
                {
                  "lon": 90.1129,
                  "lat": 29.4108
                },
                {
                  "lon": 92.5909,
                  "lat": 29.4108
                },
                {
                  "lon": 92.5909,
                  "lat": 29.231
                },
                {
                  "lon": 91.3519,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 132.8337,
                  "lat": 46.312
                },
                {
                  "lon": 134.4009,
                  "lat": 46.312
                },
                {
                  "lon": 134.4009,
                  "lat": 46.4918
                },
                {
                  "lon": 128.9157,
                  "lat": 46.4918
                },
                {
                  "lon": 128.9157,
                  "lat": 46.312
                },
                {
                  "lon": 132.8337,
                  "lat": 46.312
                }
              ],
              [
                {
                  "lon": 126.9065,
                  "lat": 50.6272
                },
                {
                  "lon": 126.6219,
                  "lat": 50.6272
                },
                {
                  "lon": 126.6219,
                  "lat": 50.807
                },
                {
                  "lon": 127.4757,
                  "lat": 50.807
                },
                {
                  "lon": 127.4757,
                  "lat": 50.6272
                },
                {
                  "lon": 126.9065,
                  "lat": 50.6272
                }
              ],
              [
                {
                  "lon": 92.0056,
                  "lat": 30.4896
                },
                {
                  "lon": 92.4238,
                  "lat": 30.4896
                },
                {
                  "lon": 92.4238,
                  "lat": 30.6694
                },
                {
                  "lon": 90.5419,
                  "lat": 30.6694
                },
                {
                  "lon": 90.5419,
                  "lat": 30.4896
                },
                {
                  "lon": 92.0056,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 106.1263,
                  "lat": 36.7826
                },
                {
                  "lon": 100.2867,
                  "lat": 36.7826
                },
                {
                  "lon": 100.2867,
                  "lat": 36.6028
                },
                {
                  "lon": 107.0247,
                  "lat": 36.6028
                },
                {
                  "lon": 107.0247,
                  "lat": 36.7826
                },
                {
                  "lon": 106.1263,
                  "lat": 36.7826
                }
              ],
              [
                {
                  "lon": 125.2881,
                  "lat": 47.9302
                },
                {
                  "lon": 128.2405,
                  "lat": 47.9302
                },
                {
                  "lon": 128.2405,
                  "lat": 47.7504
                },
                {
                  "lon": 121.7989,
                  "lat": 47.7504
                },
                {
                  "lon": 121.7989,
                  "lat": 47.9302
                },
                {
                  "lon": 125.2881,
                  "lat": 47.9302
                }
              ],
              [
                {
                  "lon": 131.9981,
                  "lat": 47.7504
                },
                {
                  "lon": 135.4873,
                  "lat": 47.7504
                },
                {
                  "lon": 135.4873,
                  "lat": 47.9302
                },
                {
                  "lon": 130.1193,
                  "lat": 47.9302
                },
                {
                  "lon": 130.1193,
                  "lat": 47.7504
                },
                {
                  "lon": 131.9981,
                  "lat": 47.7504
                }
              ],
              [
                {
                  "lon": 109.253,
                  "lat": 21.14
                },
                {
                  "lon": 111.181,
                  "lat": 21.14
                },
                {
                  "lon": 111.181,
                  "lat": 20.9602
                },
                {
                  "lon": 109.253,
                  "lat": 20.9602
                },
                {
                  "lon": 109.253,
                  "lat": 21.14
                }
              ],
              [
                {
                  "lon": 117.4855,
                  "lat": 42.716
                },
                {
                  "lon": 122.1367,
                  "lat": 42.716
                },
                {
                  "lon": 122.1367,
                  "lat": 42.5362
                },
                {
                  "lon": 117.2407,
                  "lat": 42.5362
                },
                {
                  "lon": 117.2407,
                  "lat": 42.716
                },
                {
                  "lon": 117.4855,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 114.1126,
                  "lat": 40.918
                },
                {
                  "lon": 126.7266,
                  "lat": 40.918
                },
                {
                  "lon": 126.7266,
                  "lat": 40.7382
                },
                {
                  "lon": 106.4966,
                  "lat": 40.7382
                },
                {
                  "lon": 106.4966,
                  "lat": 40.918
                },
                {
                  "lon": 114.1126,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 108.6996,
                  "lat": 29.0512
                },
                {
                  "lon": 109.5224,
                  "lat": 29.0512
                },
                {
                  "lon": 109.5224,
                  "lat": 28.8714
                },
                {
                  "lon": 105.2027,
                  "lat": 28.8714
                },
                {
                  "lon": 105.2027,
                  "lat": 29.0512
                },
                {
                  "lon": 108.6996,
                  "lat": 29.0512
                }
              ],
              [
                {
                  "lon": 89.9197,
                  "lat": 42.716
                },
                {
                  "lon": 87.9557,
                  "lat": 42.716
                },
                {
                  "lon": 87.9557,
                  "lat": 42.8958
                },
                {
                  "lon": 89.9197,
                  "lat": 42.8958
                },
                {
                  "lon": 89.9197,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 127.2353,
                  "lat": 50.2676
                },
                {
                  "lon": 126.3911,
                  "lat": 50.2676
                },
                {
                  "lon": 126.3911,
                  "lat": 50.0878
                },
                {
                  "lon": 128.6423,
                  "lat": 50.0878
                },
                {
                  "lon": 128.6423,
                  "lat": 50.2676
                },
                {
                  "lon": 127.2353,
                  "lat": 50.2676
                }
              ],
              [
                {
                  "lon": 114.8928,
                  "lat": 25.635
                },
                {
                  "lon": 116.2893,
                  "lat": 25.635
                },
                {
                  "lon": 116.2893,
                  "lat": 25.4552
                },
                {
                  "lon": 113.6958,
                  "lat": 25.4552
                },
                {
                  "lon": 113.6958,
                  "lat": 25.635
                },
                {
                  "lon": 114.8928,
                  "lat": 25.635
                }
              ],
              [
                {
                  "lon": 110.8664,
                  "lat": 20.0612
                },
                {
                  "lon": 109.1411,
                  "lat": 20.0612
                },
                {
                  "lon": 109.1411,
                  "lat": 20.241
                },
                {
                  "lon": 111.2498,
                  "lat": 20.241
                },
                {
                  "lon": 111.2498,
                  "lat": 20.0612
                },
                {
                  "lon": 110.8664,
                  "lat": 20.0612
                }
              ],
              [
                {
                  "lon": 110.9739,
                  "lat": 22.5784
                },
                {
                  "lon": 116.2335,
                  "lat": 22.5784
                },
                {
                  "lon": 116.2335,
                  "lat": 22.3986
                },
                {
                  "lon": 110.1947,
                  "lat": 22.3986
                },
                {
                  "lon": 110.1947,
                  "lat": 22.5784
                },
                {
                  "lon": 110.9739,
                  "lat": 22.5784
                }
              ],
              [
                {
                  "lon": 118.4583,
                  "lat": 26.8936
                },
                {
                  "lon": 118.4583,
                  "lat": 27.0734
                },
                {
                  "lon": 120.8823,
                  "lat": 27.0734
                },
                {
                  "lon": 120.8823,
                  "lat": 26.8936
                },
                {
                  "lon": 118.4583,
                  "lat": 26.8936
                }
              ],
              [
                {
                  "lon": 110.5518,
                  "lat": 19.1622
                },
                {
                  "lon": 108.074,
                  "lat": 19.1622
                },
                {
                  "lon": 108.074,
                  "lat": 19.342
                },
                {
                  "lon": 111.1236,
                  "lat": 19.342
                },
                {
                  "lon": 111.1236,
                  "lat": 19.1622
                },
                {
                  "lon": 110.5518,
                  "lat": 19.1622
                }
              ],
              [
                {
                  "lon": 102.8391,
                  "lat": 24.736
                },
                {
                  "lon": 103.2357,
                  "lat": 24.736
                },
                {
                  "lon": 103.2357,
                  "lat": 24.9158
                },
                {
                  "lon": 102.0459,
                  "lat": 24.9158
                },
                {
                  "lon": 102.0459,
                  "lat": 24.736
                },
                {
                  "lon": 102.8391,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 80.4493,
                  "lat": 41.0978
                },
                {
                  "lon": 78.5349,
                  "lat": 41.0978
                },
                {
                  "lon": 78.5349,
                  "lat": 41.2776
                },
                {
                  "lon": 80.9279,
                  "lat": 41.2776
                },
                {
                  "lon": 80.9279,
                  "lat": 41.0978
                },
                {
                  "lon": 80.4493,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 88.5391,
                  "lat": 42.8958
                },
                {
                  "lon": 88.0467,
                  "lat": 42.8958
                },
                {
                  "lon": 88.0467,
                  "lat": 43.0756
                },
                {
                  "lon": 90.2625,
                  "lat": 43.0756
                },
                {
                  "lon": 90.2625,
                  "lat": 42.8958
                },
                {
                  "lon": 88.5391,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 114.486,
                  "lat": 38.5806
                },
                {
                  "lon": 111.0345,
                  "lat": 38.5806
                },
                {
                  "lon": 111.0345,
                  "lat": 38.4008
                },
                {
                  "lon": 118.3977,
                  "lat": 38.4008
                },
                {
                  "lon": 118.3977,
                  "lat": 38.5806
                },
                {
                  "lon": 114.486,
                  "lat": 38.5806
                }
              ],
              [
                {
                  "lon": 116.8455,
                  "lat": 43.615
                },
                {
                  "lon": 119.8359,
                  "lat": 43.615
                },
                {
                  "lon": 119.8359,
                  "lat": 43.7948
                },
                {
                  "lon": 115.5995,
                  "lat": 43.7948
                },
                {
                  "lon": 115.5995,
                  "lat": 43.615
                },
                {
                  "lon": 116.8455,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 105.388,
                  "lat": 30.6694
                },
                {
                  "lon": 102.6697,
                  "lat": 30.6694
                },
                {
                  "lon": 102.6697,
                  "lat": 30.4896
                },
                {
                  "lon": 105.388,
                  "lat": 30.4896
                },
                {
                  "lon": 105.388,
                  "lat": 30.6694
                }
              ],
              [
                {
                  "lon": 85.8782,
                  "lat": 41.0978
                },
                {
                  "lon": 85.8782,
                  "lat": 40.918
                },
                {
                  "lon": 86.5943,
                  "lat": 40.918
                },
                {
                  "lon": 86.5943,
                  "lat": 41.0978
                },
                {
                  "lon": 85.8782,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 109.1518,
                  "lat": 30.4896
                },
                {
                  "lon": 107.0608,
                  "lat": 30.4896
                },
                {
                  "lon": 107.0608,
                  "lat": 30.6694
                },
                {
                  "lon": 109.9882,
                  "lat": 30.6694
                },
                {
                  "lon": 109.9882,
                  "lat": 30.4896
                },
                {
                  "lon": 109.1518,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 108.8406,
                  "lat": 27.2532
                },
                {
                  "lon": 108.6383,
                  "lat": 27.2532
                },
                {
                  "lon": 108.6383,
                  "lat": 27.0734
                },
                {
                  "lon": 110.6613,
                  "lat": 27.0734
                },
                {
                  "lon": 110.6613,
                  "lat": 27.2532
                },
                {
                  "lon": 108.8406,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 95.2859,
                  "lat": 41.0978
                },
                {
                  "lon": 96.0038,
                  "lat": 41.0978
                },
                {
                  "lon": 96.0038,
                  "lat": 41.2776
                },
                {
                  "lon": 95.2859,
                  "lat": 41.2776
                },
                {
                  "lon": 95.2859,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 124.6799,
                  "lat": 48.2898
                },
                {
                  "lon": 122.2382,
                  "lat": 48.2898
                },
                {
                  "lon": 122.2382,
                  "lat": 48.4696
                },
                {
                  "lon": 127.9355,
                  "lat": 48.4696
                },
                {
                  "lon": 127.9355,
                  "lat": 48.2898
                },
                {
                  "lon": 124.6799,
                  "lat": 48.2898
                }
              ],
              [
                {
                  "lon": 117.8853,
                  "lat": 25.635
                },
                {
                  "lon": 117.2868,
                  "lat": 25.635
                },
                {
                  "lon": 117.2868,
                  "lat": 25.4552
                },
                {
                  "lon": 120.2793,
                  "lat": 25.4552
                },
                {
                  "lon": 120.2793,
                  "lat": 25.635
                },
                {
                  "lon": 117.8853,
                  "lat": 25.635
                }
              ],
              [
                {
                  "lon": 102.0085,
                  "lat": 35.3442
                },
                {
                  "lon": 120.1305,
                  "lat": 35.3442
                },
                {
                  "lon": 120.1305,
                  "lat": 35.524
                },
                {
                  "lon": 100.0195,
                  "lat": 35.524
                },
                {
                  "lon": 100.0195,
                  "lat": 35.3442
                },
                {
                  "lon": 102.0085,
                  "lat": 35.3442
                }
              ],
              [
                {
                  "lon": 122.5334,
                  "lat": 29.4108
                },
                {
                  "lon": 122.5334,
                  "lat": 29.231
                },
                {
                  "lon": 115.3059,
                  "lat": 29.231
                },
                {
                  "lon": 115.3059,
                  "lat": 29.4108
                },
                {
                  "lon": 122.5334,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 119.0489,
                  "lat": 27.2532
                },
                {
                  "lon": 118.8463,
                  "lat": 27.2532
                },
                {
                  "lon": 118.8463,
                  "lat": 27.433
                },
                {
                  "lon": 120.8723,
                  "lat": 27.433
                },
                {
                  "lon": 120.8723,
                  "lat": 27.2532
                },
                {
                  "lon": 119.0489,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 98.5386,
                  "lat": 40.1988
                },
                {
                  "lon": 98.5386,
                  "lat": 40.3786
                },
                {
                  "lon": 99.483,
                  "lat": 40.3786
                },
                {
                  "lon": 99.483,
                  "lat": 40.1988
                },
                {
                  "lon": 98.5386,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 115.0443,
                  "lat": 24.736
                },
                {
                  "lon": 115.6383,
                  "lat": 24.736
                },
                {
                  "lon": 115.6383,
                  "lat": 24.5562
                },
                {
                  "lon": 114.0543,
                  "lat": 24.5562
                },
                {
                  "lon": 114.0543,
                  "lat": 24.736
                },
                {
                  "lon": 115.0443,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 97.4631,
                  "lat": 40.3786
                },
                {
                  "lon": 97.6998,
                  "lat": 40.3786
                },
                {
                  "lon": 97.6998,
                  "lat": 40.5584
                },
                {
                  "lon": 94.386,
                  "lat": 40.5584
                },
                {
                  "lon": 94.386,
                  "lat": 40.3786
                },
                {
                  "lon": 97.4631,
                  "lat": 40.3786
                }
              ],
              [
                {
                  "lon": 105.6411,
                  "lat": 25.4552
                },
                {
                  "lon": 106.8363,
                  "lat": 25.4552
                },
                {
                  "lon": 106.8363,
                  "lat": 25.2754
                },
                {
                  "lon": 101.6571,
                  "lat": 25.2754
                },
                {
                  "lon": 101.6571,
                  "lat": 25.4552
                },
                {
                  "lon": 105.6411,
                  "lat": 25.4552
                }
              ],
              [
                {
                  "lon": 103.0929,
                  "lat": 24.5562
                },
                {
                  "lon": 103.0929,
                  "lat": 24.3764
                },
                {
                  "lon": 102.1044,
                  "lat": 24.3764
                },
                {
                  "lon": 102.1044,
                  "lat": 24.5562
                },
                {
                  "lon": 103.0929,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 76.6174,
                  "lat": 38.9402
                },
                {
                  "lon": 78.2358,
                  "lat": 38.9402
                },
                {
                  "lon": 78.2358,
                  "lat": 38.7604
                },
                {
                  "lon": 75.4614,
                  "lat": 38.7604
                },
                {
                  "lon": 75.4614,
                  "lat": 38.9402
                },
                {
                  "lon": 76.6174,
                  "lat": 38.9402
                }
              ],
              [
                {
                  "lon": 128.0781,
                  "lat": 50.0878
                },
                {
                  "lon": 126.116,
                  "lat": 50.0878
                },
                {
                  "lon": 126.116,
                  "lat": 49.908
                },
                {
                  "lon": 128.6387,
                  "lat": 49.908
                },
                {
                  "lon": 128.6387,
                  "lat": 50.0878
                },
                {
                  "lon": 128.0781,
                  "lat": 50.0878
                }
              ],
              [
                {
                  "lon": 124.2734,
                  "lat": 51.1666
                },
                {
                  "lon": 123.4097,
                  "lat": 51.1666
                },
                {
                  "lon": 123.4097,
                  "lat": 51.3464
                },
                {
                  "lon": 125.1371,
                  "lat": 51.3464
                },
                {
                  "lon": 125.1371,
                  "lat": 51.1666
                },
                {
                  "lon": 124.2734,
                  "lat": 51.1666
                }
              ],
              [
                {
                  "lon": 117.0105,
                  "lat": 25.0956
                },
                {
                  "lon": 119.7909,
                  "lat": 25.0956
                },
                {
                  "lon": 119.7909,
                  "lat": 24.9158
                },
                {
                  "lon": 116.8119,
                  "lat": 24.9158
                },
                {
                  "lon": 116.8119,
                  "lat": 25.0956
                },
                {
                  "lon": 117.0105,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 112.9648,
                  "lat": 32.2876
                },
                {
                  "lon": 111.4724,
                  "lat": 32.2876
                },
                {
                  "lon": 111.4724,
                  "lat": 32.4674
                },
                {
                  "lon": 121.9192,
                  "lat": 32.4674
                },
                {
                  "lon": 121.9192,
                  "lat": 32.2876
                },
                {
                  "lon": 112.9648,
                  "lat": 32.2876
                }
              ],
              [
                {
                  "lon": 118.769,
                  "lat": 26.8936
                },
                {
                  "lon": 120.5843,
                  "lat": 26.8936
                },
                {
                  "lon": 120.5843,
                  "lat": 26.7138
                },
                {
                  "lon": 118.1639,
                  "lat": 26.7138
                },
                {
                  "lon": 118.1639,
                  "lat": 26.8936
                },
                {
                  "lon": 118.769,
                  "lat": 26.8936
                }
              ],
              [
                {
                  "lon": 95.5205,
                  "lat": 36.9624
                },
                {
                  "lon": 94.3925,
                  "lat": 36.9624
                },
                {
                  "lon": 94.3925,
                  "lat": 37.1422
                },
                {
                  "lon": 96.4229,
                  "lat": 37.1422
                },
                {
                  "lon": 96.4229,
                  "lat": 36.9624
                },
                {
                  "lon": 95.5205,
                  "lat": 36.9624
                }
              ],
              [
                {
                  "lon": 84.9127,
                  "lat": 41.6372
                },
                {
                  "lon": 84.9127,
                  "lat": 41.4574
                },
                {
                  "lon": 82.2661,
                  "lat": 41.4574
                },
                {
                  "lon": 82.2661,
                  "lat": 41.6372
                },
                {
                  "lon": 84.9127,
                  "lat": 41.6372
                }
              ],
              [
                {
                  "lon": 123.2513,
                  "lat": 45.9524
                },
                {
                  "lon": 121.1753,
                  "lat": 45.9524
                },
                {
                  "lon": 121.1753,
                  "lat": 46.1322
                },
                {
                  "lon": 134.1503,
                  "lat": 46.1322
                },
                {
                  "lon": 134.1503,
                  "lat": 45.9524
                },
                {
                  "lon": 123.2513,
                  "lat": 45.9524
                }
              ],
              [
                {
                  "lon": 108.9822,
                  "lat": 26.7138
                },
                {
                  "lon": 103.9497,
                  "lat": 26.7138
                },
                {
                  "lon": 103.9497,
                  "lat": 26.534
                },
                {
                  "lon": 110.19,
                  "lat": 26.534
                },
                {
                  "lon": 110.19,
                  "lat": 26.7138
                },
                {
                  "lon": 108.9822,
                  "lat": 26.7138
                }
              ],
              [
                {
                  "lon": 83.1607,
                  "lat": 41.2776
                },
                {
                  "lon": 82.6807,
                  "lat": 41.2776
                },
                {
                  "lon": 82.6807,
                  "lat": 41.4574
                },
                {
                  "lon": 83.4007,
                  "lat": 41.4574
                },
                {
                  "lon": 83.4007,
                  "lat": 41.2776
                },
                {
                  "lon": 83.1607,
                  "lat": 41.2776
                }
              ],
              [
                {
                  "lon": 94.3671,
                  "lat": 38.221
                },
                {
                  "lon": 95.5146,
                  "lat": 38.221
                },
                {
                  "lon": 95.5146,
                  "lat": 38.4008
                },
                {
                  "lon": 94.1376,
                  "lat": 38.4008
                },
                {
                  "lon": 94.1376,
                  "lat": 38.221
                },
                {
                  "lon": 94.3671,
                  "lat": 38.221
                }
              ],
              [
                {
                  "lon": 79.0807,
                  "lat": 41.2776
                },
                {
                  "lon": 78.6007,
                  "lat": 41.2776
                },
                {
                  "lon": 78.6007,
                  "lat": 41.4574
                },
                {
                  "lon": 81.0007,
                  "lat": 41.4574
                },
                {
                  "lon": 81.0007,
                  "lat": 41.2776
                },
                {
                  "lon": 79.0807,
                  "lat": 41.2776
                }
              ],
              [
                {
                  "lon": 117.8736,
                  "lat": 29.4108
                },
                {
                  "lon": 122.63,
                  "lat": 29.4108
                },
                {
                  "lon": 122.63,
                  "lat": 29.5906
                },
                {
                  "lon": 115.392,
                  "lat": 29.5906
                },
                {
                  "lon": 115.392,
                  "lat": 29.4108
                },
                {
                  "lon": 117.8736,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 124.2288,
                  "lat": 51.8858
                },
                {
                  "lon": 123.646,
                  "lat": 51.8858
                },
                {
                  "lon": 123.646,
                  "lat": 51.706
                },
                {
                  "lon": 127.4342,
                  "lat": 51.706
                },
                {
                  "lon": 127.4342,
                  "lat": 51.8858
                },
                {
                  "lon": 124.2288,
                  "lat": 51.8858
                }
              ],
              [
                {
                  "lon": 96.5809,
                  "lat": 29.9502
                },
                {
                  "lon": 98.2441,
                  "lat": 29.9502
                },
                {
                  "lon": 98.2441,
                  "lat": 30.13
                },
                {
                  "lon": 95.1256,
                  "lat": 30.13
                },
                {
                  "lon": 95.1256,
                  "lat": 29.9502
                },
                {
                  "lon": 96.5809,
                  "lat": 29.9502
                }
              ],
              [
                {
                  "lon": 128.0767,
                  "lat": 43.615
                },
                {
                  "lon": 127.5799,
                  "lat": 43.615
                },
                {
                  "lon": 127.5799,
                  "lat": 43.4352
                },
                {
                  "lon": 129.5671,
                  "lat": 43.4352
                },
                {
                  "lon": 129.5671,
                  "lat": 43.615
                },
                {
                  "lon": 128.0767,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 116.1135,
                  "lat": 43.0756
                },
                {
                  "lon": 115.1287,
                  "lat": 43.0756
                },
                {
                  "lon": 115.1287,
                  "lat": 42.8958
                },
                {
                  "lon": 116.6059,
                  "lat": 42.8958
                },
                {
                  "lon": 116.6059,
                  "lat": 43.0756
                },
                {
                  "lon": 116.1135,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 106.4479,
                  "lat": 32.827
                },
                {
                  "lon": 106.0189,
                  "lat": 32.827
                },
                {
                  "lon": 106.0189,
                  "lat": 33.0068
                },
                {
                  "lon": 110.5234,
                  "lat": 33.0068
                },
                {
                  "lon": 110.5234,
                  "lat": 32.827
                },
                {
                  "lon": 106.4479,
                  "lat": 32.827
                }
              ],
              [
                {
                  "lon": 83.0262,
                  "lat": 44.3342
                },
                {
                  "lon": 79.4954,
                  "lat": 44.3342
                },
                {
                  "lon": 79.4954,
                  "lat": 44.514
                },
                {
                  "lon": 88.5746,
                  "lat": 44.514
                },
                {
                  "lon": 88.5746,
                  "lat": 44.3342
                },
                {
                  "lon": 83.0262,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 81.4746,
                  "lat": 40.1988
                },
                {
                  "lon": 81.2391,
                  "lat": 40.1988
                },
                {
                  "lon": 81.2391,
                  "lat": 40.019
                },
                {
                  "lon": 81.4746,
                  "lat": 40.019
                },
                {
                  "lon": 81.4746,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 111.9328,
                  "lat": 24.1966
                },
                {
                  "lon": 112.9203,
                  "lat": 24.1966
                },
                {
                  "lon": 112.9203,
                  "lat": 24.3764
                },
                {
                  "lon": 111.7353,
                  "lat": 24.3764
                },
                {
                  "lon": 111.7353,
                  "lat": 24.1966
                },
                {
                  "lon": 111.9328,
                  "lat": 24.1966
                }
              ],
              [
                {
                  "lon": 105.6651,
                  "lat": 25.9946
                },
                {
                  "lon": 108.4665,
                  "lat": 25.9946
                },
                {
                  "lon": 108.4665,
                  "lat": 25.8148
                },
                {
                  "lon": 103.8642,
                  "lat": 25.8148
                },
                {
                  "lon": 103.8642,
                  "lat": 25.9946
                },
                {
                  "lon": 105.6651,
                  "lat": 25.9946
                }
              ],
              [
                {
                  "lon": 100.802,
                  "lat": 35.1644
                },
                {
                  "lon": 100.361,
                  "lat": 35.1644
                },
                {
                  "lon": 100.361,
                  "lat": 35.3442
                },
                {
                  "lon": 101.0225,
                  "lat": 35.3442
                },
                {
                  "lon": 101.0225,
                  "lat": 35.1644
                },
                {
                  "lon": 100.802,
                  "lat": 35.1644
                }
              ],
              [
                {
                  "lon": 105.9798,
                  "lat": 38.7604
                },
                {
                  "lon": 105.055,
                  "lat": 38.7604
                },
                {
                  "lon": 105.055,
                  "lat": 38.9402
                },
                {
                  "lon": 106.4422,
                  "lat": 38.9402
                },
                {
                  "lon": 106.4422,
                  "lat": 38.7604
                },
                {
                  "lon": 105.9798,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 106.4629,
                  "lat": 36.7826
                },
                {
                  "lon": 100.3852,
                  "lat": 36.7826
                },
                {
                  "lon": 100.3852,
                  "lat": 36.9624
                },
                {
                  "lon": 106.688,
                  "lat": 36.9624
                },
                {
                  "lon": 106.688,
                  "lat": 36.7826
                },
                {
                  "lon": 106.4629,
                  "lat": 36.7826
                }
              ],
              [
                {
                  "lon": 91.102,
                  "lat": 30.4896
                },
                {
                  "lon": 90.2672,
                  "lat": 30.4896
                },
                {
                  "lon": 90.2672,
                  "lat": 30.3098
                },
                {
                  "lon": 92.3542,
                  "lat": 30.3098
                },
                {
                  "lon": 92.3542,
                  "lat": 30.4896
                },
                {
                  "lon": 91.102,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 80.9294,
                  "lat": 44.3342
                },
                {
                  "lon": 79.421,
                  "lat": 44.3342
                },
                {
                  "lon": 79.421,
                  "lat": 44.1544
                },
                {
                  "lon": 83.192,
                  "lat": 44.1544
                },
                {
                  "lon": 83.192,
                  "lat": 44.3342
                },
                {
                  "lon": 80.9294,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 102.7113,
                  "lat": 25.0956
                },
                {
                  "lon": 103.3071,
                  "lat": 25.0956
                },
                {
                  "lon": 103.3071,
                  "lat": 24.9158
                },
                {
                  "lon": 102.1155,
                  "lat": 24.9158
                },
                {
                  "lon": 102.1155,
                  "lat": 25.0956
                },
                {
                  "lon": 102.7113,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 96.5466,
                  "lat": 40.019
                },
                {
                  "lon": 96.5466,
                  "lat": 40.1988
                },
                {
                  "lon": 99.6081,
                  "lat": 40.1988
                },
                {
                  "lon": 99.6081,
                  "lat": 40.019
                },
                {
                  "lon": 96.5466,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 110.5803,
                  "lat": 27.0734
                },
                {
                  "lon": 110.7823,
                  "lat": 27.0734
                },
                {
                  "lon": 110.7823,
                  "lat": 26.8936
                },
                {
                  "lon": 109.1663,
                  "lat": 26.8936
                },
                {
                  "lon": 109.1663,
                  "lat": 27.0734
                },
                {
                  "lon": 110.5803,
                  "lat": 27.0734
                }
              ],
              [
                {
                  "lon": 87.7427,
                  "lat": 41.817
                },
                {
                  "lon": 88.4687,
                  "lat": 41.817
                },
                {
                  "lon": 88.4687,
                  "lat": 41.9968
                },
                {
                  "lon": 82.4187,
                  "lat": 41.9968
                },
                {
                  "lon": 82.4187,
                  "lat": 41.817
                },
                {
                  "lon": 87.7427,
                  "lat": 41.817
                }
              ],
              [
                {
                  "lon": 77.1186,
                  "lat": 39.6594
                },
                {
                  "lon": 75.4792,
                  "lat": 39.6594
                },
                {
                  "lon": 75.4792,
                  "lat": 39.8392
                },
                {
                  "lon": 77.3528,
                  "lat": 39.8392
                },
                {
                  "lon": 77.3528,
                  "lat": 39.6594
                },
                {
                  "lon": 77.1186,
                  "lat": 39.6594
                }
              ],
              [
                {
                  "lon": 114.6087,
                  "lat": 24.0168
                },
                {
                  "lon": 115.2003,
                  "lat": 24.0168
                },
                {
                  "lon": 115.2003,
                  "lat": 24.1966
                },
                {
                  "lon": 113.6227,
                  "lat": 24.1966
                },
                {
                  "lon": 113.6227,
                  "lat": 24.0168
                },
                {
                  "lon": 114.6087,
                  "lat": 24.0168
                }
              ],
              [
                {
                  "lon": 108.3513,
                  "lat": 40.5584
                },
                {
                  "lon": 125.8671,
                  "lat": 40.5584
                },
                {
                  "lon": 125.8671,
                  "lat": 40.3786
                },
                {
                  "lon": 108.1146,
                  "lat": 40.3786
                },
                {
                  "lon": 108.1146,
                  "lat": 40.5584
                },
                {
                  "lon": 108.3513,
                  "lat": 40.5584
                }
              ],
              [
                {
                  "lon": 107.5252,
                  "lat": 29.7704
                },
                {
                  "lon": 109.186,
                  "lat": 29.7704
                },
                {
                  "lon": 109.186,
                  "lat": 29.9502
                },
                {
                  "lon": 105.2416,
                  "lat": 29.9502
                },
                {
                  "lon": 105.2416,
                  "lat": 29.7704
                },
                {
                  "lon": 107.5252,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 109.2623,
                  "lat": 28.5118
                },
                {
                  "lon": 109.2623,
                  "lat": 28.332
                },
                {
                  "lon": 108.6482,
                  "lat": 28.332
                },
                {
                  "lon": 108.6482,
                  "lat": 28.5118
                },
                {
                  "lon": 109.2623,
                  "lat": 28.5118
                }
              ],
              [
                {
                  "lon": 129.2359,
                  "lat": 42.716
                },
                {
                  "lon": 122.3815,
                  "lat": 42.716
                },
                {
                  "lon": 122.3815,
                  "lat": 42.5362
                },
                {
                  "lon": 130.9495,
                  "lat": 42.5362
                },
                {
                  "lon": 130.9495,
                  "lat": 42.716
                },
                {
                  "lon": 129.2359,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 127.1401,
                  "lat": 51.5262
                },
                {
                  "lon": 127.4303,
                  "lat": 51.5262
                },
                {
                  "lon": 127.4303,
                  "lat": 51.706
                },
                {
                  "lon": 125.6891,
                  "lat": 51.706
                },
                {
                  "lon": 125.6891,
                  "lat": 51.5262
                },
                {
                  "lon": 127.1401,
                  "lat": 51.5262
                }
              ],
              [
                {
                  "lon": 106.9759,
                  "lat": 29.9502
                },
                {
                  "lon": 105.3127,
                  "lat": 29.9502
                },
                {
                  "lon": 105.3127,
                  "lat": 30.13
                },
                {
                  "lon": 109.0549,
                  "lat": 30.13
                },
                {
                  "lon": 109.0549,
                  "lat": 29.9502
                },
                {
                  "lon": 106.9759,
                  "lat": 29.9502
                }
              ],
              [
                {
                  "lon": 107.3984,
                  "lat": 33.726
                },
                {
                  "lon": 103.7145,
                  "lat": 33.726
                },
                {
                  "lon": 103.7145,
                  "lat": 33.9058
                },
                {
                  "lon": 121.2672,
                  "lat": 33.9058
                },
                {
                  "lon": 121.2672,
                  "lat": 33.726
                },
                {
                  "lon": 107.3984,
                  "lat": 33.726
                }
              ],
              [
                {
                  "lon": 102.8733,
                  "lat": 26.534
                },
                {
                  "lon": 102.8733,
                  "lat": 26.3542
                },
                {
                  "lon": 103.4763,
                  "lat": 26.3542
                },
                {
                  "lon": 103.4763,
                  "lat": 26.534
                },
                {
                  "lon": 102.8733,
                  "lat": 26.534
                }
              ],
              [
                {
                  "lon": 92.0744,
                  "lat": 30.6694
                },
                {
                  "lon": 90.6079,
                  "lat": 30.6694
                },
                {
                  "lon": 90.6079,
                  "lat": 30.8492
                },
                {
                  "lon": 92.0744,
                  "lat": 30.8492
                },
                {
                  "lon": 92.0744,
                  "lat": 30.6694
                }
              ],
              [
                {
                  "lon": 118.7655,
                  "lat": 26.1744
                },
                {
                  "lon": 117.7635,
                  "lat": 26.1744
                },
                {
                  "lon": 117.7635,
                  "lat": 25.9946
                },
                {
                  "lon": 120.5691,
                  "lat": 25.9946
                },
                {
                  "lon": 120.5691,
                  "lat": 26.1744
                },
                {
                  "lon": 118.7655,
                  "lat": 26.1744
                }
              ],
              [
                {
                  "lon": 88.2619,
                  "lat": 42.5362
                },
                {
                  "lon": 88.9942,
                  "lat": 42.5362
                },
                {
                  "lon": 88.9942,
                  "lat": 42.3564
                },
                {
                  "lon": 85.5768,
                  "lat": 42.3564
                },
                {
                  "lon": 85.5768,
                  "lat": 42.5362
                },
                {
                  "lon": 88.2619,
                  "lat": 42.5362
                }
              ],
              [
                {
                  "lon": 108.749,
                  "lat": 18.2632
                },
                {
                  "lon": 110.645,
                  "lat": 18.2632
                },
                {
                  "lon": 110.645,
                  "lat": 18.443
                },
                {
                  "lon": 108.1802,
                  "lat": 18.443
                },
                {
                  "lon": 108.1802,
                  "lat": 18.2632
                },
                {
                  "lon": 108.749,
                  "lat": 18.2632
                }
              ],
              [
                {
                  "lon": 123.6304,
                  "lat": 44.3342
                },
                {
                  "lon": 123.6304,
                  "lat": 44.514
                },
                {
                  "lon": 127.6656,
                  "lat": 44.514
                },
                {
                  "lon": 127.6656,
                  "lat": 44.3342
                },
                {
                  "lon": 123.6304,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 76.9026,
                  "lat": 38.9402
                },
                {
                  "lon": 75.5118,
                  "lat": 38.9402
                },
                {
                  "lon": 75.5118,
                  "lat": 39.12
                },
                {
                  "lon": 78.2934,
                  "lat": 39.12
                },
                {
                  "lon": 78.2934,
                  "lat": 38.9402
                },
                {
                  "lon": 76.9026,
                  "lat": 38.9402
                }
              ],
              [
                {
                  "lon": 109.3264,
                  "lat": 32.827
                },
                {
                  "lon": 106.3304,
                  "lat": 32.827
                },
                {
                  "lon": 106.3304,
                  "lat": 32.6472
                },
                {
                  "lon": 110.8244,
                  "lat": 32.6472
                },
                {
                  "lon": 110.8244,
                  "lat": 32.827
                },
                {
                  "lon": 109.3264,
                  "lat": 32.827
                }
              ],
              [
                {
                  "lon": 102.743,
                  "lat": 38.9402
                },
                {
                  "lon": 102.5118,
                  "lat": 38.9402
                },
                {
                  "lon": 102.5118,
                  "lat": 38.7604
                },
                {
                  "lon": 103.6678,
                  "lat": 38.7604
                },
                {
                  "lon": 103.6678,
                  "lat": 38.9402
                },
                {
                  "lon": 102.743,
                  "lat": 38.9402
                }
              ],
              [
                {
                  "lon": 115.8122,
                  "lat": 44.3342
                },
                {
                  "lon": 115.3078,
                  "lat": 44.3342
                },
                {
                  "lon": 115.3078,
                  "lat": 44.514
                },
                {
                  "lon": 116.821,
                  "lat": 44.514
                },
                {
                  "lon": 116.821,
                  "lat": 44.3342
                },
                {
                  "lon": 115.8122,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 114.304,
                  "lat": 31.3886
                },
                {
                  "lon": 114.304,
                  "lat": 31.5684
                },
                {
                  "lon": 122.748,
                  "lat": 31.5684
                },
                {
                  "lon": 122.748,
                  "lat": 31.3886
                },
                {
                  "lon": 114.304,
                  "lat": 31.3886
                }
              ],
              [
                {
                  "lon": 78.6506,
                  "lat": 40.918
                },
                {
                  "lon": 78.6506,
                  "lat": 40.7382
                },
                {
                  "lon": 81.7446,
                  "lat": 40.7382
                },
                {
                  "lon": 81.7446,
                  "lat": 40.918
                },
                {
                  "lon": 78.6506,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 122.7316,
                  "lat": 47.3908
                },
                {
                  "lon": 121.6688,
                  "lat": 47.3908
                },
                {
                  "lon": 121.6688,
                  "lat": 47.211
                },
                {
                  "lon": 129.1084,
                  "lat": 47.211
                },
                {
                  "lon": 129.1084,
                  "lat": 47.3908
                },
                {
                  "lon": 122.7316,
                  "lat": 47.3908
                }
              ],
              [
                {
                  "lon": 131.5483,
                  "lat": 43.615
                },
                {
                  "lon": 131.5483,
                  "lat": 43.7948
                },
                {
                  "lon": 130.8007,
                  "lat": 43.7948
                },
                {
                  "lon": 130.8007,
                  "lat": 43.615
                },
                {
                  "lon": 131.5483,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 133.3467,
                  "lat": 48.11
                },
                {
                  "lon": 135.2388,
                  "lat": 48.11
                },
                {
                  "lon": 135.2388,
                  "lat": 48.2898
                },
                {
                  "lon": 132.5358,
                  "lat": 48.2898
                },
                {
                  "lon": 132.5358,
                  "lat": 48.11
                },
                {
                  "lon": 133.3467,
                  "lat": 48.11
                }
              ],
              [
                {
                  "lon": 91.3324,
                  "lat": 29.7704
                },
                {
                  "lon": 92.1628,
                  "lat": 29.7704
                },
                {
                  "lon": 92.1628,
                  "lat": 29.9502
                },
                {
                  "lon": 89.8792,
                  "lat": 29.9502
                },
                {
                  "lon": 89.8792,
                  "lat": 29.7704
                },
                {
                  "lon": 91.3324,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 109.9847,
                  "lat": 31.029
                },
                {
                  "lon": 107.256,
                  "lat": 31.029
                },
                {
                  "lon": 107.256,
                  "lat": 30.8492
                },
                {
                  "lon": 110.4045,
                  "lat": 30.8492
                },
                {
                  "lon": 110.4045,
                  "lat": 31.029
                },
                {
                  "lon": 109.9847,
                  "lat": 31.029
                }
              ],
              [
                {
                  "lon": 100.4499,
                  "lat": 38.5806
                },
                {
                  "lon": 103.6713,
                  "lat": 38.5806
                },
                {
                  "lon": 103.6713,
                  "lat": 38.4008
                },
                {
                  "lon": 100.2198,
                  "lat": 38.4008
                },
                {
                  "lon": 100.2198,
                  "lat": 38.5806
                },
                {
                  "lon": 100.4499,
                  "lat": 38.5806
                }
              ],
              [
                {
                  "lon": 122.7641,
                  "lat": 43.7948
                },
                {
                  "lon": 121.2647,
                  "lat": 43.7948
                },
                {
                  "lon": 121.2647,
                  "lat": 43.9746
                },
                {
                  "lon": 127.2623,
                  "lat": 43.9746
                },
                {
                  "lon": 127.2623,
                  "lat": 43.7948
                },
                {
                  "lon": 122.7641,
                  "lat": 43.7948
                }
              ],
              [
                {
                  "lon": 123.3388,
                  "lat": 44.514
                },
                {
                  "lon": 123.0858,
                  "lat": 44.514
                },
                {
                  "lon": 123.0858,
                  "lat": 44.6938
                },
                {
                  "lon": 127.6398,
                  "lat": 44.6938
                },
                {
                  "lon": 127.6398,
                  "lat": 44.514
                },
                {
                  "lon": 123.3388,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 123.8862,
                  "lat": 48.2898
                },
                {
                  "lon": 121.7238,
                  "lat": 48.2898
                },
                {
                  "lon": 121.7238,
                  "lat": 48.11
                },
                {
                  "lon": 128.211,
                  "lat": 48.11
                },
                {
                  "lon": 128.211,
                  "lat": 48.2898
                },
                {
                  "lon": 123.8862,
                  "lat": 48.2898
                }
              ],
              [
                {
                  "lon": 87.3751,
                  "lat": 42.716
                },
                {
                  "lon": 85.9063,
                  "lat": 42.716
                },
                {
                  "lon": 85.9063,
                  "lat": 42.5362
                },
                {
                  "lon": 87.3751,
                  "lat": 42.5362
                },
                {
                  "lon": 87.3751,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 116.2226,
                  "lat": 28.6916
                },
                {
                  "lon": 115.401,
                  "lat": 28.6916
                },
                {
                  "lon": 115.401,
                  "lat": 28.8714
                },
                {
                  "lon": 122.3846,
                  "lat": 28.8714
                },
                {
                  "lon": 122.3846,
                  "lat": 28.6916
                },
                {
                  "lon": 116.2226,
                  "lat": 28.6916
                }
              ],
              [
                {
                  "lon": 128.4931,
                  "lat": 44.1544
                },
                {
                  "lon": 128.2424,
                  "lat": 44.1544
                },
                {
                  "lon": 128.2424,
                  "lat": 43.9746
                },
                {
                  "lon": 131.7522,
                  "lat": 43.9746
                },
                {
                  "lon": 131.7522,
                  "lat": 44.1544
                },
                {
                  "lon": 128.4931,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 129.0607,
                  "lat": 42.3564
                },
                {
                  "lon": 129.5475,
                  "lat": 42.3564
                },
                {
                  "lon": 129.5475,
                  "lat": 42.1766
                },
                {
                  "lon": 128.5739,
                  "lat": 42.1766
                },
                {
                  "lon": 128.5739,
                  "lat": 42.3564
                },
                {
                  "lon": 129.0607,
                  "lat": 42.3564
                }
              ],
              [
                {
                  "lon": 126.5223,
                  "lat": 52.2454
                },
                {
                  "lon": 123.5733,
                  "lat": 52.2454
                },
                {
                  "lon": 123.5733,
                  "lat": 52.4252
                },
                {
                  "lon": 126.8172,
                  "lat": 52.4252
                },
                {
                  "lon": 126.8172,
                  "lat": 52.2454
                },
                {
                  "lon": 126.5223,
                  "lat": 52.2454
                }
              ],
              [
                {
                  "lon": 127.8709,
                  "lat": 46.312
                },
                {
                  "lon": 128.6545,
                  "lat": 46.312
                },
                {
                  "lon": 128.6545,
                  "lat": 46.4918
                },
                {
                  "lon": 121.6021,
                  "lat": 46.4918
                },
                {
                  "lon": 121.6021,
                  "lat": 46.312
                },
                {
                  "lon": 127.8709,
                  "lat": 46.312
                }
              ],
              [
                {
                  "lon": 110.0932,
                  "lat": 19.5218
                },
                {
                  "lon": 108.7562,
                  "lat": 19.5218
                },
                {
                  "lon": 108.7562,
                  "lat": 19.7016
                },
                {
                  "lon": 111.6212,
                  "lat": 19.7016
                },
                {
                  "lon": 111.6212,
                  "lat": 19.5218
                },
                {
                  "lon": 110.0932,
                  "lat": 19.5218
                }
              ],
              [
                {
                  "lon": 110.2948,
                  "lat": 32.6472
                },
                {
                  "lon": 110.5084,
                  "lat": 32.6472
                },
                {
                  "lon": 110.5084,
                  "lat": 32.4674
                },
                {
                  "lon": 106.45,
                  "lat": 32.4674
                },
                {
                  "lon": 106.45,
                  "lat": 32.6472
                },
                {
                  "lon": 110.2948,
                  "lat": 32.6472
                }
              ],
              [
                {
                  "lon": 115.4083,
                  "lat": 43.615
                },
                {
                  "lon": 120.1279,
                  "lat": 43.615
                },
                {
                  "lon": 120.1279,
                  "lat": 43.4352
                },
                {
                  "lon": 115.1599,
                  "lat": 43.4352
                },
                {
                  "lon": 115.1599,
                  "lat": 43.615
                },
                {
                  "lon": 115.4083,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 115.8619,
                  "lat": 30.8492
                },
                {
                  "lon": 113.7629,
                  "lat": 30.8492
                },
                {
                  "lon": 113.7629,
                  "lat": 31.029
                },
                {
                  "lon": 122.3688,
                  "lat": 31.029
                },
                {
                  "lon": 122.3688,
                  "lat": 30.8492
                },
                {
                  "lon": 115.8619,
                  "lat": 30.8492
                }
              ],
              [
                {
                  "lon": 109.5638,
                  "lat": 18.443
                },
                {
                  "lon": 108.2352,
                  "lat": 18.443
                },
                {
                  "lon": 108.2352,
                  "lat": 18.6228
                },
                {
                  "lon": 110.8924,
                  "lat": 18.6228
                },
                {
                  "lon": 110.8924,
                  "lat": 18.443
                },
                {
                  "lon": 109.5638,
                  "lat": 18.443
                }
              ],
              [
                {
                  "lon": 94.1834,
                  "lat": 38.0412
                },
                {
                  "lon": 94.1834,
                  "lat": 37.8614
                },
                {
                  "lon": 96.0106,
                  "lat": 37.8614
                },
                {
                  "lon": 96.0106,
                  "lat": 38.0412
                },
                {
                  "lon": 94.1834,
                  "lat": 38.0412
                }
              ],
              [
                {
                  "lon": 117.2631,
                  "lat": 23.1178
                },
                {
                  "lon": 110.8083,
                  "lat": 23.1178
                },
                {
                  "lon": 110.8083,
                  "lat": 22.938
                },
                {
                  "lon": 117.2631,
                  "lat": 22.938
                },
                {
                  "lon": 117.2631,
                  "lat": 23.1178
                }
              ],
              [
                {
                  "lon": 108.0539,
                  "lat": 32.1078
                },
                {
                  "lon": 109.54,
                  "lat": 32.1078
                },
                {
                  "lon": 109.54,
                  "lat": 31.928
                },
                {
                  "lon": 108.0539,
                  "lat": 31.928
                },
                {
                  "lon": 108.0539,
                  "lat": 32.1078
                }
              ],
              [
                {
                  "lon": 114.3303,
                  "lat": 26.534
                },
                {
                  "lon": 116.3403,
                  "lat": 26.534
                },
                {
                  "lon": 116.3403,
                  "lat": 26.3542
                },
                {
                  "lon": 113.5263,
                  "lat": 26.3542
                },
                {
                  "lon": 113.5263,
                  "lat": 26.534
                },
                {
                  "lon": 114.3303,
                  "lat": 26.534
                }
              ],
              [
                {
                  "lon": 128.969,
                  "lat": 49.1888
                },
                {
                  "lon": 128.4186,
                  "lat": 49.1888
                },
                {
                  "lon": 128.4186,
                  "lat": 49.009
                },
                {
                  "lon": 129.7946,
                  "lat": 49.009
                },
                {
                  "lon": 129.7946,
                  "lat": 49.1888
                },
                {
                  "lon": 128.969,
                  "lat": 49.1888
                }
              ],
              [
                {
                  "lon": 117.5869,
                  "lat": 31.7482
                },
                {
                  "lon": 114.2029,
                  "lat": 31.7482
                },
                {
                  "lon": 114.2029,
                  "lat": 31.5684
                },
                {
                  "lon": 122.6629,
                  "lat": 31.5684
                },
                {
                  "lon": 122.6629,
                  "lat": 31.7482
                },
                {
                  "lon": 117.5869,
                  "lat": 31.7482
                }
              ],
              [
                {
                  "lon": 105.6627,
                  "lat": 34.4452
                },
                {
                  "lon": 103.4767,
                  "lat": 34.4452
                },
                {
                  "lon": 103.4767,
                  "lat": 34.625
                },
                {
                  "lon": 120.5275,
                  "lat": 34.625
                },
                {
                  "lon": 120.5275,
                  "lat": 34.4452
                },
                {
                  "lon": 105.6627,
                  "lat": 34.4452
                }
              ],
              [
                {
                  "lon": 117.2859,
                  "lat": 23.4774
                },
                {
                  "lon": 118.0711,
                  "lat": 23.4774
                },
                {
                  "lon": 118.0711,
                  "lat": 23.6572
                },
                {
                  "lon": 111.0043,
                  "lat": 23.6572
                },
                {
                  "lon": 111.0043,
                  "lat": 23.4774
                },
                {
                  "lon": 117.2859,
                  "lat": 23.4774
                }
              ],
              [
                {
                  "lon": 108.3583,
                  "lat": 27.0734
                },
                {
                  "lon": 108.7623,
                  "lat": 27.0734
                },
                {
                  "lon": 108.7623,
                  "lat": 26.8936
                },
                {
                  "lon": 104.3183,
                  "lat": 26.8936
                },
                {
                  "lon": 104.3183,
                  "lat": 27.0734
                },
                {
                  "lon": 108.3583,
                  "lat": 27.0734
                }
              ],
              [
                {
                  "lon": 110.6011,
                  "lat": 41.0978
                },
                {
                  "lon": 110.6011,
                  "lat": 41.2776
                },
                {
                  "lon": 109.4046,
                  "lat": 41.2776
                },
                {
                  "lon": 109.4046,
                  "lat": 41.0978
                },
                {
                  "lon": 110.6011,
                  "lat": 41.0978
                }
              ],
              [
                {
                  "lon": 97.9645,
                  "lat": 36.2432
                },
                {
                  "lon": 98.6335,
                  "lat": 36.2432
                },
                {
                  "lon": 98.6335,
                  "lat": 36.0634
                },
                {
                  "lon": 96.8495,
                  "lat": 36.0634
                },
                {
                  "lon": 96.8495,
                  "lat": 36.2432
                },
                {
                  "lon": 97.9645,
                  "lat": 36.2432
                }
              ],
              [
                {
                  "lon": 108.0735,
                  "lat": 25.0956
                },
                {
                  "lon": 107.6763,
                  "lat": 25.0956
                },
                {
                  "lon": 107.6763,
                  "lat": 24.9158
                },
                {
                  "lon": 108.4707,
                  "lat": 24.9158
                },
                {
                  "lon": 108.4707,
                  "lat": 25.0956
                },
                {
                  "lon": 108.0735,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 104.08,
                  "lat": 31.3886
                },
                {
                  "lon": 103.2372,
                  "lat": 31.3886
                },
                {
                  "lon": 103.2372,
                  "lat": 31.2088
                },
                {
                  "lon": 104.5014,
                  "lat": 31.2088
                },
                {
                  "lon": 104.5014,
                  "lat": 31.3886
                },
                {
                  "lon": 104.08,
                  "lat": 31.3886
                }
              ],
              [
                {
                  "lon": 78.2904,
                  "lat": 40.3786
                },
                {
                  "lon": 80.4207,
                  "lat": 40.3786
                },
                {
                  "lon": 80.4207,
                  "lat": 40.5584
                },
                {
                  "lon": 78.2904,
                  "lat": 40.5584
                },
                {
                  "lon": 78.2904,
                  "lat": 40.3786
                }
              ],
              [
                {
                  "lon": 109.2376,
                  "lat": 31.3886
                },
                {
                  "lon": 107.971,
                  "lat": 31.3886
                },
                {
                  "lon": 107.971,
                  "lat": 31.5684
                },
                {
                  "lon": 110.2931,
                  "lat": 31.5684
                },
                {
                  "lon": 110.2931,
                  "lat": 31.3886
                },
                {
                  "lon": 109.2376,
                  "lat": 31.3886
                }
              ],
              [
                {
                  "lon": 103.6518,
                  "lat": 38.0412
                },
                {
                  "lon": 100.4472,
                  "lat": 38.0412
                },
                {
                  "lon": 100.4472,
                  "lat": 38.221
                },
                {
                  "lon": 103.6518,
                  "lat": 38.221
                },
                {
                  "lon": 103.6518,
                  "lat": 38.0412
                }
              ],
              [
                {
                  "lon": 99.6505,
                  "lat": 36.0634
                },
                {
                  "lon": 99.428,
                  "lat": 36.0634
                },
                {
                  "lon": 99.428,
                  "lat": 35.8836
                },
                {
                  "lon": 101.653,
                  "lat": 35.8836
                },
                {
                  "lon": 101.653,
                  "lat": 36.0634
                },
                {
                  "lon": 99.6505,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 134.6865,
                  "lat": 47.211
                },
                {
                  "lon": 121.9761,
                  "lat": 47.211
                },
                {
                  "lon": 121.9761,
                  "lat": 47.0312
                },
                {
                  "lon": 135.2161,
                  "lat": 47.0312
                },
                {
                  "lon": 135.2161,
                  "lat": 47.211
                },
                {
                  "lon": 134.6865,
                  "lat": 47.211
                }
              ],
              [
                {
                  "lon": 109.444,
                  "lat": 20.6006
                },
                {
                  "lon": 110.7887,
                  "lat": 20.6006
                },
                {
                  "lon": 110.7887,
                  "lat": 20.4208
                },
                {
                  "lon": 109.0598,
                  "lat": 20.4208
                },
                {
                  "lon": 109.0598,
                  "lat": 20.6006
                },
                {
                  "lon": 109.444,
                  "lat": 20.6006
                }
              ],
              [
                {
                  "lon": 76.703,
                  "lat": 39.8392
                },
                {
                  "lon": 76.703,
                  "lat": 40.019
                },
                {
                  "lon": 76.9378,
                  "lat": 40.019
                },
                {
                  "lon": 76.9378,
                  "lat": 39.8392
                },
                {
                  "lon": 76.703,
                  "lat": 39.8392
                }
              ],
              [
                {
                  "lon": 117.8163,
                  "lat": 24.5562
                },
                {
                  "lon": 119.2023,
                  "lat": 24.5562
                },
                {
                  "lon": 119.2023,
                  "lat": 24.736
                },
                {
                  "lon": 116.8263,
                  "lat": 24.736
                },
                {
                  "lon": 116.8263,
                  "lat": 24.5562
                },
                {
                  "lon": 117.8163,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 131.1656,
                  "lat": 44.8736
                },
                {
                  "lon": 132.4346,
                  "lat": 44.8736
                },
                {
                  "lon": 132.4346,
                  "lat": 44.6938
                },
                {
                  "lon": 123.044,
                  "lat": 44.6938
                },
                {
                  "lon": 123.044,
                  "lat": 44.8736
                },
                {
                  "lon": 131.1656,
                  "lat": 44.8736
                }
              ],
              [
                {
                  "lon": 126.5578,
                  "lat": 51.8858
                },
                {
                  "lon": 127.4356,
                  "lat": 51.8858
                },
                {
                  "lon": 127.4356,
                  "lat": 52.0656
                },
                {
                  "lon": 123.0466,
                  "lat": 52.0656
                },
                {
                  "lon": 123.0466,
                  "lat": 51.8858
                },
                {
                  "lon": 126.5578,
                  "lat": 51.8858
                }
              ],
              [
                {
                  "lon": 106.6167,
                  "lat": 26.3542
                },
                {
                  "lon": 108.423,
                  "lat": 26.3542
                },
                {
                  "lon": 108.423,
                  "lat": 26.1744
                },
                {
                  "lon": 104.2083,
                  "lat": 26.1744
                },
                {
                  "lon": 104.2083,
                  "lat": 26.3542
                },
                {
                  "lon": 106.6167,
                  "lat": 26.3542
                }
              ],
              [
                {
                  "lon": 81.6798,
                  "lat": 40.7382
                },
                {
                  "lon": 78.1188,
                  "lat": 40.7382
                },
                {
                  "lon": 78.1188,
                  "lat": 40.5584
                },
                {
                  "lon": 81.9172,
                  "lat": 40.5584
                },
                {
                  "lon": 81.9172,
                  "lat": 40.7382
                },
                {
                  "lon": 81.6798,
                  "lat": 40.7382
                }
              ],
              [
                {
                  "lon": 122.395,
                  "lat": 38.9402
                },
                {
                  "lon": 120.7766,
                  "lat": 38.9402
                },
                {
                  "lon": 120.7766,
                  "lat": 38.7604
                },
                {
                  "lon": 122.395,
                  "lat": 38.7604
                },
                {
                  "lon": 122.395,
                  "lat": 38.9402
                }
              ],
              [
                {
                  "lon": 105.9642,
                  "lat": 25.2754
                },
                {
                  "lon": 106.5609,
                  "lat": 25.2754
                },
                {
                  "lon": 106.5609,
                  "lat": 25.0956
                },
                {
                  "lon": 104.1741,
                  "lat": 25.0956
                },
                {
                  "lon": 104.1741,
                  "lat": 25.2754
                },
                {
                  "lon": 105.9642,
                  "lat": 25.2754
                }
              ],
              [
                {
                  "lon": 123.2985,
                  "lat": 52.0656
                },
                {
                  "lon": 126.8229,
                  "lat": 52.0656
                },
                {
                  "lon": 126.8229,
                  "lat": 52.2454
                },
                {
                  "lon": 123.0048,
                  "lat": 52.2454
                },
                {
                  "lon": 123.0048,
                  "lat": 52.0656
                },
                {
                  "lon": 123.2985,
                  "lat": 52.0656
                }
              ],
              [
                {
                  "lon": 111.4535,
                  "lat": 24.0168
                },
                {
                  "lon": 113.0311,
                  "lat": 24.0168
                },
                {
                  "lon": 113.0311,
                  "lat": 24.1966
                },
                {
                  "lon": 111.4535,
                  "lat": 24.1966
                },
                {
                  "lon": 111.4535,
                  "lat": 24.0168
                }
              ],
              [
                {
                  "lon": 91.1755,
                  "lat": 30.13
                },
                {
                  "lon": 90.136,
                  "lat": 30.13
                },
                {
                  "lon": 90.136,
                  "lat": 29.9502
                },
                {
                  "lon": 91.7992,
                  "lat": 29.9502
                },
                {
                  "lon": 91.7992,
                  "lat": 30.13
                },
                {
                  "lon": 91.1755,
                  "lat": 30.13
                }
              ],
              [
                {
                  "lon": 122.1404,
                  "lat": 45.2332
                },
                {
                  "lon": 120.8594,
                  "lat": 45.2332
                },
                {
                  "lon": 120.8594,
                  "lat": 45.413
                },
                {
                  "lon": 133.9256,
                  "lat": 45.413
                },
                {
                  "lon": 133.9256,
                  "lat": 45.2332
                },
                {
                  "lon": 122.1404,
                  "lat": 45.2332
                }
              ],
              [
                {
                  "lon": 108.155,
                  "lat": 18.8026
                },
                {
                  "lon": 108.155,
                  "lat": 18.9824
                },
                {
                  "lon": 111.1982,
                  "lat": 18.9824
                },
                {
                  "lon": 111.1982,
                  "lat": 18.8026
                },
                {
                  "lon": 108.155,
                  "lat": 18.8026
                }
              ],
              [
                {
                  "lon": 81.5938,
                  "lat": 44.514
                },
                {
                  "lon": 80.0758,
                  "lat": 44.514
                },
                {
                  "lon": 80.0758,
                  "lat": 44.6938
                },
                {
                  "lon": 86.1478,
                  "lat": 44.6938
                },
                {
                  "lon": 86.1478,
                  "lat": 44.514
                },
                {
                  "lon": 81.5938,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 91.0094,
                  "lat": 29.0512
                },
                {
                  "lon": 90.3923,
                  "lat": 29.0512
                },
                {
                  "lon": 90.3923,
                  "lat": 28.8714
                },
                {
                  "lon": 92.2436,
                  "lat": 28.8714
                },
                {
                  "lon": 92.2436,
                  "lat": 29.0512
                },
                {
                  "lon": 91.0094,
                  "lat": 29.0512
                }
              ],
              [
                {
                  "lon": 115.608,
                  "lat": 28.5118
                },
                {
                  "lon": 121.9537,
                  "lat": 28.5118
                },
                {
                  "lon": 121.9537,
                  "lat": 28.332
                },
                {
                  "lon": 115.4033,
                  "lat": 28.332
                },
                {
                  "lon": 115.4033,
                  "lat": 28.5118
                },
                {
                  "lon": 115.608,
                  "lat": 28.5118
                }
              ],
              [
                {
                  "lon": 103.0041,
                  "lat": 26.1744
                },
                {
                  "lon": 103.8069,
                  "lat": 26.1744
                },
                {
                  "lon": 103.8069,
                  "lat": 26.3542
                },
                {
                  "lon": 102.6027,
                  "lat": 26.3542
                },
                {
                  "lon": 102.6027,
                  "lat": 26.1744
                },
                {
                  "lon": 103.0041,
                  "lat": 26.1744
                }
              ],
              [
                {
                  "lon": 110.0595,
                  "lat": 25.0956
                },
                {
                  "lon": 110.2581,
                  "lat": 25.0956
                },
                {
                  "lon": 110.2581,
                  "lat": 24.9158
                },
                {
                  "lon": 108.8679,
                  "lat": 24.9158
                },
                {
                  "lon": 108.8679,
                  "lat": 25.0956
                },
                {
                  "lon": 110.0595,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 125.6235,
                  "lat": 47.5706
                },
                {
                  "lon": 125.6235,
                  "lat": 47.3908
                },
                {
                  "lon": 121.3579,
                  "lat": 47.3908
                },
                {
                  "lon": 121.3579,
                  "lat": 47.5706
                },
                {
                  "lon": 125.6235,
                  "lat": 47.5706
                }
              ],
              [
                {
                  "lon": 121.0937,
                  "lat": 31.7482
                },
                {
                  "lon": 113.6772,
                  "lat": 31.7482
                },
                {
                  "lon": 113.6772,
                  "lat": 31.928
                },
                {
                  "lon": 122.577,
                  "lat": 31.928
                },
                {
                  "lon": 122.577,
                  "lat": 31.7482
                },
                {
                  "lon": 121.0937,
                  "lat": 31.7482
                }
              ],
              [
                {
                  "lon": 81.3033,
                  "lat": 40.1988
                },
                {
                  "lon": 80.595,
                  "lat": 40.1988
                },
                {
                  "lon": 80.595,
                  "lat": 40.3786
                },
                {
                  "lon": 81.7755,
                  "lat": 40.3786
                },
                {
                  "lon": 81.7755,
                  "lat": 40.1988
                },
                {
                  "lon": 81.3033,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 127.0627,
                  "lat": 43.615
                },
                {
                  "lon": 120.8327,
                  "lat": 43.615
                },
                {
                  "lon": 120.8327,
                  "lat": 43.7948
                },
                {
                  "lon": 127.5611,
                  "lat": 43.7948
                },
                {
                  "lon": 127.5611,
                  "lat": 43.615
                },
                {
                  "lon": 127.0627,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 82.7059,
                  "lat": 43.0756
                },
                {
                  "lon": 85.4218,
                  "lat": 43.0756
                },
                {
                  "lon": 85.4218,
                  "lat": 43.2554
                },
                {
                  "lon": 81.7183,
                  "lat": 43.2554
                },
                {
                  "lon": 81.7183,
                  "lat": 43.0756
                },
                {
                  "lon": 82.7059,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 117.8559,
                  "lat": 26.1744
                },
                {
                  "lon": 117.8559,
                  "lat": 26.3542
                },
                {
                  "lon": 120.6657,
                  "lat": 26.3542
                },
                {
                  "lon": 120.6657,
                  "lat": 26.1744
                },
                {
                  "lon": 117.8559,
                  "lat": 26.1744
                }
              ],
              [
                {
                  "lon": 113.6103,
                  "lat": 27.0734
                },
                {
                  "lon": 113.4083,
                  "lat": 27.0734
                },
                {
                  "lon": 113.4083,
                  "lat": 26.8936
                },
                {
                  "lon": 116.8423,
                  "lat": 26.8936
                },
                {
                  "lon": 116.8423,
                  "lat": 27.0734
                },
                {
                  "lon": 113.6103,
                  "lat": 27.0734
                }
              ],
              [
                {
                  "lon": 99.023,
                  "lat": 39.4796
                },
                {
                  "lon": 97.3878,
                  "lat": 39.4796
                },
                {
                  "lon": 97.3878,
                  "lat": 39.6594
                },
                {
                  "lon": 100.4246,
                  "lat": 39.6594
                },
                {
                  "lon": 100.4246,
                  "lat": 39.4796
                },
                {
                  "lon": 99.023,
                  "lat": 39.4796
                }
              ],
              [
                {
                  "lon": 112.1146,
                  "lat": 28.8714
                },
                {
                  "lon": 114.374,
                  "lat": 28.8714
                },
                {
                  "lon": 114.374,
                  "lat": 28.6916
                },
                {
                  "lon": 110.8822,
                  "lat": 28.6916
                },
                {
                  "lon": 110.8822,
                  "lat": 28.8714
                },
                {
                  "lon": 112.1146,
                  "lat": 28.8714
                }
              ],
              [
                {
                  "lon": 116.5218,
                  "lat": 24.736
                },
                {
                  "lon": 116.5218,
                  "lat": 24.9158
                },
                {
                  "lon": 119.4963,
                  "lat": 24.9158
                },
                {
                  "lon": 119.4963,
                  "lat": 24.736
                },
                {
                  "lon": 116.5218,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 95.8996,
                  "lat": 29.7704
                },
                {
                  "lon": 95.0692,
                  "lat": 29.7704
                },
                {
                  "lon": 95.0692,
                  "lat": 29.9502
                },
                {
                  "lon": 98.3908,
                  "lat": 29.9502
                },
                {
                  "lon": 98.3908,
                  "lat": 29.7704
                },
                {
                  "lon": 95.8996,
                  "lat": 29.7704
                }
              ],
              [
                {
                  "lon": 120.22,
                  "lat": 43.9746
                },
                {
                  "lon": 120.22,
                  "lat": 44.1544
                },
                {
                  "lon": 118.7158,
                  "lat": 44.1544
                },
                {
                  "lon": 118.7158,
                  "lat": 43.9746
                },
                {
                  "lon": 120.22,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 111.0737,
                  "lat": 21.14
                },
                {
                  "lon": 109.1427,
                  "lat": 21.14
                },
                {
                  "lon": 109.1427,
                  "lat": 21.3198
                },
                {
                  "lon": 111.653,
                  "lat": 21.3198
                },
                {
                  "lon": 111.653,
                  "lat": 21.14
                },
                {
                  "lon": 111.0737,
                  "lat": 21.14
                }
              ],
              [
                {
                  "lon": 110.3042,
                  "lat": 21.8592
                },
                {
                  "lon": 109.7228,
                  "lat": 21.8592
                },
                {
                  "lon": 109.7228,
                  "lat": 21.6794
                },
                {
                  "lon": 113.7926,
                  "lat": 21.6794
                },
                {
                  "lon": 113.7926,
                  "lat": 21.8592
                },
                {
                  "lon": 110.3042,
                  "lat": 21.8592
                }
              ],
              [
                {
                  "lon": 107.5431,
                  "lat": 25.9946
                },
                {
                  "lon": 108.7455,
                  "lat": 25.9946
                },
                {
                  "lon": 108.7455,
                  "lat": 26.1744
                },
                {
                  "lon": 104.1363,
                  "lat": 26.1744
                },
                {
                  "lon": 104.1363,
                  "lat": 25.9946
                },
                {
                  "lon": 107.5431,
                  "lat": 25.9946
                }
              ],
              [
                {
                  "lon": 109.4265,
                  "lat": 26.1744
                },
                {
                  "lon": 110.0286,
                  "lat": 26.1744
                },
                {
                  "lon": 110.0286,
                  "lat": 26.3542
                },
                {
                  "lon": 109.2258,
                  "lat": 26.3542
                },
                {
                  "lon": 109.2258,
                  "lat": 26.1744
                },
                {
                  "lon": 109.4265,
                  "lat": 26.1744
                }
              ],
              [
                {
                  "lon": 106.9086,
                  "lat": 40.1988
                },
                {
                  "lon": 106.4376,
                  "lat": 40.1988
                },
                {
                  "lon": 106.4376,
                  "lat": 40.019
                },
                {
                  "lon": 107.6151,
                  "lat": 40.019
                },
                {
                  "lon": 107.6151,
                  "lat": 40.1988
                },
                {
                  "lon": 106.9086,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 116.3486,
                  "lat": 26.8936
                },
                {
                  "lon": 113.1214,
                  "lat": 26.8936
                },
                {
                  "lon": 113.1214,
                  "lat": 26.7138
                },
                {
                  "lon": 116.3486,
                  "lat": 26.7138
                },
                {
                  "lon": 116.3486,
                  "lat": 26.8936
                }
              ],
              [
                {
                  "lon": 124.0154,
                  "lat": 49.009
                },
                {
                  "lon": 127.8682,
                  "lat": 49.009
                },
                {
                  "lon": 127.8682,
                  "lat": 49.1888
                },
                {
                  "lon": 124.0154,
                  "lat": 49.1888
                },
                {
                  "lon": 124.0154,
                  "lat": 49.009
                }
              ],
              [
                {
                  "lon": 122.6119,
                  "lat": 43.615
                },
                {
                  "lon": 127.0831,
                  "lat": 43.615
                },
                {
                  "lon": 127.0831,
                  "lat": 43.4352
                },
                {
                  "lon": 120.8731,
                  "lat": 43.4352
                },
                {
                  "lon": 120.8731,
                  "lat": 43.615
                },
                {
                  "lon": 122.6119,
                  "lat": 43.615
                }
              ],
              [
                {
                  "lon": 77.8212,
                  "lat": 39.8392
                },
                {
                  "lon": 77.587,
                  "lat": 39.8392
                },
                {
                  "lon": 77.587,
                  "lat": 39.6594
                },
                {
                  "lon": 78.0554,
                  "lat": 39.6594
                },
                {
                  "lon": 78.0554,
                  "lat": 39.8392
                },
                {
                  "lon": 77.8212,
                  "lat": 39.8392
                }
              ],
              [
                {
                  "lon": 113.4474,
                  "lat": 29.231
                },
                {
                  "lon": 114.0669,
                  "lat": 29.231
                },
                {
                  "lon": 114.0669,
                  "lat": 29.4108
                },
                {
                  "lon": 112.4149,
                  "lat": 29.4108
                },
                {
                  "lon": 112.4149,
                  "lat": 29.231
                },
                {
                  "lon": 113.4474,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 112.9701,
                  "lat": 22.039
                },
                {
                  "lon": 109.8613,
                  "lat": 22.039
                },
                {
                  "lon": 109.8613,
                  "lat": 22.2188
                },
                {
                  "lon": 114.3302,
                  "lat": 22.2188
                },
                {
                  "lon": 114.3302,
                  "lat": 22.039
                },
                {
                  "lon": 112.9701,
                  "lat": 22.039
                }
              ],
              [
                {
                  "lon": 114.3806,
                  "lat": 42.5362
                },
                {
                  "lon": 114.3806,
                  "lat": 42.3564
                },
                {
                  "lon": 116.5775,
                  "lat": 42.3564
                },
                {
                  "lon": 116.5775,
                  "lat": 42.5362
                },
                {
                  "lon": 114.3806,
                  "lat": 42.5362
                }
              ],
              [
                {
                  "lon": 125.9989,
                  "lat": 46.8514
                },
                {
                  "lon": 128.6289,
                  "lat": 46.8514
                },
                {
                  "lon": 128.6289,
                  "lat": 46.6716
                },
                {
                  "lon": 122.0539,
                  "lat": 46.6716
                },
                {
                  "lon": 122.0539,
                  "lat": 46.8514
                },
                {
                  "lon": 125.9989,
                  "lat": 46.8514
                }
              ],
              [
                {
                  "lon": 75.8722,
                  "lat": 38.7604
                },
                {
                  "lon": 76.7946,
                  "lat": 38.7604
                },
                {
                  "lon": 76.7946,
                  "lat": 38.5806
                },
                {
                  "lon": 75.6416,
                  "lat": 38.5806
                },
                {
                  "lon": 75.6416,
                  "lat": 38.7604
                },
                {
                  "lon": 75.8722,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 84.2785,
                  "lat": 43.2554
                },
                {
                  "lon": 81.5538,
                  "lat": 43.2554
                },
                {
                  "lon": 81.5538,
                  "lat": 43.4352
                },
                {
                  "lon": 85.2693,
                  "lat": 43.4352
                },
                {
                  "lon": 85.2693,
                  "lat": 43.2554
                },
                {
                  "lon": 84.2785,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 77.8862,
                  "lat": 39.2998
                },
                {
                  "lon": 78.5834,
                  "lat": 39.2998
                },
                {
                  "lon": 78.5834,
                  "lat": 39.12
                },
                {
                  "lon": 75.3298,
                  "lat": 39.12
                },
                {
                  "lon": 75.3298,
                  "lat": 39.2998
                },
                {
                  "lon": 77.8862,
                  "lat": 39.2998
                }
              ],
              [
                {
                  "lon": 110.2807,
                  "lat": 41.2776
                },
                {
                  "lon": 110.5207,
                  "lat": 41.2776
                },
                {
                  "lon": 110.5207,
                  "lat": 41.4574
                },
                {
                  "lon": 109.5607,
                  "lat": 41.4574
                },
                {
                  "lon": 109.5607,
                  "lat": 41.2776
                },
                {
                  "lon": 110.2807,
                  "lat": 41.2776
                }
              ],
              [
                {
                  "lon": 81.917,
                  "lat": 45.2332
                },
                {
                  "lon": 82.1732,
                  "lat": 45.2332
                },
                {
                  "lon": 82.1732,
                  "lat": 45.413
                },
                {
                  "lon": 81.917,
                  "lat": 45.413
                },
                {
                  "lon": 81.917,
                  "lat": 45.2332
                }
              ],
              [
                {
                  "lon": 105.3693,
                  "lat": 27.6128
                },
                {
                  "lon": 105.7753,
                  "lat": 27.6128
                },
                {
                  "lon": 105.7753,
                  "lat": 27.433
                },
                {
                  "lon": 104.7603,
                  "lat": 27.433
                },
                {
                  "lon": 104.7603,
                  "lat": 27.6128
                },
                {
                  "lon": 105.3693,
                  "lat": 27.6128
                }
              ],
              [
                {
                  "lon": 119.7823,
                  "lat": 27.6128
                },
                {
                  "lon": 121.2033,
                  "lat": 27.6128
                },
                {
                  "lon": 121.2033,
                  "lat": 27.433
                },
                {
                  "lon": 118.9703,
                  "lat": 27.433
                },
                {
                  "lon": 118.9703,
                  "lat": 27.6128
                },
                {
                  "lon": 119.7823,
                  "lat": 27.6128
                }
              ],
              [
                {
                  "lon": 98.2515,
                  "lat": 35.524
                },
                {
                  "lon": 98.2515,
                  "lat": 35.3442
                },
                {
                  "lon": 98.0305,
                  "lat": 35.3442
                },
                {
                  "lon": 98.0305,
                  "lat": 35.524
                },
                {
                  "lon": 98.2515,
                  "lat": 35.524
                }
              ],
              [
                {
                  "lon": 83.8613,
                  "lat": 42.8958
                },
                {
                  "lon": 83.1227,
                  "lat": 42.8958
                },
                {
                  "lon": 83.1227,
                  "lat": 43.0756
                },
                {
                  "lon": 85.3385,
                  "lat": 43.0756
                },
                {
                  "lon": 85.3385,
                  "lat": 42.8958
                },
                {
                  "lon": 83.8613,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 120.7894,
                  "lat": 48.8292
                },
                {
                  "lon": 121.609,
                  "lat": 48.8292
                },
                {
                  "lon": 121.609,
                  "lat": 48.6494
                },
                {
                  "lon": 120.5162,
                  "lat": 48.6494
                },
                {
                  "lon": 120.5162,
                  "lat": 48.8292
                },
                {
                  "lon": 120.7894,
                  "lat": 48.8292
                }
              ],
              [
                {
                  "lon": 101.4816,
                  "lat": 38.221
                },
                {
                  "lon": 103.5471,
                  "lat": 38.221
                },
                {
                  "lon": 103.5471,
                  "lat": 38.4008
                },
                {
                  "lon": 100.1046,
                  "lat": 38.4008
                },
                {
                  "lon": 100.1046,
                  "lat": 38.221
                },
                {
                  "lon": 101.4816,
                  "lat": 38.221
                }
              ],
              [
                {
                  "lon": 111.3302,
                  "lat": 22.039
                },
                {
                  "lon": 113.8522,
                  "lat": 22.039
                },
                {
                  "lon": 113.8522,
                  "lat": 21.8592
                },
                {
                  "lon": 109.5842,
                  "lat": 21.8592
                },
                {
                  "lon": 109.5842,
                  "lat": 22.039
                },
                {
                  "lon": 111.3302,
                  "lat": 22.039
                }
              ],
              [
                {
                  "lon": 128.7617,
                  "lat": 43.9746
                },
                {
                  "lon": 129.7613,
                  "lat": 43.9746
                },
                {
                  "lon": 129.7613,
                  "lat": 43.7948
                },
                {
                  "lon": 128.012,
                  "lat": 43.7948
                },
                {
                  "lon": 128.012,
                  "lat": 43.9746
                },
                {
                  "lon": 128.7617,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 115.7188,
                  "lat": 27.2532
                },
                {
                  "lon": 116.528,
                  "lat": 27.2532
                },
                {
                  "lon": 116.528,
                  "lat": 27.0734
                },
                {
                  "lon": 113.0889,
                  "lat": 27.0734
                },
                {
                  "lon": 113.0889,
                  "lat": 27.2532
                },
                {
                  "lon": 115.7188,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 94.9944,
                  "lat": 37.6816
                },
                {
                  "lon": 94.311,
                  "lat": 37.6816
                },
                {
                  "lon": 94.311,
                  "lat": 37.8614
                },
                {
                  "lon": 96.589,
                  "lat": 37.8614
                },
                {
                  "lon": 96.589,
                  "lat": 37.6816
                },
                {
                  "lon": 94.9944,
                  "lat": 37.6816
                }
              ],
              [
                {
                  "lon": 82.5192,
                  "lat": 45.0534
                },
                {
                  "lon": 80.2278,
                  "lat": 45.0534
                },
                {
                  "lon": 80.2278,
                  "lat": 44.8736
                },
                {
                  "lon": 83.283,
                  "lat": 44.8736
                },
                {
                  "lon": 83.283,
                  "lat": 45.0534
                },
                {
                  "lon": 82.5192,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 119.9949,
                  "lat": 42.3564
                },
                {
                  "lon": 117.0657,
                  "lat": 42.3564
                },
                {
                  "lon": 117.0657,
                  "lat": 42.5362
                },
                {
                  "lon": 121.7036,
                  "lat": 42.5362
                },
                {
                  "lon": 121.7036,
                  "lat": 42.3564
                },
                {
                  "lon": 119.9949,
                  "lat": 42.3564
                }
              ],
              [
                {
                  "lon": 135.4884,
                  "lat": 47.7504
                },
                {
                  "lon": 129.8709,
                  "lat": 47.7504
                },
                {
                  "lon": 129.8709,
                  "lat": 47.5706
                },
                {
                  "lon": 135.4884,
                  "lat": 47.5706
                },
                {
                  "lon": 135.4884,
                  "lat": 47.7504
                }
              ],
              [
                {
                  "lon": 120.6718,
                  "lat": 49.1888
                },
                {
                  "lon": 119.0146,
                  "lat": 49.1888
                },
                {
                  "lon": 119.0146,
                  "lat": 49.3686
                },
                {
                  "lon": 121.7766,
                  "lat": 49.3686
                },
                {
                  "lon": 121.7766,
                  "lat": 49.1888
                },
                {
                  "lon": 120.6718,
                  "lat": 49.1888
                }
              ],
              [
                {
                  "lon": 96.9805,
                  "lat": 36.0634
                },
                {
                  "lon": 98.7605,
                  "lat": 36.0634
                },
                {
                  "lon": 98.7605,
                  "lat": 35.8836
                },
                {
                  "lon": 96.758,
                  "lat": 35.8836
                },
                {
                  "lon": 96.758,
                  "lat": 36.0634
                },
                {
                  "lon": 96.9805,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 110.3042,
                  "lat": 19.1622
                },
                {
                  "lon": 111.2562,
                  "lat": 19.1622
                },
                {
                  "lon": 111.2562,
                  "lat": 18.9824
                },
                {
                  "lon": 107.829,
                  "lat": 18.9824
                },
                {
                  "lon": 107.829,
                  "lat": 19.1622
                },
                {
                  "lon": 110.3042,
                  "lat": 19.1622
                }
              ],
              [
                {
                  "lon": 116.5063,
                  "lat": 42.5362
                },
                {
                  "lon": 114.5479,
                  "lat": 42.5362
                },
                {
                  "lon": 114.5479,
                  "lat": 42.716
                },
                {
                  "lon": 116.7511,
                  "lat": 42.716
                },
                {
                  "lon": 116.7511,
                  "lat": 42.5362
                },
                {
                  "lon": 116.5063,
                  "lat": 42.5362
                }
              ],
              [
                {
                  "lon": 114.8237,
                  "lat": 23.6572
                },
                {
                  "lon": 118.1659,
                  "lat": 23.6572
                },
                {
                  "lon": 118.1659,
                  "lat": 23.837
                },
                {
                  "lon": 111.0883,
                  "lat": 23.837
                },
                {
                  "lon": 111.0883,
                  "lat": 23.6572
                },
                {
                  "lon": 114.8237,
                  "lat": 23.6572
                }
              ],
              [
                {
                  "lon": 126.1603,
                  "lat": 43.0756
                },
                {
                  "lon": 127.3948,
                  "lat": 43.0756
                },
                {
                  "lon": 127.3948,
                  "lat": 43.2554
                },
                {
                  "lon": 120.2347,
                  "lat": 43.2554
                },
                {
                  "lon": 120.2347,
                  "lat": 43.0756
                },
                {
                  "lon": 126.1603,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 80.531,
                  "lat": 43.7948
                },
                {
                  "lon": 80.0312,
                  "lat": 43.7948
                },
                {
                  "lon": 80.0312,
                  "lat": 43.9746
                },
                {
                  "lon": 85.0292,
                  "lat": 43.9746
                },
                {
                  "lon": 85.0292,
                  "lat": 43.7948
                },
                {
                  "lon": 80.531,
                  "lat": 43.7948
                }
              ],
              [
                {
                  "lon": 134.979,
                  "lat": 48.4696
                },
                {
                  "lon": 134.979,
                  "lat": 48.6494
                },
                {
                  "lon": 133.3458,
                  "lat": 48.6494
                },
                {
                  "lon": 133.3458,
                  "lat": 48.4696
                },
                {
                  "lon": 134.979,
                  "lat": 48.4696
                }
              ],
              [
                {
                  "lon": 111.1058,
                  "lat": 19.8814
                },
                {
                  "lon": 108.429,
                  "lat": 19.8814
                },
                {
                  "lon": 108.429,
                  "lat": 19.7016
                },
                {
                  "lon": 111.6794,
                  "lat": 19.7016
                },
                {
                  "lon": 111.6794,
                  "lat": 19.8814
                },
                {
                  "lon": 111.1058,
                  "lat": 19.8814
                }
              ],
              [
                {
                  "lon": 130.1557,
                  "lat": 47.5706
                },
                {
                  "lon": 129.6225,
                  "lat": 47.5706
                },
                {
                  "lon": 129.6225,
                  "lat": 47.3908
                },
                {
                  "lon": 134.9545,
                  "lat": 47.3908
                },
                {
                  "lon": 134.9545,
                  "lat": 47.5706
                },
                {
                  "lon": 130.1557,
                  "lat": 47.5706
                }
              ],
              [
                {
                  "lon": 105.389,
                  "lat": 38.7604
                },
                {
                  "lon": 104.6972,
                  "lat": 38.7604
                },
                {
                  "lon": 104.6972,
                  "lat": 38.5806
                },
                {
                  "lon": 106.3114,
                  "lat": 38.5806
                },
                {
                  "lon": 106.3114,
                  "lat": 38.7604
                },
                {
                  "lon": 105.389,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 129.1231,
                  "lat": 43.0756
                },
                {
                  "lon": 127.6417,
                  "lat": 43.0756
                },
                {
                  "lon": 127.6417,
                  "lat": 43.2554
                },
                {
                  "lon": 130.8514,
                  "lat": 43.2554
                },
                {
                  "lon": 130.8514,
                  "lat": 43.0756
                },
                {
                  "lon": 129.1231,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 110.7602,
                  "lat": 18.8026
                },
                {
                  "lon": 110.9502,
                  "lat": 18.8026
                },
                {
                  "lon": 110.9502,
                  "lat": 18.6228
                },
                {
                  "lon": 108.2902,
                  "lat": 18.6228
                },
                {
                  "lon": 108.2902,
                  "lat": 18.8026
                },
                {
                  "lon": 110.7602,
                  "lat": 18.8026
                }
              ],
              [
                {
                  "lon": 109.1215,
                  "lat": 27.2532
                },
                {
                  "lon": 110.7423,
                  "lat": 27.2532
                },
                {
                  "lon": 110.7423,
                  "lat": 27.433
                },
                {
                  "lon": 108.9189,
                  "lat": 27.433
                },
                {
                  "lon": 108.9189,
                  "lat": 27.2532
                },
                {
                  "lon": 109.1215,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 128.0948,
                  "lat": 49.5484
                },
                {
                  "lon": 129.764,
                  "lat": 49.5484
                },
                {
                  "lon": 129.764,
                  "lat": 49.7282
                },
                {
                  "lon": 123.9218,
                  "lat": 49.7282
                },
                {
                  "lon": 123.9218,
                  "lat": 49.5484
                },
                {
                  "lon": 128.0948,
                  "lat": 49.5484
                }
              ],
              [
                {
                  "lon": 115.2468,
                  "lat": 26.1744
                },
                {
                  "lon": 116.2503,
                  "lat": 26.1744
                },
                {
                  "lon": 116.2503,
                  "lat": 26.3542
                },
                {
                  "lon": 113.8419,
                  "lat": 26.3542
                },
                {
                  "lon": 113.8419,
                  "lat": 26.1744
                },
                {
                  "lon": 115.2468,
                  "lat": 26.1744
                }
              ],
              [
                {
                  "lon": 109.8458,
                  "lat": 19.5218
                },
                {
                  "lon": 111.3722,
                  "lat": 19.5218
                },
                {
                  "lon": 111.3722,
                  "lat": 19.342
                },
                {
                  "lon": 108.3194,
                  "lat": 19.342
                },
                {
                  "lon": 108.3194,
                  "lat": 19.5218
                },
                {
                  "lon": 109.8458,
                  "lat": 19.5218
                }
              ],
              [
                {
                  "lon": 103.1476,
                  "lat": 31.2088
                },
                {
                  "lon": 102.9373,
                  "lat": 31.2088
                },
                {
                  "lon": 102.9373,
                  "lat": 31.029
                },
                {
                  "lon": 104.83,
                  "lat": 31.029
                },
                {
                  "lon": 104.83,
                  "lat": 31.2088
                },
                {
                  "lon": 103.1476,
                  "lat": 31.2088
                }
              ],
              [
                {
                  "lon": 124.3632,
                  "lat": 48.4696
                },
                {
                  "lon": 122.1856,
                  "lat": 48.4696
                },
                {
                  "lon": 122.1856,
                  "lat": 48.6494
                },
                {
                  "lon": 128.174,
                  "lat": 48.6494
                },
                {
                  "lon": 128.174,
                  "lat": 48.4696
                },
                {
                  "lon": 124.3632,
                  "lat": 48.4696
                }
              ],
              [
                {
                  "lon": 84.4664,
                  "lat": 44.6938
                },
                {
                  "lon": 80.4056,
                  "lat": 44.6938
                },
                {
                  "lon": 80.4056,
                  "lat": 44.8736
                },
                {
                  "lon": 86.243,
                  "lat": 44.8736
                },
                {
                  "lon": 86.243,
                  "lat": 44.6938
                },
                {
                  "lon": 84.4664,
                  "lat": 44.6938
                }
              ],
              [
                {
                  "lon": 121.2771,
                  "lat": 38.0412
                },
                {
                  "lon": 121.2771,
                  "lat": 38.221
                },
                {
                  "lon": 120.3615,
                  "lat": 38.221
                },
                {
                  "lon": 120.3615,
                  "lat": 38.0412
                },
                {
                  "lon": 121.2771,
                  "lat": 38.0412
                }
              ],
              [
                {
                  "lon": 107.9964,
                  "lat": 30.6694
                },
                {
                  "lon": 110.0914,
                  "lat": 30.6694
                },
                {
                  "lon": 110.0914,
                  "lat": 30.8492
                },
                {
                  "lon": 107.1584,
                  "lat": 30.8492
                },
                {
                  "lon": 107.1584,
                  "lat": 30.6694
                },
                {
                  "lon": 107.9964,
                  "lat": 30.6694
                }
              ],
              [
                {
                  "lon": 109.9087,
                  "lat": 23.837
                },
                {
                  "lon": 109.9087,
                  "lat": 23.6572
                },
                {
                  "lon": 108.7291,
                  "lat": 23.6572
                },
                {
                  "lon": 108.7291,
                  "lat": 23.837
                },
                {
                  "lon": 109.9087,
                  "lat": 23.837
                }
              ],
              [
                {
                  "lon": 102.6342,
                  "lat": 37.8614
                },
                {
                  "lon": 101.4922,
                  "lat": 37.8614
                },
                {
                  "lon": 101.4922,
                  "lat": 38.0412
                },
                {
                  "lon": 103.7762,
                  "lat": 38.0412
                },
                {
                  "lon": 103.7762,
                  "lat": 37.8614
                },
                {
                  "lon": 102.6342,
                  "lat": 37.8614
                }
              ],
              [
                {
                  "lon": 134.1567,
                  "lat": 47.211
                },
                {
                  "lon": 135.2195,
                  "lat": 47.211
                },
                {
                  "lon": 135.2195,
                  "lat": 47.3908
                },
                {
                  "lon": 129.3741,
                  "lat": 47.3908
                },
                {
                  "lon": 129.3741,
                  "lat": 47.211
                },
                {
                  "lon": 134.1567,
                  "lat": 47.211
                }
              ],
              [
                {
                  "lon": 118.551,
                  "lat": 27.2532
                },
                {
                  "lon": 120.7763,
                  "lat": 27.2532
                },
                {
                  "lon": 120.7763,
                  "lat": 27.0734
                },
                {
                  "lon": 118.551,
                  "lat": 27.0734
                },
                {
                  "lon": 118.551,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 121.7013,
                  "lat": 37.6816
                },
                {
                  "lon": 119.6565,
                  "lat": 37.6816
                },
                {
                  "lon": 119.6565,
                  "lat": 37.5018
                },
                {
                  "lon": 123.0645,
                  "lat": 37.5018
                },
                {
                  "lon": 123.0645,
                  "lat": 37.6816
                },
                {
                  "lon": 121.7013,
                  "lat": 37.6816
                }
              ],
              [
                {
                  "lon": 114.435,
                  "lat": 22.938
                },
                {
                  "lon": 116.7786,
                  "lat": 22.938
                },
                {
                  "lon": 116.7786,
                  "lat": 22.7582
                },
                {
                  "lon": 110.529,
                  "lat": 22.7582
                },
                {
                  "lon": 110.529,
                  "lat": 22.938
                },
                {
                  "lon": 114.435,
                  "lat": 22.938
                }
              ],
              [
                {
                  "lon": 100.8281,
                  "lat": 37.322
                },
                {
                  "lon": 100.6019,
                  "lat": 37.322
                },
                {
                  "lon": 100.6019,
                  "lat": 37.1422
                },
                {
                  "lon": 102.1853,
                  "lat": 37.1422
                },
                {
                  "lon": 102.1853,
                  "lat": 37.322
                },
                {
                  "lon": 100.8281,
                  "lat": 37.322
                }
              ],
              [
                {
                  "lon": 105.1822,
                  "lat": 38.9402
                },
                {
                  "lon": 106.3412,
                  "lat": 38.9402
                },
                {
                  "lon": 106.3412,
                  "lat": 39.12
                },
                {
                  "lon": 105.1822,
                  "lat": 39.12
                },
                {
                  "lon": 105.1822,
                  "lat": 38.9402
                }
              ],
              [
                {
                  "lon": 121.6587,
                  "lat": 28.8714
                },
                {
                  "lon": 115.4877,
                  "lat": 28.8714
                },
                {
                  "lon": 115.4877,
                  "lat": 29.0512
                },
                {
                  "lon": 122.4815,
                  "lat": 29.0512
                },
                {
                  "lon": 122.4815,
                  "lat": 28.8714
                },
                {
                  "lon": 121.6587,
                  "lat": 28.8714
                }
              ],
              [
                {
                  "lon": 121.4082,
                  "lat": 39.12
                },
                {
                  "lon": 120.481,
                  "lat": 39.12
                },
                {
                  "lon": 120.481,
                  "lat": 38.9402
                },
                {
                  "lon": 122.5672,
                  "lat": 38.9402
                },
                {
                  "lon": 122.5672,
                  "lat": 39.12
                },
                {
                  "lon": 121.4082,
                  "lat": 39.12
                }
              ],
              [
                {
                  "lon": 109.3904,
                  "lat": 20.9602
                },
                {
                  "lon": 109.0052,
                  "lat": 20.9602
                },
                {
                  "lon": 109.0052,
                  "lat": 20.7804
                },
                {
                  "lon": 110.9312,
                  "lat": 20.7804
                },
                {
                  "lon": 110.9312,
                  "lat": 20.9602
                },
                {
                  "lon": 109.3904,
                  "lat": 20.9602
                }
              ],
              [
                {
                  "lon": 87.1959,
                  "lat": 42.1766
                },
                {
                  "lon": 88.8997,
                  "lat": 42.1766
                },
                {
                  "lon": 88.8997,
                  "lat": 42.3564
                },
                {
                  "lon": 85.4921,
                  "lat": 42.3564
                },
                {
                  "lon": 85.4921,
                  "lat": 42.1766
                },
                {
                  "lon": 87.1959,
                  "lat": 42.1766
                }
              ],
              [
                {
                  "lon": 110.4903,
                  "lat": 24.736
                },
                {
                  "lon": 110.6883,
                  "lat": 24.736
                },
                {
                  "lon": 110.6883,
                  "lat": 24.5562
                },
                {
                  "lon": 108.7083,
                  "lat": 24.5562
                },
                {
                  "lon": 108.7083,
                  "lat": 24.736
                },
                {
                  "lon": 110.4903,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 111.6342,
                  "lat": 26.3542
                },
                {
                  "lon": 112.2363,
                  "lat": 26.3542
                },
                {
                  "lon": 112.2363,
                  "lat": 26.1744
                },
                {
                  "lon": 111.4335,
                  "lat": 26.1744
                },
                {
                  "lon": 111.4335,
                  "lat": 26.3542
                },
                {
                  "lon": 111.6342,
                  "lat": 26.3542
                }
              ],
              [
                {
                  "lon": 94.1916,
                  "lat": 40.019
                },
                {
                  "lon": 96.3111,
                  "lat": 40.019
                },
                {
                  "lon": 96.3111,
                  "lat": 40.1988
                },
                {
                  "lon": 93.9561,
                  "lat": 40.1988
                },
                {
                  "lon": 93.9561,
                  "lat": 40.019
                },
                {
                  "lon": 94.1916,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 105.8044,
                  "lat": 32.827
                },
                {
                  "lon": 105.8044,
                  "lat": 33.0068
                },
                {
                  "lon": 104.0884,
                  "lat": 33.0068
                },
                {
                  "lon": 104.0884,
                  "lat": 32.827
                },
                {
                  "lon": 105.8044,
                  "lat": 32.827
                }
              ],
              [
                {
                  "lon": 116.8707,
                  "lat": 25.9946
                },
                {
                  "lon": 113.6691,
                  "lat": 25.9946
                },
                {
                  "lon": 113.6691,
                  "lat": 25.8148
                },
                {
                  "lon": 116.8707,
                  "lat": 25.8148
                },
                {
                  "lon": 116.8707,
                  "lat": 25.9946
                }
              ],
              [
                {
                  "lon": 116.4303,
                  "lat": 26.7138
                },
                {
                  "lon": 113.4108,
                  "lat": 26.7138
                },
                {
                  "lon": 113.4108,
                  "lat": 26.534
                },
                {
                  "lon": 116.6316,
                  "lat": 26.534
                },
                {
                  "lon": 116.6316,
                  "lat": 26.7138
                },
                {
                  "lon": 116.4303,
                  "lat": 26.7138
                }
              ],
              [
                {
                  "lon": 94.6974,
                  "lat": 38.5806
                },
                {
                  "lon": 94.9275,
                  "lat": 38.5806
                },
                {
                  "lon": 94.9275,
                  "lat": 38.4008
                },
                {
                  "lon": 94.6974,
                  "lat": 38.4008
                },
                {
                  "lon": 94.6974,
                  "lat": 38.5806
                }
              ],
              [
                {
                  "lon": 103.7748,
                  "lat": 38.7604
                },
                {
                  "lon": 103.7748,
                  "lat": 38.5806
                },
                {
                  "lon": 102.3912,
                  "lat": 38.5806
                },
                {
                  "lon": 102.3912,
                  "lat": 38.7604
                },
                {
                  "lon": 103.7748,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 120.8217,
                  "lat": 30.3098
                },
                {
                  "lon": 115.8225,
                  "lat": 30.3098
                },
                {
                  "lon": 115.8225,
                  "lat": 30.13
                },
                {
                  "lon": 122.9047,
                  "lat": 30.13
                },
                {
                  "lon": 122.9047,
                  "lat": 30.3098
                },
                {
                  "lon": 120.8217,
                  "lat": 30.3098
                }
              ],
              [
                {
                  "lon": 108.9261,
                  "lat": 31.3886
                },
                {
                  "lon": 110.401,
                  "lat": 31.3886
                },
                {
                  "lon": 110.401,
                  "lat": 31.2088
                },
                {
                  "lon": 107.8726,
                  "lat": 31.2088
                },
                {
                  "lon": 107.8726,
                  "lat": 31.3886
                },
                {
                  "lon": 108.9261,
                  "lat": 31.3886
                }
              ],
              [
                {
                  "lon": 107.9325,
                  "lat": 28.332
                },
                {
                  "lon": 105.2766,
                  "lat": 28.332
                },
                {
                  "lon": 105.2766,
                  "lat": 28.1522
                },
                {
                  "lon": 108.3411,
                  "lat": 28.1522
                },
                {
                  "lon": 108.3411,
                  "lat": 28.332
                },
                {
                  "lon": 107.9325,
                  "lat": 28.332
                }
              ],
              [
                {
                  "lon": 82.5713,
                  "lat": 42.3564
                },
                {
                  "lon": 84.0317,
                  "lat": 42.3564
                },
                {
                  "lon": 84.0317,
                  "lat": 42.1766
                },
                {
                  "lon": 82.5713,
                  "lat": 42.1766
                },
                {
                  "lon": 82.5713,
                  "lat": 42.3564
                }
              ],
              [
                {
                  "lon": 121.183,
                  "lat": 49.5484
                },
                {
                  "lon": 121.4602,
                  "lat": 49.5484
                },
                {
                  "lon": 121.4602,
                  "lat": 49.3686
                },
                {
                  "lon": 119.2426,
                  "lat": 49.3686
                },
                {
                  "lon": 119.2426,
                  "lat": 49.5484
                },
                {
                  "lon": 121.183,
                  "lat": 49.5484
                }
              ],
              [
                {
                  "lon": 104.6545,
                  "lat": 36.2432
                },
                {
                  "lon": 107.1075,
                  "lat": 36.2432
                },
                {
                  "lon": 107.1075,
                  "lat": 36.0634
                },
                {
                  "lon": 101.7555,
                  "lat": 36.0634
                },
                {
                  "lon": 101.7555,
                  "lat": 36.2432
                },
                {
                  "lon": 104.6545,
                  "lat": 36.2432
                }
              ],
              [
                {
                  "lon": 116.1254,
                  "lat": 44.1544
                },
                {
                  "lon": 116.8796,
                  "lat": 44.1544
                },
                {
                  "lon": 116.8796,
                  "lat": 44.3342
                },
                {
                  "lon": 115.3712,
                  "lat": 44.3342
                },
                {
                  "lon": 115.3712,
                  "lat": 44.1544
                },
                {
                  "lon": 116.1254,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 115.4517,
                  "lat": 42.8958
                },
                {
                  "lon": 116.4337,
                  "lat": 42.8958
                },
                {
                  "lon": 116.4337,
                  "lat": 42.716
                },
                {
                  "lon": 114.9607,
                  "lat": 42.716
                },
                {
                  "lon": 114.9607,
                  "lat": 42.8958
                },
                {
                  "lon": 115.4517,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 111.6728,
                  "lat": 27.2532
                },
                {
                  "lon": 111.6728,
                  "lat": 27.0734
                },
                {
                  "lon": 112.8866,
                  "lat": 27.0734
                },
                {
                  "lon": 112.8866,
                  "lat": 27.2532
                },
                {
                  "lon": 111.6728,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 108.7881,
                  "lat": 24.736
                },
                {
                  "lon": 110.3745,
                  "lat": 24.736
                },
                {
                  "lon": 110.3745,
                  "lat": 24.9158
                },
                {
                  "lon": 108.5898,
                  "lat": 24.9158
                },
                {
                  "lon": 108.5898,
                  "lat": 24.736
                },
                {
                  "lon": 108.7881,
                  "lat": 24.736
                }
              ],
              [
                {
                  "lon": 110.2976,
                  "lat": 26.7138
                },
                {
                  "lon": 110.2976,
                  "lat": 26.8936
                },
                {
                  "lon": 108.8857,
                  "lat": 26.8936
                },
                {
                  "lon": 108.8857,
                  "lat": 26.7138
                },
                {
                  "lon": 110.2976,
                  "lat": 26.7138
                }
              ],
              [
                {
                  "lon": 126.4246,
                  "lat": 49.7282
                },
                {
                  "lon": 126.1453,
                  "lat": 49.7282
                },
                {
                  "lon": 126.1453,
                  "lat": 49.908
                },
                {
                  "lon": 129.2176,
                  "lat": 49.908
                },
                {
                  "lon": 129.2176,
                  "lat": 49.7282
                },
                {
                  "lon": 126.4246,
                  "lat": 49.7282
                }
              ],
              [
                {
                  "lon": 96.2705,
                  "lat": 36.423
                },
                {
                  "lon": 96.494,
                  "lat": 36.423
                },
                {
                  "lon": 96.494,
                  "lat": 36.2432
                },
                {
                  "lon": 94.259,
                  "lat": 36.2432
                },
                {
                  "lon": 94.259,
                  "lat": 36.423
                },
                {
                  "lon": 96.2705,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 123.2957,
                  "lat": 50.2676
                },
                {
                  "lon": 123.2957,
                  "lat": 50.0878
                },
                {
                  "lon": 125.5469,
                  "lat": 50.0878
                },
                {
                  "lon": 125.5469,
                  "lat": 50.2676
                },
                {
                  "lon": 123.2957,
                  "lat": 50.2676
                }
              ],
              [
                {
                  "lon": 120.5757,
                  "lat": 25.635
                },
                {
                  "lon": 117.7785,
                  "lat": 25.635
                },
                {
                  "lon": 117.7785,
                  "lat": 25.8148
                },
                {
                  "lon": 120.5757,
                  "lat": 25.8148
                },
                {
                  "lon": 120.5757,
                  "lat": 25.635
                }
              ],
              [
                {
                  "lon": 96.3334,
                  "lat": 36.7826
                },
                {
                  "lon": 96.3334,
                  "lat": 36.9624
                },
                {
                  "lon": 94.3075,
                  "lat": 36.9624
                },
                {
                  "lon": 94.3075,
                  "lat": 36.7826
                },
                {
                  "lon": 96.3334,
                  "lat": 36.7826
                }
              ],
              [
                {
                  "lon": 98.4425,
                  "lat": 35.7038
                },
                {
                  "lon": 98.8865,
                  "lat": 35.7038
                },
                {
                  "lon": 98.8865,
                  "lat": 35.8836
                },
                {
                  "lon": 96.8885,
                  "lat": 35.8836
                },
                {
                  "lon": 96.8885,
                  "lat": 35.7038
                },
                {
                  "lon": 98.4425,
                  "lat": 35.7038
                }
              ],
              [
                {
                  "lon": 118.2714,
                  "lat": 25.8148
                },
                {
                  "lon": 118.0713,
                  "lat": 25.8148
                },
                {
                  "lon": 118.0713,
                  "lat": 25.9946
                },
                {
                  "lon": 120.6726,
                  "lat": 25.9946
                },
                {
                  "lon": 120.6726,
                  "lat": 25.8148
                },
                {
                  "lon": 118.2714,
                  "lat": 25.8148
                }
              ],
              [
                {
                  "lon": 85.8928,
                  "lat": 41.9968
                },
                {
                  "lon": 88.8052,
                  "lat": 41.9968
                },
                {
                  "lon": 88.8052,
                  "lat": 42.1766
                },
                {
                  "lon": 84.922,
                  "lat": 42.1766
                },
                {
                  "lon": 84.922,
                  "lat": 41.9968
                },
                {
                  "lon": 85.8928,
                  "lat": 41.9968
                }
              ],
              [
                {
                  "lon": 108.1678,
                  "lat": 31.928
                },
                {
                  "lon": 107.744,
                  "lat": 31.928
                },
                {
                  "lon": 107.744,
                  "lat": 31.7482
                },
                {
                  "lon": 109.2273,
                  "lat": 31.7482
                },
                {
                  "lon": 109.2273,
                  "lat": 31.928
                },
                {
                  "lon": 108.1678,
                  "lat": 31.928
                }
              ],
              [
                {
                  "lon": 115.3125,
                  "lat": 25.0956
                },
                {
                  "lon": 113.9202,
                  "lat": 25.0956
                },
                {
                  "lon": 113.9202,
                  "lat": 25.2754
                },
                {
                  "lon": 116.307,
                  "lat": 25.2754
                },
                {
                  "lon": 116.307,
                  "lat": 25.0956
                },
                {
                  "lon": 115.3125,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 131.2035,
                  "lat": 47.9302
                },
                {
                  "lon": 131.2035,
                  "lat": 48.11
                },
                {
                  "lon": 131.7423,
                  "lat": 48.11
                },
                {
                  "lon": 131.7423,
                  "lat": 47.9302
                },
                {
                  "lon": 131.2035,
                  "lat": 47.9302
                }
              ],
              [
                {
                  "lon": 122.3974,
                  "lat": 48.8292
                },
                {
                  "lon": 123.4942,
                  "lat": 48.8292
                },
                {
                  "lon": 123.4942,
                  "lat": 49.009
                },
                {
                  "lon": 122.3974,
                  "lat": 49.009
                },
                {
                  "lon": 122.3974,
                  "lat": 48.8292
                }
              ],
              [
                {
                  "lon": 85.1564,
                  "lat": 45.0534
                },
                {
                  "lon": 83.8794,
                  "lat": 45.0534
                },
                {
                  "lon": 83.8794,
                  "lat": 45.2332
                },
                {
                  "lon": 86.178,
                  "lat": 45.2332
                },
                {
                  "lon": 86.178,
                  "lat": 45.0534
                },
                {
                  "lon": 85.1564,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 123.8484,
                  "lat": 52.7848
                },
                {
                  "lon": 126.525,
                  "lat": 52.7848
                },
                {
                  "lon": 126.525,
                  "lat": 52.605
                },
                {
                  "lon": 123.2536,
                  "lat": 52.605
                },
                {
                  "lon": 123.2536,
                  "lat": 52.7848
                },
                {
                  "lon": 123.8484,
                  "lat": 52.7848
                }
              ],
              [
                {
                  "lon": 113.324,
                  "lat": 29.5906
                },
                {
                  "lon": 112.29,
                  "lat": 29.5906
                },
                {
                  "lon": 112.29,
                  "lat": 29.4108
                },
                {
                  "lon": 113.5308,
                  "lat": 29.4108
                },
                {
                  "lon": 113.5308,
                  "lat": 29.5906
                },
                {
                  "lon": 113.324,
                  "lat": 29.5906
                }
              ],
              [
                {
                  "lon": 105.1048,
                  "lat": 29.9502
                },
                {
                  "lon": 102.8179,
                  "lat": 29.9502
                },
                {
                  "lon": 102.8179,
                  "lat": 30.13
                },
                {
                  "lon": 105.1048,
                  "lat": 30.13
                },
                {
                  "lon": 105.1048,
                  "lat": 29.9502
                }
              ],
              [
                {
                  "lon": 127.7563,
                  "lat": 47.5706
                },
                {
                  "lon": 126.1567,
                  "lat": 47.5706
                },
                {
                  "lon": 126.1567,
                  "lat": 47.3908
                },
                {
                  "lon": 128.8227,
                  "lat": 47.3908
                },
                {
                  "lon": 128.8227,
                  "lat": 47.5706
                },
                {
                  "lon": 127.7563,
                  "lat": 47.5706
                }
              ],
              [
                {
                  "lon": 94.8062,
                  "lat": 37.5018
                },
                {
                  "lon": 96.8465,
                  "lat": 37.5018
                },
                {
                  "lon": 96.8465,
                  "lat": 37.322
                },
                {
                  "lon": 94.8062,
                  "lat": 37.322
                },
                {
                  "lon": 94.8062,
                  "lat": 37.5018
                }
              ],
              [
                {
                  "lon": 88.6859,
                  "lat": 43.7948
                },
                {
                  "lon": 89.6827,
                  "lat": 43.7948
                },
                {
                  "lon": 89.6827,
                  "lat": 43.615
                },
                {
                  "lon": 86.6923,
                  "lat": 43.615
                },
                {
                  "lon": 86.6923,
                  "lat": 43.7948
                },
                {
                  "lon": 88.6859,
                  "lat": 43.7948
                }
              ],
              [
                {
                  "lon": 124.2995,
                  "lat": 51.1666
                },
                {
                  "lon": 123.4391,
                  "lat": 51.1666
                },
                {
                  "lon": 123.4391,
                  "lat": 50.9868
                },
                {
                  "lon": 125.4467,
                  "lat": 50.9868
                },
                {
                  "lon": 125.4467,
                  "lat": 51.1666
                },
                {
                  "lon": 124.2995,
                  "lat": 51.1666
                }
              ],
              [
                {
                  "lon": 119.3936,
                  "lat": 44.1544
                },
                {
                  "lon": 119.8964,
                  "lat": 44.1544
                },
                {
                  "lon": 119.8964,
                  "lat": 44.3342
                },
                {
                  "lon": 118.8908,
                  "lat": 44.3342
                },
                {
                  "lon": 118.8908,
                  "lat": 44.1544
                },
                {
                  "lon": 119.3936,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 95.9528,
                  "lat": 29.4108
                },
                {
                  "lon": 98.4344,
                  "lat": 29.4108
                },
                {
                  "lon": 98.4344,
                  "lat": 29.5906
                },
                {
                  "lon": 95.5392,
                  "lat": 29.5906
                },
                {
                  "lon": 95.5392,
                  "lat": 29.4108
                },
                {
                  "lon": 95.9528,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 110.6356,
                  "lat": 29.5906
                },
                {
                  "lon": 110.6356,
                  "lat": 29.4108
                },
                {
                  "lon": 110.222,
                  "lat": 29.4108
                },
                {
                  "lon": 110.222,
                  "lat": 29.5906
                },
                {
                  "lon": 110.6356,
                  "lat": 29.5906
                }
              ],
              [
                {
                  "lon": 113.3179,
                  "lat": 42.1766
                },
                {
                  "lon": 112.8325,
                  "lat": 42.1766
                },
                {
                  "lon": 112.8325,
                  "lat": 41.9968
                },
                {
                  "lon": 113.3179,
                  "lat": 41.9968
                },
                {
                  "lon": 113.3179,
                  "lat": 42.1766
                }
              ],
              [
                {
                  "lon": 104.4112,
                  "lat": 29.9502
                },
                {
                  "lon": 104.6188,
                  "lat": 29.9502
                },
                {
                  "lon": 104.6188,
                  "lat": 29.7704
                },
                {
                  "lon": 103.996,
                  "lat": 29.7704
                },
                {
                  "lon": 103.996,
                  "lat": 29.9502
                },
                {
                  "lon": 104.4112,
                  "lat": 29.9502
                }
              ],
              [
                {
                  "lon": 124.8185,
                  "lat": 51.706
                },
                {
                  "lon": 123.6577,
                  "lat": 51.706
                },
                {
                  "lon": 123.6577,
                  "lat": 51.5262
                },
                {
                  "lon": 125.3989,
                  "lat": 51.5262
                },
                {
                  "lon": 125.3989,
                  "lat": 51.706
                },
                {
                  "lon": 124.8185,
                  "lat": 51.706
                }
              ],
              [
                {
                  "lon": 79.3551,
                  "lat": 40.019
                },
                {
                  "lon": 79.3551,
                  "lat": 40.1988
                },
                {
                  "lon": 78.8841,
                  "lat": 40.1988
                },
                {
                  "lon": 78.8841,
                  "lat": 40.019
                },
                {
                  "lon": 79.3551,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 130.1876,
                  "lat": 44.3342
                },
                {
                  "lon": 132.2052,
                  "lat": 44.3342
                },
                {
                  "lon": 132.2052,
                  "lat": 44.514
                },
                {
                  "lon": 128.17,
                  "lat": 44.514
                },
                {
                  "lon": 128.17,
                  "lat": 44.3342
                },
                {
                  "lon": 130.1876,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 111.7598,
                  "lat": 38.7604
                },
                {
                  "lon": 108.9854,
                  "lat": 38.7604
                },
                {
                  "lon": 108.9854,
                  "lat": 38.9402
                },
                {
                  "lon": 119.1582,
                  "lat": 38.9402
                },
                {
                  "lon": 119.1582,
                  "lat": 38.7604
                },
                {
                  "lon": 111.7598,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 104.1712,
                  "lat": 31.3886
                },
                {
                  "lon": 104.1712,
                  "lat": 31.5684
                },
                {
                  "lon": 103.3268,
                  "lat": 31.5684
                },
                {
                  "lon": 103.3268,
                  "lat": 31.3886
                },
                {
                  "lon": 104.1712,
                  "lat": 31.3886
                }
              ],
              [
                {
                  "lon": 110.156,
                  "lat": 20.4208
                },
                {
                  "lon": 109.3884,
                  "lat": 20.4208
                },
                {
                  "lon": 109.3884,
                  "lat": 20.241
                },
                {
                  "lon": 111.3074,
                  "lat": 20.241
                },
                {
                  "lon": 111.3074,
                  "lat": 20.4208
                },
                {
                  "lon": 110.156,
                  "lat": 20.4208
                }
              ],
              [
                {
                  "lon": 123.5347,
                  "lat": 50.4474
                },
                {
                  "lon": 122.9699,
                  "lat": 50.4474
                },
                {
                  "lon": 122.9699,
                  "lat": 50.2676
                },
                {
                  "lon": 125.5115,
                  "lat": 50.2676
                },
                {
                  "lon": 125.5115,
                  "lat": 50.4474
                },
                {
                  "lon": 123.5347,
                  "lat": 50.4474
                }
              ],
              [
                {
                  "lon": 91.2431,
                  "lat": 30.3098
                },
                {
                  "lon": 90.2016,
                  "lat": 30.3098
                },
                {
                  "lon": 90.2016,
                  "lat": 30.13
                },
                {
                  "lon": 91.868,
                  "lat": 30.13
                },
                {
                  "lon": 91.868,
                  "lat": 30.3098
                },
                {
                  "lon": 91.2431,
                  "lat": 30.3098
                }
              ],
              [
                {
                  "lon": 95.6455,
                  "lat": 35.8836
                },
                {
                  "lon": 96.0905,
                  "lat": 35.8836
                },
                {
                  "lon": 96.0905,
                  "lat": 36.0634
                },
                {
                  "lon": 93.643,
                  "lat": 36.0634
                },
                {
                  "lon": 93.643,
                  "lat": 35.8836
                },
                {
                  "lon": 95.6455,
                  "lat": 35.8836
                }
              ],
              [
                {
                  "lon": 114.059,
                  "lat": 30.4896
                },
                {
                  "lon": 113.4329,
                  "lat": 30.4896
                },
                {
                  "lon": 113.4329,
                  "lat": 30.3098
                },
                {
                  "lon": 115.1025,
                  "lat": 30.3098
                },
                {
                  "lon": 115.1025,
                  "lat": 30.4896
                },
                {
                  "lon": 114.059,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 121.4048,
                  "lat": 44.3342
                },
                {
                  "lon": 120.3992,
                  "lat": 44.3342
                },
                {
                  "lon": 120.3992,
                  "lat": 44.1544
                },
                {
                  "lon": 122.4104,
                  "lat": 44.1544
                },
                {
                  "lon": 122.4104,
                  "lat": 44.3342
                },
                {
                  "lon": 121.4048,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 106.3965,
                  "lat": 28.332
                },
                {
                  "lon": 108.4435,
                  "lat": 28.332
                },
                {
                  "lon": 108.4435,
                  "lat": 28.5118
                },
                {
                  "lon": 105.1683,
                  "lat": 28.5118
                },
                {
                  "lon": 105.1683,
                  "lat": 28.332
                },
                {
                  "lon": 106.3965,
                  "lat": 28.332
                }
              ],
              [
                {
                  "lon": 101.6117,
                  "lat": 37.1422
                },
                {
                  "lon": 100.4837,
                  "lat": 37.1422
                },
                {
                  "lon": 100.4837,
                  "lat": 36.9624
                },
                {
                  "lon": 102.2885,
                  "lat": 36.9624
                },
                {
                  "lon": 102.2885,
                  "lat": 37.1422
                },
                {
                  "lon": 101.6117,
                  "lat": 37.1422
                }
              ],
              [
                {
                  "lon": 85.2476,
                  "lat": 45.413
                },
                {
                  "lon": 84.2228,
                  "lat": 45.413
                },
                {
                  "lon": 84.2228,
                  "lat": 45.2332
                },
                {
                  "lon": 85.76,
                  "lat": 45.2332
                },
                {
                  "lon": 85.76,
                  "lat": 45.413
                },
                {
                  "lon": 85.2476,
                  "lat": 45.413
                }
              ],
              [
                {
                  "lon": 109.7198,
                  "lat": 20.7804
                },
                {
                  "lon": 109.335,
                  "lat": 20.7804
                },
                {
                  "lon": 109.335,
                  "lat": 20.6006
                },
                {
                  "lon": 111.0666,
                  "lat": 20.6006
                },
                {
                  "lon": 111.0666,
                  "lat": 20.7804
                },
                {
                  "lon": 109.7198,
                  "lat": 20.7804
                }
              ],
              [
                {
                  "lon": 80.1007,
                  "lat": 41.4574
                },
                {
                  "lon": 79.8601,
                  "lat": 41.4574
                },
                {
                  "lon": 79.8601,
                  "lat": 41.6372
                },
                {
                  "lon": 80.5819,
                  "lat": 41.6372
                },
                {
                  "lon": 80.5819,
                  "lat": 41.4574
                },
                {
                  "lon": 80.1007,
                  "lat": 41.4574
                }
              ],
              [
                {
                  "lon": 108.4308,
                  "lat": 24.5562
                },
                {
                  "lon": 108.2331,
                  "lat": 24.5562
                },
                {
                  "lon": 108.2331,
                  "lat": 24.3764
                },
                {
                  "lon": 110.4078,
                  "lat": 24.3764
                },
                {
                  "lon": 110.4078,
                  "lat": 24.5562
                },
                {
                  "lon": 108.4308,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 91.1964,
                  "lat": 29.5906
                },
                {
                  "lon": 92.2304,
                  "lat": 29.5906
                },
                {
                  "lon": 92.2304,
                  "lat": 29.4108
                },
                {
                  "lon": 90.1624,
                  "lat": 29.4108
                },
                {
                  "lon": 90.1624,
                  "lat": 29.5906
                },
                {
                  "lon": 91.1964,
                  "lat": 29.5906
                }
              ],
              [
                {
                  "lon": 105.4747,
                  "lat": 27.2532
                },
                {
                  "lon": 105.8799,
                  "lat": 27.2532
                },
                {
                  "lon": 105.8799,
                  "lat": 27.433
                },
                {
                  "lon": 104.6643,
                  "lat": 27.433
                },
                {
                  "lon": 104.6643,
                  "lat": 27.2532
                },
                {
                  "lon": 105.4747,
                  "lat": 27.2532
                }
              ],
              [
                {
                  "lon": 116.7779,
                  "lat": 24.0168
                },
                {
                  "lon": 115.5947,
                  "lat": 24.0168
                },
                {
                  "lon": 115.5947,
                  "lat": 24.1966
                },
                {
                  "lon": 118.5527,
                  "lat": 24.1966
                },
                {
                  "lon": 118.5527,
                  "lat": 24.0168
                },
                {
                  "lon": 116.7779,
                  "lat": 24.0168
                }
              ],
              [
                {
                  "lon": 120.6478,
                  "lat": 39.2998
                },
                {
                  "lon": 123.2042,
                  "lat": 39.2998
                },
                {
                  "lon": 123.2042,
                  "lat": 39.12
                },
                {
                  "lon": 120.6478,
                  "lat": 39.12
                },
                {
                  "lon": 120.6478,
                  "lat": 39.2998
                }
              ],
              [
                {
                  "lon": 116.7608,
                  "lat": 44.514
                },
                {
                  "lon": 116.7608,
                  "lat": 44.6938
                },
                {
                  "lon": 115.4958,
                  "lat": 44.6938
                },
                {
                  "lon": 115.4958,
                  "lat": 44.514
                },
                {
                  "lon": 116.7608,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 107.6412,
                  "lat": 40.5584
                },
                {
                  "lon": 107.8779,
                  "lat": 40.5584
                },
                {
                  "lon": 107.8779,
                  "lat": 40.3786
                },
                {
                  "lon": 105.9843,
                  "lat": 40.3786
                },
                {
                  "lon": 105.9843,
                  "lat": 40.5584
                },
                {
                  "lon": 107.6412,
                  "lat": 40.5584
                }
              ],
              [
                {
                  "lon": 120.4494,
                  "lat": 38.0412
                },
                {
                  "lon": 121.363,
                  "lat": 38.0412
                },
                {
                  "lon": 121.363,
                  "lat": 37.8614
                },
                {
                  "lon": 119.9926,
                  "lat": 37.8614
                },
                {
                  "lon": 119.9926,
                  "lat": 38.0412
                },
                {
                  "lon": 120.4494,
                  "lat": 38.0412
                }
              ],
              [
                {
                  "lon": 121.8138,
                  "lat": 49.009
                },
                {
                  "lon": 119.0618,
                  "lat": 49.009
                },
                {
                  "lon": 119.0618,
                  "lat": 49.1888
                },
                {
                  "lon": 121.8138,
                  "lat": 49.1888
                },
                {
                  "lon": 121.8138,
                  "lat": 49.009
                }
              ],
              [
                {
                  "lon": 108.8942,
                  "lat": 19.8814
                },
                {
                  "lon": 108.7027,
                  "lat": 19.8814
                },
                {
                  "lon": 108.7027,
                  "lat": 20.0612
                },
                {
                  "lon": 111.3837,
                  "lat": 20.0612
                },
                {
                  "lon": 111.3837,
                  "lat": 19.8814
                },
                {
                  "lon": 108.8942,
                  "lat": 19.8814
                }
              ],
              [
                {
                  "lon": 85.0818,
                  "lat": 45.5928
                },
                {
                  "lon": 85.5958,
                  "lat": 45.5928
                },
                {
                  "lon": 85.5958,
                  "lat": 45.413
                },
                {
                  "lon": 84.5678,
                  "lat": 45.413
                },
                {
                  "lon": 84.5678,
                  "lat": 45.5928
                },
                {
                  "lon": 85.0818,
                  "lat": 45.5928
                }
              ],
              [
                {
                  "lon": 115.7805,
                  "lat": 25.635
                },
                {
                  "lon": 116.5797,
                  "lat": 25.635
                },
                {
                  "lon": 116.5797,
                  "lat": 25.8148
                },
                {
                  "lon": 113.9823,
                  "lat": 25.8148
                },
                {
                  "lon": 113.9823,
                  "lat": 25.635
                },
                {
                  "lon": 115.7805,
                  "lat": 25.635
                }
              ],
              [
                {
                  "lon": 111.5991,
                  "lat": 26.534
                },
                {
                  "lon": 111.1965,
                  "lat": 26.534
                },
                {
                  "lon": 111.1965,
                  "lat": 26.7138
                },
                {
                  "lon": 112.4043,
                  "lat": 26.7138
                },
                {
                  "lon": 112.4043,
                  "lat": 26.534
                },
                {
                  "lon": 111.5991,
                  "lat": 26.534
                }
              ],
              [
                {
                  "lon": 130.9341,
                  "lat": 48.11
                },
                {
                  "lon": 130.6647,
                  "lat": 48.11
                },
                {
                  "lon": 130.6647,
                  "lat": 47.9302
                },
                {
                  "lon": 130.9341,
                  "lat": 47.9302
                },
                {
                  "lon": 130.9341,
                  "lat": 48.11
                }
              ],
              [
                {
                  "lon": 108.1521,
                  "lat": 25.0956
                },
                {
                  "lon": 108.7488,
                  "lat": 25.0956
                },
                {
                  "lon": 108.7488,
                  "lat": 25.2754
                },
                {
                  "lon": 107.5554,
                  "lat": 25.2754
                },
                {
                  "lon": 107.5554,
                  "lat": 25.0956
                },
                {
                  "lon": 108.1521,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 121.1084,
                  "lat": 44.514
                },
                {
                  "lon": 120.0996,
                  "lat": 44.514
                },
                {
                  "lon": 120.0996,
                  "lat": 44.3342
                },
                {
                  "lon": 122.6216,
                  "lat": 44.3342
                },
                {
                  "lon": 122.6216,
                  "lat": 44.514
                },
                {
                  "lon": 121.1084,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 106.0716,
                  "lat": 38.221
                },
                {
                  "lon": 104.6946,
                  "lat": 38.221
                },
                {
                  "lon": 104.6946,
                  "lat": 38.4008
                },
                {
                  "lon": 108.1371,
                  "lat": 38.4008
                },
                {
                  "lon": 108.1371,
                  "lat": 38.221
                },
                {
                  "lon": 106.0716,
                  "lat": 38.221
                }
              ],
              [
                {
                  "lon": 102.9807,
                  "lat": 25.0956
                },
                {
                  "lon": 103.5774,
                  "lat": 25.0956
                },
                {
                  "lon": 103.5774,
                  "lat": 25.2754
                },
                {
                  "lon": 101.7873,
                  "lat": 25.2754
                },
                {
                  "lon": 101.7873,
                  "lat": 25.0956
                },
                {
                  "lon": 102.9807,
                  "lat": 25.0956
                }
              ],
              [
                {
                  "lon": 99.5255,
                  "lat": 36.0634
                },
                {
                  "lon": 99.5255,
                  "lat": 36.2432
                },
                {
                  "lon": 101.5325,
                  "lat": 36.2432
                },
                {
                  "lon": 101.5325,
                  "lat": 36.0634
                },
                {
                  "lon": 99.5255,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 134.4494,
                  "lat": 48.6494
                },
                {
                  "lon": 134.7226,
                  "lat": 48.6494
                },
                {
                  "lon": 134.7226,
                  "lat": 48.8292
                },
                {
                  "lon": 133.903,
                  "lat": 48.8292
                },
                {
                  "lon": 133.903,
                  "lat": 48.6494
                },
                {
                  "lon": 134.4494,
                  "lat": 48.6494
                }
              ],
              [
                {
                  "lon": 125.3074,
                  "lat": 49.7282
                },
                {
                  "lon": 123.9109,
                  "lat": 49.7282
                },
                {
                  "lon": 123.9109,
                  "lat": 49.908
                },
                {
                  "lon": 125.866,
                  "lat": 49.908
                },
                {
                  "lon": 125.866,
                  "lat": 49.7282
                },
                {
                  "lon": 125.3074,
                  "lat": 49.7282
                }
              ],
              [
                {
                  "lon": 104.3342,
                  "lat": 37.8614
                },
                {
                  "lon": 104.3342,
                  "lat": 37.6816
                },
                {
                  "lon": 105.2454,
                  "lat": 37.6816
                },
                {
                  "lon": 105.2454,
                  "lat": 37.8614
                },
                {
                  "lon": 104.3342,
                  "lat": 37.8614
                }
              ],
              [
                {
                  "lon": 107.7033,
                  "lat": 27.433
                },
                {
                  "lon": 106.0825,
                  "lat": 27.433
                },
                {
                  "lon": 106.0825,
                  "lat": 27.2532
                },
                {
                  "lon": 108.7163,
                  "lat": 27.2532
                },
                {
                  "lon": 108.7163,
                  "lat": 27.433
                },
                {
                  "lon": 107.7033,
                  "lat": 27.433
                }
              ],
              [
                {
                  "lon": 116.5971,
                  "lat": 25.2754
                },
                {
                  "lon": 113.8083,
                  "lat": 25.2754
                },
                {
                  "lon": 113.8083,
                  "lat": 25.4552
                },
                {
                  "lon": 116.5971,
                  "lat": 25.4552
                },
                {
                  "lon": 116.5971,
                  "lat": 25.2754
                }
              ],
              [
                {
                  "lon": 108.4587,
                  "lat": 38.221
                },
                {
                  "lon": 105.0252,
                  "lat": 38.221
                },
                {
                  "lon": 105.0252,
                  "lat": 38.0412
                },
                {
                  "lon": 108.4587,
                  "lat": 38.0412
                },
                {
                  "lon": 108.4587,
                  "lat": 38.221
                }
              ],
              [
                {
                  "lon": 122.2368,
                  "lat": 45.0534
                },
                {
                  "lon": 120.7092,
                  "lat": 45.0534
                },
                {
                  "lon": 120.7092,
                  "lat": 44.8736
                },
                {
                  "lon": 122.2368,
                  "lat": 44.8736
                },
                {
                  "lon": 122.2368,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 96.7093,
                  "lat": 37.5018
                },
                {
                  "lon": 96.9365,
                  "lat": 37.5018
                },
                {
                  "lon": 96.9365,
                  "lat": 37.6816
                },
                {
                  "lon": 94.8917,
                  "lat": 37.6816
                },
                {
                  "lon": 94.8917,
                  "lat": 37.5018
                },
                {
                  "lon": 96.7093,
                  "lat": 37.5018
                }
              ],
              [
                {
                  "lon": 106.7574,
                  "lat": 40.019
                },
                {
                  "lon": 106.7574,
                  "lat": 39.8392
                },
                {
                  "lon": 107.227,
                  "lat": 39.8392
                },
                {
                  "lon": 107.227,
                  "lat": 40.019
                },
                {
                  "lon": 106.7574,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 119.9878,
                  "lat": 43.0756
                },
                {
                  "lon": 115.5436,
                  "lat": 43.0756
                },
                {
                  "lon": 115.5436,
                  "lat": 43.2554
                },
                {
                  "lon": 119.9878,
                  "lat": 43.2554
                },
                {
                  "lon": 119.9878,
                  "lat": 43.0756
                }
              ],
              [
                {
                  "lon": 106.0066,
                  "lat": 39.2998
                },
                {
                  "lon": 106.0066,
                  "lat": 39.12
                },
                {
                  "lon": 105.3094,
                  "lat": 39.12
                },
                {
                  "lon": 105.3094,
                  "lat": 39.2998
                },
                {
                  "lon": 106.0066,
                  "lat": 39.2998
                }
              ],
              [
                {
                  "lon": 96.5282,
                  "lat": 30.4896
                },
                {
                  "lon": 96.5282,
                  "lat": 30.3098
                },
                {
                  "lon": 97.1543,
                  "lat": 30.3098
                },
                {
                  "lon": 97.1543,
                  "lat": 30.4896
                },
                {
                  "lon": 96.5282,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 109.7776,
                  "lat": 21.4996
                },
                {
                  "lon": 111.9039,
                  "lat": 21.4996
                },
                {
                  "lon": 111.9039,
                  "lat": 21.3198
                },
                {
                  "lon": 109.1977,
                  "lat": 21.3198
                },
                {
                  "lon": 109.1977,
                  "lat": 21.4996
                },
                {
                  "lon": 109.7776,
                  "lat": 21.4996
                }
              ],
              [
                {
                  "lon": 83.7031,
                  "lat": 42.716
                },
                {
                  "lon": 84.4375,
                  "lat": 42.716
                },
                {
                  "lon": 84.4375,
                  "lat": 42.5362
                },
                {
                  "lon": 82.9687,
                  "lat": 42.5362
                },
                {
                  "lon": 82.9687,
                  "lat": 42.716
                },
                {
                  "lon": 83.7031,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 130.003,
                  "lat": 42.3564
                },
                {
                  "lon": 130.003,
                  "lat": 42.5362
                },
                {
                  "lon": 130.4912,
                  "lat": 42.5362
                },
                {
                  "lon": 130.4912,
                  "lat": 42.3564
                },
                {
                  "lon": 130.003,
                  "lat": 42.3564
                }
              ],
              [
                {
                  "lon": 104.6675,
                  "lat": 30.4896
                },
                {
                  "lon": 102.3718,
                  "lat": 30.4896
                },
                {
                  "lon": 102.3718,
                  "lat": 30.3098
                },
                {
                  "lon": 108.6328,
                  "lat": 30.3098
                },
                {
                  "lon": 108.6328,
                  "lat": 30.4896
                },
                {
                  "lon": 104.6675,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 97.835,
                  "lat": 40.019
                },
                {
                  "lon": 99.9482,
                  "lat": 40.019
                },
                {
                  "lon": 99.9482,
                  "lat": 39.8392
                },
                {
                  "lon": 96.661,
                  "lat": 39.8392
                },
                {
                  "lon": 96.661,
                  "lat": 40.019
                },
                {
                  "lon": 97.835,
                  "lat": 40.019
                }
              ],
              [
                {
                  "lon": 89.0887,
                  "lat": 42.716
                },
                {
                  "lon": 87.8647,
                  "lat": 42.716
                },
                {
                  "lon": 87.8647,
                  "lat": 42.5362
                },
                {
                  "lon": 89.5783,
                  "lat": 42.5362
                },
                {
                  "lon": 89.5783,
                  "lat": 42.716
                },
                {
                  "lon": 89.0887,
                  "lat": 42.716
                }
              ],
              [
                {
                  "lon": 125.4662,
                  "lat": 50.807
                },
                {
                  "lon": 123.1806,
                  "lat": 50.807
                },
                {
                  "lon": 123.1806,
                  "lat": 50.9868
                },
                {
                  "lon": 125.4662,
                  "lat": 50.9868
                },
                {
                  "lon": 125.4662,
                  "lat": 50.807
                }
              ],
              [
                {
                  "lon": 111.7923,
                  "lat": 26.8936
                },
                {
                  "lon": 112.6003,
                  "lat": 26.8936
                },
                {
                  "lon": 112.6003,
                  "lat": 27.0734
                },
                {
                  "lon": 111.5903,
                  "lat": 27.0734
                },
                {
                  "lon": 111.5903,
                  "lat": 26.8936
                },
                {
                  "lon": 111.7923,
                  "lat": 26.8936
                }
              ],
              [
                {
                  "lon": 99.8508,
                  "lat": 39.12
                },
                {
                  "lon": 101.7052,
                  "lat": 39.12
                },
                {
                  "lon": 101.7052,
                  "lat": 38.9402
                },
                {
                  "lon": 98.6918,
                  "lat": 38.9402
                },
                {
                  "lon": 98.6918,
                  "lat": 39.12
                },
                {
                  "lon": 99.8508,
                  "lat": 39.12
                }
              ],
              [
                {
                  "lon": 126.9235,
                  "lat": 50.2676
                },
                {
                  "lon": 126.3587,
                  "lat": 50.2676
                },
                {
                  "lon": 126.3587,
                  "lat": 50.4474
                },
                {
                  "lon": 128.3355,
                  "lat": 50.4474
                },
                {
                  "lon": 128.3355,
                  "lat": 50.2676
                },
                {
                  "lon": 126.9235,
                  "lat": 50.2676
                }
              ],
              [
                {
                  "lon": 114.2524,
                  "lat": 29.9502
                },
                {
                  "lon": 114.6682,
                  "lat": 29.9502
                },
                {
                  "lon": 114.6682,
                  "lat": 30.13
                },
                {
                  "lon": 114.2524,
                  "lat": 30.13
                },
                {
                  "lon": 114.2524,
                  "lat": 29.9502
                }
              ],
              [
                {
                  "lon": 109.4392,
                  "lat": 31.928
                },
                {
                  "lon": 109.4392,
                  "lat": 31.7482
                },
                {
                  "lon": 109.6511,
                  "lat": 31.7482
                },
                {
                  "lon": 109.6511,
                  "lat": 31.928
                },
                {
                  "lon": 109.4392,
                  "lat": 31.928
                }
              ],
              [
                {
                  "lon": 124.3956,
                  "lat": 52.9646
                },
                {
                  "lon": 123.796,
                  "lat": 52.9646
                },
                {
                  "lon": 123.796,
                  "lat": 53.1444
                },
                {
                  "lon": 124.3956,
                  "lat": 53.1444
                },
                {
                  "lon": 124.3956,
                  "lat": 52.9646
                }
              ],
              [
                {
                  "lon": 82.8917,
                  "lat": 42.3564
                },
                {
                  "lon": 84.1122,
                  "lat": 42.3564
                },
                {
                  "lon": 84.1122,
                  "lat": 42.5362
                },
                {
                  "lon": 82.6476,
                  "lat": 42.5362
                },
                {
                  "lon": 82.6476,
                  "lat": 42.3564
                },
                {
                  "lon": 82.8917,
                  "lat": 42.3564
                }
              ],
              [
                {
                  "lon": 85.6345,
                  "lat": 41.6372
                },
                {
                  "lon": 86.8375,
                  "lat": 41.6372
                },
                {
                  "lon": 86.8375,
                  "lat": 41.4574
                },
                {
                  "lon": 85.1533,
                  "lat": 41.4574
                },
                {
                  "lon": 85.1533,
                  "lat": 41.6372
                },
                {
                  "lon": 85.6345,
                  "lat": 41.6372
                }
              ],
              [
                {
                  "lon": 98.282,
                  "lat": 36.423
                },
                {
                  "lon": 96.941,
                  "lat": 36.423
                },
                {
                  "lon": 96.941,
                  "lat": 36.2432
                },
                {
                  "lon": 98.729,
                  "lat": 36.2432
                },
                {
                  "lon": 98.729,
                  "lat": 36.423
                },
                {
                  "lon": 98.282,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 95.6403,
                  "lat": 38.221
                },
                {
                  "lon": 94.038,
                  "lat": 38.221
                },
                {
                  "lon": 94.038,
                  "lat": 38.0412
                },
                {
                  "lon": 95.8692,
                  "lat": 38.0412
                },
                {
                  "lon": 95.8692,
                  "lat": 38.221
                },
                {
                  "lon": 95.6403,
                  "lat": 38.221
                }
              ],
              [
                {
                  "lon": 109.885,
                  "lat": 30.4896
                },
                {
                  "lon": 109.885,
                  "lat": 30.3098
                },
                {
                  "lon": 108.8415,
                  "lat": 30.3098
                },
                {
                  "lon": 108.8415,
                  "lat": 30.4896
                },
                {
                  "lon": 109.885,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 106.4264,
                  "lat": 29.231
                },
                {
                  "lon": 109.3174,
                  "lat": 29.231
                },
                {
                  "lon": 109.3174,
                  "lat": 29.4108
                },
                {
                  "lon": 104.9809,
                  "lat": 29.4108
                },
                {
                  "lon": 104.9809,
                  "lat": 29.231
                },
                {
                  "lon": 106.4264,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 76.2894,
                  "lat": 38.4008
                },
                {
                  "lon": 76.2894,
                  "lat": 38.5806
                },
                {
                  "lon": 76.0593,
                  "lat": 38.5806
                },
                {
                  "lon": 76.0593,
                  "lat": 38.4008
                },
                {
                  "lon": 76.2894,
                  "lat": 38.4008
                }
              ],
              [
                {
                  "lon": 99.8546,
                  "lat": 38.5806
                },
                {
                  "lon": 102.1606,
                  "lat": 38.5806
                },
                {
                  "lon": 102.1606,
                  "lat": 38.7604
                },
                {
                  "lon": 99.624,
                  "lat": 38.7604
                },
                {
                  "lon": 99.624,
                  "lat": 38.5806
                },
                {
                  "lon": 99.8546,
                  "lat": 38.5806
                }
              ],
              [
                {
                  "lon": 104.7412,
                  "lat": 32.6472
                },
                {
                  "lon": 104.9548,
                  "lat": 32.6472
                },
                {
                  "lon": 104.9548,
                  "lat": 32.4674
                },
                {
                  "lon": 104.314,
                  "lat": 32.4674
                },
                {
                  "lon": 104.314,
                  "lat": 32.6472
                },
                {
                  "lon": 104.7412,
                  "lat": 32.6472
                }
              ],
              [
                {
                  "lon": 109.5272,
                  "lat": 17.7238
                },
                {
                  "lon": 109.7162,
                  "lat": 17.7238
                },
                {
                  "lon": 109.7162,
                  "lat": 17.9036
                },
                {
                  "lon": 109.3382,
                  "lat": 17.9036
                },
                {
                  "lon": 109.3382,
                  "lat": 17.7238
                },
                {
                  "lon": 109.5272,
                  "lat": 17.7238
                }
              ],
              [
                {
                  "lon": 123.6905,
                  "lat": 51.5262
                },
                {
                  "lon": 125.136,
                  "lat": 51.5262
                },
                {
                  "lon": 125.136,
                  "lat": 51.3464
                },
                {
                  "lon": 123.4014,
                  "lat": 51.3464
                },
                {
                  "lon": 123.4014,
                  "lat": 51.5262
                },
                {
                  "lon": 123.6905,
                  "lat": 51.5262
                }
              ],
              [
                {
                  "lon": 125.4835,
                  "lat": 50.6272
                },
                {
                  "lon": 122.9221,
                  "lat": 50.6272
                },
                {
                  "lon": 122.9221,
                  "lat": 50.807
                },
                {
                  "lon": 125.4835,
                  "lat": 50.807
                },
                {
                  "lon": 125.4835,
                  "lat": 50.6272
                }
              ],
              [
                {
                  "lon": 107.1963,
                  "lat": 27.6128
                },
                {
                  "lon": 108.4143,
                  "lat": 27.6128
                },
                {
                  "lon": 108.4143,
                  "lat": 27.433
                },
                {
                  "lon": 105.9783,
                  "lat": 27.433
                },
                {
                  "lon": 105.9783,
                  "lat": 27.6128
                },
                {
                  "lon": 107.1963,
                  "lat": 27.6128
                }
              ],
              [
                {
                  "lon": 95.0726,
                  "lat": 40.918
                },
                {
                  "lon": 97.2146,
                  "lat": 40.918
                },
                {
                  "lon": 97.2146,
                  "lat": 40.7382
                },
                {
                  "lon": 94.5966,
                  "lat": 40.7382
                },
                {
                  "lon": 94.5966,
                  "lat": 40.918
                },
                {
                  "lon": 95.0726,
                  "lat": 40.918
                }
              ],
              [
                {
                  "lon": 134.1519,
                  "lat": 46.6716
                },
                {
                  "lon": 134.6779,
                  "lat": 46.6716
                },
                {
                  "lon": 134.6779,
                  "lat": 46.8514
                },
                {
                  "lon": 129.1549,
                  "lat": 46.8514
                },
                {
                  "lon": 129.1549,
                  "lat": 46.6716
                },
                {
                  "lon": 134.1519,
                  "lat": 46.6716
                }
              ],
              [
                {
                  "lon": 97.4921,
                  "lat": 30.13
                },
                {
                  "lon": 96.2423,
                  "lat": 30.13
                },
                {
                  "lon": 96.2423,
                  "lat": 30.3098
                },
                {
                  "lon": 97.4921,
                  "lat": 30.3098
                },
                {
                  "lon": 97.4921,
                  "lat": 30.13
                }
              ],
              [
                {
                  "lon": 124.6481,
                  "lat": 50.4474
                },
                {
                  "lon": 124.9316,
                  "lat": 50.4474
                },
                {
                  "lon": 124.9316,
                  "lat": 50.6272
                },
                {
                  "lon": 122.9471,
                  "lat": 50.6272
                },
                {
                  "lon": 122.9471,
                  "lat": 50.4474
                },
                {
                  "lon": 124.6481,
                  "lat": 50.4474
                }
              ],
              [
                {
                  "lon": 82.347,
                  "lat": 45.0534
                },
                {
                  "lon": 80.3038,
                  "lat": 45.0534
                },
                {
                  "lon": 80.3038,
                  "lat": 45.2332
                },
                {
                  "lon": 82.6024,
                  "lat": 45.2332
                },
                {
                  "lon": 82.6024,
                  "lat": 45.0534
                },
                {
                  "lon": 82.347,
                  "lat": 45.0534
                }
              ],
              [
                {
                  "lon": 77.2558,
                  "lat": 38.7604
                },
                {
                  "lon": 77.0252,
                  "lat": 38.7604
                },
                {
                  "lon": 77.0252,
                  "lat": 38.5806
                },
                {
                  "lon": 78.1782,
                  "lat": 38.5806
                },
                {
                  "lon": 78.1782,
                  "lat": 38.7604
                },
                {
                  "lon": 77.2558,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 81.8409,
                  "lat": 40.5584
                },
                {
                  "lon": 82.0776,
                  "lat": 40.5584
                },
                {
                  "lon": 82.0776,
                  "lat": 40.3786
                },
                {
                  "lon": 80.6574,
                  "lat": 40.3786
                },
                {
                  "lon": 80.6574,
                  "lat": 40.5584
                },
                {
                  "lon": 81.8409,
                  "lat": 40.5584
                }
              ],
              [
                {
                  "lon": 119.9835,
                  "lat": 25.2754
                },
                {
                  "lon": 117.1947,
                  "lat": 25.2754
                },
                {
                  "lon": 117.1947,
                  "lat": 25.4552
                },
                {
                  "lon": 120.3819,
                  "lat": 25.4552
                },
                {
                  "lon": 120.3819,
                  "lat": 25.2754
                },
                {
                  "lon": 119.9835,
                  "lat": 25.2754
                }
              ],
              [
                {
                  "lon": 77.9426,
                  "lat": 39.4796
                },
                {
                  "lon": 78.4086,
                  "lat": 39.4796
                },
                {
                  "lon": 78.4086,
                  "lat": 39.2998
                },
                {
                  "lon": 75.1466,
                  "lat": 39.2998
                },
                {
                  "lon": 75.1466,
                  "lat": 39.4796
                },
                {
                  "lon": 77.9426,
                  "lat": 39.4796
                }
              ],
              [
                {
                  "lon": 103.096,
                  "lat": 39.12
                },
                {
                  "lon": 103.3278,
                  "lat": 39.12
                },
                {
                  "lon": 103.3278,
                  "lat": 38.9402
                },
                {
                  "lon": 102.8642,
                  "lat": 38.9402
                },
                {
                  "lon": 102.8642,
                  "lat": 39.12
                },
                {
                  "lon": 103.096,
                  "lat": 39.12
                }
              ],
              [
                {
                  "lon": 96.1805,
                  "lat": 36.0634
                },
                {
                  "lon": 94.1735,
                  "lat": 36.0634
                },
                {
                  "lon": 94.1735,
                  "lat": 36.2432
                },
                {
                  "lon": 96.4035,
                  "lat": 36.2432
                },
                {
                  "lon": 96.4035,
                  "lat": 36.0634
                },
                {
                  "lon": 96.1805,
                  "lat": 36.0634
                }
              ],
              [
                {
                  "lon": 121.5212,
                  "lat": 44.8736
                },
                {
                  "lon": 122.0288,
                  "lat": 44.8736
                },
                {
                  "lon": 122.0288,
                  "lat": 44.6938
                },
                {
                  "lon": 120.2522,
                  "lat": 44.6938
                },
                {
                  "lon": 120.2522,
                  "lat": 44.8736
                },
                {
                  "lon": 121.5212,
                  "lat": 44.8736
                }
              ],
              [
                {
                  "lon": 109.3946,
                  "lat": 17.9036
                },
                {
                  "lon": 108.827,
                  "lat": 17.9036
                },
                {
                  "lon": 108.827,
                  "lat": 18.0834
                },
                {
                  "lon": 109.9622,
                  "lat": 18.0834
                },
                {
                  "lon": 109.9622,
                  "lat": 17.9036
                },
                {
                  "lon": 109.3946,
                  "lat": 17.9036
                }
              ],
              [
                {
                  "lon": 116.9609,
                  "lat": 43.9746
                },
                {
                  "lon": 116.9609,
                  "lat": 44.1544
                },
                {
                  "lon": 115.4567,
                  "lat": 44.1544
                },
                {
                  "lon": 115.4567,
                  "lat": 43.9746
                },
                {
                  "lon": 116.9609,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 121.0618,
                  "lat": 44.514
                },
                {
                  "lon": 122.5798,
                  "lat": 44.514
                },
                {
                  "lon": 122.5798,
                  "lat": 44.6938
                },
                {
                  "lon": 120.0498,
                  "lat": 44.6938
                },
                {
                  "lon": 120.0498,
                  "lat": 44.514
                },
                {
                  "lon": 121.0618,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 109.794,
                  "lat": 24.0168
                },
                {
                  "lon": 108.6126,
                  "lat": 24.0168
                },
                {
                  "lon": 108.6126,
                  "lat": 23.837
                },
                {
                  "lon": 109.794,
                  "lat": 23.837
                },
                {
                  "lon": 109.794,
                  "lat": 24.0168
                }
              ],
              [
                {
                  "lon": 95.4693,
                  "lat": 40.1988
                },
                {
                  "lon": 94.0527,
                  "lat": 40.1988
                },
                {
                  "lon": 94.0527,
                  "lat": 40.3786
                },
                {
                  "lon": 98.0664,
                  "lat": 40.3786
                },
                {
                  "lon": 98.0664,
                  "lat": 40.1988
                },
                {
                  "lon": 95.4693,
                  "lat": 40.1988
                }
              ],
              [
                {
                  "lon": 131.1818,
                  "lat": 44.514
                },
                {
                  "lon": 128.1458,
                  "lat": 44.514
                },
                {
                  "lon": 128.1458,
                  "lat": 44.6938
                },
                {
                  "lon": 131.6878,
                  "lat": 44.6938
                },
                {
                  "lon": 131.6878,
                  "lat": 44.514
                },
                {
                  "lon": 131.1818,
                  "lat": 44.514
                }
              ],
              [
                {
                  "lon": 120.8616,
                  "lat": 49.7282
                },
                {
                  "lon": 120.8616,
                  "lat": 49.5484
                },
                {
                  "lon": 120.3052,
                  "lat": 49.5484
                },
                {
                  "lon": 120.3052,
                  "lat": 49.7282
                },
                {
                  "lon": 120.8616,
                  "lat": 49.7282
                }
              ],
              [
                {
                  "lon": 115.8363,
                  "lat": 24.5562
                },
                {
                  "lon": 115.8363,
                  "lat": 24.736
                },
                {
                  "lon": 116.4303,
                  "lat": 24.736
                },
                {
                  "lon": 116.4303,
                  "lat": 24.5562
                },
                {
                  "lon": 115.8363,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 125.2751,
                  "lat": 50.0878
                },
                {
                  "lon": 123.8736,
                  "lat": 50.0878
                },
                {
                  "lon": 123.8736,
                  "lat": 49.908
                },
                {
                  "lon": 125.5554,
                  "lat": 49.908
                },
                {
                  "lon": 125.5554,
                  "lat": 50.0878
                },
                {
                  "lon": 125.2751,
                  "lat": 50.0878
                }
              ],
              [
                {
                  "lon": 84.2732,
                  "lat": 42.8958
                },
                {
                  "lon": 83.0457,
                  "lat": 42.8958
                },
                {
                  "lon": 83.0457,
                  "lat": 42.716
                },
                {
                  "lon": 84.7642,
                  "lat": 42.716
                },
                {
                  "lon": 84.7642,
                  "lat": 42.8958
                },
                {
                  "lon": 84.2732,
                  "lat": 42.8958
                }
              ],
              [
                {
                  "lon": 93.8315,
                  "lat": 35.3442
                },
                {
                  "lon": 93.8315,
                  "lat": 35.524
                },
                {
                  "lon": 94.7155,
                  "lat": 35.524
                },
                {
                  "lon": 94.7155,
                  "lat": 35.3442
                },
                {
                  "lon": 93.8315,
                  "lat": 35.3442
                }
              ],
              [
                {
                  "lon": 88.8784,
                  "lat": 43.2554
                },
                {
                  "lon": 90.1129,
                  "lat": 43.2554
                },
                {
                  "lon": 90.1129,
                  "lat": 43.0756
                },
                {
                  "lon": 86.9032,
                  "lat": 43.0756
                },
                {
                  "lon": 86.9032,
                  "lat": 43.2554
                },
                {
                  "lon": 88.8784,
                  "lat": 43.2554
                }
              ],
              [
                {
                  "lon": 109.2843,
                  "lat": 28.1522
                },
                {
                  "lon": 108.8763,
                  "lat": 28.1522
                },
                {
                  "lon": 108.8763,
                  "lat": 27.9724
                },
                {
                  "lon": 109.4883,
                  "lat": 27.9724
                },
                {
                  "lon": 109.4883,
                  "lat": 28.1522
                },
                {
                  "lon": 109.2843,
                  "lat": 28.1522
                }
              ],
              [
                {
                  "lon": 118.8459,
                  "lat": 26.7138
                },
                {
                  "lon": 120.4563,
                  "lat": 26.7138
                },
                {
                  "lon": 120.4563,
                  "lat": 26.534
                },
                {
                  "lon": 118.0407,
                  "lat": 26.534
                },
                {
                  "lon": 118.0407,
                  "lat": 26.7138
                },
                {
                  "lon": 118.8459,
                  "lat": 26.7138
                }
              ],
              [
                {
                  "lon": 114.1561,
                  "lat": 30.13
                },
                {
                  "lon": 113.7395,
                  "lat": 30.13
                },
                {
                  "lon": 113.7395,
                  "lat": 30.3098
                },
                {
                  "lon": 114.9893,
                  "lat": 30.3098
                },
                {
                  "lon": 114.9893,
                  "lat": 30.13
                },
                {
                  "lon": 114.1561,
                  "lat": 30.13
                }
              ],
              [
                {
                  "lon": 126.5815,
                  "lat": 51.5262
                },
                {
                  "lon": 127.1597,
                  "lat": 51.5262
                },
                {
                  "lon": 127.1597,
                  "lat": 51.3464
                },
                {
                  "lon": 126.0033,
                  "lat": 51.3464
                },
                {
                  "lon": 126.0033,
                  "lat": 51.5262
                },
                {
                  "lon": 126.5815,
                  "lat": 51.5262
                }
              ],
              [
                {
                  "lon": 86.2807,
                  "lat": 41.4574
                },
                {
                  "lon": 87.0007,
                  "lat": 41.4574
                },
                {
                  "lon": 87.0007,
                  "lat": 41.2776
                },
                {
                  "lon": 85.5607,
                  "lat": 41.2776
                },
                {
                  "lon": 85.5607,
                  "lat": 41.4574
                },
                {
                  "lon": 86.2807,
                  "lat": 41.4574
                }
              ],
              [
                {
                  "lon": 105.8062,
                  "lat": 30.4896
                },
                {
                  "lon": 105.5971,
                  "lat": 30.4896
                },
                {
                  "lon": 105.5971,
                  "lat": 30.6694
                },
                {
                  "lon": 106.2244,
                  "lat": 30.6694
                },
                {
                  "lon": 106.2244,
                  "lat": 30.4896
                },
                {
                  "lon": 105.8062,
                  "lat": 30.4896
                }
              ],
              [
                {
                  "lon": 108.2809,
                  "lat": 31.7482
                },
                {
                  "lon": 109.9729,
                  "lat": 31.7482
                },
                {
                  "lon": 109.9729,
                  "lat": 31.5684
                },
                {
                  "lon": 107.6464,
                  "lat": 31.5684
                },
                {
                  "lon": 107.6464,
                  "lat": 31.7482
                },
                {
                  "lon": 108.2809,
                  "lat": 31.7482
                }
              ],
              [
                {
                  "lon": 83.7085,
                  "lat": 42.1766
                },
                {
                  "lon": 84.6793,
                  "lat": 42.1766
                },
                {
                  "lon": 84.6793,
                  "lat": 41.9968
                },
                {
                  "lon": 82.2523,
                  "lat": 41.9968
                },
                {
                  "lon": 82.2523,
                  "lat": 42.1766
                },
                {
                  "lon": 83.7085,
                  "lat": 42.1766
                }
              ],
              [
                {
                  "lon": 103.1223,
                  "lat": 25.635
                },
                {
                  "lon": 103.5213,
                  "lat": 25.635
                },
                {
                  "lon": 103.5213,
                  "lat": 25.4552
                },
                {
                  "lon": 101.9253,
                  "lat": 25.4552
                },
                {
                  "lon": 101.9253,
                  "lat": 25.635
                },
                {
                  "lon": 103.1223,
                  "lat": 25.635
                }
              ],
              [
                {
                  "lon": 102.2553,
                  "lat": 24.1966
                },
                {
                  "lon": 102.2553,
                  "lat": 24.3764
                },
                {
                  "lon": 102.8478,
                  "lat": 24.3764
                },
                {
                  "lon": 102.8478,
                  "lat": 24.1966
                },
                {
                  "lon": 102.2553,
                  "lat": 24.1966
                }
              ],
              [
                {
                  "lon": 119.7488,
                  "lat": 49.5484
                },
                {
                  "lon": 120.027,
                  "lat": 49.5484
                },
                {
                  "lon": 120.027,
                  "lat": 49.7282
                },
                {
                  "lon": 119.4706,
                  "lat": 49.7282
                },
                {
                  "lon": 119.4706,
                  "lat": 49.5484
                },
                {
                  "lon": 119.7488,
                  "lat": 49.5484
                }
              ],
              [
                {
                  "lon": 109.4339,
                  "lat": 23.4774
                },
                {
                  "lon": 109.0413,
                  "lat": 23.4774
                },
                {
                  "lon": 109.0413,
                  "lat": 23.6572
                },
                {
                  "lon": 109.6302,
                  "lat": 23.6572
                },
                {
                  "lon": 109.6302,
                  "lat": 23.4774
                },
                {
                  "lon": 109.4339,
                  "lat": 23.4774
                }
              ],
              [
                {
                  "lon": 121.7616,
                  "lat": 38.7604
                },
                {
                  "lon": 121.9922,
                  "lat": 38.7604
                },
                {
                  "lon": 121.9922,
                  "lat": 38.5806
                },
                {
                  "lon": 121.0698,
                  "lat": 38.5806
                },
                {
                  "lon": 121.0698,
                  "lat": 38.7604
                },
                {
                  "lon": 121.7616,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 104.1904,
                  "lat": 32.6472
                },
                {
                  "lon": 104.1904,
                  "lat": 32.827
                },
                {
                  "lon": 105.2604,
                  "lat": 32.827
                },
                {
                  "lon": 105.2604,
                  "lat": 32.6472
                },
                {
                  "lon": 104.1904,
                  "lat": 32.6472
                }
              ],
              [
                {
                  "lon": 97.9599,
                  "lat": 29.4108
                },
                {
                  "lon": 97.5469,
                  "lat": 29.4108
                },
                {
                  "lon": 97.5469,
                  "lat": 29.231
                },
                {
                  "lon": 98.1664,
                  "lat": 29.231
                },
                {
                  "lon": 98.1664,
                  "lat": 29.4108
                },
                {
                  "lon": 97.9599,
                  "lat": 29.4108
                }
              ],
              [
                {
                  "lon": 108.4274,
                  "lat": 38.9402
                },
                {
                  "lon": 108.6592,
                  "lat": 38.9402
                },
                {
                  "lon": 108.6592,
                  "lat": 39.12
                },
                {
                  "lon": 108.1956,
                  "lat": 39.12
                },
                {
                  "lon": 108.1956,
                  "lat": 38.9402
                },
                {
                  "lon": 108.4274,
                  "lat": 38.9402
                }
              ],
              [
                {
                  "lon": 96.6421,
                  "lat": 29.231
                },
                {
                  "lon": 97.0543,
                  "lat": 29.231
                },
                {
                  "lon": 97.0543,
                  "lat": 29.0512
                },
                {
                  "lon": 96.436,
                  "lat": 29.0512
                },
                {
                  "lon": 96.436,
                  "lat": 29.231
                },
                {
                  "lon": 96.6421,
                  "lat": 29.231
                }
              ],
              [
                {
                  "lon": 86.7785,
                  "lat": 43.9746
                },
                {
                  "lon": 89.7773,
                  "lat": 43.9746
                },
                {
                  "lon": 89.7773,
                  "lat": 43.7948
                },
                {
                  "lon": 86.2787,
                  "lat": 43.7948
                },
                {
                  "lon": 86.2787,
                  "lat": 43.9746
                },
                {
                  "lon": 86.7785,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 99.9686,
                  "lat": 38.7604
                },
                {
                  "lon": 99.7374,
                  "lat": 38.7604
                },
                {
                  "lon": 99.7374,
                  "lat": 38.9402
                },
                {
                  "lon": 101.8182,
                  "lat": 38.9402
                },
                {
                  "lon": 101.8182,
                  "lat": 38.7604
                },
                {
                  "lon": 99.9686,
                  "lat": 38.7604
                }
              ],
              [
                {
                  "lon": 117.9637,
                  "lat": 44.1544
                },
                {
                  "lon": 118.2144,
                  "lat": 44.1544
                },
                {
                  "lon": 118.2144,
                  "lat": 43.9746
                },
                {
                  "lon": 117.9637,
                  "lat": 43.9746
                },
                {
                  "lon": 117.9637,
                  "lat": 44.1544
                }
              ],
              [
                {
                  "lon": 80.8922,
                  "lat": 45.2332
                },
                {
                  "lon": 80.636,
                  "lat": 45.2332
                },
                {
                  "lon": 80.636,
                  "lat": 45.413
                },
                {
                  "lon": 81.4046,
                  "lat": 45.413
                },
                {
                  "lon": 81.4046,
                  "lat": 45.2332
                },
                {
                  "lon": 80.8922,
                  "lat": 45.2332
                }
              ],
              [
                {
                  "lon": 98.3765,
                  "lat": 36.423
                },
                {
                  "lon": 97.4805,
                  "lat": 36.423
                },
                {
                  "lon": 97.4805,
                  "lat": 36.6028
                },
                {
                  "lon": 98.6005,
                  "lat": 36.6028
                },
                {
                  "lon": 98.6005,
                  "lat": 36.423
                },
                {
                  "lon": 98.3765,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 112.3848,
                  "lat": 24.5562
                },
                {
                  "lon": 111.9894,
                  "lat": 24.5562
                },
                {
                  "lon": 111.9894,
                  "lat": 24.3764
                },
                {
                  "lon": 112.5825,
                  "lat": 24.3764
                },
                {
                  "lon": 112.5825,
                  "lat": 24.5562
                },
                {
                  "lon": 112.3848,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 105.3423,
                  "lat": 24.5562
                },
                {
                  "lon": 105.3423,
                  "lat": 24.736
                },
                {
                  "lon": 104.5503,
                  "lat": 24.736
                },
                {
                  "lon": 104.5503,
                  "lat": 24.5562
                },
                {
                  "lon": 105.3423,
                  "lat": 24.5562
                }
              ],
              [
                {
                  "lon": 96.034,
                  "lat": 30.13
                },
                {
                  "lon": 96.034,
                  "lat": 30.3098
                },
                {
                  "lon": 95.4091,
                  "lat": 30.3098
                },
                {
                  "lon": 95.4091,
                  "lat": 30.13
                },
                {
                  "lon": 96.034,
                  "lat": 30.13
                }
              ],
              [
                {
                  "lon": 94.9178,
                  "lat": 39.6594
                },
                {
                  "lon": 94.9178,
                  "lat": 39.8392
                },
                {
                  "lon": 94.4494,
                  "lat": 39.8392
                },
                {
                  "lon": 94.4494,
                  "lat": 39.6594
                },
                {
                  "lon": 94.9178,
                  "lat": 39.6594
                }
              ],
              [
                {
                  "lon": 79.6195,
                  "lat": 41.4574
                },
                {
                  "lon": 79.6195,
                  "lat": 41.6372
                },
                {
                  "lon": 78.8977,
                  "lat": 41.6372
                },
                {
                  "lon": 78.8977,
                  "lat": 41.4574
                },
                {
                  "lon": 79.6195,
                  "lat": 41.4574
                }
              ],
              [
                {
                  "lon": 77.67,
                  "lat": 38.5806
                },
                {
                  "lon": 77.9001,
                  "lat": 38.5806
                },
                {
                  "lon": 77.9001,
                  "lat": 38.4008
                },
                {
                  "lon": 77.4399,
                  "lat": 38.4008
                },
                {
                  "lon": 77.4399,
                  "lat": 38.5806
                },
                {
                  "lon": 77.67,
                  "lat": 38.5806
                }
              ],
              [
                {
                  "lon": 84.3607,
                  "lat": 41.4574
                },
                {
                  "lon": 84.1207,
                  "lat": 41.4574
                },
                {
                  "lon": 84.1207,
                  "lat": 41.2776
                },
                {
                  "lon": 84.3607,
                  "lat": 41.2776
                },
                {
                  "lon": 84.3607,
                  "lat": 41.4574
                }
              ],
              [
                {
                  "lon": 97.904,
                  "lat": 35.524
                },
                {
                  "lon": 97.2395,
                  "lat": 35.524
                },
                {
                  "lon": 97.2395,
                  "lat": 35.7038
                },
                {
                  "lon": 98.5685,
                  "lat": 35.7038
                },
                {
                  "lon": 98.5685,
                  "lat": 35.524
                },
                {
                  "lon": 97.904,
                  "lat": 35.524
                }
              ],
              [
                {
                  "lon": 108.6291,
                  "lat": 25.2754
                },
                {
                  "lon": 107.2347,
                  "lat": 25.2754
                },
                {
                  "lon": 107.2347,
                  "lat": 25.4552
                },
                {
                  "lon": 108.6291,
                  "lat": 25.4552
                },
                {
                  "lon": 108.6291,
                  "lat": 25.2754
                }
              ],
              [
                {
                  "lon": 128.9782,
                  "lat": 49.009
                },
                {
                  "lon": 128.9782,
                  "lat": 48.8292
                },
                {
                  "lon": 129.2524,
                  "lat": 48.8292
                },
                {
                  "lon": 129.2524,
                  "lat": 49.009
                },
                {
                  "lon": 128.9782,
                  "lat": 49.009
                }
              ],
              [
                {
                  "lon": 98.2653,
                  "lat": 36.6028
                },
                {
                  "lon": 98.2653,
                  "lat": 36.7826
                },
                {
                  "lon": 97.8161,
                  "lat": 36.7826
                },
                {
                  "lon": 97.8161,
                  "lat": 36.6028
                },
                {
                  "lon": 98.2653,
                  "lat": 36.6028
                }
              ],
              [
                {
                  "lon": 122.1205,
                  "lat": 36.423
                },
                {
                  "lon": 122.7925,
                  "lat": 36.423
                },
                {
                  "lon": 122.7925,
                  "lat": 36.6028
                },
                {
                  "lon": 122.1205,
                  "lat": 36.6028
                },
                {
                  "lon": 122.1205,
                  "lat": 36.423
                }
              ],
              [
                {
                  "lon": 109.3652,
                  "lat": 30.3098
                },
                {
                  "lon": 109.5735,
                  "lat": 30.3098
                },
                {
                  "lon": 109.5735,
                  "lat": 30.13
                },
                {
                  "lon": 109.3652,
                  "lat": 30.13
                },
                {
                  "lon": 109.3652,
                  "lat": 30.3098
                }
              ],
              [
                {
                  "lon": 110.266,
                  "lat": 28.6916
                },
                {
                  "lon": 110.6768,
                  "lat": 28.6916
                },
                {
                  "lon": 110.6768,
                  "lat": 28.8714
                },
                {
                  "lon": 110.0606,
                  "lat": 28.8714
                },
                {
                  "lon": 110.0606,
                  "lat": 28.6916
                },
                {
                  "lon": 110.266,
                  "lat": 28.6916
                }
              ],
              [
                {
                  "lon": 107.9949,
                  "lat": 24.9158
                },
                {
                  "lon": 107.9949,
                  "lat": 24.736
                },
                {
                  "lon": 108.1932,
                  "lat": 24.736
                },
                {
                  "lon": 108.1932,
                  "lat": 24.9158
                },
                {
                  "lon": 107.9949,
                  "lat": 24.9158
                }
              ],
              [
                {
                  "lon": 115.9376,
                  "lat": 44.6938
                },
                {
                  "lon": 115.9376,
                  "lat": 44.8736
                },
                {
                  "lon": 116.1914,
                  "lat": 44.8736
                },
                {
                  "lon": 116.1914,
                  "lat": 44.6938
                },
                {
                  "lon": 115.9376,
                  "lat": 44.6938
                }
              ],
              [
                {
                  "lon": 111.256,
                  "lat": 29.5906
                },
                {
                  "lon": 111.0492,
                  "lat": 29.5906
                },
                {
                  "lon": 111.0492,
                  "lat": 29.4108
                },
                {
                  "lon": 111.4628,
                  "lat": 29.4108
                },
                {
                  "lon": 111.4628,
                  "lat": 29.5906
                },
                {
                  "lon": 111.256,
                  "lat": 29.5906
                }
              ],
              [
                {
                  "lon": 89.3312,
                  "lat": 44.3342
                },
                {
                  "lon": 89.3312,
                  "lat": 44.514
                },
                {
                  "lon": 89.079,
                  "lat": 44.514
                },
                {
                  "lon": 89.079,
                  "lat": 44.3342
                },
                {
                  "lon": 89.3312,
                  "lat": 44.3342
                }
              ],
              [
                {
                  "lon": 112.9228,
                  "lat": 29.9502
                },
                {
                  "lon": 113.1304,
                  "lat": 29.9502
                },
                {
                  "lon": 113.1304,
                  "lat": 29.7704
                },
                {
                  "lon": 112.7152,
                  "lat": 29.7704
                },
                {
                  "lon": 112.7152,
                  "lat": 29.9502
                },
                {
                  "lon": 112.9228,
                  "lat": 29.9502
                }
              ],
              [
                {
                  "lon": 87.9188,
                  "lat": 44.6938
                },
                {
                  "lon": 88.1718,
                  "lat": 44.6938
                },
                {
                  "lon": 88.1718,
                  "lat": 44.514
                },
                {
                  "lon": 87.9188,
                  "lat": 44.514
                },
                {
                  "lon": 87.9188,
                  "lat": 44.6938
                }
              ],
              [
                {
                  "lon": 85.7789,
                  "lat": 43.9746
                },
                {
                  "lon": 85.7789,
                  "lat": 43.7948
                },
                {
                  "lon": 85.529,
                  "lat": 43.7948
                },
                {
                  "lon": 85.529,
                  "lat": 43.9746
                },
                {
                  "lon": 85.7789,
                  "lat": 43.9746
                }
              ],
              [
                {
                  "lon": 106.9952,
                  "lat": 32.2876
                },
                {
                  "lon": 106.9952,
                  "lat": 32.4674
                },
                {
                  "lon": 106.782,
                  "lat": 32.4674
                },
                {
                  "lon": 106.782,
                  "lat": 32.2876
                },
                {
                  "lon": 106.9952,
                  "lat": 32.2876
                }
              ],
              [
                {
                  "lon": 96.6197,
                  "lat": 41.0978
                },
                {
                  "lon": 96.6197,
                  "lat": 40.918
                },
                {
                  "lon": 96.8584,
                  "lat": 40.918
                },
                {
                  "lon": 96.8584,
                  "lat": 41.0978
                },
                {
                  "lon": 96.6197,
                  "lat": 41.0978
                }
              ]
            ],
            "updateTime": 1602349248466
          }
        }

      }
    },
    watch: {
      // 只有当下载文件数量有改动时才重新设置图标badge
      downloadingNumber(val) {
        this.handleDownloadingNumber(val)
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
      },

      anyInDangerous(val) {
        this.handleDangerousDownloading(val)
      },

      progress(val) {
        icon.message.progress = val
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
        this.setBrowserBadge(num <= 0 ? 0 : num)
      },

      /**
       * 处理正在下载危险文件的数量
       * @param anyInDangerous {Boolean}
       */
      handleDangerousDownloading(anyInDangerous) {
        // 在下载危险文件时，将图标正在下载中的数字背景设置为红色
        // 确认下载危险文件时，将图标正在下载中的数字背景重新设置为蓝色
        chrome.browserAction.setBadgeBackgroundColor({color: anyInDangerous ? '#FF0000' : '#4285F4'})
      },

      /**
       * 文件下载进程
       */
      downloadProgress() {
        this.tid = -1
        chrome.downloads.search({orderBy: ['-startTime']}, (items) => {
        // chrome.downloads.search({}, (items) => {
          let downloadingNumber = 0
          let anyInProgress = false
          let anyInDangerous = false
          let greaterThanZeroNumber = 0
          let totalProgress = 0.0

          items.forEach(item => {
            common.beforeHandler(item)
            if (item.state === 'in_progress') {
              downloadingNumber++
              anyInProgress = true

              this.handleDownloadStartedNotification(item)

              if ((item.danger !== 'safe') && (item.danger !== 'accepted')) {
                anyInDangerous = true
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
          this.anyInDangerous = anyInDangerous

          // 设置当前所有下载文件总体进度
          if (greaterThanZeroNumber > 0) {
            this.progress = totalProgress / greaterThanZeroNumber
          } else {
            this.progress = -1
          }

          // icon右小角显示正在下载中的文件数量
          this.downloadingNumber = downloadingNumber

          // 使用vue.set更新数据
          this.$set(this.downloadMessage, 'data', items)

          // 发送数据到popup
          chrome.runtime.sendMessage(JSON.stringify(this.downloadMessage))

          if (this.anyInProgress && this.tid < 0) {
            this.tid = setTimeout(this.downloadProgress, 400)
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
          if (number >= 1000) {
            text = '999+'
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
