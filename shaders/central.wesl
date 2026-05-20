import package::common::{PI};

// y = tan(lat) is unbounded at the poles, so the vertical extent is a windowing
// choice. PI windows the height to match the width (±π), showing latitudes out to
// ±atan(π) ≈ ±72°.
const planar_scale: vec2f = vec2(PI, PI);

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
    let v = clamp((projY + PI) / (2.0 * PI), 0.0, 1.0); // Map [-π,π] to [0,1]
    return vec2f(u, 1.0 - v);
}