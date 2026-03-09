/* =========================================
   js/games/CondensationCatch.js
   Game 08: "The Condensation Catch"
   Mechanic: Physics Catcher (Matter.js)
   Theme: Gas -> Liquid Phase Change
   ========================================= */

import { PhysicsGame } from '../middleware/PhysicsGame.js';
import { ParticleSystem } from '../components/ParticleSystem.js';

export class CondensationCatch extends PhysicsGame {

    async init() {
        this.enableSmartRendering = true; // Optimization

        if (this.clearPhysics) this.clearPhysics();

        this.lay = this.tuning.layout;

        // 1. Tuning & State
        this.gameTime = 0;
        this.score = 0;
        this.targetScore = 50; // Drops needed to fill mold
        
        this.heat = 0;
        this.MAX_HEAT = 100;
        this.cooling = false;
        
        this.fogDensity = 0;
        this.MAX_FOG = 100;

        // Entities
        this.gasSys = new ParticleSystem(this.assetManager); 
        this.clocheBody = null;
        this.moldSensor = null;

        this.puddles = []; // track drops which fell outside the mold
        
        // Tilt Physics
        this.lastX = 0;
        this.tiltAngle = 0;
        this.isHoveringIceBucket = false;
        this.moldGlowIntensity = 0;

        // 2. Load Assets
        await this.preload([
            'g08_kitchen_bg',
            'g08_cloche', 
            'g08_gas_cloud',
            'g08_water_drop',
            'g08_mold_front',
            'g08_thomson_overlay',
            'ui_ice_bucket'
        ]);

        // 3. Setup Physics World
        this.setupWorld();

        // 4. Intro Dialogue
        this.showDialogue(
            "Great snakes! The steam is escaping! catch it with the <b>Cold Cloche</b> before the room fogs up!<br><br><i>(Guide the drops into the mold at the bottom. Dip in the Ice Bucket if the cloche gets too hot!)</i>",
            "haddock",
            {   animate: true, 
                onClose: () => { this.start();  },
                disableTypewriter: true, comicTransition: true }
        );

        setTimeout( () => { this.stop(); }, 0 );
    }

    setupWorld() {
        // A. The Cloche (Player Character)
        // We use a Chamfered Rectangle for a slightly rounded physical edge
        this.clocheBody = Matter.Bodies.rectangle(
            this.SAFE_WIDTH / 2, 
            300, 
            160, 20, 
            { 
                isStatic: true, // We control position manually
                chamfer: { radius: 10 },
                friction: 0.05,
                restitution: 0.2
            }
        );
        Matter.World.add(this.world, this.clocheBody);

        // B. The Mold (Score Zone - Bottom Center)
        // Walls to catch the liquid
        const floorY = this.SAFE_HEIGHT - 50;
        const moldX = this.SAFE_WIDTH / 2;
        const moldW = 200;
        
        const leftWall = Matter.Bodies.rectangle(moldX - moldW/2, floorY - 20, 20, 100, { isStatic: true, render: { visible: false } });
        const rightWall = Matter.Bodies.rectangle(moldX + moldW/2, floorY - 20, 20, 100, { isStatic: true, render: { visible: false } });
        const bottom = Matter.Bodies.rectangle(moldX, floorY + 30, moldW, 20, { isStatic: true, render: { visible: false } });
        
        // The Sensor (Detects win)
        this.moldSensor = Matter.Bodies.rectangle(moldX, floorY, moldW - 20, 50, { 
            isStatic: true, 
            isSensor: true, 
            label: 'mold_sensor' 
        });

        Matter.World.add(this.world, [leftWall, rightWall, bottom, this.moldSensor]);

        // Remove old listeners before adding new ones to prevent duplicate firing on restart
        Matter.Events.off(this.engine, 'collisionStart'); 
        
        // C. Collision Events
        Matter.Events.on(this.engine, 'collisionStart', (event) => this.handleCollisions(event));
    }

    update(dt) {
        // Run Physics Engine
        super.update(dt);
        
        if (this.state === 'lost' || this.state === 'won') return;
        
        this.gameTime += dt;
        this.triggerRefresh();

        // 1. Player Input & Physics
        this.updateCloche(dt);
        this.updateDropsWhichFellOutsideMold(dt);

        // 2. Gas Spawning & Logic
        this.updateGas(dt);

        // 3. Heat & Fog Logic
        this.updateEnvironment(dt);

        // 4. Win/Loss Check
        if (this.fogDensity >= this.MAX_FOG) {
            this.loseGame();
        }
        if (this.score >= this.targetScore) {
            this.winGame();
        }
    }

