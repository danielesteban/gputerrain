import './main.css';
import { vec3 } from 'gl-matrix';
import { Input } from 'compute/Input';
import { Raycaster } from 'compute/Raycaster';
import { Grid } from 'objects/Grid';
import { Debug } from 'objects/Debug';
import { World } from 'objects/World';
import { Renderer } from 'render/Renderer';

const app = document.getElementById('app')!;
const canvas = document.createElement('canvas');

Renderer.create(canvas).then((renderer) => {
  let clock: number;
  let frame: number;
  const input = new Input(renderer);
  const raycaster = new Raycaster();

  const grid = new Grid(renderer);
  const debug = new Debug(renderer);
  const world = new World(renderer);

  const onFrame = () => {
    frame = requestAnimationFrame(onFrame);

    const time = performance.now() / 1000;
    const delta = Math.min(time - clock, 1 / 30);
    clock = time;

    const pointer = input.getPointer();
    input.update(delta);

    renderer
      .animate(delta, time)
      .compute()
      .render();

    if (pointer.primaryDown) {
      raycaster
        .intersect([...world.getChunks(), grid], renderer.getCamera())
        .then((hit) => {
          if (!hit) return;
          debug.position = vec3.scaleAndAdd(
            hit.position,
            hit.position,
            hit.normal || vec3.fromValues(0, 1, 0),
            0.5
          );
          debug.visible = true;
        });
    }
  };
  const onResize = () => {
    const rect = app.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      clock = performance.now() / 1000;
      frame = requestAnimationFrame(onFrame);
    } else {
      cancelAnimationFrame(frame);
    }
  };

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  onResize();
  app.appendChild(canvas);
  clock = performance.now() / 1000;
  frame = requestAnimationFrame(onFrame);

  renderer
    .addObject(grid)
    .addObject(debug)
    .addObject(world);
});
