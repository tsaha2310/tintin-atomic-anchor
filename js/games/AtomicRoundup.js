/* =========================================
   js/games/AtomicRoundup.js
   Game 11: "The Atomic Roundup"
   Theme: Conservation of Mass (Solid -> Gas/Ash)
   Mechanic: Arcade Collection + Hazard Avoidance + Canvas Timer
   ========================================= */

import { Game } from '../Game.js';
import { CanvasTimer } from '../components/CanvasTimer.js';
import { QuizOverlay } from '../components/QuizOverlay.js';

export class AtomicRoundup extends Game {

    constructor(config) {
        super(config);
        
        this.lay = this.tuning.layout || {};
        this.params = this.tuning.gameplay || {};

        // --- Game State ---
        this.state = 'INTRO'; // INTRO, QUIZ, PLAYING, LOST, WON
        this.score = 0;
        this.targetScore = this.params.targetScore || 100;
        this.tool = 'VACUUM'; 
        this.timeLeft = this.params.timeLimit || 45; 
        
        // --- Physics/Entities ---
        this.particles = [];
        this.wanderingThomsons = []; 
        this.effects = []; // Visual effects (suction lines, dust)
        this.tripStunTimer = 0;
        
        // Input tracking for brush speed
        this.prevInput = { x: 0, y: 0 };

        // CSS Cleanup
        this.styleElement = null;
    }

    async init() {
        this.enableSmartRendering = true;

        // Instantiate Components
        this.timerUI = new CanvasTimer(this.assetManager, 100);
        this.quizUI = new QuizOverlay(this.uiRoot, this.assetManager);

        this.injectCSS();

        await this.preload([
            'g11_lab_bg',
            'g11_particle_smoke', 'g11_particle_ash',
            'g11_tool_vacuum', 'g11_tool_brush',
            'g11_thomson_walking', 'g11_thomson_trip', 
            'g11_scale_base', 'g11_scale_beam', 'g11_scale_pan',
            'g11_scale_weights', 'g11_scale_jar_empty', 'g11_scale_jar_full',
            'ui_timer_body', 'ui_timer_hand' 
        ]);

        this.startIntro();
    }

    injectCSS() {
        if (this.styleElement) this.styleElement.remove();
        this.styleElement = document.createElement('style');
        this.styleElement.innerHTML = `
            /* --- TIME & SCORE HUD --- */
            .top-hud {
                position: absolute; top: 15px; left: 20px; right: 20px;
                display: flex; justify-content: space-between;
                font-family: sans-serif; font-size: 24px; font-weight: bold;
                color: #fff; text-shadow: 2px 2px 4px #000; z-index: 100;
                pointer-events: none;
            }

            /* --- TOOL HUD --- */
            .tool-hud-container {
                position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
                display: flex; gap: 15px; z-index: 100; width: 90%; max-width: 400px;
            }
            .tool-btn {
                flex: 1; padding: 12px; font-size: 16px; font-weight: bold;
                border: 3px solid #fff; border-radius: 12px; background: #333; color: #fff;
                cursor: pointer; transition: all 0.2s; touch-action: manipulation;
                -webkit-tap-highlight-color: transparent;
            }
            .tool-btn.active { background: #0088FF; border-color: #88CCFF; box-shadow: 0 0 15px #0088FF; transform: translateY(-5px); }

            /* --- CSS SCALE COMPONENT --- */
            #css-scale-wrapper {
                position: absolute; bottom: 120px; right: 50px;
                width: 300px; height: 300px; pointer-events: none; z-index: 50;
            }
            .scale-part { position: absolute; background-size: contain; background-repeat: no-repeat; background-position: center; }
            #scale-base { bottom: 0; left: 50%; transform: translateX(-50%); width: 100px; height: 200px; }
            
            #scale-beam-pivot {
                position: absolute; top: 115px; left: 50%; width: 240px; height: 20px;
                transform-origin: center center; transform: translateX(-50%) rotate(-20deg);
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            #scale-beam-img { width: 100%; height: 100%; }
            
            .scale-hang {
                position: absolute; top: 10px; width: 80px; height: 120px;
                transform-origin: top center; transform: rotate(20deg); 
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            #hang-left { left: 10px; top: 2px; transform: translateX(-50%) rotate(20deg); }
            #hang-right { right: 6px; top: 2px; transform: translateX(50%) rotate(20deg); }
            
            .scale-pan { bottom: 0; left: 0; width: 100%; height: 100%; }
            .scale-item { bottom: 24px; left: 50%; transform: translateX(-50%); width: 60px; height: 60px; transition: opacity 0.5s; }
            
            #jar-full { opacity: 0; }

            /* --- TOAST --- */
            .game-toast {
                position: absolute; top: 30%; left: 50%; transform: translateX(-50%);
                background: rgba(200, 0, 0, 0.9); color: white; padding: 15px 30px;
                border-radius: 8px; font-size: 24px; font-weight: bold;
                pointer-events: none; animation: fadeUp 1.5s forwards; z-index: 500;
            }
            @keyframes fadeUp {
                0% { opacity: 0; transform: translate(-50%, 20px) scale(0.8); }
                10% { opacity: 1; transform: translate(-50%, 0) scale(1.1); }
                20% { opacity: 1; transform: translate(-50%, 0) scale(1); }
                80% { opacity: 1; }
                100% { opacity: 0; transform: translate(-50%, -30px); }
            }

            /* MOBILE LANDSCAPE OVERRIDE */
            @media (max-height: 500px) and (orientation: landscape) {
                .tool-hud-container { bottom: 5px; gap: 10px; }
                #css-scale-wrapper { width: 160px; right: 0px; height: 150px; }
                #scale-beam-pivot { top: 40px; }
                #scale-base { height: 100px; }
            }
        `;
        document.head.appendChild(this.styleElement);
    }

