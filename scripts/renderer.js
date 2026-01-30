import { link } from "https://cdn.jsdelivr.net/npm/wesl/+esm";

export class ProjectionRenderer {
    constructor() {
        this.device = null;
        this.context = null;
        this.pipeline = null;
        this.uniformBuffer = null;
        this.bindGroup = null;
        this.canvas = null;
        this.worldTexture = null;
        this.sampler = null;
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

        // Get texture shader
        const textureShaderCode = await link({
            rootModuleName: "./texture.wesl",
            weslSrc: {
                "texture.wesl": await fetch("./shaders/texture.wesl").then(v => v.text()),
                "tissot.wesl": await fetch("./shaders/tissot.wesl").then(v => v.text()),
                "graticule.wesl": await fetch("./shaders/graticule.wesl").then(v => v.text()),
            },
        });

        const textureShaderMod = textureShaderCode.createShaderModule(this.device, {});
        
        // Get canvas context
        this.context = canvas.getContext('webgpu');
        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        
        this.context.configure({
            device: this.device,
            format: canvasFormat,
        });
        
        // Create uniform buffer (now 36 bytes for 9 floats)
        this.uniformBuffer = this.device.createBuffer({
            size: 36, // 9 floats * 4 bytes each = 36 bytes
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        // Load world map texture
        await this.loadDefaultTexture();
        
        // Create sampler
        this.sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'clamp-to-edge',
        });
        
        // Create pipeline
        this.createPipeline(canvasFormat, textureShaderMod);
    }
    
    createPipeline(canvasFormat, textureShaderModule) {
        // Texture shader pipeline
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
        
        this.bindGroupLayout = bindGroupLayout; // Store for later use
        
        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
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
        
        this.pipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [bindGroupLayout]
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

    async loadDefaultTexture() {
        // Load the world map image
        const response = await fetch('./world_map.jpg');
        const blob = await response.blob();
        await this.loadTextureFromBlob(blob);
    }

    async loadCustomTexture(blob) {
        console.log('Loading custom texture from blob, size:', blob.size);
        await this.loadTextureFromBlob(blob);
        this.updateBindGroup();
        console.log('Custom texture loaded and bind group updated');
    }

    async loadTextureFromBlob(blob) {
        // Dispose of previous texture to prevent memory leaks
        if (this.worldTexture && this.worldTexture !== this.defaultTexture) {
            this.worldTexture.destroy();
        }
        
        const bitmap = await createImageBitmap(blob);
        console.log('Created image bitmap, dimensions:', bitmap.width, 'x', bitmap.height);
        
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
        console.log('Texture created and image data copied');
    }

    setSourceProjection(projectionType) {
        console.log('Setting source projection to:', projectionType);
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
    
    render(projectionType, cameraLat, cameraLon, zoom, showTissot, showGraticule) {
        // Update uniforms
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const aspect = canvasWidth / canvasHeight;
        
        const uniformData = new Float32Array([
            projectionType,
            cameraLat,
            cameraLon,
            zoom,
            aspect,
            showTissot,
            showGraticule,
            this.sourceProjection,
            0 // padding for alignment
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
        
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.draw(4); // Draw a quad (triangle strip with 4 vertices)
        renderPass.end();
        
        this.device.queue.submit([commandEncoder.finish()]);
    }
}