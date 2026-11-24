<script>
  import Icon from '../../components/Icon.svelte'
  import common from '../../utils/common'

  let { i18data } = $props()

  const githubUrl = 'https://github.com/xinghaix/download-manager'
  const edgePluginShopUrl = 'https://microsoftedge.microsoft.com/addons/detail/dppelgknofnkccigopomkbdedbkkcbgh'
  const chromePluginShopUrl = 'https://chrome.google.com/webstore/detail/ofpglhlcdbjdhlacgbljnildhajfmlei'

  const manifest = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
    ? chrome.runtime.getManifest()
    : { name: 'download-manager', version: '' }

  const extName = manifest.name
  const version = manifest.version

  function openPluginShop(event) {
    event?.preventDefault()
    const url = common.isInEdge() ? edgePluginShopUrl : chromePluginShopUrl
    openUrl(url)
  }

  function openUrl(url, event) {
    event?.preventDefault()
    chrome.tabs.create({ url })
  }
</script>

<div class="home">
  <h2 class="title">{i18data.aboutTitle}</h2>
  <div class="about-card box-card">
    <div class="card-body">
      <div class="about-row">
        <div class="about-main">
          <span class="about-icon"><Icon name="InfoFilled" size="16px" /></span>
          <span class="about-name">{extName}</span>
          {#if version}
            <span class="version">{version}</span>
          {/if}
        </div>
        <a class="link" href={githubUrl} onclick={(e) => openUrl(githubUrl, e)}>GITHUB</a>
      </div>
      <hr class="divider" />
      <div class="about-row">
        <div class="about-main">
          <span class="about-icon star-icon"><Icon name="StarFilled" size="17px" /></span>
          <span class="about-desc">
            {i18data.starAbout1}
            <a class="link" href={chromePluginShopUrl} onclick={openPluginShop}>{i18data.pluginShopAbout}</a>
            {i18data.starAbout2}
          </span>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .home {
    height: 100%;
    width: 100%;
    padding: 20px;
    box-sizing: border-box;
  }

  .title {
    font-size: 15px;
    font-weight: 600;
    color: var(--opt-text-primary, #1f2937);
    margin: 0 0 12px 2px;
  }

  /* 通用卡片样式 */
  .box-card {
    width: 100%;
    max-width: 920px;
    margin-bottom: 32px;
    border-radius: var(--opt-radius-card, 10px);
    border: 1px solid var(--opt-border, #e5eaf3);
    background-color: var(--opt-surface, #ffffff);
    color: var(--opt-text-primary, #1f2937);
    box-shadow: var(--opt-card-shadow, 0 1px 2px rgba(15, 23, 42, 0.04));
    transition: box-shadow 0.24s ease, border-color 0.24s ease;
    box-sizing: border-box;
  }

  .box-card:hover {
    box-shadow: var(--opt-card-shadow-hover, 0 6px 18px rgba(15, 23, 42, 0.07));
  }

  .box-card .card-body {
    padding: 14px 20px;
  }

  .divider {
    margin: 12px 0;
    height: 0;
    border: none;
    border-top: 1px solid var(--opt-border-subtle, #edf1f7);
  }

  .about-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 4px 0;
    font-size: 14px;
  }

  .about-main {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }

  .about-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--opt-accent, #409eff);
    flex-shrink: 0;
  }

  .about-name {
    font-weight: 600;
    color: var(--opt-text-primary, #1f2937);
  }

  .about-desc {
    font-weight: 500;
    color: var(--opt-text-secondary, #4b5563);
    line-height: 1.55;
  }

  .version {
    display: inline-flex;
    align-items: center;
    background-color: var(--opt-badge-bg, #eef2f7);
    border: 1px solid var(--opt-badge-border, #dce3ee);
    color: var(--opt-badge-text, #374151);
    padding: 1px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .link {
    color: var(--opt-accent, #409eff);
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    flex-shrink: 0;
  }

  .link:hover {
    color: var(--opt-accent-hover, #2d8cf0);
    text-decoration: underline;
  }
</style>
