/* =========================================
   js/games/PackingPuzzle.js
   Game 02: Operation Heavy Disguise
   Optimized: Smart Rendering to fix High CPU
   ========================================= */

import { PacAdventureGame } from '../middleware/PacAdventureGame.js';

export class PackingPuzzle extends PacAdventureGame {

    async init() {
        // OPTIMIZATION: Enable Smart Rendering
        this.enableSmartRendering = true;

        // 1. Validate Data
        if (!this.tuning || !this.tuning.items) {
            console.error("❌ Missing Level Data for PackingPuzzle");
            return;
        }

        this.determineLayout();

        // 2. State
        this.crateItems = [];
        this.flags = {
            explaining: true,
            coatShaken: false,
            statueExamined: false,
            axleBroken: false
        };
        this.maxMass = this.tuning.maxLoad || 100;
        this.maxVolume = this.tuning.maxVolume || 100;
        // Track Character States (0 = Default/Idle)
        // Haddock: 0=Idle, 1=Panic, 2=Push, 3=Angry
        // Calculus: 0=Idle, 1=Happy, 2=Lecture, 3=Confused
        // Snowy:    0=Idle, 1=Bark,  2=Jump,    3=Sniff
        this.actorStates = {
            haddock: 0,
            calculus: 2,
            snowy: 0
        };

        // 3. Dynamic Preload
        const assetsToLoad = new Set([
            'g03_bg_hallway', 'g03_bg_crate_inner',
            'g03_sprite_haddock', 'g03_sprite_calculus', 'g03_sprite_snowy'
        ]);
        this.tuning.items.forEach(i => {
            assetsToLoad.add(i.assetId);
            if (i.altAssetId) assetsToLoad.add(i.altAssetId); // <--- Preload the empty coat
        });
        await this.preload(Array.from(assetsToLoad));

        // 4. Setup UI (Middleware)
        this.setupInterface(['MOVE', 'LOOK', 'SHAKE']);

        // --- Create and inject the entire meters panel for this game ---
        const topRow = this.uiRoot.querySelector('.top-row-container');
        if (topRow) {
            const metersPanel = document.createElement('div');
            metersPanel.className = 'meters-panel';
            metersPanel.innerHTML = `
                <div class="meter-row"><span class="meter-label">VOL</span><div class="bar-bg"><div id="bar-vol" style="width:0%"></div></div></div>
                <div class="meter-row"><span class="meter-label">MASS</span><div class="bar-bg"><div id="bar-mass" style="width:0%"></div></div></div>
            `;
            topRow.appendChild(metersPanel);
        }

        // 5. Setup Scene
        // Populate Inventory from JSON
        this.tuning.items.forEach(itemData => {
            // Clone data to avoid mutating original config
            const item = { ...itemData, inCrate: false };
            this.addInventoryItem(item);
        });

        this.crateZone = this.layout.crateZone;

        // 6. Intro
        this.showDialogue("We need to hide the <b>Zlatanium</b> in this crate. We need <b>High Volume</b> but <b>Low Mass</b>!", 
            "calculus", { animate: true, disableTypewriter: true, comicTransition: true });
        this.triggerRefresh();
    }


    determineLayout() {
        super.determineLayout();
        // Update Crate Zone from the new layout
        if (this.layout && this.layout.crateZone) {
            this.crateZone = this.layout.crateZone;
        }
    }


    /**
     * Override Middleware SelectVerb to refresh
     */
    selectVerb(verb, btn) {
        super.selectVerb(verb, btn);
        this.triggerRefresh();
    }

