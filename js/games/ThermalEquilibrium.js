/* =========================================
   js/games/ThermalEquilibrium.js
   Game 06: "The Bubbling Threat"
   Optimized: Smart Rendering + Timer + Better UI
   ========================================= */

import { MachineGame } from '../middleware/MachineGame.js';
import { CanvasTimer } from '../components/CanvasTimer.js';

export class ThermalEquilibrium extends MachineGame {

    async init() {
        // Clear Previous UI Safely
        this.clearDynamicUI();

        // OPTIMIZATION: Enable Smart Rendering
        this.enableSmartRendering = true;

        if (!this.tuning || !this.tuning.physics || !this.tuning.layout) {
            console.error("❌ Level Data Missing for ThermalEquilibrium");
            return;
        }

        this.phys = this.tuning.physics;
        this.lay = this.tuning.layout;
        this.totalGameTime = this.tuning.gameTime || 30;
        this.flags = {
            dialChanged: false
        };

        // 2. Preload Assets (Includes Timer & Timer Hand)
        await this.preload([
            'g06_bg_stove', 'g06_pot_copper', 'g06_pot_overlay_cracks',
            'g06_zlatanium_liquid_red', 'g06_zlatanium_liquid_silver', 'g06_zlatanium_solid',
            'g06_haddock_reactions', 
            'ui_thermometer_frame', 'ui_dial', 'ui_ice_bucket', 'g06_ice_cube',
            'ui_timer_body', 'ui_timer_hand'
        ]);

        // 3. Instantiate the Timer Component (Size 120 based on original code)
        this.timerUI = new CanvasTimer(this.assetManager, 120);

        // Setup Controls
        this.addDial('stove_knob', {
            x: this.lay.dial.x, y: this.lay.dial.y, r: this.lay.dial.r,
            assetId: 'ui_dial',
            initialValue: 2, max: 2,
            onChange: (val) => { 
                if (!this.flags.dialChanged && this.state === 'playing') this.hideDialogue();
                this.flags.dialChanged = true;
                this.heatLevel = val; 
                this.triggerRefresh();
            }
        });

        this.addButton('ice_bucket', {
            x: this.lay.iceBucket.x, y: this.lay.iceBucket.y, w: this.lay.iceBucket.w, h: this.lay.iceBucket.h,
            onPress: () => this.addIce()
        });

        // Start Game
        this.resetLevel();
        
        this.showDialogue(`It's unstable! You have <b>${this.totalGameTime} seconds</b> to stabilize it!<br>Target: <b>20°C</b><br>Turn off the heart first!`, 
            "haddock", {animate: true, disableTypewriter: true, comicTransition: true});
        this.triggerRefresh();
    }

    resetLevel() {
        this.temperature = this.phys.initialTemp;
        this.integrity = 100;   
        this.heatLevel = 2;     
        this.coolingRate = 0;   
        this.iceCubes = [];    
        this.state = 'playing'; 
        this.shockTimer = 0;    
        this.shakeOffset = { x: 0, y: 0 };
        this.gameTime = 0;      
        this.resetControls();
        this.triggerRefresh();
    }

    addIce() {
        if (this.state !== 'playing') return;
        this.coolingRate += this.phys.iceCoolingPower; 
        
        const bx = this.lay.iceBucket.x + (this.lay.iceBucket.w/2);
        this.iceCubes.push({
            x: bx + (Math.random()*40 - 20),
            y: this.lay.iceBucket.y - 15,
            vy: 0, scale: 1
        });
        this.triggerRefresh();
    }

