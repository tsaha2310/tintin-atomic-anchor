/* =========================================
   js/games/TheHaddockHeave.js
   Game 14: "The Haddock Heave"
   Theme: Potential Energy, Stability, & Activation Energy
   Mechanic: Split-screen Physics + Chalkboard Graphing
   ========================================= */

import { PhysicsGame } from '../middleware/PhysicsGame.js';
import { QuizOverlay } from '../components/QuizOverlay.js';

export class TheHaddockHeave extends PhysicsGame {

    async init() {
        this.enableSmartRendering = true;
        
        // 1. Data & State Initialization
        this.lvl = this.tuning.level_1_mountain || this.tuning;
        this.phase = 'INTRO'; // INTRO -> HEAVE -> EXHAUSTED -> INSPECT -> LEVER -> FALL -> QUIZ
        
        this.chalkParticles = [];
        this.heaveProgress = 0; // Tracks Haddock's stamina
        this.activeTool = null;
        
        // Root Blocker Configuration (Easy to tweak here or via this.lvl)
        this.rootBlockerSize = this.lvl.rootBlockerSize || 60; 
        this.rootHitRadius = this.lvl.rootHitRadius || 70;
        this.rootBlockerX = this.lvl.rootBlockerX || 510;
        this.rootBlockerY = this.lvl.rootBlockerY || 200;
        
        // Terrain Curve Definition (Maps X to Y)
        this.curvePoints = [];
        this.generateEnergyCurve();

        // 2. Clear & Setup Physics World
        if (this.clearPhysics) this.clearPhysics();
        this.setupWorld();

        // 3. Setup UI Components
        this.quizUI = new QuizOverlay(this.uiRoot, this.assetManager);
        this.injectCSS();

        // 4. Preload Assets
        await this.preload([
            'g14_bg_mountain', 'g14_bg_chalkboard', 'g14_boulder', 
            'g14_haddock_push', 'g14_haddock_exhausted', 'g14_root_blocker', 
            'g14_ice_axe', 'ui_journal_bg'
        ]);

        // 5. Start Narrative
        this.startIntro();
    }

    // ==========================================
    // CSS & UI INJECTION
    // ==========================================

    injectCSS() {
        if (this.styleElement) this.styleElement.remove();
        this.styleElement = document.createElement('style');
        this.styleElement.innerHTML = `
            /* --- ACTION BUTTON --- */
            .action-button {
                position: absolute; 
                top: 50%; /* Anchored relative to the top viewport instead of fixed bottom */
                left: 50%; 
                transform: translate(-50%, -50%);
                padding: 15px 40px; font-size: 28px; font-family: "Comic Sans MS", sans-serif;
                font-weight: bold; color: white; border-radius: 50px; cursor: pointer; 
                background-color: #F44336; border: 4px solid #B71C1C; 
                box-shadow: 0 8px 0 #B71C1C, 0 15px 20px rgba(0,0,0,0.4);
                transition: all 0.1s ease; z-index: 100;
                user-select: none; -webkit-user-select: none; touch-action: manipulation;
            }
            .action-button:active, .action-button.pressed {
                /* Push down without losing horizontal centering */
                transform: translate(-50%, calc(-50% + 8px));
                box-shadow: 0 0px 0 #B71C1C, 0 5px 10px rgba(0,0,0,0.5);
                background-color: #EF5350;
            }

            /* --- STAMINA BAR --- */
            .stamina-container {
                position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
                width: 400px; height: 30px; background: rgba(0,0,0,0.6);
                border: 3px solid #FFF; border-radius: 15px; overflow: hidden;
                z-index: 100; display: none; box-shadow: 0 5px 15px rgba(0,0,0,0.5);
            }
            .stamina-fill {
                width: 0%; height: 100%; background: linear-gradient(90deg, #4CAF50, #FFEB3B, #F44336);
                transition: width 0.1s linear;
            }
            .stamina-text {
                position: absolute; width: 100%; text-align: center; top: 4px;
                color: white; font-family: sans-serif; font-weight: bold; font-size: 16px;
                text-shadow: 1px 1px 2px black; pointer-events: none;
            }

            .quiz-overlay-themed h2 {
                background-color: rgba(255,255,255,0.85);
                padding: 15px; border-radius: 8px;
                margin-bottom: 20px; font-family: sans-serif; text-align: center;
            }

            /* --- RESPONSIVE MOBILE FIXES --- */
            @media (max-width: 768px) and (orientation: portrait) {
                .action-button { font-size: 16px; padding: 8px 20px; border-width: 2px; box-shadow: 0 4px 0 #B71C1C; z-index: 1000; }
                .stamina-container { width: 250px; top: 10px; height: 25px; }
                .stamina-text { font-size: 12px; top: 3px; }
            }

            @media (max-height: 500px) and (orientation: landscape) {
                .action-button { font-size: 14px; padding: 8px 20px; border-width: 2px; box-shadow: 0 4px 0 #B71C1C; z-index: 1000; }
                .action-button:active, .action-button.pressed { transform: translate(-50%, calc(-50% + 4px)); box-shadow: 0 0px 0 #B71C1C; }
                .stamina-container { width: 200px; height: 18px; top: 5px; border-width: 2px; z-index: 1000; }
                .stamina-text { font-size: 10px; top: 2px; }
                .quiz-overlay-themed h2 { margin-bottom: 5px; }
                .quiz-choice-btn { margin: 2px 0 !important; }
            }
        `;
        document.head.appendChild(this.styleElement);
    }

