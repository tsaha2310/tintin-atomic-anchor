/* =========================================
   js/Game.js
   The "Middleware" / Base Class
   Fixed: UI Layer blocking & Input Event Routing
   ========================================= */

export class Game {
    /**
     * @param {Object} config - The configuration object passed from main.js
     * @param {HTMLCanvasElement} config.canvas - The <canvas> element
     * @param {HTMLElement} config.uiRoot - The #game-ui-layer div
     * @param {Object} config.tuning - The level parameters from levels.json
     * @param {Function} config.onComplete - Callback when game is won/lost
     */
    constructor(config) {
        this.canvas = config.canvas;
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimize for no transparency on base
        this.uiRoot = config.uiRoot;
        this.tuning = config.tuning || {}; 
        this.commonTuning = config.commonTuning || {};
        this.onComplete = config.onComplete;
        this.assetManager = config.assets;
        this.onReady = config.onReady;

        // SAFE ZONE CONSTANTS (Virtual Resolution)
        this.SAFE_WIDTH = 1024;
        this.SAFE_HEIGHT = 768;

        // State Flags
        this.isRunning = false;
        this.animationFrameId = null;
        this.lastTime = 0;
        this.dialogueCloseHandler = undefined;

        // OPTIMIZATION: Rendering Flags
        this.enableSmartRendering = false; // Default: OFF (Backwards compatible)
        this.needsRedraw = true;           // Always draw the first frame
        this.dialogueShowing = false;

        // Input State (Mouse/Touch normalized)
        this.input = {
            x: 0,
            y: 0,
            isDown: false,
            justPressed: false, // True only on the first frame of a click
            isTouch: false
        };

        // Scale & Offset (Calculated in resize)
        this.scaleFactor = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.dpr = 1; // Device Pixel Ratio

        // Bindings (so we can remove listeners later)
        this._handleResize = this.resize.bind(this);
        this._handleUp = this.onPointerUp.bind(this);

        // Auto-boot
        this.initSystem();
    }

    async preload(assetList) {
        await this.assetManager.loadBatch(assetList);
    }

    /**
     * OPTIMIZATION: Child games call this to request a screen update.
     * Only works if this.enableSmartRendering = true;
     */
    triggerRefresh() {
        this.needsRedraw = true;
    }

    /* =========================================
       SYSTEM LIFECYCLE (Don't Override)
       ========================================= */
    
    async initSystem() {
        // FIX 1: Allow clicks to pass through the UI container
        this.uiRoot.style.pointerEvents = 'none';

        // Listen on Window to catch fast drags/swipes
        window.addEventListener('mousedown', this._handleDown);
        window.addEventListener('mousemove', this._handleMove);
        window.addEventListener('mouseup', this._handleUp);
        
        // Touch support
        window.addEventListener('touchstart', this._handleDown, { passive: false });
        window.addEventListener('touchmove', this._handleMove, { passive: false });
        window.addEventListener('touchend', this._handleUp);

        window.addEventListener('keydown', this._handleKeyDown); 

        window.addEventListener('resize', this._handleResize);

        this.setupCommonUI();

        // 2. Initial Resize to set scales
        this.resize();

        // 3. 🚀 SHOW CSS/SVG LOADING SCREEN
        this.showLoadingScreen();

        // 4. ASYNC BOOT: Wait for child class to load assets
        try {
            await this.init(); 
        } catch (e) {
            console.error("Game Init Failed:", e);
        }

        // 5. Trigger ready callback (to clean up old DOM spinners if they exist)
        if (this.onReady) {
            try {
                this.onReady();
            } catch (e) {
                console.error("onReady failed:", e);
            }
        }

        // 6. Hide loading screen and Start the Game Loop 
        this.hideLoadingScreen();
        this.start();
    }

