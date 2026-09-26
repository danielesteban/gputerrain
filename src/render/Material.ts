import { Geometry } from 'render/Geometry';
import type { Renderer } from 'render/Renderer';

export class Material {
  private readonly pipeline: GPURenderPipeline;

  constructor({
    renderer,
    key,
    code,
    blend,
    buffers = [Geometry.GPUVertexLayout],
    cullMode = 'back',
    depth = true,
    multisample = true,
  }: {
    renderer: Renderer;
    key: string;
    code: string;
    blend?: GPUBlendState;
    buffers?: GPUVertexBufferLayout[];
    cullMode?: GPUCullMode;
    depth?: boolean;
    instanceCount?: number;
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
          targets: [{
            blend,
            format: renderer.getColorFormat(),
          }],
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

  render(
    pass: GPURenderPassEncoder,
    bindings: GPUBindGroup[],
    buffers: GPUBuffer[],
    geometry: Geometry,
    instanceCount: number
  ) {
    const { pipeline } = this;
    pass.setPipeline(pipeline);
    for (let i = 0, l = bindings.length; i < l; i++) {
      pass.setBindGroup(i, bindings[i]);
    }
    pass.setIndexBuffer(geometry.getIndex(), 'uint16');
    pass.setVertexBuffer(0, geometry.getVertices());
    for (let i = 0, l = buffers.length; i < l; i++) {
      pass.setVertexBuffer(i + 1, buffers[i]);
    }
    pass.drawIndexed(geometry.getIndexCount(), instanceCount);
  }
}
