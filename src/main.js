import Vue from 'vue'
import Background from './Background.vue'
import { Executor } from './utils/lazyexecutor'

oldcreate = chrome.notifications.create
let exe = new Executor(null, 1000) //抖动区间1s
chrome.notifications.create = (nid,op,callback) =>{
  // TODO 加入合并通知的逻辑
  exe.Execute(()=>{
    oldcreate(nid,op,callback)
  })
}

Vue.config.debug = false
Vue.config.devtools = false
Vue.config.productionTip = false

new Vue({
  render: (h) => h(Background)
}).$mount('#app')
