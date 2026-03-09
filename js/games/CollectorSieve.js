/* =========================================
   js/games/CollectorSieve.js
   Game 01: The Collector's Sieve (Optimized & Polished)
   ========================================= */

import { LabGame } from '../middleware/LabGame.js';

export class CollectorSieve extends LabGame {

    async init() {
        this.enableSmartRendering = true;

        // 1. Initialize State
        this.particles = [];
        this.dustParticles = [];
        this.streakMarks = [];
        
        this.flags = {
            ironCleared: false,
            handSelectedOnce: false,
            tutorialForShiftingToHandNeeded: true,
            tutorialHandUseShown: false
        };
        
        this.lastInputX = 0;
        this.lastInputY = 0;

        // 2. Define Colors for Streak Tests and Particles
        this.colors = {
            rust: '#8B4513',      dust: '#D7CCC8',
            pyrite: '#2E3B32',    // Greenish-black streak
            gold: '#FBC02D',      // Yellow streak
            zlatanium: '#4CAF50'  // Green streak
        };

        // 3. Load Polished Ligne Claire Assets
        await this.preload([
            'g01_bg_wood_crate', 'g01_streak_plate', 'ui_icon_magnet', 'ui_icon_hand',
            'g01_junk_bolt', 'g01_junk_gear', 'g01_junk_tin_can',
            'g01_junk_glass_shard', 'g01_junk_ceramic_piece', 
            'ui_icon_hand_back', 'ui_icon_hand_fingers',
            'g01_item_zlatanium', 'g01_item_pyrite', 'g01_item_gold'
        ]);

        // 4. Map Assets dynamically to types
        this.assets = {
            crateBg: this.assetManager.get('g01_bg_wood_crate'),
            streakPlate: this.assetManager.get('g01_streak_plate'),
            magnet: this.assetManager.get('ui_icon_magnet'),
            hand: this.assetManager.get('ui_icon_hand'),
            hand_back: this.assetManager.get('ui_icon_hand_back'),
            hand_fingers: this.assetManager.get('ui_icon_hand_fingers')
        };

        // 5. Setup Tools
        this.setupToolbelt([
            { id: 'magnet', icon: '🧲', label: 'Magnet' },
            { id: 'hand',   icon: '🖐️', label: 'Hand' }
        ]);

        // 6. Level Setup
        this.draggedItem = null;
        this.zlataniumFound = 0;
        this.totalZlatanium = this.tuning.zlataniumCount || 3;
        this.enableHUD("Zlatanium Found");

        // 7. Zones
        this.streakPlate = { 
            x: this.SAFE_WIDTH - 220, 
            y: this.SAFE_HEIGHT - 180, 
            w: 180, h: 100 
        };

        // 8. Spawn Junk
        this.spawnJunk(this.tuning.debrisCount || 85);
        
        // 9. INTRO
        this.showDialogue("There's Zlatanium hidden under this junk! Use the <b>Magnet</b> to clear out the iron first.", 
            "haddock", { animate: true, comicTransition: true });
        
        this.triggerRefresh();
    }

