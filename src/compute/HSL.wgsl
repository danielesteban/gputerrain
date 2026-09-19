fn hue2rgb(f1: f32, f2: f32, hue: f32) -> f32 {
  var h = hue;
  if (h < 0.0) {
    h += 1.0;
  } else if (h > 1.0) {
    h -= 1.0;
  }
  var res: f32;
  if ((6.0 * h) < 1.0) {
    res = f1 + (f2 - f1) * 6.0 * h;
  } else if ((2.0 * h) < 1.0) {
    res = f2;
  } else if ((3.0 * h) < 2.0) {
    res = f1 + (f2 - f1) * ((2.0 / 3.0) - h) * 6.0;
  } else {
    res = f1;
  }
  return res;
}

fn hsl2rgb(hsl: vec3f) -> vec3f {
  var rgb: vec3f;
  
  if (hsl.y == 0.0) {
    rgb = vec3(hsl.z); // Luminance
  } else {
    var f2: f32;
    
    if (hsl.z < 0.5) {
      f2 = hsl.z * (1.0 + hsl.y);
    } else {
      f2 = hsl.z + hsl.y - hsl.y * hsl.z;
    }  
    let f1 = 2.0 * hsl.z - f2;
    
    rgb.r = hue2rgb(f1, f2, hsl.x + (1.0/3.0));
    rgb.g = hue2rgb(f1, f2, hsl.x);
    rgb.b = hue2rgb(f1, f2, hsl.x - (1.0/3.0));
  }   
  return rgb;
}
