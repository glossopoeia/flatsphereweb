const planar_scale: vec2f = vec2(1.5);

fn project(lat: f32, lon: f32) -> vec2f {
    let d = 10.0;
    
    let cos_c = sin(lat);
    let k = (d - 1.0) / (d - cos_c);
    
    let x = k * cos(lat) * sin(lon);
    let y = k * sin(lat);
    return vec2f(x, y);
}

fn inverse(x: f32, y: f32) -> vec2f {
    let d = 10.0;
    
    let r = sqrt(x * x + y * y);
    if (r == 0.0) {
        return vec2f(0.0, 0.0);
    }
    
    let max_r = sqrt((d - 1.0) / (d + 1.0));
    if (r > max_r) {
        return vec2f(0.0, 0.0); // Outside visible sphere
    }
    
    let denom = (d - 1.0) / r + r / (d - 1.0);
    let numer = d - sqrt(1.0 - ((r * r * (d + 1.0)) / (d - 1.0)));
    let c = asin(numer / denom);
    
    let lat = asin((y * sin(c)) / r);
    let lon = atan2(x * sin(c), r * cos(c));
    return vec2f(lat, lon);
}