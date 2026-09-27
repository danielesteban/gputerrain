import { vec3 } from 'gl-matrix';
import { RainData } from 'compute/RainData';
import RainMaterialCode from 'objects/RainMaterial.wgsl';
import type { World } from 'objects/World';
import { CameraGPUStruct } from 'render/Camera';
import { Geometry } from 'render/Geometry';
import { Material } from 'render/Material';
import { Mesh, TransformGPUStruct } from 'render/Mesh';
import type { Renderer } from 'render/Renderer';
import type { SFX } from 'sounds/SFX';

export class Rain extends Mesh {
  private static material?: Material;
  private static getMaterial(renderer: Renderer) {
    if (!Rain.material) {
      Rain.material = new Material({
        renderer,
        key: 'RainMaterial',
        code: (
          CameraGPUStruct
          + TransformGPUStruct
          + RainMaterialCode
        ),
        blend: {
          color: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
          },
          alpha: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
          },
        },
        buffers: [
          Geometry.GPUVertexLayout,
          {
            arrayStride: 16,
            stepMode: 'instance',
            attributes: [
              {
                shaderLocation: 3,
                offset: 0,
                format: 'float32x3',
              },
            ]
          },
        ],
      });
    }
    return Rain.material;
  }

  private readonly data: RainData;
  private readonly sfx: SFX;

  constructor(renderer: Renderer, sfx: SFX, world: World) {
    const data = new RainData(renderer, world);
    super(
      renderer,
      renderer.getDefaultGeometry('Box'),
      Rain.getMaterial(renderer),
      undefined,
      [data.getInstances()],
    );
    this.data = data;
    this.frustumCulled = false;
    this.instanceCount = RainData.instanceCount;
    this.renderOrder = 10;
    this.scale = vec3.fromValues(0.1, 1.0, 0.1);
    this.sfx = sfx;
    this.visible = false;
  }

  override destroy() {
    const { data } = this;
    data.destroy();
    super.destroy();
  }

  get enabled() {
    return this.visible;
  }

  set enabled(value: boolean) {
    const { sfx } = this;
    this.visible = value;
    sfx.setAmbient('rain', value);
  }

  getData() {
    return this.data;
  }
  
  override animate(delta: number, time: number) {
    const { data } = this;
    data.animate(delta, time);
    super.animate(delta, time);
  }

  compute(pass: GPUComputePassEncoder) {
    const { data } = this;
    data.compute(pass);
  }
}