    destroy() {
        if (this.styleElement) this.styleElement.remove();
        if (this.quizUI) this.quizUI.remove();
        const scale = this.uiRoot.querySelector('#css-scale-wrapper');
        if (scale) scale.remove();
        super.destroy();
    }

    startIntro() {
        this.stop(); 
        this.showDialogue(
            `There! Your "indivisible bricks" are a fraud! That metal strip had weight. Now it’s just dust and smoke. The weight is deleted!`,
            'haddock', { animate: true, onClose: () => this.startQuiz(), comicTransition: true }
        );
    }

    startQuiz() {
        this.state = 'QUIZ';
        this.showDialogue(
            `If I catch every speck of smoke and ash, will it weigh the same as the metal? Or is smoke just... nothing?`,
            'haddock', { animate: true, disableTypewriter: true, onClose: () => this.createQuizOverlay() }
        );
    }

    createQuizOverlay() {
        // Refactored to use the Component!
        this.quizUI.show([
            { text: "No, smoke is weightless air.", correct: false },
            { text: "Yes! Matter changes form, but weight stays.", correct: true, onSelect: (c) => this.handleQuizAnswer(c) }
        ], null, { keepOpenOnWrong: true });
    }

    handleQuizAnswer(isCorrect) {
        if (isCorrect) {
            this.showDialogue(
                `Precisely! The "bricks" are floating. If we catch them all, the scale will balance perfectly.`,
                'calculus', { animate: true, onClose: () => this.startGameplay() }
            );
        } else {
            this.showDialogue(
                `Blistering barnacles, no! Nothing disappears! It just changes form. Try again!`,
                'haddock', { animate: true, onClose: () => this.createQuizOverlay() } 
            );
        }
    }

    startGameplay() {
        this.state = 'PLAYING';
        this.score = 0;
        this.timeLeft = this.params.timeLimit || 45;
        this.tripStunTimer = 0;

        this.spawnParticles();
        this.createHUD();
        this.createCSSScale();
        this.stop();
        
        this.showDialogue(
            `<b>Time is ticking!</b> Use the <b>Vacuum</b> for smoke and <b>Brush</b> for ash.<br><br>Warning: The Thomsons are wandering around looking for clues. <b>Don't accidentally vacuum them</b> or they'll drop our jar!`,
            'tintin',
             { animate: true, onClose: () => this.start() }
        );
    }

