import package::common::{PI};

// Equal Earth: the 2018 equal-area pseudocylindrical projection of Bojan Šavrič, Tom Patterson and
// Bernhard Jenny (International Journal of Geographical Information Science 33(3), 454–465). It
// keeps the look of the Robinson projection — straight parallels, gently curved meridians, pole
// lines about 0.59 of the equator — while being exactly equal-area. Latitude is first renumbered
// to a parametric latitude θ,
//
//   sin θ = M · sin φ,   M = √3 / 2,
//
// so θ spans ±60° while φ spans ±90°. The parallel spacing is a polynomial in θ, and the meridian
// spacing follows from the equal-area condition for a pseudocylindrical map (x/λ · ∂y/∂φ = cos φ):
//
//   y = f(θ) = A₁θ + A₂θ³ + A₃θ⁷ + A₄θ⁹
//   x = λ cos θ / (M · f′(θ)),   f′(θ) = A₁ + 3A₂θ² + 7A₃θ⁶ + 9A₄θ⁸
//
// (with 1/M = 2√3/3 multiplied out this is the paper's x = 2√3 λ cos θ / (3 f′(θ))). The forward
// projection is closed-form; the inverse recovers θ from y with Newton's method, which converges
// in a couple of steps because f′ stays between 1.13 and 1.34 over the whole map.

const A1: f32 =  1.340264;
const A2: f32 = -0.081106;
const A3: f32 =  0.000893;
const A4: f32 =  0.003796;
const M: f32 = 0.866025403784;          // √3 / 2
const X_MAX: f32 = PI / (M * A1);       // half-width, on the equator (θ = 0)
const Y_MAX: f32 = 1.317362759157;      // f(π/3): half-height, at the pole lines (θ = asin M = π/3).
                                        // A literal because const-expressions cannot call y_of_theta.
const planar_scale: vec2f = vec2(X_MAX, Y_MAX);

const max_iterations: u32 = 4u;    // cap only; the loop breaks as soon as a step is below converge_eps
const converge_eps: f32 = 1e-6;

// f(θ): parallel spacing as a function of the parametric latitude.
fn y_of_theta(theta: f32) -> f32 {
    let t2 = theta * theta;
    let t6 = t2 * t2 * t2;
    return theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
}

// f′(θ)
fn dy_dtheta(theta: f32) -> f32 {
    let t2 = theta * theta;
    let t6 = t2 * t2 * t2;
    return A1 + 3.0 * A2 * t2 + t6 * (7.0 * A3 + 9.0 * A4 * t2);
}

fn project(lat: f32, lon: f32) -> vec2f {
    // |θ| ≤ π/3, so cos θ ≥ 1/2 and it is √(1 − sin²θ) exactly.
    let sin_theta = M * sin(lat);
    let theta = asin(sin_theta);
    let x = lon * sqrt(1.0 - sin_theta * sin_theta) / (M * dy_dtheta(theta));
    return vec2f(x, y_of_theta(theta));
}

fn inverse(x: f32, y: f32) -> vec2f {
    // Above or below the pole lines.
    if (abs(y) > Y_MAX) {
        return vec2f(-181.0, 0.0);
    }
    // Newton on f(θ) = y, seeded by inverting the linear term. f is nearly linear (f′ ∈ [1.13, 1.34]),
    // so the seed is within 7% of the root and the second step already sits at the f32 rounding
    // floor; the loop breaks there rather than running to its cap.
    var theta = y / A1;
    for (var i = 0u; i < max_iterations; i++) {
        let step = (y_of_theta(theta) - y) / dy_dtheta(theta);
        theta -= step;
        if (abs(step) < converge_eps) {
            break;
        }
    }
    // Undo the latitude renumbering: sin φ = sin θ / M. |θ| ≤ π/3 here (|y| ≤ f(π/3) and f is
    // increasing), so sin φ is within ±1 up to rounding, and cos θ ≥ 1/2 is √(1 − sin²θ) exactly.
    let sin_theta = sin(theta);
    let sin_lat = sin_theta / M;
    let cos_theta = sqrt(1.0 - sin_theta * sin_theta);
    // λ from x; cos θ ≥ 1/2 everywhere on the map, so the pole lines are not singular.
    let lon = M * x * dy_dtheta(theta) / cos_theta;
    // Past the outer meridians. The |y| test above already bounds the latitude, so this is the
    // only outline test needed.
    if (abs(lon) > PI + 1e-4) {
        return vec2f(-181.0, 0.0);
    }
    return vec2f(asin(clamp(sin_lat, -1.0, 1.0)), clamp(lon, -PI, PI));
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = clamp((projX + X_MAX) / (2.0 * X_MAX), 0.0, 1.0);   // x ∈ [-X_MAX, X_MAX] → [0,1]
    let v = clamp((projY + Y_MAX) / (2.0 * Y_MAX), 0.0, 1.0);   // y ∈ [-Y_MAX, Y_MAX] → [0,1]
    return vec2f(u, 1.0 - v);
}

fn set_extra_params(p: vec4f) { }
