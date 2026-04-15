/* 延时触发器 */
export class LazyExecutor {
  constructor(f, delay) {
    this.i = 0
    this.f = f
    this.delay = delay || 0
  }

  /**
   * Execute
   */
  Execute(f) {
    this.i++
    const num = this.i
    setTimeout(() => {
      if (num === this.i) {
        if (f) {
          f()
        } else if (this.f) {
          this.f()
        }
      }
    }, this.delay)
  }
}
