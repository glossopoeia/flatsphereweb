import package::common::{PI, HALF_PI};

const planar_scale: vec2f = vec2(PI, HALF_PI);

fn project(lat: f32, lon: f32) -> vec2f {
    let sin_half_lon = sin(lon / 2.0);
    let cos_half_lon = cos(lon / 2.0);
    let sin_lat = sin(lat);
    let cos_lat = cos(lat);
    let cos_alpha = cos_lat * cos_half_lon;
    // sin α from components — sin²α = cos²φ·sin²(λ/2) + sin²φ. Recovering α as
    // atan2(sin α, cos α) keeps relative accuracy near the origin, where acos(cos α)
    // quantizes small angles, and never needs a domain clamp to stay NaN-free.
    let sin_alpha = length(vec2f(cos_lat * sin_half_lon, sin_lat));
    // A = α/sin α → 1 at the origin. The cos α > 0 condition pins the guard to the α≈0
    // root: callers iterating with unwrapped lon can reach α≈π, where sin α≈0 too but
    // the atan2 form stays finite and correct — sin α bounds the factors multiplying A,
    // so |x| ≤ 2α and |y| ≤ α. The 1e-12 floor closes the one residual 0/0: WGSL's loose
    // trig tolerance lets a driver return sin(λ/2) == 0 exactly with cos(λ/2) < 0.
    let A = select(atan2(sin_alpha, cos_alpha) / max(sin_alpha, 1e-12), 1.0,
                   sin_alpha < 1e-6 && cos_alpha > 0.0);
    return vec2f(2.0 * cos_lat * sin_half_lon * A, sin_lat * A);
}

fn inverse(x: f32, y: f32) -> vec2f {
    // Aitoff is a pre- and post-scaled version of the azimuthal-equidistant projection's
    // equatorial aspect, so no iteration needed (Snyder 1987, pp. 195–197).
    let half_x = x / 2.0;
    let alpha = length(vec2f(half_x, y));
    // the map rim is α = π/2 (the ellipse x² + 4y² = π²); reject artifacts past it
    if (alpha > HALF_PI) {
        return vec2f(-181.0, 0.0);
    }
    // factoring sinc α = sin α/α (limit 1 at the origin) out of both coordinates
    // removes the 0/0 at the centre without a special-cased early return
    let sinc_alpha = select(sin(alpha) / alpha, 1.0, alpha < 1e-6);
    // clamp: length() isn't guaranteed ≥ |y| the way IEEE hypot is, and at the poles the
    // asin argument is exactly 1, so an ulp of rounding slop would otherwise yield NaN
    let lat = asin(clamp(y * sinc_alpha, -1.0, 1.0));
    let lon = 2.0 * atan2(half_x * sinc_alpha, cos(alpha));
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = clamp((projX + PI) / (2.0 * PI), 0.0, 1.0); // Map [-PI,PI] to [0,1]
    let v = clamp((projY + HALF_PI) / PI, 0.0, 1.0);    // Map [-PI/2,PI/2] to [0,1]
    return vec2f(u, 1.0 - v);
}

fn set_extra_params(p: vec4f) { }
