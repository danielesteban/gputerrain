@group(0) @binding(0) var data: texture_storage_3d<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> position: vec3f;

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id >= SIZE)) {
    return;
  }

  let uv = (vec3f(id) - 0.5) / vec3f(SIZE - 2);
  let h = min(FBM2D((position + uv).xz * 0.5) * 0.5 + 0.5, 1.0 - 1.0 / f32(SIZE.y - 2));
  let n = clamp(select(0.0, FBM3D(position + uv) * 0.5 + 0.5, uv.y < h), 0.0, 1.0);
  let hue = FBM3D(position + uv + 74370.0) * 0.5 + 0.5;
  let color = hsl2rgb(vec3f(hue * 0.5, 0.7, 0.6));

  textureStore(data, id, vec4f(color, n));
}
