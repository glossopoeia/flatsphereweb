// Near-side (vertical) perspective projection: the globe as seen from a viewpoint a
// finite distance from the planet's centre, measured in Earth-radii. As the distance
// grows the projection approaches the orthographic; as it nears 1 the viewpoint nears
// the surface and the visible cap shrinks toward a point.
//
// The visible disc has radius sqrt((distance - 1)/(distance + 1)) in projection units.
// The destination frame is normalised to [-1, 1] (planar_scale); inverse() rescales it
// into disc units so the disc fills the frame at any viewpoint distance.

const planar_scale: vec2f = vec2(1.0, 1.0);

// Viewpoint distance from the planet centre, in Earth-radii. Additional projection
// parameters for this projection.
var<private> vp_distance: f32 = 10.0;

fn set_extra_params(p: vec4f) {
    vp_distance = p.x;
}

// Radius of the visible disc, in projection units, for the current viewpoint distance.
fn vp_disc_radius() -> f32 {
    return sqrt((vp_distance - 1.0) / (vp_distance + 1.0));
}

fn project(lat: f32, lon: f32) -> vec2f {
    let d = vp_distance;
    let cos_c = sin(lat);
    let k = (d - 1.0) / (d - cos_c);

    let x = k * cos(lat) * sin(lon);
    let y = k * sin(lat);
    return vec2f(x, y);
}

fn inverse(frameX: f32, frameY: f32) -> vec2f {
    let d = vp_distance;
    let max_r = vp_disc_radius();

    // planar_scale normalises the frame to [-1, 1]; rescale into projection (disc) units.
    let x = frameX * max_r;
    let y = frameY * max_r;

    let r = sqrt(x * x + y * y);
    if (r <= 0.0) {
        return vec2f(0.0, 0.0);
    }

    if (r > max_r) {
        return vec2f(-181.0, 0.0); // Outside visible sphere, return sentinel to render no data
    }

    let denom = (d - 1.0) / r + r / (d - 1.0);
    let numer = d - sqrt(1.0 - ((r * r * (d + 1.0)) / (d - 1.0)));
    let c = asin(numer / denom);

    let lat = asin((y * sin(c)) / r);
    let lon = atan2(x * sin(c), r * cos(c));
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let max_r = vp_disc_radius();
    let u = (projX + max_r) / (2.0 * max_r); // Map [-max_r, max_r] to [0,1]
    let v = (projY + max_r) / (2.0 * max_r);
    return vec2f(u, 1.0 - v);
}
