import extract from 'https://cdn.jsdelivr.net/npm/png-chunks-extract@1/+esm';
import encode from 'https://cdn.jsdelivr.net/npm/png-chunks-encode@1/+esm';
import text from 'https://cdn.jsdelivr.net/npm/png-chunk-text@1/+esm';
import piexif from 'https://cdn.jsdelivr.net/npm/piexifjs@1/+esm';

const METADATA_KEY = 'flatsphere';
const METADATA_SCHEMA_VERSION = 1;

// Build a JSON-serializable payload describing the current projection state.
// This is the format embedded in PNG/JPEG/WebP metadata, designed to round-trip back into the app.
export function serializeProjectionState(store, projections) {
    const dst = projections.find(p => p.id === store.destinationProjection);
    const src = projections.find(p => p.id === store.sourceProjection);
    return {
        tool: 'flatsphere',
        schemaVersion: METADATA_SCHEMA_VERSION,
        projection: {
            destination: dst ? dst.shader : null,
            source: src ? src.shader : null,
        },
        view: {
            obliqueLatDeg: store.obliqueLat,
            obliqueLonDeg: store.obliqueLon,
            rotationDeg: store.rotation,
            zoom: store.zoom,
            panX: store.panX,
            panY: store.panY,
            aspectRatioMultiplier: store.aspectRatio,
        },
        overlays: {
            tissot: store.tissot,
            graticule: store.graticule,
            graticuleWidth: store.graticuleWidth,
        },
    };
}

// Insert a tEXt chunk carrying the payload into a PNG blob, just before IEND.
export async function embedPngMetadata(blob, payload) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const chunks = extract(bytes);
    const textChunk = text.encode(METADATA_KEY, JSON.stringify(payload));
    // chunks[length-1] is IEND; insert tEXt before it
    chunks.splice(chunks.length - 1, 0, textChunk);
    return new Blob([encode(chunks)], { type: 'image/png' });
}

// Byte ↔ binary-string conversion that maps each byte to/from a codepoint 1-for-1.
// We can't use TextDecoder('latin1') because the spec aliases it to windows-1252, which
// remaps bytes 0x80-0x9F to non-byte codepoints and silently corrupts binary data.
function bytesToBinaryString(bytes) {
    let s = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return s;
}

function binaryStringToBytes(s) {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
}

// --- RIFF (WebP) helpers ---
function readFourCC(bytes, off) {
    return String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
}
function writeFourCC(bytes, off, fourCC) {
    for (let i = 0; i < 4; i++) bytes[off + i] = fourCC.charCodeAt(i);
}
function readU32LE(bytes, off) {
    return bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24);
}
function writeU32LE(bytes, off, value) {
    bytes[off] = value & 0xff;
    bytes[off + 1] = (value >> 8) & 0xff;
    bytes[off + 2] = (value >> 16) & 0xff;
    bytes[off + 3] = (value >> 24) & 0xff;
}
function writeU24LE(bytes, off, value) {
    bytes[off] = value & 0xff;
    bytes[off + 1] = (value >> 8) & 0xff;
    bytes[off + 2] = (value >> 16) & 0xff;
}

async function getImageDimensions(blob) {
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return { width: img.naturalWidth, height: img.naturalHeight };
    } finally {
        URL.revokeObjectURL(url);
    }
}

