import package::common::{PI, HALF_PI};

// Width of each parallel as a fraction of |λ_max|=π.
// At the equator, parallels extend to ±EQUATOR_FRACTION·π, resulting in triangular tips.
// At the poles, parallels extend to ±POLE_FRACTION·π, resulting in highly distorted flat polar edges.
const EQUATOR_FRACTION: f32 = 1;        // x_max = π at equator
const POLE_FRACTION: f32 = 0.33333333333333333;  // x_max = π/3 at pole

const planar_scale: vec2f = vec2(HALF_PI, HALF_PI);

fn meridian_factor(abs_lat: f32) -> f32 {
    return EQUATOR_FRACTION + (POLE_FRACTION - EQUATOR_FRACTION) * (abs_lat / HALF_PI);
}

fn project(lat: f32, lon: f32) -> vec2f {
    let factor = meridian_factor(abs(lat));
    return vec2f(lon * factor, lat);
}

fn inverse(x: f32, y: f32) -> vec2f {
    if (abs(y) > HALF_PI) {
        return vec2f(-181.0, 0.0);
    }
    let factor = meridian_factor(abs(y));
    let max_x = PI * factor;
    // don't let any potential visual artifacts outside the valid region
    if (abs(x) > max_x) {
        return vec2f(-181.0, 0.0);
    }
    return vec2f(y, x / factor);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let half_width = PI * EQUATOR_FRACTION;
    let u = clamp((projX + half_width) / (2.0 * half_width), 0.0, 1.0);
    let v = clamp((projY + HALF_PI) / PI, 0.0, 1.0);
    return vec2f(u, 1.0 - v);
}
