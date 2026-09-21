import { vec3 } from 'gl-matrix';
import { Camera } from 'render/Camera';
import type { Renderer } from 'render/Renderer';

export class Input {
  private isLocked = false;
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  
  private static readonly sensibility = 0.003;
  private static readonly maxPhi = -0.001;
  private static readonly minPhi = 0.001 - Math.PI;
  private readonly look = {
    state: {
      phi: Math.PI * -0.5,
      theta: 0,
    },
    target: {
      phi: Math.PI * -0.5,
      theta: 0,
    },
  };
  private static readonly speed = 40;
  private readonly movement: { x: number[]; y: number[]; z: number[] } = {
    x: [],
    y: [],
    z: [],
  };
  private readonly pointer = {
    primary: false,
    primaryDown: false,
    primaryUp: false,
    secondary: false,
    secondaryDown: false,
    secondaryUp: false,
  };

  constructor(renderer: Renderer) {
    this.canvas = renderer.getCanvas();
    this.camera = renderer.getCamera();
    this.camera.position = vec3.fromValues(0, 64, 0);
    this.updateDirection();

    this.onkeydown = this.onkeydown.bind(this);
    document.addEventListener('keydown', this.onkeydown);
    this.onkeyup = this.onkeyup.bind(this);
    document.addEventListener('keyup', this.onkeyup);
    this.onpointerlock = this.onpointerlock.bind(this);
    document.addEventListener('pointerlockchange', this.onpointerlock);
    this.onpointerdown = this.onpointerdown.bind(this);
    this.canvas.addEventListener('pointerdown', this.onpointerdown);
    this.onpointermove = this.onpointermove.bind(this);
    this.canvas.addEventListener('pointermove', this.onpointermove);
    this.onpointerup = this.onpointerup.bind(this);
    this.canvas.addEventListener('pointerup', this.onpointerup);
  }

  private onkeydown(e: KeyboardEvent) {
    const { isLocked, movement } = this;
    if (!isLocked || e.repeat) return;
    switch (e.key.toUpperCase()) {
      case 'W':
        movement.z.unshift(1);
        break;
      case 'S':
        movement.z.unshift(-1);
        break;
      case 'A':
        movement.x.unshift(-1);
        break;
      case 'D':
        movement.x.unshift(1);
        break;
      case ' ':
        movement.y.unshift(1);
        break;
      case 'SHIFT':
        movement.y.unshift(-1);
        break;
    }
  }

  private onkeyup(e: KeyboardEvent) {
    const { movement } = this;
    if (e.repeat) return;
    switch (e.key.toUpperCase()) {
      case 'W': {
        const i = movement.z.indexOf(1);
        if (i !== -1) movement.z.splice(i, 1);
        break;
      }
      case 'S': {
        const i = movement.z.indexOf(-1);
        if (i !== -1) movement.z.splice(i, 1);
        break;
      }
      case 'A':{
        const i = movement.x.indexOf(-1);
        if (i !== -1) movement.x.splice(i, 1);
        break;
      }
      case 'D': {
        const i = movement.x.indexOf(1);
        if (i !== -1) movement.x.splice(i, 1);
        break;
      }
      case ' ':{
        const i = movement.y.indexOf(1);
        if (i !== -1) movement.y.splice(i, 1);
        break;
      }
      case 'SHIFT': {
        const i = movement.y.indexOf(-1);
        if (i !== -1) movement.y.splice(i, 1);
        break;
      }
    }
  }

  private onpointerlock() {
    const { canvas, movement, pointer } = this;
    this.isLocked = document.pointerLockElement === canvas;
    document.body.classList[this.isLocked ? 'add' : 'remove']('pointerlock');
    if (!this.isLocked) {
      movement.x.length = movement.y.length = movement.z.length = 0;
      pointer.primary = pointer.primaryDown = pointer.primaryUp = false;
      pointer.secondary = pointer.secondaryDown = pointer.secondaryUp = false;
    }
  }

  private onpointerdown(e: PointerEvent) {
    const { canvas, isLocked, pointer } = this;
    if (!isLocked) {
      canvas.requestPointerLock();
    } else {
      switch (e.button) {
        case 0:
          pointer.primary = pointer.primaryDown = true;
          break;
        case 2:
          pointer.secondary = pointer.secondaryDown = true;
          break;
      }
    }
  }

  private onpointermove(e: PointerEvent) {
    const { isLocked, look } = this;
    const { minPhi, maxPhi, sensibility } = Input;
    if (!isLocked) {
      return;
    }
    look.target.phi += -e.movementY * sensibility;
    look.target.phi = Math.min(Math.max(look.target.phi, minPhi), maxPhi);
    look.target.theta += -e.movementX * sensibility;
  }

  private onpointerup(e: PointerEvent) {
    const { pointer } = this;
    switch (e.button) {
      case 0:
        pointer.primary = false;
        pointer.primaryUp = true;
        break;
      case 2:
        pointer.secondary = false;
        pointer.secondaryUp = true;
        break;
    }
  }

  private static readonly aux1 = vec3.create();
  private updateDirection() {
    const { camera, look } = this;
    const { aux1: direction } = Input;
    camera.direction = vec3.set(
      direction,
      Math.sin(look.state.phi) * Math.sin(look.state.theta),
      Math.cos(look.state.phi),
      Math.sin(look.state.phi) * Math.cos(look.state.theta)
    );
  }

  getPointer(): typeof this.pointer {
    return { ...this.pointer };
  }

  private static readonly aux2 = vec3.create();
  private static readonly aux3 = vec3.create();
  private static readonly aux4 = vec3.create();
  update(delta: number) {
    const { camera, look, movement, pointer } = this;
    const { aux2: right, aux3: move, aux4: position, speed } = Input;

    const lambda = 20;
    let directionNeedsUpdate = false;
    for (const key of ['phi', 'theta'] as (keyof typeof look.state)[]) {
      if (look.state[key] !== look.target[key]) {
        const diff = look.target[key] - look.state[key];
        if (Math.abs(diff) > 0.001) {
          look.state[key] += diff * (1 - Math.exp(-lambda * delta));
        } else {
          look.state[key] = look.target[key];
        }
        directionNeedsUpdate = true;
      }
    }
    if (directionNeedsUpdate) {
      this.updateDirection();
    }

    if (movement.x.length || movement.y.length || movement.z.length) {
      vec3.cross(right, camera.direction, Camera.up);
      vec3.set(move, 0, 0, 0);
      if (movement.x.length) {
        vec3.scaleAndAdd(move, move, right, movement.x[0]);
      }
      if (movement.y.length) {
        vec3.scaleAndAdd(move, move, Camera.up, movement.y[0]);
      }
      if (movement.z.length) {
        vec3.scaleAndAdd(move, move, camera.direction, movement.z[0]);
      }
      vec3.normalize(move, move);
      vec3.scale(move, move, speed * delta);
      camera.position = vec3.add(position, camera.position, move);
    }

    pointer.primaryDown = pointer.primaryUp = false;
    pointer.secondaryDown = pointer.secondaryUp = false;
  }
}