    spawnJunk(count) {
        // PERFORMANCE: Cap junk count on older mobile phones
        const isMobile = window.innerWidth < 768;
        const actualCount = isMobile ? Math.min(count, 80) : count;

        // Spread across the full 1024x768 canvas, but avoid the streak plate area
        const randPos = () => {
            let px, py;
            do {
                px = 60 + Math.random() * (this.SAFE_WIDTH - 120);
                py = 60 + Math.random() * (this.SAFE_HEIGHT - 120);
            } while (px > this.streakPlate.x - 40 && py > this.streakPlate.y - 40);
            return { x: px, y: py };
        };

        // 1. Bottom Layer: Target (Zlatanium)
        for(let i=0; i<this.totalZlatanium; i++) {
            const p = randPos();
            this.particles.push({ id: `zlat_${i}`, type: 'zlatanium', assetId: 'g01_item_zlatanium', x: p.x, y: p.y, w: 40, h: 40, magnetic: false, vx: 0, vy: 0 });
        }

        // 2. Middle Layer: Decoys (Pyrite & Gold)
        for(let i=0; i<4; i++) {
            const p = randPos();
            this.particles.push({ id: `pyrite_${i}`, type: 'pyrite', assetId: 'g01_item_pyrite', x: p.x, y: p.y, w: 35, h: 35, magnetic: false, vx: 0, vy: 0 });
        }
        for(let i=0; i<2; i++) {
            const p = randPos();
            this.particles.push({ id: `gold_${i}`, type: 'gold', assetId: 'g01_item_gold', x: p.x, y: p.y, w: 35, h: 35, magnetic: false, vx: 0, vy: 0 });
        }

        // 3. Top Layer: Junk (Magnetic and Non-Magnetic)
        const magneticAssets = ['g01_junk_bolt', 'g01_junk_gear', 'g01_junk_tin_can'];
        const nonMagneticAssets = ['g01_junk_glass_shard', 'g01_junk_ceramic_piece'];

        for(let i=0; i<actualCount; i++) {
            const p = randPos();
            const isMagnetic = Math.random() > 0.3; // 70% of junk is magnetic
            const assetList = isMagnetic ? magneticAssets : nonMagneticAssets;
            const assetIndex = Math.floor(Math.random() * assetList.length);
            const assetId = assetList[assetIndex];

            // Override dimensions to avoid assets looking weird
            let pWidth = 30 + Math.random()*15;
            let pHeight = 30 + Math.random()*15;
            if (isMagnetic) {
                if (assetIndex == 0) { // g01_junk_bolt
                    pWidth = 55;
                    pHeight = 32;
                } else if (assetIndex == 2) { // g01_junk_tin_can
                    pWidth = 32;
                    pHeight = 45;
                }
            }
            
            this.particles.push({ 
                id: `junk_${i}`, type: isMagnetic ? 'iron' : 'glass', 
                assetId: assetId, x: p.x, y: p.y, w: pWidth, h: pHeight, 
                magnetic: isMagnetic, vx: 0, vy: 0, rotation: Math.random() * Math.PI * 2
            });
        }
        this.triggerRefresh();
    }

    onToolChange(toolId) {
        if (toolId === 'hand' && !this.flags.handSelectedOnce) {
            this.flags.handSelectedOnce = true;
            if (!this.flags.tutorialHandUseShown) {
                this.flags.tutorialHandUseShown = true;
                this.flags.tutorialForShiftingToHandNeeded = false;
                this.showDialogue("Now, drag the rocks over the <b>White Streak Plate</b>. If they leave a bright green mark, it's Zlatanium!", 
                    "tintin", { animate: true });
            }
        }
        
        // Hide native cursor when a custom tool is active
        if (this.canvas) {
            this.canvas.style.cursor = (toolId === 'magnet' || toolId === 'hand') ? 'none' : 'default';
        }
        this.triggerRefresh();
    }

