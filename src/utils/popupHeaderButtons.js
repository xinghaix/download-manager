export const POPUP_HEADER_BUTTON_KEYS = [
  'newDownload',
  'clear',
  'batchActions',
  'openFolder',
  'openHome'
]

const POPUP_HEADER_BUTTON_KEY_SET = new Set(POPUP_HEADER_BUTTON_KEYS)

export function normalizePopupHeaderButtonsOrder(value) {
  const ordered = []
  const seen = new Set()

  if (Array.isArray(value)) {
    for (const key of value) {
      if (typeof key === 'string' && POPUP_HEADER_BUTTON_KEY_SET.has(key) && !seen.has(key)) {
        seen.add(key)
        ordered.push(key)
      }
    }
  }

  for (const key of POPUP_HEADER_BUTTON_KEYS) {
    if (!seen.has(key)) {
      seen.add(key)
      ordered.push(key)
    }
  }

  return ordered
}

export function normalizePopupHeaderButtons(value, order = POPUP_HEADER_BUTTON_KEYS) {
  const normalizedOrder = normalizePopupHeaderButtonsOrder(order)
  if (!Array.isArray(value)) {
    return [...normalizedOrder]
  }

  const selected = new Set()
  for (const key of value) {
    if (typeof key === 'string' && POPUP_HEADER_BUTTON_KEY_SET.has(key)) {
      selected.add(key)
    }
  }

  return normalizedOrder.filter(key => selected.has(key))
}

export function getOrderedVisiblePopupHeaderButtons(showButtons, enabledButtons, order = POPUP_HEADER_BUTTON_KEYS) {
  if (!showButtons) {
    return []
  }
  return normalizePopupHeaderButtons(enabledButtons, order)
}

export function isPopupHeaderButtonVisible(showButtons, enabledButtons, key) {
  return Boolean(showButtons) && Array.isArray(enabledButtons) && enabledButtons.includes(key)
}
