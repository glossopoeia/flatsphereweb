import package::common::{PI, HALF_PI};
import package::dstproj::{inverse, planar_scale};
import package::srcproj::{project, to_texture};
import package::tissot::{is_tissot_indicatrix, apply_tissot_indicatrices};
import package::graticule::{apply_graticule, is_graticule_line};

struct Uniforms {
    camera_lat: f32,
    camera_lon: f32,
    zoom: f32,
    aspect: f32,
    show_tissot: f32,
    show_graticule: f32,
    padding1: f32,
    padding2: f32,
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
fn source_color_at(lat: f32, lon: f32) -> vec3f {
    // Normalize longitude to [-π, π] range using proper modular arithmetic
    // WGSL doesn't have fmod, so we use: a - floor(a/b) * b
    let lon_normalized = lon + PI;
    let lon_wrapped = lon_normalized - floor(lon_normalized / (2.0 * PI)) * (2.0 * PI);
    let norm_lon = lon_wrapped - PI;
    
    // Clamp latitude to valid range
    let norm_lat = clamp(lat, -HALF_PI, HALF_PI);

    let proj_coords = project(norm_lat, norm_lon);
    let tex_coords = to_texture(proj_coords.x, proj_coords.y);
    
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

    // Scale the UI coordinates to extend to the edges of the projection plane
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
    let color = source_color_at(final_lat, final_lon);

    // Check if the point is valid (within sphere bounds)
    if (abs(lat) > HALF_PI || abs(lon) > PI) {
        return vec4f(0.0, 0.0, 0.0, 1.0); // Black background
    }
    
    // Add Tissot's indicatrices if enabled
    var final_color = apply_tissot_indicatrices(color, final_lat, final_lon, uniforms.show_tissot);
    
    // Add graticule if enabled (using pre-calculated intensity)
    final_color = apply_graticule(final_color, graticule_intensity, uniforms.show_graticule);
    
    return vec4f(final_color, 1.0);
}