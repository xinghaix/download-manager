<script>
  let {
    text = '',
    position = { x: 0, y: 0 },
    timeout = 600,
    zIndex = 100,
    showTip = $bindable(false)
  } = $props()

  let visible = $state(false)
  let timeoutId = null

  const normalizedTimeout = $derived(timeout < 0 ? 0 : timeout)
  const leftPx = $derived(Math.max(4, Math.min((Number(position?.x) || 0) + 4, (typeof window !== 'undefined' ? window.innerWidth - 72 : 340))))
  const topPx = $derived(Math.max(4, (Number(position?.y) || 0) - 12))

  function clearTimer() {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  $effect(() => {
    // 追踪 showTip 与 position 变更，每次点击复制都重置计时
    const active = showTip
    void position?.x
    void position?.y

    clearTimer()
    if (!active) {
      visible = false
      return
    }

    visible = true
    timeoutId = setTimeout(() => {
      visible = false
      timeoutId = null
      showTip = false
    }, normalizedTimeout)

    return () => {
      clearTimer()
    }
  })
</script>

{#if visible}
  <span
    class="tip"
    style:left="{leftPx}px"
    style:top="{topPx}px"
    style:z-index={zIndex}
  >
    {text}
  </span>
{/if}

<style>
  .tip {
    padding: 4px 6px;
    position: fixed;
    line-height: 14px;
    height: 15px;
    border-radius: 4px;
    font-size: 11px;
    color: var(--tip-color, #fff);
    background: var(--tip-background-color, #303133);
    pointer-events: none;
    white-space: nowrap;
  }
</style>
