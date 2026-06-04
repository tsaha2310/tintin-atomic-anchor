/* =========================================
   js/core/ComicReader.js
   Architecture: Guided View + Smart Pre-loading
   UX: "1-Second Rule" Loading Indicator
   ========================================= */

export class ComicReader {
    constructor(config) {
        this.container = document.getElementById(config.containerId);
        this.manifest = config.manifest;
        this.onGameTrigger = config.onGameTrigger;
        this.onPanelChange = config.onPanelChange;

        // State
        this.currentPageIndex = 0;
        this.currentPanelIndex = -1; 
        this.isLocked = false;
        this.isLoading = false;

        // Memory Management
        this.preloadCache = new Map(); 
        this.PRELOAD_LOOKAHEAD = 1;    
        this.PRELOAD_LOOKBEHIND = 1;   

        // Loading Indicator State
        this.loadingTimer = null;
        this.LOADING_THRESHOLD = 1000; // 1 second delay before showing spinner

        // Input State
        this.touchStartX = 0;
        this.touchStartY = 0;

        this.TRANSITION = "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.5s ease";

        this.initDOM();
        this.bindEvents();
        
        // Initial Preload
        this.manageMemory(0);
    }

    initDOM() {
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.overflow = 'hidden';
        this.container.style.backgroundColor = '#000';
        
        const shutterStyle = `
            position: absolute; 
            background-color: #000; 
            z-index: 999; 
            will-change: transform; 
            pointer-events: none;
            transition: ${this.TRANSITION};
        `;

        // LOADER CSS (Injected directly)
        const loaderStyle = `
            position: absolute;
            top: 50%; left: 50%;
            width: 40px; height: 40px;
            margin: -20px 0 0 -20px;
            border: 4px solid rgba(255,255,255,0.3);
            border-top: 4px solid #fff;
            border-radius: 50%;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            animation: comic-spin 1s linear infinite;
        `;

        // Add Keyframes for spinner
        if (!document.getElementById('comic-loader-style')) {
            const style = document.createElement('style');
            style.id = 'comic-loader-style';
            style.innerHTML = `@keyframes comic-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }

        this.container.innerHTML = `
            <img id="comic-page" src="" decoding="async" style="
                position: absolute; 
                top: 0; left: 0; 
                display: block;
                max-width: none; max-height: none; 
                transform-origin: 0 0; 
                will-change: transform, opacity;
                backface-visibility: hidden;
                transform: translate3d(0,0,0) scale(1);
            ">
            
            <div id="comic-loader" style="${loaderStyle}"></div>

            <div id="shutter-top" style="${shutterStyle} bottom: 100%; left: -50%; width: 200%; height: 10000px;"></div>
            <div id="shutter-bottom" style="${shutterStyle} top: 0; left: -50%; width: 200%; height: 10000px;"></div>
            <div id="shutter-left" style="${shutterStyle} top: -50%; right: 100%; width: 10000px; height: 200%;"></div>
            <div id="shutter-right" style="${shutterStyle} top: -50%; left: 0; width: 10000px; height: 200%;"></div>
        `;

        this.pageImage = document.getElementById('comic-page');
        this.loader = document.getElementById('comic-loader');
        
        this.shutters = {
            top: document.getElementById('shutter-top'),
            bottom: document.getElementById('shutter-bottom'),
            left: document.getElementById('shutter-left'),
            right: document.getElementById('shutter-right')
        };
        
        this.pageImage.style.transition = this.TRANSITION;
    }

    manageMemory(currentIndex) {
        const minIndex = currentIndex - this.PRELOAD_LOOKBEHIND;
        const maxIndex = currentIndex + this.PRELOAD_LOOKAHEAD;

        // GC
        for (const [index, img] of this.preloadCache) {
            if (index < minIndex || index > maxIndex) {
                img.src = ''; 
                this.preloadCache.delete(index);
            }
        }

        // Preload
        for (let i = minIndex; i <= maxIndex; i++) {
            if (i < 0 || i >= this.manifest.pages.length) continue;
            if (!this.preloadCache.has(i)) {
                const pageData = this.manifest.pages[i];
                // Support HD/SD structure if present, but fallback to single src
                const src = pageData.src_hd || pageData.src || pageData.imgSrc;
                
                const img = new Image();
                img.decoding = 'async';
                img.src = src;
                this.preloadCache.set(i, img);
                console.log(`hz Pre-loading Page ${i}`);
            }
        }
    }

    /* =========================================
       SHOW / HIDE LOADING SPINNER
       ========================================= */
    setLoadingState(active) {
        if (active) {
            // Start the "1-Second Rule" timer
            this.loadingTimer = setTimeout(() => {
                this.loader.style.opacity = 1; // Show spinner
            }, this.LOADING_THRESHOLD);
        } else {
            // Content loaded! Cancel the timer immediately.
            if (this.loadingTimer) {
                clearTimeout(this.loadingTimer);
                this.loadingTimer = null;
            }
            this.loader.style.opacity = 0; // Hide spinner
        }
    }

    loadPage(pageIndex, startPanelIndex = 0) {
        if (pageIndex < 0 || pageIndex >= this.manifest.pages.length) return;
        if (this.isLoading) return;

        this.isLoading = true; 
        this.manageMemory(pageIndex); // Preload next batch

        const pageData = this.manifest.pages[pageIndex];
        if (startPanelIndex === 0 && (!pageData.panels || pageData.panels.length === 0)) {
            startPanelIndex = -1;
        }

        console.log(`📖 Transitioning to Page ${pageIndex}`);

        // STEP 1: START FADE OUT
        this.toggleAnimations(true);
        this.pageImage.style.opacity = 0;

        // Start the Loading Timer Logic
        this.setLoadingState(true);

        setTimeout(() => {
            // STEP 2: SWAP SOURCE
            this.currentPageIndex = pageIndex;
            this.currentPanelIndex = startPanelIndex;
            this.isLocked = false;
            
            // Prefer HD source if your JSON has it, otherwise standard src
            const src = pageData.src_hd || pageData.src || pageData.imgSrc;
            
            this.toggleAnimations(false);
            
            const cachedImg = this.preloadCache.get(pageIndex);
            this.pageImage.src = cachedImg ? cachedImg.src : src;

            const onImageReady = () => {
                // Image is ready!
                this.setLoadingState(false); // Cancel spinner

                this.render();
                void this.pageImage.offsetWidth; 

                // STEP 4: FADE IN
                requestAnimationFrame(() => {
                    this.toggleAnimations(true); 
                    this.pageImage.style.opacity = 1;
                    setTimeout(() => { this.isLoading = false; }, 500);
                });
            };

            // Handle Cache vs Network
            if (this.pageImage.complete && this.pageImage.naturalWidth > 0) {
                onImageReady();
            } else {
                this.pageImage.onload = onImageReady;
                // Safety: If it fails, unlock anyway so app doesn't freeze
                this.pageImage.onerror = () => {
                    console.error("Failed to load image");
                    this.setLoadingState(false);
                    this.isLoading = false;
                };
            }

        }, 300); // 300ms Fade Out matches CSS transition
    }

    async forceView(pageIndex, panelIndex) {
        if (this.currentPageIndex !== pageIndex) {
            // If we are on a different page, load it first
            // Note: loadPage is void, but acts fast. 
            // Ideally loadPage should be async or return a promise in a robust system.
            // For now, we call it, and rely on the fact that panelIndex 
            // will be set after the image loads if we pass it to loadPage.
            
            // We modify loadPage to accept a startPanelIndex!
            this.loadPage(pageIndex, panelIndex); 
        } else {
            // Same page, just move panel
            this.currentPanelIndex = panelIndex;
            this.render();
        }
    }

    toggleAnimations(enable) {
        const val = enable ? this.TRANSITION : 'none';
        this.pageImage.style.transition = val;
        this.shutters.top.style.transition = val;
        this.shutters.bottom.style.transition = val;
        this.shutters.left.style.transition = val;
        this.shutters.right.style.transition = val;
    }

    render() {
        const page = this.manifest.pages[this.currentPageIndex];
        const panel = this.currentPanelIndex === -1 ? null : page.panels[this.currentPanelIndex];

        if (panel && panel.gameConfig && 
            panel.gameConfig.type === 'immediate' && 
            !panel.gamePlayed && 
            !this.isLocked) {
             this.isLocked = true;
             this.onGameTrigger(panel);
        }

        const vW = window.innerWidth;
        const vH = window.innerHeight;
        const imgW = this.pageImage.naturalWidth || 1024;
        const imgH = this.pageImage.naturalHeight || 1500;

        let targetX, targetY, targetScale;
        let sTop = 0, sBottom = 0, sLeft = 0, sRight = 0;

        if (!panel) {
            const scaleX = vW / imgW;
            const scaleY = vH / imgH;
            targetScale = Math.min(scaleX, scaleY);
            
            const fittedW = imgW * targetScale;
            const fittedH = imgH * targetScale;
            targetX = (vW - fittedW) / 2;
            targetY = (vH - fittedH) / 2;

            sTop = -5000; sBottom = 5000; sLeft = -5000; sRight = 5000;
        } else {
            let pxX, pxY, pxW, pxH;
            if (panel.units === 'percent') {
                pxX = (panel.x / 100) * imgW;
                pxY = (panel.y / 100) * imgH;
                pxW = (panel.width / 100) * imgW;
                pxH = (panel.height / 100) * imgH;
            } else {
                pxX = panel.x; pxY = panel.y;
                pxW = panel.width; pxH = panel.height;
            }

            const scaleX = vW / pxW;
            const scaleY = vH / pxH;
            targetScale = Math.min(scaleX, scaleY) * 0.95; 

            const screenCenterX = vW / 2;
            const screenCenterY = vH / 2;
            const panelCenterX = pxX + (pxW / 2);
            const panelCenterY = pxY + (pxH / 2);

            targetX = screenCenterX - (panelCenterX * targetScale);
            targetY = screenCenterY - (panelCenterY * targetScale);

            const screenPanelLeft = targetX + (pxX * targetScale);
            const screenPanelTop  = targetY + (pxY * targetScale);
            const screenPanelRight = screenPanelLeft + (pxW * targetScale);
            const screenPanelBottom = screenPanelTop + (pxH * targetScale);

            sTop = screenPanelTop; 
            sBottom = screenPanelBottom;
            sLeft = screenPanelLeft;
            sRight = screenPanelRight;
        }

        this.pageImage.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) scale(${targetScale})`;
        
        this.shutters.top.style.transform    = `translate3d(0, ${sTop}px, 0)`;
        this.shutters.bottom.style.transform = `translate3d(0, ${sBottom}px, 0)`;
        this.shutters.left.style.transform   = `translate3d(${sLeft}px, 0, 0)`;
        this.shutters.right.style.transform  = `translate3d(${sRight}px, 0, 0)`;

        if(this.onPanelChange) this.onPanelChange(this.currentPanelIndex, page.panels.length);
    }

    bindEvents() {
        this.container.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
        }, { passive: false });

