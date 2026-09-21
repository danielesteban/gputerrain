@group(0) @binding(0) var backgroundTexture: texture_2d<f32>;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var inputSampler: sampler;
@group(0) @binding(3) var<uniform> resolution: vec2f;

struct VertexInput {
  @builtin(vertex_index) index: u32,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

struct FragmentInput {
  @location(0) uv: vec2f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
}

const BLUR = 0.85;

fn gaussian(uv: vec2f) -> vec4f {
  let b = BLUR / resolution;

  var col = textureSample(inputTexture, inputSampler, vec2f(uv.x - b.x, uv.y - b.y)) * 0.077847;
  col += textureSample(inputTexture, inputSampler, vec2f(uv.x - b.x, uv.y)) * 0.123317;
  col += textureSample(inputTexture, inputSampler, vec2f(uv.x - b.x, uv.y + b.y)) * 0.077847;

  col += textureSample(inputTexture, inputSampler, vec2f(uv.x, uv.y - b.y)) * 0.123317;
  col += textureSample(inputTexture, inputSampler, vec2f(uv.x, uv.y)) * 0.195346;
  col += textureSample(inputTexture, inputSampler, vec2f(uv.x, uv.y + b.y)) * 0.123317;

  col += textureSample(inputTexture, inputSampler, vec2f(uv.x + b.x, uv.y - b.y)) * 0.077847;
  col += textureSample(inputTexture, inputSampler, vec2f(uv.x + b.x, uv.y)) * 0.123317;
  col += textureSample(inputTexture, inputSampler, vec2f(uv.x + b.x, uv.y + b.y)) * 0.077847;

  return col;
}

@vertex fn vert_main(vertex: VertexInput) -> VertexOutput {
  const quad = array(
    vec2<f32>( 1,  1),
    vec2<f32>( 1, -1),
    vec2<f32>(-1, -1),
    vec2<f32>( 1,  1),
    vec2<f32>(-1, -1),
    vec2<f32>(-1,  1)
  );
  const uv = array(
    vec2<f32>(1, 0),
    vec2<f32>(1, 1),
    vec2<f32>(0, 1),
    vec2<f32>(1, 0),
    vec2<f32>(0, 1),
    vec2<f32>(0, 0)
  );
  var output: VertexOutput;
  output.position = vec4f(quad[vertex.index], 0, 1);
  output.uv = uv[vertex.index];
  return output;
}

@fragment fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  var uv = fragment.uv - 0.5;
  let d = length(uv * 0.5 * uv * 0.5);
  uv = (uv * d + uv * 0.935) + 0.5;
  var pixel = gaussian(uv);
  var color = vec3f(pixel.rgb + textureSample(backgroundTexture, inputSampler, uv).rgb * (1.0 - pixel.a));

  let s = 1.0 - smoothstep(320.0, 1440.0, resolution.y) + 1.0;
  let j = cos(uv.y*resolution.y*s) * 0.1;
  color = color - color * j;
  color *= 1.0 - (0.01 + ceil((uv.x*resolution.x) % 3.0) * (0.995-1.01));

  var m = max(0.0, 1.0 - 2.0 * max(abs(uv.x - 0.5), abs(uv.y - 0.5)));
  m = min(m*200.0, 1.0);
  color *= m;

  var output: FragmentOutput;
  output.color = vec4f(color, 1.0);
  return output;
}