    updateCloche(dt) {
        // Smooth Mouse Following
        // Limit X/Y to reachable area
        const targetX = Math.min(Math.max(this.input.x, 100), this.SAFE_WIDTH - 100);
        const targetY = Math.min(Math.max(this.input.y, 100), this.SAFE_HEIGHT - 150);

        // Calculate Velocity for Tilt
        const dx = targetX - this.lastX;
        this.lastX = targetX;

        // Dynamic Tilt: Faster movement = Steeper angle
        // We use Lerp for smooth rotation
        const targetAngle = (dx * 0.05); 
        this.tiltAngle += (targetAngle - this.tiltAngle) * 0.1;

        // Apply to Physics Body
        Matter.Body.setPosition(this.clocheBody, { x: targetX, y: targetY });
        Matter.Body.setAngle(this.clocheBody, this.tiltAngle);

        // Ice Bucket Zone (Left side of screen, middle height)
        const iceZone = { x: this.lay.iceBucket.x, y: this.lay.iceBucket.y, r: 100 };
        const distToIce = Math.hypot(targetX - iceZone.x, targetY - iceZone.y);
        
        if (distToIce < iceZone.r) {
            if (this.heat > 0) {
                this.heat -= 80 * dt; // Cool down fast
                this.cooling = true;
                if (this.heat < 0) this.heat = 0;
            }
        } else {
            this.cooling = false;
        }

        // --- Hover Detection for Ice Bucket ---
        const prevHover = this.isHoveringIceBucket;
        // Calculate distance from pointer input to the ice bucket
        const hoverDist = Math.hypot(this.input.x - iceZone.x, this.input.y - iceZone.y);
        this.isHoveringIceBucket = hoverDist < iceZone.r;

        // Force a canvas redraw if the hover state just changed
        if (prevHover !== this.isHoveringIceBucket) {
            this.triggerRefresh();
        }
    }

    updateDropsWhichFellOutsideMold(dt) {
        const bodies = Matter.Composite.allBodies(this.world);
        bodies.forEach(b => {
            // If drop hits the floor level
            if (b.label === 'water_drop' && b.position.y > this.SAFE_HEIGHT - 20) {
                const moldLeft = (this.SAFE_WIDTH / 2) - 100;
                const moldRight = (this.SAFE_WIDTH / 2) + 100;
                
                // If it missed the mold catcher
                if (b.position.x < moldLeft || b.position.x > moldRight) {
                    this.puddles.push({
                        x: b.position.x,
                        y: this.SAFE_HEIGHT - 10 + (Math.random() * 15 - 5), // Random vertical spread
                        w: 2,
                        maxW: 15 + Math.random() * 25,
                        alpha: 0.8
                    });
                }
                // Remove from physics world
                Matter.World.remove(this.world, b);
            }
        });

        // Animate the expanding/fading puddles
        this.puddles.forEach(p => {
            if (p.w < p.maxW) p.w += 30 * dt; // Spread outwards
            p.alpha -= 0.15 * dt; // Fade out slowly
        });
        // Clean up invisible puddles
        this.puddles = this.puddles.filter(p => p.alpha > 0);
    }

    updateGas(dt) {
        // Spawn Gas Randomly
        if (Math.random() < 0.03 + (this.gameTime * 0.001)) { // Gets harder over time
            // We push directly here to bypass generic mappings and ensure strict control 
            this.gasSys.particles.push({
                x: 300 + Math.random() * 400, // Spawn from pot area
                y: this.SAFE_HEIGHT,
                vx: (Math.random() - 0.5) * 1,
                vy: -2 - (Math.random() * 2), // Move Up
                r: 30, // for hit detection and drawing
                life: 10, // Long life to ensure they reach top
                maxLife: 10,
                assetId: 'g08_gas_cloud',
                onUpdate: (gas, dt) => {
                    // MUST APPLY PHYSICS MANUALLY since onUpdate overrides defaults
                    gas.x += gas.vx;
                    gas.y += gas.vy;

                    // A. Check Collision with Ceiling (Missed)
                    if (gas.y < 0) {
                        gas.life = 0; // Kill particle
                        this.fogDensity += 5; // Penalty
                        this.triggerHaptic(5);
                        return;
                    }

                    // B. Check Collision with Cloche (Catch)
                    // ONLY if the cloche isn't overheated.
                    if (this.heat < this.MAX_HEAT) {
                        const cx = this.clocheBody.position.x;
                        const cy = this.clocheBody.position.y;
                        const dist = Math.hypot(gas.x - cx, gas.y - cy);

                        if (dist < 90) { // Approx Hit
                            gas.life = 0; // Kill particle
                            this.convertGasToLiquid(gas.x, gas.y);
                        }
                    }
                }
            });
        }

        this.gasSys.update(dt);
    }

