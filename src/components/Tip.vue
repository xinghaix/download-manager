<template>
  <span class="tip"
        :style="{ left: (x + 4) + 'px', top: (y - 12) + 'px', zIndex: zIndex }"
        v-show="showTip">
    {{text}}
  </span>
</template>

<script>
  export default {
    name: "Tip",
    props: {
      text: {
        type: String,
        default: ''
      },
      x: Number,
      y: Number,
      timeout: {
        type: Number,
        default: 600
      },
      zIndex: {
        type: Number,
        default: 100
      }
    },
    mounted() {
      if (this.timeout < 0) {
        this.timeout = 0
      }
    },
    data() {
      return {
        showTip: false,
        timeoutId: null
      }
    },
    watch: {
      x () {
        this.render()
      },
      y () {
        this.render()
      }
    },
    methods: {
      render() {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId)
        }
        this.showTip = true
        this.timeoutId = setTimeout(() => {
          this.showTip = false
          this.timeoutId = null
        }, this.timeout)
      },
      destroy() {

      }
    }
  }
</script>

<style scoped>
  .tip {
    padding: 4px;
    position: absolute;
    line-height: 14px;
    height: 15px;
    border-radius: 4px;
    font-size: 12px;
    color: #ffffff;
    background: #303133;
    -webkit-transform-origin-x: 0;
    -webkit-transform: scale(0.9);
  }
</style>
