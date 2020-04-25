# **download-manager**
[![build](https://api.travis-ci.org/xinghaixuanwo/download-manager.svg?branch=master)](https://www.travis-ci.org/xinghaixuanwo/download-manager)
![language](https://img.shields.io/badge/language-Vue.js-forestgreen.svg)
[![Hex.pm](https://img.shields.io/hexpm/l/plug.svg)](https://github.com/xinghaixuanwo/download-manager/blob/master/LICENSE)

[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/ofpglhlcdbjdhlacgbljnildhajfmlei.svg?style=flat-square&label=Chrome%20Web%20Store)](https://chrome.google.com/webstore/detail/ofpglhlcdbjdhlacgbljnildhajfmlei)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/d/ofpglhlcdbjdhlacgbljnildhajfmlei.svg?style=flat-square&label=Users)](https://chrome.google.com/webstore/detail/ofpglhlcdbjdhlacgbljnildhajfmlei)
[![Chrome Web Store Rating](https://img.shields.io/chrome-web-store/rating/ofpglhlcdbjdhlacgbljnildhajfmlei.svg?style=flat-square&label=Rating)](https://chrome.google.com/webstore/detail/ofpglhlcdbjdhlacgbljnildhajfmlei)

谷歌浏览器下载管理器插件

点击插件图标即可查看所有下载文件状态

**[简体中文](../README.md) | [English](docs/README_EN.md)**


### **功能**
1. 下载文件百分比进度显示
2. 下载文件可暂停、恢复下载、取消、删除、重试
3. 搜索所有已经下载的文件
4. 下载危险文件时显示是否确认下载的提示框
5. 右键复制文件名和下载链接到剪切板
6. 下载过程中通知
7. 下载完成提示音
8. 快捷键
9. 手动下载文件功能
10. 右键下载菜单
11. 自定义图标颜色

### **支持的语言**
`简体中文`、`English`、`Japanese`、`German`、`Russian`、`French`

这是使用谷歌翻译后的结果，如果您有更好的建议，请创建Issues或发邮件!

**步骤：**
1. 所有翻译文件位置：public/_locales/\*\*/*.json
2. 进入对应语言的目录
3. 复制、下载或者Pull Request修改后的文件，我会在检查核对后尽快上线

### **未来计划**  
以下计划按先后顺序依次开发😂：  
1. 更多下载动画
2. 解决重试下载失败文件变成新创建下载的问题
3. 代理设置
4. 强迫症系列：只显示下载文件名称、下载面板停止显示飞入飞出动画
5. 自定义下载面板主题

### **Info**
[谷歌浏览器插件地址](https://chrome.google.com/webstore/detail/%E4%B8%8B%E8%BD%BD%E7%AE%A1%E7%90%86%E5%99%A8/ofpglhlcdbjdhlacgbljnildhajfmlei)

#### **最新版本**：1.0.0
新增：
1. 暗黑模式。  
主题文件位于：[`public/theme/theme.json`](https://github.com/xinghaix/download-manager/blob/master/public/theme/theme.json)  
大家可以自行更改，也可上传自己的主题文件到这里，我会认真核对然后尽快上线

优化：
1. 法语翻译

<img src="docs/img/1.png" width="320" hegiht="420" alt=""/>

### **编译打包**
```
# 加载依赖
npm install

# 编译打包
npm run build
```

### 帮助
有任何问题请创建Issues
或者
给我发送邮件[`xinghaixuanwo@outlook.com`](xinghaixuanwo@outlook.com)
