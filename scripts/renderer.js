import { link } from "https://cdn.jsdelivr.net/npm/wesl/+esm";
import { projections } from "./projections.js";

export class ProjectionRenderer {
    constructor() {
        this.device = null;
        this.context = null;
        this.pipelines = null; // A 2D map of pipelines, indexed by [dstProj][srcProj]
        this.uniformBuffer = null;
        this.bindGroup = null;
        this.canvas = null;
        this.worldTexture = null;
        this.sampler = null;
        this.destinationProjection = 0; // Default: equirectangular
        this.sourceProjection = 0; // Default: equirectangular
    }
    
    async initialize(canvas) {
        this.canvas = canvas;
        
        // Get WebGPU adapter and device
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('No appropriate GPUAdapter found.');
        }
        
        this.device = await adapter.requestDevice();

        // Get projection shaders
        const commonSource = await fetch("./shaders/common.wesl").then(v => v.text());
        const tissotSource = await fetch("./shaders/tissot.wesl").then(v => v.text());
        const graticuleSource = await fetch("./shaders/graticule.wesl").then(v => v.text());
        const obliqueSource = await fetch("./shaders/oblique.wesl").then(v => v.text());
        const reprojectSource = await fetch("./shaders/reproject.wesl").then(v => v.text());

        const projectionPromises = projections
            .map(projObj => projObj.shader)
            .map(projShader => fetch(`./shaders/${projShader}.wesl`).then(v => v.text()));
        const projectionSources = await Promise.all(projectionPromises);

        const shaderPromises = projectionSources.map(async (dstProjSource) => {
            const withSrcPromise = projectionSources.map(async (srcProjSource) => {
                return await link({
                    rootModuleName: "./reproject.wesl",
                    weslSrc: {
                        "reproject.wesl": reprojectSource,
                        "dstproj.wesl": dstProjSource,
                        "srcproj.wesl": srcProjSource,
                        "common.wesl": commonSource,
                        "tissot.wesl": tissotSource,
                        "graticule.wesl": graticuleSource,
                        "oblique.wesl": obliqueSource,
                    },
                });
            });
            return await Promise.all(withSrcPromise);
        });
        const shaderCodes = await Promise.all(shaderPromises);
        const shaderModules = shaderCodes.map(nested => {
            return nested.map(code => code.createShaderModule(this.device, {}));
        });
        
        // Get canvas context
        this.context = canvas.getContext('webgpu');
        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        
        this.context.configure({
            device: this.device,
            format: canvasFormat,
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

        // One shared bind group layout
        const bindGroupLayout = this.device.createBindGroupLayout({
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
        this.bindGroupLayout = bindGroupLayout;
        this.updateBindGroup(); // One shared bind group
        
        // Create one pipeline per projection
        this.pipelines = shaderModules.map(nested => {
            return nested.map(mod => this.createPipeline(canvasFormat, mod));
        });
    }
    
    createPipeline(canvasFormat, textureShaderModule) { 
        return this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: textureShaderModule,
                entryPoint: 'vs_main',
            },
            fragment: {
                module: textureShaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: canvasFormat,
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
        // Dispose of previous custom texture to prevent memory leaks
        if (this.worldTexture && !this.isDefaultTexture) {
            this.worldTexture.destroy();
        }
        
        const bitmap = await createImageBitmap(blob);
        
        // Validate image size for performance and memory safety
        const maxSize = 4096 * 4096; // 16MP limit
        if (bitmap.width * bitmap.height > maxSize) {
            bitmap.close(); // Clean up bitmap
            throw new Error('Image too large. Maximum size: 4096x4096 pixels.');
        }
        
        // Create texture
        this.worldTexture = this.device.createTexture({
            size: [bitmap.width, bitmap.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        
        // Copy image data to texture
        this.device.queue.copyExternalImageToTexture(
            { source: bitmap, flipY: false },
            { texture: this.worldTexture },
            [bitmap.width, bitmap.height]
        );
        
        bitmap.close(); // Clean up bitmap
    }

    setDestinationProjection(projectionType) {
        this.destinationProjection = projectionType;
    }

    setSourceProjection(projectionType) {
        this.sourceProjection = projectionType;
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
    
    render(cameraLat, cameraLon, zoom, showTissot, showGraticule, aspectRatioMultiplier = 1.0, rotation = 0.0, panX = 0.0, panY = 0.0) {
        // Update uniforms
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
        
        renderPass.setPipeline(this.pipelines[this.destinationProjection][this.sourceProjection]);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.draw(4); // Draw a quad (triangle strip with 4 vertices)
        renderPass.end();
        
        this.device.queue.submit([commandEncoder.finish()]);
    }
}