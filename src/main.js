import Vue from 'vue'
import App from './App.vue'

Vue.config.debug = false
Vue.config.devtools = false
Vue.config.productionTip = false

new Vue({
  render: (h) => h(App)
}).$mount('#app')
