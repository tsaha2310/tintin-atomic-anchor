/* =========================================
   js/games/ThompsonHoleInvestigation.js
   Game 04: "The Pressure Point"
   Theme: Pressure = Force / Area (Macroscopic)
   Mechanic: Drag & Drop Physics Demonstration + Quiz
   ========================================= */

import { Game } from '../Game.js';
import { QuizOverlay } from '../components/QuizOverlay.js';

export class ThompsonHoleInvestigation extends Game {

    constructor(config) {
        super(config);
        
        this.state = 'INTRO'; 
        
        // Default values; will be immediately overwritten by determineLayout()
        this.canvasZone = { x: 563, y: 450, w: 250, h: 50, ripped: false };
        
        this.items = [
            { id: 'BOARD', label: 'Flat Board', x: 200, y: 200, w: 160, h: 40, mass: 50, area: 720, color: '#8D6E63', isDragging: false, startX: 200, startY: 200, vy: 0 },
            { id: 'BALL', label: 'Iron Ball', x: 512, y: 200, w: 80, h: 80, mass: 50, area: 160, color: '#78909C', isDragging: false, startX: 512, startY: 200, vy: 0 },
            { id: 'ROCK', label: 'Zlatanium', x: 824, y: 200, w: 60, h: 100, mass: 50, area: 15, color: '#546E7A', isDragging: false, startX: 824, startY: 200, sharp: true, vy: 0 }
        ];

        this.activeItem = null;
        this.particles = []; // Restored particles array
    }

    async init() {
        this.enableSmartRendering = true;
        this.quizUI = new QuizOverlay(this.uiRoot, this.assetManager);

        await this.preload([
            'g04_bg_pantry', 'g04_item_board', 'g04_item_ball', 'g04_item_rock',
            'g04_bag_front', 'g04_bag_back', 'g04_bag_ripped_left', 'g04_bag_ripped_right',
            'g04_ui_gauge', 'ui_police_notebook' // Newly preloaded assets
        ]);

        this.injectCSS();
        this.createUI();
        this.determineLayout(); // Force layout update after items are initialized
        this.triggerRefresh();
        this.startIntro();
    }

    destroy() {
        if (this.styleElement) this.styleElement.remove();
        if (this.quizUI) this.quizUI.remove();

        // Clear Previous UI Safely
        this.clearDynamicUI();

        super.destroy();
    }

    // ============================================================
    // 📏 RESPONSIVE LAYOUT OVERRIDE
    // ============================================================
 
    determineLayout() {
        super.determineLayout(); // Call base layout resolution first
        
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isPortrait = h > w;
        const isMobile = w < 768 || h < 500;

        // Preserve ripped state across orientation changes
        const isRipped = this.canvasZone ? this.canvasZone.ripped : false;

        // Base values for Desktop (matches 1024x768 safe zone)
        // CSS left is 55% -> 1024 * 0.55 = ~563
        let dropX = 563; 
        let dropY = 450;
        let dropW = 250;

        // Adjust Canvas Drop Zone based on CSS media queries
        if (isMobile && isPortrait) {
            dropY = 480;
            dropW = 150;
        } else if (isMobile && !isPortrait) {
            dropY = 550; // Lower down for mobile landscape
            dropW = 150;
        }

        this.canvasZone = { x: dropX, y: dropY, w: dropW, h: 50, ripped: isRipped, textX: 0, textY: 0 };
        
        // Adjust starting positions of items so they don't overlap the bag
        if (this.items && this.items.length === 3) {
            if (isMobile && isPortrait) {
                this.items[0].startX = 200; this.items[0].startY = 150;
                this.items[1].startX = 512; this.items[1].startY = 150;
                this.items[2].startX = 824; this.items[2].startY = 150;
            } else if (isMobile && !isPortrait) {
                this.items[0].startX = 250; this.items[0].startY = 150;
                this.items[1].startX = 512; this.items[1].startY = 150;
                this.items[2].startX = 750; this.items[2].startY = 150;
            } else {
                // Desktop
                this.items[0].startX = 200; this.items[0].startY = 200;
                this.items[1].startX = 512; this.items[1].startY = 200;
                this.items[2].startX = 824; this.items[2].startY = 200;
            }
            
            // Snap items back to start if they aren't currently being dragged or falling
            this.items.forEach(item => {
                if (!item.isDragging && !item.vy && this.state !== 'GAME_ACTIVE') {
                    item.x = item.startX;
                    item.y = item.startY;
                }
            });
        }

        this.fixLayout();
    }

