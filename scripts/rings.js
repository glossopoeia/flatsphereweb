// Range-rings overlay: units, uniform packing, and defaults.
//
// Ring radii are stored in whatever unit the user picked and converted to a central angle in
// radians only at the render boundary, matching how the rest of the app keeps degrees in the store
// and converts on the way to the GPU.

import { hexToRgbNormalized } from './export.js';

// Ring slots in the uniform buffer. Kept in lockstep with MAX_RINGS in shaders/rangerings.wesl.
export const MAX_RINGS = 8;

// Shared all-zero ring block for every render that draws no rings, so the disabled case costs no
// per-frame allocation. Never mutated: packRings always builds a fresh array when it has rings.
export const EMPTY_RINGS = new Float32Array(MAX_RINGS * 4);

// IUGG mean Earth radius. The rendered sphere is unitless, so this constant is the only thing that
// gives "kilometres" a meaning: it fixes the scale at which a central angle becomes a ground
// distance. A great circle is therefore 2*PI*R = 40030 km and the maximum useful radius is half of
// that, the distance to the antipode.
export const EARTH_RADIUS_KM = 6371.0088;

export const RING_UNITS = {
    km: {
        label: 'Kilometres',
        suffix: ' km',
        // step and decimals must agree: a step coarser than the rounding a unit switch applies
        // leaves every converted radius in stepMismatch. One integer km, three decimal degrees.
        step: 1,
        decimals: 0,
        max: Math.round(Math.PI * EARTH_RADIUS_KM),
        toRadians: v => v / EARTH_RADIUS_KM,
        fromRadians: rad => rad * EARTH_RADIUS_KM,
    },
    deg: {
        label: 'Degrees',
        suffix: '°',
        step: 0.001,
        decimals: 3,
        max: 180,
        toRadians: v => v * Math.PI / 180,
        fromRadians: rad => rad * 180 / Math.PI,
    },
};

export function ringUnit(unit) {
    return RING_UNITS[unit] || RING_UNITS.km;
}

// Central angle in radians for a ring radius, clamped to the antipode. Returns 0 for anything
// non-positive or unparseable, which is the shader's "unused slot" sentinel.
export function ringRadiusToRadians(value, unit) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.min(ringUnit(unit).toRadians(value), Math.PI);
}

// Re-express a radius when the unit selector changes, so the physical distance is preserved
// instead of the bare number being silently reinterpreted (1000 km is not 1000 degrees).
export function convertRingRadius(value, fromUnit, toUnit) {
    if (fromUnit === toUnit || !Number.isFinite(value)) return value;
    const radians = ringUnit(fromUnit).toRadians(value);
    const to = ringUnit(toUnit);
    return +to.fromRadians(radians).toFixed(to.decimals);
}

// Distinct hues that stay legible over both ocean and land. Deliberately avoids pairing red with
// green so adjacent rings stay tellable apart with the common colour-vision deficiencies.
const RING_PALETTE = ['#ffcc00', '#00d0ff', '#ff5c8a', '#7cff6b', '#ff9f40', '#c08bff', '#ffffff', '#00e5c0'];

export function ringColorForIndex(index) {
    return RING_PALETTE[index % RING_PALETTE.length];
}

// First palette entry not already on a ring. Indexing by rings.length would hand out a colour that
// is still in use once an earlier ring has been deleted, which is exactly the collision the palette
// is chosen to avoid. Falls back to cycling when every hue is taken.
export function nextRingColor(rings) {
    const used = new Set((rings || []).map(ring => ring.color));
    for (const color of RING_PALETTE) {
        if (!used.has(color)) return color;
    }
    return ringColorForIndex((rings || []).length);
}

export function formatRingLabel(radius, unit) {
    return `${radius}${ringUnit(unit).suffix}`;
}

// Seeded when the overlay is first switched on, so enabling it is never a no-op.
export function defaultRings(unit) {
    const radii = unit === 'deg' ? [10, 20, 30] : [1000, 2000, 3000];
    return radii.map((radius, i) => ({
        id: i + 1,
        enabled: true,
        radius,
        color: ringColorForIndex(i),
        label: formatRingLabel(radius, unit),
    }));
}

// Pack the ring list into the uniform layout: one vec4f per slot, (radius_rad, r, g, b).
// Disabled and zero-radius rings are dropped rather than zeroed in place, so the live rings always
// occupy the leading slots and the shader's scan stops finding work as early as possible.
export function packRings(rings, unit) {
    const packed = new Float32Array(MAX_RINGS * 4);
    let slot = 0;
    for (const ring of rings || []) {
        if (slot >= MAX_RINGS) break;
        if (!ring.enabled) continue;
        const radius = ringRadiusToRadians(ring.radius, unit);
        if (radius <= 0) continue;
        const [r, g, b] = hexToRgbNormalized(ring.color);
        packed.set([radius, r, g, b], slot * 4);
        slot++;
    }
    return packed;
}

// Rings that will actually be drawn, in draw order, for the legend.
export function legendEntries(rings, unit) {
    return (rings || [])
        .filter(ring => ring.enabled && ringRadiusToRadians(ring.radius, unit) > 0)
        .slice(0, MAX_RINGS)
        .map(ring => ({
            label: (ring.label || '').trim() || formatRingLabel(ring.radius, unit),
            color: ring.color,
        }));
}

// --- Legend ----------------------------------------------------------------

const LEGEND = {
    marginRatio: 0.025,     // of the shorter edge
    fontRatio: 0.018,       // of image height
    minFontPx: 11,
    swatchRatio: 0.9,       // of the font size
    padRatio: 0.7,          // of the font size
    rowGapRatio: 0.45,
};

