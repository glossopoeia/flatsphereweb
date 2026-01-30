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