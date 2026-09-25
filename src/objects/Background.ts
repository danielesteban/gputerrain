import { vec3 } from 'gl-matrix';
import BackgroundMaterialCode from 'objects/BackgroundMaterial.wgsl';
import { Material } from 'render/Material';
import { Mesh } from 'render/Mesh';
import type { Renderer } from 'render/Renderer';

export class Background extends Mesh {
  private static material?: Material;
  private static getMaterial(renderer: Renderer) {
    if (!Background.material) {
      Background.material = new Material({
        renderer,
        key: 'BackgroundMaterial',
        code: BackgroundMaterialCode,
        cullMode: 'front',
        depth: false,
        multisample: false,
      });
    }
    return Background.material;
  }

  private static noise?: GPUTexture;
  private static getNoise(renderer: Renderer) {
    if (!Background.noise) {
      const size = 256;
      const data = new Float32Array(size * size);
      for (let i = 0; i < size * size; i++) {
        data[i] = Math.random();
      }
      const device = renderer.getDevice();
      const texture = device.createTexture({
        size: [size, size],
        format: 'r32float',
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
      });
      device.queue.writeTexture({ texture }, data, { bytesPerRow: size * 4 }, [size, size]);
      Background.noise = texture;
    }
    return Background.noise;
  }

  private static samplers?: { noise: GPUSampler };
  private static getSamplers(renderer: Renderer) {
    if (!Background.samplers) {
      Background.samplers = {
        noise: renderer.getDevice().createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
          addressModeU: 'repeat',
          addressModeV: 'repeat',
        }),
      };
    }
    return Background.samplers;
  }

  constructor(renderer: Renderer) {
    const samplers = Background.getSamplers(renderer);
    super(
      renderer,
      renderer.getDefaultGeometry('Sphere'),
      Background.getMaterial(renderer),
      [{
        entries: [
          {
            binding: 0,
            resource: Background.getNoise(renderer).createView(),
          },
          {
            binding: 1,
            resource: samplers.noise,
          },
        ],
      }],
    );
    this.scale = vec3.fromValues(2048, 2048, 2048);
  }

  override animate(delta: number, time: number) {
    const { renderer } = this;
    const camera = renderer.getCamera();
    this.position = camera.position;
    super.animate(delta, time);
  }
}