    update(dt) {
        const mx = this.input.x;
        const my = this.input.y;
        let needsRefresh = false;

        // Force redraw for smooth tool tracking
        if (mx !== this.lastInputX || my !== this.lastInputY) {
            this.lastInputX = mx;
            this.lastInputY = my;
            if (this.activeTool === 'magnet' || this.activeTool === 'hand' || this.draggedItem) {
                needsRefresh = true;
            }
        }

        // --- UPDATE DUST PARTICLES ---
        if (this.dustParticles.length > 0) {
            this.dustParticles.forEach(p => {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;
            });
            this.dustParticles = this.dustParticles.filter(p => p.life > 0);
            needsRefresh = true;
        }

        // --- GLOBAL PHYSICS & MAGNET LOOP ---
        // FIX: Cap maximum delta time to prevent lag spikes from creating explosion physics
        const safeDt = Math.min(dt, 0.033); 
        const isMagnetActive = (this.activeTool === 'magnet' && this.input.isDown);
        const influenceRadiusSq = 250 * 250;

        this.particles.forEach(p => {
            // 1. ALWAYS apply friction and velocity (so thrown items slow down naturally)
            p.x += p.vx * safeDt;
            p.y += p.vy * safeDt;
            p.vx *= 0.85; 
            p.vy *= 0.85;

            // 2. Keep items inside the physical crate walls
            if (p.x < 40) { p.x = 40; p.vx *= -0.5; }
            if (p.x > this.SAFE_WIDTH - 40) { p.x = this.SAFE_WIDTH - 40; p.vx *= -0.5; }
            if (p.y < 40) { p.y = 40; p.vy *= -0.5; }
            if (p.y > this.SAFE_HEIGHT - 40) { p.y = this.SAFE_HEIGHT - 40; p.vy *= -0.5; }

            // 3. Magnet Pull
            if (isMagnetActive && p.magnetic) {
                const dx = mx - p.x;
                const dy = my - p.y;
                const distSq = dx*dx + dy*dy;

                this.hideDialogue();

                if (distSq < influenceRadiusSq && distSq > 400) { 
                    // Closer = stronger force
                    const strength = 1 - (distSq / influenceRadiusSq);
                    const pullForce = 3500 * strength; 
                    const dist = Math.sqrt(distSq);

                    // Apply velocity
                    p.vx += (dx / dist) * pullForce * safeDt;
                    p.vy += (dy / dist) * pullForce * safeDt;
                    
                    p.shiverX = (Math.random() - 0.5) * 6 * strength;
                    p.shiverY = (Math.random() - 0.5) * 6 * strength;
                    needsRefresh = true;

                } else if (distSq <= 400) {
                    p.remove = true; 
                    this.spawnDust(p.x, p.y, this.colors.rust); 
                    if (Math.random() > 0.5) this.triggerHaptic(10);
                    needsRefresh = true;
                } else {
                    p.shiverX = 0; p.shiverY = 0;
                }
            } else {
                p.shiverX = 0; p.shiverY = 0;
            }

            // Request redraw if things are still visibly sliding
            if (Math.abs(p.vx) > 1 || Math.abs(p.vy) > 1) {
                needsRefresh = true;
            }
        });

        // --- HAND LOGIC (Drag & Drop) ---
        if (this.activeTool === 'hand') {
            if (this.input.justPressed) {
                let bestCandidate = null;
                let minDistance = Infinity;

                this.particles.forEach(p => {
                    if (p.magnetic) return; // Hand doesn't pick up iron
                    
                    // Treat dimensions as a radius for hit detection
                    const dx = mx - p.x;
                    const dy = my - p.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    const hitRadius = (p.w / 2) + 30; // 30px fat-finger buffer

                    if (dist < hitRadius && dist < minDistance) {
                        minDistance = dist;
                        bestCandidate = p;
                    }
                });

                if (bestCandidate) {
                    this.draggedItem = bestCandidate;

                    this.hideDialogue();
                    
                    // Z-ORDERING: Move item to top of pile
                    const idx = this.particles.indexOf(bestCandidate);
                    if (idx > -1) {
                        this.particles.splice(idx, 1);
                        this.particles.push(bestCandidate);
                    }

                    this.dragOffset = { x: mx - bestCandidate.x, y: my - bestCandidate.y };
                    this.triggerHaptic(20); 
                    needsRefresh = true;
                }
            }
        }

        if (this.draggedItem) {
            needsRefresh = true;
            
            if (this.input.isDown) {
                // Keep horizontal drag centered
                this.draggedItem.x = this.input.x - this.dragOffset.x;

                // Mobile offset logic ---
                if (this.input.isTouch) {
                    // Mobile: Float above the finger so it's not obscured
                    this.draggedItem.y = this.input.y - 70;
                } else {
                    // Desktop: Snap exactly to cursor grab point
                    this.draggedItem.y = this.input.y - this.dragOffset.y;
                }

                // --- STREAK CREATION ---
                // If dragging over the plate, draw powdery streaks
                if (this.checkPointInRect(this.draggedItem, this.streakPlate)) {
                    let streakColor = null;
                    if (this.draggedItem.type === 'pyrite') streakColor = this.colors.pyrite;
                    if (this.draggedItem.type === 'gold') streakColor = this.colors.gold;
                    if (this.draggedItem.type === 'zlatanium') streakColor = this.colors.zlatanium;

                    if (streakColor) {
                        // Add chalky dots to streak array
                        this.streakMarks.push({
                            x: this.draggedItem.x + (Math.random()-0.5)*10,
                            y: this.draggedItem.y + (this.draggedItem.h/2) + (Math.random()-0.5)*10,
                            color: streakColor,
                            size: Math.random() * 3 + 1
                        });
                        // Trigger light continuous haptic to feel the "scratch"
                        if (Math.random() > 0.8) this.triggerHaptic(5);
                    }
                }

            } else {
                this.handleDrop(this.draggedItem);
                this.draggedItem = null;
                this.triggerHaptic(20); 
                needsRefresh = true;
            }
        }

        // Cleanup removed items
        const initialCount = this.particles.length;
        this.particles = this.particles.filter(p => !p.remove);
        if (this.particles.length !== initialCount) needsRefresh = true;

        if (needsRefresh) this.triggerRefresh();

        // --- TUTORIAL LOGIC ---
        if (!this.flags.ironCleared) {
            const ironLeft = this.particles.filter(p => p.type === 'iron').length;
            if (ironLeft === 0) {
                this.flags.ironCleared = true;
                if (this.activeTool === 'magnet' && this.flags.tutorialForShiftingToHandNeeded) {
                    this.flags.tutorialForShiftingToHandNeeded = false;
                    this.showDialogue("Great work! The iron is gone. Switch to the <b>Hand Tool</b> to inspect the rocks.", "haddock", {animate: true});
                }
            }
        }
    }

