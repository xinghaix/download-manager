// Offscreen document for audio playback in Manifest V3
// Service Worker cannot directly play audio, so we use offscreen document

function reportSystemTheme() {
  chrome.runtime.sendMessage(JSON.stringify({
    type: 'system_theme_changed',
    data: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }))
}

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
reportSystemTheme()
if (mediaQuery.addEventListener) {
  mediaQuery.addEventListener('change', reportSystemTheme)
} else if (mediaQuery.addListener) {
  mediaQuery.addListener(reportSystemTheme)
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'play-audio') {
    const audio = new Audio(message.file)
    audio.play().catch(error => {
      console.error('Audio playback error:', error)
    })
    sendResponse({ success: true })
  }
  return true
})

console.log('Offscreen document loaded')