    buildHeaveUI() {
        const barHTML = `
            <div class="stamina-container" id="stamina-box">
                <div class="stamina-fill" id="stamina-fill"></div>
                <div class="stamina-text">WORK DONE</div>
            </div>
            <button class="action-button" id="btn-heave">HEAVE!</button>
        `;
        this.uiRoot.insertAdjacentHTML('beforeend', barHTML);
        document.getElementById('stamina-box').style.display = 'block';

        const btn = document.getElementById('btn-heave');
        
        const startPush = (e) => { e.preventDefault(); this.isPushing = true; btn.classList.add('pressed'); };
        const stopPush = (e) => { this.isPushing = false; btn.classList.remove('pressed'); };

        btn.addEventListener('mousedown', startPush);
        btn.addEventListener('touchstart', startPush, {passive: false});
        window.addEventListener('mouseup', stopPush);
        window.addEventListener('touchend', stopPush);
    }

    // ==========================================
    // PHYSICS & TERRAIN GENERATION
    // ==========================================

    generateEnergyCurve() {
        this.curvePoints = [];
        const waypoints = this.lvl.terrainWaypoints;

        if (!waypoints || waypoints.length < 2) {
            console.error("Missing terrainWaypoints in levels.json!");
            return;
        }

        const resolution = 10; 

        for (let i = 0; i < waypoints.length - 1; i++) {
            const p1 = waypoints[i];
            const p2 = waypoints[i+1];
            
            const dist = p2.x - p1.x;
            const steps = Math.max(1, Math.ceil(dist / resolution));

            for (let j = 0; j <= steps; j++) {
                if (j === steps && i !== waypoints.length - 2) continue;
                const t = j / steps;
                this.curvePoints.push({
                    x: p1.x + t * (p2.x - p1.x),
                    y: p1.y + t * (p2.y - p1.y)
                });
            }
        }
        
        this.terrainMinY = Math.min(...this.curvePoints.map(p => p.y));
        this.terrainMaxY = Math.max(...this.curvePoints.map(p => p.y));
    }

    getTerrainY(screenX) {
        for (let i = 0; i < this.curvePoints.length - 1; i++) {
            const p1 = this.curvePoints[i];
            const p2 = this.curvePoints[i+1];
            if (screenX >= p1.x && screenX <= p2.x) {
                const t = (screenX - p1.x) / (p2.x - p1.x);
                return p1.y + t * (p2.y - p1.y);
            }
        }
        return this.curvePoints[this.curvePoints.length - 1].y;
    }

    getChalkY(screenX) {
        const realY = this.getTerrainY(screenX);
        const range = this.terrainMaxY - this.terrainMinY;
        const normalizedY = (realY - this.terrainMinY) / (range || 1);
        
        const chalkTop = 480;
        const chalkHeight = 220; 
        return chalkTop + (normalizedY * chalkHeight);
    }

