import { mat4, vec3 } from 'gl-matrix';

export class Box {
  readonly min = vec3.fromValues(Infinity, Infinity, Infinity);
  readonly max = vec3.fromValues(-Infinity, -Infinity, -Infinity);

  isEmpty() {
    return (this.max[0] < this.min[0]) || (this.max[1] < this.min[1]) || (this.max[2] < this.min[2]);
  }

  makeEmpty() {
    vec3.set(this.min, Infinity, Infinity, Infinity);
    vec3.set(this.max, -Infinity, -Infinity, -Infinity);
    return this;
  }

  copy(box: Box) {
    vec3.copy(this.min, box.min);
    vec3.copy(this.max, box.max);
    return this;
  }

  private static readonly aux1 = vec3.create();
  private static readonly aux2 = vec3.create();
  private static readonly aux3 = vec3.create();
  applyMatrix4(matrix: mat4) {
		if (this.isEmpty()) {
      return this;
    }

    const { aux1: min, aux2: max, aux3: aux } = Box;

    vec3.copy(min, this.min);
    vec3.copy(max, this.max);

    this.makeEmpty();
		this.expandByPoint(vec3.transformMat4(aux, vec3.set(aux, min[0], min[1], min[2]), matrix));
		this.expandByPoint(vec3.transformMat4(aux, vec3.set(aux, min[0], min[1], max[2]), matrix));
		this.expandByPoint(vec3.transformMat4(aux, vec3.set(aux, min[0], max[1], min[2]), matrix));
		this.expandByPoint(vec3.transformMat4(aux, vec3.set(aux, min[0], max[1], max[2]), matrix));
		this.expandByPoint(vec3.transformMat4(aux, vec3.set(aux, max[0], min[1], min[2]), matrix));
		this.expandByPoint(vec3.transformMat4(aux, vec3.set(aux, max[0], min[1], max[2]), matrix));
		this.expandByPoint(vec3.transformMat4(aux, vec3.set(aux, max[0], max[1], min[2]), matrix));
		this.expandByPoint(vec3.transformMat4(aux, vec3.set(aux, max[0], max[1], max[2]), matrix));

		return this;
	}

  getCenter(target: vec3) {
    return this.isEmpty() ? vec3.set(target, 0, 0, 0) : vec3.scale(target, vec3.add(target, this.min, this.max), 0.5);
  }

  getSize(target: vec3) {
		return this.isEmpty() ? vec3.set(target, 0, 0, 0) : vec3.sub(target, this.max, this.min);
	}

  union(box: Box) {
    vec3.min(this.min, this.min, box.min);
    vec3.max(this.max, this.max, box.max);
    return this;
  }

  expandByPoint(point: vec3) {
    vec3.min(this.min, this.min, point);
    vec3.max(this.max, this.max, point);
		return this;
	}
}
