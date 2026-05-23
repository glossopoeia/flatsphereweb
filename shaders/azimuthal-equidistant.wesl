import package::common::{PI, HALF_PI};

const planar_scale: vec2f = vec2(PI);

fn project(lat: f32, lon: f32) -> vec2f {
    let r = HALF_PI - lat;
    return vec2f(r * sin(lon), -r * cos(lon));
}

fn inverse(x: f32, y: f32) -> vec2f {
    let r = sqrt(x * x + y * y);
    let lat = HALF_PI - r;
    let lon = atan2(x, -y);
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + PI) / (2.0 * PI); // Map [-π,π] to [0,1]
    let v = (projY + PI) / (2.0 * PI);
    return vec2f(clamp(u, 0.0, 1.0), clamp(1.0 - v, 0.0, 1.0));
}

fn set_extra_params(p: vec4f) { }