    handleVerbAction(verb, item) {
        if (this.flags.axleBroken) return;
        this.triggerRefresh(); // Visual change likely

        switch (verb) {
            case 'LOOK':
                this.performLook(item);
                break;
            case 'SHAKE':
                this.performShake(item);
                break;
            case 'MOVE':
                // Logic: If in inventory, move to crate. If in crate, move back.
                // For this puzzle, we simply Click-to-Move instead of Drag-and-Drop
                // to simplify mobile interaction, or we can use the Drag logic from middleware.
                // Let's implement a simple toggle for now:
                if (item.inCrate) {
                    this.moveFromCrateToInventory(item);
                } else {
                    this.moveFromInventoryToCrate(item);
                }
                break;
        }

        // Hide the dialogue and reset calculus expression to non-explaining state after player has taken some action
        if (this.flags.explaining) {
            setTimeout( () => {
                if (!this.flags.explaining) return;
                this.flags.explaining = false;
                this.hideDialogue();
                this.actorStates.calculus = 0;
                this.triggerRefresh();
            }, 2500);
        }
    }

    /**
     * Game Logic: Moving Item TO Crate
     */
    moveFromInventoryToCrate(item) {
        // Rule: Rock Clunk check
        if (item.id === 'rock') {
            const hasPadding = this.crateItems.some(i => i.id === 'sponges' || i.id === 'coat');
            if (!hasPadding) {
                this.flags.explaining = true;
                this.actorStates.calculus = 2;
                this.showDialogue("<b>CLUNK!</b><br>You can't drop the rock on bare wood! Padding needed!", 
                    "calculus", {animate: true, disableTypewriter: true});
                this.triggerHaptic(200);
                this.triggerRefresh();
                return;
            }
        }

        // Logic
        item.inCrate = true;
        this.crateItems.push(item);
        
        if(item.uiElement) item.uiElement.style.opacity = '0.3'; 

        this.actorStates.haddock = 2; 
        this.actorStates.snowy = 3;
        this.triggerRefresh();

        setTimeout(() => {
            if (this.actorStates.haddock === 2) this.actorStates.haddock = 0;
            this.triggerRefresh(); // Redraw idle haddock
        }, 500);

        setTimeout(() => {
            if (this.actorStates.snowy === 3) this.actorStates.snowy = 0;
            this.triggerRefresh(); // Redraw idle snowy
        }, 1200);

        this.recalculatePhysics();
    }

    moveFromCrateToInventory(item) {
        // Logic: If in inventory, move to crate. If in crate, move back.
        // For this puzzle, we simply Click-to-Move instead of Drag-and-Drop
        if (item.id === 'rock' && this.crateItems.some(i => i.id === 'rock')) {
            // Check logic if needed
        }

        item.inCrate = false;
        this.crateItems = this.crateItems.filter(i => i !== item);
        
        if(item.uiElement) item.uiElement.style.opacity = '1'; 

        this.recalculatePhysics();
        this.triggerRefresh();
    }

    performLook(item) {
        // Default to the standard description
        let textToShow = item.desc;

        // Check for special "Inspect" text (e.g., the Statue)
        if (item.id === 'statue' && !this.flags.statueExamined) {
            // Use the text from JSON if it exists, otherwise fallback (safety)
            textToShow = item.desc_inspect || "It's actually hollow chocolate! (Mass: LOW)";
            this.flags.explaining = false;
            
            item.mass = 2; // Discovery!
            this.flags.statueExamined = true;
            this.recalculatePhysics(); // Update meters immediately
        }

        if (item.id === 'coat' && this.flags.coatShaken) {
            textToShow = item.descAlt;
        }
        
        this.showDialogue(textToShow, "tintin", {animate: true, disableTypewriter: true});
        this.triggerRefresh();
    }

