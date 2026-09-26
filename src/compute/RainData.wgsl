struct Params {
  origin: vec2f,
  seed: f32,
  step: f32,
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> params: Params;
@group(0) @binding(2) var<storage, read_write> instances: array<vec4f, INSTANCE_COUNT>;
@group(1) @binding(0) var<storage, read> heightmapNW: array<f32, SIZE.x * SIZE.z>;
@group(1) @binding(1) var<storage, read> heightmapN: array<f32, SIZE.x * SIZE.z>;
@group(1) @binding(2) var<storage, read> heightmapNE: array<f32, SIZE.x * SIZE.z>;
@group(1) @binding(3) var<storage, read> heightmapW: array<f32, SIZE.x * SIZE.z>;
@group(1) @binding(4) var<storage, read> heightmap: array<f32, SIZE.x * SIZE.z>;
@group(1) @binding(5) var<storage, read> heightmapE: array<f32, SIZE.x * SIZE.z>;
@group(1) @binding(6) var<storage, read> heightmapSW: array<f32, SIZE.x * SIZE.z>;
@group(1) @binding(7) var<storage, read> heightmapS: array<f32, SIZE.x * SIZE.z>;
@group(1) @binding(8) var<storage, read> heightmapSE: array<f32, SIZE.x * SIZE.z>;

fn getHeight(p: vec2i) -> f32 {
  if (p.y < 0) {
    if (p.x < 0) {
      return heightmapNW[(p.y + SIZE.z) * SIZE.x + p.x + SIZE.x];
    }
    if (p.x >= i32(SIZE.x)) {
      return heightmapNE[(p.y + SIZE.z) * SIZE.x + p.x - SIZE.x];
    }
    return heightmapN[(p.y + SIZE.z) * SIZE.x + p.x];
  }

  if (p.y >= i32(SIZE.z)) {
    if (p.x < 0) {
      return heightmapSW[(p.y - SIZE.z) * SIZE.x + p.x + SIZE.x];
    }
    if (p.x >= i32(SIZE.x)) {
      return heightmapSE[(p.y - SIZE.z) * SIZE.x + p.x - SIZE.x];
    }
    return heightmapS[(p.y - SIZE.z) * SIZE.x + p.x];
  }

  if (p.x < 0) {
    return heightmapW[p.y * SIZE.x + p.x + SIZE.x];
  }
  if (p.x >= i32(SIZE.x)) {
    return heightmapE[p.y * SIZE.x + p.x - SIZE.x];
  }
  return heightmap[p.y * SIZE.x + p.x];
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= INSTANCE_COUNT) {
    return;
  }
  let current = instances[id.x];
  if (
    current.w < current.y
    && distance(current.xz, vec2f(params.origin.x * SCALE.x, params.origin.y * SCALE.z)) < SCALE.x * 1.5
  ) {
    instances[id.x] = vec4f(
      current.x,
      max(current.y - params.step, current.w),
      current.z,
      current.w
    );
    return;
  }
  let angle = snoise2D(vec2f(params.seed, f32(id.x))) * PI * 2.0;
  let radius = (snoise2D(vec2f(f32(id.x), params.seed)) * 0.5 + 0.5) * 1.5;
  let p = vec2i(
    i32((0.5 + cos(angle) * radius) * f32(SIZE.x)),
    i32((0.5 + sin(angle) * radius) * f32(SIZE.z)),
  );
  let h = getHeight(p) * SCALE.y + 0.5;
  instances[id.x] = vec4f(
    (
      params.origin.x * SCALE.x - SCALE.x * 0.5
      + (f32(p.x) + 0.5) / f32(SIZE.x) * SCALE.x
    ),
    max(max(camera.position.y, SCALE.y) + SCALE.y * 0.5 * snoise2D(vec2f(params.seed, -f32(id.x))), h),
    (
      params.origin.y * SCALE.z - SCALE.z * 0.5
      + (f32(p.y) + 0.5) / f32(SIZE.z) * SCALE.z
    ),
    h
  );
}
