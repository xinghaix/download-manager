<script>
  import { ICON_PATHS } from './icons.js'

  let { name = '', class: className = '', size = '' } = $props()
  const paths = $derived(ICON_PATHS[name] || [])
</script>

<span class="dm-icon {className}" style:font-size={size || undefined} aria-hidden="true">
  <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
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
