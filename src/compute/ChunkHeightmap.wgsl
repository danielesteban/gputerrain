@group(0) @binding(0) var<storage, read_write> heightmap: array<f32, SIZE.x * SIZE.z>;
@group(0) @binding(1) var<uniform> position: vec3f;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id >= SIZE)) {
    return;
  }

  let uv = position + (vec3f(f32(id.x), 0.0, f32(id.y)) - 0.5) / vec3f(SIZE - 2);
  heightmap[id.y * SIZE.x + id.x] = clamp(
    (FBM2D((uv).xz * NOISE_FREQUENCY + NOISE_SEED) * 0.5 + 0.5) * f32(SUBCHUNKS),
    0.0,
    f32(SUBCHUNKS) - 4.0 / f32(SIZE.y - 2)
  );
}
