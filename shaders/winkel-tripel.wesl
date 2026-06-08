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

// Aitoff forward
fn aitoff_forward(lat: f32, lon: f32) -> vec2f {
    let a = acos(clamp(cos(lat) * cos(lon / 2.0), -1.0, 1.0));
    let d = select(a / sin(a), 1.0, a < 1e-6);   // α/sin α → 1 as α → 0
    return vec2f(2.0 * cos(lat) * sin(lon / 2.0) * d, sin(lat) * d);
}

// Aitoff closed-form inverse
fn aitoff_inverse(x: f32, y: f32) -> vec2f {
    let half_x = x / 2.0;
    let alpha = sqrt(half_x * half_x + y * y);
    if (alpha < 1e-6) {
        return vec2f(y, x);
    }
    let sin_alpha = sin(alpha);
    return vec2f(asin(clamp(y * sin_alpha / alpha, -1.0, 1.0)),
                 2.0 * atan2(half_x * sin_alpha, alpha * cos(alpha)));
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
    let c = clamp(cphi * cpsi, -1.0, 1.0);          // cos α
    let alpha = acos(c);
    let s = sqrt(max(1.0 - c * c, 1e-12));          // sin α
    var d: f32; var k: f32;
    if (alpha < 1e-4) {
        d = 1.0 + alpha * alpha / 6.0;
        k = 1.0 / 3.0;
    } else {
        d = alpha / s;
        k = (1.0 - d * c) / (s * s);
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
    // Reject points outside the projection outline: a real preimage is on the sphere and
    // reproduces the input under the forward map.
    if (abs(lat) > HALF_PI + 1e-3) {
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
