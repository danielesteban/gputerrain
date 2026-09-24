@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> transform: mat4x4<f32>;

struct VertexInput {
  @builtin(vertex_index) index: u32,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPos: vec3f,
}

struct FragmentInput {
  @location(0) worldPos: vec3f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
}

const invAtan: vec2f = vec2f(0.1591, 0.3183);
fn SampleSphericalMap(v: vec3f) -> vec2f {
  var uv: vec2f = vec2f(atan2(v.z, v.x), asin(v.y));
  uv *= invAtan;
  uv += 0.5;
  uv = vec2f(uv.x, 1.0 - uv.y);
  return uv;
}

@vertex
fn vert_main(vertex: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.worldPos = CubemapVertices[vertex.index];
  output.position = transform * vec4f(output.worldPos, 1);
  return output;
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  let uv = SampleSphericalMap(normalize(fragment.worldPos));
  let color = textureSample(inputTexture, inputSampler, uv).rgb;
  var output: FragmentOutput;
  output.color = vec4f(color, 1.0);
  return output;
}