    createHUD() {
        // Clear Previous UI Safely
        this.clearDynamicUI();
        
        // 1. Top HUD
        const top = document.createElement('div');
        top.className = 'top-hud';
        top.innerHTML = `<span id="score-text">Atoms: 0 / ${this.targetScore}</span>`;
        this.uiRoot.appendChild(top);

        // 2. Bottom Tools
        const tools = document.createElement('div');
        tools.className = 'tool-hud-container';
        tools.id = 'tool-hud';

        const makeBtn = (type, label) => {
            const btn = document.createElement('button');
            btn.innerHTML = label;
            btn.className = `tool-btn ${type === this.tool ? 'active' : ''}`;
            btn.id = `btn-${type}`;
            btn.onclick = (e) => { e.stopPropagation(); this.setTool(type); };
            return btn;
        };

        tools.appendChild(makeBtn('VACUUM', '💨 Vacuum'));
        tools.appendChild(makeBtn('BRUSH', '🧹 Brush'));
        this.uiRoot.appendChild(tools);
    }

    createCSSScale() {
        const getSrc = (id) => this.assetManager.get(id)?.src || '';

        const scaleHTML = `
            <div id="css-scale-wrapper">
                <div id="scale-base" class="scale-part" style="background-image: url('${getSrc('g11_scale_base')}')"></div>
                
                <div id="scale-beam-pivot">
                    <div id="scale-beam-img" class="scale-part" style="background-image: url('${getSrc('g11_scale_beam')}')"></div>
                    
                    <div id="hang-left" class="scale-hang">
                        <div class="scale-part scale-pan" style="background-image: url('${getSrc('g11_scale_pan')}')"></div>
                        <div class="scale-part scale-item" style="background-image: url('${getSrc('g11_scale_weights')}')"></div>
                    </div>
                    
                    <div id="hang-right" class="scale-hang">
                        <div class="scale-part scale-pan" style="background-image: url('${getSrc('g11_scale_pan')}')"></div>
                        <div id="jar-empty" class="scale-part scale-item" style="background-image: url('${getSrc('g11_scale_jar_empty')}')"></div>
                        <div id="jar-full" class="scale-part scale-item" style="background-image: url('${getSrc('g11_scale_jar_full')}')"></div>
                    </div>
                </div>
            </div>
        `;
        
        const template = document.createElement('template');
        template.innerHTML = scaleHTML.trim();
        this.uiRoot.appendChild(template.content.firstChild);
    }

    setTool(type) {
        if (this.tripStunTimer > 0) return; 
        this.tool = type;
        this.triggerHaptic(15);
        this.uiRoot.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        this.uiRoot.querySelector(`#btn-${type}`).classList.add('active');
    }

    spawnParticles() {
        this.particles = [];
        const count = this.params.particleCount || 100;
        const tableY = this.lay.tableY || 550;

        for(let i=0; i<count; i++) {
            const isSmoke = i < (count/2); 
            this.particles.push({
                type: isSmoke ? 'SMOKE' : 'ASH',
                x: Math.random() * (this.SAFE_WIDTH - 200), 
                y: isSmoke ? Math.random() * (tableY - 100) : tableY + (Math.random() * 80),
                vx: isSmoke ? (Math.random() - 0.5) * 60 : 0,
                vy: isSmoke ? (Math.random() - 0.5) * 30 : 0,
                active: true, 
                rotation: Math.random() * 6.28,
                scale: 1.0 // For vacuum shrinking effect
            });
        }
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        // 1. Timer Logic
        this.timeLeft -= dt;
        
        const scoreEl = this.uiRoot.querySelector('#score-text');
        if (scoreEl) scoreEl.innerText = `Atoms: ${this.score} / ${this.targetScore}`;

        if (this.timeLeft <= 0) {
            this.triggerFail("Time's up! The remaining smoke escaped into the ventilation!");
            return;
        }

        // 2. Stun Check
        if (this.tripStunTimer > 0) {
            this.tripStunTimer -= dt;
            this.triggerRefresh();
            return; 
        }

        // 3. Wandering Hazard (Thomsons)
        this.updateThomsons(dt);

        // 4. Effects Decay
        this.updateEffects(dt);

        // 5. Tool Interaction (Physics & Collection)
        if (this.input.isDown) {
            this.updateToolInteraction(dt);
        } else {
            // Reset particle scale if they escaped vacuum
            this.particles.forEach(p => { if(p.active && p.scale < 1) p.scale += dt; });
        }

        // 6. Passive Particle Physics
        this.particles.forEach(p => {
            if (!p.active) return;
            if (p.type === 'SMOKE') {
                // Gentle drift
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                
                // Screen bounds (Wrap)
                if (p.x < 0) p.x = this.SAFE_WIDTH - 200;
                if (p.x > this.SAFE_WIDTH - 200) p.x = 0;
                if (p.y < 0) p.y = (this.lay.tableY || 550) - 50;
                if (p.y > (this.lay.tableY || 550)) p.y = 0;
            }
        });

        // 7. Win Check
        if (this.score >= this.targetScore) {
            this.startWinSequence();
        }

        this.triggerRefresh();
    }

