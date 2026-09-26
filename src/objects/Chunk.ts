import { vec3 } from 'gl-matrix';
import { ChunkData } from 'compute/ChunkData';
import ChunkRaycasterCode from 'compute/ChunkRaycaster.wgsl';
import ChunkRaymarchCode from 'compute/ChunkRaymarch.wgsl';
import { type Intersection, type Ray, GPURay } from 'compute/Raycaster';
import ChunkMaterialCode from 'objects/ChunkMaterial.wgsl';
import { CameraGPUStruct } from 'render/Camera';
import { Material } from 'render/Material';
import { Mesh, TransformGPUStruct } from 'render/Mesh';
import type { Renderer } from 'render/Renderer';

export class Chunk extends Mesh {
  private static material?: Material;
  private static getMaterial(renderer: Renderer) {
    if (!Chunk.material) {
      Chunk.material = new Material({
        renderer,
        key: 'ChunkMaterial',
        code: (
          CameraGPUStruct
          + TransformGPUStruct
          + Chunk.getRaymarchCode()
          + ChunkMaterialCode
        ),
        cullMode: 'front',
      });
    }
    return Chunk.material;
  }

  private static getRaymarchCode() {
    let code = (
      `const SAMPLE_OFFSET: vec3f = vec3f(1.0 / ${ChunkData.size + 2}, 1.0 / ${ChunkData.subChunks}, 1.0 / ${ChunkData.size + 2});\n`
      + `const SAMPLE_SCALE: vec3f = vec3f(${ChunkData.size}) / vec3f(${ChunkData.size + 2}, ${ChunkData.size * ChunkData.subChunks}, ${ChunkData.size + 2});\n`
      + ChunkRaymarchCode
    );
    return code;
  }

  private static samplers?: { data: GPUSampler, texture: GPUSampler };
  private static getSamplers(renderer: Renderer) {
    if (!Chunk.samplers) {
      Chunk.samplers = {
        data: renderer.getDevice().createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
        }),
        texture: renderer.getDevice().createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
        }),
      };
    }
    return Chunk.samplers;
  }

  private readonly data: ChunkData;
  private readonly dataSubchunk: GPUBuffer;

  constructor(renderer: Renderer, data: ChunkData, position: vec3, scale: vec3) {
    const device = renderer.getDevice();
    const samplers = Chunk.getSamplers(renderer);
    const dataSubchunk = device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    new Float32Array(dataSubchunk.getMappedRange()).set([position[1]]);
    dataSubchunk.unmap();
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
            resource: dataSubchunk,
          },
          {
            binding: 3,
            resource: renderer.getTexture('BRDF').createView(),
          },
          {
            binding: 4,
            resource: renderer.getTexture('Irradiance').createView({ dimension: 'cube' }),
          },
          {
            binding: 5,
            resource: renderer.getTexture('Prefiltered').createView({ dimension: 'cube' }),
          },
          {
            binding: 6,
            resource: samplers.texture,
          },
        ],
      }]
    );
    this.data = data;
    this.dataSubchunk = dataSubchunk;
    this.position = vec3.fromValues(
      position[0] * scale[0],
      position[1] * scale[1] + scale[1] * 0.5,
      position[2] * scale[2]
    );
    this.scale = scale;
  }

  override destroy() {
    const { dataSubchunk } = this;
    dataSubchunk.destroy();
    super.destroy();
  }

  private static readonly aux4 = vec3.create();
  private static readonly gpuRays: GPURay[] = [];
  override async raycast(ray: Ray, intersections: Intersection[]) {
    const { data, dataSubchunk, renderer } = this;
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
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, device.createBindGroup({
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
          resource: dataSubchunk,
        },
        {
          binding: 3,
          resource: gpuRay.getInput(),
        },
      ],
    }));
    pass.dispatchWorkgroups(1);
    pass.end();
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
