import package::common::{PI, HALF_PI};

const planar_scale: vec2f = vec2(1, 1);

fn project(lat: f32, lon: f32) -> vec2f {
    let z = sqrt(1.0 + cos(lat) * cos(lon / 2.0));
    let x = 2.0 * cos(lat) * sin(lon / 2.0) / z;
    let y = sin(lat) / z;
    return vec2f(x, y);
}

fn inverse(x: f32, y: f32) -> vec2f {
    // keep out artifacts around the edges by rejecting inputs that would
    // make the inverse projection's sqrt go negative.
    let z2 = 1.0 - x*x/8.0 - y*y/2.0;
    if (z2 < 0.0) {
        return vec2f(-181.0, 0.0);
    }

    let z = sqrt(z2);
    var shift = 0.0;
    let hypot = sqrt(x*x/4.0 + y*y);
    if (hypot > 1.0) {
        shift = 2.0 * PI;
        if (x < 0.0) {
            shift = -shift;
        }
    }
    var preAsin = z * y * sqrt(2.0);
    if (preAsin > 1.0 && preAsin < 1.0 + 1e-9) {
        preAsin = 1.0;
    }
    if (preAsin < -1.0 && preAsin > -1.0 - 1e-9) {
        preAsin = -1.0;
    }
    let lat = asin(preAsin);
    let lon = 2.0 * atan(sqrt(0.5) * z * x / (2.0 * z * z - 1.0)) + shift;
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = clamp((projX + PI) / (2.0 * PI), 0.0, 1.0); // Map [-PI,PI] to [0,1]
    let v = clamp((projY + HALF_PI) / PI, 0.0, 1.0);    // Map [-PI/2,PI/2] to [0,1]
    return vec2f(u, 1.0 - v);
}