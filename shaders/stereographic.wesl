import package::common::{PI, HALF_PI};

const planar_scale: vec2f = vec2(3.0);

fn project(lat: f32, lon: f32) -> vec2f {
    let r = 1.0 / tan(lat / 2.0 + PI / 4.0);
    return vec2f(r * sin(lon), -r * cos(lon));
}

fn inverse(x: f32, y: f32) -> vec2f {
    let r = sqrt(x * x + y * y);
    let lat = HALF_PI - 2.0 * atan(r);
    let lon = atan2(x, -y);
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + 3.0) / 6.0; // Map [-3,3] to [0,1]
    let v = (projY + 3.0) / 6.0;
    return vec2f(clamp(u, 0.0, 1.0), clamp(1.0 - v, 0.0, 1.0));
}