    performShake(item) {
        if (item.id === 'coat' && !this.flags.coatShaken) {
            // SET REACTION
            this.actorStates.haddock = 1; // Frame 1: Panic
            
            // Use text from JSON
            const textToShow = item.desc_shake || "Something heavy fell out!";
            this.showDialogue(textToShow, "haddock", {animate: true, disableTypewriter: true});
            
            // LOGIC CHANGE
            item.mass = 10; 
            this.flags.coatShaken = true;
            this.flags.explaining = false;
            
            // VISUAL CHANGE: Swap the asset ID
            if (item.altAssetId) {
                item.assetId = item.altAssetId;
                // Force a UI refresh for the inventory icon
                if (item.uiElement) {
                    item.uiElement.innerHTML = ''; 
                    const newAsset = this.assetManager.get(item.assetId);
                    if (newAsset) {
                        const icon = newAsset.cloneNode(true);
                        icon.classList.add('inv-icon');
                        item.uiElement.appendChild(icon);
                    }
                }
            }
            this.triggerRefresh();

            setTimeout(() => {
                this.resetActors();
                this.triggerRefresh();
            }, 2000);
        } else {
            this.showDialogue("Nothing happens.", "tintin", {animate: true, disableTypewriter: true});
        }
        this.recalculatePhysics();
    }

    recalculatePhysics() {
        const currentMass = this.crateItems.reduce((sum, i) => sum + (i.mass || 0), 0);
        const currentVol = this.crateItems.reduce((sum, i) => sum + (i.volume || 0), 0);

        this.updateMetersUI(currentMass, currentVol);

        // --- FAIL STATE: AXLE BREAK ---
        if (currentMass > this.maxMass) {
            this.flags.axleBroken = true;
            this.flags.explaining = true;
            
            // 1. SET REACTIONS
            this.actorStates.haddock = 3;  // Angry
            this.actorStates.calculus = 3; // Shocked
            this.actorStates.snowy = 1;    // Barking
            this.triggerHaptic(200);
            this.triggerRefresh();

            // 2. SMART HINTS (Contextual)
            // Default generic message
            let failMsg = "<b>SNAP!</b> The axle broke! It's too heavy! We need <b>High Volume, Low Mass</b>.";
            let speaker = "calculus";

            // Check if the "Trap" items are inside and unsolved
            const coatInCrate = this.crateItems.find(i => i.id === 'coat');
            const statueInCrate = this.crateItems.find(i => i.id === 'statue');

            // PRIORITY 1: The Coat (It's deceptively heavy)
            if (coatInCrate && !this.flags.coatShaken) {
                failMsg = "<b>SNAP!</b><br>Haddock: 'Thundering Typhoons! Why is my coat so heavy? <b>Did I leave something in the pockets?</b>'";
                speaker = "haddock";
            } 
            // PRIORITY 2: The Statue (It looks like solid gold)
            else if (statueInCrate && !this.flags.statueExamined) {
                failMsg = "<b>SNAP!</b><br>Calculus: 'That statue is incredibly dense! <b>If only it wasn't solid gold...</b> maybe we should inspect it?'";
                speaker = "calculus";
            }

            this.flags.explaining = false;
            this.showDialogue(failMsg, speaker, {animate: true, disableTypewriter: true});

            setTimeout(() => {
                this.resetPuzzle();
                this.triggerRefresh();
            }, 4000);
            return;
        }

        // --- WIN STATE ---
        const hasRock = this.crateItems.some(i => i.id === 'rock');
        const hasCoat = this.crateItems.some(i => i.id === 'coat');
        const hasStatue = this.crateItems.some(i => i.id === 'statue');

        // 1. Require the core puzzle items to actually be in the crate
        // 2. Enforce the narrative flags (must be shaken/examined)
        // 3. Use the dynamic maxVolume from levels.json (100) instead of the hardcoded 90
        if (hasRock && hasCoat && hasStatue && this.flags.coatShaken && this.flags.statueExamined && currentVol >= this.maxVolume) { 
            this.actorStates.calculus = 1; // Happy
            this.actorStates.haddock = 0;  // Relieved
            this.actorStates.snowy = 3;    // Sniffing
            
            this.showDialogue("Calculus: 'Brilliant! High Volume, Low Mass. A perfect disguise!'", "calculus", {
                animate: true,
                onTypeWriterComplete: () => {
                    setTimeout(() => this.win(), 2000);
                }
            });
            this.triggerRefresh();
        }
    }

