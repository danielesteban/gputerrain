import { glMatrix, mat4, vec3 } from 'gl-matrix';
import CubemapCode from 'textures/Cubemap.wgsl';

export const Cubemap = (
  device: GPUDevice,
  image: { data: Float16Array; width: number; height: number },
  size = 512
) => {
  const module = device.createShaderModule({
    code: (
      CubemapVertices
      + CubemapCode
    ),
  });
  const pipeline = device.createRenderPipeline({
    label: 'CubemapTexture',
    layout: 'auto',
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: 'rgba16float' }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
  const input = device.createTexture({
    size: [image.width, image.height],
    format: 'rgba16float',
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
  });
  device.queue.writeTexture(
    { texture: input },
    image.data.buffer,
    { bytesPerRow: image.width * 4 * 2 },
    { width: image.width, height: image.height },
  );
  const texture = device.createTexture({
    dimension: '2d',
    size: [size, size, 6],
    format: 'rgba16float',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  const transform = device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const bindings = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: input.createView(),
      },
      {
        binding: 1,
        resource: device.createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
        }),
      },
      {
        binding: 2,
        resource: transform,
      },
    ],
  });
  const projection = mat4.perspective(mat4.create(), glMatrix.toRadian(90), 1, 0.1, 10);
  const matrix = mat4.create();
  for (let i = 0; i < 6; i++) {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: texture.createView({
            arrayLayerCount: 1,
            baseArrayLayer: i,
          }),
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    device.queue.writeBuffer(transform, 0, mat4.multiply(matrix, projection, CubemapViews[i]) as Float32Array);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.setViewport(0, 0, size, size, 0, 1);
    pass.draw(36);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }
  input.destroy();
  transform.destroy();
  return texture;
};

export const CubemapVertices = /* wgsl */`
  const CubemapVertices = array(
    vec3f(-1.0, -1.0, -1.0),
    vec3f(1.0, -1.0, -1.0),
    vec3f(1.0, -1.0, 1.0),
    vec3f(1.0, -1.0, 1.0),
    vec3f(-1.0, -1.0, 1.0),
    vec3f(-1.0, -1.0, -1.0),
  
    vec3f(1.0, 1.0, 1.0),
    vec3f(1.0, -1.0, -1.0),
    vec3f(1.0, 1.0, -1.0),
    vec3f(1.0, -1.0, -1.0),
    vec3f(1.0, 1.0, 1.0),
    vec3f(1.0, -1.0, 1.0),

    vec3f(-1.0, 1.0, -1.0),
    vec3f(1.0, 1.0, 1.0),
    vec3f(1.0, 1.0, -1.0),
    vec3f(1.0, 1.0, 1.0),
    vec3f(-1.0, 1.0, -1.0),
    vec3f(-1.0, 1.0, 1.0),

    vec3f(-1.0, 1.0, 1.0),
    vec3f(-1.0, 1.0, -1.0),
    vec3f(-1.0, -1.0, -1.0),
    vec3f(-1.0, -1.0, -1.0),
    vec3f(-1.0, -1.0, 1.0),
    vec3f(-1.0, 1.0, 1.0),

    vec3f(-1.0, -1.0, 1.0),
    vec3f(1.0, -1.0, 1.0),
    vec3f(1.0, 1.0, 1.0),
    vec3f(1.0, 1.0, 1.0),
    vec3f(-1.0, 1.0, 1.0),
    vec3f(-1.0, -1.0, 1.0),

    vec3f(-1.0, -1.0, -1.0),
    vec3f(1.0, 1.0, -1.0),
    vec3f(1.0, -1.0, -1.0),
    vec3f(1.0, 1.0, -1.0),
    vec3f(-1.0, -1.0, -1.0),
    vec3f(-1.0, 1.0, -1.0),
  );
`;

export const CubemapViews = [
  mat4.lookAt(
    mat4.create(),
    vec3.fromValues(0.0, 0.0, 0.0),
    vec3.fromValues(1.0, 0.0, 0.0),
    vec3.fromValues(0.0, -1.0, 0.0)
  ),
  mat4.lookAt(
    mat4.create(),
    vec3.fromValues(0.0, 0.0, 0.0),
    vec3.fromValues(-1.0, 0.0, 0.0),
    vec3.fromValues(0.0, -1.0, 0.0)
  ),
  mat4.lookAt(
    mat4.create(),
    vec3.fromValues(0.0, 0.0, 0.0),
    vec3.fromValues(0.0, -1.0, 0.0),
    vec3.fromValues(0.0, 0.0, -1.0)
  ),
  mat4.lookAt(
    mat4.create(),
    vec3.fromValues(0.0, 0.0, 0.0),
    vec3.fromValues(0.0, 1.0, 0.0),
    vec3.fromValues(0.0, 0.0, 1.0)
  ),
  mat4.lookAt(
    mat4.create(),
    vec3.fromValues(0.0, 0.0, 0.0),
    vec3.fromValues(0.0, 0.0, 1.0),
    vec3.fromValues(0.0, -1.0, 0.0)
  ),
  mat4.lookAt(
    mat4.create(),
    vec3.fromValues(0.0, 0.0, 0.0),
    vec3.fromValues(0.0, 0.0, -1.0),
    vec3.fromValues(0.0, -1.0, 0.0)
  ),
];
