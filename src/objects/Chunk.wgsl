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

const STEPS = 200;
const REFINEMENT_STEPS = 4;
const THRESHOLD = 0.5;
const lightDir = normalize(vec3f(0.0, 1.0, 1.0));

@diagnostic(off,derivative_uniformity) fn sample(p: vec3f) -> vec4f {
  return textureSample(dataTexture, dataSampler, SAMPLE_OFFSET + p * SAMPLE_SCALE);
}

fn sample1(p: vec3f) -> f32 {
  return sample(p).w;
}

fn hitBox(orig: vec3f, dir: vec3f) -> vec2f {
  let box_min = vec3f(-0.5);
  let box_max = vec3f(0.5);
  let inv_dir = 1.0 / dir;
  let tmin_tmp = (box_min - orig) * inv_dir;
  let tmax_tmp = (box_max - orig) * inv_dir;
  let tmin = min(tmin_tmp, tmax_tmp);
  let tmax = max(tmin_tmp, tmax_tmp);
  let t0 = max(tmin.x, max( tmin.y, tmin.z));
  let t1 = min(tmax.x, min( tmax.y, tmax.z));
  return vec2f(t0, t1);
}

fn normal( coord: vec3f ) -> vec3f {
  const step = 0.01;
  let x = sample1(coord + vec3(-step, 0.0, 0.0)) - sample1(coord + vec3(step, 0.0, 0.0));
  let y = sample1(coord + vec3(0.0, -step, 0.0)) - sample1(coord + vec3(0.0, step, 0.0));
  let z = sample1(coord + vec3(0.0, 0.0, -step)) - sample1(coord + vec3(0.0, 0.0, step));

  return normalize(vec3(x, y, z));
}

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
  let rayDir = normalize(fragment.direction);
  var bounds = hitBox(fragment.origin, rayDir);

  if (bounds.x > bounds.y) {
    discard;
  }

  bounds.x = max(bounds.x, 0.0);

  let stepSize = (bounds.y - bounds.x) / STEPS;

  var color = vec4f(0);
  var depth = 1.0;

  for (var i = 0.0; i < STEPS; i += 1.0) {
    let t = bounds.x + i * stepSize;
    var p = fragment.origin + t * rayDir;
    let d = sample1(p + 0.5);
    if (d > THRESHOLD) {
      var t0 = max(t - stepSize, bounds.x);
      var t1 = t;

      for (var j = 0; j < REFINEMENT_STEPS; j++) {
        let tm = ( t0 + t1 ) * 0.5;
        let dm = sample1(fragment.origin + tm * rayDir + 0.5);

        let isGreater = dm > THRESHOLD;
        t1 = select(t1, tm, isGreater);
        t0 = select(tm, t0, isGreater);
      }
      p = fragment.origin + t1 * rayDir;

      let light = getLight(normal(p + 0.5));
      let mvPos = camera.view * transform.matrix * vec4(p, 1.0);
      let alpha = 1.0 - clamp(length(vec2f(mvPos.x, mvPos.z)) / 256.0, 0.0, 1.0);
      color = vec4f(linearToSrgb3(srgbToLinear3(sample(p + 0.5).rgb) * light) * alpha, alpha);
      let pos = camera.projection * mvPos;
      depth = pos.z / pos.w;
      break;
    }
  }

  if (color.a == 0.0) {
    discard;
  }

  var output: FragmentOutput;
  output.color = color;
  output.depth = depth;
  return output;
}
