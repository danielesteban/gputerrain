@group(0) @binding(0) var data: texture_storage_3d<rgba8unorm, read>;
@group(0) @binding(1) var<storage, read_write> heightmap: array<f32, SIZE.x * SIZE.z>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= SIZE.xz)) {
    return;
  }

  var height = 0.0;
  for (var i: i32 = i32(SIZE.y - 1); i >= 0; i--) {
    let d = textureLoad(data, vec3u(id.x, u32(i), id.y)).w;
    if (d > 0.5) {
      height = f32(i + 1) / f32(SIZE.y);
      break;
    }
  }
  heightmap[id.y * SIZE.x + id.x] = height;
}
