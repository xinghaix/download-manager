<!--suppress HtmlUnknownTarget -->
<template>
  <el-container class="home">
    <!-- 侧边栏 -->
    <el-aside class="el-aside" :style="{ width: isCollapse ? '60px' : '192px' }">
      <!-- 侧边栏header -->
      <div class="aside-header">
        <img :src="`${publicPath}img/icon38-white.png`"
             :class="isCollapse ? 'true' : 'false'" class="icon" alt="" draggable="false"/>
        <span v-show="!isCollapse" class="title">{{i18data.extensionName}}</span>
      </div>
      <!-- 侧边栏菜单 -->
      <div class="aside-menu-div">
        <el-scrollbar class="side-scrollbar">
          <el-menu class="side-menu" :default-active="selectedIndex" @select="handleSideSelect"
                   :collapse="isCollapse" :collapse-transition="false">
            <el-menu-item index="#settings">
              <el-icon><Tools /></el-icon>
              <template #title>{{i18data.settingsTitle}}</template>
            </el-menu-item>
            <el-menu-item index="#theme">
              <el-icon><TakeawayBox /></el-icon>
              <template #title>{{i18data.themeTitle}}</template>
            </el-menu-item>
            <el-menu-item index="#about">
              <el-icon><InfoFilled /></el-icon>
              <template #title>{{i18data.aboutTitle}}</template>
            </el-menu-item>
          </el-menu>
        </el-scrollbar>
      </div>
      <!-- 侧边栏footer -->
      <!-- 折叠展开按钮 -->
      <div class="aside-footer" @click="isCollapse = !isCollapse">
        <el-icon :class="isCollapse ? 'right' : 'left'" class="collapse-icon"><DArrowLeft /></el-icon>
      </div>
    </el-aside>
    <el-container class="main-container">
      <el-scrollbar class="content-scrollbar">
        <Settings :i18data="i18data" class="content-item" v-show="selectedIndex === '#settings'"/>
        <Theme :i18data="i18data" class="content-item content-item-wide" v-show="selectedIndex === '#theme'"/>
        <About :i18data="i18data" class="content-item" v-show="selectedIndex === '#about'"/>
      </el-scrollbar>
      <el-backtop target=".main-container .el-scrollbar__wrap"/>
    </el-container>
  </el-container>
</template>

<!--suppress JSUnresolvedVariable, UnterminatedStatementJS -->
<script>
  /* eslint-disable no-undef */
  import { DArrowLeft, InfoFilled, TakeawayBox, Tools } from '@element-plus/icons-vue'
  import common from '../../utils/common'
  import Settings from './Settings'
  import About from './About'
  import Theme from './Theme'

  export default {
    name: 'Options',
    components: { About, DArrowLeft, InfoFilled, Settings, TakeawayBox, Theme, Tools },
    mounted() {
      document.title = this.i18data.settingsTitle + ' - ' + this.i18data.extensionName
    },
    data() {
      return {
        publicPath: process.env.BASE_URL,
        isCollapse: false,
        selectedIndex: '#settings',
        i18data: common.i18data
      }
    },
    methods: {
      handleSideSelect(index) {
        this.selectedIndex = index
      }
    }
  }
</script>

