@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> transform: Transform;
@group(1) @binding(0) var dataTexture: texture_3d<f32>;
@group(1) @binding(1) var dataSampler: sampler;
@group(1) @binding(2) var irradianceTexture: texture_cube<f32>;
@group(1) @binding(3) var irradianceSampler: sampler;

struct VertexInput {
  @location(0) position: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) origin: vec3f,
  @location(1) direction: vec3f,
}

struct FragmentInput {
  @location(0) origin: vec3f,
  @location(1) direction: vec3f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
  @builtin(frag_depth) depth: f32,
}

const lightDir = normalize(vec3f(0.0, 1.0, 1.0));
fn getLight(normal: vec3f) -> vec3f {
  return textureSampleLevel(irradianceTexture, irradianceSampler, normal, 0).rgb;
}

fn srgbToLinear(value: f32) -> f32 {
  if (value <= 0.04045) {
    return value / 12.92;
  }
  return pow((value + 0.055) / 1.055, 2.4);
}

fn srgbToLinear3(value: vec3f) -> vec3f {
  return vec3f(srgbToLinear(value.r), srgbToLinear(value.g), srgbToLinear(value.b));
}

fn linearToSrgb(value: f32) -> f32 {
  if (value <= 0.0031308) {
    return value * 12.92;
  }
  return 1.055 * pow(value, 1.0 / 2.4) - 0.055;
}

fn linearToSrgb3(value: vec3f) -> vec3f {
  return vec3f(linearToSrgb(value.r), linearToSrgb(value.g), linearToSrgb(value.b));
}

@vertex
fn vert_main(vertex: VertexInput) -> VertexOutput {
  let mvPosition = camera.view * transform.matrix * vec4(vertex.position, 1.0);
  var output: VertexOutput;
  output.position = camera.projection * mvPosition;
  output.origin = (transform.inverse * vec4f(camera.position, 1.0)).xyz;
	output.direction = vertex.position - output.origin;
  return output;
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  let p = raymarch(fragment.origin, normalize(fragment.direction));
  if (p.x == -1.0) {
    discard;
  }

  let light = getLight(normal(p + 0.5));
  let mvPos = camera.view * transform.matrix * vec4(p, 1.0);
  let alpha = 1.0 - clamp(length(vec2f(mvPos.x, mvPos.z)) / 256.0, 0.0, 1.0);
  let color = vec4f(linearToSrgb3(srgbToLinear3(sample(p + 0.5).rgb) * light) * alpha, alpha);
  let pos = camera.projection * mvPos;
  let depth = pos.z / pos.w;

  var output: FragmentOutput;
  output.color = color;
  output.depth = depth;
  return output;
}
