const PI: f32 = 3.14159265358979323846;
const HALF_PI: f32 = 1.57079632679489661923;

// Tissot's indicatrix functions
fn is_tissot_indicatrix(lat: f32, lon: f32) -> f32 {
    // Grid spacing for indicatrices (every 15 degrees for good coverage)
    let grid_spacing = PI / 12.0; // 15 degrees
    let radius = PI / 120.0; // Small circle radius (1.5 degrees)
    let line_width = PI / 400.0; // Line thickness (0.45 degrees)
    
    // Find nearest grid point
    let grid_lat = round(lat / grid_spacing) * grid_spacing;
    let grid_lon = round(lon / grid_spacing) * grid_spacing;
    
    // Skip poles where projection might be undefined
    if (abs(grid_lat) > HALF_PI - PI / 18.0) {
        return 0.0;
    }
    
    // Distance to grid center on the sphere
    let dlat = lat - grid_lat;
    let dlon = (lon - grid_lon) * cos(grid_lat);
    let dist = sqrt(dlat * dlat + dlon * dlon);
    
    // Check if we're near the circle
    if (abs(dist - radius) < line_width) {
        return 1.0;
    }
    
    return 0.0;
}

fn apply_tissot_indicatrices(base_color: vec3f, lat: f32, lon: f32, show_tissot: f32) -> vec3f {
    if (show_tissot > 0.5) {
        let tissot_intensity = is_tissot_indicatrix(lat, lon);
        if (tissot_intensity > 0.5) {
            // Red lines for indicatrices with good visibility
            return mix(base_color, vec3f(1.0, 0.2, 0.2), vec3(0.7));
        }
    }
    return base_color;
}