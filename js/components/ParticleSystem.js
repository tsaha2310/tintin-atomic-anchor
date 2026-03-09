export class ParticleSystem {
    constructor(assetManager) {
        this.particles = [];
        this.assetManager = assetManager;
    }

    /**
     * Spawns particles based on a config object
     */
    emit(config) {
        const count = config.count || 1;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: config.x !== undefined ? config.x : 0,
                y: config.y !== undefined ? config.y : 0,
                vx: config.vx !== undefined ? config.vx : 0,
                vy: config.vy !== undefined ? config.vy : 0,
                r: config.r !== undefined ? config.r : 10,
                life: config.life !== undefined ? config.life : 1.0,
                maxLife: config.life !== undefined ? config.life : 1.0,
                scale: config.scale !== undefined ? config.scale : 1.0,
                color: config.color || '#fff',
                assetId: config.assetId || null,
                onUpdate: config.onUpdate || null,
                ...(config.custom || {}) // Merge any custom props safely
            });
        }
    }

    update(dt) {
        this.particles.forEach(p => {
            p.life -= dt;
            
            // Custom behavior override (e.g., Grid Locking in Captains Exam)
            if (p.onUpdate) {
                // If custom update is provided, it is responsible for applying p.x += p.vx
                p.onUpdate(p, dt);
            } else {
                // Default Physics
                p.x += p.vx;
                p.y += p.vy;
            }
        });

        // Cleanup dead particles
        this.particles = this.particles.filter(p => p.life > 0);
    }

    draw(ctx) {
        this.particles.forEach(p => {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.save();
            ctx.globalAlpha *= alpha;
            ctx.translate(p.x, p.y);
            ctx.scale(p.scale, p.scale);

            if (p.assetId) {
                const img = this.assetManager.get(p.assetId);
                if (img) {
                    const r = p.r || 10; // Use particle's specific radius
                    ctx.drawImage(img, -r, -r, r * 2, r * 2);
                }
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(0, 0, p.r || 8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });
    }
    
    clear() {
        this.particles = [];
    }
}
