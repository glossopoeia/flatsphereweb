const planar_scale: vec2f = vec2(1.0);

fn project(lat: f32, lon: f32) -> vec2f {
    return vec2f(cos(lat) * sin(lon), sin(lat));
}

fn inverse(x: f32, y: f32) -> vec2f {
    let r = sqrt(x * x + y * y);
    if (r > 1.0) {
        // Outside sphere, sentinel value (anything outside usual lat/lon boundaries will do)
        // We use a check in 'reproject' to only draw inverses with 'good' lat/lon values
        return vec2f(-181.0, 0.0);
    }
    let lat = asin(y);
    let lon = asin(x / cos(lat));
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + 1.0) / 2.0; // Map [-1,1] to [0,1]
    let v = (projY + 1.0) / 2.0;
    return vec2f(clamp(u, 0.0, 1.0), clamp(1.0 - v, 0.0, 1.0));
}