import package::common::{PI};

// Graticule functions
fn is_graticule_line(lat: f32, lon: f32, width_mult: f32) -> f32 {
    // Grid spacing for graticules (every 15 degrees)
    let grid_spacing = PI / 12.0; // 15 degrees

    // Distance (in radians) from this point to the nearest meridian / parallel.
    let meridian_lon = round(lon / grid_spacing) * grid_spacing;
    let meridian_distance = abs(lon - meridian_lon);
    let parallel_lat = round(lat / grid_spacing) * grid_spacing;
    let parallel_distance = abs(lat - parallel_lat);

    // Convert a fixed on-screen thickness into a lat/lon width via screen-space derivatives.
    // This is what holds lines to a constant pixel size at every zoom level (and supplies an
    // anti-aliased edge): zooming in slows the per-pixel change in lat/lon, the width shrinks in
    // radians to match, and the line stays the same thickness on screen.
    //
    // Longitude can't be differentiated directly: it wraps from +PI to -PI at the antimeridian,
    // so dpdx(lon) spikes across that seam and bloats that one meridian into a fat, doubled-looking
    // line. Recover the true angular gradient from sin/cos(lon), which stay continuous across the
    // seam (and smooth through every line center, unlike a distance field):
    //   d(lon) = cos(lon) * d(sin lon) - sin(lon) * d(cos lon)
    let s = sin(lon);
    let c = cos(lon);
    let dlon_dx = c * dpdx(s) - s * dpdx(c);
    let dlon_dy = c * dpdy(s) - s * dpdy(c);
    let meridian_pixel_width = sqrt(dlon_dx * dlon_dx + dlon_dy * dlon_dy) * width_mult;

    let dlat_dx = dpdx(lat);
    let dlat_dy = dpdy(lat);
    let parallel_pixel_width = sqrt(dlat_dx * dlat_dx + dlat_dy * dlat_dy) * width_mult;

    let meridian_intensity = 1.0 - smoothstep(0.0, meridian_pixel_width, meridian_distance);
    let parallel_intensity = 1.0 - smoothstep(0.0, parallel_pixel_width, parallel_distance);
    
    // Return the maximum intensity (lines can overlap at intersections)
    return max(meridian_intensity, parallel_intensity);
}

fn apply_graticule(base_color: vec3f, graticule_intensity: f32, show_graticule: f32) -> vec3f {
    if (show_graticule > 0.5) {
        // Use the continuous intensity value for smooth anti-aliased blending
        return mix(base_color, vec3f(1.0, 1.0, 1.0), graticule_intensity * 0.6);
    }
    return base_color;
}