@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<uniform> transform: Transform;

struct VertexInput {
  @location(0) position: vec3f,
  @location(3) offset: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
}

@vertex
fn vert_main(vertex: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = 
    camera.projection
    * camera.view
    * (transform.matrix * vec4f(vertex.position, 1.0) + vec4f(vertex.offset, 0.0));
  return output;
}

@fragment
fn frag_main() -> FragmentOutput {
  var output: FragmentOutput;
  output.color = vec4f(vec3f(0.529411764705882, 0.807843137254902, 0.9215686274509803) * 0.5, 0.5);
  return output;
}
