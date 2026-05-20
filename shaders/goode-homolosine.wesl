import package::common::{PI, HALF_PI, SQRT_2};

// Goode Homolosine is a composite of sinusoidal (low latitudes) and Mollweide
// (high latitudes). The two halves meet at transition_lat (≈40°44'11.8"); the Mollweide half is
// y-shifted by y_offset so its y at the transition equals the sinusoidal's y there, producing
// a continuous (if slightly kinked at the meridians far from λ=0) composite.
//
// Both halves are equal-area at their native scales, so the composite is equal-area too.

const transition_lat: f32 = 0.7109327; // transition latitude in radians
const y_offset: f32 = 0.0528; // = sqrt(2) * sin(theta_t) - transition_lat, precomputed
const y_max: f32 = SQRT_2 - y_offset;

const planar_scale: vec2f = vec2(PI, y_max);

const epsilon: f32 = 1e-15;
const max_iterations: u32 = 8u;

// Mollweide's theta calculation, same as in the pure Mollweide shader. Factored here for readability.
fn mollweide_theta(lat: f32) -> f32 {
    let target_val = PI * sin(lat);
    var theta = lat;
    for (var i = 0u; i < max_iterations; i++) {
        let numer = 2.0 * theta + sin(2.0 * theta) - target_val;
        let denom = 2.0 + 2.0 * cos(2.0 * theta);
        theta = theta - (numer / denom);
    }
    return theta;
}

fn project(lat: f32, lon: f32) -> vec2f {
    if (abs(lat) <= transition_lat) {
        // Sinusoidal
        return vec2f(lon * cos(lat), lat);
    }
    // Mollweide portion, y-shifted to meet sinusoidal at the transition.
    let theta = mollweide_theta(lat);
    let x = (2.0 * SQRT_2 / PI) * lon * cos(theta);
    let y_moll = SQRT_2 * sin(theta);
    let y = y_moll - sign(lat) * y_offset;
    return vec2f(x, y);
}

fn inverse(x: f32, y: f32) -> vec2f {
    if (abs(y) <= transition_lat) {
        // Sinusoidal inverse
        let lat = y;
        let cos_lat = cos(lat);
        if (abs(x) > PI * cos_lat) {
            return vec2f(-181.0, 0.0);  // outside the projection's bounding curve
        }
        let lon = x / cos_lat;
        return vec2f(lat, lon);
    }

    // Undo the y-offset, then standard Mollweide inverse.
    let y_moll = y + sign(y) * y_offset;
    if (abs(y_moll) > SQRT_2) {
        return vec2f(-181.0, 0.0);
    }
    let theta = asin(clamp(y_moll / SQRT_2, -1.0, 1.0));
    let lat = asin(clamp((2.0 * theta + sin(2.0 * theta)) / PI, -1.0, 1.0));
    let cos_theta = cos(theta);
    var lon: f32;
    if (abs(cos_theta) < epsilon) {
        lon = 0.0;  // at the poles, longitude is undefined
    } else {
        if (abs(x) > 2.0 * SQRT_2 * cos_theta) {
            return vec2f(-181.0, 0.0);
        }
        lon = x * PI / (2.0 * SQRT_2 * cos_theta);
    }
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + PI) / (2.0 * PI);
    let v = 1.0 - (projY + y_max) / (2.0 * y_max);
    return vec2f(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0));
}
