<script>
  import Icon from './Icon.svelte'

  let {
    values = [],
    disabled = false,
    invalid = false,
    placeholder = '',
    delimiter = /[\s,;，；]+/,
    lowercase = true,
    onupdate = null,
    onchange = null,
    onblur = null
  } = $props()

  let inputText = $state('')
  let focused = $state(false)
  let inputEl = $state(null)

  function commitRawText(raw, emitChange = true) {
    const trimmed = String(raw || '').trim()
    if (!trimmed) {
      return false
    }
    const tokens = trimmed.split(delimiter).map(t => t.trim()).filter(Boolean)
    if (!tokens.length) {
      return false
    }
    const next = [...values, ...tokens]
    inputText = ''
    if (onupdate) {
      onupdate(next)
    }
    if (emitChange && onchange) {
      onchange(next)
    }
    return true
  }

  function handleInput(event) {
    const val = event.currentTarget.value
    if (delimiter.test(val)) {
      const parts = val.split(delimiter)
      const trailing = parts.pop() || ''
      const completed = parts.map(t => t.trim()).filter(Boolean)
      inputText = trailing
      if (completed.length > 0) {
        const next = [...values, ...completed]
        if (onupdate) {
          onupdate(next)
        }
        if (onchange) {
          onchange(next)
        }
      }
      return
    }
    inputText = val
  }

  function handleKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitRawText(inputText, true)
      return
    }
    if (event.key === 'Backspace' && inputText === '' && values.length > 0) {
      event.preventDefault()
      const next = values.slice(0, -1)
      if (onupdate) {
        onupdate(next)
      }
      if (onchange) {
        onchange(next)
      }
    }
  }

  function handleBlur() {
    focused = false
    commitRawText(inputText, false)
    if (onblur) {
      onblur()
    }
  }

  function removeAt(index) {
    if (disabled) {
      return
    }
    const next = values.filter((_, i) => i !== index)
    if (onupdate) {
      onupdate(next)
    }
    if (onchange) {
      onchange(next)
    }
  }

  function focusInput() {
    if (!disabled && inputEl) {
      inputEl.focus()
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class="dm-tag-input"
  class:is-focused={focused}
  class:is-disabled={disabled}
  class:is-invalid={invalid}
  onclick={focusInput}
>
  {#each values as tag, index (tag)}
    <span class="dm-tag" class:is-lowercase={lowercase}>
      <span class="dm-tag-text">{tag}</span>
      {#if !disabled}
        <button
          type="button"
          class="dm-tag-close"
          tabindex="-1"
          aria-label="Remove {tag}"
          onclick={(e) => { e.stopPropagation(); removeAt(index) }}
        >
          <Icon name="Close" size="10px" />
        </button>
      {/if}
    </span>
  {/each}
  <input
    bind:this={inputEl}
    class="dm-tag-field"
    type="text"
    value={inputText}
    {disabled}
    placeholder={values.length === 0 ? placeholder : ''}
    onfocus={() => { focused = true }}
    oninput={handleInput}
    onkeydown={handleKeydown}
    onblur={handleBlur}
  />
</div>

<style>
  .dm-tag-input {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    width: 100%;
    min-height: 34px;
    padding: 4px 6px;
    border-radius: var(--opt-radius-control, 6px);
    background-color: var(--opt-control-bg, #ffffff);
    box-shadow: 0 0 0 1px var(--opt-control-border, #dcdfe6) inset;
    box-sizing: border-box;
    cursor: text;
    transition: box-shadow 0.16s ease;
  }

  .dm-tag-input:hover:not(.is-disabled):not(.is-focused):not(.is-invalid) {
    box-shadow: 0 0 0 1px var(--opt-control-border-hover, #c0c4cc) inset;
  }

  .dm-tag-input.is-focused {
    box-shadow: 0 0 0 1px var(--opt-accent, #409eff) inset, 0 0 0 2px var(--opt-focus-ring, rgba(64, 158, 255, 0.25));
  }

  .dm-tag-input.is-invalid {
    box-shadow: 0 0 0 1px var(--opt-danger, #f56c6c) inset;
  }

  .dm-tag-input.is-disabled {
    background-color: var(--opt-control-disabled-bg, #f5f7fa);
    box-shadow: 0 0 0 1px var(--opt-control-disabled-border, #e4e7ed) inset;
    cursor: not-allowed;
  }

  .dm-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 6px;
    border-radius: 4px;
    background-color: var(--dm-tag-bg, #f0f2f5);
    color: var(--dm-tag-text, #606266);
    font-size: 12px;
    line-height: 20px;
    box-sizing: border-box;
  }

  .dm-tag.is-lowercase {
    text-transform: lowercase;
  }

  .dm-tag-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--opt-text-muted, #909399);
    cursor: pointer;
    transition: background-color 0.14s, color 0.14s;
  }

  .dm-tag-close:hover {
    background-color: var(--opt-text-muted, #909399);
    color: #ffffff;
  }

  .dm-tag-field {
    flex: 1 1 80px;
    min-width: 60px;
    height: 22px;
    padding: 0 2px;
    border: none;
    outline: none;
    background: transparent;
    font-size: 12px;
    font-family: inherit;
    color: var(--opt-text-primary, #1f2937);
  }

  .dm-tag-field::placeholder {
    color: var(--opt-text-disabled, #a8abb2);
  }

  .dm-tag-field:disabled {
    cursor: not-allowed;
    color: var(--opt-text-disabled, #a8abb2);
  }
</style>
