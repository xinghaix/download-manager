<script>
  import { untrack } from 'svelte'
  import Icon from '../../components/Icon.svelte'
  import Progress from './Progress.svelte'
  import {
    canAcceptDanger as canAcceptDangerDownload,
    getDangerStatus,
    isDangerousDownload
  } from '../../utils/downloadDanger'
  import {
    getStoredFileIcon,
    loadFileIcon,
    markCompletedFileIconRefreshed,
    rememberItemFileIcon,
    resetFileIcon,
    shouldRefreshCompletedFileIcon
  } from '../../utils/downloadFileIcon'

  let {
    item,
    i18data,
    closeTooltip,
    showActionTooltip = null,
    hideActionTooltip = null,
    leftClickFile,
    leftClickUrl,
    rightClickFile,
    rightClickUrl,
    render,
    erase,
    requestRemove,
    requestDownload,
    copyToClipboard,
    showDownloadProgress = true,
    showDownloadUrl = true,
    showCopyUrlButton = false,
    enableAnimation = false
  } = $props()

  let resolvedIconUrl = $state(null)
  let iconLoading = false
  let iconRefreshAfterLoading = false
  let cancelIconRequest = null
  let copiedUrl = $state(false)
  let copiedUrlTimer = null
  let lastTrackedId
  let lastTrackedFilename
  let lastTrackedState

  const copyUrlTarget = $derived(item.finalUrl || item.url || '')
  const canCopyUrl = $derived(Boolean(showCopyUrlButton && copyUrlTarget))
  const isGray = $derived(!item.exists || Boolean(item.error))
  const isDanger = $derived(isDangerousDownload(item))
  const canAccept = $derived(canAcceptDangerDownload(item))
  const canOpenFolder = $derived(
    (item.state === 'complete' || item.state === 'in_progress') && Boolean(item.exists)
  )
  const canRemove = $derived(item.state === 'complete' && Boolean(item.exists))
  const canRetry = $derived(
    item.state === 'interrupted' && (Boolean(item.canResume) || Boolean(item.url))
  )

  function abortPendingIconLoad() {
    if (cancelIconRequest) {
      cancelIconRequest()
      cancelIconRequest = null
    }
    iconLoading = false
    iconRefreshAfterLoading = false
  }

  function syncResolvedIconUrl() {
    resolvedIconUrl = getStoredFileIcon(item)
  }

  function ensureFileIcon(options = {}) {
    if (!item || !item.filename) {
      return
    }

    const forceRefresh = Boolean(options.forceRefresh)
    const cachedIconUrl = getStoredFileIcon(item, { ignoreItemIcon: forceRefresh })
    if (!forceRefresh && cachedIconUrl) {
      resolvedIconUrl = cachedIconUrl
      return
    }

    if (!forceRefresh && item.iconUrl) {
      resolvedIconUrl = item.iconUrl
      rememberItemFileIcon(item)
      return
    }

    if (iconLoading) {
      if (forceRefresh) {
        iconRefreshAfterLoading = true
      }
      return
    }

    resolvedIconUrl = null
    iconLoading = true

    const targetItemId = item.id
    const { promise, cancel } = loadFileIcon(item, { forceRefresh })
    cancelIconRequest = cancel

    promise.then(iconUrl => {
      if (item && item.id === targetItemId) {
        resolvedIconUrl = iconUrl || null
      }
    }).finally(() => {
      if (cancelIconRequest === cancel) {
        cancelIconRequest = null
      }
      if (!item || item.id !== targetItemId) {
        return
      }
      iconLoading = false
      if (iconRefreshAfterLoading) {
        iconRefreshAfterLoading = false
        ensureFileIcon({ forceRefresh: true })
      }
    })
  }

  function refreshCompletedFileIcon() {
    if (!item || typeof item.id !== 'number') {
      return
    }

    if (!shouldRefreshCompletedFileIcon(item.id)) {
      syncResolvedIconUrl()
      return
    }

    markCompletedFileIconRefreshed(item.id)
    resetFileIcon(item.id)
    ensureFileIcon({ forceRefresh: true })
  }

  $effect(() => {
    const id = item?.id
    const filename = item?.filename
    const state = item?.state

    untrack(() => {
      const idChanged = id !== lastTrackedId
      const filenameChanged = filename !== lastTrackedFilename
      const becameComplete = state === 'complete' && lastTrackedState !== 'complete'

      lastTrackedId = id
      lastTrackedFilename = filename
      lastTrackedState = state

      if (idChanged) {
        clearCopiedUrlTimer()
        copiedUrl = false
        abortPendingIconLoad()
        syncResolvedIconUrl()
        if (state === 'complete') {
          refreshCompletedFileIcon()
        } else {
          ensureFileIcon()
        }
        return
      }

      if (filenameChanged) {
        ensureFileIcon()
      }

      if (becameComplete) {
        refreshCompletedFileIcon()
      }
    })
  })

  $effect(() => {
    return () => {
      clearCopiedUrlTimer()
      abortPendingIconLoad()
    }
  })

  function clearCopiedUrlTimer() {
    if (copiedUrlTimer) {
      clearTimeout(copiedUrlTimer)
      copiedUrlTimer = null
    }
  }

  async function handleCopyUrlButton(event) {
    if (!copyUrlTarget) {
      return
    }
    await copyToClipboard(copyUrlTarget, event)
    copiedUrl = true
    clearCopiedUrlTimer()
    copiedUrlTimer = setTimeout(() => {
      copiedUrl = false
      copiedUrlTimer = null
    }, 1100)
  }

  function onActionEnter(event, text) {
    if (closeTooltip || !showActionTooltip || !event || !event.currentTarget) {
      return
    }
    showActionTooltip(event.currentTarget, text, 'top')
  }

  function onActionLeave() {
    if (hideActionTooltip) {
      hideActionTooltip()
    }
  }

  function onActionClick(event, fn) {
    event.stopPropagation()
    if (hideActionTooltip) {
      hideActionTooltip()
    }
    if (typeof fn === 'function') {
      fn()
    }
  }

  async function acceptDanger(target) {
    if (!canAcceptDangerDownload(target)) {
      return
    }

    try {
      await chrome.downloads.acceptDanger(target.id)
      render()
    } catch (e) {
      console.warn('acceptDanger failed', target?.danger, e)
    }
  }

  function dangerDescription(target) {
    switch (getDangerStatus(target)) {
      case 'scanning':
        return i18data.dangerScanningDescription
      case 'blocked':
        return i18data.dangerBlockedDescription
      case 'action_required':
        return i18data.dangerActionRequiredDescription
      default:
        return i18data.dangerDescription
    }
  }

  function discardDanger(target) {
    if (target && target.state === 'in_progress') {
      cancel(target)
      return
    }
    erase(target)
  }

  function openUrl(target) {
    const url = target.finalUrl || target.url
    if (url) {
      chrome.tabs.create({ url })
    }
  }

  function openfile(target) {
    if (target.state === 'complete' && target.exists) {
      try {
        const result = chrome.downloads.open(target.id)
        watchDownloadAction('open file', result)
      } catch (error) {
        handleDownloadActionError('open file', error)
      }
    }
  }

  function showInFolder(target) {
    if (!((target.state === 'complete' || target.state === 'in_progress') && target.exists)) {
      return
    }

    try {
      const result = chrome.downloads.show(target.id)
      watchDownloadAction('show file in folder', result)
    } catch (error) {
      handleDownloadActionError('show file in folder', error)
    }
  }

  function watchDownloadAction(action, result) {
    if (result && typeof result.catch === 'function') {
      result.catch(error => handleDownloadActionError(action, error))
    }
  }

  function handleDownloadActionError(action, error) {
    console.warn(`${action} failed`, error)
    render()
  }

  function remove(target) {
    requestRemove(target)
  }

  function pauseOrResume(target) {
    if (target.paused) {
      resume(target)
    } else {
      pause(target)
    }
  }

  function pause(target) {
    chrome.downloads.pause(target.id, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        render()
        return
      }
      target.paused = true
    })
  }

  function resume(target) {
    chrome.downloads.resume(target.id, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        render()
        return
      }
      target.paused = false
      render()
    })
  }

  async function retryDownload(target) {
    if (target.canResume) {
      resume(target)
      return
    }

    const retryUrl = target.url || target.finalUrl
    if (retryUrl) {
      await requestDownload(retryUrl, async (downloadId) => {
        if (downloadId !== null) {
          await render()
          setTimeout(() => {
            render()
          }, 500)
        }
      })
    }
  }

  function cancel(target) {
    chrome.downloads.cancel(target.id, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        render()
      }
    })
  }

  function getPercentage(target) {
    return target.totalBytes > 0
      ? parseInt((100 * target.bytesReceived / target.totalBytes).toString(), 10)
      : 0
  }

  function getFormattedSize(bytes) {
    if (!bytes || bytes <= 0) {
      return '0B'
    }
    const kbSize = bytes / 1024
    if (kbSize < 1) {
      return bytes.toFixed(0) + 'B'
    } else if (kbSize < 1024) {
      return kbSize.toFixed(1) + 'K'
    } else {
      const mbSize = bytes / 1024 / 1024
      if (mbSize < 1024) {
        return mbSize.toFixed(1) + 'M'
      } else {
        const gbSize = bytes / 1024 / 1024 / 1024
        return gbSize.toFixed(1) + 'G'
      }
    }
  }

  function getSpeed(target) {
    if (target.paused) {
      return '0B/s'
    }

    if (typeof target.downloadSpeedBytesPerSecond === 'number' && target.downloadSpeedBytesPerSecond >= 0) {
      return getFormattedSize(target.downloadSpeedBytesPerSecond) + '/s'
    }

    if (!target.totalBytes || !target.estimatedEndTime) {
      return '0B/s'
    }

    const remainingTime = (new Date(target.estimatedEndTime) - Date.now()) / 1000
    if (isNaN(remainingTime) || remainingTime <= 0) {
      return '0B/s'
    }

    return getFormattedSize((target.totalBytes - target.bytesReceived) / remainingTime) + '/s'
  }

  function remaining(target) {
    if (!target.estimatedEndTime) {
      return i18data.second.replace('{}', '0')
    }

    let rem = (new Date(target.estimatedEndTime) - Date.now()) / 1000
    if (isNaN(rem) || rem <= 0) {
      return i18data.second.replace('{}', '0')
    } else if (rem < 60) {
      return i18data.second.replace('{}', rem.toFixed(0))
    } else {
      rem = rem / 60
      if (rem < 60) {
        return i18data.minute.replace('{}', rem.toFixed(0))
      } else {
        rem = rem / 60
        if (rem < 24) {
          return i18data.hour.replace('{}', rem.toFixed(0))
        } else {
          return i18data.day.replace('{}', (rem / 24).toFixed(0))
        }
      }
    }
  }

  function formatEndTime(time) {
    if (!time) {
      return ''
    }
    const date = new Date(time)
    const timestamp = date.getTime()
    if (isNaN(timestamp)) {
      return ''
    }
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${month}/${day} ${hours}:${minutes}`
  }

  function handleFilenameContextMenu(event) {
    event.preventDefault()
    if (rightClickFile) {
      copyToClipboard(item.basename, event)
    }
  }

  function handleUrlContextMenu(event) {
    event.preventDefault()
    if (rightClickUrl) {
      copyToClipboard(item.finalUrl || item.url, event)
    }
  }
</script>

<div
  class="file"
  class:compact={!showDownloadUrl}
  class:gray={isGray}
  class:normal={!isGray}
  class:transition-enter={enableAnimation}
>
  <div class="icon">
    {#if showDownloadProgress && item.state === 'in_progress'}
      <div class="progress">
        <Progress
          width={showDownloadUrl ? 46 : 40}
          loop={item.totalBytes === 0}
          paused={Boolean(item.paused)}
          percentage={getPercentage(item)}
        />
      </div>
    {/if}
    <img src={resolvedIconUrl ?? undefined} alt="" draggable="false" />
  </div>
  <div class="file-content">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <span
      class="filename"
      onclick={() => leftClickFile && openfile(item)}
      oncontextmenu={handleFilenameContextMenu}
    >
      {item.basename}
    </span>
    {#if showDownloadUrl}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <span
        class="file-url"
        onclick={() => leftClickUrl && openUrl(item)}
        oncontextmenu={handleUrlContextMenu}
      >
        {item.finalUrl || item.url}
      </span>
    {/if}
    <div class="info">
      {#if isDanger}
        <div class="cell left danger">
          <span class="description small-size" title={dangerDescription(item)}>
            {dangerDescription(item)}
          </span>
        </div>
        <div class="cell right danger">
          <button type="button" class="discard button small-size" onclick={() => discardDanger(item)}>
            {i18data.dangerDiscard}
          </button>
          {#if canAccept}
            <button type="button" class="accept button small-size" onclick={() => acceptDanger(item)}>
              {i18data.reserve}
            </button>
          {/if}
        </div>
      {:else if item.state === 'in_progress'}
        {#if showDownloadProgress && item.totalBytes !== 0}
          <div class="cell left common">
            <span class="receivedSize small-size">{getFormattedSize(item.bytesReceived)}</span>
            <span class="divider small-size">/</span>
            <span class="size small-size">{getFormattedSize(item.totalBytes)}</span>
          </div>
          <div class="cell middle common">
            <span class="speed small-size">{getSpeed(item)}</span>
          </div>
          <div class="cell right common">
            <span class="remaining small-size">{remaining(item)}</span>
          </div>
        {:else if showDownloadProgress}
          <div class="cell left common">
            <span class="receivedSize small-size">{getFormattedSize(item.bytesReceived)}</span>
          </div>
          <div class="cell right common">
            <span class="speed small-size">{getSpeed(item)}</span>
          </div>
        {:else}
          <div class="cell left common">
            <span class="state small-size">{i18data.downloadInProgress}</span>
          </div>
          <div class="cell right common">
            {#if item.totalBytes > 0}
              <span class="size small-size">{getFormattedSize(item.totalBytes)}</span>
            {/if}
          </div>
        {/if}
      {:else}
        <div class="cell left common">
          <span class="size small-size">{getFormattedSize(item.totalBytes)}</span>
        </div>
        <div class="cell right common">
          <span class="endTime small-size">
            {item.formattedTime || formatEndTime(item.endTime || item.startTime)}
          </span>
        </div>
      {/if}
    </div>
  </div>
  <div class="content-operator-wrapper">
    <div class="content-operator">
      {#if canCopyUrl}
        <button
          type="button"
          class="icon-button"
          class:is-copied={copiedUrl}
          aria-label={i18data.copyDownloadUrl}
          onmouseenter={(e) => onActionEnter(e, i18data.copyDownloadUrl)}
          onmouseleave={onActionLeave}
          onclick={(e) => onActionClick(e, () => handleCopyUrlButton(e))}
        >
          <Icon name={copiedUrl ? 'Check' : 'Link'} />
        </button>
      {/if}
      {#if canOpenFolder}
        <button
          type="button"
          class="icon-button"
          aria-label={i18data.openFileInFolder}
          onmouseenter={(e) => onActionEnter(e, i18data.openFileInFolder)}
          onmouseleave={onActionLeave}
          onclick={(e) => onActionClick(e, () => showInFolder(item))}
        >
          <Icon name="FolderOpened" />
        </button>
      {/if}
      {#if item.state === 'in_progress'}
        <button
          type="button"
          class="icon-button"
          aria-label={item.paused ? i18data.resume : i18data.pause}
          onmouseenter={(e) => onActionEnter(e, item.paused ? i18data.resume : i18data.pause)}
          onmouseleave={onActionLeave}
          onclick={(e) => onActionClick(e, () => pauseOrResume(item))}
        >
          <Icon name={item.paused ? 'VideoPlay' : 'VideoPause'} />
        </button>
      {/if}
      {#if canRemove}
        <button
          type="button"
          class="icon-button"
          aria-label={i18data.delete}
          onmouseenter={(e) => onActionEnter(e, i18data.delete)}
          onmouseleave={onActionLeave}
          onclick={(e) => onActionClick(e, () => remove(item))}
        >
          <Icon name="Delete" />
        </button>
      {/if}
      {#if canRetry}
        <button
          type="button"
          class="icon-button"
          aria-label={i18data.retry}
          onmouseenter={(e) => onActionEnter(e, i18data.retry)}
          onmouseleave={onActionLeave}
          onclick={(e) => onActionClick(e, () => retryDownload(item))}
        >
          <Icon name="RefreshRight" />
        </button>
      {/if}
      <button
        type="button"
        class="icon-button"
        aria-label={i18data.erase}
        onmouseenter={(e) => onActionEnter(e, i18data.erase)}
        onmouseleave={onActionLeave}
        onclick={(e) => onActionClick(e, () => erase(item))}
      >
        <Icon name="Close" />
      </button>
    </div>
  </div>
</div>

<style>
  /* 下载文件 */
  .file {
    --file-surface-color: var(--content-file-background-color);
    height: 74px;
    border-radius: 6px;
    margin-right: 4px;
    border: 1px solid var(--content-file-border-color);
    background-color: var(--file-surface-color);
    overflow: hidden;
    contain: layout paint;
    color: var(--content-file-color);
    position: relative;
    box-shadow: 0 1px 2px 0 var(--content-file-shadow-color, rgba(0, 0, 0, .05));
    user-select: none;
    transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease;
  }

  .file.compact {
    height: 58px;
  }

  .file:hover {
    --file-surface-color: var(--content-file-hover-background-color, var(--content-file-background-color));
    border-color: var(--content-file-hover-border-color, var(--content-file-border-color));
    background-color: var(--file-surface-color);
  }

  .file.gray {
    --file-surface-color: var(--content-file-muted-background-color, var(--content-file-background-color));
    box-shadow: 0 0 0 0 rgba(0, 0, 0, .1);
    background-color: var(--file-surface-color);
  }

  /* 文件图标 */
  .file .icon {
    position: relative;
    text-align: center;
    width: 52px;
    height: 100%;
    border-right: 1px solid var(--content-file-icon-border-right-color);
    float: left;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .file .icon img {
    height: 24px;
    width: 24px;
  }

  .file .icon img:not([src]) {
    opacity: 0;
  }

  .file.gray .icon img {
    -webkit-filter: grayscale(100%);
    filter: grayscale(100%);
    opacity: 0.7;
  }

  /* 图标上面的进度条 */
  .file .progress {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  /* 文件内容 */
  .file .file-content {
    width: calc(100% - 68px);
    float: right;
    padding: 7px 10px 0 0;
  }

  .file.compact .file-content {
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 6px 10px 6px 0;
  }

  /* 文件名称 */
  .file .filename {
    display: block;
    height: 20px;
    line-height: 20px;
    font-weight: 500;
    font-size: 13px;
    color: var(--content-file-filename-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file .filename:hover {
    cursor: pointer;
  }

  .file.gray .filename {
    cursor: auto;
    color: var(--content-file-filename-gray-color);
    text-decoration: line-through;
  }

  /* 文件下载链接 */
  .file .file-url {
    display: block;
    height: 20px;
    line-height: 20px;
    font-size: var(--content-file-url-font-size, 12px);
    font-family: var(--content-file-meta-font-family, inherit);
    color: var(--content-file-url-color, var(--content-file-color));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file .file-url:hover {
    cursor: pointer;
  }

  /* 文件信息栏 */
  .file .info {
    width: 100%;
    height: 25px;
    display: table;
    font-family: var(--content-file-meta-font-family, inherit);
    font-variant-numeric: tabular-nums;
    color: var(--content-file-muted-color, var(--content-file-content-color));
  }

  .file.compact .info {
    height: 22px;
    margin-top: 2px;
  }

  .file .info .small-size {
    transition: none;
    font-size: var(--content-file-info-font-size, 11.5px);
  }

  .file.gray .file-url,
  .file.gray .info {
    color: var(--content-file-filename-gray-color);
    opacity: .84;
  }

  /* 已下载的大小 */
  .file .info .divider {
    width: 16px;
    text-align: center;
    padding: 0 4px;
  }

  .file .info .cell {
    display: table-cell;
    vertical-align: middle;
  }

  .file .info .left {
    text-align: left;
  }

  .file .info .left.danger {
    width: calc(100% - 120px);
    max-width: 176px;
  }

  .file .info .left.common {
    width: 118px;
  }

  .file .info .middle {
    text-align: center;
  }

  .file .info .middle.common {
    width: 80px;
  }

  .file .info .right {
    text-align: right;
  }

  .file .info .right.danger {
    width: 120px;
    white-space: nowrap;
  }

  /* 下载危险文件时的操作 */
  .file .info .danger .description {
    display: block;
    overflow: hidden;
    color: var(--content-file-danger-color, var(--header-dropdown-menu-item-danger-color, #d93025));
    line-height: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file .info .danger .button {
    outline: 0;
    border-radius: 11px;
    height: 22px;
    line-height: 18px;
    padding: 0 8px;
    border: 1px solid transparent;
    cursor: pointer;
  }

  .file .info .danger .discard {
    color: #fff;
    background-color: var(--content-file-danger-button-background-color, #d93025);
    border-color: var(--content-file-danger-button-border-color, var(--content-file-danger-button-background-color, #d93025));
  }

  .file .info .danger .button.discard:hover {
    border-color: var(--content-file-danger-button-hover-border-color, var(--content-file-danger-button-hover-background-color, #b3261e));
    background-color: var(--content-file-danger-button-hover-background-color, #b3261e);
  }

  .file .info .danger .accept {
    color: var(--content-file-danger-accept-color, var(--content-file-filename-color, #1d6fe2));
    background-color: var(--content-file-danger-accept-background-color, var(--content-file-background-color, #fff));
    border-color: var(--content-file-danger-accept-border-color, var(--content-file-border-color, #dadce0));
    margin-right: -4px;
    margin-left: 4px;
  }

  .file .info .danger .button.accept:hover {
    background-color: var(--content-file-danger-accept-hover-background-color, var(--header-dropdown-menu-item-hover-background-color, #d2e3fc));
  }

  /* 内容栏 操作按钮 父元素 */
  .file .content-operator-wrapper {
    position: absolute;
    top: 6px;
    right: 8px;
    height: 22px;
    padding-left: 16px;
    background-image: linear-gradient(90deg, transparent 0, var(--file-surface-color) 24%);
    z-index: 1;
    display: none;
  }

  .file.compact .content-operator-wrapper {
    top: 5px;
  }

  .file:hover .content-operator-wrapper {
    display: inline-flex;
    align-items: center;
  }

  .file .content-operator {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 100%;
  }

  .file .content-operator .icon-button {
    width: 22px;
    height: 22px;
    margin: 0;
    padding: 0;
    border: none;
    outline: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    color: var(--header-icon-color);
    background-color: transparent;
    box-shadow: inset 0 0 0 1px transparent;
    transition: background-color .18s ease, box-shadow .18s ease, color .18s ease;
    box-sizing: border-box;
  }

  .file .content-operator .icon-button.is-copied {
    color: #16a34a;
  }

  .file .content-operator .icon-button:hover,
  .file .content-operator .icon-button:focus-visible {
    color: var(--header-icon-hover-color);
    background-color: rgba(127, 127, 127, 0.12);
    box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.18);
  }

  .file .content-operator .icon-button:active {
    background-color: rgba(127, 127, 127, 0.18);
    box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.24);
  }

  .transition-enter {
    animation: fileEnter .3s ease alternate forwards;
  }

  @keyframes fileEnter {
    from {
      opacity: 0;
      transform: translateX(-80px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
</style>
