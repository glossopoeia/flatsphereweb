import package::common::{PI};

// Range rings: circles of constant great-circle distance from a chosen point on the sphere.
//
// The overlay is evaluated per pixel from the geographic coordinates reproject.wesl has already
// recovered by inverse projection, so a ring is an implicit curve — a level set of the central-angle
// field — rather than stroked geometry. That makes it independent of the destination projection:
// the same code draws correct rings on every projection, interrupted ones included, with no forward
// projection and no second pass.

const MAX_RINGS: u32 = 8u;

// Blend weight for ring strokes. Higher than the graticule's 0.6 because rings are a deliberate
// annotation the user placed, not a background reference grid.
const RING_OPACITY: f32 = 0.9;

// Centre marker radius, as a multiple of the stroke width.
const CENTER_MARKER_SCALE: f32 = 3.0;

// Great-circle (central) angle between two points on the unit sphere, in radians.
//
// Uses atan2(|a x b|, a . b) rather than the shorter acos(a . b). acos is ill-conditioned for small
// separations: its derivative is unbounded as the argument approaches 1, and f32 spacing near 1.0 is
// ~6e-8, so acos resolves no better than ~3.5e-4 rad there — on Earth about 2 km, which shows up as
// a small ring that wobbles or snaps between pixels. The atan2 form keeps full relative accuracy
// across the whole 0..PI range, because the cross product carries the small-angle information in its
// magnitude instead of losing it to cancellation in a dot product near unity. This mirrors the
// reasoning in oblique.wesl for preferring atan2 over asin near the poles.
fn central_angle(lat: f32, lon: f32, lat0: f32, lon0: f32) -> f32 {
    let p = vec3f(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
    let c = vec3f(cos(lat0) * cos(lon0), cos(lat0) * sin(lon0), sin(lat0));
    return atan2(length(cross(p, c)), dot(p, c));
}

// Evaluate every ring at this pixel.
//
// center: (lat_rad, lon_rad, show_marker, reserved)
// rings:  per slot (radius_rad, r, g, b); radius <= 0 marks an unused or disabled slot
// Returns (r, g, b, coverage) for the ring covering this pixel most strongly.
//
// MUST be called from uniform control flow — it takes screen-space derivatives, so it has to run
// before the off-map early return in fs_main, exactly as is_graticule_line does.
fn range_ring_field(lat: f32, lon: f32, center: vec4f, rings: array<vec4f, MAX_RINGS>, width_mult: f32) -> vec4f {
    let d = central_angle(lat, lon, center.x, center.y);

    // Convert a fixed on-screen thickness into an angular width via screen-space derivatives, the
    // same technique the graticule uses: zooming in slows the per-pixel change in d, so the width
    // shrinks in radians to match and the stroke holds its thickness on screen (and gets an
    // anti-aliased edge for free). Unlike raw longitude, d is built from 3-vectors and stays
    // continuous across the antimeridian, so it needs no seam correction.
    //
    // The clamp guards the one remaining discontinuity: where a neighbour in the 2x2 derivative quad
    // falls outside the map outline, inverse() returns its off-map sentinel and this gradient jumps
    // by orders of magnitude, which would otherwise smear a bright fringe along the whole map rim.
    // The upper bound sits well above a real pixel's angular span even fully zoomed out (~0.008 rad)
    // and far below a sentinel jump (~3 rad).
    let dd_dx = dpdx(d);
    let dd_dy = dpdy(d);
    let pixel_width = clamp(sqrt(dd_dx * dd_dx + dd_dy * dd_dy), 1e-6, 0.1) * width_mult;

    var out = vec4f(0.0, 0.0, 0.0, 0.0);
    var marker_color = vec3f(1.0, 1.0, 1.0);
    var innermost = PI + 1.0; // beyond the antipode, so the first live ring always wins
    var has_ring = false;

    for (var i = 0u; i < MAX_RINGS; i = i + 1u) {
        let ring = rings[i];
        if (ring.x <= 0.0) {
            continue;
        }
        has_ring = true;
        if (ring.x < innermost) {
            innermost = ring.x;
            marker_color = ring.yzw;
        }
        // Rings can overlap where two radii sit within a pixel of each other; keep the strongest so
        // the result is a clean stroke rather than an additive bloom.
        let coverage = 1.0 - smoothstep(0.0, pixel_width, abs(d - ring.x));
        if (coverage > out.a) {
            out = vec4f(ring.yzw, coverage);
        }
    }

    // Centre marker: a filled dot a few stroke-widths across, in the innermost ring's colour so it
    // reads as part of the same annotation. Requires a live ring — with every ring disabled there is
    // no colour that belongs to the overlay, and a bare dot would appear in no legend entry.
    if (center.z > 0.5 && has_ring) {
        let marker_radius = pixel_width * CENTER_MARKER_SCALE;
        let coverage = 1.0 - smoothstep(marker_radius * 0.6, marker_radius, d);
        if (coverage > out.a) {
            out = vec4f(marker_color, coverage);
        }
    }

    return out;
}

fn apply_range_rings(base_color: vec3f, field: vec4f, show_range_rings: f32) -> vec3f {
    if (show_range_rings > 0.5) {
        return mix(base_color, field.rgb, field.a * RING_OPACITY);
    }
    return base_color;
}
