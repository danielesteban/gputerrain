import { vec3 } from 'gl-matrix';
import { ChunkData } from 'compute/ChunkData';
import ChunkRaycasterCode from 'compute/ChunkRaycaster.wgsl';
import ChunkRaymarchCode from 'compute/ChunkRaymarch.wgsl';
import { Irradiance } from 'compute/Irradiance';
import { type Intersection, type Ray, GPURay } from 'compute/Raycaster';
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
      `const SAMPLE_OFFSET = 1.0 / vec3f(${ChunkData.size});\n`
      + `const SAMPLE_SCALE = vec3f(${ChunkData.size - 2}) / vec3f(${ChunkData.size});\n`
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
  private readonly data: ChunkData;

  constructor(renderer: Renderer, data: ChunkData, position: vec3, scale: vec3) {
    const samplers = Chunk.getSamplers(renderer);
    super(
      renderer,
      renderer.getDefaultGeometry('Box'),
      Chunk.getMaterial(renderer),
      [{
        entries: [
          {
            binding: 0,
            resource: data.getData().createView(),
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
    data.setPosition(position);
    this.id = position;
    this.data = data;
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

  getData() {
    return this.data;
  }

  compute(pass: GPUComputePassEncoder) {
    const { data } = this;
    data.compute(pass);
  }

  private static readonly aux4 = vec3.create();
  private static readonly gpuRays: GPURay[] = [];
  override async raycast(ray: Ray, intersections: Intersection[]) {
    const { data, renderer } = this;
    const { aux4: origin, gpuRays } = Chunk;
    const bounds = this.getBounds();
    const transform = this.getTransform();
    if (!bounds.containsPoint(ray.origin)) {
      const distanceToBounds = ray.intersectSphere(bounds);
      if (!distanceToBounds || distanceToBounds > ray.maxDistance) {
        return;
      }
    }
    const device = renderer.getDevice();
    const pipeline = renderer.getComputePipeline('ChunkRaycaster', () => (
      device.createComputePipeline({
        label: 'ChunkRaycaster',
        layout: 'auto',
        compute: {
          module: device.createShaderModule({
            code: (
              GPURay.GPUStruct + '\n'
              + Chunk.getRaymarchCode()
              + ChunkRaycasterCode
            ),
          }),
        },
      })
    ));
    vec3.transformMat4(origin, ray.origin, transform.cpu.inverse);
    const gpuRay = gpuRays.pop() || new GPURay(device);
    gpuRay.setInput(origin, ray.direction);
    const samplers = Chunk.getSamplers(renderer);
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: data.getData().createView(),
        },
        {
          binding: 1,
          resource: samplers.data,
        },
        {
          binding: 2,
          resource: gpuRay.getInput(),
        },
      ],
    }));
    passEncoder.dispatchWorkgroups(1);
    passEncoder.end();
    gpuRay.copyInputToOutput(commandEncoder);
    device.queue.submit([commandEncoder.finish()]);
    const { position, normal } = await gpuRay.readOutput();
    gpuRays.push(gpuRay);
    if (position[0] === -1) {
      return;
    }
    vec3.transformMat4(position, position, transform.cpu.matrix);
    const distance = vec3.distance(ray.origin, position);
    if (distance > ray.maxDistance) {
      return;
    }
    intersections.push({
      distance,
      normal,
      obj: this,
    });
  }
}
