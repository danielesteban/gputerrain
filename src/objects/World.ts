import { vec2, vec3 } from 'gl-matrix';
import { ChunkData } from 'compute/ChunkData';
import { Chunk } from 'objects/Chunk';
import type { Renderer } from 'render/Renderer';

export class World {
  private static readonly chunkRadius = 5;
  private static readonly chunkScale = vec3.fromValues(64, 64, 64);

  private static readonly chunkGrid = (() => {
    const { chunkRadius: radius } = World;
    const grid: vec2[] = [];
    for (let z = -radius; z <= radius; z++) {
      for (let x = -radius; x <= radius; x++) {
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

  private readonly cameraChunk = vec2.fromValues(Infinity, Infinity);
  private readonly chunkData: ChunkData[];
  private readonly chunks = new Map<string, { data: ChunkData, subchunks: Chunk[] }>();
  private readonly renderer: Renderer;

  constructor(renderer: Renderer) {
    this.chunkData = Array.from({ length: World.chunkGrid.length }, () => new ChunkData(renderer));
    this.renderer = renderer;
  }

  getChunks(): Chunk[] {
    const { chunks } = this;
    return Array.from(chunks.values().flatMap(({ subchunks }) => subchunks));
  }

  private static readonly aux1 = vec2.create();
  animate(_delta: number, _time: number) {
    const { cameraChunk, chunkData, chunks, renderer } = this;
    const { aux1: chunk, chunkGrid, chunkRadius, chunkScale } = World;
    const camera = renderer.getCamera();
    vec2.set(
      chunk,
      Math.floor((camera.position[0] + chunkScale[0] * 0.5) / chunkScale[0]),
      Math.floor((camera.position[2] + chunkScale[2] * 0.5) / chunkScale[2]),
    );
    if (vec2.exactEquals(cameraChunk, chunk)) {
      return;
    }
    vec2.copy(cameraChunk, chunk);

    for (const chunk of chunks.values()) {
      const { id } = chunk.data;
      if (Math.sqrt((id[0] - cameraChunk[0]) ** 2 + (id[1] - cameraChunk[1]) ** 2) >= chunkRadius) {
        chunks.delete(`${id[0]}:${id[1]}`);
        chunkData.push(chunk.data);
        for (const subchunk of chunk.subchunks) {
          renderer.removeObject(subchunk);
        }
      }
    }
    for (const grid of chunkGrid) {
      vec2.add(chunk, cameraChunk, grid);
      const key = `${chunk[0]}:${chunk[1]}`;
      if (!chunks.has(key)) {
        const data = chunkData.pop()!;
        data.id = chunk;
        const subchunks: Chunk[] = [];
        for (let y = 0; y < ChunkData.subChunks; y++) {
          const subchunk = new Chunk(renderer, data, vec3.fromValues(chunk[0], y, chunk[1]), chunkScale);
          subchunks.push(subchunk);
          renderer.addObject(subchunk);
        }
        chunks.set(key, { data, subchunks });
      }
    }
  }

  compute(pass: GPUComputePassEncoder) {
    const { chunks } = this;
    for (const chunk of chunks.values()) {
      chunk.data.compute(pass);
    }
  }

  private static readonly aux2 = vec2.create();
  private static readonly aux3 = vec3.create();
  private static readonly aux4 = vec3.create();
  update(brush: {
    position: vec3;
    radius: number;
  } & (
    { color: vec3; erase?: false }
    | { erase: true }
  )) {
    const { chunks } = this;
    const { aux2: chunk, aux3: position, aux4: pixel, chunkScale } = World;
    vec3.set(
      position,
      brush.position[0] + chunkScale[0] * 0.5,
      brush.position[1],
      brush.position[2] + chunkScale[2] * 0.5,
    );
    vec2.set(
      chunk,
      Math.floor(position[0] / chunkScale[0]),
      Math.floor(position[2] / chunkScale[2]),
    );
    vec3.set(
      position,
      Math.floor((position[0] - chunk[0] * chunkScale[0]) / chunkScale[0] * ChunkData.size),
      Math.floor(position[1] / chunkScale[1] * ChunkData.size),
      Math.floor((position[2] - chunk[1] * chunkScale[2]) / chunkScale[2] * ChunkData.size)
    );
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        if (
          (x < 0 && position[0] - brush.radius > 0)
          || (z < 0 && position[2] - brush.radius > 0)
          || (x > 0 && position[0] + brush.radius < ChunkData.size - 1)
          || (z > 0 && position[2] + brush.radius < ChunkData.size - 1)
        ) {
          continue;
        }
        chunks.get(`${chunk[0] + x}:${chunk[1] + z}`)?.data.update({
          ...brush,
          position: vec3.set(
            pixel,
            position[0] - x * ChunkData.size,
            position[1],
            position[2] - z * ChunkData.size
          ),
        });
      }
    }
  }
}
