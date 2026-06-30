import package::common::{PI};

// Wagner IX (Aitoff-Wagner): Karlheinz Wagner's 1949 modification of Aitoff that gives the
// poles a finite, gently curved line instead of a single point. It pre-scales latitude and
// longitude, applies the Aitoff construction to the scaled pair, then rescales the output.
//
//   sin η = m·sin φ,   δ = n·λ,   c = arccos(cos η · cos δ)
//   (x, y) = (Cx · cos η · sin δ,  Cy · sin η) · (c / sin c)
//
// Every step is closed-form and individually invertible, so the whole projection is too: the
// inverse undoes the output scaling, runs the closed-form Aitoff inverse, then undoes
// the input scaling. Constants are Wagner's originals m = 7/9, n = 5/18 with the axial scale
// factors Cx = 18/5, Cy = 9/7 (Tobias Jung / Canters). They satisfy Cx·Cy = 1/(n·m) and place
// the equator at true scale (x = λ when φ = 0).

const M: f32 = 0.77777777777777778;    // 7/9  — sin η = m · sin φ
const N: f32 = 0.27777777777777778;    // 5/18 — δ = n · λ (renumbered half-longitude)
const CX: f32 = 3.6;                    // 18/5 — output x scale
const CY: f32 = 1.28571428571428571;   // 9/7  — output y scale
const Y_MAX: f32 = 1.2625201731;        // max |y|, at the pole-line ends (φ = ±90°, λ = ±180°)

const planar_scale: vec2f = vec2(PI, Y_MAX);

fn project(lat: f32, lon: f32) -> vec2f {
    let s = M * sin(lat);                        // sin η
    let cos_eta = sqrt(max(1.0 - s * s, 0.0));   // cos η
    let delta = N * lon;                          // renumbered half-longitude
    let cos_c = clamp(cos_eta * cos(delta), -1.0, 1.0);
    let c = acos(cos_c);                          // angular distance from the projection center
    // c/sin c → 1 as c → 0; guard the 0/0 singularity at the origin (φ = 0, λ = 0)
    let d = select(c / sin(c), 1.0, c < 1e-6);
    let x = CX * cos_eta * sin(delta) * d;
    let y = CY * s * d;
    return vec2f(x, y);
}

fn inverse(x: f32, y: f32) -> vec2f {
    // Undo the output scaling: (t1, t2) are azimuthal-equidistant coordinates of the renumbered
    // point (η, δ). For the equidistant parent the planar radius IS the angular distance, so
    // c = √(t1² + t2²) recovers it with no iteration — the same algebraic identity that makes
    // the Aitoff inverse closed-form.
    let t1 = x / CX;
    let t2 = y / CY;
    let c = sqrt(t1 * t1 + t2 * t2);
    if (c < 1e-6) {
        return vec2f(0.0, 0.0);                   // projection center
    }
    if (c > PI) {
        return vec2f(-181.0, 0.0);                // beyond the hemispherical bound
    }
    let sin_c = sin(c);
    let sin_eta = t2 * sin_c / c;                 // sin η
    let sin_lat = sin_eta / M;                    // undo latitude renumbering: sin φ = sin η / m
    let delta = atan2(t1 * sin_c, c * cos(c));    // renumbered half-longitude
    let lon = delta / N;                           // undo longitude renumbering
    // The outline is exactly |sin φ| ≤ 1 (the curved pole-line arcs) and |λ| ≤ π (the
    // antimeridian arcs); reject anything past either so exterior pixels render as background.
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
