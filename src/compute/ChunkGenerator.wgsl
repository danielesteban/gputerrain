@group(0) @binding(0) var data: texture_storage_3d<rgba8unorm, write>;
@group(0) @binding(1) var<storage, read> heightmap: array<f32, SIZE.x * SIZE.z>;
@group(0) @binding(2) var<uniform> position: vec3f;

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id >= SIZE)) {
    return;
  }

  let uv = position + (vec3f(id) - 0.5) / vec3f(SIZE - 2);
  let h = heightmap[id.z * SIZE.x + id.x];
  const hs = 4.0 / f32(SIZE.y - 2);
  let s = smoothstep(-hs, hs, h - uv.y);
  let n = clamp(FBM3D(uv * NOISE_FREQUENCY + NOISE_SEED) * 0.5 + 0.5, 0.0, 1.0) * s;
  let hue = FBM3D(uv * COLOR_FREQUENCY + COLOR_SEED) * 0.5 + 0.5;
  let color = hsl2rgb(vec3f(hue * 0.5, 0.7, 0.6));

  textureStore(data, id, vec4f(color, n));
}
