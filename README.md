# Flatsphere Web

An interactive, educational tool for visualizing how different cartographic projections distort areas of the projected sphere. Built with WebGPU for real-time rendering in the browser.

Try it at: https://flatsphere.dev

## About

Every flat map of the Earth introduces distortion. Flatsphere Web lets you explore that distortion hands-on by switching between projections, dragging the viewpoint, and toggling overlays like Tissot's indicatrices and graticule lines. Two rendering modes are available: a mathematical color scheme that assigns a unique color to every point on the sphere, and a world map texture for geographic context.

Projection math is based on the [flatsphere](https://github.com/robertkleffner/flatsphere) Go library.

## Local Development

A local web server is required for WebGPU security policies.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in a browser with WebGPU support (Chrome 113+, Edge 113+).

## Versioning and Deployment

The site is deployed to GitHub Pages via GitHub Actions. Deployments are triggered by pushing a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The tag name is injected into the page footer at build time and is expected to use a simple, HTML‑safe format (e.g., semantic versions like `vX.Y.Z` using only ASCII letters, digits, dots, and hyphens). Manual `workflow_dispatch` runs use `dev` as the version. Pushes to `main` without a tag do not trigger a deploy.

## Dependencies

- [Pico CSS](https://picocss.com) — Minimal classless CSS framework
- [Alpine.js](https://alpinejs.dev) — Lightweight reactive JavaScript framework
- [WESL](https://wesl-lang.dev) — WebGPU Extended Shading Language

## Credits

World map texture sourced from [Solar System Scope](https://www.solarsystemscope.com/textures/) (free for non-commercial use).
