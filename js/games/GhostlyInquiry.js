/* =========================================
   js/games/GhostlyInquiry.js
   Game 07: Haddock's "Ghostly" Inquiry
   Archetype: "The Science Lens"
   Updates: Smooth "Hold" Animations, Mobile Fixes, QuizOverlay Integration
   ========================================= */

import { Game } from '../Game.js';
import { ParticleSystem } from '../components/ParticleSystem.js';
import { QuizOverlay } from '../components/QuizOverlay.js';

export class GhostlyInquiry extends Game {

    async init() {
        this.enableSmartRendering = true;

        // 1. Setup State
        this.phase = 'INTRO'; 
        this.particles = [];
        this.lenses = [];
        
        // Initialize the Quiz component
        this.quizUI = new QuizOverlay(this.uiRoot, this.assetManager);
        
        // Animation Timer (Loops every 6 seconds)
        this.animTimer = 0;
        this.LOOP_DURATION = 10.0;
        this.HOLD_START = 7.0; // Stop moving/fading after 3s

        // 2. Preload
        await this.preload([
            'g07_kitchen_bg', 'ui_lens_frame'
        ]);

        // 3. Intro
        this.showDialogue(
            "This is madness! If I catch this 'smoke' on the lid, it turns into silver rain. But where did the 'rock' go? Did it vanish into thin air?",
            "haddock",
            {
                onClose: () => { 
                    if(this.phase === 'INTRO') this.startQ1();
                    else if(this.phase === 'MID_DIALOGUE') this.startQ2();
                },
                animate: true, comicTransition: true
            }
        );

        this.triggerRefresh();
    }

    destroy() {
        if (this.quizUI) this.quizUI.remove();
        super.destroy();
    }

    startQ1() {
        this.hideDialogue();
        this.showDialogue("No, Captain! This is the Law of Conservation of Mass. Even though it's a gas now, the atoms...", "tintin", 
            {
                onTypeWriterComplete: () => {
                    const cy = this.SAFE_HEIGHT / 2 - 100;
                    const gap = 300;
                    const startX = (this.SAFE_WIDTH / 2) - gap;
                    this.animTimer = 0;
                    this.phase = 'Q1';

                    this.lenses = [
                        { id: 'A', x: startX, y: cy, r: 110, type: 'SHRINK', label: "A) Atoms Shrunk", particleSys: new ParticleSystem(this.assetManager) },
                        { id: 'B', x: startX + gap, y: cy, r: 110, type: 'CONSERVE', label: "B) Atoms Spread", particleSys: new ParticleSystem(this.assetManager) }, 
                        { id: 'C', x: startX + (gap*2), y: cy, r: 110, type: 'VANISH', label: "C) Atoms Vanished", particleSys: new ParticleSystem(this.assetManager) }
                    ];

                    // Init Particles
                    this.resetParticles();
                }, 
                comicTransition: true,
                animate:true
            }
        );
    }

    /**
     * Resets particles to their starting center positions.
     * Called at start and every loop cycle.
     */
    resetParticles() {
        this.lenses.forEach(lens => {
            lens.particleSys.clear();
            
            for(let i=0; i<30; i++) {
                // Random position inside lens
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * (lens.r * 0.8);
                const startX = Math.cos(angle) * r;
                const startY = Math.sin(angle) * r;
                
                lens.particleSys.emit({
                    count: 1,
                    x: startX,
                    y: startY,
                    vx: (Math.random() - 0.5) * 3, // Base drift velocity
                    vy: (Math.random() - 0.5) * 3,
                    r: 6,
                    color: '#E0F7FA',
                    life: 999,
                    maxLife: 999,
                    custom: {
                        origX: startX, // Remember start for resetting / jittering
                        origY: startY
                    },
                    onUpdate: (p, dt) => {
                        // Calculate transition progress (0.0 to 1.0) over the first 3 seconds
                        const progress = Math.min(1.0, this.animTimer / this.HOLD_START);

                        // 1. SHRINK: Smoothly scale down, then hold
                        if (lens.type === 'SHRINK') {
                            // Lerp from 1.0 to 0.3
                            p.scale = 1.0 - (1 * progress);
                            
                            // Gentle jiggle even while holding
                            p.x = p.origX + (Math.random()-0.5) * 2;
                            p.y = p.origY + (Math.random()-0.5) * 2;
                        }
                        
                        // 2. VANISH: Smoothly fade out, then hold invisible
                        else if (lens.type === 'VANISH') {
                            // Lerp Opacity 1.0 to 0.0 using the system's life mechanic
                            p.maxLife = 1.0;
                            p.life = 1.0 - progress;
                            
                            // Drift slightly
                            p.x += p.vx * dt;
                            p.y += p.vy * dt;
                        }

                        // 3. SPREAD (Conserve): Move outward continually
                        else if (lens.type === 'CONSERVE') {
                            // Move away from center
                            // We multiply by dt to make it frame-rate independent
                            // We DO NOT stop moving during hold, so they drift off-screen (Empty)
                            const speed = 0.85; 
                            p.x += (p.x * speed * dt); 
                            p.y += (p.y * speed * dt);
                        }
                    }
                });
            }
        });
    }

    startQ2() {
        this.phase = 'Q2';
        this.lenses = []; 
        this.hideDialogue();
        this.showDialogue(
            "And why does this lid get so hot while I hold it? It’s like the gas is fighting me!", 
            "haddock",
            {
                onClose: () => { this.calculusQ2Answer(); },
                comicTransition: true,
                animate: true 
            }
        );
        this.triggerRefresh();
    }

