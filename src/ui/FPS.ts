export class FPS {
  private readonly dom: HTMLElement | null = null;
  private clock = performance.now() / 1000;
  private count = 0;

  constructor() {
    if (!!localStorage.getItem('debug')) {
      this.dom = document.createElement('div');
      this.dom.id = 'fps';
      document.body.appendChild(this.dom);
    }
  }

  update(time: number) {
    const { dom } = this;
    if (!dom) {
      return;
    }
    this.count++;
    if (time >= this.clock + 1) {
      const count = `${Math.round(this.count / (time - this.clock))}`;
      if (dom.innerText !== count) {
        dom.innerText = count;
      }
      this.clock = time;
      this.count = 0;
    }
  }
}
