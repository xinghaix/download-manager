<script>
  import { ICON_PATHS } from './icons.js'

  let { name = '', class: className = '', size = '' } = $props()
  const entry = $derived(ICON_PATHS[name])
  const isStroke = $derived(Boolean(entry && !Array.isArray(entry)))
  const viewBox = $derived(isStroke ? (entry.viewBox || '0 0 24 24') : '0 0 1024 1024')
  const strokeWidth = $derived(isStroke ? (entry.strokeWidth ?? 1.5) : undefined)
  const paths = $derived(Array.isArray(entry) ? entry : (entry?.paths || []))
</script>

<span class="dm-icon {className}" style:font-size={size || undefined} aria-hidden="true">
  <svg
    {viewBox}
    width="1em"
    height="1em"
    fill={isStroke ? 'none' : 'currentColor'}
    stroke={isStroke ? 'currentColor' : 'none'}
    stroke-width={strokeWidth}
    stroke-linecap={isStroke ? 'round' : undefined}
    stroke-linejoin={isStroke ? 'round' : undefined}
  >
    {#each paths as d, idx (idx)}
      <path {d} />
    {/each}
  </svg>
</span>

<style>
  .dm-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1em;
    height: 1em;
    line-height: 1em;
    vertical-align: middle;
    flex-shrink: 0;
  }

  .dm-icon svg {
    display: block;
    width: 1em;
    height: 1em;
  }
</style>
