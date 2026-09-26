import { Geometry } from 'render/Geometry';
import type { Renderer } from 'render/Renderer';

export class Material {
  private readonly pipeline: GPURenderPipeline;

  constructor({
    renderer,
    key,
    code,
    buffers = [Geometry.GPUVertexLayout],
    cullMode = 'back',
    depth = true,
    multisample = true,
  }: {
    renderer: Renderer;
    key: string;
    code: string;
    buffers?: GPUVertexBufferLayout[];
    cullMode?: GPUCullMode;
    depth?: boolean;
    multisample?: boolean;
  }) {
    this.pipeline = renderer.getRenderPipeline(key, () => {
      const device = renderer.getDevice();
      const module = device.createShaderModule({ code });
      return device.createRenderPipeline({
        label: key,
        layout: 'auto',
        vertex: {
          module,
          buffers,
        },
        fragment: {
          module,
          targets: [{ format: renderer.getColorFormat() }],
        },
        primitive: {
          topology: 'triangle-list',
          cullMode,
        },
        ...(depth ? {
          depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: renderer.getDepthFormat(),
          },
        } : {}),
        ...(multisample ? {
          multisample: {
            count: renderer.getSampleCount(),
          },
        } : {}),
      });
    });
  }

  getPipeline() {
    return this.pipeline;
  }

  render(pass: GPURenderPassEncoder, bindings: GPUBindGroup[], geometry: Geometry) {
    const { pipeline } = this;
    pass.setPipeline(pipeline);
    for (let i = 0, l = bindings.length; i < l; i++) {
      pass.setBindGroup(i, bindings[i]);
    }
    pass.setVertexBuffer(0, geometry.getVertices());
    pass.setIndexBuffer(geometry.getIndex(), 'uint16');
    pass.drawIndexed(geometry.getIndexCount());
  }
}
