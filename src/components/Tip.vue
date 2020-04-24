<template>
  <span class="tip"
        :style="{ left: (position.x + 4) + 'px', top: (position.y - 12) + 'px', zIndex: zIndex }"
        v-if="showTip">
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
      position: {
        type: Object,
        default: () => {
          return {
            x: 0,
            y: 0
          }
        },
        validator: (value) => {
          return value.x && value.y && value.x instanceof Number && value.y instanceof Number
        }
      },
      timeout: {
        type: Number,
        default: 600
      },
      zIndex: {
        type: Number,
        default: 100
      },
      showTip: {
        type: Boolean,
        default: false
      }
    },
    mounted() {
      if (this.timeout < 0) {
        this.timeout = 0
      }
    },
    data() {
      return {
        timeoutId: null
      }
    },
    watch: {
      position (val) {
        if (val.x < 0) {
          val.x = 0
        }
        if (val.y < 0) {
          val.y = 0
        }
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
    color: var(--tip-color);
    background: var(--tip-background-color);
    -webkit-transform-origin-x: 0;
    -webkit-transform: scale(0.9);
  }
</style>
