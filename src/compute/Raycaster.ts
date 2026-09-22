import { type vec2, vec3 } from 'gl-matrix';
import type { Sphere } from 'math/Sphere';
import type { Camera } from 'render/Camera';

export type Intersection = {
  distance: number;
  normal?: vec3;
  obj: any;
};

export class Raycaster {
  private static readonly rays: Ray[] = [];

  readonly origin = vec3.create();
  readonly direction = vec3.create();
  maxDistance = 200;

  setFromCamera(camera: Camera, position?: vec2) {
    const { origin, direction } = this;
    vec3.copy(origin, camera.position);
    vec3.set(direction, position?.[0] || 0, position?.[1] || 0, 0.5);
    vec3.transformMat4(direction, direction, camera.getProjectionInverse());
    vec3.transformMat4(direction, direction, camera.getViewInverse());
    vec3.sub(direction, direction, origin);
    vec3.normalize(direction, direction);
    return this;
  }

  async intersect(
    objects: { raycast: (ray: Ray, intersections: Intersection[]) => Promise<void> }[]
  ) {
    const { origin, direction, maxDistance } = this;
    const { rays } = Raycaster;
    const ray = rays.pop() || new Ray();
    vec3.copy(ray.origin, origin);
    vec3.copy(ray.direction, direction);
    ray.maxDistance = maxDistance;
    const intersections: Intersection[] = [];
    await Promise.all(objects.map((obj) => (
      obj.raycast(ray, intersections)
    )));
    rays.push(ray);
    intersections.sort((a, b) => a.distance - b.distance);
    const hit = intersections[0];
    if (!hit) {
      return false;
    }
    return {
      distance: hit.distance,
      normal: hit.normal,
      position: vec3.scaleAndAdd(vec3.create(), ray.origin, ray.direction, hit.distance),
      obj: hit.obj,
    };
  }
}

export class Ray {
  readonly origin = vec3.create();
  readonly direction = vec3.create();
  maxDistance = Infinity;

  private static readonly aux1 = vec3.create();
  intersectSphere(sphere: Sphere) {
    const { origin, direction } = this;
    const { aux1: vector } = Ray;
    if (sphere.radius < 0) return 0;
    vec3.sub(vector, sphere.center, origin);
    const tca = vec3.dot(vector, direction);
    const d2 = vec3.dot(vector, vector) - tca * tca;
    const radius2 = sphere.radius * sphere.radius;
    if (d2 > radius2) return 0;
    const thc = Math.sqrt(radius2 - d2);
    const t0 = tca - thc;
    const t1 = tca + thc;
    if (t1 < 0) return 0;
    if (t0 < 0) return t1;
    return t0;
  }

  private static readonly aux2 = vec3.create();
  private static readonly aux3 = vec3.create();
  private static readonly aux4 = vec3.create();
  private static readonly aux5 = vec3.create();
  intersectTriangle(a: vec3, b: vec3, c: vec3) {
    const { origin, direction } = this;
    const { aux2: edge1, aux3: edge2, aux4: diff, aux5: normal } = Ray;
    vec3.sub(edge1, b, a);
    vec3.sub(edge2, c, a);
    vec3.cross(normal, edge1, edge2);
    const DdN = -vec3.dot(direction, normal);
    if (DdN <= 0) return 0;
    vec3.sub(diff, origin, a);
    const DdQxE2 = -vec3.dot(direction, vec3.cross(edge2, diff, edge2));
    if (DdQxE2 < 0) return 0;
    const DdE1xQ = -vec3.dot(direction, vec3.cross(edge1, edge1, diff));
    if (DdE1xQ < 0 || (DdQxE2 + DdE1xQ) > DdN) return 0;
    const QdN = vec3.dot(diff, normal);
    if (QdN < 0) return 0;
    return QdN / DdN;
  }
}

export class GPURay {
  static readonly GPUStruct = [
    'struct Raycast {',
    '  origin: vec3f,',
    '  direction: vec3f,',
    '  position: vec3f,',
    '  normal: vec3f,',
    '}',
  ].join('\n');

  private readonly device: GPUDevice;
  private readonly input: GPUBuffer;
  private readonly output: GPUBuffer;

  constructor(device: GPUDevice) {
    this.device = device;
    this.input = device.createBuffer({
      size: (
        3 * 4 + 4   // origin
        + 3 * 4 + 4 // direction
        + 3 * 4 + 4 // position
        + 3 * 4 + 4 // normal
      ),
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
    }),
    this.output = device.createBuffer({
      size: (
        3 * 4 + 4   // position
        + 3 * 4 + 4 // normal
      ),
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
  }

  getInput() {
    return this.input;
  }

  setInput(origin: vec3, direction: vec3) {
    const { device, input } = this;
    device.queue.writeBuffer(input, 0, new Float32Array([
      ...origin, 0,
      ...direction, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]));
  }

  copyInputToOutput(commandEncoder: GPUCommandEncoder) {
    const { input, output } = this;
    commandEncoder.copyBufferToBuffer(
      input,
      (
        3 * 4 + 4
        + 3 * 4 + 4
      ),
      output,
      0,
      (
        3 * 4 + 4
        + 3 * 4 + 4
      )
    );
  }

  async readOutput() {
    const { output } = this;
    await output.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(output.getMappedRange());
    const position = vec3.fromValues(result[0], result[1], result[2]);
    const normal = vec3.fromValues(result[4], result[5], result[6]);
    output.unmap();
    return { position, normal };
  }
}