    showLoadingScreen() {
        // Prevent duplicates if rapidly switching
        if (document.getElementById('comic-loader-overlay')) return;

        const loader = document.createElement('div');
        loader.id = 'comic-loader-overlay';
        
        // Injecting the CSS and HTML directly into the DOM
        loader.innerHTML = `
            <style>
                #comic-loader-overlay {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background-color: #424852; /* Tintin Paper Cream #FDFBF7 */
                    z-index: 9999;
                    display: flex; flex-direction: column; justify-content: center; align-items: center;
                    
                    /* Comic book halftone dot pattern */
                    background-image: radial-gradient(#d5d3ce 2px, transparent 2px);
                    background-size: 24px 24px;
                }
                .comic-loader-box {
                    background-color: #FBC02D; /* Tintin Yellow */
                    border: 4px solid #1a1a1a;
                    padding: 15px 30px;
                    box-shadow: 8px 8px 0 rgba(0,0,0,0.15);
                    margin-bottom: 50px;
                    transform: rotate(-2deg); /* Quirky comic tilt */
                    animation: box-pulse 1.5s ease-in-out infinite alternate;
                }
                .comic-loader-text {
                    font-family: sans-serif; font-weight: 900; font-size: 24px;
                    color: #1a1a1a; letter-spacing: 2px; margin: 0;
                }
                .comic-loader-svg {
                    width: 140px; height: 140px;
                    /* GPU-accelerated smooth searching animation */
                    animation: search-anim 1.5s cubic-bezier(0.4, 0.0, 0.2, 1) infinite alternate;
                }
                @keyframes search-anim {
                    0% { transform: translateX(-40px) translateY(-10px) rotate(-15deg); }
                    100% { transform: translateX(40px) translateY(10px) rotate(15deg); }
                }
                @keyframes box-pulse {
                    0% { transform: rotate(-2deg) scale(1); box-shadow: 8px 8px 0 rgba(0,0,0,0.15); }
                    100% { transform: rotate(2deg) scale(1.25); box-shadow: 12px 12px 0 rgba(0,0,0,0.10); }
                }
            </style>
            
            <div class="comic-loader-box">
                <p class="comic-loader-text">PREPARING INVESTIGATION...</p>
            </div>
            
            <svg class="comic-loader-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <g transform="translate(6, 6)">
                        <circle cx="90" cy="90" r="67" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="18"/>
                        <line x1="130" y1="130" x2="180" y2="180" stroke="rgba(0,0,0,0.15)" stroke-width="32" stroke-linecap="round"/>
                    </g>
                    <line x1="130" y1="130" x2="180" y2="180" stroke="#1A1A1A" stroke-width="32" stroke-linecap="round"/>
                    <line x1="132" y1="132" x2="178" y2="178" stroke="#8D6E63" stroke-width="16" stroke-linecap="round"/>
                    <line x1="138" y1="134" x2="176" y2="172" stroke="#A1887F" stroke-width="4" stroke-linecap="round"/>
                    <circle cx="90" cy="90" r="70" fill="transparent" stroke="#1A1A1A" stroke-width="12"/>
                    <circle cx="90" cy="90" r="64" fill="none" stroke="#FBC02D" stroke-width="6"/>
                    <path d="M 45 65 A 50 50 0 0 1 85 43" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" opacity="0.9"/>
                    <circle cx="115" cy="125" r="5" fill="#FFFFFF" opacity="0.8"/>
            </svg>
        `;
        
        // Append to the parent container of the UI (#game-guest) to ensure it covers the canvas
        this.uiRoot.parentElement.appendChild(loader);
    }

