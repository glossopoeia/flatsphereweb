import package::common::{PI, HALF_PI};

const planar_scale: vec2f = vec2(HALF_PI, HALF_PI);

fn project(lat: f32, lon: f32) -> vec2f {
    let a = acos(cos(lat) * cos(lon / 2.0));
    // a/sin(a) → 1 as a → 0; guard the 0/0 singularity at (lat=0, lon=0)
    let sinc_a = select(a / sin(a), 1.0, a < 1e-6);
    let x = 2.0 * cos(lat) * sin(lon / 2.0) * sinc_a;
    let y = sin(lat) * sinc_a;
    return vec2f(x, y);
}

fn inverse(x: f32, y: f32) -> vec2f {
    // Aitoff's image is the ellipse x^2 + 4y^2 <= PI^2. Outside it, the closed-form
    // approximation below either yields |lon| > PI (caught by reproject) or NaN
    // (which silently bypasses the bounds check), so we reject explicitly here.
    if (x * x + 4.0 * y * y > PI * PI) {
        return vec2f(-181.0, 0.0);
    }
    let halfX = x / 2.0;
    let x_over_4 = halfX / 2.0;
    let y_over_2 = y / 2.0;
    let a = sqrt(1 - x_over_4 * x_over_4 - y_over_2 * y_over_2);
    let lat = asin(y * a);
    let lon = 2 * atan2(halfX * a, 2.0 * a * a - 1.0);
    return vec2f(lat, lon);
}

fn to_texture(projX: f32, projY: f32) -> vec2f {
    let u = clamp((projX + PI) / (2.0 * PI), 0.0, 1.0); // Map [-PI,PI] to [0,1]
    let v = clamp((projY + HALF_PI) / PI, 0.0, 1.0);    // Map [-PI/2,PI/2] to [0,1]
    return vec2f(u, 1.0 - v);
}