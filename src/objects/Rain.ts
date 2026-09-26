import { vec3 } from 'gl-matrix';
import { RainData } from 'compute/RainData';
import RainMaterialCode from 'objects/RainMaterial.wgsl';
import { Geometry } from 'render/Geometry';
import { CameraGPUStruct } from 'render/Camera';
import { Material } from 'render/Material';
import { Mesh, TransformGPUStruct } from 'render/Mesh';
import type { Renderer } from 'render/Renderer';

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

  constructor(renderer: Renderer) {
    const data = new RainData(renderer);
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
  }

  override destroy() {
    const { data } = this;
    data.destroy();
    super.destroy();
  }

  getData() {
    return this.data;
  }
}
