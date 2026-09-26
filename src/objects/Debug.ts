import DebugMaterialCode from 'objects/DebugMaterial.wgsl';
import { CameraGPUStruct } from 'render/Camera';
import { Material } from 'render/Material';
import { Mesh, TransformGPUStruct } from 'render/Mesh';
import type { Renderer } from 'render/Renderer';

export class Debug extends Mesh {
  private static material?: Material;
  private static getMaterial(renderer: Renderer) {
    if (!Debug.material) {
      Debug.material = new Material({
        renderer,
        key: 'DebugMaterial',
        code: (
          CameraGPUStruct
          + TransformGPUStruct
          + DebugMaterialCode
        ),
      });
    }
    return Debug.material;
  }

  constructor(renderer: Renderer) {
    super(
      renderer,
      renderer.getDefaultGeometry('Sphere'),
      Debug.getMaterial(renderer)
    );
    this.renderOrder = 1;
    this.visible = false;
  }
}
