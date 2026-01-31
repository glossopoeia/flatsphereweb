import package::common::{PI};

const planar_scale: vec2f = vec2(PI, 3.0);

fn project(lat: f32, lon: f32) -> vec2f {
    return vec2f(lon, log(tan(PI / 4.0 + lat / 2.0)));
}

fn inverse(x: f32, y: f32) -> vec2f {
    let lat = atan(sinh(y));
    let lon = x;
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + PI) / (2.0 * PI); // Map [-π,π] to [0,1]
    let v = clamp((projY + 3.0) / 6.0, 0.0, 1.0); // Map approximately [-3,3] to [0,1]
    return vec2f(u, 1.0 - v);
}