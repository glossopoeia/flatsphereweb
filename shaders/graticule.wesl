const PI: f32 = 3.14159265358979323846;
const HALF_PI: f32 = 1.57079632679489661923;

// Graticule functions
fn is_graticule_line(lat: f32, lon: f32) -> f32 {
    // Grid spacing for graticules (every 15 degrees)
    let grid_spacing = PI / 12.0; // 15 degrees

    // Use screen-space derivatives to get consistent pixel-width lines
    // dFdx/dFdy give us the rate of change per pixel in screen space 
    let dlat_dx = dpdx(lat);                                          
    let dlat_dy = dpdy(lat);                                          
    let dlon_dx = dpdx(lon);                                          
    let dlon_dy = dpdy(lon);                                          
                                                                      
    // Calculate the screen-space line width (approximately 1 pixel)  
    let lat_pixel_width = sqrt(dlat_dx * dlat_dx + dlat_dy * dlat_dy);
    let lon_pixel_width = sqrt(dlon_dx * dlon_dx + dlon_dy * dlon_dy);
    
    // Check for meridians (lines of constant longitude)
    let meridian_lon = round(lon / grid_spacing) * grid_spacing;
    let meridian_distance = abs(lon - meridian_lon);
    if (meridian_distance < lon_pixel_width) {
        return 1.0;
    }
    
    // Check for parallels (lines of constant latitude)
    let parallel_lat = round(lat / grid_spacing) * grid_spacing;
    let parallel_distance = abs(lat - parallel_lat);
    if (parallel_distance < lat_pixel_width) {
        return 1.0;
    }
    
    return 0.0;
}

fn apply_graticule(base_color: vec3f, graticule_intensity: f32, show_graticule: f32) -> vec3f {
    if (show_graticule > 0.5 && graticule_intensity > 0.5) {
        // White lines for graticule with good visibility
        return mix(base_color, vec3f(1.0, 1.0, 1.0), 0.6);
    }
    return base_color;
}