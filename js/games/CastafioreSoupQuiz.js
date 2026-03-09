/* =========================================
   js/games/CastafioreSoupQuiz.js
   Game 05: The Silver Puddle (Polished v5)
   Features: 
   - Z-Sorted Scooping Physics
   - Reordered Phases (Spoon -> Tea -> Melting)
   - "Hold-to-Heat" Mosh Pit Mechanic
   ========================================= */

import { LabGame } from '../middleware/LabGame.js';
import { QuizOverlay } from '../components/QuizOverlay.js';

export class CastafioreSoupQuiz extends LabGame {

    async init() {
        this.enableSmartRendering = true;
        this.phase = 'PHASE_1_SPOON'; 
        
        if (!this.tuning || !this.tuning.physics) {
            console.error("❌ Level Data Missing for CastafioreSoupQuiz!");
            return;
        }

        this.phys = this.tuning.physics;
        this.lay = this.tuning.layout;
        
        // State tracking
        this.particles = [];
        this.waterParticles = [];
        this.isMelted = false;
        this.isMixing = false;
        this.heatEnergy = 0;
        this.isHeating = false;
        this.isHoveringFluid = false;
        this.isPausedForQuiz = false;
        this.canSimmer = false;
        
        // Swipe tracking for Phase 1
        this.phase1Attempts = 0;
        this.isScooping = false;
        this.scoopStartY = 0;

        await this.preload([
            'g05_bg_pot_inside', 'g05_bg_diagram', 'g05_bg_teacup', 'ui_slotted_spoon',
            'g05_atom_silver', 'g05_atom_sugar', 'g05_atom_water',
            'ui_journal_bg' 
        ]);

        this.injectCSS();
        this.setupPhase1();
        this.triggerRefresh();
    }

    // ============================================================
    // 🎨 CSS INJECTION 
    // ============================================================
    injectCSS() {
        if (this.styleElement) this.styleElement.remove();
        this.styleElement = document.createElement('style');
        this.styleElement.innerHTML = `
            #game-ui-layer { perspective: 1000px; }
            
            /* --- Responsive Action Buttons --- */
            .action-button {
                position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
                padding: 12px 36px; font-size: 22px; font-family: "Comic Sans MS", sans-serif;
                font-weight: bold; color: white; border-radius: 50px; cursor: pointer; 
                transition: all 0.15s ease; z-index: 100; -webkit-tap-highlight-color: transparent;
                white-space: nowrap; /* CRITICAL: Prevents text from awkwardly wrapping into a giant box */
                text-align: center;
            }
            .btn-mix {
                background-color: #4CAF50; border: 4px solid #1B5E20; box-shadow: 0 6px 0 #1B5E20, 0 15px 20px rgba(0,0,0,0.4);
            }
            .btn-mix:hover { background-color: #66BB6A; transform: translateX(-50%) translateY(-2px); box-shadow: 0 8px 0 #1B5E20, 0 18px 25px rgba(0,0,0,0.4); }
            
            .btn-heat {
                background-color: #F44336; border: 4px solid #B71C1C; box-shadow: 0 6px 0 #B71C1C, 0 15px 20px rgba(0,0,0,0.4);
            }
            .btn-heat:hover { background-color: #EF5350; transform: translateX(-50%) translateY(-2px);  box-shadow: 0 8px 0 #B71C1C, 0 18px 25px rgba(0,0,0,0.4); }

            /* Smooth pressed state using transform */
            .btn-mix:active { transform: translateX(-50%) translateY(6px) !important; box-shadow: 0 0px 0 #1B5E20, 0 4px 8px rgba(0,0,0,0.5) !important; }
            /* Note: .btn-heat pressed state is managed via JS inline styles in setupPhase3 for robust hold-to-heat physics */
            
            /* --- Toast Notification --- */
            .toast-msg {
                position: absolute; top: 25%; left: 50%; transform: translateX(-50%);
                background: rgba(44, 30, 18, 0.9); color: #FFF; 
                padding: 12px 24px; border-radius: 8px; border: 2px solid #FBC02D;
                font-family: "Comic Sans MS", sans-serif; font-size: 18px; font-weight: bold;
                pointer-events: none; z-index: 1000; white-space: nowrap;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                opacity: 0; transition: opacity 0.3s ease;
            }
            .toast-show { opacity: 1; }

            .fade-in { animation: fadeIn 1s forwards; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

            /* Subtle pulse for the spoon when over liquid */
            @keyframes spoonPulse {
                0% { transform: scale(1); filter: brightness(1); }
                50% { transform: scale(1.05); filter: brightness(1.2); }
                100% { transform: scale(1); filter: brightness(1); }
            }

            /* Responsive tweaks to prevent massive buttons on mobile */
            @media (max-width: 768px), (max-height: 500px) {
                .action-button {
                    font-size: 16px;
                    padding: 10px 28px;
                    bottom: 20px;
                    border-width: 3px;
                }
                .btn-mix { box-shadow: 0 4px 0 #1B5E20, 0 10px 15px rgba(0,0,0,0.4); }
                .btn-heat { box-shadow: 0 4px 0 #B71C1C, 0 10px 15px rgba(0,0,0,0.4); }
                .btn-mix:active { transform: translateX(-50%) translateY(4px) !important; box-shadow: 0 0px 0 #1B5E20, 0 4px 8px rgba(0,0,0,0.4) !important; }
                .quiz-header { font-size: 16px; padding: 12px; margin-bottom: 12px; }
            }
            @media (max-height: 500px) and (orientation: landscape) {
                /* Mobile Landscape Quiz Tweak (Ultra Compact) */
                .quiz-header { font-size: 13px; padding: 6px; margin-bottom: 8px; }
            }

            /* --- Quiz related style tweaks --- */
            .quiz-overlay-themed h2 {
                background-color: rgba(255,255,255,0.85);
                padding: 15px; border-radius: 8px;
                margin-bottom: 20px; font-family: sans-serif; text-align: center;
            }
            .quiz-choice-btn {
                font-size: 16px !important; padding: 12px !important; margin: 5px 0 !important;
                flex-shrink: 0; 
            }
        `;
        document.head.appendChild(this.styleElement);
    }

