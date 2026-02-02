import package::common::{PI, HALF_PI, SQRT_2};

const planar_scale: vec2f = vec2(SQRT_2, SQRT_2);

const tolerance: f32 = 1e-9;
const epsilon: f32 = 1e-15;
const max_iterations: u32 = 8u;

fn project(lat: f32, lon: f32) -> vec2f {
    // We first need to calculate an auxiliary angle theta, derived iteratively via Newton's method.
    // The iterative method we use converges quickly, except near the poles, so max_iterations may need
    // to be adjusted if zooming in on the poles is desired.
    let target_val = PI * sin(lat);
    var theta = lat;
    for (var i = 0u; i < max_iterations && abs(theta - target_val) > tolerance; i++) {
        let numer = 2.0 * theta + sin(2.0 * theta) - target_val;
        let denom = 2.0 + 2.0 * cos(2.0 * theta);
        let new_theta = theta - (numer / denom);
        theta = new_theta;
    }
    
    let x = (2.0 * SQRT_2 / PI) * lon * cos(theta);
    let y = SQRT_2 * sin(theta);
    
    return vec2f(x, y);
}

fn inverse(x: f32, y: f32) -> vec2f {
    // Check if point is within the Mollweide ellipse bounds
    let ellipse_test = (x * x) / (8.0) + (y * y) / (2.0);
    if (ellipse_test > 1.0 || abs(y) > SQRT_2) {
        return vec2f(-181.0, 0.0); // Outside bounds, sentinel value
    }
    
    let theta = asin(clamp(y / SQRT_2, -1.0, 1.0));
    let lat = asin(clamp((2.0 * theta + sin(2.0 * theta)) / PI, -1.0, 1.0));
    
    let denom = SQRT_2 * cos(theta);
    var lon: f32;
    if (abs(denom) < epsilon) {
        lon = 0.0; // At poles, longitude is undefined/arbitrary
    } else {
        lon = (x / denom) * HALF_PI;
    }
    
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = (projX + 2.0 * SQRT_2) / (4.0 * SQRT_2); // Map [-2sqrt(2),2sqrt(2)] to [0,1]
    let v = (projY + SQRT_2) / (2.0 * SQRT_2); // Map [-sqrt(2),sqrt(2)] to [0,1]
    return vec2f(u, 1.0 - v);
}