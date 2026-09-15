import package::common::{PI, HALF_PI};

// Eckert IV: Max Eckert's 1906 pseudocylindrical equal-area projection. Parallels are straight
// lines, the pole lines are half the length of the equator, and the outer meridians are
// semicircles, so the outline is a 2:1 rectangle with rounded ends. The construction (Snyder 1987,
// pp. 253–258, eqs. 30-1..30-3) goes through an auxiliary angle θ:
//
//   x = CX · λ · (1 + cos θ)                  CX = 2 / √(π(4 + π))
//   y = CY · sin θ                            CY = 2 √(π / (4 + π)) = CX · π
//   θ + sin θ cos θ + 2 sin θ = (2 + π/2) sin φ
//
// The θ equation has no closed form, so the forward projection solves it with Newton's method.
// The inverse is closed-form: θ from y, then λ from x and φ from the θ equation read backwards.
//
// With these constants the map area is exactly 4π: the central rectangle (2·CY wide, 2·CY tall)
// plus the two semicircular ends of radius CY come to (4 + π)·CY² = 4π. That unit area scale is
// what makes the distortion overlay's areal metric read correctly.

const CX: f32 = 0.422238200316;    // 2 / √(π(4 + π))
const CY: f32 = CX * PI;           // 2 √(π / (4 + π)) — half-height, and half the pole-line length
const CP: f32 = 2.0 + HALF_PI;     // right-hand-side factor of the θ equation
const X_MAX: f32 = 2.0 * CY;       // half-width, on the equator: CX · π · (1 + cos 0) = 2 · CY
const planar_scale: vec2f = vec2(X_MAX, CY);

const max_iterations: u32 = 6u;    // cap only; the loop breaks as soon as a step is below converge_eps
const converge_eps: f32 = 1e-6;    // f32 step floor away from the pole

// Solve θ + sin θ cos θ + 2 sin θ = (2 + π/2) sin φ for θ.
//
// Seed θ₀ = φ. The ratio θ/φ runs from (2 + π/2)/4 ≈ 0.893 at the equator to exactly 1 at the
// pole, so the seed is always within ~11% of the root, and it is exact at the pole where the
// derivative vanishes. On [0, π/2] the left-hand side g(θ) is increasing (g′ = 2 cos θ (1 + cos θ))
// and concave (g″ = −2 sin θ (1 + 2 cos θ)), and the seed sits above the root (g(φ) ≥ (2 + π/2) sin φ
// there), so the first step lands just below the root and the rest converge monotonically; the
// southern hemisphere mirrors this by symmetry.
//
// Away from the pole convergence is quadratic and three steps reach f32 precision, so the loop
// breaks on a small step instead of running a fixed count. The pole is a double root (g′ → 0):
// Newton slows to a linear rate there and, worse, the residual is a difference of terms near 3.57
// whose f32 rounding noise (one ulp, 2.4e-7) divided by the vanishing g′ can throw a step of a few
// hundredths of a radian within ~1e-5 rad of the pole. The cap then leaves θ up to ~1e-3 rad off
// there — an x error of ~1.4e-3 map units, about 3e-4 of the map width and under a texel of any
// source image — and no iteration count changes that. The step is skipped where |g′| is tiny
// (θ ≈ ±π/2); testing |g′| rather than g′ means an overshoot past the pole, where g′ turns
// negative, cannot freeze the iteration, and the result is clamped to ±π/2 so such an overshoot
// can never leave the domain.
fn eckert_theta(lat: f32) -> f32 {
    let rhs = CP * sin(lat);
    var theta = lat;
    for (var i = 0u; i < max_iterations; i++) {
        let s = sin(theta);
        let c = cos(theta);
        let residual = theta + s * c + 2.0 * s - rhs;
        let slope = 2.0 * c * (1.0 + c);
        if (abs(slope) < 1e-7) {
            break;
        }
        let step = residual / slope;
        theta -= step;
        if (abs(step) < converge_eps) {
            break;
        }
    }
    return clamp(theta, -HALF_PI, HALF_PI);
}

fn project(lat: f32, lon: f32) -> vec2f {
    let theta = eckert_theta(lat);
    return vec2f(CX * lon * (1.0 + cos(theta)), CY * sin(theta));
}

fn inverse(x: f32, y: f32) -> vec2f {
    // Above or below the pole lines.
    if (abs(y) > CY) {
        return vec2f(-181.0, 0.0);
    }
    // sin θ is y / CY directly, and asin puts θ in [-π/2, π/2] where cos θ ≥ 0, so cos θ is
    // √(1 − sin²θ) exactly — no second transcendental. θ itself is still needed for the latitude.
    let s = clamp(y / CY, -1.0, 1.0);
    let theta = asin(s);
    let c = sqrt(1.0 - s * s);
    // 1 + cos θ ≥ 1 on [-π/2, π/2], so recovering λ from x never divides by zero.
    let lon = x / (CX * (1.0 + c));
    // Past the outer meridians — the semicircular ends of the outline.
    if (abs(lon) > PI + 1e-4) {
        return vec2f(-181.0, 0.0);
    }
    let lat = asin(clamp((theta + s * c + 2.0 * s) / CP, -1.0, 1.0));
    return vec2f(lat, clamp(lon, -PI, PI));
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = clamp((projX + X_MAX) / (2.0 * X_MAX), 0.0, 1.0);   // x ∈ [-X_MAX, X_MAX] → [0,1]
    let v = clamp((projY + CY) / (2.0 * CY), 0.0, 1.0);          // y ∈ [-CY, CY]       → [0,1]
    return vec2f(u, 1.0 - v);
}

fn set_extra_params(p: vec4f) { }