    setupWorld() {
        // 1. Build the physical terrain
        for (let i = 0; i < this.curvePoints.length - 1; i++) {
            const p1 = this.curvePoints[i];
            const p2 = this.curvePoints[i+1];
            
            const cx = (p1.x + p2.x) / 2;
            const cy = (p1.y + p2.y) / 2;
            const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            
            // FIX 1: Reduce thickness and add a 'chamfer' (rounded corners).
            // This turns the collision blocks into smooth capsules/pills, preventing 
            // sharp corners from sticking up and causing the boulder to "float" over convex hill peaks.
            const height = 10;
            const offsetX = -Math.sin(angle) * (height / 2);
            const offsetY = Math.cos(angle) * (height / 2);
            
            const segment = Matter.Bodies.rectangle(cx + offsetX, cy + offsetY, length + 4, height, { 
                isStatic: true, 
                angle: angle, 
                friction: 0.8, 
                chamfer: { radius: height / 2 }, // Perfect semi-circle ends
                render: { visible: false } 
            });
            Matter.World.add(this.world, segment);
        }

        // 2. Create the Boulder
        this.boulderRadius = 60;
        this.boulder = Matter.Bodies.circle(420, 200, this.boulderRadius, {
            restitution: 0.05, friction: 0.8, density: 0.1, label: 'boulder'
        });
        Matter.Body.setInertia(this.boulder, this.boulder.inertia * 4);
        Matter.World.add(this.world, this.boulder);

        // 3. Create the Static Root Blocker
        // FIX: Set isSensor: true. This prevents the boulder from climbing it 
        // like a tiny ledge, but still allows us to click and drag the axe onto it!
        this.rootBlocker = Matter.Bodies.rectangle(this.rootBlockerX, this.rootBlockerY, this.rootBlockerSize, this.rootBlockerSize, {
            isStatic: true, label: 'root', isSensor: true 
        });
        
        // --- INVISIBLE VAULTING BARRIER ---
        // This is the actual physical wall that stops the boulder.
        // We apply your +15 offset here to close the visual gap on the image.
        const visualGapOffset = 15; 
        this.rootWall = Matter.Bodies.rectangle(this.rootBlockerX + visualGapOffset, this.rootBlockerY - 500, 20, 1000, {
            isStatic: true, friction: 0
        });

        Matter.World.add(this.world, [this.rootBlocker, this.rootWall]);
    }
    // ==========================================
    // NARRATIVE & PHASES
    // ==========================================

    startIntro() {
        this.stop(); 
        this.showDialogue(
            "It's blocking the only way forward! Calculus says it's in a 'Local Energy Minimum'. What a load of balderdash! I'll just push it backwards up the hill out of our way!", 
            "haddock", 
            { animate: true, comicTransition: true, onClose: () => {
                this.phase = 'HEAVE';
                this.buildHeaveUI();
                this.start(); 
            }}
        );
    }

    triggerExhaustion() {
        this.phase = 'EXHAUSTED';
        this.isPushing = false;

        // Clear Previous UI Safely
        this.clearDynamicUI();

        this.triggerHaptic(500); 

        // Update dialogue to segue into pushing down
        this.showDialogue(
            "Ten thousand thundering typhoons! It's like fighting gravity itself! I'll just push it DOWN the ravine instead!", 
            "haddock", 
            { animate: true, comicTransition: true, onClose: () => {
                this.phase = 'HEAVE_DOWN';
                this.heaveProgress = 0; // Reset stamina
                
                // Re-build UI and change button text
                this.buildHeaveUI();
                const btn = document.getElementById('btn-heave');
                if (btn) btn.innerText = "HEAVE DOWN!";
            }}
        );
    }

    triggerExhaustionDown() {
        this.phase = 'EXHAUSTED_DOWN';
        this.isPushing = false;

        // Clear Previous UI Safely
        this.clearDynamicUI();

        this.triggerHaptic(500); 

        this.showDialogue(
            "Billions of bilious blue blistering barnacles! It's downhill! Why won't it roll?!", 
            "haddock", 
            { animate: true, comicTransition: true, onClose: () => {
                this.showDialogue(
                    "Fascinating! It seems we've hit an Activation Energy barrier. Something is stopping it. Click around to inspect the area.",
                    "calculus",
                    { animate: true, onClose: () => {
                        this.phase = 'INSPECT';
                        if (this.canvas) this.canvas.style.cursor = 'help';
                    }}
                );
            }}
        );
    }

    startChopping() {
        this.phase = 'CHOPPING';
        this.chopTimer = 0.8; // Duration of the chopping animation in seconds
        
        // Snap the axe perfectly to the root for the animation
        this.activeTool.x = this.rootBlocker.position.x;
        this.activeTool.y = this.rootBlocker.position.y;
    }

    executeCatalyst() {
        this.phase = 'FALLING';
        this.activeTool = null;
        this.triggerHaptic(100);
 
        // 1. Capture BOTH the exact X and Y coordinates of the root blocker 
        this.dropOffX = this.rootBlocker.position.x;
        const dropOffY = this.rootBlocker.position.y;

        // 2. Remove the Root Blocker AND the invisible wall from Physics World
        Matter.World.remove(this.world, [this.rootBlocker, this.rootWall]);

        // 3. Gentle Nudge! 
        Matter.Body.setVelocity(this.boulder, { x: 5, y: 0 });
        Matter.Body.setAngularVelocity(this.boulder, 0.1);

        // 4. Dramatic screen shake & dust
        this.screenShake = 30;
        this.spawnDust(this.dropOffX, dropOffY, 20); 
    }

    spawnIceAxe() {
        this.activeTool = { x: 800, y: 150, isDragging: false };
    }

    spawnDust(x, y, count, scale = 1.0) {
        if (!this.dustParticles) this.dustParticles = [];
        for (let i = 0; i < count; i++) {
            this.dustParticles.push({
                x: x + (Math.random() - 0.5) * 40 * scale, 
                y: y + (Math.random() - 0.5) * 20 * scale,
                size: (10 + Math.random() * 20) * scale, // Dynamically scales the particle size
                alpha: 0.8,
                vx: (Math.random() - 0.5) * 50 * scale, 
                vy: (-20 - Math.random() * 50) * scale  // Scales the pop-up height
            });
        }
    }

