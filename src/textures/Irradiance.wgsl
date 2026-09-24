@group(0) @binding(0) var inputTexture: texture_cube<f32>;
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

@vertex
fn vert_main(vertex: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.worldPos = CubemapVertices[vertex.index];
  output.position = transform * vec4f(output.worldPos, 1);
  return output;
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  let N = normalize(fragment.worldPos);
  var irradiance: vec3f = vec3f(0.0);   
  var up: vec3f = vec3f(0.0, 1.0, 0.0);
  let right = normalize(cross(up, N));
  up = normalize(cross(N, right));
  const sampleDelta: f32 = 0.025;
  var nrSamples: u32 = 0;
  for (var phi: f32 = 0.0; phi < 2.0 * PI; phi += sampleDelta) {
    for (var theta: f32 = 0.0; theta < 0.5 * PI; theta += sampleDelta) {
      let tangentSample = vec3f(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
      let sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N; 
      irradiance += textureSample(inputTexture, inputSampler, sampleVec).rgb * cos(theta) * sin(theta);
      nrSamples++;
    }
  }
  irradiance = PI * irradiance * (1.0 / f32(nrSamples));
  var output: FragmentOutput;
  output.color = vec4f(irradiance, 1.0);
  return output;
}
