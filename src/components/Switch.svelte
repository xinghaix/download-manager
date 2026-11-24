<script>
  let {
    checked = $bindable(false),
    disabled = false,
    ariaLabel = '',
    title = '',
    onchange = null
  } = $props()

  function toggle() {
    if (disabled) {
      return
    }
    checked = !checked
    if (onchange) {
      onchange(checked)
    }
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={ariaLabel || undefined}
  title={title || undefined}
  class="dm-switch"
  class:is-checked={checked}
  class:is-disabled={disabled}
  {disabled}
  onclick={toggle}
>
  <span class="dm-switch-thumb"></span>
</button>

<style>
  .dm-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 40px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 10px;
    background-color: var(--dm-switch-off, #cbd5e1);
    cursor: pointer;
    vertical-align: middle;
    transition: background-color 0.2s ease;
    box-sizing: border-box;
    outline: none;
  }

  .dm-switch.is-checked {
    background-color: var(--opt-accent, #409eff);
  }

  .dm-switch.is-disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .dm-switch:focus-visible {
    box-shadow: 0 0 0 2px var(--opt-focus-ring, rgba(64, 158, 255, 0.35));
  }

  .dm-switch-thumb {
    position: absolute;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: #ffffff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s ease;
  }

  .dm-switch.is-checked .dm-switch-thumb {
    transform: translateX(20px);
  }
</style>
