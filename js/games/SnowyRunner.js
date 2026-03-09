import { Game } from '../Game.js';
import { QuizOverlay } from '../components/QuizOverlay.js';

export class SnowyRunner extends Game {
    constructor(config) {
        super(config);
        
        // Game & Engine State
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('tintin_snowy_highscore')) || 0;

        this.baseSpeed = 400;
        this.maxSpeed = 1100;
        this.gameSpeed = this.baseSpeed;
        
        this.runState = 'INIT'; 
        
        // Physics & Player
        this.groundY = 600; 
        this.gravity = 2500;
        this.player = {
            x: 150,
            y: this.groundY,
            width: 128,
            height: 128,
            velocityY: 0,
            jumpForce: -950,
            isGrounded: true
        };

        this.sprite = {
            frameTimer: 0,
            frameInterval: 0.08, 
            currentCol: 0,
            currentRow: 0, 
            maxCols: 2,
            frameW: 256, 
            frameH: 256
        };

        this.bg = { x: 0, speedMultiplier: 0.5 };
        this.obstacles = [];
        this.spawnTimer = 0;
        
        // Particle Systems
        this.dustParticles = [];
        this.crashParticles = []; // NEW: Explosion effects

        this.hintsGiven = 0;
        this.screenShake = 0;
        this.crashTimer = 0;
        
