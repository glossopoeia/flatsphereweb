import package::common::{HALF_PI};

const planar_scale: vec2f = vec2(4.0);

fn project(lat: f32, lon: f32) -> vec2f {
    let r = tan(HALF_PI - lat);
    return vec2f(r * sin(lon), -r * cos(lon));
}

fn inverse(x: f32, y: f32) -> vec2f {
    let r = sqrt(x * x + y * y);
    let lat = HALF_PI - atan(r);
    let lon = atan2(x, -y);
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + 4.0) / 8.0; // Map [-4,4] to [0,1]
    let v = (projY + 4.0) / 8.0;
    return vec2f(clamp(u, 0.0, 1.0), clamp(1.0 - v, 0.0, 1.0));
}