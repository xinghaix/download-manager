<script>
  import { onMount } from 'svelte'
  import Icon from '../../components/Icon.svelte'
  import FloatingTooltip from '../../components/FloatingTooltip.svelte'
  import common from '../../utils/common'
  import storage from '../../utils/storage'
  import Settings from './Settings.svelte'
  import Theme from './Theme.svelte'
  import About from './About.svelte'

  const i18data = common.i18data
  const publicPath = import.meta.env.BASE_URL

  let isCollapse = $state(false)
  let selectedIndex = $state('#settings')
  let visitedTabs = $state({
    '#settings': true,
    '#theme': false,
    '#about': false
  })
  let mainScrollEl = $state(null)
  let mainScrollTop = $state(0)
  let currentThemeMode = $state('auto')

  let sideTooltip = $state({
    visible: false,
    content: '',
    triggerEl: null
  })

  function applyDocumentTheme(mode) {
    const effective = (mode === 'light' || mode === 'dark')
      ? mode
      : (common.isInDarkMode() ? 'dark' : 'light')
    document.documentElement.dataset.theme = effective
  }

  onMount(() => {
    document.title = i18data.settingsTitle + ' - ' + i18data.extensionName

    let disposed = false
    storage.get('theme').then(savedTheme => {
      if (disposed) {
        return
      }
      currentThemeMode = savedTheme || 'auto'
      applyDocumentTheme(currentThemeMode)
    })

    const storageChangeListener = (changes) => {
      if (changes.theme) {
        currentThemeMode = changes.theme.newValue || 'auto'
        applyDocumentTheme(currentThemeMode)
      }
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(storageChangeListener)
    }

    const darkModeMediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    const mediaChangeListener = () => {
      if (currentThemeMode === 'auto') {
        applyDocumentTheme('auto')
      }
    }
    if (darkModeMediaQuery) {
      darkModeMediaQuery.addEventListener('change', mediaChangeListener)
    }

    return () => {
      disposed = true
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(storageChangeListener)
      }
      if (darkModeMediaQuery) {
        darkModeMediaQuery.removeEventListener('change', mediaChangeListener)
      }
    }
  })

  function handleSideSelect(index) {
    hideSideTooltip()
    visitedTabs[index] = true
    selectedIndex = index
    if (mainScrollEl) {
      mainScrollEl.scrollTop = 0
      mainScrollTop = 0
    }
  }

  function toggleCollapse() {
    isCollapse = !isCollapse
    if (!isCollapse) {
      hideSideTooltip()
    }
  }

  function showSideTooltip(event, content) {
    if (!isCollapse || !event?.currentTarget) {
      return
    }
    sideTooltip = {
      visible: true,
      content,
      triggerEl: event.currentTarget
    }
  }

  function hideSideTooltip() {
    if (sideTooltip.visible) {
      sideTooltip = {
        ...sideTooltip,
        visible: false
      }
    }
  }

  function handleMainScroll(event) {
    mainScrollTop = event.currentTarget.scrollTop
  }

  function scrollToTop() {
    if (mainScrollEl) {
      mainScrollEl.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
</script>

<div class="home">
  <aside class="el-aside" style:width={isCollapse ? '60px' : '192px'}>
    <div class="aside-header">
      <img
        src="{publicPath}img/icon38-white.png"
        class="icon"
        class:collapsed={isCollapse}
        alt=""
        draggable="false"
      />
      {#if !isCollapse}
        <span class="title">{i18data.extensionName}</span>
      {/if}
    </div>

    <div class="aside-menu-div">
      <nav class="side-menu" aria-label="Options navigation">
        <button
          type="button"
          class="side-menu-item"
          class:is-active={selectedIndex === '#settings'}
          class:is-collapsed={isCollapse}
          aria-label={i18data.settingsTitle}
          onmouseenter={(e) => showSideTooltip(e, i18data.settingsTitle)}
          onmouseleave={hideSideTooltip}
          onclick={() => handleSideSelect('#settings')}
        >
          <span class="menu-icon"><Icon name="Tools" size="18px" /></span>
          {#if !isCollapse}
            <span class="menu-title">{i18data.settingsTitle}</span>
          {/if}
        </button>

        <button
          type="button"
          class="side-menu-item"
          class:is-active={selectedIndex === '#theme'}
          class:is-collapsed={isCollapse}
          aria-label={i18data.themeTitle}
          onmouseenter={(e) => showSideTooltip(e, i18data.themeTitle)}
          onmouseleave={hideSideTooltip}
          onclick={() => handleSideSelect('#theme')}
        >
          <span class="menu-icon"><Icon name="TakeawayBox" size="18px" /></span>
          {#if !isCollapse}
            <span class="menu-title">{i18data.themeTitle}</span>
          {/if}
        </button>

        <button
          type="button"
          class="side-menu-item"
          class:is-active={selectedIndex === '#about'}
          class:is-collapsed={isCollapse}
          aria-label={i18data.aboutTitle}
          onmouseenter={(e) => showSideTooltip(e, i18data.aboutTitle)}
          onmouseleave={hideSideTooltip}
          onclick={() => handleSideSelect('#about')}
        >
          <span class="menu-icon"><Icon name="InfoFilled" size="18px" /></span>
          {#if !isCollapse}
            <span class="menu-title">{i18data.aboutTitle}</span>
          {/if}
        </button>
      </nav>
    </div>

    <button
      type="button"
      class="aside-footer"
      aria-label={isCollapse ? 'Expand sidebar' : 'Collapse sidebar'}
      onclick={toggleCollapse}
    >
      <span class="collapse-icon" class:right={isCollapse} class:left={!isCollapse}>
        <Icon name="DArrowLeft" size="18px" />
      </span>
    </button>
  </aside>

  <main
    class="main-container"
    bind:this={mainScrollEl}
    onscroll={handleMainScroll}
  >
    {#if visitedTabs['#settings']}
      <div class="content-item content-item-wide" class:is-hidden={selectedIndex !== '#settings'}>
        <Settings {i18data} />
      </div>
    {/if}
    {#if visitedTabs['#theme']}
      <div class="content-item content-item-wide" class:is-hidden={selectedIndex !== '#theme'}>
        <Theme {i18data} />
      </div>
    {/if}
    {#if visitedTabs['#about']}
      <div class="content-item content-item-wide" class:is-hidden={selectedIndex !== '#about'}>
        <About {i18data} />
      </div>
    {/if}

    {#if mainScrollTop > 200}
      <button
        type="button"
        class="backtop-button"
        aria-label="Back to top"
        onclick={scrollToTop}
      >
        <Icon name="CaretTop" size="20px" />
      </button>
    {/if}

    <FloatingTooltip
      visible={isCollapse && sideTooltip.visible}
      content={sideTooltip.content}
      triggerEl={sideTooltip.triggerEl}
      placement="right"
    />
  </main>
</div>

<style>
  .home {
    display: flex;
    width: 100vw;
    height: 100vh;
    margin: 0 auto;
    overflow: hidden;
    background-color: var(--opt-bg, #f6f8fb);
  }

  /* 侧边栏 */
  .el-aside {
    height: 100vh;
    flex-shrink: 0;
    transition: width 0.2s ease, background-color 0.2s ease;
    overflow: hidden;
    background-color: var(--opt-sidebar-bg, #363d4d);
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
  }

  /* 侧边栏标题 */
  .aside-header {
    display: flex;
    align-items: center;
    height: 56px;
    flex-shrink: 0;
    color: var(--opt-sidebar-text, #ffffff);
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
  }

  .aside-header .icon {
    height: 28px;
    padding-left: 11px;
    transition: padding-left 0.2s ease;
    flex-shrink: 0;
  }

  .aside-header .icon.collapsed {
    padding-left: 16px;
  }

  .aside-header .title {
    padding-left: 6px;
    line-height: 56px;
    font-size: 16px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 侧边栏菜单 父级 */
  .aside-menu-div {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .aside-menu-div::-webkit-scrollbar {
    width: 7px;
  }

  .aside-menu-div::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.2);
  }

  /* 侧边栏菜单 */
  .side-menu {
    display: flex;
    flex-direction: column;
    background-color: transparent;
    user-select: none;
  }

  .side-menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    height: 52px;
    padding: 0 20px;
    border: none;
    border-left: 3px solid transparent;
    outline: none;
    background-color: transparent;
    color: var(--opt-sidebar-text, rgba(255, 255, 255, 0.92));
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
    box-sizing: border-box;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .side-menu-item.is-collapsed {
    padding: 0;
    justify-content: center;
  }

  .side-menu-item:hover {
    background-color: var(--opt-sidebar-active-bg, #3b557f);
    color: var(--opt-sidebar-active-text, #dbeafe);
  }

  .side-menu-item.is-active {
    background-color: var(--opt-sidebar-active-bg, #3b557f);
    color: var(--opt-sidebar-active-text, #dbeafe);
    border-left-color: var(--opt-sidebar-active-border, #579aff);
  }

  .side-menu-item .menu-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-right: 10px;
    color: inherit;
    flex-shrink: 0;
  }

  .side-menu-item.is-collapsed .menu-icon {
    margin-right: 0;
  }

  /* 侧边栏 折叠按钮 */
  .aside-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 54px;
    flex-shrink: 0;
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    outline: none;
    background: transparent;
    cursor: pointer;
  }

  .aside-footer .collapse-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--opt-sidebar-text, rgba(255, 255, 255, 0.9));
    transition: transform 0.3s ease, color 0.15s ease;
  }

  .aside-footer:hover .collapse-icon {
    color: var(--opt-sidebar-active-text, #dbeafe);
  }

  .aside-footer .collapse-icon.right {
    transform: rotateZ(180deg);
  }

  .aside-footer .collapse-icon.left {
    transform: rotateZ(0deg);
  }

  /* 右侧中间区域 */
  .main-container {
    flex: 1 1 auto;
    min-width: 0;
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
  }

  .main-container::-webkit-scrollbar {
    width: 8px;
  }

  .main-container::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background: rgba(144, 147, 153, 0.28);
  }

  .main-container::-webkit-scrollbar-thumb:hover {
    background: rgba(144, 147, 153, 0.48);
  }

  .content-item {
    width: min(600px, 100%);
    min-height: 100%;
    margin: 0 auto;
  }

  .content-item-wide {
    width: min(960px, 100%);
  }

  .content-item.is-hidden {
    display: none;
  }

  /* 返回顶部按钮 */
  .backtop-button {
    position: fixed;
    right: 36px;
    bottom: 36px;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 1px solid var(--opt-border, #e5eaf3);
    border-radius: 50%;
    background-color: var(--opt-surface, #ffffff);
    color: var(--opt-accent, #409eff);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--opt-popover-shadow, 0 8px 24px rgba(0, 0, 0, 0.14));
    cursor: pointer;
    z-index: 5;
    transition: background-color 0.16s ease, transform 0.16s ease;
  }

  .backtop-button:hover {
    background-color: var(--opt-surface-hover, #f3f6fb);
    transform: translateY(-1px);
  }
</style>
