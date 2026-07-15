import package::common::{PI, HALF_PI};

// Winkel-Tripel: a compromise projection that is the arithmetic mean of the equirectangular
// (equidistant cylindrical, at standard parallel φ₁ = arccos(2/π) ≈ 50.46°) and the Aitoff
// projection. The "Tripel" (triple) refers to Winkel's aim of minimizing area, direction,
// and distance distortion together, but it is neither equal-area nor conformal.
//
// The forward map is closed-form; the inverse has no closed form. We solve it with Newton-
// Raphson on the forward map using the analytic Jacobian, seeded by the closed-form Aitoff
// inverse (the "long-hidden" inversion of the projection's Aitoff half). A pure
// Aitoff-inverse fixed-point iteration was tried first but diverges in the high-distortion
// polar/antimeridian corners, so the closed-form inverse is used to seed Newton instead.

const cos_phi1: f32 = 0.63661977236758134;   // 2/π — cosine of the standard parallel φ₁
const x_max: f32 = 1.0 + HALF_PI;            // equatorial extent: ½(π·(2/π) + π) = 1 + π/2
const planar_scale: vec2f = vec2(x_max, HALF_PI);

const max_iterations: u32 = 8u;
const converge_eps: f32 = 1e-6;   // f32 residual floor; loop breaks once it is reached
const reject_tol: f32 = 2e-3;     // round-trip tolerance separating interior from outside

fn set_extra_params(p: vec4f) { }

// --- Aitoff helpers (Aitoff is the other half of the Winkel-Tripel average) ---

// Aitoff forward, see aitoff.wesl for explanation of numeric compute choices made here.
fn aitoff_forward(lat: f32, lon: f32) -> vec2f {
    let sin_half_lon = sin(lon / 2.0);
    let cos_half_lon = cos(lon / 2.0);
    let sin_lat = sin(lat);
    let cos_lat = cos(lat);
    let cos_alpha = cos_lat * cos_half_lon;
    let sin_alpha = length(vec2f(cos_lat * sin_half_lon, sin_lat));
    let A = select(atan2(sin_alpha, cos_alpha) / sin_alpha, 1.0,
                   sin_alpha < 1e-6 && cos_alpha > 0.0);
    return vec2f(2.0 * cos_lat * sin_half_lon * A, sin_lat * A);
}

// Aitoff closed-form inverse (Snyder 1987, pp. 195–197)
fn aitoff_inverse(x: f32, y: f32) -> vec2f {
    let half_x = x / 2.0;
    let alpha = length(vec2f(half_x, y));
    let sinc_alpha = select(sin(alpha) / alpha, 1.0, alpha < 1e-6);
    return vec2f(asin(clamp(y * sinc_alpha, -1.0, 1.0)),
                 2.0 * atan2(half_x * sinc_alpha, cos(alpha)));
}

// --- Winkel-Tripel ---

// Forward: arithmetic mean of the equirectangular (standard parallel φ₁) and Aitoff projections.
fn project(lat: f32, lon: f32) -> vec2f {
    let a = aitoff_forward(lat, lon);
    return vec2f(0.5 * (lon * cos_phi1 + a.x), 0.5 * (lat + a.y));
}

