import './main.css';
import { vec3 } from 'gl-matrix';
import { HDR } from 'compute/HDR';
import { Input } from 'compute/Input';
import { Raycaster } from 'compute/Raycaster';
import { Grid } from 'objects/Grid';
// import { Debug } from 'objects/Debug';
import { Rain } from 'objects/Rain';
import { World } from 'objects/World';
import { Renderer } from 'render/Renderer';
import { SFX } from 'sounds/SFX';
import Environment from 'textures/citrus_orchard_road_puresky_2k.jpg';
import { SetupControls } from 'ui/Controls';
import { FPS } from 'ui/FPS';

const app = document.getElementById('app')!;
const canvas = document.createElement('canvas');

Promise.all([
  HDR(Environment),
  Renderer.create(canvas),
])
.then(([environment, renderer]) => {
  renderer.setEnvironment(environment);

  let clock: number;
  let frame: number;

  const fps = new FPS();
  const input = new Input(renderer);
  const raycaster = new Raycaster();
  const sfx = new SFX();

  // const debug = new Debug(renderer);
  const world = new World(renderer);
  const grid = new Grid(renderer);
  const rain = new Rain(renderer, sfx, world);

  renderer
    // .addObject(debug)
    .addObject(world)
    .addObject(grid)
    .addObject(rain);

  const onFrame = () => {
    frame = requestAnimationFrame(onFrame);

    const time = performance.now() / 1000;
    const delta = Math.min(time - clock, 1 / 30);
    clock = time;
    fps.update(time);

    const pointer = input.getPointer();
    input.update(delta);
    sfx.update(delta);

    renderer
      .animate(delta, time)
      .compute()
      .render();

    if (pointer.primaryDown || pointer.secondaryDown) {
      raycaster
        .setFromCamera(renderer.getCamera())
        .intersect([...world.getSubChunks(), grid])
        .then((hit) => {
          if (!hit) {
            // debug.visible = false;
            return;
          }
          vec3.scaleAndAdd(
            hit.position,
            hit.position,
            hit.normal || vec3.fromValues(0, 1, 0),
            0.001
          );
          // debug.position = hit.position;
          // debug.visible = true;
          world.update(pointer.secondaryDown ? {
            position: hit.position,
            radius: 10,
            erase: true,
          }: {
            position: hit.position,
            radius: 5,
            color: vec3.fromValues(1.0, 0.0, 0.0),
          });
        });
    }
  };
  const onResize = () => {
    const rect = app.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, 0.5);
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
  SetupControls(rain);

  clock = performance.now() / 1000;
  frame = requestAnimationFrame(onFrame);
}).catch((e: Error) => {
  const error = document.getElementById('error')!;
  error.textContent = `Error: "${e.message}"`;
  error.style.display = 'block';
}).finally(() => {
  document.getElementById('loading')!.style.display = 'none';
});
