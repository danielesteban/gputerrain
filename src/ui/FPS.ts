export class FPS {
  private readonly dom: HTMLElement;
  private clock = performance.now() / 1000;
  private count = 0;

  constructor() {
    this.dom = document.getElementById('fps')!;
  }

  update(time: number) {
    const { dom } = this;
    this.count++;
    if (time >= this.clock + 1) {
      const count = `${Math.round(this.count / (time - this.clock))}fps`;
      if (dom.innerText !== count) {
        dom.innerText = count;
      }
      this.clock = time;
      this.count = 0;
    }
  }
}