    // ============================================================
    // 🖱️ INPUT ROUTING
    // ============================================================
    onPointerDown(e) {
        if (this.dialogueShowing && this.phase === 'PHASE_1_SPOON') {
            this.hideDialogue();
            return;
        }
        if (this.phase === 'PHASE_1_SPOON') {
            this.isScooping = true;
            this.scoopStartY = this.input.y;
        } 
    }

    onPointerUp(e) {
        if (this.phase === 'PHASE_1_SPOON' && this.isScooping) {
            this.isScooping = false;
            // Detect sufficient upward swipe
            if (this.input.y < this.scoopStartY - 120) {
                this.phase1Attempts++;
                if (this.phase1Attempts >= 3) {
                    this.triggerPhase1End();
                } else {
                    this.showToast("Didn't work, try scooping again!");
                }
            } else if (this.input.y < this.scoopStartY - 20) {
                // Failed attempt feedback
                this.triggerHaptic(50);
                this.particles.forEach(p => p.vy -= 50); 
                
                this.showToast("Faster! Try scooping it upwards!");
            }
        }
    }

    // ============================================================
    // 🎬 PHASE 1: THE SPOON
    // ============================================================
    setupPhase1() {
        this.phase = 'PHASE_1_SPOON';
        this.particles = [];

        // Clear Previous UI Safely
        this.clearDynamicUI();

        this.hideSpoon = false;
        if (this.canvas) this.canvas.style.cursor = 'none';

        for (let i = 0; i < 70; i++) {
            this.particles.push({
                x: (this.SAFE_WIDTH / 2) + (Math.random() - 0.5) * 350,
                baseY: this.SAFE_HEIGHT - 160 + (Math.random() - 0.5) * 30,
                y: this.SAFE_HEIGHT - 160 + (Math.random() - 0.5) * 30,
                vx: 0, vy: 0, 
                size: 60 + Math.random() * 40,
                isAirborne: false // Z-Index flag
            });
        }

        this.showDialogue("It's slipping away! Like trying to catch a ghost with a net! Tintin, do something!", 
            "haddock", { animate: true, comicTransition: true, onClose: () => {
                this.showDialogue("Try to scoop the puddle with the slotted spoon!", "tintin", { 
                    disableTypewriter: true,
                    onClose: () => { this.canSimmer = true; }
                });
            }
        });
    }

