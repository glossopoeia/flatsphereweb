import package::common::{HALF_PI};

const planar_scale: vec2f = vec2(2.0);

// Standard-scale polar Lambert azimuthal equal-area (Snyder 1987, eq. 24-13):
// r = 2 sin(c/2) with c the angular distance from the center, written here via the
// colatitude identity 2 cos((pi/2 + lat)/2) = 2 sin((pi/2 - lat)/2). The factor 2
// gives unit scale at the center (equal-area, a*b = 1 in these units), so the
// distortion overlay's areal metric reads correctly.
fn project(lat: f32, lon: f32) -> vec2f {
    let r = 2.0 * cos((HALF_PI + lat) / 2.0);
    return vec2f(r * sin(lon), -r * cos(lon));
}

fn inverse(x_in: f32, y_in: f32) -> vec2f {
    // The inverse formulas below are written for the unit-disc form; shrink the
    // standard-scale plane coordinates back down before applying them.
    let x = x_in / 2.0;
    let y = y_in / 2.0;
    let r = sqrt(x * x + y * y);
    if (r > 1.0) {
        return vec2f(-181.0, 0.0); // Outside sphere
    }
    let lat = asin(1.0 - 2.0 * r * r);
    let lon = atan2(x, -y);
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let x = projX / 2.0;
    let y = projY / 2.0;
    let u = (x + 1.0) / 2.0; // Map [-1,1] to [0,1]
    let v = (y + 1.0) / 2.0;
    return vec2f(clamp(u, 0.0, 1.0), clamp(1.0 - v, 0.0, 1.0));
}

fn set_extra_params(p: vec4f) { }
