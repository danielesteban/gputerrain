import { quat, vec3 } from 'gl-matrix';
import GridMaterialCode from 'objects/GridMaterial.wgsl';
import { Material } from 'render/Material';
import { Mesh } from 'render/Mesh';
import type { Renderer } from 'render/Renderer';

export class Grid extends Mesh {
  private static material?: Material;
  private static getMaterial(renderer: Renderer) {
    if (!Grid.material) {
      Grid.material = new Material({ renderer, key: 'GridMaterial', code: GridMaterialCode });
    }
    return Grid.material;
  }

  constructor(renderer: Renderer) {
    super(
      renderer,
      renderer.getDefaultGeometry('Plane'),
      Grid.getMaterial(renderer)
    );
    this.renderOrder = 1;
    this.rotation = quat.fromEuler(quat.create(), -90, 0, 0);
    this.scale = vec3.fromValues(512, 512, 1);
  }

  private static aux4 = vec3.create();
  override animate(delta: number, time: number) {
    const { renderer } = this;
    const { aux4: position } = Grid;
    const camera = renderer.getCamera();
    this.position = vec3.set(position, camera.position[0], 0, camera.position[2]);
    super.animate(delta, time);
  }
}
