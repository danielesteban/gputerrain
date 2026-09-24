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
  @location(0) color: vec2f,
}

fn GeometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
  let a = roughness;
  let k = (a * a) / 2.0;
  let nom   = NdotV;
  let denom = NdotV * (1.0 - k) + k;
  return nom / denom;
}

fn GeometrySmith(N: vec3f, V: vec3f, L: vec3f, roughness: f32) -> f32{
  let NdotV = max(dot(N, V), 0.0);
  let NdotL = max(dot(N, L), 0.0);
  let ggx2 = GeometrySchlickGGX(NdotV, roughness);
  let ggx1 = GeometrySchlickGGX(NdotL, roughness);

  return ggx1 * ggx2;
}

fn IntegrateBRDF(NdotV: f32, roughness: f32) -> vec2f {
  let V = vec3f(
    sqrt(1.0 - NdotV*NdotV),
    0.0,
    NdotV
  );
  var A: f32 = 0.0;
  var B: f32 = 0.0; 
  let N = vec3f(0.0, 0.0, 1.0);
  const SAMPLE_COUNT: u32 = 1024u;
  for (var i: u32 = 0u; i < SAMPLE_COUNT; i++) {
    let Xi = Hammersley(i, SAMPLE_COUNT);
    let H = ImportanceSampleGGX(Xi, N, roughness);
    let L = normalize(2.0 * dot(V, H) * H - V);
    let NdotL = max(L.z, 0.0);
    let NdotH = max(H.z, 0.0);
    let VdotH = max(dot(V, H), 0.0);
    if (NdotL > 0.0) {
      let G = GeometrySmith(N, V, L, roughness);
      let G_Vis = (G * VdotH) / (NdotH * NdotV);
      let Fc = pow(1.0 - VdotH, 5.0);

      A += (1.0 - Fc) * G_Vis;
      B += Fc * G_Vis;
    }
  }
  A /= f32(SAMPLE_COUNT);
  B /= f32(SAMPLE_COUNT);
  return vec2f(A, B);
}

@vertex
fn vert_main(vertex: VertexInput) -> VertexOutput {
  const pos = array(
    vec2f( 1,  1),
    vec2f( 1, -1),
    vec2f(-1, -1),
    vec2f( 1,  1),
    vec2f(-1, -1),
    vec2f(-1,  1)
  );
  const uv = array(
    vec2f(1, 1),
    vec2f(1, 0),
    vec2f(0, 0),
    vec2f(1, 1),
    vec2f(0, 0),
    vec2f(0, 1)
  );
  var output: VertexOutput;
  output.position = vec4f(pos[vertex.index], 0, 1);
  output.uv = uv[vertex.index];
  return output;
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  output.color = IntegrateBRDF(fragment.uv.x, fragment.uv.y);
  return output;
}