        this.quizPool = this.tuning.quizPool || [];
        this.quizOverlay = new QuizOverlay(this.uiRoot, this.assetManager);
    }

    async init() {
        // Clear Previous UI Safely
        this.clearDynamicUI();

        // Load existing assets + the new explosion particles
        await this.assetManager.loadBatch([
            'lab_bg_looping', 'g03_sprite_snowy', 'g01_junk_tin_can', 
            'g15_vfx_dust_cloud', 'g15_vfx_spark_red', 'g11_particle_smoke',
            'ui_journal_bg' 
        ]);
        
        this.enableSmartRendering = true; 
        this.enableHUD("SCORE: 0", false);

        this.injectCSS();

        // FEATURE A: Hide the "Skip" button since this is an endless end-game
        const skipBtn = document.getElementById('btn-skip-puzzle');
        if (skipBtn) skipBtn.style.display = 'none';

        // FEATURE C: Updated End-of-Volume Dialogue
        const introText = `
            <b>Investigation Complete!</b><br>
            You've reached the end of the current installment. Further episodes will be available soon!<br><br>
            While we wait, let's keep our minds sharp. Run, Snowy, run! Tap the screen to jump!
        `;
        
        this.showDialogue(introText, "tintin", {
            animate: true,
            onClose: () => {
                this.runState = 'PLAYING';
            }
        });
    }

    injectCSS() {
        if (this.styleElement) this.styleElement.remove();
        this.styleElement = document.createElement('style');
        this.styleElement.innerHTML = `
            .quiz-overlay-themed h2 {
                background-color: rgba(255,255,255,0.85);
                padding: 15px; border-radius: 8px;
                margin-bottom: 20px; font-family: sans-serif; text-align: center;
                color: #1a1a1a;
            }
            .quiz-explanation {
                font-size: 20px; color: #1a1a1a; margin-bottom: 25px; line-height: 1.4;
            }
            .quiz-link {
                display: inline-block; padding: 14px 28px; background: #1976D2; 
                color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 20px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3); margin-bottom: 25px;
            }
            .comic-word {
                position: absolute; font-family: "Comic Sans MS", fantasy, sans-serif;
                font-weight: bold; font-size: 48px; text-transform: uppercase;
                text-shadow: 3px 3px 0px #000, -2px -2px 0px #000;
                pointer-events: none; z-index: 1500;
                white-space: nowrap; 
                animation: popUp 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            @keyframes popUp {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.1) rotate(-15deg); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2) rotate(5deg); }
                80% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
                100% { opacity: 0; transform: translate(-50%, -100px) scale(0.9); }
            }
            @media (max-height: 500px) and (orientation: landscape) {
                .quiz-overlay-themed h2 { margin-bottom: 5px; font-size: 14px; padding: 8px; }
                .quiz-explanation { font-size: 16px; }
                .quiz-link { font-size: 16px; }
                .comic-word { font-size: 24px; }
            }
            @media (max-width: 768px) and (orientation: portrait) {
                .quiz-overlay-themed h2 { margin-bottom: 10px; font-size: 16px; padding: 10px; }
                .quiz-explanation { font-size: 16px; }
                .quiz-link { font-size: 16px; }
                .comic-word { font-size: 24px; }
            }
        `;
        document.head.appendChild(this.styleElement);
    }

    update(dt) {
        // Halt everything completely if a UI overlay is active
        if (this.runState === 'INIT' || this.runState === 'QUIZ' || this.runState === 'LEARN_MORE') return;

        let currentDt = dt;

        // FEATURE B: PARTICLE UPDATES (Run independently so they don't freeze on Game Over)
        let particlesActive = false;

        // Process Screen Shake Decay
        if (this.screenShake > 0) {
            this.screenShake -= dt * 60;
            if (this.screenShake < 0) this.screenShake = 0;
            this.triggerRefresh();
        }

        // SLOW-MO LOGIC
        if (this.runState === 'CRASHING') {
            currentDt = dt * 0.15; // 15% speed! (Matrix bullet time)
            this.crashTimer -= dt; // Countdown in real-time
            
            // Screech the background to a halt
            this.gameSpeed = Math.max(0, this.gameSpeed - (1500 * dt)); 

            // After slow-mo finishes, trigger the UI
            if (this.crashTimer <= 0) {
                this.runState = 'GAMEOVER';
                
                // Save High Score here instead of instantly
                if (this.score > this.highScore) {
                    this.highScore = this.score;
                    localStorage.setItem('tintin_snowy_highscore', this.highScore);
                }
                
                this.showGameOverScreen();
                return; 
            }
            particlesActive = true; 
        }

        // Update Dust
        for (let i = this.dustParticles.length - 1; i >= 0; i--) {
            let p = this.dustParticles[i];
            p.age += currentDt; // FIX: Use currentDt so dust slows down too
            if (this.runState === 'PLAYING' || this.runState === 'CRASHING') p.x -= (this.gameSpeed * this.bg.speedMultiplier) * currentDt; 
            p.size += 150 * currentDt; 
            p.opacity = 1.0 - (p.age / p.lifeTime);
            if (p.opacity <= 0) {
                this.dustParticles.splice(i, 1);
            } else {
                particlesActive = true;
            }
        }

        // Update Crash Explosion
        for (let i = this.crashParticles.length - 1; i >= 0; i--) {
            let p = this.crashParticles[i];
            p.age += currentDt;
            p.x += p.vx * currentDt;
            p.y += p.vy * currentDt;
            
            // Gravity effect on sparks
            if (p.type === 'spark') p.vy += 1000 * currentDt; 
            
            p.opacity = (1.0 - (p.age / p.lifeTime))*0.85;
            if (p.opacity <= 0) {
                this.crashParticles.splice(i, 1);
            } else {
                particlesActive = true;
            }
        }

        // If GAME OVER, only animate the particles and stop the physics/scrolling
        if (this.runState === 'GAMEOVER') {
            if (particlesActive) this.triggerRefresh();
            return; 
        }

        // --- PLAYING & CRASHING PHYSICS BELOW ---

        // FIX: Use currentDt to apply slow-motion to Snowy's physics
        this.player.velocityY += this.gravity * currentDt;
        this.player.y += this.player.velocityY * currentDt;

        if (this.player.y >= this.groundY) {
            this.player.y = this.groundY;
            this.player.velocityY = 0;
            // FIX: Only spawn walking dust if we are actively playing
            if (!this.player.isGrounded && this.runState === 'PLAYING') {
                this.spawnDust();
            }
            this.player.isGrounded = true;
        }

        // Sprite handling
        if (this.runState === 'CRASHING') {
            this.sprite.currentRow = 0; 
            this.sprite.currentCol = 1; 
        } else if (this.player.isGrounded) {
            this.sprite.currentRow = 0; 
            this.sprite.currentCol = 0; 
        } else {
            this.sprite.currentRow = 1; 
            this.sprite.currentCol = 0; 
        }

        // Update Parallax Background (FIX: Use currentDt)
        this.bg.x -= (this.gameSpeed * this.bg.speedMultiplier) * currentDt;
        
        const bgImg = this.assetManager.get('lab_bg_looping');
        const bgWidth = (bgImg && bgImg.complete && bgImg.width > 0) ? bgImg.width : this.SAFE_WIDTH;
        if (this.bg.x <= -bgWidth) {
            this.bg.x += bgWidth; 
        }

        // Spawn Obstacles (FIX: Stop spawning if we are crashing)
        if (this.runState === 'PLAYING') {
            this.spawnTimer -= currentDt;
            if (this.spawnTimer <= 0) {
                this.obstacles.push({
                    x: this.SAFE_WIDTH, y: this.groundY + 40, width: 40, height: 60
                });
                
                const safeAirTime = 0.8; 
                const randomExtraTime = Math.random() * 1.5 * (this.baseSpeed / this.gameSpeed);
                this.spawnTimer = safeAirTime + randomExtraTime; 
            }
        }

        // Move Obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i];
            obs.x -= this.gameSpeed * currentDt; // FIX: Use currentDt

            // JUMP HINT TUTORIAL
            if (this.hintsGiven < 3 && !obs.hinted && this.runState === 'PLAYING') {
                const distToPlayer = obs.x - (this.player.x + this.player.width);
                if (distToPlayer > 0 && distToPlayer <= 350) {
                    obs.hinted = true; 
                    this.hintsGiven++;
                    this.spawnComicWord("JUMP!", this.player.x + 64, this.player.y - 40, "#FBC02D");
                }
            }

            // FIX: The Infinite Loop Guard! Only detect hits if we are 'PLAYING'
            if (this.runState === 'PLAYING') {
                const hitboxShrink = 15;
                if (
                    this.player.x + hitboxShrink < obs.x + obs.width &&
                    this.player.x + this.player.width - hitboxShrink > obs.x &&
                    this.player.y + hitboxShrink < obs.y + obs.height &&
                    this.player.y + this.player.height - hitboxShrink > obs.y
                ) {
                    this.handleCollision();
                }
            }

            if (obs.x + obs.width < 0) {
                this.obstacles.splice(i, 1);
                // FIX: Only increment score if not crashing
                if (this.runState === 'PLAYING') {
                    this.score += 10;
                    if (this.gameSpeed < this.maxSpeed) {
                        this.gameSpeed += 8; 
                    }
                    this.enableHUD(`SCORE: ${this.score}`, false);
                }
            }
        }

        this.triggerRefresh(); 
    }

    spawnDust() {
        this.dustParticles.push({
            x: this.player.x + (this.player.width / 4), 
            y: this.groundY + this.player.height - 20,
            size: 40, opacity: 1.0, lifeTime: 0.35, age: 0
        });
    }

    spawnComicWord(text, x, y, color) {
        const word = document.createElement('div');
        word.className = 'comic-word';
        word.innerText = text;
        
        const leftPct = (x / this.SAFE_WIDTH) * 100;
        const topPct = (y / this.SAFE_HEIGHT) * 100;
        
        word.style.left = `${leftPct}%`;
        word.style.top = `${topPct}%`;
        word.style.color = color;
        
        this.uiRoot.appendChild(word);
        setTimeout(() => word.remove(), 1800); // Cleans itself up
    }

    // Polished Collision Effect Generator
    spawnCrashEffect() {
        const cx = this.player.x + this.player.width / 2;
        const cy = this.player.y + this.player.height / 2;

        // Sparks (Increased count, speed, and size)
        for(let i=0; i<8; i++) {
            this.crashParticles.push({
                type: 'spark',
                x: cx, y: cy,
                vx: (Math.random() - 0.5) * 1500,
                vy: (Math.random() - 1.0) * 1200, 
                lifeTime: 0.6 + Math.random() * 0.5,
                size: 30 + Math.random() * 20,
                age: 0
            });
        }

        // Smoke (Increased count and size)
        for(let i=0; i<8; i++) {
            this.crashParticles.push({
                type: 'smoke',
                x: cx, y: cy,
                vx: (Math.random() - 0.5) * 400,
                vy: (Math.random() - 0.5) * 400 - 150,
                lifeTime: 0.8 + Math.random() * 0.5,
                size: 40 + Math.random() * 20,
                age: 0
            });
        }
    }

    draw(ctx) {
        ctx.save();

        // Apply Screen Shake
        if (this.screenShake > 0) {
            const sx = (Math.random() - 0.5) * this.screenShake;
            const sy = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(sx, sy);
        }


        // 1. Draw Looping Background Image (Top BG_HEIGHT pixels)
        const bgImg = this.assetManager.get('lab_bg_looping');
        const BG_HEIGHT = 400;
        if (bgImg && bgImg.complete) {
            const drawX = this.bg.x | 0; // Fast math to snap to integer 
            const bgWidth = bgImg.width || this.SAFE_WIDTH;
            
            ctx.drawImage(bgImg, drawX, 0, bgWidth, BG_HEIGHT);

            // Only draw the second looping image if the right edge of the first 
            // image has crossed into the visible safe zone (1024)
            if (drawX + bgWidth < this.SAFE_WIDTH) {
                // Overlap by 1 pixel (-1) to hide the rendering seam
                ctx.drawImage(bgImg, drawX + bgWidth - 1, 0, bgWidth, BG_HEIGHT);
            }
            
        } else {
            // Fallback if image isn't loaded
            ctx.fillStyle = "#FDFBF7";
            ctx.fillRect(0, 0, this.SAFE_WIDTH, BG_HEIGHT);
        }

        // 2. Draw Static Floor Fill (Bottom section)
        ctx.fillStyle = "#799680";
        ctx.fillRect(0, BG_HEIGHT, this.SAFE_WIDTH, this.SAFE_HEIGHT - BG_HEIGHT);

        // 3. Draw Ground Line
        ctx.beginPath();
        ctx.moveTo(0, this.groundY + this.player.height);
        ctx.lineTo(this.SAFE_WIDTH, this.groundY + this.player.height);
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#1a1a1a";
        ctx.stroke();

        // --- OPTIMIZED DUST PARTICLES ---
        const dustImg = this.assetManager.get('g15_vfx_dust_cloud');
        if (dustImg && dustImg.complete && this.dustParticles.length > 0) {
            for (let p of this.dustParticles) {
                // Change alpha directly without saving context
                ctx.globalAlpha = Math.max(0, p.opacity); 
                ctx.drawImage(dustImg, p.x - (p.size / 2), p.y - (p.size / 2), p.size, p.size);
            }
            ctx.globalAlpha = 1.0; // Reset once after the loop finishes!
        }

        // Draw Player Sprite
        if (this.runState != 'QUIZ' && this.runState != 'GAMEOVER' && this.runState != 'LEARN_MORE') {
            const snowyImg = this.assetManager.get('g03_sprite_snowy');
            if (snowyImg && snowyImg.complete) {
                const sourceX = this.sprite.currentCol * this.sprite.frameW;
                const sourceY = this.sprite.currentRow * this.sprite.frameH;
                ctx.drawImage(
                    snowyImg, 
                    sourceX, sourceY, this.sprite.frameW, this.sprite.frameH, 
                    this.player.x, this.player.y, this.player.width, this.player.height 
                );
            }

            // Draw Obstacles
            const canImg = this.assetManager.get('g01_junk_tin_can');
            for (let obs of this.obstacles) {
                if (canImg && canImg.complete) {
                    ctx.drawImage(canImg, obs.x, obs.y, obs.width, obs.height);
                } else {
                    ctx.fillStyle = "#D32F2F";
                    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                }
            }
        }

        // Draw Crash Explosion Effects
        if (this.crashParticles.length > 0) {
            const sparkImg = this.assetManager.get('g15_vfx_spark_red');
            const smokeImg = this.assetManager.get('g11_particle_smoke');
            
            for (let p of this.crashParticles) {
                const img = p.type === 'spark' ? sparkImg : smokeImg;
                if (img && img.complete) {
                    ctx.globalAlpha = Math.max(0, p.opacity);
                    // Use basic math instead of ctx.translate() to save CPU
                    const drawX = p.x - (p.size / 2);
                    const drawY = p.y - (p.size / 2);
                    ctx.drawImage(img, drawX, drawY, p.size, p.size);
                }
            }
            ctx.globalAlpha = 1.0; // Reset once
        }

        ctx.restore();

        // If the quiz or learn more screen is active, dim the entire canvas
        if (this.dialogueShowing || this.runState === 'QUIZ' || this.runState === 'LEARN_MORE' || this.runState === 'GAMEOVER') {
            ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }
    }

    // --- INPUT HANDLING ---

    onKeyDown(e) {
        // Support Spacebar and Up Arrow for desktop players
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault(); // Stop the page from scrolling
            this.handleJump();
        }
    }

    onPointerDown(e) {
        this.handleJump();
    }

    handleJump() {
        // Only allow jumping if actively running
        if (this.runState !== 'PLAYING') return;
        
        if (this.player.isGrounded) {
            this.player.velocityY = this.player.jumpForce;
            this.player.isGrounded = false;
        }
    }

    handleCollision() {
        this.runState = 'CRASHING';
        this.crashTimer = 2.5; // 2.5 real seconds of slow-mo
        this.screenShake = 60; // Intense screen shake
        
        // Knock Snowy back and up into the air
        this.player.velocityY = -600; 
        this.player.isGrounded = false;

        this.dustParticles = [];
        this.spawnCrashEffect();
        
        // Pop an action word right at the impact site
        this.spawnComicWord("BAM!", this.player.x + 64, this.player.y, "#D32F2F");
        
        // Heavy vibration
        this.triggerHaptic(300); 
    }

    // FEATURE E: Polished End Screen
    showGameOverScreen() {
        this.gameOverDiv = document.createElement('div');
        this.gameOverDiv.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #FDFBF7; border: 6px solid #1a1a1a; border-radius: 16px;
            padding: 40px 60px; text-align: center; z-index: 1000;
            box-shadow: 15px 15px 0px rgba(0,0,0,0.8); pointer-events: auto;
            font-family: sans-serif;
            background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px);
        `;
        
        const isNewHigh = this.score > 0 && this.score === this.highScore;
        const scoreColor = isNewHigh ? "#2E7D32" : "#1976D2"; // Green if new high, blue otherwise

        this.gameOverDiv.innerHTML = `
            <h1 style="color: #D32F2F; margin-top: 0; font-size: 55px; text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; letter-spacing: 3px; transform: rotate(-4deg); margin-bottom: 10px;">BAM!</h1>
            <h2 style="color: #1a1a1a; font-size: 32px; margin: 15px 0;">Score: <span style="color:${scoreColor}">${this.score}</span></h2>
            <h3 style="color: #666; font-size: 22px; margin-bottom: 35px;">🏆 High Score: ${this.highScore} ${isNewHigh ? '<b>(NEW!)</b>' : ''}</h3>
            <button id="btn-restart-run" style="
                padding: 16px 40px; background: #FBC02D; 
                border: 4px solid #000; font-size: 24px; font-weight: bold; 
                cursor: pointer; border-radius: 12px; box-shadow: 6px 6px 0px rgba(0,0,0,1);
                transition: transform 0.1s;
            ">CONTINUE ➔</button>
        `;
        
        this.uiRoot.appendChild(this.gameOverDiv);

        // Add satisfying click effect to button
        const btn = this.gameOverDiv.querySelector('#btn-restart-run');
        btn.onmousedown = () => { btn.style.transform = 'translate(4px, 4px)'; btn.style.boxShadow = '2px 2px 0px rgba(0,0,0,1)'; };
        btn.onmouseup = () => { btn.style.transform = 'none'; btn.style.boxShadow = '6px 6px 0px rgba(0,0,0,1)'; };

        btn.onclick = () => {
            this.gameOverDiv.remove();
            
            this.showDialogue("Professor Calculus says: 'Before you try again, let's refresh our chemistry knowledge!'", "calculus", {
                animate: true,
                onClose: () => this.triggerQuiz()
            });
        };
        this.triggerRefresh();
    }

    triggerQuiz() {
        this.runState = 'QUIZ';
        
        const randomQ = this.quizPool[Math.floor(Math.random() * this.quizPool.length)];
        
        const optionsConfig = randomQ.options.map(opt => ({
            text: opt.label,
            correct: opt.isCorrect,
            onSelect: (isCorrect) => {
                if (isCorrect) {
                    this.showLearnMoreScreen(randomQ); 
                }
            }
        }));

        // --- CONSISTENCY FIX: Use Journal Background ---
        const bgSrc = this.assetManager.get('ui_journal_bg')?.src || null;
        this.quizOverlay.show(optionsConfig, bgSrc, { keepOpenOnWrong: true });

        if (this.quizOverlay.overlayElement) {
            const promptHeader = document.createElement('h2');
            promptHeader.innerText = randomQ.prompt || "Question:";
            promptHeader.className = 'quiz-header'; // Applies the injected CSS
            
            this.quizOverlay.overlayElement.insertBefore(promptHeader, this.quizOverlay.overlayElement.firstChild);
        }
        
        this.triggerRefresh(); 
    }

    showLearnMoreScreen(randomQ) {
        this.runState = 'LEARN_MORE';

        if (!randomQ.learnMoreUrl) {
            this.resetAndResume();
            return;
        }

        this.learnMoreDiv = document.createElement('div');
        this.learnMoreDiv.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #E8F5E9; border: 4px solid #2E7D32; border-radius: 12px;
            padding: 30px; text-align: center; z-index: 1000; pointer-events: auto;
            box-shadow: 10px 10px 0px rgba(0,0,0,0.2); font-family: sans-serif; width: 80%; max-width: 500px;
        `;
        
        this.learnMoreDiv.innerHTML = `
            <h2 style="color: #2E7D32; margin-top: 0; font-size: 30px;">Correct!</h2>
            <p class="quiz-explanation">${randomQ.explanation || "Great job!"}</p>
            <a href="${randomQ.learnMoreUrl}" target="_blank" class="quiz-link"
            >${randomQ.learnMoreText || "Watch Video Evidence"}</a>
            <br>
            <button id="btn-resume-run" style="
                padding: 12px 24px; background: #FBC02D; border: 3px solid #000; 
                font-size: 18px; font-weight: bold; cursor: pointer; border-radius: 8px;
            ">Start Next Run ➔</button>
        `;
        
        this.uiRoot.appendChild(this.learnMoreDiv);

        this.learnMoreDiv.querySelector('#btn-resume-run').onclick = () => {
            this.learnMoreDiv.remove();
            this.resetAndResume();
        };
        this.triggerRefresh();
    }

    resetAndResume() {
        this.score = 0;
        this.gameSpeed = this.baseSpeed;
        this.enableHUD(`SCORE: ${this.score}`, false);
        
        this.obstacles = [];
        this.dustParticles = [];
        this.crashParticles = [];
        this.hintsGiven = 0;
        
        this.player.y = this.groundY;
        this.player.velocityY = 0;
        this.player.isGrounded = true;

        // Add a safe buffer before the first obstacle spawns
        this.spawnTimer = 1.5;
        
        this.runState = 'PLAYING';
    }

    destroy() {
        if (this.styleElement) this.styleElement.remove();
        super.destroy();
    }
}
