import { vec3 } from 'gl-matrix';
import type { Sphere } from 'math/Sphere';
import { Background } from 'objects/Background';
import { Camera } from 'render/Camera';
import { Geometry } from 'render/Geometry';
import { Postprocessing } from 'render/Postprocessing';
import * as Primitives from 'render/Primitives';
import { BRDF } from 'textures/BRDF';
import { Cubemap } from 'textures/Cubemap';
import { Irradiance } from 'textures/Irradiance';
import { Prefiltered } from 'textures/Prefiltered';

export class Renderer {
  static async create(canvas: HTMLCanvasElement, sampleCount: number = 4) {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported");
    }
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
    if (!adapter) {
      throw new Error("Couldn't get GPUAdapter");
    }
    const device = await adapter.requestDevice({
      requiredFeatures: ['float32-filterable'],
    });
    if (!device) {
      throw new Error("Couldn't get GPUDevice");
    }
    return new Renderer(canvas, sampleCount, device);
  }

  private readonly background: Background;
  private readonly camera: Camera;
  private readonly canvas: HTMLCanvasElement;
  private readonly colorFormat: GPUTextureFormat;
  private readonly context: GPUCanvasContext;
  private readonly depthFormat: GPUTextureFormat = 'depth24plus';
  private readonly device: GPUDevice;
  private readonly geometries = new Map<string, Geometry>();
  private readonly objects: {
    animate?: (delta: number, time: number) => void;
    compute?: (pass: GPUComputePassEncoder) => void;
    destroy?: () => void;
    frustumCulled?: boolean;
    getBounds?: () => Sphere;
    render?: (pass: GPURenderPassEncoder) => void;
    renderOrder?: number;
  }[] = [];
  private readonly pipelines = {
    compute: new Map<string, GPUComputePipeline>(),
    render: new Map<string, GPURenderPipeline>(),
  };
  private readonly postprocessing: Postprocessing;
  private readonly sampleCount;
  private readonly size = { width: 0, height: 0 };
  private readonly textures: {
    BRDF: GPUTexture,
    Environment: GPUTexture;
    Irradiance: GPUTexture;
    Prefiltered: GPUTexture;
    depth: GPUTexture;
    output: GPUTexture;
  } = {
    BRDF: null!,
    Environment: null!,
    Irradiance: null!,
    Prefiltered: null!,
    depth: null!,
    output: null!,
  };

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
    this.background = new Background(this);
    this.postprocessing = new Postprocessing(this);
    this.textures.BRDF = BRDF(device);
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

  getTexture(key: 'BRDF' | 'Irradiance' | 'Prefiltered') {
    // @dani @incomplete
    // Figure out a way to notify the consumer when this textures change
    return this.textures[key];
  }

  setEnvironment(image: { data: Float16Array; width: number; height: number }) {
    const { device, textures } = this;
    if (textures.Environment) {
      textures.Environment.destroy();
    }
    textures.Environment = Cubemap(device, image);
    if (textures.Irradiance) {
      textures.Irradiance.destroy();
    }
    textures.Irradiance = Irradiance(device, textures.Environment);
    if (textures.Prefiltered) {
      textures.Prefiltered.destroy();
    }
    textures.Prefiltered = Prefiltered(device, textures.Environment);
  }

  setSize(width: number, height: number, scale = 1, pixelRatio = window.devicePixelRatio) {
    const {
      camera,
      canvas,
      colorFormat,
      depthFormat,
      device,
      postprocessing,
      sampleCount,
      size,
      textures,
    } = this;
    size.width = Math.ceil(width * pixelRatio);
    size.height = Math.ceil(height * pixelRatio);
    camera.aspect = size.width / size.height;
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    if (textures.depth) {
      textures.depth.destroy();
    }
    textures.depth = device.createTexture({
      size: [size.width * scale, size.height * scale],
      sampleCount,
      format: depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    if (textures.output) {
      textures.output.destroy();
    }
    if (sampleCount > 1) {
      textures.output = device.createTexture({
        size: [size.width * scale, size.height * scale],
        sampleCount,
        format: colorFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }
    postprocessing.setSize(size.width, size.height, scale, pixelRatio);
    return this;
  }

  addObject(obj: typeof this.objects[0]) {
    this.objects.push(obj);
    return this;
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
    return this;
  }

  animate(delta: number, time: number) {
    const { background, camera, objects } = this;
    camera.update();
    background.animate(delta, time);
    objects.forEach((obj) => obj.animate?.(delta, time));
    return this;
  }

  compute() {
    const { device, objects } = this;
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    objects.forEach((obj) => obj.compute?.(passEncoder));
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
    return this;
  }

  render() {
    const { background, camera, context, device, objects, postprocessing, textures } = this;
    const commandEncoder = device.createCommandEncoder();
    const backgroundPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: postprocessing.getBackground().createView(),
          clearValue: [0, 0, 0, 0],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    background.render(backgroundPassEncoder);
    backgroundPassEncoder.end();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          ...(textures.output ? {
            view: textures.output.createView(),
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
        view: textures.depth.createView(),
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
    return this;
  }
}
