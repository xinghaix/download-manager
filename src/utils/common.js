/* eslint-disable no-undef */

const common = {
  loadI18nMessage (msg) {
    return chrome.i18n.getMessage(msg)
  },

}

export default common
