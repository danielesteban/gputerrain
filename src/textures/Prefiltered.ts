import { glMatrix, mat4 } from 'gl-matrix';
import { CubemapVertices, CubemapViews } from 'textures/Cubemap';
import PBRCode from 'textures/PBR.wgsl';
import PrefilteredCode from 'textures/Prefiltered.wgsl';

export const Prefiltered = (
  device: GPUDevice,
  cubemap: GPUTexture,
  size = 256,
  levels = 5
) => {
  const module = device.createShaderModule({
    code: (
      `const PI: f32 = ${Math.PI};`
      + CubemapVertices
      + PBRCode
      + PrefilteredCode
    ),
  });
  const pipeline = device.createRenderPipeline({
    label: 'PrefilteredTexture',
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
    mipLevelCount: levels,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  const params = device.createBuffer({
    size: (16 + 4) * 4,
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
        resource: params,
      }
    ],
  });
  const projection = mat4.perspective(mat4.create(), glMatrix.toRadian(90), 1, 0.1, 10);
  const matrix = mat4.create();
  for (let mip = 0; mip < levels; mip += 1) {
    const width = texture.width >> mip;
    const height = texture.height >> mip;
    const roughness = mip / (levels - 1);
    for (let i = 0; i < 6; i++) {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: texture.createView({
              arrayLayerCount: 1,
              baseArrayLayer: i,
              mipLevelCount: 1,
              baseMipLevel: mip,
            }),
            clearValue: [0, 0, 0, 0],
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      device.queue.writeBuffer(params, 0, new Float32Array([
        ...mat4.multiply(matrix, projection, CubemapViews[i]),
        size,
        roughness,
      ]).buffer);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindings);
      pass.setViewport(0, 0, width, height, 0, 1);
      pass.draw(36);
      pass.end();
      device.queue.submit([encoder.finish()]);
    }
  }
  params.destroy();
  return texture;
};
