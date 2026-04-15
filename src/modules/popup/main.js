import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import Popup from './Popup.vue'
import VueVirtualScroller from 'vue-virtual-scroller'
import 'element-plus/dist/index.css'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

const app = createApp(Popup)

app.use(ElementPlus)
app.use(VueVirtualScroller)

Object.entries(ElementPlusIconsVue).forEach(([name, component]) => {
  app.component(name, component)
})

app.mount('#app')
