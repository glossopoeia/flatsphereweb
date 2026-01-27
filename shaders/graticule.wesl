const PI: f32 = 3.14159265358979323846;
const HALF_PI: f32 = 1.57079632679489661923;

// Graticule functions
fn is_graticule_line(lat: f32, lon: f32) -> f32 {
    // Grid spacing for graticules (every 15 degrees)
    let grid_spacing = PI / 12.0; // 15 degrees
    let line_width = PI / 360.0; // Line thickness (0.5 degrees)
    
    // Check for meridians (lines of constant longitude)
    let meridian_lon = round(lon / grid_spacing) * grid_spacing;
    let meridian_distance = abs(lon - meridian_lon);
    if (meridian_distance < line_width) {
        return 1.0;
    }
    
    // Check for parallels (lines of constant latitude)
    let parallel_lat = round(lat / grid_spacing) * grid_spacing;
    let parallel_distance = abs(lat - parallel_lat);
    if (parallel_distance < line_width) {
        return 1.0;
    }
    
    return 0.0;
}

fn apply_graticule(base_color: vec3f, lat: f32, lon: f32, show_graticule: f32) -> vec3f {
    if (show_graticule > 0.5) {
        let graticule_intensity = is_graticule_line(lat, lon);
        if (graticule_intensity > 0.5) {
            // White lines for graticule with good visibility
            return mix(base_color, vec3f(1.0, 1.0, 1.0), 0.6);
        }
    }
    return base_color;
}