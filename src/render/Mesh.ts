import { mat4, quat, vec3 } from 'gl-matrix';
import type { Intersection, Ray } from 'compute/Raycaster';
import { Sphere } from 'math/Sphere';
import type { Geometry } from 'render/Geometry';
import type { Material } from 'render/Material';
import type { Renderer } from 'render/Renderer';

export class Mesh<GeometryType extends Geometry = Geometry, MaterialType extends Material = Material> {
  protected readonly renderer: Renderer;
  private readonly bindings: GPUBindGroup[];
  private readonly geometry: GeometryType;
  private readonly material: MaterialType;
  
  private readonly bounds = new Sphere();
  private boundsNeedsUpdate = true;

  private readonly transform: {
    cpu: {
      matrix: mat4;
      inverse: mat4;
      needsUpdate: boolean;
    },
    gpu: {
      buffer: GPUBuffer;
      needsUpdate: boolean;
    },
  };

  private readonly _position = vec3.fromValues(0, 0, 0);
  private readonly _rotation = quat.fromValues(0, 0, 0, 1);
  private readonly _scale = vec3.fromValues(1, 1, 1);

  frustumCulled = true;
  renderOrder = 0;
  visible = true;

  constructor(
    renderer: Renderer,
    geometry: GeometryType,
    material: MaterialType,
    bindings: Omit<GPUBindGroupDescriptor, 'layout'>[] = [],
  ) {
    const device = renderer.getDevice();
    this.renderer = renderer;
    this.material = material;
    this.geometry = geometry;
    this.transform = {
      cpu: {
        matrix: mat4.create(),
        inverse: mat4.create(),
        needsUpdate: true,
      },
      gpu: {
        buffer: device.createBuffer({
          size: 16 * 2 * 4,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        }),
        needsUpdate: true,
      },
    };
    // @dani @incomplete
    // This prolly belongs in Material
    this.bindings = [
      device.createBindGroup({
        layout: material.getPipeline().getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: renderer.getCamera().getBuffer(),
          },
          {
            binding: 1,
            resource: this.transform.gpu,
          },
        ],
      }),
      ...bindings.map((binding, i) => (
        device.createBindGroup({
          layout: material.getPipeline().getBindGroupLayout(i + 1),
          ...binding,
        })
      )),
    ];
  }

  destroy() {
    const { transform } = this;
    transform.gpu.buffer.destroy();
  }

  get position(): Readonly<vec3> {
    return this._position;
  }

  set position(value: vec3) {
    vec3.copy(this._position, value);
    this.transform.cpu.needsUpdate = true;
  }

  get rotation(): Readonly<quat> {
    return this._rotation;
  }

  set rotation(value: quat) {
    quat.copy(this._rotation, value);
    this.transform.cpu.needsUpdate = true;
  }

  get scale(): Readonly<vec3> {
    return this._scale;
  }

  set scale(value: vec3) {
    vec3.copy(this._scale, value);
    this.transform.cpu.needsUpdate = true;
  }

  getBounds() {
    const { geometry, bounds } = this;
    const transform = this.getTransform();
    if (this.boundsNeedsUpdate) {
      bounds.copy(geometry.getBounds()).applyMatrix(transform.cpu.matrix);
      this.boundsNeedsUpdate = false;
    }
    return bounds;
  }

  getGeometry() {
    return this.geometry;
  }

  getMaterial() {
    return this.material;
  }

  getTransform() {
    const { transform, position, rotation, scale } = this;
    if (transform.cpu.needsUpdate) {
      mat4.fromRotationTranslationScale(transform.cpu.matrix, rotation, position, scale);
      mat4.invert(transform.cpu.inverse, transform.cpu.matrix);
      transform.cpu.needsUpdate = false;
      transform.gpu.needsUpdate = true;
      this.boundsNeedsUpdate = true;
    }
    return transform;
  }

  private static readonly aux1 = vec3.create();
  private static readonly aux2 = vec3.create();
  private static readonly aux3 = vec3.create();
  async raycast(ray: Ray, intersections: Intersection[]) {
    const { geometry } = this;
    const { aux1: a, aux2: b, aux3: c } = Mesh;
    const bounds = this.getBounds();
    const transform = this.getTransform();
    if (!bounds.containsPoint(ray.origin)) {
      const distanceToBounds = ray.intersectSphere(bounds);
      if (!distanceToBounds || distanceToBounds > ray.maxDistance) {
        return;
      }
    }
    const distance = geometry.getTriangles().reduce((result, triangle) => {
      vec3.transformMat4(a, triangle[0], transform.cpu.matrix);
      vec3.transformMat4(b, triangle[1], transform.cpu.matrix);
      vec3.transformMat4(c, triangle[2], transform.cpu.matrix);
      const distance = ray.intersectTriangle(a, b, c);
      if (distance) {
        return Math.min(distance, result);
      }
      return result;
    }, Infinity);
    if (distance === Infinity || distance > ray.maxDistance) {
      return;
    }
    intersections.push({
      distance,
      obj: this,
    });
  }

  animate(_delta: number, _time: number) {
    const { renderer } = this;
    const transform = this.getTransform();
    if (transform.gpu.needsUpdate) {
      renderer.getDevice().queue.writeBuffer(transform.gpu.buffer, 0, new Float32Array([
        ...transform.cpu.matrix,
        ...transform.cpu.inverse,
      ]));
      transform.gpu.needsUpdate = false;
    }
  }

  render(pass: GPURenderPassEncoder) {
    const { bindings, geometry, material, visible } = this;
    if (!visible) return;
    material.render(pass, bindings, geometry);
  }
}

export const TransformGPUStruct = /* wgsl */`
struct Transform {
  matrix: mat4x4<f32>,
  inverse: mat4x4<f32>,
}
`;
