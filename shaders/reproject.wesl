import package::common::{PI, HALF_PI};
import package::dstproj::{inverse, planar_scale};
import package::srcproj::{project};
import package::tissot::{is_tissot_indicatrix, apply_tissot_indicatrices};
import package::graticule::{apply_graticule, is_graticule_line};

struct Uniforms {
    projection_type: f32,
    camera_lat: f32,
    camera_lon: f32,
    zoom: f32,
    aspect: f32,
    show_tissot: f32,
    show_graticule: f32,
    source_projection: f32,
    padding1: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var world_texture: texture_2d<f32>;
@group(0) @binding(2) var world_sampler: sampler;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var pos = array<vec2f, 4>(
        vec2f(-1.0, -1.0),
        vec2f( 1.0, -1.0),
        vec2f(-1.0,  1.0),
        vec2f( 1.0,  1.0)
    );
    
    var out: VertexOutput;
    out.position = vec4f(pos[vertex_index], 0.0, 1.0);
    out.uv = pos[vertex_index];
    return out;
}

// Sample world map texture based on lat/lon and source projection
fn world_texture_color(lat: f32, lon: f32) -> vec3f {
    let source_proj = i32(uniforms.source_projection);
    var tex_coords: vec2f;
    
    // Normalize longitude to [-π, π] range using proper modular arithmetic
    // WGSL doesn't have fmod, so we use: a - floor(a/b) * b
    let lon_normalized = lon + PI;
    let lon_wrapped = lon_normalized - floor(lon_normalized / (2.0 * PI)) * (2.0 * PI);
    let norm_lon = lon_wrapped - PI;
    
    // Clamp latitude to valid range
    let norm_lat = clamp(lat, -HALF_PI, HALF_PI);
    
    if (source_proj == 0) {
        // Equirectangular (default) - handles longitude wrapping properly
        let u = (norm_lon + PI) / (2.0 * PI);
        let v = 1.0 - (norm_lat + HALF_PI) / PI;
        tex_coords = vec2f(u, clamp(v, 0.0, 1.0));
        
    } else if (source_proj == 1) {
        // Stereographic source
        let stereo_proj = project(norm_lat, norm_lon);
        let u = (stereo_proj.x + 3.0) / 6.0; // Map [-3,3] to [0,1]
        let v = (stereo_proj.y + 3.0) / 6.0;
        tex_coords = vec2f(clamp(u, 0.0, 1.0), clamp(1.0 - v, 0.0, 1.0));
        
    } else if (source_proj == 2) {
        // Polar source
        let polar_proj = project(norm_lat, norm_lon);
        let u = (polar_proj.x + 2.0) / 4.0; // Map [-2,2] to [0,1]
        let v = (polar_proj.y + 2.0) / 4.0;
        tex_coords = vec2f(clamp(u, 0.0, 1.0), clamp(1.0 - v, 0.0, 1.0));
        
    } else if (source_proj == 3) {
        // Orthographic source
        let ortho_proj = project(norm_lat, norm_lon);
        let u = (ortho_proj.x + 1.0) / 2.0; // Map [-1,1] to [0,1]
        let v = (ortho_proj.y + 1.0) / 2.0;
        tex_coords = vec2f(clamp(u, 0.0, 1.0), clamp(1.0 - v, 0.0, 1.0));
        
    } else if (source_proj == 4) {
        // Mercator source
        let merc_proj = project(norm_lat, norm_lon);
        let u = (merc_proj.x + PI) / (2.0 * PI); // Map [-π,π] to [0,1]
        let v = clamp((merc_proj.y + 3.0) / 6.0, 0.0, 1.0); // Map approximately [-3,3] to [0,1]
        tex_coords = vec2f(u, 1.0 - v);
        
    } else {
        // Fallback to equirectangular
        let u = (norm_lon + PI) / (2.0 * PI);
        let v = 1.0 - (norm_lat + HALF_PI) / PI;
        tex_coords = vec2f(u, clamp(v, 0.0, 1.0));
    }
    
    let color = textureSample(world_texture, world_sampler, tex_coords);
    return color.rgb;
}

// Oblique transformation functions
fn oblique_transform_from_sphere(lat: f32, lon: f32, pole_lat: f32, pole_lon: f32) -> vec2f {
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
    
    return vec2f(new_lat, new_lon);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    // Convert screen coordinates to projection space using dynamic aspect ratio
    var coord = vec2f(in.uv.x * uniforms.aspect, in.uv.y);
    
    let projection_type = i32(uniforms.projection_type);

    // Scale the UI coordinate to extend to the edges of the projection plane
    coord = coord * planar_scale;
    // Apply zoom factor before inverse projection to narrow the view
    coord = coord * uniforms.zoom;
    
    // Perform inverse projection to get lat/lon
    let lat_lon = inverse(coord.x, coord.y);
    
    let lat = lat_lon.x;
    let lon = lat_lon.y;
    
    // Apply oblique transformation
    let oblique_result = oblique_transform_from_sphere(lat, lon, uniforms.camera_lat, uniforms.camera_lon);
    let final_lat = oblique_result.x;
    let final_lon = oblique_result.y;
    
    // Calculate graticule BEFORE any conditional branches (for uniform control flow)
    let graticule_intensity = is_graticule_line(final_lat, final_lon);
    
    // Sample world map texture
    let color = world_texture_color(final_lat, final_lon);

    // Check if the point is valid (within sphere bounds)
    if (abs(lat) > HALF_PI || abs(lon) > PI) {
        return vec4f(0.0, 0.0, 0.0, 1.0); // Black background
    }
    // Check bounds for projections
    if (projection_type == 2) {
        let r = sqrt(coord.x * coord.x + coord.y * coord.y);
        if (r > 1.0) {
            return vec4f(0.0, 0.0, 0.0, 1.0); // Black background
        }
    } else if (projection_type == 3) {
        // Check bounds for perspective
        let r = sqrt(coord.x * coord.x + coord.y * coord.y);
        let d = uniforms.zoom + 1.0; // Match the distance calculation above
        let max_r = sqrt((d - 1.0) / (d + 1.0));
        if (r > max_r) {
            return vec4f(0.0, 0.0, 0.0, 1.0); // Black background
        }
    }
    
    // Add Tissot's indicatrices if enabled
    var final_color = apply_tissot_indicatrices(color, final_lat, final_lon, uniforms.show_tissot);
    
    // Add graticule if enabled (using pre-calculated intensity)
    final_color = apply_graticule(final_color, graticule_intensity, uniforms.show_graticule);
    
    return vec4f(final_color, 1.0);
}