import { vec3 } from 'gl-matrix';
import type { Renderer } from 'render/Renderer';
import { Box } from 'compute/Box';
import { Sphere } from 'compute/Sphere';

export class Geometry {
  private readonly bounds = new Sphere();
  private readonly buffers: { index: Uint32Array; vertices: Float32Array };
  private readonly index: GPUBuffer;
  private readonly indexCount: number;
  private readonly vertices: GPUBuffer;
  private triangles?: [vec3, vec3, vec3][];

  private static readonly aux1 = new Box();
  private static readonly aux2 = vec3.create();
  constructor(renderer: Renderer, buffers: typeof this.buffers) {
    const device = renderer.getDevice();
    this.buffers = buffers;
  
    this.index = device.createBuffer({
      size: buffers.index.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });
    new Uint32Array(this.index.getMappedRange()).set(buffers.index);
    this.index.unmap();

    this.indexCount = buffers.index.length;
    this.vertices = device.createBuffer({
      size: buffers.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertices.getMappedRange()).set(buffers.vertices);
    this.vertices.unmap();

    const { aux1: box, aux2: aux } = Geometry;
    box.makeEmpty();
    for (let i = 0, l = buffers.vertices.length; i < l; i += 3) {
      box.expandByPoint(vec3.set(aux, buffers.vertices[i], buffers.vertices[i + 1], buffers.vertices[i + 2]));
    }
    box.getCenter(this.bounds.center);
    let maxRadiusSq = 0;
    for (let i = 0, l = buffers.vertices.length; i < l; i += 3) {
      maxRadiusSq = Math.max(maxRadiusSq, vec3.sqrDist(this.bounds.center, vec3.set(aux, buffers.vertices[i], buffers.vertices[i + 1], buffers.vertices[i + 2])));
    }
    this.bounds.radius = Math.sqrt(maxRadiusSq);
  }

  getBounds() {
    return this.bounds;
  }

  getIndex() {
    return this.index;
  }

  getIndexCount() {
    return this.indexCount;
  }

  getVertices() {
    return this.vertices;
  }

  getTriangles() {
    const { buffers } = this;
    if (!this.triangles) {
      this.triangles = [];
      for (let i = 0, l = buffers.index.length; i < l; i += 3) {
        const triangle: [vec3, vec3, vec3] = [vec3.create(), vec3.create(), vec3.create()];
        for (let t = 0; t < 3; t++) {
          const offset = buffers.index[i + t] * 3;
          vec3.set(
            triangle[t],
            buffers.vertices[offset],
            buffers.vertices[offset + 1],
            buffers.vertices[offset + 2]
          );
        }
        this.triangles.push(triangle);
      }
    }
    return this.triangles;
  }
}