    hideLoadingScreen() {
        const loader = document.getElementById('comic-loader-overlay');
        if (loader) {
            // Smooth fade out
            loader.style.transition = 'opacity 0.3s ease';
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);
        }
    }

    setupCloseButton() {
        const btnNext = this.uiRoot.querySelector('#btn-dialogue-next');
        const imgClose = this.assetManager.get('btn_close');
        
        if (btnNext && imgClose) {
            btnNext.innerHTML = ''; // Clear default text/icon
            // Clone the image so we don't move the cached instance
            btnNext.appendChild(imgClose.cloneNode(true));
            // Optional styling to ensure it fits
            btnNext.style.background = 'none'; 
            btnNext.style.border = 'none';
        }
    }

    setupCommonUI() {
        // A. Setup Close Button
        this.setupCloseButton();
    }

    /**
     * Safely clears dynamically injected game UI (like temporary buttons)
     * without destroying persistent global HUD elements.
     */
    clearDynamicUI() {
        if (!this.uiRoot) return;
        
        // List of core HTML IDs that should survive between mini-games
        const protectedIds = ['score-container', 'game-hud', 'dialogue-overlay', 'btn-skip-puzzle'];
        
        Array.from(this.uiRoot.children).forEach(child => {
            if (!protectedIds.includes(child.id)) {
                child.remove();
            }
        });
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    stop() {
        this.isRunning = false;
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        // Calculate Delta Time (seconds)
        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // 1. Clear Canvas (Only if we are about to draw)
        // We defer clearing to the Render step below.

        // 2. Update Logic (Child)
        // Always run update logic (timers, physics, etc)
        this.update(deltaTime);

        // 3. Render Frame (Conditional)
        // If Smart Rendering is OFF, we always draw.
        // If Smart Rendering is ON, we only draw if needsRedraw is true.
        if (!this.enableSmartRendering || this.needsRedraw) {
            this.renderFrame();
            if (this.enableSmartRendering) this.needsRedraw = false;
        }

        // Reset Input "Just Pressed"
        this.input.justPressed = false;

        if (this.isRunning) {
            this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
        }
    }

    renderFrame() {
        // A. Fill Black Background (Letterbox)
        this.ctx.fillStyle = "#000"; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        
        // B. Apply Safe Zone Transform
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scaleFactor, this.scaleFactor);
        
        // C. Clip to Safe Zone
        this.ctx.beginPath();
        this.ctx.rect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        this.ctx.clip();
        
        // D. Fill Game Background (Grey default)
        this.ctx.fillStyle = "#333";
        this.ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        // E. Call the Child Class Draw
        this.draw(this.ctx);
        
        this.ctx.restore();
    }

    destroy() {
        this.isRunning = false;
        cancelAnimationFrame(this.animationFrameId);

        // Cleanup Listeners
        window.removeEventListener('mousedown', this._handleDown);
        window.removeEventListener('mousemove', this._handleMove);
        window.removeEventListener('mouseup', this._handleUp);
        window.removeEventListener('touchstart', this._handleDown);
        window.removeEventListener('touchmove', this._handleMove);
        window.removeEventListener('touchend', this._handleUp);
        window.removeEventListener('resize', this._handleResize);
        window.removeEventListener('keydown', this._handleKeyDown);

        // Clear Canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Force-close any active dialogues and kill their typewriter timers
        this.dialogueCloseHandler = undefined; // Prevent callbacks from firing on a dying game
        this.hideDialogue();

        // Automatically scrub the UI layer of dynamic elements when ANY game ends
        this.clearDynamicUI();
        
        console.log("🗑️ Game System Destroyed");
    }

    /* =========================================
       MATH & INPUT (The "Safe Zone" Logic)
       ========================================= */

    resize() {
        this.determineLayout();

        if (!this.canvas || !this.uiRoot) return;

        // 1. Get Window Size (CSS Pixels)
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        // 2. Get Device Pixel Ratio (DPR)
        this.dpr = window.devicePixelRatio || 1;

        // 3. Set Canvas CSS Size (Layout)
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;

        // 4. Set Canvas Internal Size (Physical Pixels - Sharpness Fix)
        this.canvas.width = Math.floor(w * this.dpr);
        this.canvas.height = Math.floor(h * this.dpr);

        // 5. Calculate Scale Factor using Physical Pixels
        const scaleX = this.canvas.width / this.SAFE_WIDTH;
        const scaleY = this.canvas.height / this.SAFE_HEIGHT;
        this.scaleFactor = Math.min(scaleX, scaleY);

        // 6. Calculate Centering Offsets (Physical Pixels)
        const visualW = this.SAFE_WIDTH * this.scaleFactor;
        const visualH = this.SAFE_HEIGHT * this.scaleFactor;

        this.offsetX = (this.canvas.width - visualW) / 2;
        this.offsetY = (this.canvas.height - visualH) / 2;

        // 7. Match UI Layer to Visual Area (Must convert back to CSS pixels)
        const uiW = visualW / this.dpr;
        const uiH = visualH / this.dpr;
        const uiLeft = this.offsetX / this.dpr;
        const uiTop = this.offsetY / this.dpr;

        this.uiRoot.style.width = `${uiW}px`;
        this.uiRoot.style.height = `${uiH}px`;
        this.uiRoot.style.left = `${uiLeft}px`;
        this.uiRoot.style.top = `${uiTop}px`;
        
        this.triggerRefresh();
    }

    determineLayout() {
        // If no tuning data, abort
        if (!this.tuning) return;
    
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isPortrait = h > w;
        const isMobile = w < 768 || h < 500;
    
        let selectedKey = 'layout_desktop'; // Default
    
        if (isMobile) {
            selectedKey = isPortrait ? 'layout_portrait' : 'layout_landscape';
        }
    
        // Automatically map the specific layout to this.lay
        // This allows child games to just use "this.lay.buttonX" without worrying about screen size
        if (this.tuning[selectedKey]) {
            this.lay = this.layout = this.tuning[selectedKey];
            console.log(`Responsive Layout Applied: ${selectedKey}`);
            this.triggerRefresh();
        } else if (this.tuning.layout) {
            this.lay = this.layout = this.tuning.layout; // Fallback to generic
            this.triggerRefresh();
        }
    }

    /**
     * Converts screen pixel coordinates to Game Coordinates (1024x768)
     */
    getGameCoordinates(e) {
        let cx, cy;
        if (e.touches && e.touches.length > 0) {
            cx = e.touches[0].clientX;
            cy = e.touches[0].clientY;
        } else {
            cx = e.clientX;
            cy = e.clientY;
        }

        // 1. Get Canvas Offset on Page
        const rect = this.canvas.getBoundingClientRect();
        const cssX = cx - rect.left;
        const cssY = cy - rect.top;

        // 2. Convert to Physical Pixels
        const physX = cssX * this.dpr;
        const physY = cssY * this.dpr;

        // 3. Un-map Game Transforms
        return {
            x: (physX - this.offsetX) / this.scaleFactor,
            y: (physY - this.offsetY) / this.scaleFactor
        };
    }

    _handleDown = (e) => {
        // 1. Check if we hit an interactive UI element directly (like the Next button)
        // If we did, let the browser handle it natively.
        if (e.target !== this.uiRoot && e.target.closest('#game-ui-layer') && !e.target.id.includes('dialogue-overlay')) {
            // Note: We intentionally ignore the dialogue-overlay background itself
            // so we can capture taps anywhere on the screen.
            if (e.target.tagName === 'BUTTON' || 
                e.target.closest('a') || 
                e.target.closest('.verb-btn') || 
                e.target.closest('.tool-slot')||
                e.target.closest('.tool-image')||
                e.target.closest('.inv-slot')) {
                 return;
            }
        }

        // 2. GLOBAL DIALOGUE INTERCEPTION (The New Logic)
        if (this.dialogueShowing) {
            // If we are currently typing or animating the portrait, fast-forward to the end.
            if (this.isTyping || this.isPortraitAnimating) {
                const p = this.uiRoot.querySelector('#dialogue-text');
                const btnNext = this.uiRoot.querySelector('#btn-dialogue-next');
                const portrait = this.uiRoot.querySelector('#dialogue-portrait');
                
                // We need the full text, which we stored in a temporary property during setup
                const fullText = p.getAttribute('data-full-text');
                
                if (fullText) {
                    portrait.classList.remove('anim-portrait-slam');
                    this._fastForwardTypewriter(fullText, p, btnNext);
                }

                // Stop the event from reaching the game canvas logic ONLY while animating
                if (e.cancelable && e.type === 'touchstart') e.preventDefault();
                return;
            } else {
                // If it's already fully displayed, a tap anywhere closes it.
                this.hideDialogue();

                // FIX: We deliberately REMOVED the "return;" statement here.
                // This allows the input event to fall through to the canvas below, 
                // allowing a single click to both dismiss the prompt and interact with the item.
            }
        }

        // 3. DETECT INPUT TYPE
        this.input.isTouch = e.type.startsWith('touch');

        // 4. GAME CANVAS INPUT (Standard logic)
        if (e.cancelable && e.type === 'touchstart') e.preventDefault();
        
        this.input.isDown = true;
        this.input.justPressed = true;

        const coords = this.getGameCoordinates(e);
        this.input.x = coords.x;
        this.input.y = coords.y;
        
        this.onPointerDown(e);

        if (this.enableSmartRendering) this.triggerRefresh();
    }

    _handleMove = (e) => {
        // Prevent default behavior
        if (e.cancelable && e.type === 'touchmove') e.preventDefault();

        const coords = this.getGameCoordinates(e);
        this.input.x = coords.x;
        this.input.y = coords.y;
        
        // FIX 3: Call the override method
        this.onPointerMove(e);
    }

    onPointerUp(e) {
        this.input.isDown = false;
        if (this.enableSmartRendering) this.triggerRefresh();
    }

    _handleKeyDown = (e) => {
        // 1. GLOBAL DIALOGUE INTERCEPTION
        // Allow Spacebar or Enter to progress conversations
        if (this.dialogueShowing && (e.code === 'Space' || e.code === 'Enter')) {
            e.preventDefault(); // Stop the browser from scrolling down
            
            if (this.isTyping || this.isPortraitAnimating) {
                const p = this.uiRoot.querySelector('#dialogue-text');
                const btnNext = this.uiRoot.querySelector('#btn-dialogue-next');
                const portrait = this.uiRoot.querySelector('#dialogue-portrait');
                const fullText = p.getAttribute('data-full-text');
                
                if (fullText) {
                    portrait.classList.remove('anim-portrait-slam');
                    this._fastForwardTypewriter(fullText, p, btnNext);
                }
            } else {
                this.hideDialogue();
            }
            return; // Stop event from reaching the child game
        }

        // 2. PASS TO CHILD GAME
        this.onKeyDown(e);
    }

    // --- Overrideable Stubs ---
    onPointerDown(e) { /* Override in child class */ }
    onPointerMove(e) { /* Override in child class */ }
    onKeyDown(e) { /* Override in child class */ }
    
    /* =========================================
       METHODS TO OVERRIDE (The "Cartridge" API)
       ========================================= */
    
    init() { console.warn("Game.init() not implemented"); }
    update(dt) { /* Override me */ }
    draw(ctx) { /* Override me */ }

    /* =========================================
       UI HELPERS (Bridge to DOM)
       ========================================= */
    
    // Call this when the user wins
    win() {
        console.log("🏆 Level Complete!");
        if (this.onComplete) this.onComplete({ success: true });
    }

    enableHUD(labelText, meterEnabled=true) {
        const container = this.uiRoot.querySelector('#score-container');
        const label = this.uiRoot.querySelector('#hud-label');
        const meter = this.uiRoot.querySelector('#meter-fill');


        if (label) label.textContent = labelText;
        if (container) container.classList.remove('hidden');
        if (meter) {
            if (meterEnabled)
                meter.parentNode.style.display = 'block';
            else
                meter.parentNode.style.display = 'none';
        }
    }

    // Update the HTML HUD Meter
    setHUDMeter(percent) {
        const meter = this.uiRoot.querySelector('#meter-fill');
        if(meter) meter.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }

    /**
     * Triggers a short vibration on supported devices
     * @param {number} ms - Duration in milliseconds (default 15)
     */
    triggerHaptic(ms = 15) {
        if (navigator.vibrate) {
            navigator.vibrate(ms);
        }
    }

    recreateDialogueOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'dialogue-overlay';
        overlay.className = 'hidden'; 
        // FIX 4: Re-enable pointer events for the bubble specifically
        overlay.style.pointerEvents = 'auto'; 
        
        overlay.innerHTML = `
                <div class="bubble">
                    <p id="dialogue-text"></p>
                    <button id="btn-dialogue-next" class="text-btn">▼</button>
                </div>
                <div class="portrait" id="dialogue-portrait"></div>
        `;
        this.uiRoot.appendChild(overlay);
        this.setupCloseButton();
        return overlay;
    }

    /**
     * Shows the dialogue overlay with optional animation.
     * @param {string} text - The HTML text to display.
     * @param {string} character - The character ID for the portrait.
     * @param {Object} options - Animation configuration.
     * @param {Function} [options.onClose] - Callback when dialogue closes.
     * @param {Function} [options.onTypeWriterComplete] - Callback when type writer completes
     * @param {boolean} [options.animate=false] - Whether to use the Pop+Typewriter effect.
     * @param {number} [options.speed=30] - Typewriter speed in ms per character.
     */
    showDialogue(text, character = "tintin", options = {}) {
        // Defaults (Added comicTransition)
        const { animate = false, comicTransition = false, speed = 30, hideAfter=undefined,
            onClose=undefined, onTypeWriterComplete=undefined } = options;

        let overlay = this.uiRoot.querySelector('#dialogue-overlay');
        if (!overlay) {
            overlay = this.recreateDialogueOverlay();
        }

        this.dialogueShowing = true;
        this.dialogueCloseHandler = onClose;
        this.dialogueTypeWriterCompleteCloseHandler = onTypeWriterComplete;

        this._stopDialogueHideTimer();
        this.hideDialogueAfter = hideAfter;

        const p = this.uiRoot.querySelector('#dialogue-text');

        // Store the full text so the global tap handler can retrieve it for fast-forwarding
        p.setAttribute('data-full-text', text);

        const portrait = this.uiRoot.querySelector('#dialogue-portrait');
        let btnNext = this.uiRoot.querySelector('#btn-dialogue-next');
        const bubble = overlay.querySelector('.bubble'); // Grab bubble for pop effect

        overlay.classList.remove('hidden');
        
        // 1. Reset State
        this._clearTypewriter(); // Stop any previous typing
        btnNext.classList.remove('anim-bounce'); // Stop arrow bounce
        portrait.classList.remove('anim-portrait-slam'); // Reset portrait
        
        if (bubble) {
            bubble.classList.remove('anim-pop');
            bubble.style.opacity = '1'; // Default to visible
            void bubble.offsetWidth; // Force Reflow to restart animation
        }

        // 2. Prepare Content: Pull directly from the preloaded AssetManager cache
        const portraitAsset = this.assetManager.get(`portrait_${character}`);
        const portraitUrl = portraitAsset ? portraitAsset.src : `assets/ui/portrait_${character}.png`;
        
        portrait.style.backgroundImage = `url('${portraitUrl}')`;
        portrait.style.backgroundColor = 'transparent';

        // 3. Define Closure Logic
        const closeHandler = (e) => {
            if(e && e.stopPropagation) e.stopPropagation();
            
            // Interaction Rule: If typing OR portrait animating, CLICK = FAST FORWARD. 
            if (this.isTyping || this.isPortraitAnimating) {
                // Snap portrait to end state
                portrait.classList.remove('anim-portrait-slam');
                this._fastForwardTypewriter(text, p, btnNext);
                return;
            }

            overlay.classList.add('hidden');
            this.dialogueShowing = false;
            this.dialogueCloseHandler = undefined;
            if (onClose) onClose();
            if (this.enableSmartRendering) this.triggerRefresh();
        };

        // Bind Button (Remove old listeners)
        const newBtn = btnNext.cloneNode(true);
        btnNext.parentNode.replaceChild(newBtn, btnNext);
        newBtn.addEventListener('click', closeHandler);
        btnNext = newBtn;

        // Remove native onclick to prevent double-firing.
        // The global _handleDown method already handles background taps safely.
        overlay.forceClose = closeHandler;
        overlay.onclick = null;

        // 4. Render (Instant vs Animated)
        if (!animate) {
            // LEGACY BEHAVIOR: Instant
            p.innerHTML = text;
            btnNext.style.display = ''; // Ensure button is visible
            this._startDialogueHideTimer();
        } else {
            // ANIMATED BEHAVIOR
            
            // Helper function to start the bubble/text sequence
            const startBubbleAnim = () => {
                this.isPortraitAnimating = false;
                if (bubble) {
                    bubble.style.opacity = '1';
                    bubble.classList.add('anim-pop');
                }
                btnNext.style.display = 'none';
     
                const typeWriterCompletion = () => {
                    btnNext.style.display = '';
                    btnNext.classList.add('anim-bounce');
                    this.dialogueTypeWriterCompleteCloseHandler = undefined;
                    if (onTypeWriterComplete) onTypeWriterComplete();
                    this._startDialogueHideTimer();
                    if (this.enableSmartRendering) this.triggerRefresh();
                };

                if (options.disableTypewriter) {
                    p.innerHTML = text;
                    typeWriterCompletion();
                } else {
                    this._runTypewriter(text, p, speed, typeWriterCompletion);
                }
            };

            // If comic transition is requested, sequence it
            if (comicTransition) {
                this.isPortraitAnimating = true;
                if (bubble) bubble.style.opacity = '0'; // Hide bubble initially
                portrait.classList.add('anim-portrait-slam');
                
                // Wait for the CSS animation to nearly finish before popping the bubble
                this.introDelayTimer = setTimeout(() => {
                    startBubbleAnim();
                }, 800);
            } else {
                startBubbleAnim();
            }
        }

        if (this.enableSmartRendering) this.triggerRefresh();
    }

    hideDialogue() {
        this._stopDialogueHideTimer();
        this._clearTypewriter(); // Stop sound/updates if force hidden
        const overlay = this.uiRoot.querySelector('#dialogue-overlay');
        if (overlay) overlay.classList.add('hidden');
        this.dialogueShowing = false;
        if (this.dialogueCloseHandler != undefined) {
            const onClose = this.dialogueCloseHandler;
            this.dialogueCloseHandler = undefined;
            onClose();
        }
        if (this.enableSmartRendering) this.triggerRefresh();
    }

    /* =========================================
       INTERNAL ANIMATION HELPERS
       ========================================= */

    _clearTypewriter() {
        if (this.typewriterTimer) {
            clearTimeout(this.typewriterTimer);
            this.typewriterTimer = null;
        }
        // NEW: Clear portrait delay timer if it exists
        if (this.introDelayTimer) {
            clearTimeout(this.introDelayTimer);
            this.introDelayTimer = null;
        }
        this.isTyping = false;
        this.isPortraitAnimating = false;
    }

    _fastForwardTypewriter(fullText, element, btnNext) {
        this._clearTypewriter();
        element.innerHTML = fullText;
        btnNext.style.display = '';
        btnNext.classList.add('anim-bounce');
        
        // NEW: Force bubble to be visible in case we skipped during the portrait slam
        const bubble = this.uiRoot.querySelector('.bubble');
        if (bubble) {
            bubble.style.opacity = '1';
        }
        
        const onTypeWriterComplete = this.dialogueTypeWriterCompleteCloseHandler;
        this.dialogueTypeWriterCompleteCloseHandler = undefined;
        if (onTypeWriterComplete) onTypeWriterComplete();
        this._startDialogueHideTimer();
        if (this.enableSmartRendering) this.triggerRefresh();
    }

    _stopDialogueHideTimer() {
        if (this.dialogueHideTimer !== undefined) {
            clearTimeout( this.dialogueHideTimer );
            this.dialogueHideTimer = undefined;
        }
        this.hideDialogueAfter = undefined;
    }

    _startDialogueHideTimer() {
        if (this.hideDialogueAfter === undefined) return;
        this.dialogueHideTimer = setTimeout( () => { this.hideDialogue(); }, this.hideDialogueAfter );
    }

    _runTypewriter(htmlText, element, speed, onComplete) {
        this.isTyping = true;
        element.innerHTML = "";
        
        // 1. Tokenize HTML (Split tags from text)
        const tokens = htmlText.split(/(<[^>]*>)/g);
        
        let tokenIndex = 0;
        let charIndex = 0;
        let currentHTML = ""; // <--- FIX: Use a local buffer to track state

        const typeStep = () => {
            // Safety: Stop if interrupted by fast-forward or close
            if (!this.isTyping) return;

            if (tokenIndex >= tokens.length) {
                this.isTyping = false;
                if (onComplete) onComplete();
                return;
            }

            const currentToken = tokens[tokenIndex];

            // If empty string (artifact of split), skip
            if (currentToken === "") {
                tokenIndex++;
                typeStep();
                return;
            }

            // If HTML Tag, append instantly to buffer and move to next
            // We do NOT pause for tags
            if (currentToken.startsWith('<')) {
                currentHTML += currentToken;
                element.innerHTML = currentHTML; // Update DOM
                tokenIndex++;
                typeStep(); 
                return;
            }

            // If Text, append one char to buffer
            currentHTML += currentToken[charIndex];
            element.innerHTML = currentHTML; // Update DOM
            
            charIndex++;

            // Causing performance issues on old/constrained mobile devices
            //if (this.enableSmartRendering) this.triggerRefresh();

            // Check if we finished the current text token
            if (charIndex >= currentToken.length) {
                tokenIndex++;
                charIndex = 0;
            }

            // Schedule next char
            this.typewriterTimer = setTimeout(typeStep, speed);
        };

        typeStep();
    }

    showGameRestartButtonInDialogueBubble(resetCb) {
        // 1. Hide the default small "Next" button/arrow
        // We don't want the user to click the tiny arrow to "continue" to a broken state.
        const btnNext = this.uiRoot.querySelector('#btn-dialogue-next');
        if (btnNext) btnNext.style.display = 'none';

        // 2. Find the container to inject our BIG button
        // We look for .dialogue-box (created by PacAdventure/Middleware)
        const dialogBox = this.uiRoot.querySelector('.dialogue-box') || this.uiRoot.querySelector('.bubble');
        
        if (dialogBox) {
            // Clean up any old buttons first
            const oldBtn = dialogBox.querySelector('.btn-restart-game');
            if (oldBtn) oldBtn.remove();

            // Create New Button
            const restartBtn = document.createElement('button');
            restartBtn.className = 'btn-restart-game';
            restartBtn.innerHTML = "↻ TRY AGAIN";
            
            // Apply prominent styling
            Object.assign(restartBtn.style, {
                display: "block",
                margin: "15px auto 5px auto", // Centered, bit of space from text
                padding: "12px 24px",
                fontSize: "18px",
                fontWeight: "bold",
                backgroundColor: "#D32F2F", // Tintin Red
                color: "white",
                border: "2px solid #fff",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                pointerEvents: "auto"
            });

            // Hover effect (optional, simple JS way)
            restartBtn.onmouseover = () => restartBtn.style.backgroundColor = "#B71C1C";
            restartBtn.onmouseout = () => restartBtn.style.backgroundColor = "#D32F2F";

            // Restart Logic
            restartBtn.onclick = (e) => {
                e.stopPropagation(); // Stop bubbling
                
                // Cleanup: Restore the default button state for next time
                if (btnNext) btnNext.style.display = ''; 
                restartBtn.remove(); 
                
                this.hideDialogue();
                if (resetCb) resetCb();
            };

            dialogBox.appendChild(restartBtn);
        }

        // 2. Lock Overlay Background
        // Prevent clicking the dark background to close the dialogue
        const overlay = this.uiRoot.querySelector('#dialogue-overlay');
        if (overlay) overlay.onclick = null; 
        this.triggerRefresh();
    }

}
