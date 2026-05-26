import package::common::{PI, HALF_PI, SQRT_2};

// Goode Homolosine with three states supported: uninterrupted, land-interrupted, or ocean-interrupted.
// The "arrangement" projection parameter (set via set_extra_params) selects which is drawn in real time:
//   0 = uninterrupted, 1 = land interrupted, 2 = ocean interrupted.
//
// Homolosine composites the sinusoidal projection (lower latitudes) with the
// Mollweide projection (higher latitudes); the Mollweide half is y-shifted by y_offset
// so the two meet continuously. Both halves are equal-area, so the composite is too.
//
// For the interrupted arrangements, which lobing scheme applies is chosen by the sign of
// latitude, not by transition_lat -- so the sinusoidal middle band uses the northern
// lobing above the equator and the southern lobing below.

const transition_lat: f32 = 0.7109327; // transition latitude in radians (~40°44'11.8")
const y_offset: f32 = 0.0528; // = sqrt(2) * sin(theta_t) - transition_lat, precomputed
const y_max: f32 = SQRT_2 - y_offset;

const planar_scale: vec2f = vec2(PI, y_max);

const epsilon: f32 = 1e-15;
const max_iterations: u32 = 8u;

// --- Land (continental) arrangement: 2 northern lobes, 4 southern ---
// center_* is a lobe's central meridian; edge_* is the boundary between adjacent lobes.
const land_center_n0: f32 = -1.7453293;   // -100°  North America
const land_center_n1: f32 =  0.5235988;   //   30°  Eurasia + Africa
const land_edge_n0:   f32 = -0.6981317;   //  -40°

const land_center_s0: f32 = -2.7925268;   // -160°  Pacific
const land_center_s1: f32 = -1.0471976;   //  -60°  South America
const land_center_s2: f32 =  0.3490659;   //   20°  Africa
const land_center_s3: f32 =  2.4434610;   //  140°  Australia
const land_edge_s0:   f32 = -1.7453293;   // -100°
const land_edge_s1:   f32 = -0.3490659;   //  -20°
const land_edge_s2:   f32 =  1.3962634;   //   80°

// --- Ocean arrangement: 3 northern lobes, 3 southern ---
const ocean_center_n0: f32 = -2.4434610;   // -140°
const ocean_center_n1: f32 = -0.1745329;   //  -10°
const ocean_center_n2: f32 =  2.2689280;   //  130°
const ocean_edge_n0:   f32 = -1.5707963;   //  -90°
const ocean_edge_n1:   f32 =  1.0471976;   //   60°

const ocean_center_s0: f32 = -1.9198622;   // -110°
const ocean_center_s1: f32 =  0.3490659;   //   20°
const ocean_center_s2: f32 =  2.6179939;   //  150°
const ocean_edge_s0:   f32 = -1.0471976;   //  -60°
const ocean_edge_s1:   f32 =  1.5707963;   //   90°

// Arrangement selector: 0 = uninterrupted, 1 = land, 2 = ocean.
var<private> goode_arrangement: f32 = 0.0;

fn set_extra_params(p: vec4f) {
    goode_arrangement = p.x;
}

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

// Homolosine forward projection of a longitude already shifted relative to a lobe's
// central meridian. Returns (x_rel, y) in that lobe's frame.
fn homolosine_project_rel(lat: f32, lon_rel: f32) -> vec2f {
    if (abs(lat) <= transition_lat) {
        return vec2f(lon_rel * cos(lat), lat);
    }
    let theta = mollweide_theta(lat);
    let x = (2.0 * SQRT_2 / PI) * lon_rel * cos(theta);
    let y_moll = SQRT_2 * sin(theta);
    let y = y_moll - sign(lat) * y_offset;
    return vec2f(x, y);
}

