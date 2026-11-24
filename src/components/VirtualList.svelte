<script>
  let {
    items = [],
    itemSize = 84,
    buffer = 3,
    onupdate = null,
    onscroll = null,
    children
  } = $props()

  let containerEl = $state(null)
  let scrollTop = $state(0)
  let viewportHeight = $state(360)

  const totalHeight = $derived(items.length * itemSize)
  const visibleStartIndex = $derived(
    items.length === 0 ? 0 : Math.max(0, Math.floor(scrollTop / itemSize))
  )
  const visibleEndIndex = $derived(
    items.length === 0
      ? -1
      : Math.min(items.length - 1, Math.ceil((scrollTop + viewportHeight) / itemSize) - 1)
  )
  const renderStartIndex = $derived(
    items.length === 0 ? 0 : Math.max(0, visibleStartIndex - buffer)
  )
  const renderEndIndex = $derived(
    items.length === 0 ? -1 : Math.min(items.length - 1, visibleEndIndex + buffer)
  )
  const visibleEntries = $derived.by(() => {
    if (renderEndIndex < renderStartIndex || items.length === 0) {
      return []
    }
    const entries = []
    for (let i = renderStartIndex; i <= renderEndIndex; i++) {
      const item = items[i]
      if (item) {
        entries.push({ item, index: i, key: item.id })
      }
    }
    return entries
  })

  $effect(() => {
    if (!containerEl) {
      return
    }
    const updateHeight = () => {
      if (containerEl && containerEl.clientHeight > 0) {
        viewportHeight = containerEl.clientHeight
      }
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(containerEl)
    return () => observer.disconnect()
  })

  $effect(() => {
    if (onupdate) {
      onupdate(renderStartIndex, renderEndIndex, visibleStartIndex, visibleEndIndex)
    }
  })

  function handleScroll(event) {
    scrollTop = event.currentTarget.scrollTop
    if (onscroll) {
      onscroll(scrollTop)
    }
  }

  export function scrollToTop() {
    if (containerEl) {
      containerEl.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
</script>

<div
  class="virtual-scroller"
  bind:this={containerEl}
  onscroll={handleScroll}
>
  <div class="virtual-scroller-spacer" style:height="{totalHeight}px">
    {#each visibleEntries as entry (entry.key)}
      <div
        class="virtual-scroller-item"
        style:height="{itemSize}px"
        style:transform="translateY({entry.index * itemSize}px)"
      >
        {@render children(entry.item)}
      </div>
    {/each}
  </div>
</div>

<style>
  .virtual-scroller {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    box-sizing: border-box;
  }

  .virtual-scroller::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }

  .virtual-scroller::-webkit-scrollbar-thumb:hover {
    cursor: pointer;
  }

  .virtual-scroller::-webkit-scrollbar-thumb {
    border-radius: 10px;
    -webkit-box-shadow: inset 0 0 4px rgba(123, 123, 123, 0.2);
    background: var(--scrollbar-thumb-background-color, hsla(0, 0%, 66%, 0.2));
  }

  .virtual-scroller::-webkit-scrollbar-track {
    border-radius: 10px;
    -webkit-box-shadow: inset 0 0 4px transparent;
  }

  .virtual-scroller-spacer {
    position: relative;
    width: 100%;
  }

  .virtual-scroller-item {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    box-sizing: border-box;
  }
</style>
