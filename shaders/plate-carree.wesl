import package::common::{PI, HALF_PI};

const planar_scale: vec2f = vec2(PI, HALF_PI);

fn project(lat: f32, lon: f32) -> vec2f {
    return vec2f(lon, lat);
}

fn inverse(x: f32, y: f32) -> vec2f {
    return vec2f(y, x);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + PI) / (2.0 * PI);
    let v = 1.0 - (projY + HALF_PI) / PI;
    return vec2f(u, clamp(v, 0.0, 1.0));
} 