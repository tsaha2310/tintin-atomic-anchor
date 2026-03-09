/* =========================================
   js/middleware/LabGame.js
   Fixed: Lazy Initialization for Constructor Safety
   ========================================= */

import { Game } from '../Game.js';

export class LabGame extends Game {
    
    constructor(config) {
        super(config);
        // Note: These lines run AFTER super() returns.
        // But super() calls init(), so we also check these in setupToolbelt.
        if (!this.tools) this.tools = {};
        if (this.activeTool === undefined) this.activeTool = null;
    }

    setupToolbelt(toolList) {
        // FIX: Ensure state exists if called during the super() chain
        if (!this.tools) this.tools = {};
        if (this.activeTool === undefined) this.activeTool = null;

        let toolbelt = this.uiRoot.querySelector('#toolbelt-container');

        // --- Self-Healing DOM Logic ---
        // If previous games wiped the toolbelt during cleanup, recreate it!
        if (!toolbelt) {
            toolbelt = document.createElement('div');
            toolbelt.id = 'toolbelt-container';
            toolbelt.className = 'toolbelt-container'; // Ensure CSS still targets it
            this.uiRoot.appendChild(toolbelt);
        }

        toolbelt.innerHTML = ''; 
        
        toolList.forEach((tool, index) => {
            this.tools[tool.id] = tool;

            const slot = document.createElement('div');
            slot.className = 'tool-slot';
            slot.dataset.toolId = tool.id;
            slot.innerHTML = `<div style="font-size: 24px;">${tool.icon}</div>`;
            
            slot.addEventListener('click', () => this.selectTool(tool.id));
            
            toolbelt.appendChild(slot);

            if (index === 0) this.selectTool(tool.id);
        });

        toolbelt.classList.remove('hidden');
    }

    selectTool(toolId) {
        if (this.activeTool === toolId) return;

        this.activeTool = toolId;
        
        const slots = this.uiRoot.querySelectorAll('.tool-slot');
        slots.forEach(s => {
            if (s.dataset.toolId === toolId) s.classList.add('selected');
            else s.classList.remove('selected');
        });

        console.log(`🧪 LabGame: Switched to ${toolId}`);
        this.onToolChange(toolId); 
    }

    checkPointInRect(point, rect) {
        return (point.x >= rect.x && point.x <= rect.x + rect.w &&
                point.y >= rect.y && point.y <= rect.y + rect.h);
    }

    onToolChange(toolId) {} 
}
