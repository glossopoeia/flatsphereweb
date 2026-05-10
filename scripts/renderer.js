import { link } from "https://cdn.jsdelivr.net/npm/wesl/+esm";
import { projections } from "./projections.js";

const MAX_IMAGE_PIXELS = 4096 * 4096; // keep in sync with image-loader.js

export class ProjectionRenderer {
    constructor() {
        this.device = null;
        this.context = null;
        this.canvasFormat = null;
        this.uniformBuffer = null;
        this.bindGroup = null;
        this.bindGroupLayout = null;
        this.canvas = null;
        this.worldTexture = null;
        this.sampler = null;

        this.shaderSources = null;
        this.pipelineCache = new Map();
        this.onPipelineReady = null;
        this.onPipelineError = null;
    }
    
    async initialize(canvas) {
        this.canvas = canvas;
        
        // Get WebGPU adapter and device
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('No appropriate GPUAdapter found.');
        }
        
        this.device = await adapter.requestDevice();

        // Fetch shader sources in parallel; defer pipeline compilation until projections are first used
        const fetchText = async (path) => {
            const r = await fetch(path);
            if (!r.ok) {
                throw new Error(`Failed to fetch shader '${path}': ${r.status} ${r.statusText}`);
            }
            return r.text();
        };
        const [commonSource, tissotSource, graticuleSource, obliqueSource, reprojectSource, ...projectionSources] =
            await Promise.all([
                fetchText("./shaders/common.wesl"),
                fetchText("./shaders/tissot.wesl"),
                fetchText("./shaders/graticule.wesl"),
                fetchText("./shaders/oblique.wesl"),
                fetchText("./shaders/reproject.wesl"),
                ...projections.map(p => fetchText(`./shaders/${p.shader}.wesl`)),
            ]);
        this.shaderSources = {
            common: commonSource,
            tissot: tissotSource,
            graticule: graticuleSource,
            oblique: obliqueSource,
            reproject: reprojectSource,
            projections: projectionSources,
        };

        this.context = canvas.getContext('webgpu');
        this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: this.canvasFormat,
        });
        
        // Create uniform buffer
        this.uniformBuffer = this.device.createBuffer({
            size: 48, // 12 floats * 4 bytes each (16-byte aligned)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        // Load world map texture
        await this.loadDefaultTexture(true);
        
        // Create sampler
        this.sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'clamp-to-edge',
        });

        this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {}
                }
            ]
        });
        this.updateBindGroup();
    }

    // Cache entries are tagged: { kind: 'pipeline' | 'promise' | 'error', value }
    async ensurePipeline(dst, src) {
        const key = `${dst},${src}`;
        const entry = this.pipelineCache.get(key);
        if (entry) {
            if (entry.kind === 'error') throw entry.value;
            return entry.value; // pipeline or in-flight promise; both awaitable
        }
        const promise = this._createPipeline(dst, src);
        this.pipelineCache.set(key, { kind: 'promise', value: promise });
        try {
            const pipeline = await promise;
            this.pipelineCache.set(key, { kind: 'pipeline', value: pipeline });
            return pipeline;
        } catch (err) {
            this.pipelineCache.set(key, { kind: 'error', value: err });
            throw err;
        }
    }

    async _createPipeline(dst, src) {
        const s = this.shaderSources;
        const linked = await link({
            rootModuleName: "./reproject.wesl",
            weslSrc: {
                "reproject.wesl": s.reproject,
                "dstproj.wesl": s.projections[dst],
                "srcproj.wesl": s.projections[src],
                "common.wesl": s.common,
                "tissot.wesl": s.tissot,
                "graticule.wesl": s.graticule,
                "oblique.wesl": s.oblique,
            },
        });
        const module = linked.createShaderModule(this.device, {});
        return this.device.createRenderPipelineAsync({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module,
                entryPoint: 'vs_main',
            },
            fragment: {
                module,
                entryPoint: 'fs_main',
                targets: [{
                    format: this.canvasFormat,
                }],
            },
            primitive: {
                topology: 'triangle-strip',
            },
        });
    }

    async loadDefaultTexture(initialLoad) {
        // Load the world map image
        const response = await fetch('./world_map.jpg');
        const blob = await response.blob();
        await this.loadTextureFromBlob(blob);
        this.isDefaultTexture = true;
        if (!initialLoad) {
            this.updateBindGroup();
        }
    }

    async loadCustomTexture(blob) {
        await this.loadTextureFromBlob(blob);
        this.isDefaultTexture = false;
        this.updateBindGroup();
    }

    async loadTextureFromBlob(blob) {
        // Decode via <img> so dimensions can be validated before any GPU resources are allocated;
        // matches the pattern used in image-loader.js. HTMLImageElement is a valid source for
        // copyExternalImageToTexture, so we can skip the intermediate ImageBitmap.
        const blobUrl = URL.createObjectURL(blob);
        try {
            const img = new Image();
            img.src = blobUrl;
            await img.decode();

            if (img.naturalWidth * img.naturalHeight > MAX_IMAGE_PIXELS) {
                throw new Error(`Image too large. Maximum 4096x4096 pixels (got ${img.naturalWidth}x${img.naturalHeight}).`);
            }

            // Validation passed; safe to dispose old custom texture (do this only after we know
            // we can replace it, otherwise a failed load would leave the bindGroup with a dangling view)
            if (this.worldTexture && !this.isDefaultTexture) {
                this.worldTexture.destroy();
            }

            this.worldTexture = this.device.createTexture({
                size: [img.naturalWidth, img.naturalHeight, 1],
                format: 'rgba8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
            });

            this.device.queue.copyExternalImageToTexture(
                { source: img, flipY: false },
                { texture: this.worldTexture },
                [img.naturalWidth, img.naturalHeight]
            );
        } finally {
            URL.revokeObjectURL(blobUrl);
        }
    }

    updateBindGroup() {
        // Update the bind group with the new texture
        this.bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer }
                },
                {
                    binding: 1,
                    resource: this.worldTexture.createView()
                },
                {
                    binding: 2,
                    resource: this.sampler
                }
            ]
        });
    }
    
    render(dst, src, cameraLat, cameraLon, zoom, showTissot, showGraticule, aspectRatioMultiplier = 1.0, rotation = 0.0, panX = 0.0, panY = 0.0) {
        // Initialize hasn't finished yet (e.g. resize event fired during async startup); no-op cleanly
        if (!this.shaderSources || !this.bindGroupLayout) return;

        const entry = this.pipelineCache.get(`${dst},${src}`);

        if (entry?.kind !== 'pipeline') {
            // Not ready: missing entry, in-flight compile, or previously failed
            if (!entry) {
                this.ensurePipeline(dst, src)
                    .then(() => { if (this.onPipelineReady) this.onPipelineReady(); })
                    .catch(err => { if (this.onPipelineError) this.onPipelineError(err, dst, src); });
            }
            // For 'promise' or 'error' entries, hold the previous frame and don't retry
            return;
        }

        const pipeline = entry.value;

        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const aspect = (canvasWidth / canvasHeight) * aspectRatioMultiplier;

        const uniformData = new Float32Array([
            cameraLat,
            cameraLon,
            zoom,
            aspect,
            showTissot,
            showGraticule,
            rotation,
            panX,
            panY,
            0, 0, 0, // padding for 16-byte alignment
        ]);
        
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
        
        // Create command encoder and render pass
        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();
        
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }]
        });
        
        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.draw(4); // Draw a quad (triangle strip with 4 vertices)
        renderPass.end();
        
        this.device.queue.submit([commandEncoder.finish()]);
    }
}