    convertGasToLiquid(x, y) {
        // 1. Create Physics Drop
        const drop = Matter.Bodies.circle(x, y + 20, 8, {
            restitution: 0.5, // Bouncy
            friction: 0.01,   // Slippery
            label: 'water_drop',
            render: { fillStyle: '#008CBA' }
        });
        
        // Give it a tiny downward push
        Matter.Body.setVelocity(drop, { x: 0, y: 2 });
        Matter.World.add(this.world, drop);

        // 2. Increase Heat
        this.heat += 5;
        this.triggerHaptic(10);
    }

    handleCollisions(event) {
        const pairs = event.pairs;
        
        for (let i = 0; i < pairs.length; i++) {
            const bodyA = pairs[i].bodyA;
            const bodyB = pairs[i].bodyB;

            // Check Drop vs Sensor
            const isDropA = bodyA.label === 'water_drop';
            const isDropB = bodyB.label === 'water_drop';
            const isSensorA = bodyA.label === 'mold_sensor';
            const isSensorB = bodyB.label === 'mold_sensor';

            if ((isDropA && isSensorB) || (isDropB && isSensorA)) {
                // Determine which is the drop to remove it
                const drop = isDropA ? bodyA : bodyB;
                this.scoreDrop(drop);
            }
        }
    }

    scoreDrop(dropBody) {
        // Remove from world
        Matter.World.remove(this.world, dropBody);
        
        // Increase Score
        this.score++;
        this.moldGlowIntensity = 1.0; // Trigger the cyan flash of the container/mold
        this.triggerHaptic(20);
    }

    updateEnvironment(dt) {
        // Passive Heat Decay (very slow)
        if (this.heat > 0 && !this.cooling) this.heat -= 1 * dt;
        
        // Passive Fog Decay (very slow)
        if (this.fogDensity > 0) this.fogDensity -= 0.5 * dt;

        // Decay the mold glow over time (fades out over 0.5s)
        if (this.moldGlowIntensity > 0) {
            this.moldGlowIntensity -= dt * 2;
            if (this.moldGlowIntensity < 0) this.moldGlowIntensity = 0;
        }
    }

    winGame() {
        this.state = 'won';
        this.triggerRefresh();
        this.showDialogue("Magnificent! Look at that accumulation! The phase change is complete.", "calculus", {
            animate: true,
            onClose: () => this.win()
        });
    }

    resetLevel() {
        // Logic to restart (handled by main app, or we can reset here)
        this.init(); // Soft reset
        this.state = null;
    }

    loseGame() {
        this.state = 'lost';
        this.showDialogue("<b>Thomson:</b> I say, it's rather foggy in here.<br><b>Thompson:</b> To be precise, we can't see a thing!", "thomson", {
            animate: true,
            onTypeWriterComplete: () => {
                this.showGameRestartButtonInDialogueBubble( () => { this.resetLevel(); } );
            },
            onClose: () => {
                this.resetLevel();
            }
        });
    }

    // =======================================================
    // 🎨 RENDERER
    // =======================================================
    draw(ctx) {
        // 1. Background
        const bg = this.assetManager.get('g08_kitchen_bg');
        if (bg) ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        // --- Centralized Heat Blur ---
        if (this.heat > 0) {
            const centerX = this.SAFE_WIDTH / 2; 
            const centerY = this.SAFE_HEIGHT / 2;
            
            // Inner radius 0, outer radius 450 creates a focused center glow that blurs out
            const heatGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 450);
            const heatAlpha = (this.heat / this.MAX_HEAT) * 0.55; 
            
            heatGrad.addColorStop(0, `rgba(255, 60, 0, ${heatAlpha})`); 
            heatGrad.addColorStop(1, 'rgba(255, 60, 0, 0.0)');
            
            ctx.fillStyle = heatGrad;
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }
        
        // 2. Decor: Ice Bucket
        ctx.save();
        
