import { vec3 } from 'gl-matrix';
import { ChunkGenerator } from 'compute/ChunkGenerator';
import { Irradiance } from 'compute/Irradiance';
import type { Intersection, Ray } from 'compute/Raycaster';
import { Material } from 'render/Material';
import { Mesh } from 'render/Mesh';
import type { Renderer } from 'render/Renderer';
import ChunkMaterialCode from 'objects/Chunk.wgsl';

export class Chunk extends Mesh {
  private static material?: Material;
  private static getMaterial(renderer: Renderer) {
    if (!Chunk.material) {
      let code = (
        `const SAMPLE_OFFSET = 1.0 / vec3f(${ChunkGenerator.size});\n`
        + `const SAMPLE_SCALE = vec3f(${ChunkGenerator.size - 2}) / vec3f(${ChunkGenerator.size});\n`
        + ChunkMaterialCode
      );
      if (navigator.userAgent.toLowerCase().indexOf('firefox') !== -1) {
        code = code.replace(/@diagnostic\(off,derivative_uniformity\)/g, '');
      }
      Chunk.material = new Material({ renderer, key: 'ChunkMaterial', code, cullMode: 'front' });
    }
    return Chunk.material;
  }

  private static irradiance?: GPUTextureView;
  private static getIrradiance(renderer: Renderer) {
    if (!Chunk.irradiance) {
      Chunk.irradiance = Irradiance(renderer.getDevice());
    }
    return Chunk.irradiance;
  }

  private static samplers?: { data: GPUSampler, irradiance: GPUSampler };
  private static getSamplers(renderer: Renderer) {
    if (!Chunk.samplers) {
      Chunk.samplers = {
        data: renderer.getDevice().createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
          mipmapFilter: 'linear',
          maxAnisotropy: 16,
        }),
        irradiance: renderer.getDevice().createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
        }),
      };
    }
    return Chunk.samplers;
  }

  private readonly id: vec3;
  private readonly generator: ChunkGenerator;

  constructor(renderer: Renderer, generator: ChunkGenerator, position: vec3, scale: vec3) {
    const samplers = Chunk.getSamplers(renderer);
    super(
      renderer,
      renderer.getDefaultGeometry('Box'),
      Chunk.getMaterial(renderer),
      [{
        entries: [
          {
            binding: 0,
            resource: generator.getData().createView(),
          },
          {
            binding: 1,
            resource: samplers.data,
          },
          {
            binding: 2,
            resource: Chunk.getIrradiance(renderer),
          },
          {
            binding: 3,
            resource: samplers.irradiance,
          },
        ],
      }]
    );
    generator.setPosition(position);
    this.id = position;
    this.generator = generator;
    this.position = vec3.fromValues(
      position[0] * scale[0],
      position[1] * scale[1] + scale[1] * 0.5,
      position[2] * scale[2]
    );
    this.scale = scale;
  }

  getId() {
    return this.id;
  }

  getGenerator() {
    return this.generator;
  }

  compute(pass: GPUComputePassEncoder) {
    const { generator } = this;
    generator.compute(pass);
  }

  override async raycast(ray: Ray, _intersections: Intersection[]) {
    const bounds = this.getBounds();
    if (!ray.intersectSphere(bounds)) {
      return;
    }
    // TODO!!
    // Raycast the generator.getData() in a compute shader
  }
}