    // ============================================================
    // 🔔 UI FEEDBACK
    // ============================================================
    showToast(msg) {
        // Prevent spamming multiple toasts
        const existing = this.uiRoot.querySelector('.toast-msg');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-msg toast-show';
        toast.innerText = msg;
        this.uiRoot.appendChild(toast);
        
        // Remove after 2 seconds
        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => toast.remove(), 300); // Wait for fade-out
        }, 2000);
    }

    // ============================================================
    // 🌉 TRANSITION: SPOON -> TEACUP
    // ============================================================
    triggerPhase1End() {
        this.isScooping = false;
        this.phase1Attempts = 0; // Prevent re-triggering

        // Tell the draw loop to stop rendering the custom cursor
        this.hideSpoon = true;
        if (this.canvas) this.canvas.style.cursor = 'default';
        this.triggerRefresh();
        
        this.showDialogue("It's no use, Captain! The heat turned the solid rock into a liquid. Its particles are sliding past each other, flowing right through the holes!", 
            "tintin", { animate: true, comicTransition: true, onClose: () => {
                this.setupPhase2();
            }
        });
    }

    // ============================================================
    // 🎬 PHASE 2: THE TEACUP (Mix Tea)
    // ============================================================
    setupPhase2() {
        this.phase = 'PHASE_2_TEACUP';
        this.particles = [];
        this.waterParticles = [];
        this.isMixing = false;
        if (this.canvas) this.canvas.style.cursor = 'default';
        
        // Clear Previous UI Safely
        this.clearDynamicUI();

        const bounds = this.lay.teacupBounds || { x: 250, y: 300, w: 524, h: 350 };
        
        // Setup Sugar Cube 
        const startX = (bounds.x + bounds.w / 2) - ((4 - 1) * this.lay.gridSpacing) / 2;
        const startY = (bounds.y + bounds.h / 2) - ((4 - 1) * this.lay.gridSpacing) / 2;
        
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                this.particles.push({
                    x: startX + c * this.lay.gridSpacing, y: startY + r * this.lay.gridSpacing,
                    baseX: startX + c * this.lay.gridSpacing, baseY: startY + r * this.lay.gridSpacing,
                    vx: 0, vy: 0, assetId: 'g05_atom_sugar', type: 'sugar', isDissolved: false
                });
            }
        }

        // Setup Water Molecules
        for (let i = 0; i < 35; i++) {
            this.waterParticles.push({
                x: bounds.x + 20 + Math.random() * (bounds.w - 40), 
                y: bounds.y + 20 + Math.random() * (bounds.h - 40),
                vx: (Math.random() - 0.5) * this.phys.waterSpeed, 
                vy: (Math.random() - 0.5) * this.phys.waterSpeed,
                assetId: 'g05_atom_water'
            });
        }

        // Castafiore speaks first, THEN we reveal the interactive button
        this.showDialogue("What is all this fuss? And why is your rock just sitting there in a puddle? When I put sugar in my tea, it completely vanishes!", 
            "castafiore", { animate: true, comicTransition: true, onClose: () => {
                
                // Inject and bind the button after she finishes speaking
                this.uiRoot.insertAdjacentHTML('beforeend', `<button class="action-button btn-mix fade-in" id="mixBtn">MIX TEA</button>`);
                
                document.getElementById('mixBtn').addEventListener('click', () => {
                    this.isMixing = true;
                    this.triggerHaptic(50);
                    document.getElementById('mixBtn').style.display = 'none';
                    this.hideDialogue();
                });
            }
        });
        
        this.triggerRefresh();
    }

    // ============================================================
    // 🎬 PHASE 3: THE CONCERT ANALOGY (Melting)
    // ============================================================
    setupPhase3() {
        this.phase = 'PHASE_3_DIAGRAM';
        this.particles = [];
        this.heatEnergy = 0;
        this.isMelted = false;
        
        // Clear Previous UI Safely
        this.clearDynamicUI();

        const startX = this.SAFE_WIDTH / 2 - ((this.lay.gridCols - 1) * this.lay.gridSpacing) / 2;
        const startY = this.SAFE_HEIGHT / 2 - ((this.lay.gridRows - 1) * this.lay.gridSpacing) / 2;

        for (let r = 0; r < this.lay.gridRows; r++) {
            for (let c = 0; c < this.lay.gridCols; c++) {
                this.particles.push({
                    id: `silver_${r}_${c}`,
                    baseX: startX + c * this.lay.gridSpacing, baseY: startY + r * this.lay.gridSpacing,
                    x: startX + c * this.lay.gridSpacing, y: startY + r * this.lay.gridSpacing,
                    vx: 0, vy: 0, col: c, row: r,
                    assetId: 'g05_atom_silver', phase: Math.random() * Math.PI * 2 
                });
            }
        }

        // --- Sequence the Comic Dialogue ---
        this.showDialogue("Sugar dissolves because water mixes with it. The Zlatanium just melted! The atoms are locked in a 'Mosh Pit'.", "calculus", { 
            animate: true, 
            onClose: () => {
                this.showDialogue("To be precise, Professor, what exactly is a 'Mosh Pit'? Is it a type of fruit?", "thomson", { 
                    animate: true, 
                    comicTransition: true,
                    onClose: () => {
                        this.showDialogue("Oh, you sheltered detectives! At loud rock concerts, fans link arms and jump tightly packed together! They have immense energy, but cannot walk away from their spot!", "castafiore", {
                            animate: true,
                            comicTransition: true,
                            onClose: () => {
                                this.showDialogue("Exactly! <b>Hold the Heat button</b> to pump the atoms with energy. Let's see what happens when the music gets too hot!", "calculus", {
                                    animate: true,
                                    comicTransition: true,
                                    onClose: () => {
                                        // NOW inject and bind the button
                                        this.insertHeatButton();
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    }

    insertHeatButton() {
        this.uiRoot.insertAdjacentHTML('beforeend', `<button class="action-button btn-heat fade-in" id="heatBtn">🔥 HOLD TO HEAT</button>`);
        this.bindHeatButton(); // Call the helper method below
        this.hideDialogue();
    }


    bindHeatButton() {
        // Robust Hold-to-Heat Event Listeners
        const heatBtn = document.getElementById('heatBtn');
        
        const startHeat = (e) => { 
            e.preventDefault(); 
            this.isHeating = true; 
            heatBtn.innerHTML = "🔥 HEATING..."; // Visual feedback
            // Match the CSS translation for the pressed state
            heatBtn.style.transform = "translateX(-50%) translateY(6px)"; 
            heatBtn.style.boxShadow = "0 0px 0 #B71C1C, 0 4px 8px rgba(0,0,0,0.5)";
            this.hideDialogue();
        };
        
        const stopHeat = (e) => { 
            this.isHeating = false; 
            if (heatBtn) {
                heatBtn.innerHTML = "🔥 HOLD TO HEAT";
                // Clear inline styles so CSS hover/default states take over again
                heatBtn.style.transform = "";
                heatBtn.style.boxShadow = "";
            }
        };
        
        heatBtn.addEventListener('mousedown', startHeat);
        heatBtn.addEventListener('touchstart', startHeat, { passive: false });
        
        // Bind the release events to the WINDOW, so if the user's finger 
        // slides off the button while holding, it still properly stops heating.
        window.addEventListener('mouseup', stopHeat);
        window.addEventListener('touchend', stopHeat);
        heatBtn.addEventListener('touchcancel', stopHeat);
    }

    triggerMelting() {
        this.isMelted = true;
        this.triggerHaptic(200);
        document.getElementById('heatBtn').style.display = 'none';

        this.particles.forEach(p => {
            p.vx = (Math.random() - 0.5) * this.phys.atomSpeed * 2;
            p.vy = (Math.random() - 0.5) * this.phys.atomSpeed * 2;
        });

        this.showDialogue("When the energy is too high, they let go and slide past each other! That is a physical state change!", 
            "tintin", { animate: true, disableTypewriter: true, onClose: () => {
                // 5. PERFORMANCE: Pause canvas rendering before quiz starts
                this.isPausedForQuiz = true; 
                this.launchQuizOverlay(0);
            }
        });
    }

    // ============================================================
    // ⚙️ UPDATE LOOP 
    // ============================================================
    update(dt) {
        // 5. PERFORMANCE: Stop updating if quiz is active
        if (this.isPausedForQuiz) return;

        let needsRefresh = false;
        const safeDt = Math.min(dt, 0.05);
        const time = performance.now() / 1000; // For idle animations

        if (this.phase === 'PHASE_1_SPOON') {
            const spoonX = this.input.x;
            const spoonY = this.input.y;
            const spoonRadius = 90; 
            const swipeVelocityY = (this.input.y - this.lastInputY) / safeDt;
            
            // 3. Hover Detection: Check if spoon is generally over the puddle area (bottom third)
            this.isHoveringFluid = !this.isScooping && spoonY > this.SAFE_HEIGHT - 200;

            this.particles.forEach((p, i) => {
                // 2. Idle "Simmering" Animation for ground particles
                if (this.canSimmer && !p.isAirborne) {
                    // Use index 'i' to desynchronize the movement
                    p.x += Math.sin(time * 3 + i) * 0.3; 
                    p.y += Math.cos(time * 4 + i) * 0.2; 
                    needsRefresh = true;
                }

                // Gravity & Physics
                if (p.y < p.baseY) {
                    p.vy += 1200 * safeDt; 
                    needsRefresh = true; // Keep loop awake while falling!
                }
                p.x += p.vx * safeDt; p.y += p.vy * safeDt;
                p.vx *= 0.90; p.vy *= 0.95;
                
                // Land back in puddle
                if (p.y >= p.baseY) { 
                    p.y = p.baseY; p.vy = 0; 
                    p.isAirborne = false; 
                } else {
                    needsRefresh = true; // Keep loop awake if airborne
                }

                // Lift logic
                if (this.isScooping && swipeVelocityY < -100) {
                    const dx = p.x - spoonX; const dy = p.y - spoonY;
                    if (Math.sqrt(dx*dx + dy*dy) < spoonRadius) {
                        p.vy = swipeVelocityY * 0.8; 
                        p.vx = (Math.random() - 0.5) * 300; 
                        p.isAirborne = true; 
                        needsRefresh = true;
                    }
                }
            });
            if (this.input.x !== this.lastInputX || this.input.y !== this.lastInputY) {
                needsRefresh = true;
                this.lastInputX = this.input.x;
                this.lastInputY = this.input.y;
            }
        } 
        
        else if (this.phase === 'PHASE_2_TEACUP') {
            // ... (Phase 2 update logic remains exactly the same as v5)
            needsRefresh = true;
            const bounds = this.lay.teacupBounds || { x: 250, y: 300, w: 524, h: 350 };
            const margin = 20;
            this.waterParticles.forEach(w => {
                w.x += w.vx * safeDt; w.y += w.vy * safeDt;
                if (w.x < bounds.x + margin) { w.x = bounds.x + margin; w.vx *= -1; }
                if (w.x > bounds.x + bounds.w - margin) { w.x = bounds.x + bounds.w - margin; w.vx *= -1; }
                if (w.y < bounds.y + margin) { w.y = bounds.y + margin; w.vy *= -1; }
                if (w.y > bounds.y + bounds.h - margin) { w.y = bounds.y + bounds.h - margin; w.vy *= -1; }
                if (this.isMixing) {
                    this.particles.forEach(p => {
                        if (p.type === 'sugar' && !p.isDissolved) {
                            const dx = w.x - p.x; const dy = w.y - p.y;
                            if (dx*dx + dy*dy < 1600) { p.isDissolved = true; p.vx = w.vx * 0.8; p.vy = w.vy * 0.8; }
                        }
                    });
                }
            });
            let allSugarDissolved = true;
            this.particles.forEach(p => {
                if (p.isDissolved) {
                    p.x += p.vx * safeDt; p.y += p.vy * safeDt;
                    if (p.x < bounds.x + margin) { p.x = bounds.x + margin; p.vx *= -1; }
                    if (p.x > bounds.x + bounds.w - margin) { p.x = bounds.x + bounds.w - margin; p.vx *= -1; }
                    if (p.y < bounds.y + margin) { p.y = bounds.y + margin; p.vy *= -1; }
                    if (p.y > bounds.y + bounds.h - margin) { p.y = bounds.y + bounds.h - margin; p.vy *= -1; }
                } else {
                    p.x = p.baseX + (Math.random()-0.5)*2; p.y = p.baseY + (Math.random()-0.5)*2;
                    allSugarDissolved = false;
                }
            });
            if (this.isMixing && allSugarDissolved && !this.quizStarted) {
                this.quizStarted = true;
                setTimeout(() => this.setupPhase3(), 2000);
            }
        }

        else if (this.phase === 'PHASE_3_DIAGRAM') {
            const time = performance.now() / 1000;
            // Handle Heat Pumping
            if (this.isHeating) {
                this.heatEnergy += safeDt * 0.8;
                // NEW: Continuous, subtle haptic rumble while heating
                if (Math.random() > 0.7) this.triggerHaptic(8); 
            } else {
                this.heatEnergy = Math.max(0, this.heatEnergy - safeDt * 0.4);
            }
            const vibAmp = this.phys.vibrationBase + (this.heatEnergy * this.phys.vibrationMax);
            const threshold = (this.phys.meltThreshold > 1) ? this.phys.meltThreshold / 100 : this.phys.meltThreshold;
            if (this.heatEnergy > threshold && !this.isMelted) this.triggerMelting();
            this.particles.forEach(p => {
                if (!this.isMelted) {
                    p.x = p.baseX + Math.sin(time * 20 + p.phase) * vibAmp;
                    p.y = p.baseY + Math.cos(time * 25 + p.phase) * vibAmp;
                    needsRefresh = true;
                } else {
                    p.x += p.vx * safeDt; p.y += p.vy * safeDt;
                    const bound = 200;
                    if (p.x < this.SAFE_WIDTH/2 - bound) { p.x = this.SAFE_WIDTH/2 - bound; p.vx *= -1; }
                    if (p.x > this.SAFE_WIDTH/2 + bound) { p.x = this.SAFE_WIDTH/2 + bound; p.vx *= -1; }
                    if (p.y < this.SAFE_HEIGHT/2 - bound) { p.y = this.SAFE_HEIGHT/2 - bound; p.vy *= -1; }
                    if (p.y > this.SAFE_HEIGHT/2 + bound) { p.y = this.SAFE_HEIGHT/2 + bound; p.vy *= -1; }
                    needsRefresh = true;
                }
            });
            if (this.isHeating) needsRefresh = true;
        }

        if (needsRefresh) this.triggerRefresh();
    }

    // ============================================================
    // 🖌️ RENDER LOOP
    // ============================================================
    
    // Helper to draw the procedural liquid style
   
    // 2. & 3. New Procedural Liquid Helper (Canvas Gradients)
    drawLiquidGroup(ctx, particlesArray) {
        if (particlesArray.length === 0) return;
        
        // Subtle color shift on hover
        const baseColor = this.isHoveringFluid ? '#B0BEC5' : '#90A4AE'; // Darker base
        const topColor = this.isHoveringFluid ? '#ECEFF1' : '#CFD8DC';  // Lighter top

        // Pass 1: Base layer (slightly larger outline)
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        // Draw slightly offset and larger for pseudo-depth
        particlesArray.forEach(p => { ctx.moveTo(p.x + p.size/2 + 2, p.y + 2); ctx.arc(p.x + 2, p.y + 2, p.size/2 + 2, 0, Math.PI*2); });
        ctx.fill();

        // Pass 2: Top layer (main body)
        ctx.fillStyle = topColor;
        ctx.beginPath();
        particlesArray.forEach(p => { ctx.moveTo(p.x + p.size/2, p.y); ctx.arc(p.x, p.y, p.size/2, 0, Math.PI*2); });
        ctx.fill();
    }

    draw(ctx) {
        if (this.phase === 'PHASE_1_SPOON') {
            const bg = this.assetManager.get('g05_bg_pot_inside');
            if (bg) ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

            const groundParticles = this.particles.filter(p => !p.isAirborne);
            const airParticles = this.particles.filter(p => p.isAirborne);

            // Layer 1: Base Puddle (Procedural)
            this.drawLiquidGroup(ctx, groundParticles);

            // Layer 2: The Spoon
            const spoon = this.assetManager.get('ui_slotted_spoon');
            if (spoon && !this.hideSpoon) {
                ctx.save();
                // 1. Subtle feedback pulse on spoon when hovering actionable area
                if (this.isHoveringFluid) {
                   const scale = 1 + Math.sin(performance.now() / 200) * 0.03;
                   ctx.translate(this.input.x, this.input.y);
                   ctx.scale(scale, scale);
                   ctx.translate(-this.input.x, -this.input.y);
                }
                ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 8;
                ctx.drawImage(spoon, this.input.x - 90, this.input.y - 90, 180, 180);
                ctx.restore();
            }

            // Layer 3: Particles falling (Procedural)
            this.drawLiquidGroup(ctx, airParticles);
        }

        else if (this.phase === 'PHASE_2_TEACUP') {
            // ... (Phase 2 draw remains exactly the same as v5)
            const bg = this.assetManager.get('g05_bg_teacup');
            if (bg) ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
            this.waterParticles.forEach(w => this.drawSpriteCenter(ctx, w.assetId, w.x, w.y, 40));
            ctx.strokeStyle = '#999'; ctx.lineWidth = 3; ctx.beginPath();
            const sugarNodes = this.particles.filter(p => !p.isDissolved);
            sugarNodes.forEach((p, i) => {
                sugarNodes.forEach((other, j) => {
                    if (i < j) {
                        const dx = p.x - other.x; const dy = p.y - other.y;
                        if (dx*dx + dy*dy < 3000) { ctx.moveTo(p.x, p.y); ctx.lineTo(other.x, other.y); }
                    }
                });
            });
            ctx.stroke();
            this.particles.forEach(p => this.drawSpriteCenter(ctx, p.assetId, p.x, p.y, 48));
        }
        
        else if (this.phase === 'PHASE_3_DIAGRAM') {
            const bg = this.assetManager.get('g05_bg_diagram');
            if (bg) ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

            // 4. Heat Visual Effect (Subtle red glow over background)
            if (this.isHeating) {
                const centerX = this.SAFE_WIDTH / 2; const centerY = this.SAFE_HEIGHT / 2;
                const heatGrad = ctx.createRadialGradient(centerX, centerY, 100, centerX, centerY, 500);
                heatGrad.addColorStop(0, 'rgba(255, 87, 34, 0.3)'); // Faint reddish orange
                heatGrad.addColorStop(1, 'rgba(255, 87, 34, 0.0)');
                ctx.fillStyle = heatGrad;
                ctx.fillRect(0,0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
            }

            // ... (Rest of Phase 3 draw remains exactly the same as v5)
            if (!this.isMelted) {
                ctx.strokeStyle = `rgba(0, 0, 0, ${1 - this.heatEnergy})`; 
                ctx.lineWidth = 4;
                ctx.beginPath();
                this.particles.forEach(p => {
                    const rightNeighbor = this.particles.find(n => n.row === p.row && n.col === p.col + 1);
                    const downNeighbor = this.particles.find(n => n.row === p.row + 1 && n.col === p.col);
                    if (rightNeighbor) { ctx.moveTo(p.x, p.y); ctx.lineTo(rightNeighbor.x, rightNeighbor.y); }
                    if (downNeighbor) { ctx.moveTo(p.x, p.y); ctx.lineTo(downNeighbor.x, downNeighbor.y); }
                });
                ctx.stroke();
            }
            this.particles.forEach(p => this.drawSpriteCenter(ctx, p.assetId, p.x, p.y, 48));
        }

        if (this.dialogueShowing) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }
    }

    drawSpriteCenter(ctx, assetId, x, y, size) {
        const img = this.assetManager.get(assetId);
        if (img) {
            ctx.drawImage(img, x - size/2, y - size/2, size, size);
        } else {
            ctx.fillStyle = assetId.includes('water') ? '#2196F3' : '#FFFFFF';
            ctx.fillRect(x - size/2, y - size/2, size, size);
        }
    }

    // ============================================================
    // 🧠 THE CONCLUSION
    // ============================================================
    launchQuizOverlay(qIndex) {
        if (!this.quizUI) this.quizUI = new QuizOverlay(this.uiRoot, this.assetManager);
        
        // SAFE FETCH: Support different nested tuning structures
        const qArray = this.tuning.questions || this.tuning.level_1_kitchen?.questions || [];
        const qData = qArray[qIndex];

        if (!qData) {
            console.error("Quiz question not found at index", qIndex);
            this.win();
            return;
        }

        const mappedOptions = qData.options.map(opt => ({
            text: opt.label,
            correct: (opt.id === qData.correctAnswerId),
            onSelect: (isCorrect) => {
                if (isCorrect) {
                    this.triggerHaptic(20);
                    if (qIndex + 1 < qArray.length) {
                        this.launchQuizOverlay(qIndex + 1); 
                    } else {
                        this.win();
                    }
                } else {
                    this.triggerHaptic(50);
                }
            }
        }));

        const bgSrc = this.assetManager.get('ui_journal_bg')?.src || null;
        
        this.quizUI.show(mappedOptions, bgSrc, { keepOpenOnWrong: true });
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
        super.destroy();
    }
}
