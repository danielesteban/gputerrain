import { glMatrix, mat4 } from 'gl-matrix';
import { CubemapVertices, CubemapViews } from 'textures/Cubemap';
import IrradianceCode from 'textures/Irradiance.wgsl';

export const Irradiance = (
  device: GPUDevice,
  cubemap: GPUTexture,
  size = 32
) => {
  const module = device.createShaderModule({
    code: (
      `const PI: f32 = ${Math.PI};`
      + CubemapVertices
      + IrradianceCode
    ),
  });
  const pipeline = device.createRenderPipeline({
    label: 'IrradianceTexture',
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
        resource: cubemap.createView({ dimension: 'cube' }),
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
  transform.destroy();
  return texture;
};
