import package::common::{PI, HALF_PI};

// HEALPix (Hierarchical Equal Area isoLatitude Pixelization): an equal-area projection that
// pairs a Lambert cylindrical equal-area band across the equatorial zone (|sin(lat)| <= 2/3)
// with four interrupted Collignon facets over each polar cap. Ported from the Go flatsphere
// library (healpix.go); see "Mapping on the HEALPix Grid" (astro-ph/0412607).
//
// The polar caps are always interrupted: each maps to four Collignon triangles with empty
// wedges between them. This preserves the equal-area look in the polar regions.
// When HEALPix is the destination projection, inverse() rejects pixels that land in those
// empty wedges (returning the off-sphere sentinel) so the background shows through; the
// sphere is fully tiled by the triangles, so the wedges hold no data to recover.

const planar_scale: vec2f = vec2(PI, HALF_PI);

const z_lim: f32 = 2.0 / 3.0;       // |sin(lat)| boundary between equatorial and polar zones
const y_lim: f32 = PI / 4.0;        // |y| boundary between the two zones in projection space
const facet_half: f32 = PI / 4.0;   // half-width of a polar facet, in longitude
const gap_eps: f32 = 1e-4;          // tolerance so shared facet edges aren't dropped as gaps

// HEALPix takes no user parameters; required by the projection interface (reproject.wesl).
fn set_extra_params(p: vec4f) { }

// Central meridian of the polar facet that owns projection-x `x` (one of -3pi/4, -pi/4,
// pi/4, 3pi/4 across the valid range). Matches the Go library's facet selection.
fn facet_center(x: f32) -> f32 {
    return (PI / 4.0) * (2.0 * floor(2.0 + (2.0 * x) / PI) - 3.0);
}

fn project(lat: f32, lon: f32) -> vec2f {
    let z = sin(lat);
    if (abs(z) <= z_lim) {
        // Equatorial zone: Lambert cylindrical equal-area band.
        return vec2f(lon, 3.0 * (PI / 8.0) * z);
    }
    // Polar zone: a Collignon facet tapering toward the pole.
    let sigma = sqrt(3.0 * (1.0 - abs(z)));
    let y_mag = (PI / 4.0) * (2.0 - sigma);
    let y = select(-y_mag, y_mag, lat > 0.0);
    let fx = facet_center(lon);
    let x = fx + sigma * (lon - fx);
    return vec2f(x, y);
}

fn inverse(x: f32, y: f32) -> vec2f {
    let abs_y = abs(y);
    if (abs_y <= y_lim) {
        // Equatorial zone.
        let z = (8.0 / (3.0 * PI)) * y;
        return vec2f(asin(clamp(z, -1.0, 1.0)), x);
    }
    if (abs_y < HALF_PI) {
        // Polar zone.
        let sigma = 2.0 - abs(4.0 * y) / PI;
        let z = 1.0 - (sigma * sigma) / 3.0;
        let lat_mag = asin(clamp(z, -1.0, 1.0));
        let lat = select(-lat_mag, lat_mag, y > 0.0);
        let fx = facet_center(x);
        let lon = fx + (x - fx) / sigma;
        // Reject pixels in the empty wedges between facets -- a recovered longitude outside the
        // facet's +/-45 deg span -- so they fall through to the background.
        if (abs(lon - fx) > facet_half + gap_eps) {
            return vec2f(-181.0, 0.0);
        }
        return vec2f(lat, lon);
    }
    // At or beyond the pole row: collapse to the pole, carrying longitude through as x.
    return vec2f(select(-HALF_PI, HALF_PI, y > 0.0), x);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + PI) / (2.0 * PI);
    let v = 1.0 - (projY + HALF_PI) / PI;
    return vec2f(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0));
}
