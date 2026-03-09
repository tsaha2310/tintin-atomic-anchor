/* =========================================
   js/middleware/MachineGame.js
   Archetype: Dashboard / Control Panel Games
   Handles inputs for Dials, Buttons, and Levers.
   ========================================= */

import { Game } from '../Game.js';

export class MachineGame extends Game {
    
    constructor(config) {
        super(config);
        this.controls = []; 
        this.draggedControl = null;
    }

    resetControls() {
        this.controls.forEach( (ctrl) => {
            if (ctrl.type == 'dial') ctrl.value = ctrl.initialValue;
        } )
    }

    /**
     * Define a rotating dial (e.g., Stove Knob)
     * @param {String} id 
     * @param {Object} config { x, y, r, assetId, initialValue, max, onChange }
     */
    addDial(id, config) {
        this.controls.push({
            type: 'dial',
            id: id,
            x: config.x, y: config.y, r: config.r,
            value: config.initialValue || 0,
            initialValue: config.initialValue || 0,
            max: config.max || 2, // 0, 1, 2
            assetId: config.assetId,
            onChange: config.onChange
        });
    }

    /**
     * Define a pressable button (e.g., Ice Bucket)
     * @param {String} id 
     * @param {Object} config { x, y, w, h, onPress }
     */
    addButton(id, config) {
        this.controls.push({
            type: 'button',
            id: id,
            x: config.x, y: config.y, w: config.w, h: config.h,
            onPress: config.onPress
        });
    }

    update(dt) {
        // Handle Clicks
        if (this.input.justPressed) {
            this.controls.forEach(c => {
                if (c.type === 'dial') {
                    // Circular Hit Detection
                    const dx = this.input.x - c.x;
                    const dy = this.input.y - c.y;
                    if (Math.sqrt(dx*dx + dy*dy) < c.r) {
                        // Click to rotate clockwise
                        c.value = (c.value + 1);
                        if (c.value > c.max) c.value = 0; // Loop back to 0
                        
                        this.triggerHaptic(15);
                        if (c.onChange) c.onChange(c.value);
                    }
                }
                else if (c.type === 'button') {
                    // Rect Hit Detection
                    if (this.input.x >= c.x && this.input.x <= c.x + c.w &&
                        this.input.y >= c.y && this.input.y <= c.y + c.h) {
                        
                        this.triggerHaptic(20);
                        if (c.onPress) c.onPress();
                    }
                }
            });
        }
    }

    /**
     * Renders controls. 
     * Dials rotate based on value. Buttons are usually invisible (part of BG).
     */
    drawControls(ctx) {
        this.controls.forEach(c => {
            if (c.type === 'dial') {
                const img = this.assetManager.get(c.assetId);
                if (img) {
                    ctx.save();
                    ctx.translate(c.x, c.y);
                    
                    // Calculate Rotation: Map Value 0..Max to Angles
                    // Example: 0 = -45deg, 1 = 0deg, 2 = 45deg
                    // Or simple increments: val * 45deg
                    const stepAngle = (Math.PI / 2); // 90 degrees per step? 
                    // Let's assume 0 is UP (0 rads) for simplicity, or tweak per game.
                    // For Stove: 0(Off)= -90, 1(Low)= 0, 2(High)= +90
                    
                    let angle = 0;
                    if (c.max === 2) {
                        if (c.value === 0) angle = -0.5 * Math.PI; // Left
                        if (c.value === 1) angle = 0;              // Up
                        if (c.value === 2) angle = 0.5 * Math.PI;  // Right
                    }

                    ctx.rotate(angle);
                    ctx.drawImage(img, -c.r, -c.r, c.r*2, c.r*2);
                    ctx.restore();
                }
            }
            // Debug Draw for Buttons (Optional)
            // ctx.strokeStyle = 'red'; ctx.strokeRect(c.x, c.y, c.w, c.h);
        });
    }
}
