import { mat4, vec3 } from 'gl-matrix';

export class Sphere {
  readonly center = vec3.fromValues(0, 0, 0);
  radius = -1;

  isEmpty() {
		return this.radius < 0;
	}

  makeEmpty() {
    vec3.set(this.center, 0, 0, 0);
    this.radius = -1;
		return this;
	}

  copy(sphere: Sphere) {
		vec3.copy(this.center, sphere.center);
    this.radius = sphere.radius;
		return this;
	}

  applyMatrix(matrix: mat4) {
    vec3.transformMat4(this.center, this.center, matrix);
    const scaleXSq = matrix[0] * matrix[0] + matrix[1] * matrix[1] + matrix[2] * matrix[2];
    const scaleYSq = matrix[4] * matrix[4] + matrix[5] * matrix[5] + matrix[6] * matrix[6];
    const scaleZSq = matrix[8] * matrix[8] + matrix[9] * matrix[9] + matrix[10] * matrix[10];
    this.radius = this.radius * Math.sqrt(Math.max(scaleXSq, scaleYSq, scaleZSq));
		return this;
	}

  containsPoint(point: vec3) {
		return vec3.sqrDist(point, this.center) <= (this.radius * this.radius);
	}

  private static readonly aux1 = vec3.create();
  private static readonly aux2 = vec3.create();
  union(sphere: Sphere) {
    if (sphere.isEmpty()) {
			return this;
		}

    if (this.isEmpty()) {
			this.copy(sphere);
			return this;
		}

    if (vec3.exactEquals(this.center, sphere.center)) {
      this.radius = Math.max(this.radius, sphere.radius);
    } else {
      vec3.sub(Sphere.aux2, sphere.center, this.center);
      vec3.normalize(Sphere.aux2, Sphere.aux2);
      vec3.scale(Sphere.aux2, Sphere.aux2, sphere.radius);
			this.expandByPoint(vec3.add(Sphere.aux1, sphere.center, Sphere.aux2));
			this.expandByPoint(vec3.sub(Sphere.aux1, sphere.center, Sphere.aux2));
    }

    return this;
  }

  private static readonly aux3 = vec3.create();
  expandByPoint(point: vec3) {
    if (this.isEmpty()) {
      vec3.copy(this.center, point);
			this.radius = 0;
			return this;
		}

    vec3.sub(Sphere.aux3, point, this.center);
    const lengthSq = vec3.sqrLen(Sphere.aux3);
    if (lengthSq > (this.radius * this.radius)) {
      const length = Math.sqrt(lengthSq);
      const delta = ( length - this.radius ) * 0.5;
      vec3.scaleAndAdd(this.center, this.center, Sphere.aux3, delta / length);
      this.radius += delta;
    }

    return this;
  }
}
