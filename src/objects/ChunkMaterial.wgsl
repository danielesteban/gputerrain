@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> transform: Transform;
@group(1) @binding(0) var dataTexture: texture_3d<f32>;
@group(1) @binding(1) var dataSampler: sampler;
@group(1) @binding(2) var<uniform> dataSubchunk: f32;
@group(1) @binding(3) var brdfTexture: texture_2d<f32>;
@group(1) @binding(4) var irradianceTexture: texture_cube<f32>;
@group(1) @binding(5) var prefilteredTexture: texture_cube<f32>;
@group(1) @binding(6) var textureSampler: sampler;

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

fn fresnelSchlickRoughness(cosTheta: f32, f0: vec3f, roughness: f32) -> vec3f {
  return f0 + (max(vec3(1.0 - roughness), f0) - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn getLight(color: vec3f, metalness: f32, roughness: f32, normal: vec3f, position: vec3f) -> vec3f {
  let n = normalize(normal);
  let v = normalize(camera.position - position);
  let r = reflect(-v, n);
  let f0 = mix(vec3f(0.04), color, metalness);

  let f = fresnelSchlickRoughness(max(dot(n, v), 0.00001), f0, roughness);
  let kS = f;
  var kD = vec3f(1.0) - kS;
  kD *= 1.0 - metalness;

  let irradiance = textureSampleLevel(irradianceTexture, textureSampler, n, 0).rgb;
  let diffuse = irradiance * color;

  const MAX_REFLECTION_LOD: f32 = 4.0;
  let prefilteredColor = textureSampleLevel(prefilteredTexture, textureSampler, r, roughness * MAX_REFLECTION_LOD).rgb;
  let brdf = textureSampleLevel(brdfTexture, textureSampler, vec2f(max(dot(n, v), 0.0), roughness), 0).rg;
  let specular = prefilteredColor * (f * brdf.x + brdf.y);

  return kD * diffuse + specular;
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
  let steps = clamp(200.0 / (length(fragment.origin) * 2.0), 100.0, 200.0);
  let p = raymarch(fragment.origin, normalize(fragment.direction), steps);
  if (p.x == -1.0) {
    discard;
  }

  let worldPos = transform.matrix * vec4(p, 1.0);
  let light = getLight(
    srgbToLinear3(sample(p + 0.5).rgb),
    0.5,
    0.01,
    normal(p + 0.5),
    worldPos.xyz
  );
  let mvPos = camera.view * worldPos;
  let alpha = 1.0 - clamp(length(vec2f(mvPos.x, mvPos.z)) / 256.0, 0.0, 1.0);
  let color = vec4f(linearToSrgb3(light) * alpha, alpha);
  let pos = camera.projection * mvPos;
  let depth = pos.z / pos.w;

  var output: FragmentOutput;
  output.color = color;
  output.depth = depth;
  return output;
}
