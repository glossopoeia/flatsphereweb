import package::common::{PI};

const planar_scale: vec2f = vec2(PI, 1.0);

fn project(lat: f32, lon: f32) -> vec2f {
    return vec2f(lon, tan(lat));
}

fn inverse(x: f32, y: f32) -> vec2f {
    let lat = atan(y);
    let lon = x;
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + PI) / (2.0 * PI); // Map [-π,π] to [0,1]
    let v = clamp((projY + 6.0) / 12.0, 0.0, 1.0); // Map approximately [-6,6] to [0,1]
    return vec2f(u, 1.0 - v);
}