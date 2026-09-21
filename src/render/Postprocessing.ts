import PostprocessingCode from 'render/Postprocessing.wgsl';
import type { Renderer } from 'render/Renderer';

export class Postprocessing {
  private bindings: GPUBindGroup = null!;
  private background: GPUTexture = null!;
  private input: GPUTexture = null!;
  private readonly renderer: Renderer;
  private readonly pipeline: GPURenderPipeline;
  private readonly resolution: GPUBuffer;
  private readonly sampler: GPUSampler;

  constructor(renderer: Renderer) {
    const device = renderer.getDevice();
    this.renderer = renderer;
    this.pipeline = renderer.getRenderPipeline('Postprocessing', () => {
      const module = device.createShaderModule({
        code: PostprocessingCode,
      });
      return device.createRenderPipeline({
        label: 'Postprocessing',
        layout: 'auto',
        vertex: {
          module,
        },
        fragment: {
          module,
          targets: [{ format: renderer.getColorFormat() }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });
    });
    this.resolution = device.createBuffer({
      size: 2 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
    });
    this.sampler = device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
    });
  }

  getBackground() {
    return this.background;
  }

  getInput() {
    return this.input;
  }

  setSize(width: number, height: number) {
    const { renderer, pipeline, resolution, sampler } = this;
    const device = renderer.getDevice();
    if (this.background) {
      this.background.destroy();
    }
    this.background = device.createTexture({
      size: [width, height],
      format: renderer.getColorFormat(),
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    if (this.input) {
      this.input.destroy();
    }
    this.input = device.createTexture({
      size: [width, height],
      format: renderer.getColorFormat(),
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.bindings = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: this.background.createView(),
        },
        {
          binding: 1,
          resource: this.input.createView(),
        },
        {
          binding: 2,
          resource: sampler,
        },
        {
          binding: 3,
          resource: resolution,
        },
      ],
    });
    device.queue.writeBuffer(resolution, 0, new Float32Array([width, height]));
    return this;
  }

  render(command: GPUCommandEncoder, output: GPUTextureView) {
    const { bindings, pipeline } = this;
    const pass = command.beginRenderPass({
      colorAttachments: [
        {
          view: output,
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.draw(6);
    pass.end();
  }
}