    spawnChalkSpark() {
        const chalkX = this.boulder.position.x;
        const chalkY = this.getChalkY(chalkX);
        for (let i = 0; i < 5; i++) {
            this.chalkParticles.push({
                x: chalkX, y: chalkY,
                vx: (Math.random() - 0.5) * 100, vy: -50 - Math.random() * 150,
                life: 1.0, color: (Math.random() > 0.5) ? '#FFEB3B' : '#FF9800' 
            });
        }
    }

    // ==========================================
    // INPUT HANDLING
    // ==========================================

    onPointerDown(e) {
        if (this.dialogueShowing) {
            this.hideDialogue();
            return;
        }

        if (this.phase === 'INSPECT') {
            this.triggerActivationLever(this.input.x, this.input.y);
        } else if (this.phase === 'ACTIVATION' && this.activeTool) {
            const dist = Math.hypot(this.input.x - this.activeTool.x, this.input.y - this.activeTool.y);
            if (dist < 80) this.activeTool.isDragging = true;
        }
    }

    onPointerUp(e) {
        if (this.phase === 'ACTIVATION' && this.activeTool && this.activeTool.isDragging) {
            this.activeTool.isDragging = false;
            
            const rx = this.rootBlocker.position.x;
            const ry = this.rootBlocker.position.y;
            const dist = Math.hypot(this.activeTool.x - rx, this.activeTool.y - ry);
            
            if (dist < this.rootHitRadius) {
                // Trigger the new chopping animation phase instead of breaking instantly
                this.startChopping();
            } else {
                this.activeTool.x = 800; this.activeTool.y = 150;
            }
        }
    }

    triggerActivationLever(mx, my) {
        const rx = this.rootBlocker.position.x;
        const ry = this.rootBlocker.position.y;
        const dist = Math.hypot(mx - rx, my - ry);
        
        if (dist < this.rootHitRadius) {
            this.phase = 'ACTIVATION';
            if (this.canvas) this.canvas.style.cursor = 'default';

            this.showDialogue(
                "Professor, it's just this tiny root holding it back! It's an Activation Energy barrier!",
                "tintin",
                { animate: true, disableTypewriter: true, onClose: () => {
                    this.showDialogue(
                        "Drag the Ice Axe onto the root to supply the Activation Energy!",
                        "calculus",
                        { animate: true, disableTypewriter: true, onClose: () => {
                            this.spawnIceAxe();
                        }}
                    );
                }}
            );
        } else {
            this.showDialogue("Nothing interesting there. Could something be stopping the boulder?", "tintin");
        }
    }

    // ==========================================
    // MODULAR GAME LOOP (UPDATE)
    // ==========================================

    update(dt) {
        super.update(dt); 
        const safeDt = Math.min(dt, 0.05);
        this.needsRender = false;

        this.updateScreenShake(safeDt);
        this.updateChalkParticles(safeDt);
        this.updateHoverDetection();
        this.updatePhases(safeDt);

        if (Math.abs(this.boulder.velocity.x) > 0.1 || Math.abs(this.boulder.velocity.y) > 0.1) {
            this.needsRender = true;
        }

        if (this.needsRender || this.isPushing) this.triggerRefresh();
    }

    updateScreenShake(dt) {
        if (this.screenShake > 0) {
            this.screenShake -= dt * 20;
            if (this.screenShake < 0) this.screenShake = 0;
            this.needsRender = true;
        }
    }

    updateChalkParticles(dt) {
        if (this.chalkParticles.length > 0) {
            this.chalkParticles.forEach(p => {
                p.x += p.vx * dt; p.y += p.vy * dt;
                p.vy += 200 * dt; 
                p.life -= dt;
            });
            this.chalkParticles = this.chalkParticles.filter(p => p.life > 0);
            this.needsRender = true;
        }
    }

    updateHoverDetection() {
        const prevHover = this.isHoveringRoot;
        this.isHoveringRoot = false;
        
        if (this.rootBlocker && (this.phase === 'INSPECT' || this.phase === 'ACTIVATION')) {
            const rx = this.rootBlocker.position.x;
            const ry = this.rootBlocker.position.y;
            
            let checkX = this.input.x;
            let checkY = this.input.y;
            
            if (this.phase === 'ACTIVATION' && this.activeTool && this.activeTool.isDragging) {
                checkX = this.activeTool.x;
                checkY = this.activeTool.y;
            }
            
            const dist = Math.hypot(checkX - rx, checkY - ry);
            if (dist < this.rootHitRadius) {
                this.isHoveringRoot = true;
            }
        }
        
        if (prevHover !== this.isHoveringRoot) {
            this.needsRender = true;
        }

    }

