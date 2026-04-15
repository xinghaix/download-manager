<template>
  <span class="tip"
        :style="{ left: (normalizedPosition.x + 4) + 'px', top: (normalizedPosition.y - 12) + 'px', zIndex: zIndex }"
        v-if="visible">
    {{text}}
  </span>
</template>

<script>
  export default {
    name: 'Tip',
    emits: ['update:showTip'],
    props: {
      text: {
        type: String,
        default: ''
      },
      position: {
        type: Object,
        default: () => ({
          x: 0,
          y: 0
        })
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
    data() {
      return {
        timeoutId: null,
        visible: false
      }
    },
    computed: {
      normalizedTimeout() {
        return this.timeout < 0 ? 0 : this.timeout
      },
      normalizedPosition() {
        return {
          x: Math.max(0, Number(this.position?.x) || 0),
          y: Math.max(0, Number(this.position?.y) || 0)
        }
      }
    },
    watch: {
      position: {
        handler() {
          if (this.showTip) {
            this.render()
          }
        },
        deep: true
      },
      showTip(val) {
        if (val) {
          this.render()
        } else {
          this.clearTimer()
          this.visible = false
        }
      }
    },
    beforeUnmount() {
      this.clearTimer()
    },
    methods: {
      clearTimer() {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId)
          this.timeoutId = null
        }
      },
      render() {
        this.clearTimer()
        this.visible = true
        this.timeoutId = setTimeout(() => {
          this.visible = false
          this.timeoutId = null
          this.$emit('update:showTip', false)
        }, this.normalizedTimeout)
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
