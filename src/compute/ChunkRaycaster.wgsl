@group(0) @binding(0) var dataTexture: texture_3d<f32>;
@group(0) @binding(1) var dataSampler: sampler;
@group(0) @binding(2) var<storage, read_write> raycast: Raycast;

@compute @workgroup_size(1)
fn main() {
  raycast.position = raymarch(raycast.origin, raycast.direction);
  if (raycast.position.x != -1.0) {
    raycast.normal = normal(raycast.position + 0.5);
  }
}
