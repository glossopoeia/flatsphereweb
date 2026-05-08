import Alpine from 'https://cdn.jsdelivr.net/npm/@alpinejs/csp@3/dist/module.esm.js';
import { SecurityManager } from './security.js';
import { projections } from './projections.js';

// Alpine x-data component factory. Wires DOM event handlers and Alpine effects that bridge
// the store to the sidebar UI. Registered in main.js via Alpine.data('app', createAppComponent).
export function createAppComponent() {
    return {
        init() {
            const store = Alpine.store('app');
            const optionsHtml = projections.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            this.$refs.dstProjection.innerHTML = optionsHtml;
            this.$refs.srcProjection.innerHTML = optionsHtml;

            // Start with sidebar collapsed on mobile portrait
            if (window.matchMedia('(max-width: 768px)').matches) {
                this.$refs.sidebar.classList.add('collapsed');
            }

            // Sync fullscreen state when changed externally (e.g. Escape key)
            document.addEventListener('fullscreenchange', () => this.syncFullscreenState());

            // Sync loading state to button and backdrop
            Alpine.effect(() => {
                const isLoading = store.isLoading;
                const btn = this.$refs.loadImageButton;
                btn.value = isLoading ? 'Loading...' : 'Load';
                btn.disabled = isLoading;
                const backdrop = document.getElementById('loadingBackdrop');
                if (isLoading) {
                    backdrop.classList.add('open');
                } else {
                    backdrop.classList.remove('open');
                }
            });

            // Sync zoom and aspect ratio sliders/labels (zoom can change via canvas wheel/pinch too)
            Alpine.effect(() => {
                this.$refs.zoomSlider.value = store.zoomSlider;
                this.$refs.zoomLabel.textContent = `${store.zoom.toFixed(2)}x`;
                this.$refs.aspectRatioSlider.value = store.aspectRatio;
                this.$refs.aspectRatioLabel.textContent = `${store.aspectRatio.toFixed(2)}x`;
            });

            // Sync projection sliders when changed by canvas interaction
            Alpine.effect(() => {
                this.$refs.rotationSlider.value = store.rotation;
                this.$refs.rotationLabel.textContent = `${store.rotation.toFixed(0)}°`;
                this.$refs.obliqueLatSlider.value = store.obliqueLat;
                this.$refs.obliqueLatLabel.textContent = `${store.obliqueLat.toFixed(0)}°`;
                this.$refs.obliqueLonSlider.value = store.obliqueLon;
                this.$refs.obliqueLonLabel.textContent = `${store.obliqueLon.toFixed(0)}°`;
            });

            // Sync pan inputs when changed by drag interaction
            Alpine.effect(() => {
                this.$refs.panXInput.value = store.panX.toFixed(2);
                this.$refs.panYInput.value = store.panY.toFixed(2);
            });

            // Sync notification dialog with store state
            Alpine.effect(() => {
                const n = store.notification;
                const dialog = this.$refs.notificationDialog;
                this.$refs.notificationTitle.textContent = n.title;
                this.$refs.notificationMessage.textContent = n.message;
                if (n.visible && !dialog.open) {
                    dialog.showModal();
                } else if (!n.visible && dialog.open) {
                    dialog.close();
                }
            });

            // Sync projection info dialog with store state
            Alpine.effect(() => {
                const info = store.projectionInfo;
                const dialog = this.$refs.projectionInfoDialog;
                if (info.visible && !dialog.open) {
                    this.renderProjectionInfoContent();
                    dialog.showModal();
                } else if (!info.visible && dialog.open) {
                    dialog.close();
                }
            });

        },

        onComingSoon() {
            Alpine.store('app').showNotification('Feature Coming Soon', 'success', false, 3000);
        },

        onProjectionInfo() {
            Alpine.store('app').showProjectionInfo();
        },

        onProjectionInfoClose() {
            Alpine.store('app').hideProjectionInfo();
        },

        onProjectionInfoBackdropClick(event) {
            if (event.target === this.$refs.projectionInfoDialog) {
                Alpine.store('app').hideProjectionInfo();
            }
        },

        renderProjectionInfoContent() {
            const store = Alpine.store('app');
            const p = projections.find(proj => proj.id === store.destinationProjection);
            if (!p) return;

            this.$refs.projInfoTitle.textContent = `${p.emoji} ${p.name}`;
            this.$refs.projInfoCreators.textContent = p.creators.join(', ');
            this.$refs.projInfoOriginated.textContent = p.originated;
            this.$refs.projInfoSummary.textContent = p.summary;

            const allProps = ['Conformal', 'Equal-Area', 'Azimuthal', 'Equidistant', 'Gnomonic'];
            const container = this.$refs.projInfoProperties;
            container.innerHTML = allProps.map(prop => {
                const active = p.properties.includes(prop);
                const cls = active ? 'prop-pill prop-active' : 'prop-pill prop-inactive';
                return `<span class="${cls}">${prop}</span>`;
            }).join('');

            const resList = this.$refs.projInfoResources;
            resList.innerHTML = p.resources.map(r =>
                `<li><a href="${r.url}" target="_blank" rel="noopener">${r.title}</a></li>`
            ).join('');
        },

        onActiveToolChange(tool) {
            Alpine.store('app').activeTool = tool;
        },

        onSidebarToggle() {
            this.$refs.sidebar.classList.toggle('collapsed');
        },

        onSidebarSideToggle() {
            this.$refs.sidebar.classList.toggle('right');
        },

        onDestinationChange() {
            const id = parseInt(this.$refs.dstProjection.value, 10);
            Alpine.store('app').destinationProjection = id;
        },

        onSourceChange() {
            Alpine.store('app').sourceProjection = parseInt(this.$refs.srcProjection.value, 10);
        },

        onTissotChange() {
            Alpine.store('app').tissot = this.$refs.tissotToggle.checked;
        },

        onGraticuleChange() {
            Alpine.store('app').graticule = this.$refs.graticuleToggle.checked;
        },

        onFullscreenToggle() {
            this.toggleFullscreen();
        },

        async toggleFullscreen() {
            const store = Alpine.store('app');
            try {
                if (!store.fullscreen) {
                    await document.documentElement.requestFullscreen();
                } else {
                    await document.exitFullscreen();
                }
            } catch (error) {
                console.warn('Fullscreen operation failed:', error);
            } finally {
                this.syncFullscreenState();
            }
        },

        syncFullscreenState() {
            const isFs = !!document.fullscreenElement;
            Alpine.store('app').fullscreen = isFs;
            this.$refs.fullscreenToggle.checked = isFs;
        },

        onAspectRatioInput() {
            Alpine.store('app').aspectRatio = parseFloat(this.$refs.aspectRatioSlider.value);
        },

        onZoomSliderInput() {
            Alpine.store('app').setZoomFromSlider(parseFloat(this.$refs.zoomSlider.value));
        },

        onRotationInput() {
            Alpine.store('app').setRotation(parseFloat(this.$refs.rotationSlider.value));
        },

        onObliqueLatInput() {
            Alpine.store('app').setObliqueLat(parseFloat(this.$refs.obliqueLatSlider.value));
        },

        onObliqueLonInput() {
            Alpine.store('app').setObliqueLon(parseFloat(this.$refs.obliqueLonSlider.value));
        },

        onPanXInput() {
            const val = parseFloat(this.$refs.panXInput.value);
            if (!isNaN(val)) {
                Alpine.store('app').panX = val;
            }
        },

        onPanYInput() {
            const val = parseFloat(this.$refs.panYInput.value);
            if (!isNaN(val)) {
                Alpine.store('app').panY = val;
            }
        },

        onLoadImage() {
            this.dispatchImageLoad();
        },

        onImageUrlKeyup(event) {
            if (event.key === 'Enter') {
                this.dispatchImageLoad();
            }
        },

        onImageUrlInput() {
            const store = Alpine.store('app');
            const currentValue = this.$refs.imageUrl.value.trim();
            if (store.currentFile && currentValue !== store.currentFile.name) {
                store.currentFile = null;
                this.$refs.fileInput.value = '';
            }
        },

        onFileInputChange() {
            const files = this.$refs.fileInput.files;
            if (files.length > 0) {
                const file = files[0];
                if (!SecurityManager.validateImageFile(file)) {
                    Alpine.store('app').showError('Invalid file. Please select a valid image file (JPEG, PNG, GIF, WebP, BMP) under 50MB.');
                    return;
                }
                const store = Alpine.store('app');
                store.currentFile = file;
                this.$refs.imageUrl.value = file.name;
                store.app.loadUserFile(file);
            }
        },

        dispatchImageLoad() {
            const store = Alpine.store('app');
            const imageUrl = this.$refs.imageUrl.value.trim();

            if (store.currentFile && imageUrl === store.currentFile.name) {
                store.app.loadUserFile(store.currentFile);
            } else {
                store.app.loadUserImage(imageUrl);
            }
        },

        onNotificationClose() {
            Alpine.store('app').hideNotification();
        },

        onDialogBackdropClick(event) {
            if (event.target === this.$refs.notificationDialog) {
                Alpine.store('app').hideNotification();
            }
        },
    };
}
