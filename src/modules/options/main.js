import Vue from 'vue'
import Options from './Options.vue'

Vue.config.debug = false
Vue.config.devtools = false
Vue.config.productionTip = false

new Vue({
  render: (h) => h(Options)
}).$mount('#app')
