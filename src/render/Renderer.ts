import { vec3 } from 'gl-matrix';
import * as Primitives from 'compute/Primitives';
import { Camera } from 'render/Camera';
import { Geometry } from 'render/Geometry';
import { Postprocessing } from 'render/Postprocessing';
import type { Sphere } from 'compute/Sphere';

export class Renderer {
  static async create(canvas: HTMLCanvasElement, sampleCount: number = 4) {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("Couldn't get GPUAdapter");
    }
    const device = await adapter.requestDevice();
    if (!device) {
      throw new Error("Couldn't get GPUDevice");
    }
    return new Renderer(canvas, sampleCount, device);
  }

  private readonly camera: Camera;
  private readonly canvas: HTMLCanvasElement;
  private readonly colorFormat: GPUTextureFormat;
  private readonly context: GPUCanvasContext;
  private readonly depthFormat: GPUTextureFormat = 'depth24plus';
  private depth: GPUTexture = null!;
  private readonly device: GPUDevice;
  private readonly geometries = new Map<string, Geometry>();
  private readonly objects: {
    animate?: (camera: Camera, delta: number, time: number) => void;
    compute?: (pass: GPUComputePassEncoder) => void;
    destroy?: () => void;
    frustumCulled?: boolean;
    getBounds?: () => Sphere;
    render?: (pass: GPURenderPassEncoder) => void;
    renderOrder?: number;
  }[] = [];
  private output: GPUTexture = null!;
  private readonly pipelines = {
    compute: new Map<string, GPUComputePipeline>(),
    render: new Map<string, GPURenderPipeline>(),
  };
  private readonly postprocessing: Postprocessing;
  private readonly sampleCount;
  private readonly size = { width: 0, height: 0 };

  constructor(canvas: HTMLCanvasElement, sampleCount: number, device: GPUDevice) {
    const context = canvas.getContext('webgpu');
    if (!context) {
      throw new Error("Couldn't get GPUCanvasContext");
    }
    this.camera = new Camera(device);
    this.canvas = canvas;
    this.context = context;
    this.device = device;
    this.colorFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      alphaMode: 'premultiplied',
      device,
      format: this.colorFormat,
    });
    this.sampleCount = sampleCount;
    this.postprocessing = new Postprocessing(this);
  }

  destroy() {
    this.device.destroy();
  }

  getCamera() {
    return this.camera;
  }

  getCanvas() {
    return this.canvas;
  }

  getColorFormat() {
    return this.colorFormat;
  }

  getDepthFormat() {
    return this.depthFormat;
  }
  
  getDevice() {
    return this.device;
  }

  getSampleCount() {
    return this.sampleCount;
  }

  getDefaultGeometry(key: keyof typeof Primitives) {
    return this.getGeometry('Default' + key, () => new Geometry(this, Primitives[key]));
  }

  getGeometry(key: string, create: () => Geometry) {
    const { geometries } = this;
    let geometry = geometries.get(key);
    if (!geometry) {
      geometry = create();
      geometries.set(key, geometry);
    }
    return geometry;
  }

  getComputePipeline(key: string, create: () => GPUComputePipeline) {
    const { pipelines } = this;
    let pipeline = pipelines.compute.get(key);
    if (!pipeline) {
      pipeline = create();
      pipelines.compute.set(key, pipeline);
    }
    return pipeline;
  }

  getRenderPipeline(key: string, create: () => GPURenderPipeline) {
    const { pipelines } = this;
    let pipeline = pipelines.render.get(key);
    if (!pipeline) {
      pipeline = create();
      pipelines.render.set(key, pipeline);
    }
    return pipeline;
  }

  setSize(width: number, height: number) {
    const {
      camera,
      canvas,
      colorFormat,
      depthFormat,
      device,
      postprocessing,
      sampleCount,
      size,
    } = this;
    size.width = Math.ceil(window.innerWidth * window.devicePixelRatio);
    size.height = Math.ceil(window.innerHeight * window.devicePixelRatio);
    camera.aspect = size.width / size.height;
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    if (this.depth) {
      this.depth.destroy();
    }
    this.depth = device.createTexture({
      size: [size.width, size.height],
      sampleCount,
      format: depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    if (this.output) {
      this.output.destroy();
    }
    if (sampleCount > 1) {
      this.output = device.createTexture({
        size: [size.width, size.height],
        sampleCount,
        format: colorFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
    postprocessing.setSize(size.width, size.height);
  }

  addObject(obj: typeof this.objects[0]) {
    this.objects.push(obj);
  }

  removeObject(obj: typeof this.objects[0], destroy = true) {
    const { objects } = this;
    const index = objects.indexOf(obj);
    if (index !== -1) {
      objects.splice(index, 1);
    }
    if (destroy) {
      obj.destroy?.();
    }
  }

  animate(delta: number, time: number) {
    const { camera, objects } = this;
    objects.forEach((obj) => obj.animate?.(camera, delta, time));
  }

  compute() {
    const { device, objects } = this;
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    objects.forEach((obj) => obj.compute?.(passEncoder));
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
  }

  render() {
    const { camera, context, depth, device, objects, output, postprocessing } = this;
    camera.update();
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          ...(output ? {
            view: output.createView(),
            resolveTarget: postprocessing.getInput().createView(),
          } : {
            view: postprocessing.getInput().createView(),
          }),
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: depth.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });
    objects
      .filter((obj) => (
        'render' in obj
        && (
          !obj.frustumCulled
          || !('getBounds' in obj)
          || camera.getFrustum().intersects(obj.getBounds!())
        )
      ))
      .map((obj) => ({
        obj,
        dist: (
          obj.getBounds?.().center
          ? vec3.sqrDist(obj.getBounds?.().center, camera.position)
          : 0
        ),
      }))
      .sort((a, b) => (
        (a.obj.renderOrder || 0) - (b.obj.renderOrder || 0)
        || a.dist - b.dist
      ))
      .forEach(({ obj }) => obj.render?.(passEncoder));
    passEncoder.end();
    postprocessing.render(commandEncoder, context.getCurrentTexture().createView());
    device.queue.submit([commandEncoder.finish()]);
  }
}
