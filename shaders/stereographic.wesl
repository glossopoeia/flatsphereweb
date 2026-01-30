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