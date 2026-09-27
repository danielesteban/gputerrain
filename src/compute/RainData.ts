import { ChunkData } from 'compute/ChunkData';
import NoiseCode from 'compute/Noise.wgsl';
import RainDataCode from 'compute/RainData.wgsl';
import type { World } from 'objects/World';
import { CameraGPUStruct } from 'render/Camera';
import type { Renderer } from 'render/Renderer';

export class RainData {
  static readonly instanceCount = 100000;

  private readonly bindings: GPUBindGroup[];
  private heightmaps?: GPUBindGroup;
  private readonly instances: GPUBuffer;
  private readonly params: GPUBuffer;
  private readonly pipeline: GPUComputePipeline;
  private readonly renderer: Renderer;
  private readonly world: World;

  constructor(renderer: Renderer, world: World) {
    const device = renderer.getDevice();
    this.instances = device.createBuffer({
      size: RainData.instanceCount * 4 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
    });
    this.params = device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    this.pipeline = renderer.getComputePipeline('Rain', () => (
      device.createComputePipeline({
        label: 'ChunkGeneratorHeightmap',
        layout: 'auto',
        compute: {
          module: device.createShaderModule({
            code: (
              `const PI: f32 = ${Math.PI};`
              + `const INSTANCE_COUNT: u32 = ${RainData.instanceCount};\n`
              + `const SIZE: vec3i = vec3i(${ChunkData.size}, ${ChunkData.size * ChunkData.subChunks}, ${ChunkData.size});\n`
              // @dani @incomplete
              // Use World.chunkScale here
              + `const SCALE: vec3f = vec3f(64, ${64 * ChunkData.subChunks}, 64);\n`
              + CameraGPUStruct
              + NoiseCode
              + RainDataCode
            ),
          }),
        },
      })
    ));
    this.bindings = [
      device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: renderer.getCamera().getBuffer(),
          },
          {
            binding: 1,
            resource: this.params,
          },
          {
            binding: 2,
            resource: this.instances,
          },
        ],
      }),
    ];
    this.renderer = renderer;
    this.world = world;
    this.updateHeightmaps = this.updateHeightmaps.bind(this);
    world.addEventListener('cameraChunk', this.updateHeightmaps);
  }

  destroy() {
    const { instances, params, world } = this;
    instances.destroy();
    params.destroy();
    world.removeEventListener('cameraChunk', this.updateHeightmaps);
  }

  getInstances() {
    return this.instances;
  }

  animate(delta: number, _time: number) {
    const { params, renderer } = this;
    const device = renderer.getDevice();
    device.queue.writeBuffer(params, 2 * 4, new Float32Array([
      1337 * Math.random(),
      64 * delta,
    ]));
  }

  compute(pass: GPUComputePassEncoder) {
    const { bindings, heightmaps, pipeline } = this;
    if (!heightmaps) {
      return;
    }
    pass.setPipeline(pipeline);
    for (let i = 0, l = bindings.length; i < l; i++) {
      pass.setBindGroup(i, bindings[i]);
    }
    pass.setBindGroup(bindings.length, heightmaps);
    pass.dispatchWorkgroups(Math.ceil(RainData.instanceCount / 64));
  }

  private updateHeightmaps() {
    const { bindings, params, renderer, world } = this;
    const device = renderer.getDevice();

    const cameraChunk = world.getCameraChunk();
    device.queue.writeBuffer(params, 0, new Float32Array([
      ...cameraChunk,
    ]));

    const heightmaps: GPUBuffer[] = [];
    for (let z = -1; z <= 1; z++) {
      for (let x = -1; x <= 1; x++) {
        const chunk = world.getChunk(cameraChunk[0] + x, cameraChunk[1] + z);
        if (!chunk) {
          return;
        }
        heightmaps.push(chunk.data.getHeightmap());
      }
    }
    this.heightmaps = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(bindings.length),
      entries: heightmaps.map((heightmap, i) => ({
        binding: i,
        resource: heightmap,
      })),
    });
  }
}
