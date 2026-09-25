@group(0) @binding(0) var data: texture_storage_3d<rgba8unorm, write>;
@group(0) @binding(1) var<storage, read> heightmap: array<f32, SIZE.x * SIZE.z>;
@group(0) @binding(2) var<uniform> position: vec2f;

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id >= SIZE)) {
    return;
  }

  let uv = vec3f(position.x, 0.0, position.y)
           + (vec3f(id) - vec3f(0.5, 0.0, 0.5)) / vec3f(SIZE - vec3u(2, 0, 2));
  let h = heightmap[id.z * SIZE.x + id.x];
  const hs = 4.0 / f32(SIZE.y);
  let s = smoothstep(-hs, hs, h - uv.y);
  let n = clamp(FBM3D(uv * NOISE_FREQUENCY + NOISE_SEED) * 0.5 + 0.5, 0.0, 1.0) * s;
  let hue = FBM3D(uv * COLOR_FREQUENCY + COLOR_SEED) * 0.5 + 0.5;
  let color = hsl2rgb(vec3f(hue * 0.5, 0.7, 0.6));

  textureStore(data, id, vec4f(color, n));
}
