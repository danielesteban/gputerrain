import type { vec3 } from 'gl-matrix';
import ChunkGeneratorCode from 'compute/ChunkGenerator.wgsl';
import ChunkHeightmapCode from 'compute/ChunkHeightmap.wgsl';
import HSLCode from 'compute/HSL.wgsl';
import NoiseCode from 'compute/Noise.wgsl';
import type { Renderer } from 'render/Renderer';

export class ChunkGenerator {
  static readonly size = 64;

  private readonly renderer: Renderer;
  private readonly data: GPUTexture;
  private readonly heightmap: GPUBuffer;
  private readonly position: GPUBuffer;
  private readonly pipelines: {
    generator: GPUComputePipeline;
    heightmap: GPUComputePipeline;
  };
  private readonly bindings: {
    generator: GPUBindGroup[];
    heightmap: GPUBindGroup[];
  };
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
    this.heightmap = device.createBuffer({
      size: ChunkGenerator.size * ChunkGenerator.size * 4,
      usage: GPUBufferUsage.STORAGE,
    });
    this.position = device.createBuffer({
      size: 3 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    this.pipelines = {
      generator: renderer.getComputePipeline('ChunkGenerator', () => (
        device.createComputePipeline({
          label: 'ChunkGenerator',
          layout: 'auto',
          compute: {
            module: device.createShaderModule({
              code: (
                `const SIZE = vec3u(${ChunkGenerator.size});\n`
                + HSLCode
                + NoiseCode
                + ChunkGeneratorCode
              ),
            }),
          },
        })
      )),
      heightmap: renderer.getComputePipeline('ChunkHeightmap', () => (
        device.createComputePipeline({
          label: 'ChunkHeightmap',
          layout: 'auto',
          compute: {
            module: device.createShaderModule({
              code: (
                `const SIZE = vec3u(${ChunkGenerator.size});\n`
                + NoiseCode
                + ChunkHeightmapCode
              ),
            }),
          },
        })
      )),
    };
    this.bindings = {
      generator: [
        device.createBindGroup({
          layout: this.pipelines.generator.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: this.data.createView(),
            },
            {
              binding: 1,
              resource: this.heightmap,
            },
            {
              binding: 2,
              resource: this.position,
            }
          ],
        }),
      ],
      heightmap: [
        device.createBindGroup({
          layout: this.pipelines.heightmap.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: this.heightmap,
            },
            {
              binding: 1,
              resource: this.position,
            }
          ],
        }),
      ],
    };
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
    const { bindings, pipelines } = this;
    pass.setPipeline(pipelines.heightmap);
    for (let i = 0, l = bindings.heightmap.length; i < l; i++) {
      pass.setBindGroup(i, bindings.heightmap[i]);
    }
    pass.dispatchWorkgroups(
      Math.ceil(ChunkGenerator.size / 8),
      Math.ceil(ChunkGenerator.size / 8),
    );
    pass.setPipeline(pipelines.generator);
    for (let i = 0, l = bindings.generator.length; i < l; i++) {
      pass.setBindGroup(i, bindings.generator[i]);
    }
    pass.dispatchWorkgroups(
      Math.ceil(ChunkGenerator.size / 4),
      Math.ceil(ChunkGenerator.size / 4),
      Math.ceil(ChunkGenerator.size / 4),
    );
    this.needsUpdate = false;
  }
}
