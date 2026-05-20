import package::common::{PI, HALF_PI, SQRT_2};

// Goode Homolosine, except in the interrupted "land" arrangement.
//
// Six lobes total: 2 in the northern hemisphere (centered on North America and
// Eurasia/Africa) and 4 in the southern (Pacific, South America, Africa, Australia).
// The interruptions fall in the oceans, keeping the major landmasses intact.
//
// Hemisphere choice (which lobing scheme applies) is by sign of lat, not by transition_lat —
// so the sinusoidal middle band itself uses the northern lobing above the equator
// and the southern lobing below.
//
// Lobe definitions follow Goode's canonical land arrangement.

const transition_lat: f32 = 0.7109327;
const y_offset: f32 = 0.0528;
const y_max: f32 = SQRT_2 - y_offset;

const planar_scale: vec2f = vec2(PI, y_max);

const epsilon: f32 = 1e-15;
const max_iterations: u32 = 8u;

// Northern hemisphere: 2 lobes. center_*_N is the lobe's central meridian.
// edge_north_0 is the EASTERN boundary of lobe 0 (also the WESTERN boundary of lobe 1).
const center_north_0: f32 = -1.7453293;   // -100°  (North America)
const center_north_1: f32 =  0.5235988;   //   30°  (Eurasia + Africa)
const edge_north_0:   f32 = -0.6981317;   //  -40°

// Southern hemisphere: 4 lobes.
const center_south_0: f32 = -2.7925268;   // -160°  (Pacific)
const center_south_1: f32 = -1.0471976;   //  -60°  (South America)
const center_south_2: f32 =  0.3490659;   //   20°  (Africa)
const center_south_3: f32 =  2.4434610;   //  140°  (Australia)
const edge_south_0:   f32 = -1.7453293;   // -100°
const edge_south_1:   f32 = -0.3490659;   //  -20°
const edge_south_2:   f32 =  1.3962634;   //   80°

// Newton's method for the Mollweide auxiliary angle θ that satisfies
// 2θ + sin(2θ) = π·sin(lat). Same algorithm as in mollweide.wesl; converges
// quickly except very close to the poles.
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

// Non-interrupted Goode-Homolosine project, taking a longitude already shifted
// relative to a lobe's central meridian. Returns (x_rel, y) in that lobe's frame.
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

// Non-interrupted inverse, taking an x already shifted relative to a lobe's central
// meridian. Returns (lat, lon_rel); sentinel (-181, 0) if (x_rel, y) is outside
// the homolosine bounding curve.
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

fn project(lat: f32, lon: f32) -> vec2f {
    if (lat > 0.0) {
        // Northern hemisphere — 2 lobes
        if (lon <= edge_north_0) {
            let xy = homolosine_project_rel(lat, lon - center_north_0);
            return vec2f(xy.x + center_north_0, xy.y);
        }
        let xy = homolosine_project_rel(lat, lon - center_north_1);
        return vec2f(xy.x + center_north_1, xy.y);
    }
    // Southern hemisphere — 4 lobes
    if (lon <= edge_south_0) {
        let xy = homolosine_project_rel(lat, lon - center_south_0);
        return vec2f(xy.x + center_south_0, xy.y);
    }
    if (lon <= edge_south_1) {
        let xy = homolosine_project_rel(lat, lon - center_south_1);
        return vec2f(xy.x + center_south_1, xy.y);
    }
    if (lon <= edge_south_2) {
        let xy = homolosine_project_rel(lat, lon - center_south_2);
        return vec2f(xy.x + center_south_2, xy.y);
    }
    let xy = homolosine_project_rel(lat, lon - center_south_3);
    return vec2f(xy.x + center_south_3, xy.y);
}

fn inverse(x: f32, y: f32) -> vec2f {
    let sentinel = vec2f(-181.0, 0.0);

    if (y > 0.0) {
        // Northern hemisphere — 2 lobes
        if (x <= edge_north_0) {
            // Lobe 0 (center -100°, range [-PI, -40°])
            let result = homolosine_inverse_rel(x - center_north_0, y);
            if (result.x < -100.0) { return sentinel; }
            let lon = result.y + center_north_0;
            if (lon > edge_north_0) { return sentinel; }
            return vec2f(result.x, lon);
        }
        // Lobe 1 (center 30°, range [-40°, PI])
        let result = homolosine_inverse_rel(x - center_north_1, y);
        if (result.x < -100.0) { return sentinel; }
        let lon = result.y + center_north_1;
        if (lon < edge_north_0) { return sentinel; }
        return vec2f(result.x, lon);
    }

    // Southern hemisphere — 4 lobes
    if (x <= edge_south_0) {
        // Lobe 0 (center -160°, range [-PI, -100°])
        let result = homolosine_inverse_rel(x - center_south_0, y);
        if (result.x < -100.0) { return sentinel; }
        let lon = result.y + center_south_0;
        if (lon > edge_south_0) { return sentinel; }
        return vec2f(result.x, lon);
    }
    if (x <= edge_south_1) {
        // Lobe 1 (center -60°, range [-100°, -20°])
        let result = homolosine_inverse_rel(x - center_south_1, y);
        if (result.x < -100.0) { return sentinel; }
        let lon = result.y + center_south_1;
        if (lon < edge_south_0 || lon > edge_south_1) { return sentinel; }
        return vec2f(result.x, lon);
    }
    if (x <= edge_south_2) {
        // Lobe 2 (center 20°, range [-20°, 80°])
        let result = homolosine_inverse_rel(x - center_south_2, y);
        if (result.x < -100.0) { return sentinel; }
        let lon = result.y + center_south_2;
        if (lon < edge_south_1 || lon > edge_south_2) { return sentinel; }
        return vec2f(result.x, lon);
    }
    // Lobe 3 (center 140°, range [80°, PI])
    let result = homolosine_inverse_rel(x - center_south_3, y);
    if (result.x < -100.0) { return sentinel; }
    let lon = result.y + center_south_3;
    if (lon < edge_south_2) { return sentinel; }
    return vec2f(result.x, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + PI) / (2.0 * PI);
    let v = 1.0 - (projY + y_max) / (2.0 * y_max);
    return vec2f(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0));
}
