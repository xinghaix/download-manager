<script>
  let {
    width = 64,
    color = 'var(--content-file-border-color, #cccccc)',
    paused = false,
    percentage = 0,
    strokeWidth = 4,
    loop = false
  } = $props()

  const normalizedWidth = $derived(width > 0 ? width : 64)
  const normalizedStrokeWidth = $derived(
    !strokeWidth || strokeWidth <= 0
      ? 4
      : Math.min(strokeWidth, normalizedWidth)
  )
  const viewWidth = $derived(64 + normalizedStrokeWidth * 2)
  const moveWidth = $derived(viewWidth / 2)
  const strokeColor = $derived(paused ? '#E6A23C' : '#20A0FF')
  const dasharray = $derived.by(() => {
    let pct = percentage
    if (!pct || pct < 0) {
      pct = 0
    } else if (pct > 100) {
      pct = 100
    }
    return Math.PI * 2 * 32 * pct / 100
  })
</script>

<div
  class="progress-wrapper"
  style:width="{normalizedWidth}px"
  style:height="{normalizedWidth}px"
>
  <svg class="progress-svg" viewBox="0 0 {viewWidth} {viewWidth}">
    <circle
      class="background"
      cx={moveWidth}
      cy={moveWidth}
      r="32"
      stroke={color}
      stroke-width={normalizedStrokeWidth}
    />
    {#if loop}
      <path
        class="loop"
        d="M {moveWidth} {normalizedStrokeWidth} a 32 32 0 0 1 22.627 54.627"
        stroke={strokeColor}
        stroke-width={normalizedStrokeWidth}
        style:animation-play-state={paused ? 'paused' : 'running'}
        style:transform-origin="{moveWidth}px {moveWidth}px"
      />
    {:else}
      <path
        class="percentage"
        d="M {moveWidth} {moveWidth} m 0 -32 a 32 32 0 1 1 0 64 a 32 32 0 1 1 0 -64"
        stroke={strokeColor}
        stroke-width={normalizedStrokeWidth}
        style:stroke-dasharray="{dasharray}px, 201.062px"
      />
    {/if}
  </svg>
</div>

<style>
  .progress-svg {
    display: block;
  }

  .progress-svg .background,
  .progress-svg .loop,
  .progress-svg .percentage {
    fill: none;
    stroke-linecap: round;
  }

  .progress-svg .percentage {
    stroke-dashoffset: 0;
    transition: stroke-dasharray 0.2s ease 0s, stroke 0.2s ease 0s;
  }

  .progress-svg .loop {
    animation-duration: 1.4s;
    animation-name: loopRotate;
    animation-fill-mode: forwards;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    animation-play-state: running;
  }

  @keyframes loopRotate {
    to {
      transform: rotate(360deg);
    }
  }
</style>
