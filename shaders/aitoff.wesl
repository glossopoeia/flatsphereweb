import package::common::{PI, HALF_PI};

const planar_scale: vec2f = vec2(HALF_PI, HALF_PI);

fn project(lat: f32, lon: f32) -> vec2f {
    let a = acos(cos(lat) * cos(lon / 2.0));
    // a/sin(a) → 1 as a → 0; guard the 0/0 singularity at (lat=0, lon=0)
    let sinc_a = select(a / sin(a), 1.0, a < 1e-6);
    let x = 2.0 * cos(lat) * sin(lon / 2.0) * sinc_a;
    let y = sin(lat) * sinc_a;
    return vec2f(x, y);
}

fn inverse(x: f32, y: f32) -> vec2f {
    // keep out artifacts around the edges
    if (x * x + 4.0 * y * y > PI * PI) {
        return vec2f(-181.0, 0.0);
    }
    // Aitoff is the equatorial azimuthal-equidistant of (lat, lon/2) with x doubled,
    // so (x/2, y) is azimuthal-equidistant coordinates and α = sqrt((x/2)² + y²) recovers
    // the angular distance directly — no iteration needed.
    let half_x = x / 2.0;
    let alpha = sqrt(half_x * half_x + y * y);
    if (alpha < 1e-6) {
        return vec2f(y, x);
    }
    let sin_alpha = sin(alpha);
    let lat = asin(clamp(y * sin_alpha / alpha, -1.0, 1.0));
    let lon = 2.0 * atan2(half_x * sin_alpha, alpha * cos(alpha));
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = clamp((projX + PI) / (2.0 * PI), 0.0, 1.0); // Map [-PI,PI] to [0,1]
    let v = clamp((projY + HALF_PI) / PI, 0.0, 1.0);    // Map [-PI/2,PI/2] to [0,1]
    return vec2f(u, 1.0 - v);
}
