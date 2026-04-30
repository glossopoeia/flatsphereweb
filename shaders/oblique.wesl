import package::common::{PI, HALF_PI};

fn oblique_transform_from_sphere(lat: f32, lon: f32, pole_lat: f32, pole_lon: f32, rotation: f32) -> vec2f {
    let pole_rel_cos = cos(pole_lon - lon);

    var new_lat: f32;
    if (abs(pole_lat - HALF_PI) < 1e-6) {
        new_lat = lat;
    } else {
        let pre_asin = sin(pole_lat) * sin(lat) + cos(pole_lat) * cos(lat) * pole_rel_cos;
        new_lat = asin(clamp(pre_asin, -1.0, 1.0));
    }

    var new_lon: f32;
    if (abs(pole_lat - HALF_PI) < 1e-6) {
        new_lon = lon - pole_lon - PI;
    } else if (abs(pole_lat + HALF_PI) < 1e-6) {
        new_lon = pole_lon - lon;
    } else {
        let sin_lat = sin(lat);
        let cos_lat = cos(lat);
        let sin_pole_lat = sin(pole_lat);
        let cos_pole_lat = cos(pole_lat);

        let numer = cos_lat * sin(lon - pole_lon);
        let denom = cos_pole_lat * sin_lat - sin_pole_lat * cos_lat * pole_rel_cos;
        new_lon = -atan2(numer, denom);
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

    if (abs(pole_lat - HALF_PI) < 1e-6) {
        new_lat = lat;
        new_lon_final = new_lon + pole_lon + PI;
    } else if (abs(pole_lat + HALF_PI) < 1e-6) {
        new_lat = lat;
        new_lon_final = pole_lon - new_lon;
    } else {
        let sin_pole_lat = sin(pole_lat);
        let cos_pole_lat = cos(pole_lat);
        let sin_new_lat = sin(new_lat);
        let cos_new_lat = cos(new_lat);
        let sin_new_lon = sin(new_lon);
        let cos_new_lon = cos(new_lon);

        let pre_asin = sin_pole_lat * sin_new_lat - cos_pole_lat * cos_new_lat * cos_new_lon;
        new_lat = asin(clamp(pre_asin, -1.0, 1.0));

        let numer = cos_new_lat * sin_new_lon;
        let denom = cos_pole_lat * sin_new_lat + sin_pole_lat * cos_new_lat * cos_new_lon;
        new_lon_final = atan2(numer, denom) + pole_lon;
    }

    // Constrain longitude to [-PI, PI]
    let wrapped_final = new_lon_final + PI;
    new_lon_final = wrapped_final - floor(wrapped_final / (2.0 * PI)) * (2.0 * PI) - PI;

    return vec2f(new_lat, new_lon_final);
}