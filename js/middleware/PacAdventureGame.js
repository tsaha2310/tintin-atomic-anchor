/* =========================================
   js/middleware/PacAdventureGame.js
   Archetype: Point-and-Click Adventure
   Responsibility: Handles Verbs, Inventory UI, and Input routing.
   ========================================= */

import { Game } from '../Game.js';

export class PacAdventureGame extends Game {

    constructor(config) {
        super(config);
        this.selectedVerb = 'MOVE'; // Default
        this.inventory = [];
        this.verbs = ['MOVE', 'LOOK', 'SHAKE']; // Configurable
    }

    /**
     * Sets up the DOM structure for an Adventure Game
     * 1. Stage (Canvas area)
     * 2. SCUMM Bar (Verbs + Inventory)
     */
    setupInterface(verbs = []) {
        if (verbs.length > 0) this.verbs = verbs;

        // 1. CRITICAL: Preserve the Dialogue Overlay logic from index.html
        // We detach it before clearing the UI, then add it back.
        let existingHud = this.uiRoot.querySelector('#game-hud'); // Preserve HUD if you use it (optional)

        // Detach safely
        if (existingHud && existingHud.parentNode) existingHud.remove();

        // 2. Clear Previous UI Safely
        this.clearDynamicUI();

        // 3. Re-attach preserved elements
        if (existingHud) this.uiRoot.appendChild(existingHud);

        // 4. Build Adventure Layout
        const container = document.createElement('div');
        container.className = 'adventure-layout'; // Defined in css/packing_puzzle.css

        // 5. Stage Area (Transparent, sits over Canvas)
        const stage = document.createElement('div');
        stage.className = 'adventure-stage';
        this.stage = stage;

        // 6. SCUMM Bar
        const scummBar = document.createElement('div');
        scummBar.className = 'scumm-bar';

        // --- NEW: Wrapper for Top Row (Verbs + Meters) ---
        const topRow = document.createElement('div');
        topRow.className = 'top-row-container';

        // 6a. Verb Bank
        const verbBank = document.createElement('div');
        verbBank.className = 'verb-bank';
        this.verbs.forEach(verb => {
            const btn = document.createElement('button');
            btn.className = 'verb-btn';
            if (verb === this.selectedVerb) btn.classList.add('selected');
            btn.textContent = verb;
            btn.dataset.verb = verb;
            
            btn.addEventListener('click', () => this.selectVerb(verb, btn));
            verbBank.appendChild(btn);
        });

        // 6c. Meters Panel (Create placeholder, filled later by Game)
        const metersPanel = document.createElement('div');
        metersPanel.className = 'meters-panel';
        // Add default structure so CSS has something to target immediately
        metersPanel.innerHTML = `
            <div class="meter-row"><span class="meter-label">VOL</span><div class="bar-bg"><div id="bar-vol" style="width:0%"></div></div></div>
            <div class="meter-row"><span class="meter-label">MASS</span><div class="bar-bg"><div id="bar-mass" style="width:0%"></div></div></div>
        `;

        // Add to top row wrapper
        topRow.appendChild(verbBank);
        topRow.appendChild(metersPanel);

        // 6b. Inventory Grid
        const invGrid = document.createElement('div');
        invGrid.className = 'inventory-grid';
        this.invGrid = invGrid;

        scummBar.appendChild(topRow);
        scummBar.appendChild(invGrid);
        
        container.appendChild(stage);
        container.appendChild(scummBar);
        this.uiRoot.appendChild(container);
    }


    selectVerb(verb, btnElement) {
        this.selectedVerb = verb;
        
        // Visual Toggle
        const all = this.uiRoot.querySelectorAll('.verb-btn');
        all.forEach(b => b.classList.remove('selected'));
        if (btnElement) btnElement.classList.add('selected');
        
        console.log(`🕹️ Verb Selected: ${verb}`);
    }

    /**
     * Adds an item to the visual inventory grid
     * @param {Object} item - Data object from levels.json
     */
    addInventoryItem(item) {
        this.inventory.push(item);
        
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        slot.dataset.id = item.id;

        // Render Asset
        const asset = this.assetManager.get(item.assetId);
        if (asset) {
            // Check for Greybox (Canvas) vs Real Image
            const icon = (asset instanceof HTMLCanvasElement) 
                ? asset 
                : asset.cloneNode(true);
            
            icon.classList.add('inv-icon');
            slot.appendChild(icon);
        } else {
            slot.textContent = item.id; // Fallback
        }

        // Interaction
        slot.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent canvas click
            this.handleVerbAction(this.selectedVerb, item);
        });

        this.invGrid.appendChild(slot);
        item.uiElement = slot; // Link for later removal/updates
    }

    /**
     * Safely removes an item from the visual inventory grid and the internal array
     * @param {Object} itemData - Data object to remove
     */
    removeInventoryItem(itemData) {
        // Prevent crashes if the item has already been removed or is undefined
        if (!itemData) return; 
        
        // Remove from internal tracking array
        this.inventory = this.inventory.filter(i => i.id !== itemData.id);
        
        // Remove from DOM
        if (itemData.uiElement && itemData.uiElement.parentNode) {
            itemData.uiElement.parentNode.removeChild(itemData.uiElement);
        }
    }

    /**
     * Override this in the concrete class to handle logic
     */
    handleVerbAction(verb, item) {
        console.warn(`Unhandled Action: ${verb} on ${item.id}`);
    }

    destroy() {
        try {
            // 1. Safely remove all inventory items from the UI
            if (this.inventory) {
                // Clone the array to iterate safely while items are being deleted
                [...this.inventory].forEach(item => this.removeInventoryItem(item));
            }
        } catch (err) {
            console.error( err );
        }

        try {
            // 2. Scrub the DOM of dynamically injected Verb buttons and Containers
            const dynamicUI = this.uiRoot.querySelectorAll('.verb-btn, #verb-container, .verb-container, #inventory-container, .inventory-container');
            dynamicUI.forEach(el => el.remove());
        } catch (err) {
            console.error( err );
        }

        // 3. Ensure the dialogue system is shut down and the overlay is hidden
        this.hideDialogue();

        super.destroy();
    }
}
