<!--suppress HtmlUnknownTarget -->
<template>
  <el-container class="home">
    <!-- 侧边栏 -->
    <el-aside class="el-aside" :style="{ width: isCollapse ? '60px' : '192px' }">
      <!-- 侧边栏header -->
      <div class="aside-header">
        <img :src="`${publicPath}img/icon38-white.png`"
             :class="isCollapse ? 'true' : 'false'" class="icon" alt="" draggable="false"/>
        <span v-show="!isCollapse" class="title">{{extensionName}}</span>
      </div>
      <!-- 侧边栏菜单 -->
      <div class="aside-menu-div">
        <el-scrollbar class="side-scrollbar">
          <el-menu class="side-menu" :default-active="selectedIndex" @select="handleSideSelect"
                   :collapse="isCollapse" :collapse-transition=false>
            <el-menu-item index="#settings">
              <i class="iconfont el-icon-s-tools"/>
              <span slot="title">{{settingsTitle}}</span>
            </el-menu-item>
            <el-menu-item index="#about">
              <i class="iconfont el-icon-info"/>
              <span slot="title">{{aboutTitle}}</span>
            </el-menu-item>
          </el-menu>
        </el-scrollbar>
      </div>
      <!-- 侧边栏footer -->
      <!-- 折叠展开按钮 -->
      <div class="aside-footer" @click="isCollapse = !isCollapse">
        <i :class="isCollapse ? 'right' : 'left'" class="iconfont el-icon-d-arrow-left"/>
      </div>
    </el-aside>
    <el-container class="main-container">
      <el-scrollbar class="content-scrollbar">
        <Settings :title="settingsTitle" class="content-item" v-show="selectedIndex === '#settings'"/>
        <About :title="aboutTitle" class="content-item" v-show="selectedIndex === '#about'"/>
      </el-scrollbar>
      <el-backtop target=".main-container .el-scrollbar__wrap"/>
    </el-container>
  </el-container>
</template>

<!--suppress JSUnresolvedVariable, UnterminatedStatementJS -->
<script>
  /* eslint-disable no-undef */
  import common from "../../utils/common"
  import Settings from "./Settings";
  import About from "./About";
  export default {
  name: 'Options',
  components: { Settings, About },
  mounted() {
  },
  data() {
    return {
      publicPath: process.env.BASE_URL,
      isCollapse: false,
      selectedIndex: '#settings',
      extensionName: common.loadI18nMessage('extName'),
      settingsTitle: common.loadI18nMessage('settingsTitle'),
      aboutTitle: common.loadI18nMessage('aboutTitle'),
    }
  },
  methods: {
    // 当侧边栏菜单被选中时的回调事件
    handleSideSelect(index) {
      this.selectedIndex = index;
    }
  }
}
</script>

<!--suppress CssUnusedSymbol -->
<style scoped rel="stylesheet/css">
  .home {
    margin: 0 auto;
    font-family: Segoe UI, Microsoft YaHei, sans-serif;
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
  .side-scrollbar >>> .el-scrollbar__wrap {
    overflow: hidden;
    overflow-y: scroll;
  }
  .side-scrollbar >>> .el-scrollbar__bar.is-vertical {
    width: 7px;
    right: 2px;
  }
  .side-scrollbar >>> .el-scrollbar__bar.is-horizontal {
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
  .side-menu >>> .el-submenu__title {
    color: rgba(255, 255, 255, 1);
    background-color: rgba(61, 68, 84, 1);
  }
  .side-menu >>> .el-submenu__title span {
    padding-left: 6px;
  }
  .side-menu >>> .el-menu-item i:first-child {
    padding-right: 6px;
  }
  .side-menu >>> .el-menu-item span:first-child {
    padding-left: 12px;
  }
  .side-menu >>> .el-menu-item.is-active {
    background-color: rgba(59, 85, 127, 1);
    color: rgba(174, 206, 255, 1);
    border-left: 3px solid rgba(87, 154, 255, 1);
    -webkit-transition: opacity 0.15s cubic-bezier(0.645, 0.045, 0.355, 1), -webkit-transform 0.15s cubic-bezier(0.645, 0.045, 0.355, 1);
    transition: transform 0.15s cubic-bezier(0.645, 0.045, 0.355, 1), opacity 0.15s cubic-bezier(0.645, 0.045, 0.355, 1), -webkit-transform 0.15s cubic-bezier(0.645, 0.045, 0.355, 1);
    -webkit-transform: scaleY(1);
    transform: scaleY(1);
  }
  .side-menu >>> .el-menu-item.is-active i {
    margin-left: -3px;
  }
  .side-menu >>> .el-menu-item.is-active span:first-child {
    margin-left: -3px;
  }
  .side-menu .iconfont {
    color: rgba(255,255,255,1);
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
  .aside-footer:hover .iconfont {
    color: rgba(174, 206, 255, 1);
  }
  .aside-footer .iconfont {
    color: rgba(255,255,255,1);
    font-size: 18px;
  }
  .aside-footer .iconfont:hover {
    color: rgba(174, 206, 255, 1);
    font-size: 18px;
  }
  .aside-footer .iconfont.right {
    transition: .3s;
    transform-origin: center center;
    transform: rotateZ(180deg);
  }
  .aside-footer .iconfont.left {
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
  .content-scrollbar >>> .el-scrollbar__wrap {
    overflow: hidden;
    overflow-y: scroll;
  }
  .content-scrollbar >>> .el-scrollbar__bar.is-vertical {
    width: 8px;
    right: 2px;
  }
  .content-item {
    width: 600px;
    height: 100%;
  }
</style>
