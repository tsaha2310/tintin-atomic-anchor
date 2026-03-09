/* =========================================
   js/middleware/PhysicsGame.js
   Middleware for Physics-based Action Games
   Inherits from: Game
   Dependency: Matter.js
   ========================================= */

import { Game } from '../Game.js';

export class PhysicsGame extends Game {
    
    constructor(config) {
        // 1. We MUST define these before super() if we want to be safe, 
        // or just let initSystem handle them.
        // In JS, we can't use 'this' before super(), so we just rely on initSystem.
        super(config);

        // REMOVED: this.engine = null; 
        // REMOVED: this.world = null;
        // Keeping this one is fine because initSystem doesn't set it:
        this.bodies = []; 
    }

    initSystem() {
        // 1. Initialize Matter.js Engine
        // We do NOT use the Matter.Render module because we have our own
        // specific "Safe Zone" renderer in the Base Game class.
        this.engine = Matter.Engine.create();
        this.world = this.engine.world;

        // 2. Configure Gravity (Optional tuning from JSON)
        this.engine.gravity.y = this.tuning.gravity ?? 1;

        // 3. Call Parent Init (Listeners, Resize)
        super.initSystem();
    }

    /**
     * Completely wipes the physics world, engine state, and event listeners.
     * Call this at the start of a child class's init() for a clean restart.
     */
    clearPhysics() {
        if (this.world) {
            Matter.World.clear(this.world);
        }
        if (this.engine) {
            Matter.Engine.clear(this.engine);
            // This safely removes ALL lingering collision events
            Matter.Events.off(this.engine); 
        }
        // Wipe the local bodies array
        this.bodies = [];
    }

    update(dt) {
        // Step the Physics Engine
        // Matter.js uses a fixed timestep for stability
        Matter.Engine.update(this.engine, 1000 / 60);
    }

    /* =========================================
       HELPER: SAFE ZONE SCALING
       Matter.js runs in "World Units" (1024x768).
       We don't need to scale coordinates here because 
       Game.js handles the canvas transform.
       ========================================= */

    /**
     * Adds a simple rectangular physics body
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} w - Width
     * @param {number} h - Height
     * @param {Object} options - Matter.js options (isStatic, density, etc)
     */
    addBox(x, y, w, h, options) {
        const body = Matter.Bodies.rectangle(x, y, w, h, options);
        Matter.World.add(this.world, body);
        this.bodies.push({ body, type: 'box', w, h, color: options.color || '#fff' });
        return body;
    }

    /**
     * Adds a circular physics body
     */
    addCircle(x, y, r, options) {
        const body = Matter.Bodies.circle(x, y, r, options);
        Matter.World.add(this.world, body);
        this.bodies.push({ body, type: 'circle', r, color: options.color || '#fff' });
        return body;
    }

    /**
     * Debug Draw: Renders wireframes of all physics bodies
     * (Override this in child class if you want sprites)
     */
    draw(ctx) {
        this.bodies.forEach(item => {
            const { position, angle } = item.body;
            
            ctx.save();
            ctx.translate(position.x, position.y);
            ctx.rotate(angle);
            
            ctx.fillStyle = item.color;

            if (item.type === 'box') {
                ctx.fillRect(-item.w / 2, -item.h / 2, item.w, item.h);
            } else if (item.type === 'circle') {
                ctx.beginPath();
                ctx.arc(0, 0, item.r, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        });
    }

    destroy() {
        if (this.world) Matter.World.clear(this.world);
        if (this.engine) Matter.Engine.clear(this.engine);
        super.destroy();
    }
}
