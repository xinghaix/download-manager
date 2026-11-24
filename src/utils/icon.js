/* eslint-disable no-undef */
const ACTION_ICON_SIZES = [19, 38]
const ICON_VIEWBOX_SIZE = 1024
const PROGRESS_QUANTIZE_STEPS = 80
const LOOP_INTERVAL_MS = 450

const canvasPool = new Map()
let cachedArrowPath = null

function getArrowPath() {
  if (cachedArrowPath || typeof Path2D === 'undefined') {
    return cachedArrowPath
  }

  const path = new Path2D()
  path.moveTo(900.58513906, 509.43943584)
  path.lineTo(524.45655459, 882.01902676)
  path.bezierCurveTo(517.3594666, 889.11611475, 506.71518331, 889.11611475, 499.61809531, 882.01902675)
  path.lineTo(123.48861084, 509.43943584)
  path.bezierCurveTo(112.84432754000001, 497.01975663999997, 119.59694932000001, 479.27748535, 135.90829004, 479.27748536)
  path.lineTo(325.7470795, 479.27748536)
  path.lineTo(325.74707949, 156.1742501)
  path.bezierCurveTo(325.74707949, 145.52906768, 334.61866426, 136.65748202999998, 345.26294756, 136.65748202999998)
  path.lineTo(678.81170146, 136.65748202999998)
  path.bezierCurveTo(689.45598476, 136.65748202999998, 698.32756953, 145.52906679999998, 698.32756953, 157.94784688)
  path.lineTo(698.32756953, 479.27748535)
  path.lineTo(888.16635898, 479.27748535)
  path.bezierCurveTo(904.13233438, 479.27838535, 911.22942237, 498.79515254, 900.58513906, 509.43943584)
  path.closePath()
  cachedArrowPath = path
  return cachedArrowPath
}

function getCanvasEntry(size) {
  let entry = canvasPool.get(size)
  if (!entry) {
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    entry = { canvas, ctx }
    canvasPool.set(size, entry)
  }
  return entry
}

function traceArrowPathFallback(ctx) {
  ctx.beginPath()
  ctx.moveTo(900.58513906, 509.43943584)
  ctx.lineTo(524.45655459, 882.01902676)
  ctx.bezierCurveTo(517.3594666, 889.11611475, 506.71518331, 889.11611475, 499.61809531, 882.01902675)
  ctx.lineTo(123.48861084, 509.43943584)
  ctx.bezierCurveTo(112.84432754000001, 497.01975663999997, 119.59694932000001, 479.27748535, 135.90829004, 479.27748536)
  ctx.lineTo(325.7470795, 479.27748536)
  ctx.lineTo(325.74707949, 156.1742501)
  ctx.bezierCurveTo(325.74707949, 145.52906768, 334.61866426, 136.65748202999998, 345.26294756, 136.65748202999998)
  ctx.lineTo(678.81170146, 136.65748202999998)
  ctx.bezierCurveTo(689.45598476, 136.65748202999998, 698.32756953, 145.52906679999998, 698.32756953, 157.94784688)
  ctx.lineTo(698.32756953, 479.27748535)
  ctx.lineTo(888.16635898, 479.27748535)
  ctx.bezierCurveTo(904.13233438, 479.27838535, 911.22942237, 498.79515254, 900.58513906, 509.43943584)
  ctx.closePath()
}