    handleDrop(p) {
        if (this.checkPointInRect(p, this.streakPlate)) {
            if (p.type === 'pyrite') {
                this.showDialogue("Bah! Black streak. Just Pyrite (Fool's Gold)!", "haddock", {animate: true, disableTypewriter: true});
                p.x = this.SAFE_WIDTH / 2; // Kick it back
                p.y = this.SAFE_HEIGHT / 2;
            } 
            else if (p.type === 'gold') {
                 this.showDialogue("A yellow streak! This is real gold! But we need to find the Zlatanium.", "tintin", {animate: true, disableTypewriter: true});
                 p.x = this.SAFE_WIDTH / 2; // Kick it back
                 p.y = this.SAFE_HEIGHT / 2;
            }
            else if (p.type === 'zlatanium') {
                if (this.zlataniumFound == 0) {
                    this.showDialogue("Look! A Green streak! It's real Zlatanium!", "tintin", {animate: true, disableTypewriter: true});
                } else if (this.zlataniumFound < this.totalZlatanium-1) {
                    this.showDialogue("Great! Another piece of Zlatanium!", "tintin", {animate: true, disableTypewriter: true});
                }
                p.remove = true;
                this.checkWinCondition();
            }
            else {
                // Bounce non-target junk back
                p.x = this.SAFE_WIDTH / 2; 
                p.y = this.SAFE_HEIGHT / 2;
                this.triggerHaptic(40); 
            }
        }
    }