// Homolosine inverse for an x already shifted relative to a lobe's central meridian.
// Returns (lat, lon_rel); sentinel (-181, 0) if (x_rel, y) is outside the bounding curve.
fn homolosine_inverse_rel(x_rel: f32, y: f32) -> vec2f {
    if (abs(y) <= transition_lat) {
        let lat = y;
        let cos_lat = cos(lat);
        if (abs(x_rel) > PI * cos_lat) {
            return vec2f(-181.0, 0.0);
        }
        return vec2f(lat, x_rel / cos_lat);
    }
    let y_moll = y + sign(y) * y_offset;
    if (abs(y_moll) > SQRT_2) {
        return vec2f(-181.0, 0.0);
    }
    let theta = asin(clamp(y_moll / SQRT_2, -1.0, 1.0));
    let lat = asin(clamp((2.0 * theta + sin(2.0 * theta)) / PI, -1.0, 1.0));
    let cos_theta = cos(theta);
    if (abs(cos_theta) < epsilon) {
        return vec2f(lat, 0.0);  // poles — longitude undefined
    }
    if (abs(x_rel) > 2.0 * SQRT_2 * cos_theta) {
        return vec2f(-181.0, 0.0);
    }
    return vec2f(lat, x_rel * PI / (2.0 * SQRT_2 * cos_theta));
}

// --- Forward projection per arrangement ---

fn project_land(lat: f32, lon: f32) -> vec2f {
    if (lat > 0.0) {
        // Northern hemisphere — 2 lobes
        if (lon <= land_edge_n0) {
            let xy = homolosine_project_rel(lat, lon - land_center_n0);
            return vec2f(xy.x + land_center_n0, xy.y);
        }
        let xy = homolosine_project_rel(lat, lon - land_center_n1);
        return vec2f(xy.x + land_center_n1, xy.y);
    }
    // Southern hemisphere — 4 lobes
    if (lon <= land_edge_s0) {
        let xy = homolosine_project_rel(lat, lon - land_center_s0);
        return vec2f(xy.x + land_center_s0, xy.y);
    }
    if (lon <= land_edge_s1) {
        let xy = homolosine_project_rel(lat, lon - land_center_s1);
        return vec2f(xy.x + land_center_s1, xy.y);
    }
    if (lon <= land_edge_s2) {
        let xy = homolosine_project_rel(lat, lon - land_center_s2);
        return vec2f(xy.x + land_center_s2, xy.y);
    }
    let xy = homolosine_project_rel(lat, lon - land_center_s3);
    return vec2f(xy.x + land_center_s3, xy.y);
}

fn project_ocean(lat: f32, lon: f32) -> vec2f {
    if (lat > 0.0) {
        // Northern hemisphere — 3 lobes
        if (lon <= ocean_edge_n0) {
            let xy = homolosine_project_rel(lat, lon - ocean_center_n0);
            return vec2f(xy.x + ocean_center_n0, xy.y);
        }
        if (lon <= ocean_edge_n1) {
            let xy = homolosine_project_rel(lat, lon - ocean_center_n1);
            return vec2f(xy.x + ocean_center_n1, xy.y);
        }
        let xy = homolosine_project_rel(lat, lon - ocean_center_n2);
        return vec2f(xy.x + ocean_center_n2, xy.y);
    }
    // Southern hemisphere — 3 lobes
    if (lon <= ocean_edge_s0) {
        let xy = homolosine_project_rel(lat, lon - ocean_center_s0);
        return vec2f(xy.x + ocean_center_s0, xy.y);
    }
    if (lon <= ocean_edge_s1) {
        let xy = homolosine_project_rel(lat, lon - ocean_center_s1);
        return vec2f(xy.x + ocean_center_s1, xy.y);
    }
    let xy = homolosine_project_rel(lat, lon - ocean_center_s2);
    return vec2f(xy.x + ocean_center_s2, xy.y);
}

fn project(lat: f32, lon: f32) -> vec2f {
    if (goode_arrangement < 0.5) {
        // Uninterrupted: a single lobe centered on the prime meridian.
        return homolosine_project_rel(lat, lon);
    }
    if (goode_arrangement < 1.5) {
        return project_land(lat, lon);
    }
    return project_ocean(lat, lon);
}

// --- Inverse projection per arrangement ---
// Each lobe is selected by the projected x relative to the lobe edges, then validated:
// homolosine_inverse_rel returns the (-181, 0) sentinel outside its bounding curve, and
// a recovered longitude outside the lobe's range is rejected (interruption gaps).

