/* =========================================
   js/games/KickTheRock.js
   Game 17: "The Root Wedge"
   Inherits from: PhysicsGame
   ========================================= */

import { PhysicsGame } from '../middleware/PhysicsGame.js';

export class KickTheRock extends PhysicsGame {

    init() {
        // 1. Level Tuning
        const rockMass = this.tuning.rockMass || 50;
        
        // 2. Create World Boundaries (Invisible)
        // Floor
        this.addBox(512, 780, 1024, 50, { isStatic: true, color: '#222' });
        // Walls
        this.addBox(-10, 384, 50, 768, { isStatic: true, color: 'transparent' });
        this.addBox(1034, 384, 50, 768, { isStatic: true, color: 'transparent' });

        // 3. The Obstacle (The Root)
        // A static wedge shape that holds the rock
        this.root = this.addBox(600, 600, 50, 200, { 
            isStatic: true, 
            angle: Math.PI / 4, // 45 degree tilt
            color: '#795548' // Brown
        });

        // 4. The Goal (The Boulder)
        // Dynamic body sitting on the root
        this.rock = this.addCircle(550, 500, 60, { 
            density: 0.05,
            friction: 0.8,
            restitution: 0.2, // Bounciness
            color: '#9E9E9E' // Grey
        });
        
        // 5. Interaction State
        this.swipeStart = null;
        this.showDialogue("That rock is stuck on the root! Give it a solid kick!", "tintin");
    }

    update(dt) {
        super.update(dt); // Step Physics

        // --- SWIPE LOGIC ---
        // We want to detect a "flick" gesture to apply force
        
        if (this.input.justPressed) {
            this.swipeStart = { x: this.input.x, y: this.input.y };
        }

        // On Release: Calculate Vector
        if (!this.input.isDown && this.swipeStart) {
            const dx = this.input.x - this.swipeStart.x;
            const dy = this.input.y - this.swipeStart.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // Minimum swipe distance to count as a "Kick"
            if (dist > 50) {
                this.kickRock(dx, dy);
            }

            this.swipeStart = null; // Reset
        }

        // --- WIN CONDITION ---
        // If rock falls to the floor (y > 700)
        if (this.rock.position.y > 700) {
            if (!this.won) {
                this.won = true;
                this.showDialogue("Great Scott! You cleared the path!", "haddock");
                setTimeout(() => this.win(), 1500);
            }
        }
    }

    kickRock(dx, dy) {
        // 1. Limit Force (So Tintin doesn't launch it into orbit)
        const forceMult = 0.002; 
        const fx = Math.min(Math.max(dx * forceMult, -0.5), 0.5);
        const fy = Math.min(Math.max(dy * forceMult, -0.5), 0.5);

        // 2. Apply Force to Center of Rock
        // Matter.js API: Body.applyForce(body, position, forceVector)
        Matter.Body.applyForce(this.rock, this.rock.position, { x: fx, y: fy });

        // 3. Visual Feedback (Console for now)
        console.log("🦵 KICK!", fx, fy);
    }

    draw(ctx) {
        // Draw Background (Cliff Face)
        ctx.fillStyle = "#cfd8dc";
        ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        // Draw Debug Physics Bodies
        super.draw(ctx);

        // Draw Swipe Line (UI Feedback)
        if (this.input.isDown && this.swipeStart) {
            ctx.beginPath();
            ctx.moveTo(this.swipeStart.x, this.swipeStart.y);
            ctx.lineTo(this.input.x, this.input.y);
            ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
            ctx.lineWidth = 5;
            ctx.stroke();
        }
    }
}
