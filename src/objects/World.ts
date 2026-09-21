import { vec2, vec3 } from 'gl-matrix';
import { ChunkData } from 'compute/ChunkData';
import { Chunk } from 'objects/Chunk';
import type { Renderer } from 'render/Renderer';

export class World {
  private static readonly chunkRadius = 5;
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
  private static readonly chunkScale = vec3.fromValues(64, 64, 64);

  private readonly cameraChunk = vec2.fromValues(Infinity, Infinity);
  private readonly chunkData: ChunkData[];
  private readonly chunks = new Map<string, Chunk>();
  private readonly renderer: Renderer;

  constructor(renderer: Renderer) {
    this.chunkData = Array.from({ length: World.chunkGrid.length }, () => new ChunkData(renderer));
    this.renderer = renderer;
  }

  getChunks(): Chunk[] {
    const { chunks } = this;
    return Array.from(chunks.values());
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

    chunks.forEach((chunk) => {
      const id = chunk.getId();
      if (Math.sqrt((id[0] - cameraChunk[0]) ** 2 + (id[2] - cameraChunk[1]) ** 2) >= chunkRadius) {
        chunks.delete(`${id[0]}:${id[2]}`);
        renderer.removeObject(chunk);
        chunkData.push(chunk.getData());
      }
    });
    for (const grid of chunkGrid) {
      vec2.add(chunk, cameraChunk, grid);
      const key = `${chunk[0]}:${chunk[1]}`;
      if (!chunks.has(key)) {
        const obj = new Chunk(renderer, chunkData.pop()!, vec3.fromValues(chunk[0], 0, chunk[1]), chunkScale);
        chunks.set(key, obj);
        renderer.addObject(obj);
      }
    }
  }

  private static readonly aux2 = vec3.create();
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
    vec3.set(
      chunk,
      Math.floor(position[0] / chunkScale[0]),
      Math.floor(position[1] / chunkScale[1]),
      Math.floor(position[2] / chunkScale[2]),
    );
    const chunkDataPixels = ChunkData.size - 2;
    vec3.set(
      position,
      Math.floor((position[0] - chunk[0] * chunkScale[0]) / chunkScale[0] * chunkDataPixels),
      Math.floor((position[1] - chunk[1] * chunkScale[1]) / chunkScale[1] * chunkDataPixels),
      Math.floor((position[2] - chunk[2] * chunkScale[2]) / chunkScale[2] * chunkDataPixels)
    );
    const update = (x: number, z: number) => {
      chunks.get(`${chunk[0] + x}:${chunk[2] + z}`)?.getData().update({
        ...brush,
        position: vec3.set(
          pixel,
          position[0] - x * chunkDataPixels,
          position[1],
          position[2] - z * chunkDataPixels
        ),
      });
    };
    update(0, 0);
    if (position[0] - brush.radius <= 0) update(-1, 0);
    if (position[0] + brush.radius >= chunkDataPixels - 1) update(1, 0);
    if (position[2] - brush.radius <= 0) update(0, -1);
    if (position[2] + brush.radius >= chunkDataPixels - 1) update(0, 1);
    if (
      position[0] - brush.radius <= 0
      && position[2] - brush.radius <= 0
    ) update(-1, -1);
    if (
      position[0] + brush.radius >= chunkDataPixels - 1
      && position[2] - brush.radius <= 0
    ) update(1, -1);
    if (
      position[0] - brush.radius <= 0
      && position[2] + brush.radius >= chunkDataPixels - 1
    ) update(-1, 1);
    if (
      position[0] + brush.radius >= chunkDataPixels - 1
      && position[2] + brush.radius >= chunkDataPixels - 1
    ) update(1, 1);
  }
}
