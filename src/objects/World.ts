import { vec2, vec3 } from 'gl-matrix';
import { ChunkGenerator } from 'compute/ChunkGenerator';
import { Chunk } from 'objects/Chunk';
import type { Camera } from 'render/Camera';
import type { Renderer } from 'render/Renderer';

export class World {
  private static readonly chunkRadius = 5;
  private static readonly chunkGrid = (() => {
    const { chunkRadius: radius } = World;
    const grid: vec2[] = [];
    const size = Math.ceil(Math.sqrt(radius * radius + radius * radius));
    for (let z = -size; z <= size; z++) {
      for (let x = -size; x <= size; x++) {
        if (Math.sqrt(x ** 2 + z ** 2) < radius) {
          grid.push(vec2.fromValues(x, z));
        }
      }
    }
    grid.sort((a, b) => (
      Math.sqrt(a[0] ** 2 + a[1] ** 2)
      - Math.sqrt(b[0] ** 2 + b[1] ** 2)
    ));
    return grid;
  })();
  private static readonly chunkScale = vec3.fromValues(64, 64, 64);

  private readonly cameraChunk = vec2.fromValues(Infinity, Infinity);
  private readonly chunks = new Map<string, Chunk>();
  private readonly generators: ChunkGenerator[];
  private readonly renderer: Renderer;

  constructor(renderer: Renderer) {
    this.generators = Array.from({ length: World.chunkGrid.length }, () => new ChunkGenerator(renderer));
    this.renderer = renderer;
  }

  getChunks(): Chunk[] {
    const { chunks } = this;
    return Array.from(chunks.values());
  }

  private static readonly aux1 = vec2.create();
  animate(camera: Camera, _delta: number, _time: number) {
    const { cameraChunk, chunks, generators, renderer } = this;
    const { aux1: chunk, chunkGrid, chunkRadius, chunkScale } = World;
    vec2.set(
      chunk,
      Math.floor((camera.position[0] + chunkScale[0] * 0.5) / chunkScale[0]),
      Math.floor((camera.position[2] + chunkScale[2] * 0.5) / chunkScale[2]),
    );
    if (vec2.exactEquals(cameraChunk, chunk)) {
      return;
    }
    vec2.copy(cameraChunk, chunk);

    chunks.forEach((chunk) => {
      const id = chunk.getId();
      if (Math.sqrt((id[0] - cameraChunk[0]) ** 2 + (id[2] - cameraChunk[1]) ** 2) >= chunkRadius) {
        chunks.delete(`${id[0]}:${id[2]}`);
        renderer.removeObject(chunk);
        generators.push(chunk.getGenerator());
      }
    });
    for (const grid of chunkGrid) {
      vec2.add(chunk, cameraChunk, grid);
      const key = `${chunk[0]}:${chunk[1]}`;
      if (!chunks.has(key)) {
        const obj = new Chunk(renderer, generators.pop()!, vec3.fromValues(chunk[0], 0, chunk[1]), chunkScale);
        chunks.set(key, obj);
        renderer.addObject(obj);
      }
    }
  }
}
