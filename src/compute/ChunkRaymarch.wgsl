const REFINEMENT_STEPS = 4;
const THRESHOLD = 0.5;

fn sample(p: vec3f) -> vec4f {
  return textureSampleLevel(
    dataTexture,
    dataSampler,
    vec3f(
      SAMPLE_OFFSET.x,
      SAMPLE_OFFSET.y * dataSubchunk,
      SAMPLE_OFFSET.z
    ) + p * SAMPLE_SCALE,
    0
  );
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

fn normal(p: vec3f) -> vec3f {
  const step = 0.01;
  let x = sample(p + vec3f(-step, 0.0, 0.0)).w - sample(p + vec3f(step, 0.0, 0.0)).w;
  let y = sample(p + vec3f(0.0, -step, 0.0)).w - sample(p + vec3f(0.0, step, 0.0)).w;
  let z = sample(p + vec3f(0.0, 0.0, -step)).w - sample(p + vec3f(0.0, 0.0, step)).w;
  return normalize(vec3f(x, y, z));
}

fn raymarch(origin: vec3f, direction: vec3f, steps: f32) -> vec3f {
  var bounds = hitBox(origin, direction);
  if (bounds.x > bounds.y) {
    return vec3f(-1.0);
  }
  bounds.x = max(bounds.x, 0.0);

  let stepSize = (bounds.y - bounds.x) / steps;
  for (var i = 0.0; i < steps; i += 1.0) {
    let t = bounds.x + i * stepSize;
    var p = origin + t * direction;
    let d = sample(p + 0.5).w;
    if (d > THRESHOLD) {
      var t0 = max(t - stepSize, bounds.x);
      var t1 = t;
      for (var j = 0; j < REFINEMENT_STEPS; j++) {
        let tm = (t0 + t1) * 0.5;
        let dm = sample(origin + tm * direction + 0.5).w;

        let isGreater = dm > THRESHOLD;
        t1 = select(t1, tm, isGreater);
        t0 = select(tm, t0, isGreater);
      }
      p = origin + t1 * direction;
      return p;
    }
  }

  return vec3f(-1.0);
}