const icon = {

  message: {
    offset: 0,
    color: '',
    runningColor: '',
    progress: -1,
    running: false,
    timer: null,
    lastSignature: ''
  },

  setColor(color, runningColor) {
    this.message.color = color
    this.message.runningColor = runningColor
  },

  /**
   * 设置自定义颜色的图标
   * @param color {String} 颜色
   * @param running {boolean} 是否正在下载文件
   */
  setBrowserActionIcon(color, running) {
    this.message.color = color
    this.message.running = running

    if (!this.message.running) {
      this.stopRunningTimer()
      this.setIcon()
    }
  },

  /**
   * 设置自定义颜色的图标
   * @param color1 {String} 图标颜色1。没有下载文件时的图标颜色
   * @param color2 {String} 图标颜色2。下载文件时的图标滚动颜色
   * @param running {boolean} 是否正在下载文件
   * @param progress {Number} 下载进度。范围：0-1；-1
   */
  setRunningBrowserActionIcon(color1, color2, running, progress) {
    this.setColor(color1, color2)
    this.message.running = running
    this.message.progress = progress

    if (!this.message.running) {
      this.stopRunningTimer()
      this.setIcon()
      return
    }

    // 仅在未知文件大小（流式下载 progress < 0）时启用循环动画定时器；
    // 已知进度的下载直接按进度差值按需重绘，避免无意义的定时重绘与 IPC 开销
    if (this.shouldAdvanceOffset()) {
      if (!this.message.timer) {
        this.setIcon()
        this.message.timer = setInterval(() => {
          if (!this.shouldAdvanceOffset()) {
            this.stopRunningTimer()
            return
          }
          this.setIcon()
        }, LOOP_INTERVAL_MS)
      }
      return
    }

    this.stopRunningTimer()
    this.setIcon()
  },

  /**
   * 停止运行。也就是icon停止滚动动画
   * @param color {String} 颜色
   */
  restoreDefaultIcon(color) {
    this.message.color = color
    this.message.running = false
    this.message.progress = -1
    this.stopRunningTimer()
    this.setBrowserActionIcon(this.message.color, false)
  },

  stopRunningTimer() {
    if (!this.message.timer) {
      return
    }
    clearInterval(this.message.timer)
    this.message.timer = null
  },

  computeRenderSignature() {
    const { color, runningColor, running, progress, offset } = this.message
    if (!color) {
      return ''
    }
    if (!running) {
      return `idle:${color}`
    }
    if (progress < 0 || isNaN(progress)) {
      return `loop:${color}:${runningColor}:${Math.round(offset * 100)}`
    }
    const step = Math.max(0, Math.min(PROGRESS_QUANTIZE_STEPS, Math.round(progress * PROGRESS_QUANTIZE_STEPS)))
    return `prog:${color}:${runningColor}:${step}`
  },

  setIcon() {
    if (!this.message.color) {
      return
    }

    const signature = this.computeRenderSignature()
    if (signature && signature === this.message.lastSignature) {
      if (this.shouldAdvanceOffset()) {
        this.advanceOffset()
      }
      return
    }

    const imageData = {}
    ACTION_ICON_SIZES.forEach(size => {
      imageData[size] = this.drawIcon(size, this.message.offset)
    })

    if (Object.keys(imageData).length) {
      this.message.lastSignature = signature
      chrome.action.setIcon({ imageData })
    }

    if (this.shouldAdvanceOffset()) {
      this.advanceOffset()
    }
  },

  shouldAdvanceOffset() {
    return this.message.running
      && (this.message.progress < 0 || isNaN(this.message.progress))
  },

  advanceOffset() {
    if ((this.message.offset += 0.09) > 1.6) {
      this.message.offset = 0
    }
  },

  /**
   * 设置自定义颜色的图标
   * @param size {Number} 图标尺寸
   * @param offset {Number} 下载中循环动画偏移
   * @return ImageData
   */
  drawIcon(size = 19, offset = this.message.offset) {
    const { canvas, ctx } = getCanvasEntry(size)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, size, size)

    const scale = size / ICON_VIEWBOX_SIZE
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0)'

    if (this.message.running) {
      const gradient = ctx.createLinearGradient(320, 160, 320, 900)

      if (this.message.progress < 0 || isNaN(this.message.progress)) {
        const v1 = offset
        if (v1 <= 0.6) {
          gradient.addColorStop(0, this.message.runningColor)
          gradient.addColorStop(v1, this.message.runningColor)
          gradient.addColorStop(v1, this.message.color)
          gradient.addColorStop(1, this.message.color)
        } else {
          const v2 = v1 - 0.6
          gradient.addColorStop(0, this.message.color)
          gradient.addColorStop(v2, this.message.runningColor)
          if (v2 < 0.4) {
            gradient.addColorStop(v1, this.message.runningColor)
            gradient.addColorStop(v1, this.message.color)
            gradient.addColorStop(1, this.message.color)
          } else {
            gradient.addColorStop(1, this.message.runningColor)
          }
        }
        ctx.fillStyle = gradient
      } else if (this.message.progress >= 1.0 || this.message.progress === 0) {
        ctx.fillStyle = this.message.color
      } else {
        gradient.addColorStop(0, this.message.runningColor)
        gradient.addColorStop(this.message.progress, this.message.runningColor)
        gradient.addColorStop(this.message.progress, this.message.color)
        gradient.addColorStop(1, this.message.color)
        ctx.fillStyle = gradient
      }
    } else {
      ctx.fillStyle = this.message.color
    }

    const arrowPath = getArrowPath()
    if (arrowPath) {
      ctx.fill(arrowPath)
    } else {
      traceArrowPathFallback(ctx)
      ctx.fill()
    }

    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

}

export default icon
