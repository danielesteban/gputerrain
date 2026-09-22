import { vec3 } from 'gl-matrix';
import ChunkGeneratorCode from 'compute/ChunkGenerator.wgsl';
import ChunkHeightmapCode from 'compute/ChunkHeightmap.wgsl';
import ChunkUpdateCode from 'compute/ChunkUpdate.wgsl';
import HSLCode from 'compute/HSL.wgsl';
import NoiseCode from 'compute/Noise.wgsl';
import type { Renderer } from 'render/Renderer';

export class ChunkData {
  static readonly size = 128;
  static readonly subChunks = 2;
  private static readonly noise = {
    colorFrequency: 1,
    colorSeed: 1337,
    generatorFrequency: 1,
    generatorSeed: 0,
    heightmapFrequency: 0.5,
    heightmapSeed: 0,
  };

  private static inputData?: GPUTexture;
  private static getInputData(renderer: Renderer) {
    if (!ChunkData.inputData) {
      const device = renderer.getDevice();
      ChunkData.inputData = device.createTexture({
        dimension: '3d',
        size: [ChunkData.size, ChunkData.size, ChunkData.size],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING,
      });
    }
    return ChunkData.inputData;
  }

  private readonly renderer: Renderer;
  private readonly brush: GPUBuffer;
  private readonly data: GPUTexture;
  private readonly heightmap: GPUBuffer;
  private readonly position: GPUBuffer;
  private readonly pipelines: {
    generator: GPUComputePipeline;
    heightmap: GPUComputePipeline;
    update: GPUComputePipeline;
  };
  private readonly bindings: {
    generator: GPUBindGroup[];
    heightmap: GPUBindGroup[];
    update: GPUBindGroup[];
  };
  private needsUpdate = false;

  constructor(renderer: Renderer) {
    const device = renderer.getDevice();
    this.renderer = renderer;
    this.brush = device.createBuffer({
      size: 8 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    this.data = device.createTexture({
      dimension: '3d',
      size: [ChunkData.size, ChunkData.size, ChunkData.size],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.heightmap = device.createBuffer({
      size: ChunkData.size * ChunkData.size * 4,
      usage: GPUBufferUsage.STORAGE,
    });
    this.position = device.createBuffer({
      size: 3 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    this.pipelines = {
      generator: renderer.getComputePipeline('ChunkData', () => (
        device.createComputePipeline({
          label: 'ChunkData',
          layout: 'auto',
          compute: {
            module: device.createShaderModule({
              code: (
                `const NOISE_FREQUENCY: f32 = ${ChunkData.noise.generatorFrequency};\n`
                + `const NOISE_SEED: f32 = ${ChunkData.noise.generatorSeed};\n`
                + `const COLOR_FREQUENCY: f32 = ${ChunkData.noise.colorFrequency};\n`
                + `const COLOR_SEED: f32 = ${ChunkData.noise.colorSeed};\n`
                + `const SIZE: vec3u = vec3u(${ChunkData.size});\n`
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
                `const NOISE_FREQUENCY: f32 = ${ChunkData.noise.heightmapFrequency};\n`
                + `const NOISE_SEED: f32 = ${ChunkData.noise.heightmapSeed};\n`
                + `const SIZE: vec3u = vec3u(${ChunkData.size});\n`
                + `const SUBCHUNKS: u32 = ${ChunkData.subChunks};\n`
                + NoiseCode
                + ChunkHeightmapCode
              ),
            }),
          },
        })
      )),
      update: renderer.getComputePipeline('ChunkUpdate', () => (
        device.createComputePipeline({
          label: 'ChunkUpdate',
          layout: 'auto',
          compute: {
            module: device.createShaderModule({
              code: (
                `const SIZE: vec3i = vec3i(${ChunkData.size});\n`
                + ChunkUpdateCode
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
      update: [
        device.createBindGroup({
          layout: this.pipelines.update.getBindGroupLayout(0),
          entries: [
            {
              binding: 0,
              resource: ChunkData.getInputData(renderer),
            },
            {
              binding: 1,
              resource: this.data.createView(),
            },
            {
              binding: 2,
              resource: this.brush,
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
      Math.ceil(ChunkData.size / 8),
      Math.ceil(ChunkData.size / 8),
    );
    pass.setPipeline(pipelines.generator);
    for (let i = 0, l = bindings.generator.length; i < l; i++) {
      pass.setBindGroup(i, bindings.generator[i]);
    }
    pass.dispatchWorkgroups(
      Math.ceil(ChunkData.size / 4),
      Math.ceil(ChunkData.size / 4),
      Math.ceil(ChunkData.size / 4),
    );
    this.needsUpdate = false;
  }

  update(brush: {
    position: vec3;
    radius: number;
  } & (
    { color: vec3; erase?: false }
    | { erase: true }
  )) {
    const { bindings, brush: buffer, data, pipelines, renderer } = this;
    const device = renderer.getDevice();
    device.queue.writeBuffer(buffer, 0, new Float32Array([
      brush.position[0] + 1, brush.position[1] + 1, brush.position[2] + 1,
      brush.radius,
      ...(brush.erase ? [0.0, 0.0, 0.0] : [brush.color[0], brush.color[1], brush.color[2]]),
      brush.erase ? 1.0 : 0.0,
    ]));
    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyTextureToTexture(
      { texture: data },
      { texture: ChunkData.getInputData(renderer) },
      { width: ChunkData.size, height: ChunkData.size, depthOrArrayLayers: ChunkData.size }
    );
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipelines.update);
    for (let i = 0, l = bindings.update.length; i < l; i++) {
      passEncoder.setBindGroup(i, bindings.update[i]);
    }
    passEncoder.dispatchWorkgroups(
      Math.ceil((brush.radius * 2 + 1) / 4),
      Math.ceil((brush.radius * 2 + 1) / 4),
      Math.ceil((brush.radius * 2 + 1) / 4)
    );
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
  }
}