    calculusQ2Answer() {
        this.hideDialogue();
        this.showDialogue(
            "Because, my dear friend, as the gas turns back into a liquid, it must <i>release</i> the energy it took from the stove! That's why the lid is heating up.<br><br> We call this process of gas turning back into liquid...", 
            "calculus",
            {
                onTypeWriterComplete: () => {
                    this.quizUI.show([
                        { 
                            text: "Evaporation", 
                            correct: false, 
                            onSelect: (isCorrect) => this.handleQ2Answer({ correct: isCorrect, wrongText: "Evaporation is the reverse process where liquid changes into gas" }) 
                        },
                        { 
                            text: "Condensation", 
                            correct: true, 
                            onSelect: (isCorrect) => this.handleQ2Answer({ correct: isCorrect }) 
                        },
                        { 
                            text: "Melting", 
                            correct: false, 
                            onSelect: (isCorrect) => this.handleQ2Answer({ correct: isCorrect, wrongText: "Melting is when a solid changes to a liquid" }) 
                        }
                    ], null, { keepOpenOnWrong: true });
                    
                    this.triggerRefresh();
                }, 
                animate: true 
            }
        );
    }

    update(dt) {
        super.update(dt);

        // --- LOOP LOGIC ---
        this.animTimer += dt;
        if (this.animTimer > this.LOOP_DURATION) {
            this.animTimer = 0;
            if (this.phase === 'Q1') this.resetParticles(); // Snap back to start
        }

        if (this.phase === 'Q1') {
            if (this.animTimer <= this.HOLD_START) {
                // Delegate logic directly to ParticleSystem component
                this.lenses.forEach(lens => lens.particleSys.update(dt));
                this.triggerRefresh();
            }
        }
    }

    onPointerDown(e) {
        super.onPointerDown(e); 
        const { x, y } = this.input;

        if (this.phase === 'Q1') {
            this.lenses.forEach(lens => {
                const dx = x - lens.x;
                const dy = y - lens.y;
                if (Math.sqrt(dx*dx + dy*dy) < lens.r) {
                    this.handleQ1Answer(lens);
                }
            });
        }
    }

    handleQ1Answer(lens) {
        if (lens.type === 'CONSERVE') {
            this.triggerHaptic(20);
            this.phase = 'MID_DIALOGUE';
            this.lenses = []; 
            this.showDialogue("Exactly! The atoms are the same size, just moving faster and further apart!", 
                "tintin",
                {
                    onClose: () => { this.startQ2(); },
                    animate: true 
                });
            this.triggerRefresh();
        } else if (lens.type === 'SHRINK') {
            this.showDialogue("No, Captain! Atoms themselves don't change size. They just move further apart from each other!", 
                "tintin",
                {
                    animate: true,
                    disableTypewriter: true
                });
            this.triggerHaptic(100); 

        } else {
            // INCORRECT: VANISHED
            this.showDialogue("Impossible! Matter cannot be created or destroyed. It must have gone somewhere...", 
                "tintin",
                {
                    animate: true,
                    disableTypewriter: true
                });
            this.triggerHaptic(100); 
        }
    }

    handleQ2Answer(btn) {
        if (btn.correct) {
            this.phase = 'WIN';
            this.showDialogue("<b>Calculus:</b> Precisely! Condensation! The gas gives up heat to become liquid. That is why the lid burns!", 
                "calculus", 
                 { 
                    animate: true,
                    comicTransition: true,
                    onClose: () => {
                        this.win();
                    }
                 });
            this.triggerRefresh();
        } else {
            this.showDialogue("<b>Calculus:</b> No, no, that is not correct<br>" + btn.wrongText, 
                "calculus",
                {
                    animate: true,
                    disableTypewriter: true
                });
            this.triggerHaptic(100);
            this.triggerRefresh();
        }
    }

    draw(ctx) {
        const bg = this.assetManager.get('g07_kitchen_bg');
        if(bg) ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        // Dark Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        if (this.phase === 'Q1') {

            this.lenses.forEach(lens => {
                ctx.save();
                ctx.translate(lens.x, lens.y);

                // Lens Background (Always drawn, so it doesn't flicker)
                ctx.beginPath();
                ctx.arc(0, 0, lens.r - 5, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fill();
                ctx.save(); 
                ctx.clip(); 

                // Particles (Delegated to Component)
                ctx.shadowColor = '#00E5FF';
                ctx.shadowBlur = 10;
                
                lens.particleSys.draw(ctx);
                
                ctx.restore();

                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;

                // Lens Frame
                const frameImg = this.assetManager.get('ui_lens_frame');
                if (frameImg) {
                    ctx.drawImage(frameImg, -lens.r, -lens.r, lens.r * 2, lens.r * 2);
                } else {
                    ctx.beginPath(); ctx.arc(0, 0, lens.r, 0, Math.PI*2); 
                    ctx.lineWidth = 10; ctx.strokeStyle = '#B0BEC5'; ctx.stroke();
                }

                // Label
                ctx.fillStyle = '#fff';
                ctx.font = "bold 18px Arial";
                ctx.textAlign = 'center';
                ctx.fillText(lens.label, 0, lens.r + 30);

                ctx.restore();
            });
        }

        // Dark overlay
        if (this.dialogueShowing) { 
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }
    }
}
