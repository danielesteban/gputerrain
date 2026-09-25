import { glMatrix, mat4, vec3 } from 'gl-matrix';
import { Frustum } from 'math/Frustum';

export class Camera {
  static readonly GPUStruct = [
    'struct Camera {',
    '  position: vec3f,',
    '  projection: mat4x4<f32>,',
    '  view: mat4x4<f32>,',
    '}',
  ].join('\n');
  static readonly up = vec3.fromValues(0, 1, 0);

  private readonly device: GPUDevice;
  private readonly buffer: GPUBuffer;

  private readonly fov = 75;
  private readonly near = 0.1;
  private readonly far = 1024;

  private _aspect = 1;
  private readonly _position = vec3.create();
  private readonly _direction = vec3.create();

  private readonly projection = mat4.create();
  private readonly projectionInverse = mat4.create();
  private readonly view = mat4.create();
  private readonly viewInverse = mat4.create();

  private readonly frustum = new Frustum();

  private bufferNeedsUpdate = true;
  private frustumNeedsUpdate = true;
  private projectionNeedsUpdate = true;
  private projectionInverseNeedsUpdate = true;
  private viewNeedsUpdate = true;
  private viewInverseNeedsUpdate = true;

  constructor(device: GPUDevice) {
    this.device = device;
    this.buffer = device.createBuffer({
      size: (
        (this.position as Float32Array).byteLength + 4
        + (this.projection as Float32Array).byteLength
        + (this.view as Float32Array).byteLength
      ),
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
  }

  getBuffer() {
    return this.buffer;
  }

  get aspect(): Readonly<number> {
    return this._aspect;
  }

  set aspect(value: number) {
    this._aspect = value;
    this.projectionNeedsUpdate = true;
  }

  get position(): Readonly<vec3> {
    return this._position;
  }

  set position(value: vec3) {
    vec3.copy(this._position, value);
    this.viewNeedsUpdate = true;
  }

  get direction(): Readonly<vec3> {
    return this._direction;
  }

  set direction(value: vec3) {
    vec3.copy(this._direction, value);
    this.viewNeedsUpdate = true;
  }

  private static readonly aux1 = mat4.create();
  getFrustum() {
    const { frustum } = this;
    const { aux1: matrix } = Camera;
    const projection = this.getProjection();
    const view = this.getView();
    if (this.frustumNeedsUpdate) {
      frustum.update(mat4.multiply(matrix, projection, view));
      this.frustumNeedsUpdate = false;
    }
    return frustum;
  }

  getProjection() {
    const {
      aspect,
      fov,
      near,
      far,
      projection,
    } = this;
    if (this.projectionNeedsUpdate) {
      mat4.perspective(projection, glMatrix.toRadian(fov), aspect, near, far);
      this.projectionNeedsUpdate = false;
      this.bufferNeedsUpdate = true;
      this.frustumNeedsUpdate = true;
      this.projectionInverseNeedsUpdate = true;
    }
    return projection;
  }

  getProjectionInverse() {
    const { projectionInverse } = this;
    const projection = this.getProjection();
    if (this.projectionInverseNeedsUpdate) {
      mat4.invert(projectionInverse, projection);
      this.projectionInverseNeedsUpdate = false;
    }
    return projectionInverse;
  }

  private static readonly aux2 = vec3.create();
  getView() {
    const {
      position,
      direction,
      view,
    } = this;
    const { aux2: target, up } = Camera;
    if (this.viewNeedsUpdate) {
      mat4.lookAt(view, position, vec3.add(target, position, direction), up);
      this.viewNeedsUpdate = false;
      this.bufferNeedsUpdate = true;
      this.frustumNeedsUpdate = true;
      this.viewInverseNeedsUpdate = true;
    }
    return view;
  }

  getViewInverse() {
    const { viewInverse } = this;
    const view = this.getView();
    if (this.viewInverseNeedsUpdate) {
      mat4.invert(viewInverse, view);
      this.viewInverseNeedsUpdate = false;
    }
    return viewInverse;
  }

  update() {
    const {
      device,
      buffer,
      position,
    } = this;
    const projection = this.getProjection();
    const view = this.getView();
    if (!this.bufferNeedsUpdate) {
      return;
    }
    this.bufferNeedsUpdate = false;  
    device.queue.writeBuffer(buffer, 0, new Float32Array([
      ...position, 0,
      ...projection,
      ...view,
    ]));
  }
}
