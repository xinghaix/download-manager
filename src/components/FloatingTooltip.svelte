<script>
  let {
    visible = false,
    content = '',
    triggerEl = null,
    placement = 'top'
  } = $props()

  let tooltipEl = $state(null)
  let left = $state(0)
  let top = $state(0)
  let arrowLeft = $state(0)
  let resolvedPlacement = $state('top')
  let positioned = $state(false)

  $effect(() => {
    if (!visible || !triggerEl || !content || !tooltipEl) {
      positioned = false
      return
    }

    const triggerRect = triggerEl.getBoundingClientRect()
    const tipWidth = tooltipEl.offsetWidth
    const tipHeight = tooltipEl.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 6

    if (placement === 'right') {
      const nextLeft = Math.min(triggerRect.right + 9, vw - tipWidth - margin)
      const triggerCenterY = triggerRect.top + triggerRect.height / 2
      const nextTop = Math.max(margin, Math.min(triggerCenterY - tipHeight / 2, vh - tipHeight - margin))

      left = Math.round(nextLeft)
      top = Math.round(nextTop)
      resolvedPlacement = 'right'
      positioned = true
      return
    }

    const gap = placement === 'bottom' ? 6 : 7
    let nextPlacement = placement
    let nextTop = placement === 'top'
      ? triggerRect.top - tipHeight - gap
      : triggerRect.bottom + gap

    if (nextPlacement === 'top' && nextTop < margin) {
      nextPlacement = 'bottom'
      nextTop = triggerRect.bottom + gap
    } else if (nextPlacement === 'bottom' && nextTop + tipHeight > vh - margin) {
      nextPlacement = 'top'
      nextTop = triggerRect.top - tipHeight - gap
    }

    const triggerCenterX = triggerRect.left + triggerRect.width / 2
    let nextLeft = triggerCenterX - tipWidth / 2
    nextLeft = Math.max(margin, Math.min(nextLeft, vw - tipWidth - margin))

    const nextArrowLeft = Math.max(8, Math.min(triggerCenterX - nextLeft, tipWidth - 8))

    left = Math.round(nextLeft)
    top = Math.round(nextTop)
    arrowLeft = Math.round(nextArrowLeft)
    resolvedPlacement = nextPlacement
    positioned = true
  })
</script>

{#if visible && content && triggerEl}
  <div
    class="floating-tooltip"
    class:is-top={resolvedPlacement === 'top'}
    class:is-bottom={resolvedPlacement === 'bottom'}
    class:is-right={resolvedPlacement === 'right'}
    class:is-ready={positioned}
    role="tooltip"
    bind:this={tooltipEl}
    style:left="{left}px"
    style:top="{top}px"
  >
    <span>{content}</span>
    <span
      class="tooltip-arrow"
      style:left={resolvedPlacement === 'right' ? undefined : `${arrowLeft}px`}
    ></span>
  </div>
{/if}

<style>
  .floating-tooltip {
    position: fixed;
    z-index: 2000;
    padding: 5px 8px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 11px;
    line-height: 1.3;
    color: var(--tooltip-color, #ffffff);
    background: var(--tooltip-background-color, #303133);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
    pointer-events: none;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.12s ease;
  }

  .floating-tooltip.is-ready {
    opacity: 1;
  }

  .tooltip-arrow {
    position: absolute;
    width: 6px;
    height: 6px;
    background: var(--tooltip-background-color, #303133);
    transform: translateX(-50%) rotate(45deg);
  }

  .floating-tooltip.is-top .tooltip-arrow {
    bottom: -3px;
  }

  .floating-tooltip.is-bottom .tooltip-arrow {
    top: -3px;
  }

  .floating-tooltip.is-right .tooltip-arrow {
    left: -3px;
    top: 50%;
    transform: translateY(-50%) rotate(45deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .floating-tooltip {
      transition: none;
    }
  }
</style>
