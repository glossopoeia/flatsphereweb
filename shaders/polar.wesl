import package::common::{HALF_PI};

const planar_scale: vec2f = vec2(2.0);

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