<!--suppress CssUnusedSymbol -->
<style scoped rel="stylesheet/css">
  .home {
    margin: 0 auto;
  }

  /* 侧边栏 */
  .el-aside {
    height: calc(100vh);
    transition: .2s;
    overflow: hidden;
    background-color: #3d4454;
  }
  /* 侧边栏标题 */
  .aside-header {
    display: inline-block;
    height: 56px;
    color: rgba(255, 255, 255, 1);
    user-select: none;
  }
  .aside-header .icon {
    float: left;
    height: 28px;
    padding-left: 13px;
    padding-top: 14px;
    line-height: 56px;
    transition: .2s;
  }
  .aside-header .icon.false {
    padding-left: 13px;
  }
  .aside-header .icon.false {
    padding-left: 9px;
  }
  .aside-header .title {
    float: left;
    padding-left: 1px;
    line-height: 56px;
    font-size: 16px;
  }
  /* 侧边栏菜单 父级 */
  .aside-menu-div {
    height: calc(100vh - 112px);
  }
  /* 侧边栏菜单 滚动条 */
  .side-scrollbar {
    height: 100%;
    width: 100%;
    overflow: hidden;
  }
  .side-scrollbar :deep(.el-scrollbar__wrap) {
    overflow: hidden;
    overflow-y: scroll;
  }
  .side-scrollbar :deep(.el-scrollbar__bar.is-vertical) {
    width: 7px;
    right: 2px;
  }
  .side-scrollbar :deep(.el-scrollbar__bar.is-horizontal) {
    display: none!important;
  }
  /* 侧边栏菜单*/
  .side-menu {
    border-right: none;
    background-color: rgba(61, 68, 84, 1);
    -moz-user-select: none;
    -webkit-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }
  .side-menu .el-menu-item {
    color: rgba(255, 255, 255, 1);
    background-color: rgba(61, 68, 84, 1);
  }
  .side-menu .el-menu-item:hover {
    background-color: rgba(59, 85, 127, 1);
    color: rgba(174, 206, 255, 1);
  }
  .side-menu .el-dropdown-menu {
    color: rgba(255, 255, 255, 1);
    background-color: rgba(61, 68, 84, 1);
  }
  .side-menu :deep(.el-submenu__title) {
    color: rgba(255, 255, 255, 1);
    background-color: rgba(61, 68, 84, 1);
  }
  .side-menu :deep(.el-submenu__title span) {
    padding-left: 6px;
  }
  .side-menu :deep(.el-menu-item .el-icon) {
    padding-right: 6px;
    color: rgba(255,255,255,1);
  }
  .side-menu :deep(.el-menu-item .el-menu-tooltip__trigger) {
    padding-left: 12px;
  }
  .side-menu :deep(.el-menu-item.is-active) {
    background-color: rgba(59, 85, 127, 1);
    color: rgba(174, 206, 255, 1);
    border-left: 3px solid rgba(87, 154, 255, 1);
    -webkit-transition: opacity 0.15s cubic-bezier(0.645, 0.045, 0.355, 1), -webkit-transform 0.15s cubic-bezier(0.645, 0.045, 0.355, 1);
    transition: transform 0.15s cubic-bezier(0.645, 0.045, 0.355, 1), opacity 0.15s cubic-bezier(0.645, 0.045, 0.355, 1), -webkit-transform 0.15s cubic-bezier(0.645, 0.045, 0.355, 1);
  }
  .side-menu :deep(.el-menu-item.is-active .el-icon) {
    margin-left: -3px;
    color: rgba(174, 206, 255, 1);
  }
  .side-menu :deep(.el-menu-item.is-active .el-menu-tooltip__trigger) {
    margin-left: -3px;
  }
  /* 侧边栏 折叠按钮 */
  .aside-footer {
    text-align: center;
    height: 56px;
    line-height: 58px;
  }
  .aside-footer:hover {
    cursor: pointer;
  }
  .aside-footer:hover .collapse-icon {
    color: rgba(174, 206, 255, 1);
  }
  .aside-footer .collapse-icon {
    color: rgba(255,255,255,1);
    font-size: 18px;
  }
  .aside-footer .collapse-icon:hover {
    color: rgba(174, 206, 255, 1);
    font-size: 18px;
  }
  .aside-footer .collapse-icon.right {
    transition: .3s;
    transform-origin: center center;
    transform: rotateZ(180deg);
  }
  .aside-footer .collapse-icon.left {
    transition: .3s;
    transform-origin: center center;
    transform: rotateZ(0deg);
  }


  /* 右侧中间区域 */
  .main-container {
    height: calc(100vh);
    margin: 0 auto;
  }
  /* 中间区域 滚动条 */
  .content-scrollbar {
    height: 100%;
    width: 100%;
    overflow: hidden;
  }
  .content-scrollbar :deep(.el-scrollbar__wrap) {
    overflow: hidden;
    overflow-y: scroll;
  }
  .content-scrollbar :deep(.el-scrollbar__bar.is-vertical) {
    width: 8px;
    right: 2px;
  }
  .content-item {
    width: min(600px, 100%);
    min-height: 100%;
  }
  .content-item-wide {
    width: min(960px, 100%);
  }
</style>
