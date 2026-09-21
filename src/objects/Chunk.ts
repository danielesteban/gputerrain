import { vec3 } from 'gl-matrix';
import { ChunkGenerator } from 'compute/ChunkGenerator';
import ChunkRaycasterCode from 'compute/ChunkRaycaster.wgsl';
import ChunkRaymarchCode from 'compute/ChunkRaymarch.wgsl';
import { Irradiance } from 'compute/Irradiance';
import type { Intersection, Ray } from 'compute/Raycaster';
import ChunkMaterialCode from 'objects/ChunkMaterial.wgsl';
import { Material } from 'render/Material';
import { Mesh } from 'render/Mesh';
import type { Renderer } from 'render/Renderer';

export class Chunk extends Mesh {
  private static material?: Material;
  private static getMaterial(renderer: Renderer) {
    if (!Chunk.material) {
      Chunk.material = new Material({
        renderer,
        key: 'ChunkMaterial',
        code: (
          Chunk.getRaymarchCode()
          + ChunkMaterialCode
        ),
        cullMode: 'front',
      });
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

  private static getRaymarchCode() {
    let code = (
      `const SAMPLE_OFFSET = 1.0 / vec3f(${ChunkGenerator.size});\n`
      + `const SAMPLE_SCALE = vec3f(${ChunkGenerator.size - 2}) / vec3f(${ChunkGenerator.size});\n`
      + ChunkRaymarchCode
    );
    return code;
  }

  private static samplers?: { data: GPUSampler, irradiance: GPUSampler };
  private static getSamplers(renderer: Renderer) {
    if (!Chunk.samplers) {
      Chunk.samplers = {
        data: renderer.getDevice().createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
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

  private static aux4 = vec3.create();
  override async raycast(ray: Ray, intersections: Intersection[]) {
    const { generator, renderer } = this;
    const { aux4: origin } = Chunk;
    const bounds = this.getBounds();
    const transform = this.getTransform();
    if (!ray.intersectSphere(bounds)) {
      return;
    }
    const device = renderer.getDevice();
    const pipeline = renderer.getComputePipeline('ChunkRaycaster', () => (
      device.createComputePipeline({
        label: 'ChunkRaycaster',
        layout: 'auto',
        compute: {
          module: device.createShaderModule({
            code: (
              Chunk.getRaymarchCode()
              + ChunkRaycasterCode
            ),
          }),
        },
      })
    ));
    const samplers = Chunk.getSamplers(renderer);
    // @dani @incomplete
    // Try to pool/reuse this two buffers
    const query = device.createBuffer({
      size: (
        3 * 4 + 4
        + 3 * 4 + 4
        + 3 * 4 + 4
        + 3 * 4 + 4
      ),
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    vec3.transformMat4(origin, ray.origin, transform.cpu.inverse);
    new Float32Array(query.getMappedRange()).set([
      ...origin, 0,
      ...ray.direction, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    query.unmap();
    const output = device.createBuffer({
      size: (
        3 * 4 + 4
        + 3 * 4 + 4
      ),
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
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
          resource: query,
        },
      ],
    }));
    passEncoder.dispatchWorkgroups(1);
    passEncoder.end();
    commandEncoder.copyBufferToBuffer(
      query,
      (
        3 * 4 + 4
        + 3 * 4 + 4
      ),
      output,
      0,
      (
        3 * 4 + 4
        + 3 * 4 + 4
      )
    );
    device.queue.submit([commandEncoder.finish()]);
    await output.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(output.getMappedRange());
    const position = vec3.fromValues(result[0], result[1], result[2]);
    const normal = vec3.fromValues(result[4], result[5], result[6]);
    output.unmap();
    output.destroy();
    query.destroy();
    if (position[0] !== -1) {
      vec3.transformMat4(position, position, transform.cpu.matrix);
      intersections.push({
        distance: vec3.distance(ray.origin, position),
        normal,
        obj: this,
      });
    }
  }
}