    updateThomsons(dt) {
        // Spawn chance
        if (this.wanderingThomsons.length === 0 && Math.random() < 0.01) {
            const fromLeft = Math.random() > 0.5;
            this.wanderingThomsons.push({
                x: fromLeft ? -100 : this.SAFE_WIDTH + 100,
                y: (this.lay.tableY || 550) - 50,
                vx: fromLeft ? 150 : -150,
                w: 110, h: 240,
                tripped: false,
                frame: 0,
                animTimer: 0
            });
        }

        this.wanderingThomsons.forEach((t, i) => {
            if (!t.tripped) {
                t.x += t.vx * dt;
                
                // Sprite Animation Update (4 frames total)
                t.animTimer += dt;
                if (t.animTimer > 0.15) { 
                    t.frame = (t.frame + 1) % 4; 
                    t.animTimer = 0;
                }

                if (t.x > this.SAFE_WIDTH + 150 || t.x < -150) {
                    this.wanderingThomsons.splice(i, 1);
                }
            }
        });
    }

    updateEffects(dt) {
        this.effects = this.effects.filter(ef => {
            ef.life -= dt;
            if (ef.type === 'dust' || ef.type === 'suction') {
                if (ef.vx) ef.x += ef.vx * dt;
                if (ef.vy) ef.y += ef.vy * dt;
            }
            return ef.life > 0;
        });
    }

    updateToolInteraction(dt) {
        const mx = this.input.x;
        const my = this.input.y;
        
        // 1. Thomson Hazard Check
        for (let t of this.wanderingThomsons) {
            if (!t.tripped && Math.abs(mx - t.x) < t.w/2 && Math.abs(my - t.y) < t.h/2) {
                this.triggerThomsonClumsiness(t);
                return; // Stop interaction
            }
        }

        const isVac = (this.tool === 'VACUUM');
        const isBrush = (this.tool === 'BRUSH');

        // VACUUM EFFECT: Suction Lines
        if (isVac) {
             if (Math.random() < 0.3) { // Density of lines
                 const angle = Math.random() * Math.PI * 2;
                 const r = 80 + Math.random() * 60;
                 this.effects.push({
                     type: 'suction',
                     x: mx + Math.cos(angle) * r,
                     y: my + Math.sin(angle) * r,
                     tx: mx, ty: my,
                     life: 0.2, maxLife: 0.2
                 });
             }
        }

        // BRUSH EFFECT: Dust Trails based on speed
        if (isBrush) {
            const dx = mx - this.prevInput.x;
            const dy = my - this.prevInput.y;
            const speed = Math.hypot(dx, dy);
            
            // If moving reasonably fast, spawn dust
            if (speed > 2) {
                if (Math.random() < 0.4) {
                    this.effects.push({
                        type: 'dust',
                        x: mx + (Math.random()-0.5)*40,
                        y: my + (Math.random()-0.5)*40,
                        scale: 0.5 + Math.random()*0.5,
                        life: 0.5, maxLife: 0.5,
                        vx: dx * 0.1, vy: dy * 0.1 
                    });
                }
            }
        }

        // 3. Particle Interaction
        this.particles.forEach(p => {
            if (!p.active) return;
            
            const dist = Math.hypot(p.x - mx, p.y - my);
            
            // VACUUM: Pulls Smoke
            if (isVac && dist < 150) {
                if (p.type === 'SMOKE') {
                    // Pull force (Lerp-ish)
                    const pull = 6.0 * dt;
                    p.x += (mx - p.x) * pull;
                    p.y += (my - p.y) * pull;
                    p.scale = Math.max(0.2, dist / 150); // Shrink effect
                    
                    if (dist < 25) this.collectParticle(p);
                } else {
                    // Agitate Ash slightly (feedback that it's wrong tool)
                    p.x += (Math.random()-0.5) * 2;
                }
            }
            
            // BRUSH: Sweeps Ash
            else if (isBrush && dist < 50) {
                if (p.type === 'ASH') {
                    this.collectParticle(p);
                    // Spawn puff upon collection
                    this.effects.push({
                        type: 'dust', x: p.x, y: p.y, scale: 0.8, life: 0.4, maxLife: 0.4, vx:0, vy:-20
                    });
                } else {
                    // Agitate Smoke
                    p.vx += (Math.random()-0.5) * 50;
                }
            }
            else {
                // Restore scale if it escaped the vacuum zone
                if (p.scale < 1) p.scale += dt * 2; 
            }
        });

        this.prevInput.x = mx;
        this.prevInput.y = my;
    }

