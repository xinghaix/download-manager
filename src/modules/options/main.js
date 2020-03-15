import Vue from 'vue'
import ElementUI from 'element-ui'
import Options from './Options.vue'
import common from '../../utils/common'

Vue.use(ElementUI, {i18n: path => common.loadI18nMessage(path.replace(/\./g, '_'))})

Vue.config.debug = false
Vue.config.devtools = false
Vue.config.productionTip = false

new Vue({
  render: (h) => h(Options)
}).$mount('#app')
