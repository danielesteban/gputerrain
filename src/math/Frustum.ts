import { mat4, vec3 } from 'gl-matrix';
import type { Sphere } from 'math/Sphere';

export class Frustum {
  private readonly planes = Array.from({ length: 6 }, () => (new Plane()));

  intersects(sphere: Sphere) {
    const { planes } = this;
    const center = sphere.center;
    const negRadius = -sphere.radius;

    for (let i = 0; i < 6; i++) {
      const distance = planes[i].distanceToPoint(center);
      if (distance < negRadius) {
        return false;
      }
    }

    return true;
  }

  update(m: mat4) {
    const { planes } = this;
    planes[0].set(m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]).normalize();
    planes[1].set(m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]).normalize();
    planes[2].set(m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]).normalize();
    planes[3].set(m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]).normalize();
    planes[4].set(m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]).normalize(); 
    planes[5].set(m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]).normalize();
  }
}

class Plane {
  private readonly normal = vec3.create();
  private constant = 0;

  set(x: number, y: number, z: number, w: number) {
    vec3.set(this.normal, x, y, z);
    this.constant = w;
    return this;
  }

  normalize() {
    const inverseNormalLength = 1.0 / vec3.len(this.normal);
    vec3.scale(this.normal, this.normal, inverseNormalLength);
    this.constant *= inverseNormalLength;
    return this;
  }

  distanceToPoint(point: vec3) {
    return vec3.dot(this.normal, point) + this.constant;
  }
}
