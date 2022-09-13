/* 延时触发器 */
export class LazyExecutor {
    i = 0;
    f;
    delay = 0;
    constructor(f, delay) {
        this.f = f;
        this.delay = delay;
    }
    /**
     * Execute
     */
    Execute(f) {
        this.i++;
        const num = this.i;
        setTimeout(() => {
            if (num === this.i) {
                if (f) {
                    f()
                } else this.f();
            }
        }, this.delay);
    }
}