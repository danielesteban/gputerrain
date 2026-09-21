import { type vec2, vec3 } from 'gl-matrix';
import type { Sphere } from 'math/Sphere';
import type { Camera } from 'render/Camera';

export type Intersection = {
  distance: number;
  normal?: vec3;
  obj: any;
};

export class Ray {
  readonly origin = vec3.create();
  readonly direction = vec3.create();

  setFromCamera(camera: Camera, position?: vec2) {
    const { origin, direction } = this;
    vec3.copy(origin, camera.position);
    vec3.set(direction, position?.[0] || 0, position?.[1] || 0, 0.5);
    vec3.transformMat4(direction, direction, camera.getProjectionInverse());
    vec3.transformMat4(direction, direction, camera.getViewInverse());
    vec3.sub(direction, direction, origin);
    vec3.normalize(direction, direction);
  }

  private static readonly aux1 = vec3.create();
  intersectSphere(sphere: Sphere) {
    const { origin, direction } = this;
    const { aux1: vector } = Ray;
		if (sphere.radius < 0) return 0;
		vec3.sub(vector, sphere.center, origin);
		const tca = vec3.dot(vector, direction);
		const d2 = vec3.dot(vector, vector) - tca * tca;
		const radius2 = sphere.radius * sphere.radius;
		if (d2 > radius2) return 0;
		const thc = Math.sqrt(radius2 - d2);
		const t0 = tca - thc;
		const t1 = tca + thc;
		if (t1 < 0) return 0;
		if (t0 < 0) return t1;
		return t0;
	}

  private static readonly aux2 = vec3.create();
  private static readonly aux3 = vec3.create();
  private static readonly aux4 = vec3.create();
  private static readonly aux5 = vec3.create();
  intersectTriangle(a: vec3, b: vec3, c: vec3) {
    const { origin, direction } = this;
    const { aux2: edge1, aux3: edge2, aux4: diff, aux5: normal } = Ray;
    vec3.sub(edge1, b, a);
    vec3.sub(edge2, c, a);
    vec3.cross(normal, edge1, edge2);
    const DdN = -vec3.dot(direction, normal);
    if (DdN <= 0) return 0;
    vec3.sub(diff, origin, a);
    const DdQxE2 = -vec3.dot(direction, vec3.cross(edge2, diff, edge2));
    if (DdQxE2 < 0) return 0;
    const DdE1xQ = -vec3.dot(direction, vec3.cross(edge1, edge1, diff));
    if (DdE1xQ < 0 || (DdQxE2 + DdE1xQ) > DdN) return 0;
    const QdN = vec3.dot(diff, normal);
    if (QdN < 0) return 0;
    return QdN / DdN;
  }
}

export class Raycaster {
  private readonly rays: Ray[] = [];

  // @dani @incomplete
  // Implement optional maximum ray distance
  async intersect(
    objects: { raycast: (ray: Ray, intersections: Intersection[]) => Promise<void> }[],
    camera: Camera,
    position?: vec2
  ) {
    const { rays } = this;
    const ray = rays.pop() || new Ray();
    ray.setFromCamera(camera, position);
    const intersections: Intersection[] = [];
    await Promise.all(objects.map((obj) => (
      obj.raycast(ray, intersections)
    )));
    rays.push(ray);
    intersections.sort((a, b) => a.distance - b.distance);
    const hit = intersections[0];
    if (!hit) {
      return false;
    }
    return {
      distance: hit.distance,
      normal: hit.normal,
      position: vec3.scaleAndAdd(vec3.create(), ray.origin, ray.direction, hit.distance),
      obj: hit.obj,
    };
  }
}
