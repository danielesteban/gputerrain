import './main.css';
import { Input } from 'compute/Input';
import { Raycaster } from 'compute/Raycaster';
import { Grid } from 'objects/Grid';
import { World } from 'objects/World';
import { Renderer } from 'render/Renderer';

const app = document.getElementById('app')!;
const canvas = document.createElement('canvas');

Renderer.create(canvas).then((renderer) => {
  let animation: number;
  let clock: number;
  const input = new Input(renderer);
  const raycaster = new Raycaster();

  const grid = new Grid(renderer);
  const world = new World(renderer);

  const onFrame = () => {
    animation = requestAnimationFrame(onFrame);

    const time = performance.now() / 1000;
    const delta = Math.min(time - clock, 1 / 30);
    clock = time;

    const pointer = input.getPointer();
    input.update(delta);
    renderer.compute();
    renderer.animate(delta, time);
    renderer.render();

    if (pointer.primaryDown) {
      raycaster
        .intersect(renderer.getCamera(), [...world.getChunks(), grid])
        .then((hit) => {
          if (!hit) return;
          console.log(hit.position, hit.obj.constructor);
        });
    }
  };
  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      clock = performance.now() / 1000;
      animation = requestAnimationFrame(onFrame);
    } else {
      cancelAnimationFrame(animation);
    }
  };

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  onResize();
  app.appendChild(canvas);
  clock = performance.now() / 1000;
  animation = requestAnimationFrame(onFrame);

  renderer.addObject(grid);
  renderer.addObject(world);
});
