@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> transform: Transform;
@group(1) @binding(0) var noiseTexture: texture_2d<f32>;
@group(1) @binding(1) var noiseSampler: sampler;

struct VertexInput {
  @location(0) position: vec3f,
  @location(2) uv: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) altitude: f32,
  @location(1) noiseUV: vec2f,
}

struct FragmentInput {
  @location(0) altitude: f32,
  @location(1) noiseUV: vec2f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
}

@vertex
fn vert_main(vertex: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = camera.projection * camera.view * transform.matrix * vec4f(vertex.position, 1.0);
  output.altitude = (normalize(vertex.position).y + 1.0) * 0.5;
  output.noiseUV = vertex.uv * 8.0;
  return output;
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  const background = vec3f(0.075, 0.15, 0.3);
  const granularity = background * 0.02;
  let color = (
    mix(background * 0.2, background * 2.0, fragment.altitude)
    + mix(-granularity, granularity, textureSample(noiseTexture, noiseSampler, fragment.noiseUV).r)
  );
  var output: FragmentOutput;
  output.color = vec4f(clamp(color, vec3f(0.0), vec3f(1.0)), 1.0);
  return output;
}
