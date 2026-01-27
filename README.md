# WebGPU Sphere Reprojection Tool

A WebGPU-based tool for visualizing different map projections of spherical data in real-time. This project implements several cartographic projections using WebGPU compute shaders for high-performance rendering with full mobile and desktop support.

## Features

- **Cross-platform support** with responsive design for mobile and desktop
- **Touch and mouse interaction** for intuitive map navigation
- **Fullscreen mode** available on all platforms
- **Transparent overlay controls** that float above the map visualization
- **Real-time projection rendering** using WebGPU fragment shaders
- **Multiple projection types** including:
  - Stereographic (with zoom control)
  - Polar (Azimuthal Equidistant) (with zoom control)
  - Orthographic (with zoom control)
  - Vertical Perspective (with zoom control)
  - Mercator (with zoom control)
  - Plate Carrée (Equirectangular) (with zoom control)
- **Oblique aspect support** with camera latitude/longitude controls
- **Universal zoom control** for all projections
- **Dual rendering modes**:
  - **Mathematical color mapping** that creates unique colors based on latitude/longitude coordinates
  - **World map texture** using real Earth imagery for geographic visualization
- **Interactive controls** for projection parameters

## Mobile Features

- **Touch-friendly interface** with larger touch targets and optimized layouts
- **Drag navigation** works seamlessly with both mouse and touch input  
- **Auto-hiding controls** on mobile devices to maximize map viewing area
- **Responsive overlay design** that adapts to different screen sizes and orientations
- **Fullscreen support** with native mobile fullscreen API integration
- **Gesture prevention** to avoid conflicts with browser navigation gestures

## Rendering Modes

### Mathematical Color Scheme

The tool uses a mathematical approach to generate colors that are unique for each latitude/longitude coordinate:

- **Hue**: Based on longitude (0-360° mapped to color wheel)
- **Saturation**: Based on distance from poles (0 at poles, max at equator) 
- **Luminosity**: Based on latitude (0 at north pole, 1 at south pole)

This creates a visually distinctive pattern that helps identify distortion and coordinate mapping in different projections.

### World Map Texture

The world map mode uses real Earth imagery to provide a geographically accurate representation. The texture is sourced from Solar System Scope, which provides high-quality seamless planetary textures suitable for 3D visualization.

This mode allows for:
- **Geographic context** when exploring different projections
- **Visual understanding** of how landmasses appear in various map projections
- **Educational visualization** of cartographic distortion effects
- **Seamless wrapping** at longitude boundaries and clean polar regions

## Projection Mathematics

The tool implements projection mathematics similar to those found in the [flatsphere](https://github.com/robertkleffner/flatsphere) Go library, including:

- Forward and inverse projection transformations
- Oblique aspect calculations for arbitrary camera positions
- Perspective projection with configurable zoom levels
- Proper handling of projection boundaries and singularities

## Usage

1. **Start a local web server** (required for WebGPU security):
   ```bash
   python3 -m http.server 8080
   ```

2. **Open your browser** to `http://localhost:8080`

3. **Select a projection type** from the dropdown menu

4. **Choose a rendering mode**:
   - **Mathematical Colors**: Unique mathematical color mapping for coordinate analysis
   - **World Map Texture**: Real Earth imagery for geographic visualization

5. **Adjust camera position** using mouse drag controls (click and drag on the canvas)

6. **Use the zoom slider** to zoom in/out on any projection

7. **Toggle overlays** to display:
   - **Tissot's Indicatrices**: Red circles showing distortion patterns
   - **Graticule Lines**: White grid lines showing coordinate system

## Browser Requirements

- Modern browser with WebGPU support (Chrome 113+, Edge 113+, or experimental support in Firefox)
- WebGPU must be enabled in browser flags if not enabled by default

## Technical Details

- **No external dependencies** - uses only browser APIs
- **Fragment shader-based rendering** for optimal GPU performance
- **Real-time parameter updates** with immediate visual feedback
- **Responsive canvas sizing** that adapts to window size

## Implementation Notes

The WebGPU shader implements both forward and inverse projection mathematics to convert between screen coordinates and spherical coordinates. The oblique aspect transformation allows for arbitrary camera positioning, enabling exploration of projections from different viewpoints.

The color generation scheme ensures that every point on the sphere has a unique, mathematically-determined color, making it easy to track how coordinates transform between the sphere and various map projections.

## Image Attribution

The world map texture used in this tool is sourced from Solar System Scope:
- **Source**: https://www.solarsystemscope.com/textures/
- **License**: Free for non-commercial use
- **Description**: High-quality 2048x1024 seamless Earth daymap texture without borders or artifacts
- **Features**: Clean polar regions and proper longitude seam wrapping for accurate cartographic visualization