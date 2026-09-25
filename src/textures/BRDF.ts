import BRDFCode from 'textures/BRDF.wgsl';
import PBRCode from 'textures/PBR.wgsl';

export const BRDF = (device: GPUDevice, size = 512) => {
  const texture = device.createTexture({
    size: [size, size],
    format: 'rg16float',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  const module = device.createShaderModule({
    code: (
      `const PI: f32 = ${Math.PI};`
      + PBRCode
      + BRDFCode
    ),
  });
  const pipeline = device.createRenderPipeline({
    label: 'BRDFTexture',
    layout: 'auto',
    vertex: {
      module,
    },
    fragment: {
      module,
      targets: [{ format: 'rg16float' }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: texture.createView(),
        clearValue: [0, 0, 0, 0],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  });
  pass.setPipeline(pipeline);
  pass.draw(6);
  pass.end();
  device.queue.submit([encoder.finish()]);
  return texture;
};