fn inverse_land(x: f32, y: f32) -> vec2f {
    let sentinel = vec2f(-181.0, 0.0);
    if (y > 0.0) {
        // Northern hemisphere — 2 lobes
        if (x <= land_edge_n0) {
            let result = homolosine_inverse_rel(x - land_center_n0, y);
            if (result.x < -100.0) { return sentinel; }
            let lon = result.y + land_center_n0;
            if (lon > land_edge_n0) { return sentinel; }
            return vec2f(result.x, lon);
        }
        let result = homolosine_inverse_rel(x - land_center_n1, y);
        if (result.x < -100.0) { return sentinel; }
        let lon = result.y + land_center_n1;
        if (lon < land_edge_n0) { return sentinel; }
        return vec2f(result.x, lon);
    }
    // Southern hemisphere — 4 lobes
    if (x <= land_edge_s0) {
        let result = homolosine_inverse_rel(x - land_center_s0, y);
        if (result.x < -100.0) { return sentinel; }
        let lon = result.y + land_center_s0;
        if (lon > land_edge_s0) { return sentinel; }
        return vec2f(result.x, lon);
    }
    if (x <= land_edge_s1) {
        let result = homolosine_inverse_rel(x - land_center_s1, y);
        if (result.x < -100.0) { return sentinel; }
        let lon = result.y + land_center_s1;
        if (lon < land_edge_s0 || lon > land_edge_s1) { return sentinel; }
        return vec2f(result.x, lon);
    }
    if (x <= land_edge_s2) {
        let result = homolosine_inverse_rel(x - land_center_s2, y);
        if (result.x < -100.0) { return sentinel; }
        let lon = result.y + land_center_s2;
        if (lon < land_edge_s1 || lon > land_edge_s2) { return sentinel; }
        return vec2f(result.x, lon);
    }
    let result = homolosine_inverse_rel(x - land_center_s3, y);
    if (result.x < -100.0) { return sentinel; }
    let lon = result.y + land_center_s3;
    if (lon < land_edge_s2) { return sentinel; }
    return vec2f(result.x, lon);
}

fn inverse_ocean(x: f32, y: f32) -> vec2f {
    let sentinel = vec2f(-181.0, 0.0);
    if (y > 0.0) {
        // Northern hemisphere — 3 lobes
        if (x <= ocean_edge_n0) {
            let result = homolosine_inverse_rel(x - ocean_center_n0, y);
            if (result.x < -100.0) { return sentinel; }
            let lon = result.y + ocean_center_n0;
            if (lon > ocean_edge_n0) { return sentinel; }
            return vec2f(result.x, lon);
        }
        if (x <= ocean_edge_n1) {
            let result = homolosine_inverse_rel(x - ocean_center_n1, y);
            if (result.x < -100.0) { return sentinel; }
            let lon = result.y + ocean_center_n1;
            if (lon < ocean_edge_n0 || lon > ocean_edge_n1) { return sentinel; }
            return vec2f(result.x, lon);
        }
        let result = homolosine_inverse_rel(x - ocean_center_n2, y);
        if (result.x < -100.0) { return sentinel; }
        let lon = result.y + ocean_center_n2;
        if (lon < ocean_edge_n1) { return sentinel; }
        return vec2f(result.x, lon);
    }
    // Southern hemisphere — 3 lobes
    if (x <= ocean_edge_s0) {
        let result = homolosine_inverse_rel(x - ocean_center_s0, y);
        if (result.x < -100.0) { return sentinel; }
        let lon = result.y + ocean_center_s0;
        if (lon > ocean_edge_s0) { return sentinel; }
        return vec2f(result.x, lon);
    }
    if (x <= ocean_edge_s1) {
        let result = homolosine_inverse_rel(x - ocean_center_s1, y);
        if (result.x < -100.0) { return sentinel; }
        let lon = result.y + ocean_center_s1;
        if (lon < ocean_edge_s0 || lon > ocean_edge_s1) { return sentinel; }
        return vec2f(result.x, lon);
    }
    let result = homolosine_inverse_rel(x - ocean_center_s2, y);
    if (result.x < -100.0) { return sentinel; }
    let lon = result.y + ocean_center_s2;
    if (lon < ocean_edge_s1) { return sentinel; }
    return vec2f(result.x, lon);
}

fn inverse(x: f32, y: f32) -> vec2f {
    if (goode_arrangement < 0.5) {
        return homolosine_inverse_rel(x, y);
    }
    if (goode_arrangement < 1.5) {
        return inverse_land(x, y);
    }
    return inverse_ocean(x, y);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + PI) / (2.0 * PI);
    let v = 1.0 - (projY + y_max) / (2.0 * y_max);
    return vec2f(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0));
}
