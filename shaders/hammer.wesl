import package::common::{PI, SQRT_2};

const planar_scale: vec2f = vec2(2.0 * SQRT_2, SQRT_2);

// Standard-scale Hammer (Snyder 1987, eqs. 24-1..24-2): the sqrt(2) factors give the
// projection unit area scale (it is equal-area with a*b = 1 in these units), so the
// distortion overlay's areal metric reads correctly.
fn project(lat: f32, lon: f32) -> vec2f {
    let z = sqrt(1.0 + cos(lat) * cos(lon / 2.0));
    let x = 2.0 * SQRT_2 * cos(lat) * sin(lon / 2.0) / z;
    let y = SQRT_2 * sin(lat) / z;
    return vec2f(x, y);
}

fn inverse(x_in: f32, y_in: f32) -> vec2f {
    // The inverse formulas below are written for the unit-scale form; shrink the
    // standard-scale plane coordinates back down before applying them.
    let x = x_in / SQRT_2;
    let y = y_in / SQRT_2;

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
    let x = projX / SQRT_2;
    let y = projY / SQRT_2;
    let u = clamp((x + 2.0) / 4.0, 0.0, 1.0); // Map [-2,2] to [0,1]
    let v = clamp((y + 1.0) / 2.0, 0.0, 1.0); // Map [-1,1] to [0,1]
    return vec2f(u, 1.0 - v);
}

fn set_extra_params(p: vec4f) { }