    // --- DYNAMIC UI ALIGNMENT ---
    fixLayout() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isPortrait = h > w;
        const isMobile = w < 768 || h < 500;
        
        // 1. In style.css, Mobile Portrait forces #game-ui-layer to 100vh.
        // On all other layouts, Game.js shrinks #game-ui-layer to perfectly match the safe zone.
        const isFullScreenUI = isMobile && isPortrait;
        
        // 2. this.offsetY is the exact physical pixel height of the black letterbox.
        // We divide by Device Pixel Ratio (dpr) to convert it to standard CSS pixels.
        const letterboxHeightCSS = this.offsetY / this.dpr;
        
        // 3. If the UI is stretched over the letterboxes, we must push elements UP by the letterbox height.
        // If the UI is already fitted to the safe zone, the base bottom is 0.
        const baseBottom = isFullScreenUI ? letterboxHeightCSS : 0;
        
        // 4. Align the Bag
        const bagWrapper = this.uiRoot.querySelector('#css-bag-wrapper');
        if (bagWrapper) {
            const bagPadding = isMobile ? 5 : 35; // Tighter fit for mobile
            bagWrapper.style.bottom = `${baseBottom + bagPadding}px`;
        }

        if (this.canvasZone && this.uiRoot) {
            this.canvasZone.textX = this.uiRoot.offsetWidth / 2;
            this.canvasZone.textY = this.uiRoot.offsetHeight / 2;
        }
    }

    // ============================================================
    // 🎨 UI & CSS INJECTION
    // ============================================================

    injectCSS() {
        if (this.styleElement) this.styleElement.remove();
        this.styleElement = document.createElement('style');
        this.styleElement.innerHTML = `
            /* --- CSS BAG --- */
            #css-bag-wrapper {
                position: absolute; 
                left: 55%; 
                width: 400px; height: 400px;
                transform: translateX(-50%); pointer-events: none; z-index: 50;
            }
            .bag-part {
                position: absolute; bottom: 0; width: 100%; height: 100%;
                background-size: contain; background-repeat: no-repeat; background-position: bottom center;
                transform-origin: top center; 
                transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.2s;
            }
            .bag-stretch { transform: scaleY(1.3); }
            @keyframes bag-rip-l { 0% { transform: rotate(0deg); } 100% { transform: rotate(-25deg) translateX(-30px); opacity: 0; } }
            @keyframes bag-rip-r { 0% { transform: rotate(0deg); } 100% { transform: rotate(25deg) translateX(30px); opacity: 0; } }
            .rip-anim-left { animation: bag-rip-l 0.6s forwards; }
            .rip-anim-right { animation: bag-rip-r 0.6s forwards; }
            .hidden { display: none !important; }

            /* --- CIRCULAR PRESSURE GAUGE --- */
            #pressure-gauge-wrapper {
                position: absolute; bottom: 20px; left: 40px;
                width: 150px; height: 180px; 
                pointer-events: none; z-index: 50;
                background-size: contain; background-repeat: no-repeat; background-position: center;
                filter: drop-shadow(0 10px 10px rgba(0,0,0,0.5));
            }
            #pressure-gauge-needle {
                position: absolute; top: 48%; left: 50%; /* Center pivot point */
                width: 4px; height: 50px;
                background: #111;
                transform-origin: bottom center;
                /* Start pointing left (-65 deg) towards green */
                transform: translate(-50%, -100%) rotate(-65deg); 
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                border-radius: 4px;
            }
            /* Add the small center pin to the needle */
            #pressure-gauge-needle::after {
                content: ''; position: absolute; bottom: -6px; left: -4px;
                width: 12px; height: 12px; background: #333; border-radius: 50%;
            }
            .gauge-shake { animation: shake 0.1s infinite; }
            @keyframes shake { 0% { transform: translateX(-2px); } 50% { transform: translateX(2px); } 100% { transform: translateX(-2px); } }

            /* --- COMIC ACTION WORDS --- */
            .comic-action-word {
                position: absolute; z-index: 1000; font-family: "Comic Sans MS", fantasy, sans-serif;
                font-weight: bold; font-size: 64px; color: #FFEB3B; text-transform: uppercase;
                text-shadow: 4px 4px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000;
                pointer-events: none; opacity: 0; transform: translate(-50%, -50%) scale(0.1) rotate(-10deg);
                animation: comicPop 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            @keyframes comicPop {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.1) rotate(-15deg); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2) rotate(5deg); }
                80% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
                100% { opacity: 0; transform: translate(-50%, -60%) scale(0.9); }
            }
            
            /* MOBILE PORTRAIT OVERRIDE */
            @media (max-width: 768px) and (orientation: portrait) {
                #css-bag-wrapper { width: 200px; height: 200px; }
                #pressure-gauge-wrapper { width: 75px; height: 90px; }
                #pressure-gauge-needle { height: 25px; }
                .comic-action-word { font-size: 32px; }
            }
            /* MOBILE LANDSCAPE OVERRIDE */
            @media (max-height: 500px) and (orientation: landscape) {
                #css-bag-wrapper { width: 200px; height: 200px; }
                #pressure-gauge-wrapper { width: 75px; height: 90px; }
                #pressure-gauge-needle { height: 25px; }
                .comic-action-word { font-size: 32px; }
            }
        `;
        document.head.appendChild(this.styleElement);
    }

    createUI() {
        const getSrc = (id) => this.assetManager.get(id)?.src || '';
        
        const html = `
            <div id="css-bag-wrapper">
                <div id="bag-back" class="bag-part" style="background-image: url('${getSrc('g04_bag_back')}'); z-index: -1;"></div>
                <div id="bag-front" class="bag-part" style="background-image: url('${getSrc('g04_bag_front')}'); z-index: 100;"></div>
                <div id="bag-rip-l" class="bag-part hidden" style="background-image: url('${getSrc('g04_bag_ripped_left')}'); z-index: 100;"></div>
                <div id="bag-rip-r" class="bag-part hidden" style="background-image: url('${getSrc('g04_bag_ripped_right')}'); z-index: 100;"></div>
            </div>
            <div id="pressure-gauge-wrapper" class="hidden" style="background-image: url('${getSrc('g04_ui_gauge')}');">
                <div id="pressure-gauge-needle"></div>
            </div>
        `;
        
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        this.uiRoot.appendChild(template.content.cloneNode(true));
    }

    // ============================================================
    // 📜 PHASE 1: NARRATIVE INTRO
    // ============================================================

    startIntro() {
        this.stop(); 
        this.showDialogue(
            `I have deduced the culprit, Tintin! A Giant Belgian Termite! It ate the canvas bag and the floor!`,
            'thomson',
            { animate: true, comicTransition: true, onClose: () => this.startExplanation() }
        );
    }

    startExplanation() {
        this.showDialogue(
            `It wasn't a termite, detectives. It was Physics. Let me demonstrate with this stretched canvas.`,
            'tintin',
            { animate: true, onClose: () => this.startGameplay() }
        );
    }

    // ============================================================
    // 🕹️ PHASE 2: THE EXPERIMENT (GAMEPLAY)
    // ============================================================

    startGameplay() {
        this.state = 'GAME_ACTIVE';
        this.start(); 
        
        const gauge = this.uiRoot.querySelector('#pressure-gauge-wrapper');
        if (gauge) gauge.classList.remove('hidden');

        this.showDialogue(
            `All three objects weigh exactly 50 kilograms.<br><b>Drag and drop</b> them onto the canvas to see what happens!`,
            'tintin',
            { animate: true, disableTypewriter: true }
        );
    }

    onPointerDown(e) {
        if (this.state !== 'GAME_ACTIVE') return;
        const { x, y } = this.input;

        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            if (Math.abs(x - item.x) < item.w/2 && Math.abs(y - item.y) < item.h/2 && !item.vy) {
                this.activeItem = item;
                item.isDragging = true;
                this.triggerHaptic(15);
                this.hideDialogue(); 
                break;
            }
        }
    }

    onPointerMove(e) {
        this.triggerRefresh();
        if (!this.activeItem) return;

        this.activeItem.x = this.input.x;
        this.activeItem.y = this.input.y;

        // 1. Highlight Drop Zone
        const bagFront = this.uiRoot.querySelector('#bag-front');
        if (this.isOverDropZone(this.activeItem)) {
            if (bagFront) bagFront.style.filter = 'drop-shadow(0 0 15px #00E5FF) brightness(1.2)';
        } else {
            if (bagFront) bagFront.style.filter = 'none';
        }

        // 2. Update Dynamic Pressure Needle
        const pressure = this.activeItem.mass / this.activeItem.area;
        const maxExpectedPressure = 4.0; 
        const fillPct = Math.min(1.0, pressure / maxExpectedPressure);
        
        // Map 0 -> 1 to an angle of -65deg (Green) to +65deg (Red)
        const degrees = -65 + (fillPct * 130);
        
        const needle = this.uiRoot.querySelector('#pressure-gauge-needle');
        const container = this.uiRoot.querySelector('#pressure-gauge-wrapper');
        if (needle && container) {
            needle.style.transform = `translate(-50%, -100%) rotate(${degrees}deg)`;
            if (fillPct > 0.8) container.classList.add('gauge-shake');
            else container.classList.remove('gauge-shake');
        }
    }

    onPointerUp(e) {
        if (!this.activeItem) return;
        
        const item = this.activeItem;
        item.isDragging = false;
        this.activeItem = null;

        // Reset Gauge and Bag highlight
        const bagFront = this.uiRoot.querySelector('#bag-front');
        if (bagFront) bagFront.style.filter = 'none';
        
        const needle = this.uiRoot.querySelector('#pressure-gauge-needle');
        const container = this.uiRoot.querySelector('#pressure-gauge-wrapper');
        // Snap needle back to zero
        if (needle) needle.style.transform = `translate(-50%, -100%) rotate(-65deg)`;
        if (container) container.classList.remove('gauge-shake');

        if (this.isOverDropZone(item)) {
            this.processDrop(item);
        } else {
            item.x = item.startX;
            item.y = item.startY;
            this.triggerRefresh();
        }
    }

    isOverDropZone(item) {
        return (item.x > this.canvasZone.x - this.canvasZone.w/2 && 
                item.x < this.canvasZone.x + this.canvasZone.w/2 && 
                item.y > this.canvasZone.y - 50 && item.y < this.canvasZone.y + 100);
    }

    processDrop(item) {
        const pressure = item.mass / item.area;
        
        if (pressure > 3.0) { 
            // --- HIGH PRESSURE (RIP) ---
            // Snap to center so it falls cleanly through the hole
            item.x = this.canvasZone.x;
            item.y = this.canvasZone.y - item.h/2 + 20; 
            
            this.triggerHaptic(300);
            this.canvasZone.ripped = true;
            
            this.uiRoot.querySelector('#bag-front').classList.add('hidden');
            this.uiRoot.querySelector('#bag-back').classList.add('hidden');
            
            const ripL = this.uiRoot.querySelector('#bag-rip-l');
            const ripR = this.uiRoot.querySelector('#bag-rip-r');
            ripL.classList.remove('hidden'); ripL.classList.add('rip-anim-left');
            ripR.classList.remove('hidden'); ripR.classList.add('rip-anim-right');

            this.spawnActionWord("RIIIIIIP!", "#FF5252");
            
            for(let i=0; i<35; i++) {
                this.particles.push({
                    x: this.canvasZone.x + (Math.random()-0.5)*120,
                    y: this.canvasZone.y - 20, 
                    vx: (Math.random()-0.5)*600,
                    vy: (Math.random()-1.0)*500 - 150, 
                    life: 2.5, maxLife: 2.5,
                    size: 8 + Math.random()*15, 
                    rot: Math.random()*Math.PI*2,
                    vRot: (Math.random()-0.5)*15,
                    isDust: Math.random() > 0.6 
                });
            }

            item.vy = 200; 
            setTimeout(() => this.startQuiz(), 2000);

        } else {
            // --- LOW PRESSURE (BOUNCE) ---
            this.triggerHaptic(50);
            this.spawnActionWord("BOING!", "#4CAF50");
            
            const parts = this.uiRoot.querySelectorAll('.bag-part');
            parts.forEach(p => p.classList.add('bag-stretch'));
            
            // Set up the arc starting exactly where the user let go
            item.isBouncing = true;
            item.bounceTime = 0;
            item.bagReleased = false;
            item.dropX = item.x; 
            item.dropY = item.y;
            item.dipX = item.dropX; 
            item.dipY = this.canvasZone.y - item.h/2 + 20 + (pressure * 20); // Deeper dip for more pressure
        }
        this.triggerRefresh();
    }

    spawnActionWord(text, color) {
        const x = this.canvasZone.textX;
        const y = this.canvasZone.textY;
        const word = document.createElement('div');
        word.className = 'comic-action-word';
        word.innerText = text;
        word.style.left = `${x}px`;
        word.style.top = `${y}px`;
        word.style.color = color;
        this.uiRoot.appendChild(word);
        setTimeout(() => word.remove(), 1200);
    }

    // ============================================================
    // 🧠 PHASE 3: THE CONCLUSION (QUIZ WITH NOTEBOOK)
    // ============================================================

    startQuiz() {
        this.state = 'QUIZ';
        this.stop();
        
        const gauge = this.uiRoot.querySelector('#pressure-gauge-wrapper');
        if (gauge) gauge.classList.add('hidden');

        this.showDialogue(
            `Physics? Is he a suspect? We’d better update our notes, Thompson.<br> Tintin, why did the rock fall through instead of just being heavy?`,
            'thomson',
            { animate: true, disableTypewriter: true, onClose: () => this.createQuizOverlay() }
        );
    }

    createQuizOverlay() {
        const notebookSrc = this.assetManager.get('ui_police_notebook')?.src;

        this.quizUI.show([
            { text: "Because the rock is actually a termite in disguise.", correct: false },
            { text: "Because its heavy mass was concentrated into a tiny, sharp area, creating massive Pressure.", correct: true, onSelect: (c) => this.handleQuizAnswer(c) },
            { text: "Because the canvas bag was allergic to the rock.", correct: false }
        ], notebookSrc, { keepOpenOnWrong: true }); 
    }

    handleQuizAnswer(isCorrect) {
        if (isCorrect) {
            this.showDialogue(
                `Exactly! Pressure equals Force divided by Area. A sharp point concentrates all that weight into one destructive spot!`,
                'tintin',
                { animate: true, onClose: () => this.win() }
            );
        } else {
            this.showDialogue(
                `To be precise, that makes absolutely no sense. Try again!`,
                'thomson',
                { animate: true, onClose: () => this.createQuizOverlay() }
            );
        }
    }

    // ============================================================
    // 🖌️ UPDATE & RENDER LOOPS
    // ============================================================

    update(dt) {
        super.update(dt);
        let needsRender = false;

        // Safety clamp to prevent physics explosion during heavy CSS rips
        const safeDt = Math.min(dt, 0.05); 

        // --- IDLE TIMER FOR WIGGLE ---
        this.idleTime = this.idleTime || 0;
        if (!this.input.isDown && !this.activeItem && this.state === 'GAME_ACTIVE') {
            this.idleTime += dt;
            // Force rendering when in the 1-second wiggle window (every 5 seconds)
            if (this.idleTime % 5 > 3 && this.idleTime % 5 < 4) {
                needsRender = true;
            }
        } else {
            this.idleTime = 0;
        }


        // --- 1. Physics: Falling Rock & Bouncing Items ---
        this.items.forEach(item => {
            if (item.vy > 0) {
                item.y += item.vy * safeDt;
                item.vy += 800 * safeDt; 
                needsRender = true;
            }

            if (item.isBouncing) {
                item.bounceTime += safeDt;
                // Exactly 0.4s to match the 0.2s down / 0.2s up CSS transition
                const duration = 0.4; 
                
                if (item.bounceTime < duration) {
                    const t = item.bounceTime / duration;
                    
                    if (t < 0.5) {
                        // PHASE 1: Falling into the bag (0.0s to 0.2s)
                        const phaseT = t * 2; 
                        // Math.sin creates a smooth deceleration at the bottom of the bag
                        const ease = Math.sin(phaseT * (Math.PI / 2)); 
                        item.x = item.dropX + (item.dipX - item.dropX) * ease;
                        item.y = item.dropY + Math.abs((item.dipY - item.dropY) * ease);
                    } else {
                        // PHASE 2: Bouncing back to the shelf (0.2s to 0.4s)
                        
                        // SYNC: Exactly at 0.2s, release the CSS bag so it snaps up WITH the item
                        if (!item.bagReleased) {
                            item.bagReleased = true;
                            const parts = this.uiRoot.querySelectorAll('.bag-part');
                            parts.forEach(p => p.classList.remove('bag-stretch'));
                        }

                        const phaseT = (t - 0.5) * 2; 
                        // Cubic ease-out looks snappy as it returns to the starting shelf
                        const ease = 1 - Math.pow(1 - phaseT, 3); 
                        item.x = item.dipX + (item.startX - item.dipX) * ease;
                        item.y = item.dipY + (item.startY - item.dipY) * ease;
                    }
                } else {
                    // Snap to finish and ensure cleanup
                    item.isBouncing = false;
                    item.x = item.startX;
                    item.y = item.startY;
                    
                    // Fallback cleanup just in case of frame skips
                    if (!item.bagReleased) {
                        const parts = this.uiRoot.querySelectorAll('.bag-part');
                        parts.forEach(p => p.classList.remove('bag-stretch'));
                    }
                }
                needsRender = true;
            }

        });

        // 2. Particle Physics
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.life -= safeDt;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            } else {
                p.x += p.vx * safeDt;
                p.y += p.vy * safeDt;
                p.vy += 800 * safeDt; // Gravity pulling them back down
                p.rot += p.vRot * safeDt;
                needsRender = true;
            }
        }

        if (needsRender || this.activeItem) {
            this.triggerRefresh();
        }
    }

    draw(ctx) {
        const bg = this.assetManager.get('g04_bg_pantry');
        if (bg) {
            ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        } else {
            ctx.fillStyle = '#3E2723'; 
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        this.items.forEach(item => {
            if (this.state !== 'GAME_ACTIVE') return;

            ctx.save();
            ctx.translate(item.x, item.y);

            // 1. Desktop Hover Check
            const isHovered = !this.input.isTouch && !item.isDragging && !item.isBouncing && !item.vy &&
                              Math.abs(this.input.x - item.x) < item.w/2 && 
                              Math.abs(this.input.y - item.y) < item.h/2;
            
            // 2. Idle Wiggle Check (Fires for 1 second every 5 seconds of inactivity)
            const isWiggling = !item.isDragging && !item.isBouncing && !item.vy && 
                               (this.idleTime % 5 > 3 && this.idleTime % 5 < 4);

            if (item.isDragging || isHovered) {
                ctx.shadowColor = isHovered ? '#00E5FF' : 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = isHovered ? 20 : 15;
                ctx.shadowOffsetY = isHovered ? 0 : 10;
                ctx.scale(1.1, 1.1);
            } else if (isWiggling) {
                // A cute 'jump and tilt' animation
                const wiggleProgress = (this.idleTime % 5) - 3; // 0.0 to 1.0
                const jumpY = Math.sin(wiggleProgress * Math.PI) * -20; // Hop up 20px
                const tilt = Math.sin(wiggleProgress * Math.PI * 6) * 0.15; // Shake left/right
                
                ctx.translate(0, jumpY);
                ctx.rotate(tilt);
                ctx.shadowColor = 'rgba(255, 235, 59, 0.6)'; // Soft yellow attention glow
                ctx.shadowBlur = 15;
            }

            let assetKey = null;
            if (item.id === 'BOARD') assetKey = 'g04_item_board';
            else if (item.id === 'BALL') assetKey = 'g04_item_ball';
            else if (item.id === 'ROCK') assetKey = 'g04_item_rock';

            const itemImg = this.assetManager.get(assetKey);

            if (itemImg) {
                ctx.drawImage(itemImg, -item.w/2, -item.h/2, item.w, item.h);
            } else {
                ctx.fillStyle = item.color;
                if (item.id === 'BALL') {
                    ctx.beginPath(); ctx.arc(0, 0, item.w/2, 0, Math.PI*2); ctx.fill();
                } else if (item.sharp) {
                    ctx.beginPath();
                    ctx.moveTo(0, item.h/2);
                    ctx.lineTo(-item.w/2, -item.h/2);
                    ctx.lineTo(item.w/2, -item.h/2);
                    ctx.closePath();
                    ctx.fill();
                } else {
                    ctx.fillRect(-item.w/2, -item.h/2, item.w, item.h);
                }
            }

            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(item.label, 0, -item.h/2 - 10);
            
            if (!item.isDragging && !item.vy && this.state === 'GAME_ACTIVE') {
                ctx.font = '12px Arial';
                ctx.fillStyle = '#B0BEC5';
                ctx.fillText(`Mass: 50kg`, 0, item.h/2 + 15);
                ctx.fillText(`Area: ${item.area}cm²`, 0, item.h/2 + 30);
            }

            ctx.restore();
        });

        // 3. Draw Supercharged Particles LAST so they appear on top of dark overlays
        this.particles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife); 
            
            if (p.isDust) {
                ctx.fillStyle = '#A1887F'; 
                ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.fillStyle = '#D7CCC8'; 
                ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
                ctx.strokeStyle = '#5D4037';
                ctx.lineWidth = 2; 
                ctx.strokeRect(-p.size/2, -p.size/2, p.size, p.size);
            }
            ctx.restore();
        });
    }

    resize() {
        super.resize();

        // FIX: Safety Guard. 
        // During the initial super() call, 'this.atoms' is undefined.
        // We must strictly abort before attempting to render.
        if (this.state === undefined) return;

        this.fixLayout();
        
        // If the game loop is stopped (Intro/Quiz), the canvas was just cleared by the browser.
        // We must manually repaint one frame so the user doesn't see black.
        if (!this.isRunning) {
            this.renderFrame();
        }
    }
}
