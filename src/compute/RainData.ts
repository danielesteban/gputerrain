import type { vec2 } from 'gl-matrix';
import { ChunkData } from 'compute/ChunkData';
import NoiseCode from 'compute/Noise.wgsl';
import RainDataCode from 'compute/RainData.wgsl';
import { CameraGPUStruct } from 'render/Camera';
import type { Renderer } from 'render/Renderer';

export class RainData {
  static readonly instanceCount = 100000;

  private readonly bindings: GPUBindGroup[];
  private readonly instances: GPUBuffer;
  private readonly params: GPUBuffer;
  private readonly pipeline: GPUComputePipeline;
  private readonly renderer: Renderer;

  constructor(renderer: Renderer) {
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
  }

  destroy() {
    const { instances, params } = this;
    instances.destroy();
    params.destroy();
  }

  getInstances() {
    return this.instances;
  }

  compute(pass: GPUComputePassEncoder, heightmaps: GPUBuffer[], origin: vec2) {
    const { bindings, pipeline, params, renderer } = this;
    const device = renderer.getDevice();
    device.queue.writeBuffer(params, 0, new Float32Array([
      ...origin,
      1337 * Math.random(),
      1,
    ]));
    pass.setPipeline(pipeline);
    for (let i = 0, l = bindings.length; i < l; i++) {
      pass.setBindGroup(i, bindings[i]);
    }
    pass.setBindGroup(bindings.length, device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(bindings.length),
      entries: heightmaps.map((heightmap, i) => ({
        binding: i,
        resource: heightmap,
      })),
    }));
    pass.dispatchWorkgroups(Math.ceil(RainData.instanceCount / 64));
  }
}
