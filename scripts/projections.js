export const projections = [
    { id: 0, shader: 'plate-carree', name: 'Plate Carrée (Equirectangular)', description: 'Simple rectangular projection', emoji: '🗺️', properties: ['Equidistant'] },
    { id: 1, shader: 'mercator', name: 'Mercator', description: 'Preserves angles, distorts area', emoji: '🧭', properties: ['Conformal'] },
    { id: 2, shader: 'orthographic', name: 'Orthographic', description: 'Earth as seen from space', emoji: '🌍', properties: ['Azimuthal'] },
    { id: 3, shader: 'vertical-perspective', name: 'Vertical Perspective', description: 'Perspective from altitude', emoji: '🛰️', properties: ['Azimuthal'] },
    { id: 4, shader: 'azimuthal-equidistant', name: 'Azimuthal Equidistant', description: 'Preserves distance from center', emoji: '📡', properties: ['Azimuthal', 'Equidistant'] },
    { id: 5, shader: 'stereographic', name: 'Stereographic', description: 'Conformal azimuthal projection', emoji: '⭕', properties: ['Conformal', 'Azimuthal'] },
    { id: 6, shader: 'sinusoidal', name: 'Sinusoidal', description: 'Equal-area pseudocylindrical', emoji: '〰️', properties: ['Equal-Area'] },
    { id: 7, shader: 'lambert-azimuthal', name: 'Lambert Azimuthal Equal-Area', description: 'Preserves area', emoji: '🎯', properties: ['Equal-Area', 'Azimuthal'] },
    { id: 8, shader: 'gnomonic', name: 'Gnomonic', description: 'Great circles as straight lines', emoji: '📐', properties: ['Azimuthal', 'Gnomonic'] },
    { id: 9, shader: 'mollweide', name: 'Mollweide', description: 'Equal-area elliptical projection', emoji: '🥚', properties: ['Equal-Area'] }
];