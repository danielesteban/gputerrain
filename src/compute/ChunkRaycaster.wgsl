struct Query {
  origin: vec3f,
  direction: vec3f,
  position: vec3f,
  normal: vec3f,
}

@group(0) @binding(0) var dataTexture: texture_3d<f32>;
@group(0) @binding(1) var dataSampler: sampler;
@group(0) @binding(2) var<storage, read_write> query: Query;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  query.position = raymarch(query.origin, query.direction);
  if (query.position.x != -1.0) {
    query.normal = normal(query.position + 0.5);
  }
}
