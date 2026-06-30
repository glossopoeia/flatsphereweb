import package::common::{PI};

// Wagner IX (Aitoff-Wagner): Karlheinz Wagner's 1949 modification of Aitoff that gives the
// poles a finite, gently curved line instead of a single point. It applies the Aitoff
// construction to PRE-SCALED coordinates, then rescales the result:
//
//   φ' = asin(m · sin φ),   λ' = n · λ,   (x, y) = (sx, sy) · Aitoff(φ', λ')
//
// Because Aitoff is closed-form both ways, so is Wagner IX: the inverse undoes the output
// scaling, runs the closed-form Aitoff inverse (reused verbatim — the very point of the
// construction), then undoes the input scaling. The aitoff_forward / aitoff_inverse helpers
// below are the same Aitoff building blocks used in aitoff.wesl and composed in
// winkel-tripel.wesl; Wagner IX just feeds them renumbered coordinates and rescales.
//
// Constants: m = 7/9 (pole-line length) and n = 5/9 (meridian curvature) are Wagner's originals
// (Tobias Jung / Canters). The output scales are not independent magic numbers — sx = 1/n and
// sy = 1/m give true scale at the centre of the map in both axes (∂x/∂λ = ∂y/∂φ = 1 at the
// origin). Their balance fixes the map's aspect (half-width:half-height = π : Y_MAX ≈ 2.49), and
// that single affine degree of freedom is what the display aspect-ratio slider controls: its
// default (defaultAspect = Y_MAX/π in projections.json) shows the standard proportions, other
// values give other Wagner IX axial ratios — the same way the equirectangular standard parallel
// is reached by the slider.

const M: f32 = 0.77777777777777778;    // 7/9 — m: φ' = asin(m·sin φ)   (pole-line length)
const N: f32 = 0.55555555555555556;    // 5/9 — n: λ' = n·λ             (meridian curvature)
const SX: f32 = 1.0 / N;                // 9/5 — sx = 1/n: true scale at centre (x = λ on the equator)
const SY: f32 = 1.0 / M;                // 9/7 — sy = 1/m: true scale at centre
const Y_MAX: f32 = 1.2625201731;        // max |y|, at the pole-line ends (φ = ±90°, λ = ±180°)

const planar_scale: vec2f = vec2(PI, Y_MAX);

// --- Aitoff building blocks (identical to aitoff.wesl / winkel-tripel.wesl) ---

// Aitoff forward: equatorial azimuthal-equidistant of (lat, lon/2) with x doubled.
fn aitoff_forward(lat: f32, lon: f32) -> vec2f {
    let a = acos(clamp(cos(lat) * cos(lon / 2.0), -1.0, 1.0));
    let d = select(a / sin(a), 1.0, a < 1e-6);   // α/sin α → 1 as α → 0
    return vec2f(2.0 * cos(lat) * sin(lon / 2.0) * d, sin(lat) * d);
}

// Aitoff closed-form inverse: (x/2)² + y² = α², so α — and from it lat, lon — fall out directly.
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

// --- Wagner IX = Aitoff on renumbered coordinates, rescaled ---

fn project(lat: f32, lon: f32) -> vec2f {
    let phi_p = asin(M * sin(lat));        // φ' = asin(m·sin φ)
    let a = aitoff_forward(phi_p, N * lon); // Aitoff(φ', λ'),  λ' = n·λ
    return vec2f(SX * a.x, SY * a.y);
}

fn inverse(x: f32, y: f32) -> vec2f {
    // Undo the output scaling, then invert the Aitoff half in closed form.
    let ax = x / SX;
    let ay = y / SY;
    // Outside the Aitoff ellipse the renumbered point is past a hemisphere — reject (same bound
    // aitoff.wesl uses, applied to the unscaled coordinates).
    if (ax * ax + 4.0 * ay * ay > PI * PI) {
        return vec2f(-181.0, 0.0);
    }
    let p = aitoff_inverse(ax, ay);   // (φ', λ')
    let sin_lat = sin(p.x) / M;        // undo latitude renumbering: sin φ = sin φ' / m
    let lon = p.y / N;                  // undo longitude renumbering: λ = λ' / n
    // Wagner's outline is the Aitoff image of the renumbered rectangle, strictly inside the
    // ellipse: |φ'| ≤ asin(m) ⟺ |sin φ| ≤ 1, and |λ'| ≤ nπ ⟺ |λ| ≤ π. Reject past either arc.
    if (abs(sin_lat) > 1.0 + 1e-4 || abs(lon) > PI + 1e-4) {
        return vec2f(-181.0, 0.0);
    }
    let lat = asin(clamp(sin_lat, -1.0, 1.0));
    return vec2f(lat, clamp(lon, -PI, PI));
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = clamp((projX + PI) / (2.0 * PI), 0.0, 1.0);         // x ∈ [-π, π]        → [0,1]
    let v = clamp((projY + Y_MAX) / (2.0 * Y_MAX), 0.0, 1.0);   // y ∈ [-Ymax, Ymax]  → [0,1]
    return vec2f(u, 1.0 - v);
}

fn set_extra_params(p: vec4f) { }
