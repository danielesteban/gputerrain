fn RadicalInverse_VdC(bits: u32) -> f32 {
  var result: u32;
  result = (bits << 16u) | (bits >> 16u);
  result = ((result & 0x55555555u) << 1u) | ((result & 0xAAAAAAAAu) >> 1u);
  result = ((result & 0x33333333u) << 2u) | ((result & 0xCCCCCCCCu) >> 2u);
  result = ((result & 0x0F0F0F0Fu) << 4u) | ((result & 0xF0F0F0F0u) >> 4u);
  result = ((result & 0x00FF00FFu) << 8u) | ((result & 0xFF00FF00u) >> 8u);
  return f32(result) * 2.3283064365386963e-10;
}

fn Hammersley(i: u32, N: u32) -> vec2f {
  return vec2(f32(i) / f32(N), RadicalInverse_VdC(i));
}

fn ImportanceSampleGGX(Xi: vec2f, N: vec3f, roughness: f32) -> vec3f {
  let a = roughness*roughness;
  let phi = 2.0 * PI * Xi.x;
  let cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
  let sinTheta = sqrt(1.0 - cosTheta*cosTheta);
  let H = vec3f(
    cos(phi) * sinTheta,
    sin(phi) * sinTheta,
    cosTheta
  );
  let up        = select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0), abs(N.z) < 0.999);
  let tangent   = normalize(cross(up, N));
  let bitangent = cross(N, tangent);
  let sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
  return normalize(sampleVec);
}
