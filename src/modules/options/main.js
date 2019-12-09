import Vue from 'vue'
import ElementUI from 'element-ui'
import Options from './Options.vue'

Vue.use(ElementUI)

Vue.config.debug = false
Vue.config.devtools = false
Vue.config.productionTip = false

new Vue({
  render: (h) => h(Options)
}).$mount('#app')