const LEGEND_THEMES = {
    light: { panel: 'rgba(255, 255, 255, 0.82)', text: '#101418', border: 'rgba(0, 0, 0, 0.18)' },
    dark:  { panel: 'rgba(12, 15, 20, 0.72)',    text: '#f2f5f8', border: 'rgba(255, 255, 255, 0.22)' },
};

function legendMetrics(width, height, count) {
    const font = Math.max(LEGEND.minFontPx, Math.round(height * LEGEND.fontRatio));
    const pad = Math.round(font * LEGEND.padRatio);
    const rowGap = Math.round(font * LEGEND.rowGapRatio);
    const swatch = Math.round(font * LEGEND.swatchRatio);
    const rowH = Math.max(font, swatch);
    const margin = Math.round(Math.min(width, height) * LEGEND.marginRatio);
    return {
        font, pad, rowGap, swatch, rowH, margin,
        boxH: pad * 2 + count * rowH + (count - 1) * rowGap,
    };
}

// Mean Rec. 709 luma of the pixels the panel will cover, in 0..1. Sampled on a coarse stride
// because the answer only has to pick between two themes, not be exact.
function meanLuma(rgba, imgWidth, imgHeight, box) {
    const x0 = Math.max(0, Math.floor(box.x));
    const y0 = Math.max(0, Math.floor(box.y));
    const x1 = Math.min(imgWidth, Math.ceil(box.x + box.w));
    const y1 = Math.min(imgHeight, Math.ceil(box.y + box.h));
    if (x1 <= x0 || y1 <= y0) return 0;
    const stride = Math.max(1, Math.floor(Math.min(x1 - x0, y1 - y0) / 16));
    let sum = 0, weight = 0;
    for (let y = y0; y < y1; y += stride) {
        for (let x = x0; x < x1; x += stride) {
            const i = (y * imgWidth + x) * 4;
            // Alpha-weighted mean. A transparent pixel carries no colour of its own, so it must not
            // count as black: dividing by the accumulated alpha rather than the sample count lets a
            // partly transparent area be judged by its opaque pixels alone. An area with no opaque
            // pixels at all yields 0, which the caller treats as dark.
            const a = rgba[i + 3] / 255;
            sum += (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255 * a;
            weight += a;
        }
    }
    return weight > 0 ? sum / weight : 0;
}

/**
 * Draw the ring legend into a 2D context.
 *
 * entries  [{ label, color }] from legendEntries()
 * theme    'auto' | 'light' | 'dark'. 'auto' needs `pixels` to measure against.
 * pixels   optional RGBA buffer of the image the legend is being drawn over, used by 'auto'.
 *
 * Returns the theme actually drawn ('light' or 'dark'), or null when nothing was drawn, so a
 * caller that repaints often can reuse an 'auto' decision instead of re-sampling every time.
 */
export function drawRingLegend(ctx, entries, { width, height, theme = 'auto', pixels = null } = {}) {
    if (!entries || entries.length === 0) return null;

    const m = legendMetrics(width, height, entries.length);
    ctx.save();
    ctx.font = `${m.font}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textBaseline = 'middle';

    // Clamp the panel into the image. Label width is user-controlled and the font scales with
    // image height, so on an extreme aspect (a tall narrow export, or a short wide one with eight
    // rings) the natural box is wider or taller than the image and would be drawn partly outside
    // it. Clamping keeps the panel on-canvas; the clip below keeps its contents inside the panel.
    const textW = entries.reduce((max, e) => Math.max(max, ctx.measureText(e.label).width), 0);
    const naturalW = m.pad * 2 + m.swatch + m.pad * 0.6 + textW;
    const boxW = Math.min(naturalW, Math.max(0, width - m.margin * 2));
    const boxH = Math.min(m.boxH, Math.max(0, height - m.margin * 2));
    const box = { x: m.margin, y: Math.max(m.margin, height - m.margin - boxH), w: boxW, h: boxH };
    if (box.w <= 0 || box.h <= 0) {
        ctx.restore();
        return null;
    }

    let resolved = theme;
    if (resolved !== 'light' && resolved !== 'dark') {
        // Below mid-grey the image is dark, so a dark panel with light text keeps the legend
        // reading as an overlay rather than a bright patch punched out of the map.
        resolved = pixels ? (meanLuma(pixels, width, height, box) < 0.5 ? 'dark' : 'light') : 'dark';
    }
    const palette = LEGEND_THEMES[resolved];

    const radius = Math.round(m.font * 0.35);
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, radius);
    ctx.fillStyle = palette.panel;
    ctx.fill();
    ctx.lineWidth = Math.max(1, Math.round(height / 1200));
    ctx.strokeStyle = palette.border;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, radius);
    ctx.clip();

    entries.forEach((entry, i) => {
        const cy = box.y + m.pad + i * (m.rowH + m.rowGap) + m.rowH / 2;
        ctx.beginPath();
        ctx.roundRect(box.x + m.pad, cy - m.swatch / 2, m.swatch, m.swatch, Math.round(m.swatch * 0.25));
        ctx.fillStyle = entry.color;
        ctx.fill();
        ctx.strokeStyle = palette.border;
        ctx.stroke();

        ctx.fillStyle = palette.text;
        ctx.fillText(entry.label, box.x + m.pad + m.swatch + m.pad * 0.6, cy);
    });

    ctx.restore();
    ctx.restore();
    return resolved;
}