function buildXmpPacket(payload) {
    const jsonEscaped = JSON.stringify(payload)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:flatsphere="https://flatsphere.dev/ns/1#"><flatsphere:state>${jsonEscaped}</flatsphere:state></rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`;
}

// Embed payload into a WebP blob via an XMP RIFF chunk. WebP requires a VP8X
// extended header to carry XMP, so we insert one when missing and set its XMP flag.
export async function embedWebpMetadata(blob, payload) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length < 12 || readFourCC(bytes, 0) !== 'RIFF' || readFourCC(bytes, 8) !== 'WEBP') {
        throw new Error('Not a valid WebP file');
    }

    // Parse all chunks after the RIFF/WEBP header
    const chunks = [];
    let offset = 12;
    while (offset + 8 <= bytes.length) {
        const fourCC = readFourCC(bytes, offset);
        const size = readU32LE(bytes, offset + 4);
        const dataStart = offset + 8;
        const dataEnd = dataStart + size;
        const padSize = size & 1;
        chunks.push({ fourCC, data: bytes.slice(dataStart, dataEnd), padSize });
        offset = dataEnd + padSize;
    }

    // Ensure VP8X chunk exists (required when XMP/EXIF/anim/icc/alpha flags are used).
    // We need the canvas dimensions; for non-VP8X WebPs the simplest reliable source is decoding.
    const XMP_FLAG = 0x04;
    let vp8xIdx = chunks.findIndex(c => c.fourCC === 'VP8X');
    if (vp8xIdx === -1) {
        const { width, height } = await getImageDimensions(blob);
        const vp8xData = new Uint8Array(10);
        vp8xData[0] = XMP_FLAG;
        writeU24LE(vp8xData, 4, width - 1);
        writeU24LE(vp8xData, 7, height - 1);
        chunks.unshift({ fourCC: 'VP8X', data: vp8xData, padSize: 0 });
    } else {
        chunks[vp8xIdx].data[0] |= XMP_FLAG;
    }

    // Append the XMP chunk
    const xmpPayload = new TextEncoder().encode(buildXmpPacket(payload));
    chunks.push({ fourCC: 'XMP ', data: xmpPayload, padSize: xmpPayload.length & 1 });

    // Rebuild RIFF
    let payloadLen = 4; // "WEBP" FourCC
    for (const c of chunks) payloadLen += 8 + c.data.length + c.padSize;
    const out = new Uint8Array(8 + payloadLen);
    writeFourCC(out, 0, 'RIFF');
    writeU32LE(out, 4, payloadLen);
    writeFourCC(out, 8, 'WEBP');
    let pos = 12;
    for (const c of chunks) {
        writeFourCC(out, pos, c.fourCC);
        writeU32LE(out, pos + 4, c.data.length);
        out.set(c.data, pos + 8);
        pos += 8 + c.data.length + c.padSize;
    }

    return new Blob([out], { type: 'image/webp' });
}

// Embed payload into a JPEG blob via EXIF. piexifjs operates on Latin-1 binary strings,
// so we decode/encode bytes ↔ string at the API boundary.
export async function embedJpegMetadata(blob, payload) {
    const bytesIn = new Uint8Array(await blob.arrayBuffer());
    const binStrIn = bytesToBinaryString(bytesIn);

    const exif = {
        '0th': {
            [piexif.ImageIFD.Software]: `${payload.tool}/${payload.schemaVersion}`,
            [piexif.ImageIFD.ImageDescription]: JSON.stringify(payload),
        },
    };
    const exifBytes = piexif.dump(exif);
    const binStrOut = piexif.insert(exifBytes, binStrIn);

    return new Blob([binaryStringToBytes(binStrOut)], { type: 'image/jpeg' });
}

export function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Parse #rrggbb into [r, g, b] floats in [0, 1]. Returns black on parse failure.
export function hexToRgbNormalized(hex) {
    const m = /^#?([a-f0-9]{6})$/i.exec(hex);
    if (!m) return [0, 0, 0];
    const v = parseInt(m[1], 16);
    return [(v >> 16) / 255, ((v >> 8) & 0xff) / 255, (v & 0xff) / 255];
}

// Build a descriptive basename from current projection state.
// e.g. "flatsphere-mollweide-lat15-lon-30-rot45". Caller appends extension.
export function generateAutoBasename(store, projections) {
    const proj = projections.find(p => p.id === store.destinationProjection);
    const projSlug = proj ? proj.shader : `proj${store.destinationProjection}`;
    const lat = Math.round(store.obliqueLat);
    const lon = Math.round(store.obliqueLon);
    const parts = ['flatsphere', projSlug, `lat${lat}`, `lon${lon}`];
    const rot = Math.round(store.rotation);
    if (rot !== 0) parts.push(`rot${rot}`);
    return parts.join('-');
}

// Ensure the filename has the right image extension; replace mismatched image extensions.
export function withImageExtension(basename, ext) {
    const stripped = basename.replace(/\.(png|jpe?g|webp)$/i, '');
    return `${stripped}.${ext}`;
}