    resetActors() {
        this.actorStates = { haddock: 0, calculus: 0, snowy: 0 };
    }

    updateMetersUI(mass, vol) {
        // Quick Hack: If meters don't exist, create them in the SCUMM bar
        let panel = this.uiRoot.querySelector('.meters-panel');
        if (!panel) {
            const scummBar = this.uiRoot.querySelector('.scumm-bar');
            if(scummBar) {
                // Ensure layout matches Middleware expectation if reconstructed
            }
        }
        
        // Safety check if panel exists
        if (!this.uiRoot.querySelector('#bar-mass')) return;

        const mPct = Math.min(100, (mass / this.maxMass) * 100);
        const vPct = Math.min(100, (vol / this.maxVolume) * 100);

        this.uiRoot.querySelector('#bar-mass').style.width = `${mPct}%`;
        this.uiRoot.querySelector('#bar-mass').style.backgroundColor = mPct > 90 ? 'red' : '#e74c3c';
        
        this.uiRoot.querySelector('#bar-vol').style.width = `${vPct}%`;
    }

    resetPuzzle() {
        this.flags.axleBroken = false;
        
        // 3. RESET ACTORS (Crucial cleanup)
        this.actorStates = { haddock: 0, calculus: 0, snowy: 0 };

        // Move items back
        this.crateItems.forEach(i => {
            if(i.uiElement) i.uiElement.style.opacity = '1';
            i.inCrate = false;
        });
        this.crateItems = [];
        
        this.recalculatePhysics();
        this.triggerRefresh();
    }

    draw(ctx) {
        // 1. Background
        const bg = this.assetManager.get('g03_bg_hallway'); 
        if (bg) ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        // Draw Characters
        // We pass the current STATE index to the helper
        ['haddock', 'calculus', 'snowy'].forEach((charName) => {
            const config = this.layout.characters[charName]; // Read from levels.json
            const state = this.actorStates[charName];        // Read current emotion (0, 1, 2, 3)

            // Safety check: ensure config exists before drawing
            if (config) {
                this.drawCharacter(ctx, `g03_sprite_${charName}`, config.x, config.y, state);
            }
        });

        // 2. Crate (FIXED KEY)
        const crate = this.assetManager.get('g03_bg_crate_inner'); // <--- Was 'bg_crate_inner'
        if (crate) ctx.drawImage(crate, this.crateZone.x, this.crateZone.y, this.crateZone.w, this.crateZone.h);

        // 3. Draw Items inside Crate
        const stack = this.layout.stacking; // Short reference

        this.crateItems.forEach((item, index) => {
            const img = this.assetManager.get(item.assetId); // This will now pick up the "Empty" coat if changed
            if (img) {
                // Use Configurable Offsets
                const x = this.crateZone.x + stack.startX + (index * stack.stepX);
                const y = (this.crateZone.y + this.crateZone.h) - stack.startY - (index * stack.stepY);
                
                ctx.drawImage(img, x, y, 64, 64);
            }
        });
    }

    // Helper function to draw a sprite frame
    drawCharacter(ctx, assetId, x, y, frameIndex = 0) {
        const sheet = this.assetManager.get(assetId);
        if (!sheet) return;

        // Sprite Sheet Specs: 512x512 total, 2x2 grid, 256x256 frames
        const frameW = 256;
        const frameH = 256;
        const cols = 2; // 2 columns in the sheet

        // Calculate Grid Position (0=TopLeft, 1=TopRight, 2=BtmLeft, 3=BtmRight)
        const col = frameIndex % cols; 
        const row = Math.floor(frameIndex / cols);

        const sx = col * frameW;
        const sy = row * frameH;

        // Draw
        ctx.drawImage(sheet, sx, sy, frameW, frameH, x, y, 200, 200);
    }
}
