/* =========================================
   js/games/JuniorReporterQuiz.js
   Game 02: "The Mineral Detective Lab"
   ========================================= */

import { LabGame } from '../middleware/LabGame.js';
import { QuizOverlay } from '../components/QuizOverlay.js';

export class JuniorReporterQuiz extends LabGame {

    async init() {
        this.rocks = [];
        this.particles = [];
        
        // Animation States
        this.streakAnim = null; 
        this.hammerAnim = null;
        this.mobileLensAnim = null; // FIX 2: New state for mobile magnifying glass timeout

        this.phase = 'OBSERVE'; // OBSERVE -> STREAK -> HAMMER -> FINISHED

        this.setupToolbelt([]); 

        const scoreContainer = this.uiRoot.querySelector('#score-container');
        if (scoreContainer) scoreContainer.classList.add('hidden');

        this.enableSmartRendering = true;
        this.lvlData = this.tuning; 

        if (!this.lvlData || Object.keys(this.lvlData).length === 0) {
            console.error("❌ Missing level data for JuniorReporterQuiz");
            return;
        }

        await this.preload([
            'g02_bg_desk', 'g02_rock_normal', 'g02_rock_flat', 'g02_rock_shattered',
            'ui_icon_plate', 'ui_icon_hammer', 'ui_journal_bg', 'ui_icon_lens'
        ]);

        const positions = this.isPortrait ? this.lvlData.layout.portrait.rockPositions : this.lvlData.layout.landscape.rockPositions;
        const size = this.isPortrait ? this.lvlData.layout.portrait.rockSize : this.lvlData.layout.landscape.rockSize;
        
        const shuffledRockData = [...this.lvlData.rocks].sort(() => Math.random() - 0.5);

        shuffledRockData.forEach((data, index) => {
            this.rocks.push({
                ...data, 
                x: positions[index].x,
                y: positions[index].y,
                w: size,
                h: size,
                currentAssetId: 'g02_rock_normal',
                observed: false,
                streakedColor: null, // Persistent streak
                hammered: false
            });
        });

        this.showDialogue(this.lvlData.introText, "tintin", 
            { 
                animate: true, 
                comicTransition: true,
                onClose: () => {
                    this.showDialogue("Surface colors can be deceiving! Impurities or weather can change how a rock looks on the outside. Click to inspect them.", "tintin");
                }
            });

        this.injectCSS();
        this.triggerRefresh();
    }

    injectCSS() {
        if (this.styleElement) this.styleElement.remove();
        this.styleElement = document.createElement('style');
        this.styleElement.innerHTML = `
            .quiz-overlay-themed h2 {
                background-color: rgba(255,255,255,0.85);
                padding: 15px; border-radius: 8px;
                margin-bottom: 20px; font-family: sans-serif; text-align: center;
            }
        `;
        document.head.appendChild(this.styleElement);
    }

    // --- MAIN LOOP ---

    update(dt) {
        let needsRefresh = false;

        // Force redraw if mouse moves (needed for hover effects and custom cursors)
        if (this.input.x !== this.lastX || this.input.y !== this.lastY) {
            needsRefresh = true;
            this.lastX = this.input.x;
            this.lastY = this.input.y;
            
            // Check hover states
            for (let rock of this.rocks) {
                rock.isHovered = this.isHit(this.input.x, this.input.y, rock);
            }
        }

        // FIX 2: Mobile Lens Animation Timer
        if (this.mobileLensAnim) {
            this.mobileLensAnim.timer -= dt;
            needsRefresh = true;
            if (this.mobileLensAnim.timer <= 0) {
                const rock = this.mobileLensAnim.rock;
                this.mobileLensAnim = null;
                // Trigger the result after the timeout
                this.showDialogue(`${rock.desc}: It looks like gold, but surface Luster can be a trick. We need to look deeper.`, "tintin");
                rock.observed = true;
                this.checkPhaseCompletion();
            }
        }

        // Streak Animation Timer
        if (this.streakAnim) {
            this.streakAnim.timer -= dt;
            needsRefresh = true;
            if (this.streakAnim.timer <= 0) {
                if (this.streakAnim.rock.streakColor !== 'none') {
                    this.streakAnim.rock.streakedColor = this.streakAnim.rock.streakColor;
                    this.streakAnim.rock.streakData = this.generateStreakData(); 
                }
                this.streakAnim = null;
                this.checkPhaseCompletion(); 
            }
        }

        // Hammer Animation Timer
        if (this.hammerAnim) {
            this.hammerAnim.timer -= dt;
            needsRefresh = true;
            if (this.hammerAnim.timer <= 0) {
                this.hammerAnim = null;
                this.checkPhaseCompletion(); 
            }
        }

        // Particles
        if (this.particles.length > 0) {
            this.particles.forEach(p => {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 800 * dt; // Gravity
                p.life -= dt;
            });
            this.particles = this.particles.filter(p => p.life > 0);
            needsRefresh = true;
        }

        if (needsRefresh) this.triggerRefresh();
    }