        // Apply hover effects if actively hovered
        if (this.isHoveringIceBucket) {
            const cx = this.lay.iceBucket.x + (this.lay.iceBucket.w / 2);
            const cy = this.lay.iceBucket.y + (this.lay.iceBucket.h / 2);
            
            // 1. Draw a guaranteed visible "Ice" glow behind the bucket
            const glowRadius = this.lay.iceBucket.w * 0.7;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
            grad.addColorStop(0, 'rgba(0, 255, 255, 0.8)'); // Cyan core
            grad.addColorStop(1, 'rgba(0, 255, 255, 0)');   // Fade to transparent
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
            ctx.fill();

            // 2. Apply the scale bump
            ctx.translate(cx, cy);
            ctx.scale(1.08, 1.08);
            ctx.translate(-cx, -cy);
            
            // 3. Add the shadow for the sprite's edges
            ctx.shadowColor = '#00FFFF'; 
            ctx.shadowBlur = 25;
        }

        const bucketImg = this.assetManager.get('ui_ice_bucket');
        if (bucketImg) {
            ctx.drawImage(bucketImg, this.lay.iceBucket.x, this.lay.iceBucket.y, this.lay.iceBucket.w, this.lay.iceBucket.h);
        }
        
        ctx.restore();

        if (this.state === 'won') {
            // Dark Overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

            return;
        }

        // Draw Puddles (Missed Drops) with Glow
        this.puddles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(1, 0.25); // Squash into perspective oval
            
            // 1. Add the Cyan Glow (Intensity scales with the puddle's fade alpha)
            ctx.shadowColor = '#00FFFF';
            ctx.shadowBlur = 20 * p.alpha; 
            
            // 2. Base Puddle (Brightened slightly to match the neon aesthetic)
            ctx.fillStyle = `rgba(0, 200, 255, ${p.alpha * 0.9})`;
            ctx.beginPath();
            ctx.arc(0, 0, p.w, 0, Math.PI * 2);
            ctx.fill();
            
