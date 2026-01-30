const planar_scale: vec2f = vec2(1.0);

fn project(lat: f32, lon: f32) -> vec2f {
    return vec2f(cos(lat) * sin(lon), sin(lat));
}

fn inverse(x: f32, y: f32) -> vec2f {
    let r = sqrt(x * x + y * y);
    if (r > 1.0) {
        return vec2f(0.0, 0.0); // Outside sphere
    }
    let lat = asin(y);
    let lon = asin(x / cos(lat));
    return vec2f(lat, lon);
}