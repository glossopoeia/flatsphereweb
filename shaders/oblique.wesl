import package::common::{PI, HALF_PI};

fn oblique_transform_from_sphere(lat: f32, lon: f32, pole_lat: f32, pole_lon: f32, rotation: f32) -> vec2f {
    var new_lat: f32;
    var new_lon: f32;
    if (abs(pole_lat - HALF_PI) < 1e-6) {
        new_lat = lat;
        new_lon = lon - pole_lon;
    } else if (abs(pole_lat + HALF_PI) < 1e-6) {
        new_lat = -lat;
        new_lon = pole_lon - lon + PI;
    } else {
        let pole_rel_cos = cos(pole_lon - lon);
        let sin_lat = sin(lat);
        let cos_lat = cos(lat);
        let sin_pole_lat = sin(pole_lat);
        let cos_pole_lat = cos(pole_lat);

        // Cartesian components of the point in the rotated frame (x² + y² + z² = 1):
        //   z = sin φ′,  x = cos φ′·sin λ′,  y = cos φ′·cos λ′
        let z = sin_pole_lat * sin_lat + cos_pole_lat * cos_lat * pole_rel_cos;
        let x = cos_lat * sin(lon - pole_lon);
        let y = sin_pole_lat * cos_lat * pole_rel_cos - cos_pole_lat * sin_lat;
        // Recover φ′ as atan2(sin φ′, cos φ′) with cos φ′ built from the equatorial
        // components. asin(z) would quantize near φ′ = ±π/2 (f32 asin resolves only
        // ~3.5e-4 rad there) — and the rotated pole is the map centre of every
        // polar-aspect projection, exactly where that error is most visible.
        new_lat = atan2(z, length(vec2f(x, y)));
        new_lon = atan2(x, y);
    }

    // Apply rotation around the pole
    new_lon = new_lon - rotation;

    // Constrain longitude to [-PI, PI]
    let wrapped = new_lon + PI;
    new_lon = wrapped - floor(wrapped / (2.0 * PI)) * (2.0 * PI) - PI;

    return vec2f(new_lat, new_lon);
}

fn oblique_transform_to_sphere(lat: f32, lon: f32, pole_lat: f32, pole_lon: f32, rotation: f32) -> vec2f {
    // Reverse the rotation
    let rotated_lon = lon + rotation;

    // Constrain longitude to [-PI, PI]
    let wrapped = rotated_lon + PI;
    let new_lon = wrapped - floor(wrapped / (2.0 * PI)) * (2.0 * PI) - PI;

    var new_lat: f32;
    var new_lon_final: f32;

    // Exact inverse of oblique_transform_from_sphere.
    if (abs(pole_lat - HALF_PI) < 1e-6) {
        new_lat = lat;
        new_lon_final = new_lon + pole_lon;
    } else if (abs(pole_lat + HALF_PI) < 1e-6) {
        new_lat = -lat;
        new_lon_final = pole_lon - new_lon + PI;
    } else {
        let sin_pole_lat = sin(pole_lat);
        let cos_pole_lat = cos(pole_lat);
        let sin_lat = sin(lat);
        let cos_lat = cos(lat);
        let sin_new_lon = sin(new_lon);
        let cos_new_lon = cos(new_lon);

        // Cartesian components of the point back in the unrotated frame (x² + y² + z² = 1):
        //   z = sin φ,  x = cos φ·sin(λ − λₚ),  y = cos φ·cos(λ − λₚ)
        let z = sin_pole_lat * sin_lat - cos_pole_lat * cos_lat * cos_new_lon;
        let x = cos_lat * sin_new_lon;
        let y = cos_pole_lat * sin_lat + sin_pole_lat * cos_lat * cos_new_lon;
        // atan2 over the components keeps relative accuracy near φ = ±π/2, where
        // asin(z) quantizes in f32 (and needs a clamp to stay NaN-free)
        new_lat = atan2(z, length(vec2f(x, y)));
        new_lon_final = atan2(x, y) + pole_lon;
    }

    // Constrain longitude to [-PI, PI]
    let wrapped_final = new_lon_final + PI;
    new_lon_final = wrapped_final - floor(wrapped_final / (2.0 * PI)) * (2.0 * PI) - PI;

    return vec2f(new_lat, new_lon_final);
}