    updatePhases(dt) {
        if (this.phase === 'HEAVE') {
            this.updateHeaveUpPhase(dt);
        }

        if (this.phase === 'HEAVE_DOWN') {
            this.updateHeaveDownPhase(dt);
        }

        if (this.phase === 'ACTIVATION' && this.activeTool && this.activeTool.isDragging) {
            this.activeTool.x = this.input.x;
            this.activeTool.y = this.input.y;
            this.needsRender = true;
        }

        if (this.phase === 'CHOPPING') {
            this.performChopping(dt);
        }

        if (this.phase === 'FALLING') {
            this.updateFallingPhase(dt);
        }
    }

    updateHeaveUpPhase(dt) {
        if (this.isPushing) {
            const currentX = this.boulder.position.x;
            const distancePushed = Math.max(0, 420 - currentX); 
            let forceMagnitude = (this.lvl.physics?.maxPushForce || 150) * (1 - (distancePushed / 300));
            if (forceMagnitude < 0) forceMagnitude = 0;

            Matter.Body.applyForce(this.boulder, this.boulder.position, { x: -forceMagnitude * dt, y: 0 });
            
            this.heaveProgress += dt * 12; 
            const fillEl = document.getElementById('stamina-fill');
            if (fillEl) fillEl.style.width = `${Math.min(100, this.heaveProgress)}%`;

            if (Math.random() > 0.8) this.triggerHaptic(10);
            this.needsRender = true;

            if (this.heaveProgress >= 100) this.triggerExhaustion();
        } else {
            if (this.heaveProgress > 0) {
                this.heaveProgress -= dt * 5;
                const fillEl = document.getElementById('stamina-fill');
                if (fillEl) fillEl.style.width = `${Math.max(0, this.heaveProgress)}%`;
            }
        }

        this.spawnDustOnBoulderPush(dt);
    }

    spawnDustOnBoulderPush(dt) {
        // Subtle grinding dust based on movement
        // If the boulder is moving (either being pushed up or sliding back down)
        const velX = Math.abs(this.boulder.velocity.x);
        if (velX > 0.2 && Math.random() > 0.6) {
            // Map the velocity to a small scale (e.g., 0.1 to 0.4 max)
            const dustScale = Math.min(0.6, Math.max(0.2,velX * 0.15)); 
            this.spawnDust(this.boulder.position.x, this.boulder.position.y + this.boulderRadius, 1, dustScale);
        }
    }

    updateHeaveDownPhase(dt) {
        if (this.isPushing) {
            // Apply force rightwards (positive X). The physical rootBlocker will stop it!
            let forceMagnitude = this.lvl.physics?.maxPushForce || 150;
            Matter.Body.applyForce(this.boulder, this.boulder.position, { x: forceMagnitude * dt, y: 0 });
            
            this.heaveProgress += dt * 12; 
            const fillEl = document.getElementById('stamina-fill');
            if (fillEl) fillEl.style.width = `${Math.min(100, this.heaveProgress)}%`;

            if (Math.random() > 0.8) this.triggerHaptic(10);
            this.needsRender = true;

            if (this.heaveProgress >= 100) this.triggerExhaustionDown();
        } else {
            if (this.heaveProgress > 0) {
                this.heaveProgress -= dt * 5;
                const fillEl = document.getElementById('stamina-fill');
                if (fillEl) fillEl.style.width = `${Math.max(0, this.heaveProgress)}%`;
            }
        }
        this.spawnDustOnBoulderPush(dt);
    }

    updateFallingPhase(dt) {
        const bx = this.boulder.position.x;
        const by = this.boulder.position.y;
        
        if (bx > this.dropOffX + 20 && Math.random() > 0.6) {
            this.spawnDust(bx, by + this.boulderRadius, 3);
            this.screenShake = Math.min(20, Math.abs(this.boulder.velocity.x) * 2); 
        }

        if (bx > this.dropOffX + 20 && Math.random() > 0.5) {
            this.spawnChalkSpark();
        }

        if (bx > this.SAFE_WIDTH + 100 || by > this.SAFE_HEIGHT + 100) {
            this.phase = 'QUIZ_READY';
            this.screenShake = 0;
            setTimeout(() => { this.startQuiz(); }, 1500);
        }
        this.needsRender = true;
    }


