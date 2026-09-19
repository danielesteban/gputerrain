import type { vec3 } from 'gl-matrix';
import type { Renderer } from 'render/Renderer';
import HSL from 'compute/HSL.wgsl';
import Noise from 'compute/Noise.wgsl';
import ChunkGeneratorCode from 'compute/ChunkGenerator.wgsl';

export class ChunkGenerator {
  static readonly size = 64;

  private readonly renderer: Renderer;
  private readonly data: GPUTexture;
  private readonly position: GPUBuffer;
  private readonly pipeline: GPUComputePipeline;
  private readonly bindings: GPUBindGroup[];
  private needsUpdate = false;

  constructor(renderer: Renderer) {
    const device = renderer.getDevice();
    this.renderer = renderer;
    this.data = device.createTexture({
      dimension: '3d',
      size: [ChunkGenerator.size, ChunkGenerator.size, ChunkGenerator.size],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.position = device.createBuffer({
      size: 3 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    this.pipeline = renderer.getComputePipeline('ChunkGenerator', () => (
      device.createComputePipeline({
        label: 'ChunkGenerator',
        layout: 'auto',
        compute: {
          module: device.createShaderModule({
            code: (
              `const SIZE = vec3u(${ChunkGenerator.size});\n`
              + HSL
              + Noise
              + ChunkGeneratorCode
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
            resource: this.data.createView(),
          },
          {
            binding: 1,
            resource: this.position,
          }
        ],
      }),
    ];
  }

  destroy() {
    const { data, position } = this;
    data.destroy();
    position.destroy();
  }

  getData() {
    return this.data;
  }

  setPosition(value: vec3) {
    const { renderer, position } = this;
    renderer.getDevice().queue.writeBuffer(position, 0, value as Float32Array);
    this.needsUpdate = true;
  }

  compute(pass: GPUComputePassEncoder) {
    if (!this.needsUpdate) {
      return;
    }
    const { bindings, pipeline } = this;
    pass.setPipeline(pipeline);
    for (let i = 0, l = bindings.length; i < l; i++) {
      pass.setBindGroup(i, bindings[i]);
    }
    pass.dispatchWorkgroups(
      Math.ceil(ChunkGenerator.size / 4),
      Math.ceil(ChunkGenerator.size / 4),
      Math.ceil(ChunkGenerator.size / 4),
    );
    this.needsUpdate = false;
  }
}