    collectParticle(p) {
        p.active = false;
        this.score++;
        this.triggerHaptic(5);
        this.updateCSSScale();
    }

    triggerThomsonClumsiness(thomson) {
        thomson.tripped = true;
        this.tripStunTimer = 2.0;
        this.triggerHaptic(500);

        const dropAmount = Math.min(this.score, 10);
        this.score -= dropAmount;
        
        let respawned = 0;
        for (let p of this.particles) {
            if (!p.active && respawned < dropAmount) {
                p.active = true;
                p.x = thomson.x + (Math.random() * 100 - 50);
                p.y = (p.type === 'SMOKE') ? thomson.y - 100 : (this.lay.tableY || 550);
                p.scale = 1;
                respawned++;
            }
        }

        this.updateCSSScale(); 
        
        const toast = document.createElement('div');
        toast.className = 'game-toast';
        toast.innerHTML = `<b>CLUMSY!</b> You sucked up Thomson's tie!<br>-${dropAmount} Atoms!`;
        this.uiRoot.appendChild(toast);
        setTimeout(() => { toast.remove(); this.wanderingThomsons = []; }, 2000);
    }

    updateCSSScale() {
        const pivot = this.uiRoot.querySelector('#scale-beam-pivot');
        const hangL = this.uiRoot.querySelector('#hang-left');
        const hangR = this.uiRoot.querySelector('#hang-right');
        const jarFull = this.uiRoot.querySelector('#jar-full');

        if (!pivot || !hangL || !hangR) return;

        const pct = Math.min(1, this.score / this.targetScore);
        const maxTilt = -20; 
        const angle = maxTilt * (1.0 - pct); 

        pivot.style.transform = `translateX(-50%) rotate(${angle}deg)`;
        hangL.style.transform = `translateX(-50%) rotate(${-angle}deg)`; 
        hangR.style.transform = `translateX(50%) rotate(${-angle}deg)`;

        if (jarFull) jarFull.style.opacity = pct;
    }

    triggerFail(reason) {
        this.state = 'LOST';
        this.stop();
        this.showDialogue(
            `<b>HADDOCK:</b> ${reason}`, "haddock", { animate: true, disableTypewriter: true }
        );
        this.showGameRestartButtonInDialogueBubble(() => { this.startGameplay(); });
    }

    startWinSequence() {
        this.state = 'WON';
        this.stop();
        
        this.uiRoot.querySelector('#tool-hud').style.display = 'none';

        this.showDialogue(
            `<b>Thundering Typhoons</b>!<br> It balanced! The smoke did have the missing weight!`,
            'haddock', { animate: true, onClose: () => this.win() }
        );
    }

    // ============================================================
    // 🎨 RENDERER 
    // ============================================================

    draw(ctx) {
        const bg = this.assetManager.get('g11_lab_bg');
        if (bg) {
            ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        } else {
            ctx.fillStyle = '#444'; ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
            ctx.fillStyle = '#333'; ctx.fillRect(0, this.lay.tableY || 550, this.SAFE_WIDTH, 300);
        }

        if (this.dialogueShowing || (this.state != 'PLAYING')) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        }
        ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        // Render Timer Component
        if (this.state === 'PLAYING') {
            const clockX = this.lay.clock?.x || this.SAFE_WIDTH - 150;
            const clockY = this.lay.clock?.y || 20;
            const totalTime = this.params.timeLimit || 45;
            const timeSpent = totalTime - this.timeLeft;
            this.timerUI.draw(ctx, clockX, clockY, timeSpent, totalTime);
        }