// Analytic Jacobian of project(): (∂x/∂lat, ∂x/∂lon, ∂y/∂lat, ∂y/∂lon). D = α/sinα and
// K = (1 − D·cosα)/sin²α both have removable singularities at α→0 (limits 1 and ⅓).
fn winkel_jacobian(lat: f32, lon: f32) -> vec4f {
    let psi = lon / 2.0;
    let cphi = cos(lat); let sphi = sin(lat);
    let cpsi = cos(psi); let spsi = sin(psi);
    let c = cphi * cpsi;                            // cos α
    // sin α from components (sin²α = cos²φ·sin²ψ + sin²φ): good relative accuracy at
    // small α, where 1 − c² cancels catastrophically in f32
    let s = length(vec2f(cphi * spsi, sphi));
    let alpha = atan2(s, c);
    var d: f32; var k: f32;
    // Taylor branch below α = 1e-2: the direct K loses to cancellation in 1 − D·cosα
    // there (it can even go negative), while truncating K = 1/3 + (2/15)α² + O(α⁴) to
    // its constant costs only ~4e-5 relative at the branch point
    if (alpha < 1e-2) {
        d = 1.0 + alpha * alpha / 6.0;
        k = 1.0 / 3.0;
    } else {
        // floor s away from the other removable end: Newton's unwrapped lon can reach
        // α = π, where the component form gives s = 0 exactly
        let ss = max(s, 1e-6);
        d = alpha / ss;
        k = (1.0 - d * c) / (ss * ss);
    }
    let dxa_dphi = 2.0 * spsi * (-sphi * d + cphi * sphi * cpsi * k);
    let dxa_dlam = cphi * cpsi * d + cphi * cphi * spsi * spsi * k;
    let dya_dphi = cphi * d + sphi * sphi * cpsi * k;
    let dya_dlam = sphi * cphi * spsi * k / 2.0;
    return vec4f(0.5 * dxa_dphi, 0.5 * (cos_phi1 + dxa_dlam),
                 0.5 * (1.0 + dya_dphi), 0.5 * dya_dlam);
}

fn inverse(x: f32, y: f32) -> vec2f {
    // Seed with one Aitoff-inverse peel step: from a rough (φ₀,λ₀), remove the equirectangular
    // term and invert the Aitoff remainder in closed form.
    let lat0 = y;
    let lon0 = 2.0 * x / (1.0 + cos_phi1);
    let seed = aitoff_inverse(2.0 * x - lon0 * cos_phi1, 2.0 * y - lat0);
    var lat = seed.x;
    var lon = seed.y;
    // Newton–Raphson on the forward map. λ is NOT wrapped inside the loop: wrapping flips
    // points across the ±180° seam and stalls convergence at the antimeridian rim.
    for (var i = 0u; i < max_iterations; i++) {
        let f = project(lat, lon);
        let rx = f.x - x;
        let ry = f.y - y;
        if (abs(rx) + abs(ry) < converge_eps) {
            break;
        }
        let j = winkel_jacobian(lat, lon);
        let det = j.x * j.w - j.y * j.z;
        if (abs(det) < 1e-10) {
            break;
        }
        var dlat = (j.w * rx - j.y * ry) / det;
        var dlon = (j.x * ry - j.z * rx) / det;
        // Damp oversized steps so a far seed can't overshoot into a wrong basin.
        let m = max(abs(dlat), abs(dlon));
        if (m > 0.8) {
            dlat = dlat * 0.8 / m;
            dlon = dlon * 0.8 / m;
        }
        lat = clamp(lat - dlat, -HALF_PI, HALF_PI);
        lon = lon - dlon;
    }
    // Reject points outside the projection outline. A real preimage is on the sphere
    // (|lat| ≤ π/2 and |lon| ≤ π) and reproduces the input under the forward map. The |lon|
    // bound is essential: the forward map continues past the antimeridian, so for an exterior
    // pixel Newton can converge to an out-of-range longitude whose forward also equals (x, y).
    // That passes the round-trip check below, so without this bound it renders as a distorted
    // duplicate of the map outside the outline.
    if (abs(lat) > HALF_PI + 1e-3 || abs(lon) > PI + 1e-3) {
        return vec2f(-181.0, 0.0);
    }
    let check = project(lat, lon);
    if (abs(check.x - x) + abs(check.y - y) > reject_tol) {
        return vec2f(-181.0, 0.0);
    }
    // Wrap longitude into [-π, π] for sampling (Newton ran unwrapped).
    return vec2f(lat, atan2(sin(lon), cos(lon)));
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + x_max) / (2.0 * x_max);
    let v = 1.0 - (projY + HALF_PI) / PI;
    return vec2f(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0));
}
