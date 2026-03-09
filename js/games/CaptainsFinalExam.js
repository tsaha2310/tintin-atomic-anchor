/* =========================================
   js/games/CaptainsFinalExam.js
   Archetype: Interactive Particle Lab
   Mechanics: Scanning (Hold-to-view) & Variable Slider
   ========================================= */

import { Game } from '../Game.js';
import { ParticleSystem } from '../components/ParticleSystem.js';
import { Slider } from '../components/Slider.js';

export class CaptainsFinalExam extends Game {

    async init() {
        this.lay = this.tuning.layout;
        this.enableSmartRendering = true; // Optimize battery

        // --- STATE MANAGEMENT ---
        this.phase = 'INTRO'; // INTRO, Q1_SCAN, TRANSITION, Q2_SLIDER, WIN
        
        // Components replacing manual arrays/vars
        this.particleSys = new ParticleSystem(this.assetManager);
        this.slider = null;

        this.targets = []; // The Ice, Water, Steam objects
        
        // Q1 Specifics
        this.activeTarget = null; // Which item is currently being scanned
        
        // Q2 Specifics
        // 0 (Solid) to 100 (Gas) tracking is now managed by this.slider.value
        this.freezeTimer = 0; // Time held in frozen state

        // --- ASSETS ---
        // We rely on the AssetManager's greybox fallback if files are missing
        await this.preload([
            'g09_lab_bg',
            'g09_icon_ice', 'g09_icon_water', 'g09_icon_steam',
            'ui_slider_track', 'ui_slider_thumb'
        ]);

        // --- START SEQUENCE ---
        this.showDialogue(
            "Right then! Let's test your eyes. I've got Ice, Water, and Steam here.<br><br>Use the <b>Atomic Scanner</b> (Click & Hold) to see inside them. Find the one moving the <b>FASTEST</b>!",
            "haddock",
            {
                animate: true, comicTransition: true,
                onClose: () => this.startQ1()
            }
        );
    }

    /* =========================================
       PHASE 1: THE ATOMIC RACE
       ========================================= */
    
    startQ1() {
        this.phase = 'Q1_SCAN';
        const y = this.SAFE_HEIGHT / 2;
        const gap = 250;
        const cx = this.SAFE_WIDTH / 2;
        let x = cx - gap;

        this.targets = [];
        this.tuning.targets.forEach( t => {
            this.targets.push( {
                id: t.id, 
                x: x,
                y: this.SAFE_HEIGHT / 2, 
                r: 80,
                speed: t.speed,
                label: t.label,
                color: t.color
            } );
            x += gap;
        } );

        this.enableHUD("HOLD items to Scan. DOUBLE CLICK to Select.", false);
        this.triggerRefresh();
    }

    initParticlesForTarget(target) {
        this.particleSys.clear();
        const count = this.tuning.particleCount || 20;
        
        for(let i=0; i<count; i++) {
            // Random start position within circle
            const ang = Math.random() * Math.PI * 2;
            const rad = Math.random() * (target.r - 10);
            
            this.particleSys.particles.push({
                x: target.x + Math.cos(ang) * rad,
                y: target.y + Math.sin(ang) * rad,
                // Base velocity matches the target's physical state
                vx: (Math.random() - 0.5) * target.speed,
                vy: (Math.random() - 0.5) * target.speed,
                // Origin for crystal locking (Ice logic)
                gridX: target.x + ((i % 5) - 2) * 20, 
                gridY: target.y + (Math.floor(i / 5) - 2) * 20,
                color: target.color,
                life: 999, maxLife: 999, scale: 1.0,
                onUpdate: (p, dt) => {
                    // PHYSICS:
                    // If Ice: Jitter around grid point
                    if (target.id === 'ICE') {
                        p.x = p.gridX + (Math.random()-0.5) * 2;
                        p.y = p.gridY + (Math.random()-0.5) * 2;
                    } 
                    // If Water/Steam: Move freely
                    else {
                        p.x += p.vx;
                        p.y += p.vy;

                        // Bounce off circle walls
                        const dx = p.x - target.x;
                        const dy = p.y - target.y;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        
                        if (dist > target.r - 5) {
                            // Simple reflection vector math
                            const nx = dx / dist;
                            const ny = dy / dist;
                            const dot = p.vx * nx + p.vy * ny;
                            p.vx -= 2 * dot * nx;
                            p.vy -= 2 * dot * ny;
                            
                            // Push back inside
                            p.x -= nx * 2;
                            p.y -= ny * 2;
                        }
                    }
                }
            });
        }
    }

    updateQ1(dt) {
        // Only animate if user is holding down on a target
        if (this.activeTarget) {
            this.triggerRefresh(); // Keep rendering loop alive
            this.particleSys.update(dt);
        }
    }

