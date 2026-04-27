import package::common::{PI};

const planar_scale: vec2f = vec2(1.0);

fn project(lat: f32, lon: f32) -> vec2f {
    let p = (1.0 + sin(lat)) / (1.0 - sin(lat));
    let v = pow(p, 0.25);
    let c = (v + 1.0 / v) / 2.0 + cos(lon / 2.0);
    let x = sin(lon / 2.0) / c;
    let y = (v - 1.0 / v) / (2.0 * c);
    return vec2f(x, y);
}

fn inverse(x: f32, y: f32) -> vec2f {
    let r2 = x*x + y*y;
    let th = 2.0 * y / (1.0 + r2);
    if th == 1.0 {
        if sign(y) >= 0.0 {
            return vec2f(-PI / 2.0, 0.0);
        } else {
            return vec2f(PI / 2.0, 0.0);
        }
    }
    let t = pow((1.0 + th) / (1.0 - th), 2.0);
    let lat = asin((t - 1.0) / (t + 1.0));
    let lon = 2.0 * atan2(2.0 * x, 1.0 - r2);
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = clamp((projX + 1.0) / 2.0, 0.0, 1.0); // Map [-1,1] to [0,1]
    let v = clamp((projY + 1.0) / 2.0, 0.0, 1.0); // Map [-1,1] to [0,1]
    return vec2f(u, 1.0 - v);
}