    spawnDust(x, y, color) {
        for(let i=0; i<8; i++) {
            this.dustParticles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 150,
                vy: (Math.random() - 0.5) * 150,
                size: Math.random() * 4 + 2,
                life: 0.6 + Math.random() * 0.4,
                color: color
            });
        }
    }

    checkWinCondition() {
        this.zlataniumFound++;
        this.setHUDMeter((this.zlataniumFound / this.totalZlatanium) * 100);
        if (this.zlataniumFound >= this.totalZlatanium) {
            setTimeout(() => this.win(), 1000); 
        }
    }

    draw(ctx) {
        // FIX: Utilize full 1024x768 screen bounds
        if (this.assets.crateBg) {
            ctx.drawImage(this.assets.crateBg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }

        // 2. Streak Plate
        if (this.assets.streakPlate) {
            // Give the plate a slight shadow
            ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
            ctx.drawImage(this.assets.streakPlate, this.streakPlate.x, this.streakPlate.y, this.streakPlate.w, this.streakPlate.h);
            ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        }

        // Draw drawn streak marks directly onto the plate
        this.streakMarks.forEach(mark => {
            ctx.fillStyle = mark.color;
            ctx.globalAlpha = 0.4; // Soft chalky look
            ctx.beginPath();
            ctx.arc(mark.x, mark.y, mark.size, 0, Math.PI*2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });

        // Plate Highlight (if dragging an item)
        if (this.draggedItem) {
            ctx.strokeStyle = '#eaff00';
            ctx.lineWidth = 4;
            const pulse = 0.5 + (Math.sin(Date.now() / 150) * 0.2); 
            ctx.globalAlpha = pulse; 
            ctx.strokeRect(this.streakPlate.x - 5, this.streakPlate.y - 5, this.streakPlate.w + 10, this.streakPlate.h + 10);
            ctx.globalAlpha = 1.0; 
        }

        const isMagnetPulling = (this.activeTool === 'magnet' && this.input.isDown);

        // 3. Render Pile Particles
        this.particles.forEach(p => {
            // Skip drawing the dragged item here, we will draw it later!
            if (p === this.draggedItem) return;

            const img = this.assetManager.get(p.assetId);
            
            ctx.save();
            
            // Add shiver offset if magnet is pulling it
            const sx = p.shiverX || 0;
            const sy = p.shiverY || 0;
            ctx.translate(p.x + sx, p.y + sy);
            
            if (p.rotation) ctx.rotate(p.rotation);

            if (img) {
                // GPU OPTIMIZATION: A 0-blur shadow is practically free for the CPU 
                // and perfectly matches the irregular shape of the PNG assets.
                if (!isMagnetPulling) {
                    ctx.shadowColor = "rgba(0,0,0,0.3)";
                    ctx.shadowBlur = 0; 
                    ctx.shadowOffsetX = 4;
                    ctx.shadowOffsetY = 3;
                }
                
                ctx.drawImage(img, -p.w/2, -p.h/2, p.w, p.h);
            }

            ctx.restore();
        });

        // 4. Render Dust/Juice Particles
        this.dustParticles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life; // Fades out as life goes from 1.0 to 0
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });

        // 5. Custom Tool Cursors & Render Sandwich
        if (this.activeTool === 'magnet' && this.assets.magnet) {
            ctx.drawImage(this.assets.magnet, this.input.x - 30, this.input.y - 45, 60, 60);
            
        } else if (this.activeTool === 'hand') {
 
            if (this.draggedItem) {
                // Determine drawing coordinates (adjust these offsets to fit your specific PNGs)
                const gloveX = this.draggedItem.x - 25; 
                const gloveY = this.draggedItem.y - 25;
                const gloveSize = 55;

                // LAYER 1: Glove Palm (Behind)
                if (this.assets.hand_back) {
                    ctx.drawImage(this.assets.hand_back, gloveX, gloveY, gloveSize, gloveSize);
                }

                // LAYER 2: The Dragged Rock
                ctx.save();
                ctx.translate(this.draggedItem.x, this.draggedItem.y);
                if (this.draggedItem.rotation) ctx.rotate(this.draggedItem.rotation);
                
                ctx.scale(1.15, 1.15); 
                ctx.shadowColor = "rgba(0,0,0,0.5)";
                ctx.shadowBlur = 15;
                ctx.shadowOffsetY = 10;
                
                const img = this.assetManager.get(this.draggedItem.assetId);
                if (img) {
                    ctx.drawImage(img, -this.draggedItem.w/2, -this.draggedItem.h/2, this.draggedItem.w, this.draggedItem.h);
                }
                ctx.restore();

                // LAYER 3: Glove Fingers (In Front)
                if (this.assets.hand_fingers) {
                    ctx.drawImage(this.assets.hand_fingers, gloveX, gloveY, gloveSize, gloveSize);
                }
                
            } else if (this.assets.hand) {
                // Normal mode: Draw OPEN hand centered on cursor
                ctx.drawImage(this.assets.hand, this.input.x - 25, this.input.y - 25, 50, 50);
            }
           
        }

        if (this.dialogueShowing) {
            // Dark Overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }

    }

    checkPointInRect(p, rect) {
        return p.x > rect.x && p.x < rect.x + rect.w && p.y > rect.y && p.y < rect.y + rect.h;
    }

    destroy() {
        if (this.canvas) this.canvas.style.cursor = 'default';
        super.destroy();
    }
}