    handleQ1Input(type, x, y) {
        // Hit Test Targets
        const hit = this.targets.find(t => Math.hypot(x - t.x, y - t.y) < t.r);

        if (type === 'DOWN') {
            if (hit) {
                this.activeTarget = hit;
                this.initParticlesForTarget(hit);
                this.triggerHaptic(20);
            }
        } else if (type === 'UP') {
            this.activeTarget = null;
            this.particleSys.clear(); // Clear particles to save draw calls
            this.triggerRefresh();
        } else if (type === 'DOUBLE_CLICK') {
            if (hit) this.checkAnswerQ1(hit);
        }
    }

    checkAnswerQ1(target) {
        if (target.id === 'STEAM') {
            this.triggerHaptic(50);
            this.showDialogue(
                "Correct! Gas particles have the most energy and move the fastest. That's why steam expands!", 
                "tintin", 
                { onClose: () => this.startQ2(), animate: true, disableTypewriter: true }
            );
        } else {
            this.triggerHaptic(100);
            this.showDialogue(
                `Not quite. ${target.label} particles are slower. Look for the one moving wildly!`, 
                "haddock",
                { animate: true, disableTypewriter: true }
            );
        }
    }

    /* =========================================
       PHASE 2: THE ENERGY REGULATOR
       ========================================= */

    startQ2() {
        this.phase = 'Q2_SLIDER';
        this.particleSys.clear();
        this.targets = []; // Clear old UI
        
        // Initialize the new Slider Component
        this.slider = new Slider({
            x: this.SAFE_WIDTH - 150 - 40, // Centered alignment adjustment
            y: this.lay.slider?.y || 200,
            w: 80,
            h: this.lay.slider?.h || 400,
            yStart: this.lay.slider?.yStart,
            yEnd: this.lay.slider?.yEnd,
            value: 0.6, // Start as Liquid (60%)
            trackAsset: 'ui_slider_track',
            thumbAsset: 'ui_slider_thumb',
            assetManager: this.assetManager,
            isVertical: true
        });

        // Create a central beaker of particles
        const cx = this.SAFE_WIDTH / 2 - 100;
        const cy = this.SAFE_HEIGHT / 2;
        
        for(let i=0; i<40; i++) {
            this.particleSys.particles.push({
                x: cx, y: cy,
                vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5,
                gridX: cx + ((i % 6) - 2.5) * 25, // Crystal structure position
                gridY: cy + (Math.floor(i / 6) - 3) * 25,
                color: '#2196F3',
                life: 999, maxLife: 999, scale: 1.0,
                onUpdate: (p, dt) => {
                    // 1. SLIDER LOGIC (Lerp particles based on energy)
                    const energyLevel = this.slider.value * 100;
                    const speedMult = energyLevel / 20; // 0.0 to 5.0
                    
                    let isSolid = false;
                    if (energyLevel < 15) isSolid = true;

                    if (isSolid) {
                        // CRYSTALLIZATION LOGIC
                        // Move towards gridX/gridY (Lerp)
                        p.x += (p.gridX - p.x) * 0.1;
                        p.y += (p.gridY - p.y) * 0.1;
                        
                        // Add tiny vibration
                        p.x += (Math.random()-0.5);
                        p.y += (Math.random()-0.5);
                        
                        p.color = '#A5F2F3'; // Ice Color
                    } else {
                        // CHAOS LOGIC
                        p.x += p.vx * speedMult * dt * 60; // Normalize to 60fps
                        p.y += p.vy * speedMult * dt * 60;
                        
                        // Contain in box
                        const bounds = { x: 200, y: 200, w: 400, h: 400 };
                        if (p.x < bounds.x || p.x > bounds.x + bounds.w) p.vx *= -1;
                        if (p.y < bounds.y || p.y > bounds.y + bounds.h) p.vy *= -1;
                        
                        p.color = energyLevel > 80 ? '#ECEFF1' : '#2196F3'; // Steam vs Water
                    }
                }
            });
        }

        this.showDialogue(
            "Now, Question 2: If I want to turn this Liquid into a solid block of Ice, what do I do to the <b>ENERGY</b>?<br><br><i>(Drag the Energy Lever on the right)</i>", 
            "haddock",
            { animate: true }
        );
        this.enableHUD("Drag Slider DOWN to Remove Energy", false);
    }

    updateQ2(dt) {
        this.triggerRefresh();
        
        // Delegate physics to particle system component
        this.particleSys.update(dt);

        // 2. WIN CONDITION
        const energyLevel = this.slider.value * 100;
        if (energyLevel < 15) {
            this.freezeTimer += dt;
            if (this.freezeTimer > 1.5) {
                this.phase = 'WIN';
                this.winSequence();
            }
        } else {
            this.freezeTimer = 0;
        }
    }

    handleQ2Input(type, x, y) {
        // Delegate input to the Slider component
        if (this.slider) {
            this.slider.handleInput(type, x, y);
        }
    }

    winSequence() {
        this.showDialogue(
            "Exactly! You removed the heat energy, slowing the atoms down until they locked together. Solid as a rock!", 
            "calculus",
            {
                onClose: () => this.win(),
                animate: true, disableTypewriter: true
            }
        );
    }