        this.container.addEventListener('touchend', (e) => {
            if (this.isLocked || this.isLoading) return; 
            const endX = e.changedTouches[0].screenX;
            const endY = e.changedTouches[0].screenY;
            const deltaX = endX - this.touchStartX;
            const deltaY = endY - this.touchStartY;

            if (Math.abs(deltaX) > 40 && Math.abs(deltaY) < 100) {
                if (e.cancelable) e.preventDefault(); 
                if (deltaX < 0) this.next(); 
                else this.prev();          
                return;
            }
            if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
                if (e.cancelable) e.preventDefault();
                const width = window.innerWidth;
                if (this.touchStartX < width * 0.3) this.prev();
                else this.next();
            }
        }, { passive: false });

        this.container.addEventListener('pointerup', (e) => {
            if (this.isLocked || this.isLoading) return;
            if (e.pointerType === 'touch') return; 
            e.preventDefault();
            const width = window.innerWidth;
            if (e.clientX < width * 0.3) this.prev();
            else this.next();
        });

        window.addEventListener('keydown', (e) => {
            if (this.isLocked || this.isLoading) return;
            if (this.container.classList.contains('hidden')) return;
            if (e.code === "ArrowRight" || e.code === "Space") this.next();
            if (e.code === "ArrowLeft") this.prev();
        });

        window.addEventListener('resize', () => {
            this.toggleAnimations(false);
            this.render();
            clearTimeout(this.resizeTimer);
            this.resizeTimer = setTimeout(() => {
                this.toggleAnimations(true);
            }, 100);
        });
    }

    next() {
        if (this.isLoading) return;
        const page = this.manifest.pages[this.currentPageIndex];
        if (this.currentPanelIndex > -1) {
            const currentPanel = page.panels[this.currentPanelIndex];
            if (currentPanel &&
                currentPanel.gameConfig && 
                currentPanel.gameConfig.type === 'post_read' && 
                !currentPanel.gamePlayed && 
                !this.isLocked) {
                this.isLocked = true;
                this.onGameTrigger(currentPanel);
                return; 
            }
        }
        if (this.currentPanelIndex < page.panels.length - 1) {
            this.currentPanelIndex++;
            this.render();
        } else if (this.currentPageIndex < this.manifest.pages.length - 1) {
            this.loadPage(this.currentPageIndex + 1, 0);
        }
    }

    prev() {
        if (this.isLoading) return;
        if (this.currentPanelIndex > 0) {
            this.currentPanelIndex--;
            this.render();
        } else if (this.currentPageIndex > 0) {
            const prevPageIdx = this.currentPageIndex - 1;
            const prevPage = this.manifest.pages[prevPageIdx];
            const hasPanels = prevPage.panels && prevPage.panels.length > 0;
            const lastPanelIdx = hasPanels ? prevPage.panels.length - 1 : -1;
            this.loadPage(prevPageIdx, lastPanelIdx);
        } else if (this.currentPanelIndex === 0) {
            this.currentPanelIndex = -1;
            this.render();
        }
    }

    unlock() {
        const page = this.manifest.pages[this.currentPageIndex];
        if (this.currentPanelIndex > -1) {
            const panel = page.panels[this.currentPanelIndex];
            if (panel && panel.gameConfig) {
                panel.gamePlayed = true; 
            }
        }
        this.isLocked = false;
        this.next();
    }
}
