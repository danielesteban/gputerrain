struct Brush {
  position: vec3f,
  radius: f32,
  color: vec3f,
  erase: f32,
}

@group(0) @binding(0) var input: texture_storage_3d<rgba8unorm, read>;
@group(0) @binding(1) var data: texture_storage_3d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> brush: Brush;

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let b = vec3i(id) - i32(brush.radius);
  let l = length(vec3f(b));
  if (l > brush.radius) {
    return;
  }
  let p = vec3i(brush.position) + b;
  if (any(p < vec3i(0)) || any(p >= SIZE)) {
    return;
  }
  let c = textureLoad(input, p);
  let d = min(brush.radius - l, 4.0) / 4.0;
  if (brush.erase == 1.0) { 
    textureStore(data, p, vec4f(c.xyz, min(c.w, 1 - d)));
  } else {
    let cd = min(brush.radius - l, 3.0) / 3.0;
    textureStore(data, p, vec4f(mix(c.xyz, brush.color, cd), max(c.w, d)));
  }
}