    performChopping(dt) {
        this.chopTimer -= dt;

        // Force continuous rendering and spawn splinters while the axe is chopping
        this.needsRender = true;
        
        // Micro-haptics to feel the chopping impacts
        if (Math.random() > 0.7) this.triggerHaptic(5); 

        // Spawn wood splinters continuously while chopping
        if (!this.dustParticles) this.dustParticles = [];
        if (Math.random() > 0.3) { 
            const rx = this.rootBlocker.position.x;
            const ry = this.rootBlocker.position.y;
            this.dustParticles.push({
                x: rx + (Math.random() - 0.5) * 30, 
                y: ry + (Math.random() - 0.5) * 30,
                size: 3 + Math.random() * 6,     // Much smaller than normal dust
                alpha: 1.0,
                vx: (Math.random() - 0.5) * 150, // Fly off erratically left/right
                vy: -50 - Math.random() * 100    // Shoot sharply upwards
            });
        }

        // Once the animation timer finishes, break the root!
        if (this.chopTimer <= 0) {
            this.executeCatalyst();
        }
    }


    // ==========================================
    // MODULAR RENDER LOGIC
    // ==========================================

    draw(ctx) {
        ctx.save();
        const sx = (Math.random() - 0.5) * this.screenShake;
        const sy = (Math.random() - 0.5) * this.screenShake;
        ctx.translate(sx, sy);

        const midPointY = this.SAFE_HEIGHT / 2 + 50; 
        const bx = this.boulder.position.x;
        const by = this.boulder.position.y;

        this.drawMountainViewport(ctx, midPointY, bx, by);
        this.drawChalkboardViewport(ctx, midPointY, bx);
        this.drawGlobalOverlays(ctx);

        ctx.restore(); 
    }

