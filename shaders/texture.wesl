import package::tissot::{is_tissot_indicatrix, apply_tissot_indicatrices, PI, HALF_PI};

struct Uniforms {
    projection_type: f32,
    camera_lat: f32,
    camera_lon: f32,
    zoom: f32,
    aspect: f32,
    show_tissot: f32,
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

// Sample world map texture based on lat/lon
fn world_texture_color(lat: f32, lon: f32) -> vec3f {
    // Convert spherical coordinates to equirectangular texture coordinates
    // Longitude: -π to π maps to 0 to 1 (u coordinate)
    let u = (lon + PI) / (2.0 * PI);
    // Latitude: -π/2 to π/2 maps to 1 to 0 (v coordinate, flipped)
    let v = 1.0 - (lat + HALF_PI) / PI;
    
    let tex_coords = vec2f(u, v);
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
        new_lon = lon - pole_lon;
    } else if (abs(pole_lat + HALF_PI) < 1e-6) {
        new_lon = pole_lon - lon - PI;
    } else {
        let sin_lat = sin(lat);
        let cos_lat = cos(lat);
        let sin_pole_lat = sin(pole_lat);
        let cos_pole_lat = cos(pole_lat);
        
        let numer = cos_lat * sin(lon - pole_lon);
        let denom = cos_pole_lat * sin_lat - sin_pole_lat * cos_lat * pole_rel_cos;
        new_lon = atan2(numer, denom);
    }
    
    return vec2f(new_lat, new_lon);
}

// Projection functions
fn stereographic_project(lat: f32, lon: f32) -> vec2f {
    let r = 1.0 / tan(lat / 2.0 + PI / 4.0);
    return vec2f(r * sin(lon), -r * cos(lon));
}

fn polar_project(lat: f32, lon: f32) -> vec2f {
    let r = HALF_PI - lat;
    return vec2f(r * sin(lon), -r * cos(lon));
}

fn orthographic_project(lat: f32, lon: f32) -> vec2f {
    return vec2f(cos(lat) * sin(lon), sin(lat));
}

fn vertical_perspective_project(lat: f32, lon: f32, d: f32) -> vec2f {
    if (d > 100.0) {
        return orthographic_project(lat, lon);
    }
    
    let cos_c = sin(lat);
    let k = (d - 1.0) / (d - cos_c);
    
    let x = k * cos(lat) * sin(lon);
    let y = k * sin(lat);
    return vec2f(x, y);
}

fn mercator_project(lat: f32, lon: f32) -> vec2f {
    return vec2f(lon, log(tan(PI / 4.0 + lat / 2.0)));
}

fn plate_carree_project(lat: f32, lon: f32) -> vec2f {
    return vec2f(lon, lat);
}

// Inverse projection functions
fn stereographic_inverse(x: f32, y: f32) -> vec2f {
    let r = sqrt(x * x + y * y);
    let lat = HALF_PI - 2.0 * atan(r);
    let lon = atan2(x, -y);
    return vec2f(lat, lon);
}

fn polar_inverse(x: f32, y: f32) -> vec2f {
    let r = sqrt(x * x + y * y);
    let lat = HALF_PI - r;
    let lon = atan2(x, -y);
    return vec2f(lat, lon);
}

fn orthographic_inverse(x: f32, y: f32) -> vec2f {
    let r = sqrt(x * x + y * y);
    if (r > 1.0) {
        return vec2f(0.0, 0.0); // Outside sphere
    }
    let lat = asin(y);
    let lon = asin(x / cos(lat));
    return vec2f(lat, lon);
}

fn vertical_perspective_inverse(x: f32, y: f32, d: f32) -> vec2f {
    if (d > 100.0) {
        return orthographic_inverse(x, y);
    }
    
    let r = sqrt(x * x + y * y);
    if (r == 0.0) {
        return vec2f(0.0, 0.0);
    }
    
    let max_r = sqrt((d - 1.0) / (d + 1.0));
    if (r > max_r) {
        return vec2f(0.0, 0.0); // Outside visible sphere
    }
    
    let denom = (d - 1.0) / r + r / (d - 1.0);
    let numer = d - sqrt(1.0 - ((r * r * (d + 1.0)) / (d - 1.0)));
    let c = asin(numer / denom);
    
    let lat = asin((y * sin(c)) / r);
    let lon = atan2(x * sin(c), r * cos(c));
    return vec2f(lat, lon);
}

fn mercator_inverse(x: f32, y: f32) -> vec2f {
    let lat = atan(sinh(y));
    let lon = x;
    return vec2f(lat, lon);
}

fn plate_carree_inverse(x: f32, y: f32) -> vec2f {
    return vec2f(y, x);
}



@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    // Convert screen coordinates to projection space using dynamic aspect ratio
    var coord = vec2f(in.uv.x * uniforms.aspect, in.uv.y);
    
    let projection_type = i32(uniforms.projection_type);
    
    // Scale coordinates based on projection type
    if (projection_type == 0) { // Stereographic
        coord = coord * 3.0;
    } else if (projection_type == 1) { // Polar
        coord = coord * 2.0;
    } else if (projection_type == 2) { // Orthographic
        coord = coord * uniforms.zoom;
    } else if (projection_type == 3) { // Perspective
        coord = coord * 1.5;
    } else if (projection_type == 4) { // Mercator
        coord = vec2f(coord.x * PI, coord.y * 3.0);
    } else if (projection_type == 5) { // Plate Carree
        coord = vec2f(coord.x * PI, coord.y * HALF_PI);
    }
    
    // Perform inverse projection to get lat/lon
    var lat_lon: vec2f;
    
    if (projection_type == 0) {
        lat_lon = stereographic_inverse(coord.x, coord.y);
    } else if (projection_type == 1) {
        lat_lon = polar_inverse(coord.x, coord.y);
    } else if (projection_type == 2) {
        lat_lon = orthographic_inverse(coord.x, coord.y);
    } else if (projection_type == 3) {
        lat_lon = vertical_perspective_inverse(coord.x, coord.y, uniforms.zoom);
    } else if (projection_type == 4) {
        lat_lon = mercator_inverse(coord.x, coord.y);
    } else if (projection_type == 5) {
        lat_lon = plate_carree_inverse(coord.x, coord.y);
    } else {
        return vec4f(0.0, 0.0, 0.0, 1.0); // Black for unknown projection
    }
    
    let lat = lat_lon.x;
    let lon = lat_lon.y;
    
    // Apply oblique transformation
    let oblique_result = oblique_transform_from_sphere(lat, lon, uniforms.camera_lat, uniforms.camera_lon);
    let final_lat = oblique_result.x;
    let final_lon = oblique_result.y;
    
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
        let max_r = sqrt((uniforms.zoom - 1.0) / (uniforms.zoom + 1.0));
        if (r > max_r) {
            return vec4f(0.0, 0.0, 0.0, 1.0); // Black background
        }
    }
    
    // Add Tissot's indicatrices if enabled
    let final_color = apply_tissot_indicatrices(color, final_lat, final_lon, uniforms.show_tissot);
    
    return vec4f(final_color, 1.0);
}