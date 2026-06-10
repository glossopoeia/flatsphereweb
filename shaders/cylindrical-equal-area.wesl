import package::common::{PI};

// Cylindrical Equal Area: meridians map to equally spaced vertical lines and parallels to
// horizontal lines spaced by the sine of the latitude (y = sin(lat)), which makes the
// projection equal-area. Only render the standard parallel 0 deg case. Other named variants
// (Behrmann, Hobo-Dyer, Gall-Peters, Balthasart, ...) differ only by their standard parallel,
// which is a pure change of aspect ratio (width:height = pi * cos^2(standard parallel)). 
// Flatsphere's aspect-ratio control reaches them, so no dedicated parameter is needed here.

const planar_scale: vec2f = vec2(PI, 1.0);

// No extra parameters; still required by the projection interface.
fn set_extra_params(p: vec4f) { }

fn project(lat: f32, lon: f32) -> vec2f {
    return vec2f(lon, sin(lat));
}

fn inverse(x: f32, y: f32) -> vec2f {
    // y = sin(lat), so |y| > 1 is off the map; reject to the background. Longitudes beyond
    // +/-pi are handled by reproject's bounds check.
    if (abs(y) > 1.0) {
        return vec2f(-181.0, 0.0);
    }
    return vec2f(asin(clamp(y, -1.0, 1.0)), x);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + PI) / (2.0 * PI);
    let v = 1.0 - (projY + 1.0) / 2.0;
    return vec2f(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0));
}