    /* =========================================
       CORE OVERRIDES
       ========================================= */

    onPointerDown(e) {
        super.onPointerDown(e);
        // Double click detection
        const now = Date.now();
        if (now - this.lastClickTime < 300) {
            this.handleInput('DOUBLE_CLICK', this.input.x, this.input.y);
        } else {
            // Route to specific phase handler
            this.handleInput('DOWN', this.input.x, this.input.y);
        }
        this.lastClickTime = now;
    }

    onPointerMove(e) {
        super.onPointerMove(e);
        this.handleInput('MOVE', this.input.x, this.input.y);
    }

    onPointerUp(e) {
        super.onPointerUp(e);
        this.handleInput('UP', this.input.x, this.input.y);
    }

    handleInput(type, x, y) {
        if (this.phase === 'Q1_SCAN') this.handleQ1Input(type, x, y);
        if (this.phase === 'Q2_SLIDER') this.handleQ2Input(type, x, y);
    }

    update(dt) {
        super.update(dt); // Handles timers
        if (this.phase === 'Q1_SCAN') this.updateQ1(dt);
        if (this.phase === 'Q2_SLIDER') this.updateQ2(dt);
    }

    draw(ctx) {
        // 1. Background
        const bg = this.assetManager.get('g09_lab_bg');
        if (bg) {
            ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        } else {
            // Fallback: Dark Lab Grey
            ctx.fillStyle = '#263238';
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }

        // Dark Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        // =========================================
        // DRAW PHASE 1: SCANNER (The Items)
        // =========================================
        if (this.phase === 'Q1_SCAN') {
            this.targets.forEach(t => {
                // A. Draw The Icon (Ice, Water, or Steam)
                // We map ID to the asset keys defined in assets.json
                let iconKey = null;
                if (t.id === 'ICE') iconKey = 'g09_icon_ice';
                else if (t.id === 'WATER') iconKey = 'g09_icon_water';
                else if (t.id === 'STEAM') iconKey = 'g09_icon_steam';

                const icon = this.assetManager.get(iconKey);

                ctx.save();
                ctx.translate(t.x, t.y);

                if (icon) {
                    // Draw Icon centered (Asset size is 200x200, we scale it to fit target radius)
                    const drawSize = t.r * 2.2; // Slightly larger than hitbox
                    ctx.drawImage(icon, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
                } else {
                    // Fallback: Simple Circle
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.beginPath(); ctx.arc(0, 0, t.r, 0, Math.PI * 2); ctx.fill();
                }

                // B. Draw "Scanning" Highlight
                if (this.activeTarget === t) {
                    ctx.strokeStyle = '#00E5FF';
                    ctx.lineWidth = 5;
                    ctx.beginPath(); ctx.arc(0, 0, t.r + 10, 0, Math.PI * 2); ctx.stroke();
                    
                    // "Scanning..." Text
                    ctx.fillStyle = '#00E5FF';
                    ctx.font = "bold 14px Arial";
                    ctx.fillText("SCANNING...", 0, -t.r - 20);
                }

                // C. Label
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.font = "bold 20px Arial";
                ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
                ctx.fillText(t.label, 0, t.r + 35);
                ctx.shadowBlur = 0;

                ctx.restore();
            });
        }

        // =========================================
        // DRAW PHASE 2: REGULATOR (Slider & Beaker)
        // =========================================
        if (this.phase === 'Q2_SLIDER' || this.phase === 'WIN') {
            
            // --- A. The Slider UI ---
            const tx = this.SAFE_WIDTH - 150;
            const ty = this.lay.slider.y;
            const ts = this.lay.slider.yStart;
            const te = this.lay.slider.yEnd;

            // 1. Draw the Gradient (The "Liquid Level" inside)
            // We draw this *first* so the frame sits on top
            const grad = ctx.createLinearGradient(0, ty + ts, 0, ty + te);
            grad.addColorStop(0, '#FF5252'); // Hot (Top)
            grad.addColorStop(1, '#448AFF'); // Cold (Bottom)
            
            ctx.fillStyle = grad;
            // Draw a narrow strip for the "liquid" inside the track
            ctx.fillRect(tx - 10, ty + ts, 20, te - ts);

            // 2 & 3. Draw The Frame Asset & The Thumb (Knob)
            this.slider.draw(ctx);
            
            // Labels
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = "bold 16px Arial";
            ctx.fillText("ENERGY", tx, ty - 25);
            ctx.fillText(Math.floor(this.slider.value * 100) + "%", tx, ty - 10);
            
            
            // --- B. The Particle Beaker Container (Visual Only) ---
            // Draw a faint box where particles are contained
            const bx = 200; // From update logic
            const by = 200;
            const bw = 400;
            const bh = 400;
            
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, by, bw, bh);
        }

        // =========================================
        // DRAW PARTICLES (Shared Layer)
        // =========================================
        // Drawn last so they appear on top of everything
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 10;
        
        this.particleSys.draw(ctx);
        
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    }
}