            // 3. Optional: Inner bright core for a "liquid highlight" effect
            ctx.shadowBlur = 0; // Turn off shadow for the inner core
            ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(0, 0, p.w * 0.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });

        // 3. Physics Objects (Liquids)
        // We iterate Matter bodies manually to draw sprites
        const bodies = Matter.Composite.allBodies(this.world);
        const dropImg = this.assetManager.get('g08_water_drop');

        bodies.forEach(b => {
            if (b.label === 'water_drop') {
                ctx.save();
                ctx.translate(b.position.x, b.position.y);
                if (dropImg) {
                    ctx.drawImage(dropImg, -10, -10, 20, 20);
                } else {
                    ctx.fillStyle = '#00f';
                    ctx.beginPath(); ctx.arc(0,0, 8, 0, Math.PI*2); ctx.fill();
                }
                ctx.restore();
            }
        });

        // 4. Non-Physics Objects (Gas) - Delegated to ParticleSystem
        this.gasSys.draw(ctx);

        // 5. The Cloche
        ctx.save();
        ctx.translate(this.clocheBody.position.x, this.clocheBody.position.y);
        ctx.rotate(this.clocheBody.angle);
        const clocheImg = this.assetManager.get('g08_cloche');
        
        // Heat Effect on Sprite
        if (this.heat > 50) {
            // Tint Red
            ctx.shadowColor = 'red';
            ctx.shadowBlur = (this.heat - 50);
        }

        if (clocheImg) {
            // Draw centered
            ctx.drawImage(clocheImg, -90, -40, 180, 80);
        } else {
            // Debug Shape
            ctx.fillStyle = this.heat > 90 ? '#ff0000' : '#888';
            ctx.fillRect(-80, -10, 160, 20);
        }
        ctx.restore();

        // 6. The Mold (Liquid Fill & Foreground)
        const moldX = (this.SAFE_WIDTH / 2) - 100;
        const moldY = this.SAFE_HEIGHT - 100;
        const moldW = 200;
        const moldH = 100;

        // Mold Catch Glow Effect 
        ctx.save();
        if (this.moldGlowIntensity > 0) {
            const cx = moldX + (moldW / 2);
            const cy = moldY + (moldH / 2);
            const glowRadius = moldW * 0.75;
            
            // Draw radial burst behind the mold
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
            grad.addColorStop(0, `rgba(0, 255, 255, ${this.moldGlowIntensity * 0.8})`); 
            grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
            ctx.fill();

            // Apply a crisp outer shadow to the image itself
            ctx.shadowColor = '#00FFFF';
            ctx.shadowBlur = 25 * this.moldGlowIntensity;
        }

        // Draw the mold foreground image BEFORE the liquid
        const moldImg = this.assetManager.get('g08_mold_front');
        if (moldImg) {
            ctx.drawImage(moldImg, moldX, moldY, moldW, moldH);
        }
        ctx.restore();

        // --- Animated Liquid Fill ---
        if (this.score > 0) {
            ctx.save();

            // Define the Perspective Clipping Mask (matches the mold's inner slant)
            ctx.beginPath();
            ctx.moveTo(moldX + 40, moldY + 22); // Top left inner corner
            ctx.lineTo(moldX + moldW - 37, moldY + 22); // Top right inner corner
            ctx.lineTo(moldX + moldW - 28, moldY + moldH - 47); // Bottom right inner corner
            ctx.lineTo(moldX + 28, moldY + moldH - 47); // Bottom left inner corner
            ctx.closePath();
            ctx.clip(); // Mask applied!

            const fillPct = Math.min(1, this.score / this.targetScore);
            
            // Calculate dimensions for the fluid volume inside the mold
            //const maxLiquidH = moldH - 25; // Leave top padding
            const maxLiquidH = 32;
            const currentLiquidH = maxLiquidH * fillPct;
            
            const liqX = moldX + 28; // Side margins to fit inside the mold graphic
            const liqW = moldW - 40;
            const liqY = moldY + moldH - 47 - currentLiquidH; // Draw from the bottom up

            // Subtle wave animation on the surface
            const waveOffset = Math.sin(this.gameTime * 4) * 3;
            
            // Draw Liquid Body
            ctx.fillStyle = 'rgba(0, 140, 186, 0.85)'; // Semi-transparent Tintin Blue
            ctx.beginPath();
            ctx.moveTo(liqX, liqY + waveOffset);
            ctx.lineTo(liqX + liqW, liqY - waveOffset);
            ctx.lineTo(liqX + liqW, liqY + currentLiquidH);
            ctx.lineTo(liqX, liqY + currentLiquidH);
            ctx.closePath();
            ctx.fill();

            // Draw bright rim highlight on the surface
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(liqX, liqY + waveOffset, liqW, 4);
            ctx.restore();
        }

        // 7. UI: Fog Overlay
        if (this.fogDensity > 0) {
            ctx.fillStyle = `rgba(200, 200, 200, ${this.fogDensity / 100})`;
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

            // Thomsons appear in the fog
            if (this.fogDensity > 50) {
                const thomsons = this.assetManager.get('g08_thomson_overlay');
                if (thomsons) {
                     ctx.globalAlpha = (this.fogDensity - 50) / 50;
                     ctx.drawImage(thomsons, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
                     ctx.globalAlpha = 1;
                }
            }
        }

        this.drawHUD(ctx);

        // Dark overlay
        if (this.dialogueShowing) { 
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }
    }

    drawHUD(ctx) {
        // Score Bar (Bottom)
        const barW = 300;
        const barX = (this.SAFE_WIDTH - barW) / 2;
        const barY = this.SAFE_HEIGHT - 30;

        ctx.fillStyle = 'rgba(30, 30, 40, 0.85)';
        ctx.fillRect(barX, barY, barW, 15);
        
        const fillPct = Math.min(1, this.score / this.targetScore);
        ctx.fillStyle = 'rgba(0, 140, 186, 0.85)';
        ctx.fillRect(barX, barY, barW * fillPct, 15);
        
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(barX, barY, barW, 20);

        // Heat Meter (Top Right)
        const heatX = this.SAFE_WIDTH - 60;
        const heatY = 100;
        const heatH = 200;

        // Frame
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(heatX, heatY, 20, heatH);
        ctx.strokeStyle = 'rgba(200, 200, 100, 0.75)';
        ctx.strokeRect(heatX, heatY, 20, heatH);
        
        // Fill
        const heatPct = this.heat / this.MAX_HEAT;
        const fillH = heatPct * heatH;
        
        // Gradient Red
        ctx.fillStyle = this.cooling ? 'rgba(0,255,255,0.8)' : `rgba(${255 * heatPct}, ${255 * (1-heatPct)}, 0, 0.6)`;
        ctx.fillRect(heatX, heatY + heatH - fillH, 20, fillH);

        // Labels
        ctx.font = "bold 16px Arial";
        ctx.fillStyle = 'rgba(40, 40, 10, 0.75)';
        ctx.textAlign = 'center';
        ctx.fillText("HEAT", heatX + 15, heatY - 10);
        
        // Overheat Warning
        if (this.heat >= this.MAX_HEAT) {
            ctx.font = "bold 24px Arial";
            ctx.fillStyle = 'red';
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.strokeText("TOO HOT!", this.SAFE_WIDTH/2, 100);
            ctx.fillText("TOO HOT!", this.SAFE_WIDTH/2, 100);
        }
    }
}
