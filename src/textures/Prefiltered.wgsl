struct Params {
  transform: mat4x4<f32>,
  resolution: f32,
  roughness: f32,
}

@group(0) @binding(0) var inputTexture: texture_cube<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> params: Params;

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
  output.position = params.transform * vec4f(output.worldPos, 1);
  return output;
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  var n = normalize(fragment.worldPos.xyz);

  let r = n;
  let v = r;

  let SAMPLE_COUNT: u32 = 4096u;
  var prefilteredColor = vec3f(0.0, 0.0, 0.0);
  var totalWeight = 0.0;

  for (var i: u32 = 0u; i < SAMPLE_COUNT; i = i + 1u) {
    let xi = Hammersley(i, SAMPLE_COUNT);
    let h = ImportanceSampleGGX(xi, n, params.roughness);
    let l = normalize(2.0 * dot(v, h) * h - v);

    let nDotL = max(dot(n, l), 0.0);

    if(nDotL > 0.0) {
      let d = DistributionGGX(n, h, params.roughness);
      let nDotH = max(dot(n, h), 0.0);
      let hDotV = max(dot(h, v), 0.0);
      let pdf = d * nDotH / (4.0 * hDotV) + 0.0001;

      let saTexel = 4.0 * PI / (6.0 * params.resolution * params.resolution);
      let saSample = 1.0 / (f32(SAMPLE_COUNT) * pdf + 0.0001);

      let mipLevel = select(0.5 * log2(saSample / saTexel), 0.0, params.roughness == 0.0);

      prefilteredColor += textureSampleLevel(inputTexture, inputSampler, l, mipLevel).rgb * nDotL;
      totalWeight += nDotL;
    }
  }

  prefilteredColor = prefilteredColor / totalWeight;
  var output: FragmentOutput;
  output.color = vec4f(prefilteredColor, 1.0);
  return output;
}
