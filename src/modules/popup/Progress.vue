<template>
  <div class="progress-wrapper" :style="{width: width + 'px', height: width + 'px'}">
    <svg class="progress-svg" :viewBox="'0 0 ' + viewWidth + ' ' + viewWidth">
      <circle class="background"
              :cx="moveWidth" :cy="moveWidth" r="32"
              :stroke="color"
              :stroke-width="strokeWidth"/>
      <path v-if="loop" class="loop"
            :d="'M ' + moveWidth + ' ' + strokeWidth +
                ' a 32 32 0 0 1 22.627 54.627'"
            :stroke="getColor(paused)"
            :stroke-width="strokeWidth"
            :style="{animationPlayState: paused ? 'paused' : 'running',
                     transformOrigin: moveWidth + 'px ' + moveWidth + 'px'}"/>
      <path v-else class="percentage"
            :d="'M ' + moveWidth + ' ' + moveWidth +
                ' m 0 -32 a 32 32 0 1 1 0 64 a 32 32 0 1 1 0 -64'"
            :stroke="getColor(paused)"
            :stroke-width="strokeWidth"
            :style="{strokeDasharray: dasharray + 'px, 201.062px'}"/>
    </svg>
  </div>
</template>

<script>
  export default {
    name: "Progress",
    props: {
      width: {
        default: 64,
        type: Number
      },
      color: {
        default: '#cccccc',
        type: String
      },
      paused: {
        default: false,
        type: Boolean
      },
      percentage: {
        default: 0,
        type: Number
      },
      strokeWidth: {
        default: 4,
        type: Number,
        validator: (value) => {
          return value && value instanceof Number
        }
      },
      loop: {
        default: false,
        type: Boolean
      }
    },
    watch: {
      width(val) {
        if (val < 0) {
          this.width = 0
        }
      },
      percentage(val) {
        this.updateDasharray(val)
      },
    },
    beforeCreate() {

    },
    mounted() {
      this.render()
      this.updateDasharray(this.percentage)
    },
    data() {
      return {
        viewWidth: 72,
        moveWidth: 36,

        perimeter: Math.PI * 2 * 32,
        dasharray: 0
      }
    },
    methods: {
      render() {
        if (!this.width || this.width <= 0) {
          this.width = 64
        }
        if (!this.strokeWidth || this.strokeWidth <= 0) {
          this.strokeWidth = 4
        }
        if (this.strokeWidth > this.width) {
          this.strokeWidth = 32
        }

        this.viewWidth = 64 + this.strokeWidth * 2
        this.moveWidth = this.viewWidth / 2
      },
      /**
       * 根据是否暂停状态获取loop和percentage的颜色
       * @param paused {Boolean} 状态
       * @return {String}
       */
      getColor(paused) {
        if (paused) {
          return '#E6A23C'
        } else {
          return '#20A0FF'
        }
      },

      /**
       * 更新进度
       * @param percentage {Number} 百分比 0~100
       */
      updateDasharray(percentage) {
        if (!percentage || percentage < 0) {
          percentage = 0
        } else if (percentage > 100) {
          percentage = 100
        }
        this.dasharray = this.perimeter * percentage / 100
      }
    }
  }
</script>

<style scoped rel="stylesheet/scss">
  .progress-svg {
    display: block;
  }

  .progress-svg .background,
  .progress-svg .loop,
  .progress-svg .percentage {
    fill: none;
    stroke-linecap: round;
  }

  /* 拥有进度显示时的样式 */
  .progress-svg .percentage {
    stroke-dashoffset: 0;
    transition: stroke-dasharray 0.2s ease 0s, stroke 0.2s ease 0s;
  }

  .progress-svg .loop {
    animation-duration: 1.4s;
    animation-name: loopRotate;
    animation-fill-mode: forwards;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    animation-play-state: running;
  }
  @keyframes loopRotate {
    to {
      transform: rotate(360deg);
    }
  }

</style>