        // Draw Thomsons (Hazard) using sprite animation
        this.wanderingThomsons.forEach(t => {
            if (t.tripped) {
                const img = this.assetManager.get('g11_thomson_trip');
                if (img) {
                    ctx.save();
                    ctx.translate(t.x, t.y);
                    if (t.vx < 0) ctx.scale(-1, 1);
                    ctx.drawImage(img, -t.w/2, -t.h/2, t.h, t.h); // Square crop for trip img
                    ctx.restore();
                } else {
                    ctx.fillStyle = 'red';
                    ctx.fillRect(t.x - t.w/2, t.y - t.h/2, t.w, t.h);
                }
            } else {
                const sheet = this.assetManager.get('g11_thomson_walking');
                if (sheet) {
                    ctx.save();
                    ctx.translate(t.x, t.y);
                    if (t.vx < 0) ctx.scale(-1, 1);
                    
                    const frameW = sheet.width / 4; 
                    const frameH = sheet.height;
                    
                    ctx.drawImage(sheet, 
                        t.frame * frameW, 0, frameW, frameH, 
                        -t.w/2, -t.h/2, t.w, t.h             
                    );
                    ctx.restore();
                } else {
                    ctx.fillStyle = 'black';
                    ctx.fillRect(t.x - t.w/2, t.y - t.h/2, t.w, t.h);
                }
            }
        });

        // Draw Effects (Dust & Suction Lines)
        this.effects.forEach(ef => {
            const alpha = ef.life / ef.maxLife;
            ctx.save();
            ctx.globalAlpha = alpha;
            
            if (ef.type === 'dust') {
                ctx.fillStyle = '#bbb';
                ctx.beginPath(); 
                ctx.arc(ef.x, ef.y, 10 * ef.scale, 0, Math.PI*2); 
                ctx.fill();
            } 
            else if (ef.type === 'suction') {
                // Draw converging lines
                ctx.strokeStyle = '#00FFFF';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(ef.x, ef.y);
                ctx.lineTo(ef.tx, ef.ty);
                ctx.stroke();
            }
            
            ctx.restore();
        });

        // Draw Particles
        const smokeImg = this.assetManager.get('g11_particle_smoke');
        const ashImg = this.assetManager.get('g11_particle_ash');

        this.particles.forEach(p => {
            if (!p.active) return;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(p.scale, p.scale); // Apply vacuum shrink
            ctx.rotate(p.rotation);

            if (p.type === 'SMOKE') {
                if (smokeImg) ctx.drawImage(smokeImg, -20, -20, 40, 40);
                else { ctx.fillStyle = 'rgba(200,200,200,0.5)'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill(); }
            } else {
                if (ashImg) ctx.drawImage(ashImg, -10, -10, 20, 20);
                else { ctx.fillStyle = '#fff'; ctx.fillRect(-5, -5, 10, 10); }
            }
            ctx.restore();
        });

        // Player Tool Cursor
        if (this.state === 'PLAYING' && this.tripStunTimer <= 0) {
            ctx.save();
            ctx.translate(this.input.x, this.input.y);
            
            ctx.strokeStyle = this.tool === 'VACUUM' ? 'rgba(0, 255, 255, 0.5)' : 'rgba(255, 170, 0, 0.5)';
            ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);

            const toolImg = this.assetManager.get(this.tool === 'VACUUM' ? 'g11_tool_vacuum' : 'g11_tool_brush');
            if (toolImg) {
                ctx.rotate(-0.2); 
                ctx.drawImage(toolImg, -25, -25, 100, 100); 
            }
            ctx.restore();
        }

        if (this.tripStunTimer > 1.8) {
            ctx.fillStyle = `rgba(255, 255, 255, ${ (this.tripStunTimer - 1.8) / 0.2 })`;
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }
    }

    resize() {
        super.resize();

        // FIX: Safety Guard. 
        // During the initial super() call, 'this.atoms' is undefined.
        // We must strictly abort before attempting to render.
        if (this.state === undefined) return;
        
        // If the game loop is stopped (Intro/Quiz), the canvas was just cleared by the browser.
        // We must manually repaint one frame so the user doesn't see black.
        if (!this.isRunning) {
            this.renderFrame();
        }
    }
}
