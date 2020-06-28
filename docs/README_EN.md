# **download-manager**
[![build](https://img.shields.io/travis/xinghaix/download-manager/master?style=flat-square)](https://www.travis-ci.org/xinghaix/download-manager)
![language](https://img.shields.io/badge/language-Vue.js-forestgreen.svg?style=flat-square)
[![Hex.pm](https://img.shields.io/github/license/xinghaix/download-manager?style=flat-square)](https://github.com/xinghaix/download-manager/blob/master/LICENSE)

[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/ofpglhlcdbjdhlacgbljnildhajfmlei.svg?style=flat-square&label=Chrome%20Web%20Store)](https://chrome.google.com/webstore/detail/ofpglhlcdbjdhlacgbljnildhajfmlei)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/d/ofpglhlcdbjdhlacgbljnildhajfmlei.svg?style=flat-square&label=Users)](https://chrome.google.com/webstore/detail/ofpglhlcdbjdhlacgbljnildhajfmlei)
[![Chrome Web Store Rating](https://img.shields.io/chrome-web-store/rating/ofpglhlcdbjdhlacgbljnildhajfmlei.svg?style=flat-square&label=Rating)](https://chrome.google.com/webstore/detail/ofpglhlcdbjdhlacgbljnildhajfmlei)

[![Microsoft Edge Version](https://img.shields.io/badge/dynamic/json?style=flat-square&label=Microsoft%20Edge%20Add-on&query=$.version&url=https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/phalbpghhjknlmomkmimbamfceiddlic)](https://microsoftedge.microsoft.com/addons/detail/phalbpghhjknlmomkmimbamfceiddlic)
[![Microsoft Edge Rating](https://img.shields.io/badge/dynamic/json?style=flat-square&color=green&label=Rating&query=$.averageRating&suffix=%2F5&url=https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/phalbpghhjknlmomkmimbamfceiddlic)](https://microsoftedge.microsoft.com/addons/detail/phalbpghhjknlmomkmimbamfceiddlic)

Google Chrome Download Manager Plugin  
Click on the plugin icon to see the status of all downloaded files.

### **[简体中文](../README.md) | [English](README_EN.md)**

[Chrome Web Store](https://chrome.google.com/webstore/detail/%E4%B8%8B%E8%BD%BD%E7%AE%A1%E7%90%86%E5%99%A8/ofpglhlcdbjdhlacgbljnildhajfmlei) 、
[Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/phalbpghhjknlmomkmimbamfceiddlic)

### [Privacy Policy](Privacy_EN.md)

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
12. Custom theme

### **Supported Language**
`简体中文`、`English`、`Japanese`、`German`、`Russian`、`French`

This is the result of using Google Translate. 
If you have better suggestions, please create Issues or send emails!

**Steps:**
1. Location of all translation files: public/_locales/\*\*/*.json
2. Enter the corresponding language directory
3. Copy, download or Pull Request modified files. It will be in next version after checking.

### **Future Plan**    
The following features are developing in order 😂:
1. Solve the problem that the file that failed to retry downloading becomes a newly created download
2. Customize the download panel theme
3. Obsessive-compulsive disorder series: only display the name of the downloaded file, the download panel stops showing the flying in and flying out animation
4. Proxy settings

### **Info**
#### **Latest Version**：1.0.7
What's New:
1. Add a drop-down menu to the empty list button
2. Optimize the interface display

<img src="../docs/img/Popup_EN.png.png" width="320" hegiht="420" alt=""/>
<img src="../docs/img/Settings_EN.png" width="320" hegiht="420" alt=""/>

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
