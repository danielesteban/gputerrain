@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> transform: Transform;

struct VertexInput {
  @location(0) position: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) grid: vec2f,
}

struct FragmentInput {
  @location(0) grid: vec2f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
}

@vertex
fn vert_main(vertex: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let mvPosition = transform.matrix * vec4f(vertex.position, 1.0);
  output.position = camera.projection * camera.view * mvPosition;
  output.grid = vec2f(mvPosition.x, mvPosition.z);
  return output;
}

@fragment
fn frag_main(fragment: FragmentInput) -> FragmentOutput {
  let gridPos = fragment.grid / 2.0;
  let grid = abs(fract(gridPos - 0.5) - 0.5) / fwidth(gridPos);
  let line = min(grid.x, grid.y);

  let chunkPos = (fragment.grid + 32.0) / 64.0;
  let chunkGrid = abs(fract(chunkPos - 0.5) - 0.5) / fwidth(chunkPos);
  let chunkLine = min(chunkGrid.x, chunkGrid.y);

  let color = mix(vec3f(1.0, 1.0, 1.0), vec3f(1.0, 1.0, 0.0), 1.0 - min(chunkLine, 1.0));
  let alpha = (1.0 - min(line, 1.0)) * (1.0 - (distance(fragment.grid, camera.position.xz) / 256.0)) * 0.3;

  var output: FragmentOutput;
  output.color = vec4f(color * alpha, alpha);
  return output;
}
