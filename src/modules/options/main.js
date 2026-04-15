import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import Options from './Options.vue'
import 'element-plus/dist/index.css'

const app = createApp(Options)

app.use(ElementPlus)

Object.entries(ElementPlusIconsVue).forEach(([name, component]) => {
  app.component(name, component)
})

app.mount('#app')
