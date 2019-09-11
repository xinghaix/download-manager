import Vue from 'vue'
import Background from './Background.vue'

Vue.config.debug = false
Vue.config.devtools = false
Vue.config.productionTip = false

new Vue({
  render: (h) => h(Background)
}).$mount('#app')