    draw(ctx) {
        if (!this.rocks) return; 

        // 1. BG
        const bg = this.assetManager.get('g02_bg_desk');
        if (bg) ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        // Dark Overlay
        if (this.dialogueShowing) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        }
        ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);


        // --- ROCKS & PERMANENT STREAKS ---
        for (const rock of this.rocks) {
            let rx = rock.x;
            let ry = rock.y;

            // Shake rock if being hammered
            if (this.hammerAnim && this.hammerAnim.rock === rock && this.hammerAnim.timer > 0.1) {
                rx += (Math.random() - 0.5) * 10;
                ry += (Math.random() - 0.5) * 10;
            }

            // Draw polished permanent streak below rock
            if (rock.streakedColor) {
                this.drawPolishedStreak(
                    ctx, 
                    rock,               
                    rx + 15,            
                    ry + rock.h + 5,    
                    rx + rock.w - 15,   
                    ry + rock.h + 15    
                );
            }

            ctx.save();

            // --- HOVER EFFECTS ---
            let scale = 1.0;
            // Only show hover if we aren't currently animating an action
            if (rock.isHovered && !this.hammerAnim && !this.streakAnim && !this.mobileLensAnim) {
                
                // Determine if this rock is "done" for the current phase
                let isDone = false;
                if (this.phase === 'OBSERVE' && rock.observed) isDone = true;
                if (this.phase === 'STREAK' && rock.tested) isDone = true;
                if (this.phase === 'HAMMER' && rock.hammered) isDone = true;

                if (isDone) {
                    // Already tested: Subtle grey shadow, slightly smaller to feel "used"
                    ctx.shadowColor = "rgba(100, 100, 100, 0.8)";
                    ctx.shadowBlur = 10;
                    scale = 0.95;
                } else {
                    // Ready to test: Bright gold/yellow glow, slightly larger
                    ctx.shadowColor = "rgba(255, 215, 0, 1.0)";
                    ctx.shadowBlur = 20;
                    scale = 1.05;
                }
            }

            // Apply scaling from the center of the rock
            ctx.translate(rx + rock.w/2, ry + rock.h/2);
            ctx.scale(scale, scale);
            ctx.translate(-(rx + rock.w/2), -(ry + rock.h/2));

            // Base Shadow
            ctx.fillStyle = "rgba(0,0,0,0.2)";
            ctx.beginPath();
            ctx.ellipse(rx + rock.w/2, ry + rock.h - 5, rock.w/2, 10, 0, 0, Math.PI*2);
            ctx.fill();

            // Sprite
            const img = this.assetManager.get(rock.currentAssetId);
            if (img) ctx.drawImage(img, rx, ry, rock.w, rock.h);
            
            ctx.restore(); // Clears shadows and transforms for the next item
        }

        // --- PHASE ENHANCEMENTS ---

        // FIX 2: Handle both Desktop Hover and Mobile Timer Lens rendering
        const isDesktopHover = this.phase === 'OBSERVE' && (!this.input.isTouch); 
        const isMobileAnim = this.phase === 'OBSERVE' && this.mobileLensAnim;

        // A. Observe: Magnifying Glass
        if (isDesktopHover || isMobileAnim) {
            const mx = isMobileAnim ? this.mobileLensAnim.x : this.input.x;
            const my = isMobileAnim ? this.mobileLensAnim.y : this.input.y;
            const lensRadius = 64; 

            ctx.save();
            ctx.beginPath();
            ctx.arc(mx, my, lensRadius, 0, Math.PI * 2);
            ctx.clip();

            ctx.translate(mx, my);
            ctx.scale(1.6, 1.6);
            ctx.translate(-mx, -my);
            
            if (bg) ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
            for (const rock of this.rocks) {
                const img = this.assetManager.get(rock.currentAssetId);
                if (img) ctx.drawImage(img, rock.x, rock.y, rock.w, rock.h);
            }
            ctx.restore();

            const lensImg = this.assetManager.get('ui_icon_lens');
            if (lensImg) {
                ctx.drawImage(lensImg, mx - 100, my - 100, 200, 200);
            }
        }

        // B. Streak Phase: Rubbing Animation OR Custom Cursor
        if (this.streakAnim) {
            const plateImg = this.assetManager.get('ui_icon_plate');
            if (plateImg) {
                const progress = 1 - (this.streakAnim.timer / 0.6); 
                const rubOffsetX = Math.sin(progress * Math.PI * 8) * 20; 
                ctx.drawImage(plateImg, this.streakAnim.rock.x + rubOffsetX + 20, this.streakAnim.rock.y + 40, 64, 64);
            }
        } else if (this.phase === 'STREAK' && this.activeTool === 'plate') {
            // Idle Custom Cursor for Streak Plate
            const plateImg = this.assetManager.get('ui_icon_plate');
            if (plateImg) {
                // Draw plate centered on cursor
                ctx.drawImage(plateImg, this.input.x - 32, this.input.y - 32, 64, 64);
            }
        }

        // C. Hammer Phase: Custom Cursor & Animation
        if (this.phase === 'HAMMER' && this.activeTool === 'hammer') {
            const hammerImg = this.assetManager.get('ui_icon_hammer');
            if (hammerImg) {
                ctx.save();
                if (this.hammerAnim) {
                    const progress = 1 - (this.hammerAnim.timer / 0.3);
                    const angle = Math.sin(progress * Math.PI) * (Math.PI / 3); 
                    ctx.translate(this.hammerAnim.x + 32, this.hammerAnim.y + 64); 
                    ctx.rotate(-angle);
                    ctx.drawImage(hammerImg, -32, -64, 64, 64);
                } else {
                    ctx.drawImage(hammerImg, this.input.x - 10, this.input.y - 10, 64, 64);
                }
                ctx.restore();
            }
        }

        // --- PARTICLES ---
        this.particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, p.y, p.size, p.size);
            ctx.globalAlpha = 1.0;
        });
    }

    // --- INPUT & GAME LOGIC ---

    onPointerDown(e) {
        // FIX 1: Ignore clicks entirely if a dialogue is currently showing. 
        // This ensures the click dismissing the dialogue doesn't interact with the rock underneath.
        if (this.dialogueShowing) {
            this.hideDialogue();
            return;
        }

        // FIX 2: Also block input if the mobile lens animation is playing
        if (this.phase === 'FINISHED' || this.streakAnim || this.hammerAnim || this.mobileLensAnim) return;

        const mx = this.input.x;
        const my = this.input.y;
        const selectedToolId = this.activeTool; 

        for (let i = this.rocks.length - 1; i >= 0; i--) {
            const rock = this.rocks[i];
            if (this.isHit(mx, my, rock)) {
                this.handleRockInteraction(rock, selectedToolId, mx, my);
                return; 
            }
        }
    }

    handleRockInteraction(rock, toolId, mx, my) {
        switch(this.phase) {
            case 'OBSERVE':
                if (!toolId || toolId === 'hand') {
                    if (rock.observed) return; // Prevent double trigger
                    
                    // FIX 2: Check if mobile, trigger timeout instead of instant dialogue
                    if (this.input.isTouch) {
                        this.triggerHaptic(20);
                        // Show the lens at tap location for 1.2 seconds
                        this.mobileLensAnim = { timer: 1.2, rock: rock, x: mx, y: my };
                    } else {
                        // Desktop behaves as before
                        this.showDialogue(`${rock.desc}: It looks like gold, but surface Luster can be a trick. We need to look deeper.`, "tintin");
                        rock.observed = true;
                        this.checkPhaseCompletion();
                    }
                }
                break;

            case 'STREAK':
                 if (toolId === 'plate') {
                    if (rock.streakedColor || rock.streakColor === 'none' && rock.tested) return; 
                    
                    rock.tested = true;
                    this.triggerHaptic(20);
                    
                    // Start Animation instead of instant resolution
                    this.streakAnim = { timer: 0.6, rock: rock };

                    // Pre-queue the dialogue to show slightly after anim ends
                    setTimeout(() => {
                        if (rock.streakColor !== 'none') {
                            this.triggerHaptic(30);
                        } else {
                            this.showDialogue("No streak left behind! It must be harder than the ceramic plate.", "tintin");
                            this.triggerHaptic(50);
                        }
                    }, 650);

                } else {
                     this.showDialogue("Select the streak plate from the toolkit first.", "tintin");
                }
                break;

            case 'HAMMER':
                if (toolId === 'hammer') {
                    if (rock.hammered) return; 
                    
                    this.triggerHaptic(80); 
                    // Start strike animation
                    this.hammerAnim = { timer: 0.3, rock: rock, x: mx, y: my };

                    setTimeout(() => {
                        rock.hammered = true;
                        if (rock.hammerResult === 'flat') {
                            rock.currentAssetId = 'g02_rock_flat';
                            rock.y = rock.y + rock.h/2; 
                            rock.h = rock.h / 2;
                            rock.w = rock.w * 1.2;
                            this.showDialogue("Look! It flattened like putty. That's real Gold!", "tintin");
                        } else if (rock.hammerResult === 'shatter') {
                            rock.currentAssetId = 'g02_rock_shattered';
                            this.spawnParticles(rock.x + rock.w/2, rock.y + rock.h/2, "#333");
                            this.showDialogue("It shattered into cubes! Definitely Pyrite.", "tintin");
                        } else {
                            this.showDialogue("Clang! It's too tough. Must be Zlatanium.", "tintin");
                        }
                    }, 150); // Apply changes exactly at the middle of the swing

                } else {
                     this.showDialogue("We need something heavier... like the hammer.", "tintin");
                }
                break;
        }
    }

    generateStreakData() {
        const data = { powder: [], crumbs: [] };
        
        // 1. Generate the soft, diffused powder base
        for (let i = 0; i < 250; i++) {
            const spread = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; 
            
            data.powder.push({
                t: Math.random(), 
                offsetX: spread * 12, 
                offsetY: (Math.random() - 0.5) * 8, 
                radius: Math.random() * 2.5 + 1, 
                alpha: Math.random() * 0.12 + 0.03 
            });
        }
        
        // 2. Generate the sharp, gritty crumbs
        for (let i = 0; i < 50; i++) {
            const spread = (Math.random() - 0.5) * 2; 
            
            data.crumbs.push({
                t: Math.random(),
                offsetX: spread * 9,
                offsetY: (Math.random() - 0.5) * 8,
                radius: Math.random() * 0.8 + 0.2, 
                alpha: Math.random() * 0.6 + 0.3,
                // NEW: 15% of crumbs will be white plate dust for contrast
                isCeramicDust: Math.random() < 0.15 
            });
        }
        
        return data;
    }

    drawPolishedStreak(ctx, rock, startX, startY, endX, endY) {
        if (!rock.streakData) return;
        
        const color = rock.streakedColor;
        const data = rock.streakData;
        const dx = endX - startX;
        const dy = endY - startY;

        ctx.save();
        ctx.shadowBlur = 0; 
        ctx.lineCap = 'round';

        // 1. Ceramic Dust Underlay (NEW)
        // A faint white background stroke that ensures dark colors (Pyrite) 
        // don't get lost against the dark wooden desk.
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 18;
        ctx.globalAlpha = 0.05; // Very faint
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 2. Absolute base smudge to tie the particles together
        ctx.strokeStyle = color;
        ctx.lineWidth = 14;
        ctx.globalAlpha = 0.12; 
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 3. Render the soft powder particles
        ctx.fillStyle = color;
        data.powder.forEach(p => {
            const px = startX + dx * p.t + p.offsetX;
            const py = startY + dy * p.t + p.offsetY;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(px, py, p.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // 4. Render the sharp crumbs and grit
        data.crumbs.forEach(c => {
            const px = startX + dx * c.t + c.offsetX;
            const py = startY + dy * c.t + c.offsetY;
            
            // NEW: Apply the white contrast color if it's ceramic dust
            ctx.fillStyle = c.isCeramicDust ? '#FFFFFF' : color;
            ctx.globalAlpha = c.isCeramicDust ? c.alpha * 0.6 : c.alpha;
            
            ctx.beginPath();
            ctx.arc(px, py, c.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
    }

    spawnParticles(x, y, color) {
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 600,
                vy: (Math.random() - 0.5) * 600 - 200, // Bias upwards
                size: Math.random() * 8 + 4,
                life: 1.0 + Math.random(),
                color: color
            });
        }
    }

    checkPhaseCompletion() {
        if (this.phase === 'OBSERVE') {
            if (this.rocks.every(r => r.observed)) {
                this.schedulePhaseChange('STREAK', 1500);
            }
        }
        else if (this.phase === 'STREAK') {
             if (this.rocks.every(r => r.streakedColor || r.tested)) {
                 this.schedulePhaseChange('HAMMER', 1500);
            }
        }
        else if (this.phase === 'HAMMER') {
             if (this.rocks.every(r => r.hammered)) {
                 this.schedulePhaseChange('FINISHED', 2000);
            }
        }
    }

    schedulePhaseChange(nextPhase, delay) {
        setTimeout(() => {
            this.phase = nextPhase;
            this.setupUIForPhase(nextPhase);
        }, delay);
    }

    setupUIForPhase(phase) {
        this.setupToolbelt([]); 
        if (this.canvas) this.canvas.style.cursor = 'default';
        
        switch(phase) {
            case 'STREAK':
                this.showDialogue("Let's find their true color! Rubbing a rock on an unglazed porcelain plate crushes a tiny bit into powder.", "tintin");
                this.setupToolbelt([{ id: 'plate', icon: '⬜', label: 'Streak Plate' }]);
                if (this.canvas) this.canvas.style.cursor = 'none';
                break;
            case 'HAMMER':
                 this.showDialogue("Okay, final test: Malleability. Real gold flattens, but brittle minerals break. Select the hammer!", "tintin");
                 this.setupToolbelt([{ id: 'hammer', icon: '🔨', label: 'Rock Hammer' }]);
                if (this.canvas) this.canvas.style.cursor = 'none';
                break;
            case 'FINISHED':
                this.hideDialogue();
                this.launchQuizOverlay(0); // Start at question 0
                break;
        }
    }

    // --- QUIZ FINALE (Feedback Fix) ---

    launchQuizOverlay(questionIndex = 0) {
        const qData = this.lvlData.questions[questionIndex];
        this.quizOverlay = new QuizOverlay(this.uiRoot, this.assetManager);

        const mappedOptions = qData.options.map(opt => ({
            text: opt.label,
            correct: (opt.id === qData.correctAnswerId),
            onSelect: () => {
                if (opt.id === qData.correctAnswerId) {
                    // Correct Answer
                    if (questionIndex + 1 < this.lvlData.questions.length) {
                        this.triggerHaptic(20);
                        this.launchQuizOverlay(questionIndex + 1); // Load next question
                    } else {
                        // Out of questions, game won
                        const styleFix = document.getElementById('quiz-readability-fix');
                        if (styleFix) styleFix.remove();
                        this.win();
                    }
                } else {
                    // Wrong Answer
                    this.triggerHaptic(50);
                    // Overlay handles keeping itself open and disabling the button now.
                    // No dialogue needed.
                }
            }
        }));

        const bgImgAsset = this.assetManager.get('ui_journal_bg');
        const bgSrc = bgImgAsset ? bgImgAsset.src : null;

        // NEW: Passing the config flag to keep the overlay open
        this.quizOverlay.show(mappedOptions, bgSrc, { keepOpenOnWrong: true });

        if (this.quizOverlay.overlayElement) {
            const qTitle = document.createElement('h2');
            qTitle.innerText = qData.text;
            this.quizOverlay.overlayElement.insertBefore(qTitle, this.quizOverlay.overlayElement.firstChild);
        }
    }

    isHit(mx, my, obj) {
        return mx >= obj.x && mx <= obj.x + obj.w && my >= obj.y && my <= obj.y + obj.h;
    }

    destroy() {
        // Safety cleanup to ensure custom cursors don't stick around
        if (this.canvas) this.canvas.style.cursor = 'default';
        if (this.styleElement) this.styleElement.remove();
        if (this.quizUI) try { this.quizUI.remove(); } catch (e) { }
        super.destroy();
    }
}
