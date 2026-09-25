@group(0) @binding(0) var<storage, read_write> heightmap: array<f32, SIZE.x * SIZE.z>;
@group(0) @binding(1) var<uniform> position: vec2f;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= SIZE.xz)) {
    return;
  }

  let uv = position + (vec2f(id.xy) - 0.5) / vec2f(SIZE.xz - 2);
  heightmap[id.y * SIZE.x + id.x] = clamp(
    FBM2D(uv * NOISE_FREQUENCY + NOISE_SEED) * 0.5 + 0.5,
    0.0,
    1.0 - 4.0 / f32(SIZE.y)
  );
}
