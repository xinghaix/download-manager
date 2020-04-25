# **download-manager**
[![build](https://api.travis-ci.org/xinghaixuanwo/download-manager.svg?branch=master)](https://www.travis-ci.org/xinghaixuanwo/download-manager)
![language](https://img.shields.io/badge/language-Vue.js-forestgreen.svg)
[![Hex.pm](https://img.shields.io/hexpm/l/plug.svg)](https://github.com/xinghaixuanwo/download-manager/blob/master/LICENSE)

[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/ofpglhlcdbjdhlacgbljnildhajfmlei.svg?style=flat-square&label=Chrome%20Web%20Store)](https://chrome.google.com/webstore/detail/ofpglhlcdbjdhlacgbljnildhajfmlei)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/d/ofpglhlcdbjdhlacgbljnildhajfmlei.svg?style=flat-square&label=Users)](https://chrome.google.com/webstore/detail/ofpglhlcdbjdhlacgbljnildhajfmlei)
[![Chrome Web Store Rating](https://img.shields.io/chrome-web-store/rating/ofpglhlcdbjdhlacgbljnildhajfmlei.svg?style=flat-square&label=Rating)](https://chrome.google.com/webstore/detail/ofpglhlcdbjdhlacgbljnildhajfmlei)

Google Chrome Download Manager Plugin

Click on the plugin icon to see the status of all downloaded files.

**[简体中文](../README.md) | [English](docs/README_EN.md)**

### **Features**
1. Download file percentage progress display
2. Download files can be paused, resumed, cancelled, deleted
3. Search all downloaded files
4. When prompted to download a dangerous file
5. Right click to copy file name and download link to clipboard
6. Notification during download
7. Download completion tone
8. Shortcut
9. Download the file manually
10. Right-click download menu
11. Custom icon color

### **Supported Language**
`简体中文`、`English`、`Japanese`、`German`、`Russian`、`French`

This is the result of using Google Translate. 
If you have better suggestions, please create Issues or email!

**Steps:**
1. Location of all translation files: public/_locales/\*\*/*.json
2. Enter the corresponding language directory
3. Copy, download or Pull Request modified files. It will be in next version after checking.

### **Future Plan**    
The following features are developing in order 😂:
1. More animation that the icon shows the download status
2. Solve the problem that the file that failed to retry downloading becomes a newly created download
3. Proxy settings
4. Obsessive-compulsive disorder series: only display the name of the downloaded file, the download panel stops showing the flying in and flying out animation
5. Customize the download panel theme

### **Info**
[Chrome Web Store](https://chrome.google.com/webstore/detail/%E4%B8%8B%E8%BD%BD%E7%AE%A1%E7%90%86%E5%99%A8/ofpglhlcdbjdhlacgbljnildhajfmlei)

#### **Latest Version**：0.9.2
What's New:
1. Dark Mode is coming!  
The theme file：[`public/theme/theme.json`](https://github.com/xinghaix/download-manager/blob/master/public/theme/theme.json)  
You can change it yourself, or upload your own theme file here. It will be in next version after checking.

Optimization:
1. Update French translation

<img src="../docs/img/1.png" width="320" hegiht="420" alt=""/>

### **Build & Package**
```
# Load dependency
npm install

# Compile and package
npm run build
```

### Help
If you have any questions or ideas, please create issues
or
send email to me `xinghaixuanwo@outlook.com`
