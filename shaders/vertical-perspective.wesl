const planar_scale: vec2f = vec2(1.5);

const D = 10.0;

fn project(lat: f32, lon: f32) -> vec2f {
    let cos_c = sin(lat);
    let k = (D - 1.0) / (D - cos_c);
    
    let x = k * cos(lat) * sin(lon);
    let y = k * sin(lat);
    return vec2f(x, y);
}

fn inverse(x: f32, y: f32) -> vec2f {
    let r = sqrt(x * x + y * y);
    if (r <= 0.0) {
        return vec2f(0.0, 0.0);
    }
    
    let max_r = sqrt((D - 1.0) / (D + 1.0));
    if (r > max_r) {
        return vec2f(-181.0, 0.0); // Outside visible sphere
    }
    
    let denom = (D - 1.0) / r + r / (D - 1.0);
    let numer = D - sqrt(1.0 - ((r * r * (D + 1.0)) / (D - 1.0)));
    let c = asin(numer / denom);
    
    let lat = asin((y * sin(c)) / r);
    let lon = atan2(x * sin(c), r * cos(c));
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let max_r = sqrt((D - 1.0) / (D + 1.0));
    let u = (projX + max_r) / (2.0 * max_r); // Map [-sqrt((d-1)/(d+1)),sqrt((d-1)/(d+1))] to [0,1]
    let v = (projY + max_r) / (2.0 * max_r);
    return vec2f(u, 1.0 - v);
}