    drawMountainViewport(ctx, midPointY, bx, by) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, this.SAFE_WIDTH, midPointY);
        ctx.clip(); 

        const bg = this.assetManager.get('g14_bg_mountain');
        if (bg) {
            ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, midPointY);
        } else { 
            ctx.fillStyle = '#87CEEB'; ctx.fillRect(0, 0, this.SAFE_WIDTH, midPointY); 
        }

        const DEBUG_TERRAIN = false; 
        if (DEBUG_TERRAIN) {
            ctx.beginPath();
            this.curvePoints.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; ctx.lineWidth = 4; ctx.stroke();
            
            this.lvl.terrainWaypoints.forEach(p => {
                ctx.fillStyle = 'yellow';
                ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI*2); ctx.fill();
            });
        }

        this.drawRootBlocker(ctx);
        this.drawBoulder(ctx, bx, by);
        this.drawHaddock(ctx, bx, by);
        this.drawDustParticles(ctx);
        this.drawIceAxe(ctx);

        ctx.restore(); 
    }

    drawRootBlocker(ctx) {
        if (this.phase !== 'FALLING' && this.phase !== 'QUIZ_READY' && this.phase !== 'QUIZ') {
            const rootImg = this.assetManager.get('g14_root_blocker');
            if (this.rootBlocker && rootImg) {
                const rootPos = this.rootBlocker.position;
                
                ctx.save();
                
                // --- SPRITE SHAKE ---
                let shakeX = 0; 
                let shakeY = 0;

                const isChopping = (this.phase === 'CHOPPING');
                
                if (isChopping) {
                    // Violent +/- 4 pixel random shake
                    shakeX = (Math.random() - 0.5) * 8; 
                    shakeY = (Math.random() - 0.5) * 8;
                }
                
                // Apply the shake to the center coordinates
                ctx.translate(rootPos.x + shakeX, rootPos.y + shakeY);

                if (this.phase === 'INSPECT' || this.phase === 'ACTIVATION') {
                    ctx.shadowColor = this.isHoveringRoot ? '#39FF14' : '#FFD700'; 
                    ctx.shadowBlur = this.isHoveringRoot ? 25 : 15;
                }
                
                if (this.isHoveringRoot) {
                    ctx.scale(1.2, 1.2); 
                }
                
                const halfW = this.rootBlockerSize / 2;
                const halfH = this.rootBlockerSize / 2;
                
                // Draw centered since we already translated
                ctx.drawImage(rootImg, -halfW, -halfH, this.rootBlockerSize, this.rootBlockerSize);
                ctx.restore();
            }
        }
    }

    drawBoulder(ctx, bx, by) {
        const bImg = this.assetManager.get('g14_boulder');
        ctx.save();
        
        // 1. Move to the physics center
        ctx.translate(bx, by);
        
        // 2. Draw shadow BEFORE rotating so it always drops straight down
        ctx.shadowColor = 'rgba(0,0,0,0.95)'; 
        ctx.shadowBlur = 8; 
        ctx.shadowOffsetY = 4;
        
        // 3. Apply the physics rotation
        ctx.rotate(this.boulder.angle); 
        
        if (bImg) {
            // FIX: Because the PNG has transparent padding, the visual rock is too small.
            // We scale the image up so the rock perfectly matches the physics radius (60).
            const imageScale = 1.15; // Increase/decrease this if the rock looks too big/small
            const size = this.boulderRadius * 2 * imageScale;
            
            // To prevent wobbling when it rolls, the visual center of the rock MUST be at (0,0).
            // Tweak offsetY to push the visual rock perfectly into the center, absorbing the padding.
            const offsetX = 0;
            const offsetY = 8; 
            
            ctx.drawImage(bImg, -(size/2) + offsetX, -(size/2) + offsetY, size, size);
        } else {
            ctx.fillStyle = '#757575'; 
            ctx.beginPath(); 
            ctx.arc(0,0, this.boulderRadius, 0, Math.PI*2); 
            ctx.fill();
        }
        ctx.restore();
    }

    drawHaddock(ctx, bx, by) {
        // Group the phases logically
        const isPushingLeft = (this.phase === 'HEAVE' || this.phase === 'INTRO');
        const isPushingRight = (this.phase === 'HEAVE_DOWN');
        const isExhaustedRight = (this.phase === 'EXHAUSTED');
        const isExhaustedLeft = (this.phase === 'EXHAUSTED_DOWN' || this.phase === 'INSPECT' || this.phase === 'ACTIVATION' || this.phase === 'CHOPPING');

        if (isPushingLeft || isPushingRight) {
            const haddockImg = this.assetManager.get('g14_haddock_push');
            if (haddockImg) {
                let hx;
                if (isPushingLeft) {
                    const spritePaddingOffset = -20; 
                    hx = bx + this.boulderRadius + spritePaddingOffset;
                } else {
                    // Place him on the left side of the boulder for pushing down
                    const spritePaddingOffset = 30; 
                    hx = bx - this.boulderRadius - 150 + spritePaddingOffset;
                }
                
                const groundY = this.getTerrainY(hx + 75);
                const hy = groundY - 140; 
                
                let hShakeX = 0; let hShakeY = 0;
                if (this.isPushing) {
                    const intensity = (this.heaveProgress / 100) * 5;
                    hShakeX = (Math.random() - 0.5) * intensity;
                    hShakeY = (Math.random() - 0.5) * intensity;
                    
                    ctx.fillStyle = 'rgba(150, 200, 255, 0.8)';
                    for(let i=0; i<3; i++) {
                        ctx.beginPath(); 
                        // Draw sweat near his face depending on which way he's facing
                        const sweatX = isPushingLeft ? (hx + 20 + Math.random()*20) : (hx + 110 + Math.random()*20);
                        ctx.arc(sweatX, hy + 20 + Math.random()*20, 2+Math.random()*3, 0, Math.PI*2); 
                        ctx.fill();
                    }
                }
                
                ctx.save();
                ctx.translate(hx + hShakeX, hy + hShakeY);
                if (isPushingRight) {
                    // Dynamically flip the asset horizontally without needing a new image file
                    ctx.translate(150, 0); 
                    ctx.scale(-1, 1); 
                }
                ctx.drawImage(haddockImg, 0, 0, 150, 150);
                ctx.restore();
            }
        } else if (isExhaustedLeft || isExhaustedRight) {
            const hExhaust = this.assetManager.get('g14_haddock_exhausted');
            
            let hx;
            if (isExhaustedRight) {
                hx = bx + this.boulderRadius + 30; // Gave up pushing up
            } else {
                hx = bx - this.boulderRadius - 120; // Gave up pushing down
            }
            
            const groundY = this.getTerrainY(hx + 75);
            let hy = groundY - 120;

            if (hy < 20) hy = 20;
            if (hx < 20) hx = 20;

            if (hExhaust) ctx.drawImage(hExhaust, hx, hy, 150, 150);
        }
    }

    drawDustParticles(ctx) {
        if (this.dustParticles && this.dustParticles.length > 0) {
            ctx.fillStyle = 'rgba(200, 180, 150, 0.6)';
            this.dustParticles.forEach(d => {
                ctx.globalAlpha = d.alpha;
                ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, Math.PI*2); ctx.fill();
                d.x += d.vx * 0.016; d.y += d.vy * 0.016; d.alpha -= 0.02;
            });
            this.dustParticles = this.dustParticles.filter(d => d.alpha > 0);
            ctx.globalAlpha = 1.0;
        }
    }

    drawIceAxe(ctx) {
        if (this.activeTool) {
            const axeImg = this.assetManager.get('g14_ice_axe');
            if (axeImg) {
                ctx.save();
                ctx.translate(this.activeTool.x, this.activeTool.y);
                
                // Scale up while dragging OR chopping
                if (this.activeTool.isDragging || this.phase === 'CHOPPING') {
                    ctx.scale(1.2, 1.2); 
                    
                    if (this.phase === 'CHOPPING') {
                        // Rapid chopping motion using a sine wave based on current time
                        // Fluctuates between -0.9 (winding back) and +0.3 (striking down)
                        const chopAngle = -0.3 + Math.sin(Date.now() / 50) * 0.6;
                        ctx.rotate(chopAngle);
                    } else {
                        // Default static rotation while dragging
                        ctx.rotate(-0.5); 
                    }
                }
                
                ctx.shadowColor = 'rgba(255, 0, 255, 0.9)'; 
                ctx.shadowBlur = 25; 
                ctx.drawImage(axeImg, -40, -40, 80, 80);
                ctx.restore();
            }
        }
    }

    drawChalkboardViewport(ctx, midPointY, bx) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, midPointY, this.SAFE_WIDTH, this.SAFE_HEIGHT - midPointY);
        ctx.clip(); 

        const boardBg = this.assetManager.get('g14_bg_chalkboard');
        if (boardBg) ctx.drawImage(boardBg, 0, midPointY, this.SAFE_WIDTH, this.SAFE_HEIGHT - midPointY);
        else { ctx.fillStyle = '#2F4F4F'; ctx.fillRect(0, midPointY, this.SAFE_WIDTH, this.SAFE_HEIGHT - midPointY); }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(50, midPointY + 20); ctx.lineTo(50, this.SAFE_HEIGHT - 20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(50, this.SAFE_HEIGHT - 20); ctx.lineTo(this.SAFE_WIDTH - 20, this.SAFE_HEIGHT - 20); ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 18px "Comic Sans MS", sans-serif';
        ctx.fillText("Potential Energy", 60, midPointY + 40);
        ctx.fillText("Reaction Progress →", this.SAFE_WIDTH - 250, this.SAFE_HEIGHT - 30);

        ctx.beginPath();
        ctx.moveTo(0, this.getChalkY(0));
        for (let i = 1; i < this.curvePoints.length; i++) {
            const p = this.curvePoints[i];
            ctx.lineTo(p.x, this.getChalkY(p.x));
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(255,255,255,0.5)'; ctx.shadowBlur = 8;
        ctx.stroke();

        if (this.phase === 'INSPECT' || this.phase === 'ACTIVATION') {
            ctx.strokeStyle = 'rgba(255, 235, 59, 1)'; 
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(450, this.getChalkY(450)); 
            ctx.quadraticCurveTo(485, this.getChalkY(485) - 20, 520, this.getChalkY(520)); 
            ctx.stroke();
            
            ctx.fillStyle = '#FFEB3B';
            ctx.fillText("Activation Energy!", 430, this.getChalkY(485) - 40);
        }

        const dotX = bx;
        const dotY = this.getChalkY(bx);
        ctx.beginPath();
        ctx.arc(dotX, dotY, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#00FFFF'; 
        ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 20;
        ctx.fill();

        if (this.chalkParticles && this.chalkParticles.length > 0) {
            this.chalkParticles.forEach(p => {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life;
                ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
            });
            ctx.globalAlpha = 1.0;
        }

        ctx.restore(); 
    }

    drawGlobalOverlays(ctx) {
        if (this.dialogueShowing) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }
    }

    // ==========================================
    // QUIZ FINALE
    // ==========================================

    startQuiz() {
        if (this.canvas) this.canvas.style.cursor = 'default';
        this.stop();
        this.showDialogue(
            "Astounding! The tiny input of Activation Energy caused a massive, spontaneous Exothermic release! Did you see how it plummeted to a lower energy state?",
            "calculus", {
                animate: true, disableTypewriter: true, comicTransition: true,
                onClose: () => this.launchQuiz()
            });
    }

    launchQuiz() {
        const questions = this.lvl.questions;
        this.runQuizSequence(questions, 0);
    }

    runQuizSequence(questions, qIndex) {
        if (qIndex >= questions.length) {
            this.win();
            return;
        }

        const qData = questions[qIndex];
        const mappedOptions = qData.options.map(opt => ({
            text: opt.label,
            correct: (opt.id === qData.correctAnswerId),
            onSelect: (isCorrect) => {
                if (isCorrect) {
                    this.triggerHaptic(20);
                    this.runQuizSequence(questions, qIndex + 1);
                } else {
                    this.triggerHaptic(50);
                }
            }
        }));

        const bgImgAsset = this.assetManager.get('ui_journal_bg');
        this.quizUI.show(mappedOptions, bgImgAsset?.src, { keepOpenOnWrong: true });

        if (this.quizUI.overlayElement) {
            const qTitle = document.createElement('h2');
            qTitle.innerText = qData.text;
            qTitle.className = 'quiz-header';
            this.quizUI.overlayElement.insertBefore(qTitle, this.quizUI.overlayElement.firstChild);
        }
    }

    destroy() {
        if (this.styleElement) this.styleElement.remove();
        if (this.canvas) this.canvas.style.cursor = 'default';
        if (this.quizUI) this.quizUI.remove();
        super.destroy();
    }
}
