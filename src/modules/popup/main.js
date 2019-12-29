import Vue from 'vue'
import ElementUI from 'element-ui'
import Popup from './Popup.vue'
import VueClipboard from 'vue-clipboard2'

Vue.use(ElementUI)
Vue.use(VueClipboard)

Vue.config.debug = false
Vue.config.devtools = false
Vue.config.productionTip = false

new Vue({
  render: (h) => h(Popup)
}).$mount('#app')
