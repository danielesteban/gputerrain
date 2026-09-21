import { Camera } from 'render/Camera';
import { Mesh } from 'render/Mesh';
import type { Geometry } from 'render/Geometry';
import type { Renderer } from 'render/Renderer';

export class Material {
  private readonly pipeline: GPURenderPipeline;

  constructor({
    renderer,
    key,
    code,
    buffers = [{
      arrayStride: 12,
      attributes: [
        {
          shaderLocation: 0,
          offset: 0,
          format: 'float32x3',
        },
      ],
    }],
    cullMode = 'back',
  }: {
    renderer: Renderer,
    key: string,
    code: string,
    buffers?: GPUVertexBufferLayout[],
    cullMode?: GPUCullMode,
  }) {
    this.pipeline = renderer.getRenderPipeline(key, () => {
      const device = renderer.getDevice();
      const module = device.createShaderModule({
        code: (
          // @dani @incomplete
          // Make this configurable/optional
          Camera.GPUStruct + '\n'
          + Mesh.GPUStruct + '\n'
          + code
        ),
      });
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
        depthStencil: {
          depthWriteEnabled: true,
          depthCompare: 'less',
          format: renderer.getDepthFormat(),
        },
        multisample: {
          count: renderer.getSampleCount(),
        },
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
    pass.setIndexBuffer(geometry.getIndex(), 'uint32');
    pass.drawIndexed(geometry.getIndexCount());
  }
}
