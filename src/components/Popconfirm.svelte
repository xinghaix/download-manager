<script>
  let {
    title = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    onconfirm = null,
    children
  } = $props()

  let open = $state(false)
  let wrapperEl = $state(null)
  let popoverEl = $state(null)
  let popLeft = $state(0)
  let popTop = $state(0)

  function toggle(event) {
    event.stopPropagation()
    open = !open
  }

  function close() {
    open = false
  }

  function confirm(event) {
    event.stopPropagation()
    open = false
    if (onconfirm) {
      onconfirm()
    }
  }

  $effect(() => {
    if (!open || !wrapperEl || !popoverEl) {
      return
    }
    const rect = wrapperEl.getBoundingClientRect()
    const pw = popoverEl.offsetWidth || 220
    const ph = popoverEl.offsetHeight || 86
    const vw = window.innerWidth
    const margin = 8

    let nextTop = rect.top - ph - 8
    if (nextTop < margin) {
      nextTop = rect.bottom + 8
    }
    let nextLeft = rect.left + rect.width / 2 - pw / 2
    nextLeft = Math.max(margin, Math.min(nextLeft, vw - pw - margin))

    popLeft = Math.round(nextLeft)
    popTop = Math.round(nextTop)

    const onDocClick = (e) => {
      if (wrapperEl && wrapperEl.contains(e.target)) {
        return
      }
      if (popoverEl && popoverEl.contains(e.target)) {
        return
      }
      open = false
    }
    const onKeydown = (e) => {
      if (e.key === 'Escape') {
        open = false
      }
    }
    document.addEventListener('click', onDocClick, true)
    window.addEventListener('keydown', onKeydown)
    return () => {
      document.removeEventListener('click', onDocClick, true)
      window.removeEventListener('keydown', onKeydown)
    }
  })
</script>

<span class="dm-popconfirm-wrap" bind:this={wrapperEl}>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <span class="dm-popconfirm-trigger" onclick={toggle}>
    {@render children()}
  </span>

  {#if open}
    <div
      class="dm-popconfirm-panel"
      role="dialog"
      bind:this={popoverEl}
      style:left="{popLeft}px"
      style:top="{popTop}px"
    >
      <div class="dm-popconfirm-title">{title}</div>
      <div class="dm-popconfirm-actions">
        <button type="button" class="dm-popconfirm-btn cancel" onclick={close}>
          {cancelText}
        </button>
        <button type="button" class="dm-popconfirm-btn danger" onclick={confirm}>
          {confirmText}
        </button>
      </div>
    </div>
  {/if}
</span>

<style>
  .dm-popconfirm-wrap {
    display: inline-flex;
    align-items: center;
  }

  .dm-popconfirm-trigger {
    display: inline-flex;
    align-items: center;
  }

  .dm-popconfirm-panel {
    position: fixed;
    z-index: 1500;
    width: 220px;
    padding: 12px;
    border: 1px solid var(--opt-border, #ebeef5);
    border-radius: var(--opt-radius-inner, 8px);
    background-color: var(--opt-surface, #ffffff);
    box-shadow: var(--opt-popover-shadow, 0 8px 24px rgba(0, 0, 0, 0.14));
    box-sizing: border-box;
    text-align: left;
    animation: dmPopconfirmIn 0.12s ease-out;
  }

  @keyframes dmPopconfirmIn {
    from {
      opacity: 0;
      transform: translateY(-2px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .dm-popconfirm-title {
    font-size: 13px;
    line-height: 1.45;
    color: var(--opt-text-primary, #303133);
    margin-bottom: 10px;
    word-break: break-word;
  }

  .dm-popconfirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .dm-popconfirm-btn {
    padding: 5px 10px;
    border-radius: var(--opt-radius-control, 6px);
    font-size: 12px;
    line-height: 1.2;
    font-family: inherit;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 0.14s, color 0.14s;
  }

  .dm-popconfirm-btn.cancel {
    background: transparent;
    color: var(--opt-text-secondary, #4b5563);
  }

  .dm-popconfirm-btn.cancel:hover {
    background: var(--opt-surface-hover, #f3f6fb);
    color: var(--opt-text-primary, #1f2937);
  }

  .dm-popconfirm-btn.danger {
    background: #dc2626;
    color: #ffffff;
  }

  .dm-popconfirm-btn.danger:hover {
    background: #b91c1c;
  }

  @media (prefers-reduced-motion: reduce) {
    .dm-popconfirm-panel {
      animation: none;
    }
  }
</style>
