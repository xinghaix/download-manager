<template>
  <div class="progress-wrapper" :style="{width: normalizedWidth + 'px', height: normalizedWidth + 'px'}">
    <svg class="progress-svg" :viewBox="'0 0 ' + viewWidth + ' ' + viewWidth">
      <circle class="background"
              :cx="moveWidth" :cy="moveWidth" r="32"
              :stroke="color"
              :stroke-width="normalizedStrokeWidth"/>
      <path v-if="loop" class="loop"
            :d="'M ' + moveWidth + ' ' + normalizedStrokeWidth +
                ' a 32 32 0 0 1 22.627 54.627'"
            :stroke="getColor(paused)"
            :stroke-width="normalizedStrokeWidth"
            :style="{animationPlayState: paused ? 'paused' : 'running',
                     transformOrigin: moveWidth + 'px ' + moveWidth + 'px'}"/>
      <path v-else class="percentage"
            :d="'M ' + moveWidth + ' ' + moveWidth +
                ' m 0 -32 a 32 32 0 1 1 0 64 a 32 32 0 1 1 0 -64'"
            :stroke="getColor(paused)"
            :stroke-width="normalizedStrokeWidth"
            :style="{strokeDasharray: dasharray + 'px, 201.062px'}"/>
    </svg>
  </div>
</template>

<script>
  export default {
    name: 'Progress',
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
        type: Number
      },
      loop: {
        default: false,
        type: Boolean
      }
    },
    computed: {
      normalizedWidth() {
        return this.width > 0 ? this.width : 64
      },
      normalizedStrokeWidth() {
        if (!this.strokeWidth || this.strokeWidth <= 0) {
          return 4
        }
        return Math.min(this.strokeWidth, this.normalizedWidth)
      },
      viewWidth() {
        return 64 + this.normalizedStrokeWidth * 2
      },
      moveWidth() {
        return this.viewWidth / 2
      },
      dasharray() {
        let percentage = this.percentage
        if (!percentage || percentage < 0) {
          percentage = 0
        } else if (percentage > 100) {
          percentage = 100
        }
        return Math.PI * 2 * 32 * percentage / 100
      }
    },
    methods: {
      getColor(paused) {
        return paused ? '#E6A23C' : '#20A0FF'
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
