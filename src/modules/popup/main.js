import Vue from 'vue'
import ElementUI from 'element-ui'
import Popup from './Popup.vue'
import VueClipboard from 'vue-clipboard2'
import VueVirtualScroller from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

Vue.use(ElementUI)
Vue.use(VueClipboard)
Vue.use(VueVirtualScroller)

Vue.config.debug = false
Vue.config.devtools = false
Vue.config.productionTip = false

new Vue({
  render: (h) => h(Popup)
}).$mount('#app')