    update(dt) {
        super.update(dt); 
        
        if (this.state !== 'playing') return;
        
        this.triggerRefresh(); 
        this.gameTime += dt;

        // --- PHYSICS ---
        let heatingPower = this.phys.heatOffPower;
        if (this.heatLevel === 1) heatingPower = this.phys.heatLowPower;
        if (this.heatLevel === 2) heatingPower = this.phys.heatHighPower;
        
        this.temperature += heatingPower * dt;
        this.temperature -= this.coolingRate * dt;
        
        if (this.coolingRate > 0) {
            this.coolingRate -= this.phys.iceDecay * dt; 
            if (this.coolingRate < 0) this.coolingRate = 0;
        }
        if (this.temperature < 0) this.temperature = 0;

        // --- THERMAL SHOCK ---
        if (this.coolingRate > this.phys.thermalShockThreshold && this.heatLevel === 2) {
            this.integrity -= this.phys.integrityDamage * dt; 
            this.shockTimer = 0.2; 
            this.shakeOffset.x = (Math.random() - 0.5) * 10;
            this.shakeOffset.y = (Math.random() - 0.5) * 10;
        } else {
            this.shakeOffset.x = 0;
            this.shakeOffset.y = 0;
        }
        
        if (this.integrity < 0) this.integrity = 0;

        // --- VISUAL PHYSICS ---
        const liquidY = this.lay.pot.y;
        this.iceCubes.forEach(ice => {
            ice.y += (ice.vy += 2 * dt);
            if (ice.y > liquidY) ice.scale -= 1.5 * dt; 
        });
        this.iceCubes = this.iceCubes.filter(i => i.scale > 0);

        // --- FAIL CONDITIONS ---
        if (this.integrity <= 0) {
            this.triggerFail("CRACK! Thermal Shock! You added ice while the Heat was HIGH!");
            return;
        }
        
        if (this.temperature >= this.phys.maxTemp) {
            this.triggerFail("POOF! You boiled it away! Turn the heat OFF faster!");
            return;
        }
        
        if (this.gameTime > this.totalGameTime) {
            this.triggerFail("It's taking too long! It will not solidify!");
            return;
        }

        // --- WIN CONDITION ---
        if (this.temperature <= this.phys.targetTemp) {
            this.triggerWin();
        }
    }

    /* =========================================
       UPDATED: Improved Fail UI
       ========================================= */
    triggerFail(reason) {
        if (this.state == 'won') return; 
        this.state = 'lost';
        this.triggerHaptic(400); 

        // 1. Show the Text (using standard middleware)
        this.showDialogue(`<b>HADDOCK:</b> ${reason}`, "haddock", {animate: true, disableTypewriter: true});

        this.showGameRestartButtonInDialogueBubble( () => { this.resetLevel(); } );
    }

    triggerWin() {
        this.state = 'won';
        this.showDialogue("<b>Magnificent!</b> It's solidifying nicely!", "tintin", {animate: true, disableTypewriter: true});
        this.triggerRefresh();
        setTimeout(() => this.win(), 2500);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.shakeOffset.x, this.shakeOffset.y);

        // 1. BG
        const bg = this.assetManager.get('g06_bg_stove');
        if (bg) ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        // Dark Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        // 2. Pot Layering
        const px = this.lay.pot.x;
        const py = this.lay.pot.y;

        // Draw the burn first
        let burnOpacity = 0.1;
        if (this.heatLevel == 2) burnOpacity = 0.7; 
        else if (this.heatLevel == 1) burnOpacity = 0.45;
        ctx.fillStyle = `rgba(255, 50, 0, ${burnOpacity})`;
        ctx.filter = 'blur(20px)';
        ctx.beginPath(); ctx.arc(px + this.lay.pot.w / 2, py + this.lay.pot.h - 20, 80, 0, Math.PI*2); ctx.fill();
        ctx.filter = 'none';

        // Now the pot
        const potImg = this.assetManager.get('g06_pot_copper');
        if (potImg) ctx.drawImage(potImg, px, py, this.lay.pot.w, this.lay.pot.h);

        let liquidAsset = 'g06_zlatanium_liquid_red';
        if (this.temperature < 60) liquidAsset = 'g06_zlatanium_liquid_silver';
        if (this.state === 'won')  liquidAsset = 'g06_zlatanium_solid';

        const liqImg = this.assetManager.get(liquidAsset);
        if (liqImg) ctx.drawImage(liqImg, px + this.lay.liquid.dx, py + this.lay.liquid.dy, this.lay.liquid.w, this.lay.liquid.h);

        const iceImg = this.assetManager.get('g06_ice_cube');
        if (iceImg) {
            this.iceCubes.forEach(ice => {
                ctx.drawImage(iceImg, ice.x, ice.y, 64*ice.scale, 64*ice.scale);
            });
        }

        if (this.integrity < 100) {
            const crackImg = this.assetManager.get('g06_pot_overlay_cracks');
            if (crackImg) {
                ctx.save();
                ctx.globalAlpha = (100 - this.integrity) / 100;
                ctx.drawImage(crackImg, px+10, py+10, 180, 180);
                ctx.restore();
            }
        }
        ctx.restore();

        // 3. UI
        const bucketImg = this.assetManager.get('ui_ice_bucket');
        if (bucketImg) ctx.drawImage(bucketImg, this.lay.iceBucket.x, this.lay.iceBucket.y, this.lay.iceBucket.w, this.lay.iceBucket.h);

        this.drawThermometer(ctx, this.lay.thermometer.x, this.lay.thermometer.y);
        this.drawHaddockFace(ctx, this.lay.haddock.x, this.lay.haddock.y);
        this.drawIntegrityBar(ctx, this.lay.integrityBar.x, this.lay.integrityBar.y);
        this.drawControls(ctx);

        // 4. Draw Timer using the new Component
        this.timerUI.draw(
            ctx, 
            this.lay.clock.x, 
            this.lay.clock.y, 
            this.gameTime, 
            this.totalGameTime
        );

        if (this.shockTimer > 0) {
            ctx.fillStyle = `rgba(255, 0, 0, ${this.shockTimer + 0.1})`;
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
            this.shockTimer -= 0.016;
        }
    }

    // --- drawTimer method completely removed ---

    drawThermometer(ctx, x, y) {
        const frame = this.assetManager.get('ui_thermometer_frame');
        if (frame) ctx.drawImage(frame, x, y, 100, 500);

        const maxH = 350;
        const pct = Math.min(1, Math.max(0, this.temperature / this.phys.maxTemp));
        const barHeight = pct * maxH; 
        
        ctx.fillStyle = '#D32F2F';
        ctx.fillRect(x + 40, y + 450 - barHeight, 20, barHeight);
        
        const targetY = (this.phys.targetTemp / this.phys.maxTemp) * maxH;
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(x + 30, y + 450 - targetY, 40, 4);
    }

    drawHaddockFace(ctx, x, y) {
        const sheet = this.assetManager.get('g06_haddock_reactions');
        if (!sheet) return;
        
        let frame = 0;
        if (this.temperature > 70 || this.integrity < 70) frame = 1; 
        if (this.temperature > 100 || this.integrity < 30) frame = 2; 
        if (this.temperature > 130 || this.integrity < 10) frame = 3; 
        if (this.state === 'lost') frame = 3; 

        const frameSize = 256;
        const col = frame % 2; 
        const row = Math.floor(frame / 2);
        
        ctx.drawImage(sheet, col * frameSize, row * frameSize, frameSize, frameSize, x, y, 200, 200);
    }

    drawIntegrityBar(ctx, x, y) {
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, 300, 20);
        
        ctx.fillStyle = this.integrity > 50 ? '#4CAF50' : '#F44336';
        const width = 3 * Math.max(0, this.integrity); 
        ctx.fillRect(x, y, width, 20);
        
        ctx.strokeStyle = '#333';
        ctx.strokeRect(x, y, 300, 20);
        
        ctx.fillStyle = '#111';
        ctx.font = "bold 14px Arial";
        ctx.fillText("POT INTEGRITY", x, y - 8);
    }
}
