import { Game } from '../Game.js';
import { QuizOverlay } from '../components/QuizOverlay.js';

export class AtomicKeyhole extends Game {

    constructor(config) {
        super(config);
        
        this.lay = this.tuning.layout;

        // Game State
        this.state = 'INTRO';
        
        // Physics/Game Variables
        this.gridSize = { rows: 5, cols: 7 };
        this.spacing = 110;
        this.atoms = [];
        this.targetAtomIndex = -1; 
        
        this.waveX = 0;
        this.waveSpeed = 400; 
        this.waveDirection = 1;
        this.waveWidth = 80; // Slightly wider for visual clarity with sprites
        
        this.currentMomentum = 0;
        this.requiredMomentum = 3; // "3 successive pushes"
        
        this.screenShake = 0; 

        this.styleElement = null; // CSS Reference for cleanup
    }

    async init() {
        // 1. Enable optimization
        this.enableSmartRendering = true; 

        // Instantiate Components
        this.quizUI = new QuizOverlay(this.uiRoot, this.assetManager);

        await this.preload([
            'g10_tuning_fork',
            'g10_bg_microscope',
            'g10_atom_silver',
            'g10_atom_magnesium'
        ]);

        // Inject the CSS for the vibration animation dynamically
        this.injectCSS();

        this.setupVisuals();
        this.triggerRefresh();
        this.startIntro();
    }

    injectCSS() {
        if (this.styleElement) this.styleElement.remove();
        this.styleElement = document.createElement('style');
        
        // The quiz overlay CSS is completely removed from here!
        this.styleElement.innerHTML = `
            /* --- TUNING FORK ANIMATIONS --- */
            @keyframes fork-shake {
                0% { transform: translate(0, 0) rotate(0deg); }
                25% { transform: translate(-4px, 0) rotate(-2deg); }
                75% { transform: translate(4px, 0) rotate(2deg); }
                100% { transform: translate(0, 0) rotate(0deg); }
            }

            #tuning-fork-control {
                /* FIX: Removes the blue highlight on mobile tap */
                -webkit-tap-highlight-color: transparent;
                user-select: none;
                -webkit-user-select: none;
                touch-action: manipulation; /* Improves touch response */
            }
 
            /* 1. DESKTOP: Hover Effect (Only if mouse is present) */
            @media (hover: hover) {
                #tuning-fork-control:hover {
                    transform: scale(1.1) rotate(-5deg) !important;
                    filter: brightness(1.2) drop-shadow(0 0 10px rgba(255, 215, 0, 0.6));
                    transition: all 0.2s ease-out;
                }
            }

            /* 2. MOBILE & DESKTOP: Active/Pressed Effect 
               Restores the "Tap" feedback without it getting stuck */
            #tuning-fork-control:active {
                transform: scale(1.1) rotate(-5deg) !important;
                filter: brightness(1.2) drop-shadow(0 0 10px rgba(255, 215, 0, 0.8));
                transition: all 0.05s ease-out; /* Faster response for tap */
            }

            /* 3. GAME LOGIC: Vibrating State (Blue Energy)
               This overrides both Hover and Active because it's a game state */
            .vibrating {
                animation: fork-shake 0.05s infinite !important;
                filter: blur(0.5px) drop-shadow(0 0 15px #00FFFF) !important;
            }
        `;
        document.head.appendChild(this.styleElement);
    }

    destroy() {
        if (this.styleElement) {
            this.styleElement.remove();
            this.styleElement = null;
        }
        if (this.quizUI) this.quizUI.remove();
        super.destroy();
    }

    setupVisuals() {
        // Clear Previous UI Safely
        this.clearDynamicUI();

        // --- Tuning Fork Setup ---
        const forkContainer = document.createElement('div');
        forkContainer.id = 'tuning-fork-control';
        forkContainer.className = 'hidden'; // Hidden until game starts

        const forkX = (this.lay.fork.x || 30);
        const forkY = (this.lay.fork.y || 40);
        const forkWidth = (this.lay.fork.w || 128);
        const forkHeight = (this.lay.fork.h || 128);

        Object.assign(forkContainer.style, {
            position: 'absolute',
            bottom: '' + forkY + 'px',
            right: '' + forkX + 'px',
            width: '' + forkWidth + 'px',
            height: '' + forkHeight + 'px',
            pointerEvents: 'auto',
            cursor: 'pointer',
            transformOrigin: 'bottom center', // Vibrate from the handle
            transition: 'transform 0.1s'
        });

        const forkAsset = this.assetManager.get('g10_tuning_fork');
        if (forkAsset) {
            const img = forkAsset.cloneNode(true);
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            img.className = 'tool-image';
            forkContainer.appendChild(img);
        }

        // Interaction Logic
        // We use 'mousedown' to start vibration visually
        forkContainer.addEventListener('mousedown', () => {
            forkContainer.classList.add('vibrating');
            this.triggerPulse();
        });

        // We use 'mouseup' and 'mouseleave' to stop the vibration look
        const stopVibing = () => forkContainer.classList.remove('vibrating');
        forkContainer.addEventListener('mouseup', stopVibing);
        forkContainer.addEventListener('mouseleave', stopVibing);

        this.uiRoot.appendChild(forkContainer);
        
        // B. Initialize Atom Grid
        this.atoms = [];
        
        // Calculate Centering
        const totalW = (this.gridSize.cols - 1) * this.spacing;
        const totalH = (this.gridSize.rows - 1) * this.spacing;
        const startX = (this.SAFE_WIDTH - totalW) / 2;
        const startY = (this.SAFE_HEIGHT - totalH) / 2;

        for(let r=0; r<this.gridSize.rows; r++) {
            for(let c=0; c<this.gridSize.cols; c++) {
                this.atoms.push({
                    x: startX + (c * this.spacing),
                    y: startY + (r * this.spacing),
                    type: 'zlatanium', 
                    scale: 1,
                    shakeX: 0,
                    shakeY: 0,
                    rotation: Math.random() * 6.28, // Random rotation for natural look
                    swayPhase: Math.random() * Math.PI * 2, 
                    swaySpeed: 2.0,     // Current oscillation speed
                    baseSwaySpeed: 2.0  // Reference speed to recover to
                });
            }
        }

        // C. Select Target (Magnesium)
        const safeRows = this.gridSize.rows - 2;
        const safeCols = this.gridSize.cols - 2;
        const r = 1 + Math.floor(Math.random() * safeRows);
        const c = 1 + Math.floor(Math.random() * safeCols);
        this.targetAtomIndex = (r * this.gridSize.cols) + c;
        this.atoms[this.targetAtomIndex].type = 'magnesium';

        this.triggerRefresh();
    }

    // ============================================================
    // 📜 PHASE 1: NARRATIVE
    // ============================================================

    startIntro() {
        this.stop(); // Stop the game loop to save CPU while reading

        this.showDialogue(
            `<b>Blistering Barnacles!</b> It's a solid block! We can't just <i>ask</i> the atom to leave!`,
            'haddock',
            { animate: true, onClose: () => this.startCalculusExplanation(), comicTransition: true }
        );
    }

    startCalculusExplanation() {
        this.showDialogue(
            `We don't need force, Captain. We need <i>rhythm</i>! Imagine pushing a child on a swing...<br><br>
             If you push at the wrong time, you stop it. But if you push at the <b>exact right moment</b>, it goes higher and higher. That is <b>Resonance</b>!`,
            'calculus',
            { animate: true, onClose: () => this.startQuiz() }
        );
    }

    startQuiz() {
        this.state = 'QUIZ';
        this.stop();
        this.showDialogue(
            `To be precise, won't all the atoms fall out like marbles when we push?`,
            'thomson', 
            { animate: true, 
              onClose: () => {
                this.createQuizOverlay();
              },
              disableTypewriter: true }
        );
    }

    createQuizOverlay() {
        // Refactored to use the Component!
        this.quizUI.show([
            { text: "Yes, it will turn into liquid instantly!", correct: false },
            { text: "No, they are held in a rigid lattice; only the misfit is loose.", correct: true, onSelect: (c) => this.handleQuizAnswer(c) },
            { text: "Only if we shake it upside down.", correct: false }
        ], null, { keepOpenOnWrong: true });
    }

    handleQuizAnswer(isCorrect) {
        if (isCorrect) {
            this.hideDialogue();
            this.showDialogue(
                `Exactly! The Magnesium atom is "loose" on its swing. The Tuning Fork gives it the push!`,
                'tintin',
                { animate: true, onClose: () => this.startGameplay() }
            );
        } else {
            this.showDialogue(
                `No, no! Remember the swing! The structure holds the rest tight!`,
                'calculus',
                { animate: true, onClose: () => this.startQuiz() }
            );
        }
    }

    // ============================================================
    // 🕹️ PHASE 2: GAMEPLAY
    // ============================================================

    startGameplay() {
        this.state = 'GAME_ACTIVE';
        
        const fork = this.uiRoot.querySelector('#tuning-fork-control');
        if(fork) fork.classList.remove('hidden');

        // CRITICAL: Restart the game loop for physics/animation
        this.start();
    }

    update(dt) {
        if (this.state === 'WIN_ANIMATION') {
            const target = this.atoms[this.targetAtomIndex];
            target.y -= 600 * dt; // Accelerate Upward
            target.rotation += 10 * dt; // Spin while flying
            
            this.triggerRefresh();

            // When off screen, trigger the final dialogue
            if (target.y < -100) {
                this.finalizeWin();
            }
            return;
        }

        if (this.state != 'GAME_ACTIVE') return;

        // 1. Wave Logic
        this.waveX += this.waveSpeed * this.waveDirection * dt;
        if (this.waveX > this.SAFE_WIDTH) {
            this.waveX = this.SAFE_WIDTH;
            this.waveDirection = -1;
        } else if (this.waveX < 0) {
            this.waveX = 0;
            this.waveDirection = 1;
        }

        // 2. Animate Magnesium Atom Sway (The "Swing" Analogy)
        const target = this.atoms[this.targetAtomIndex];

        // Target Sway Speed based on Momentum Level (Natural Increase)
        // Level 0: 2.0 (Idle), Level 3: 8.0 (Resonant)
        const targetSpeed = target.baseSwaySpeed + (this.currentMomentum * 2.0);
        
        // Smoothly interpolate current speed to target speed (Easing)
        target.swaySpeed += (targetSpeed - target.swaySpeed) * 5 * dt;

        target.swayPhase += target.swaySpeed * dt;
        
        // Amplitude grows with Momentum
        const amplitude = 5 + (this.currentMomentum * 15); 
        target.swayOffset = Math.sin(target.swayPhase) * amplitude;

        // 3. Screen Shake Decay
        if (this.screenShake > 0) {
            this.screenShake -= dt * 50;
            if (this.screenShake < 0) this.screenShake = 0;
        }

        // Atom Shake Decay
        this.atoms.forEach(atom => {
            atom.shakeX *= 0.9;
            atom.shakeY *= 0.9;

            // Clear color override after a brief flash
            if (atom.flashTimer > 0) {
                atom.flashTimer -= dt;
                if(atom.flashTimer <= 0) atom.colorOverride = null;
            }
        });

        this.triggerRefresh();
    }

    triggerPulse() {
        if (this.state !== 'GAME_ACTIVE') return;

        const target = this.atoms[this.targetAtomIndex];
        const dist = Math.abs(this.waveX - target.x);
        
        // Tolerance: +/- 60px
        if (dist < 60) {
            this.handleHit();
        } else {
            this.handleMiss();
        }
    }

    handleHit() {
        // Increase Momentum
        if (this.currentMomentum < this.requiredMomentum) {
            this.currentMomentum++;
        }

        this.triggerHaptic(200);

        const target = this.atoms[this.targetAtomIndex];
        target.scale = 1.3;
        target.flashTimer = 0.4; // Trigger Gold Flash
        target.colorOverride = '#FFD700'; 
        
        // Physics Jolt
        target.shakeX = (Math.random() - 0.5) * 30;
        target.shakeY = (Math.random() - 0.5) * 30;
        
        setTimeout(() => { target.scale = 1.0; }, 200);

        // Check Win Condition
        if (this.currentMomentum >= this.requiredMomentum) {
            this.startWinSequence();
        }
    }

    handleMiss() {
        this.triggerHaptic(500);
        this.screenShake = 20; 
        
        // Decrease Momentum ("Natural Decay")
        // If you miss, the swing loses energy.
        if (this.currentMomentum > 0) {
            this.currentMomentum--;
        }

        const target = this.atoms[this.targetAtomIndex];
        target.colorOverride = '#0088FF'; // Blue (Cold)
        target.flashTimer = 0.5;

        // Disrupt the rhythm visually
        target.swayPhase += Math.PI; // Phase shift (jerk)

        const quotes = ["You stopped the swing!", "Lost the rhythm!", "Too early!"];
        this.showToast(quotes[Math.floor(Math.random() * quotes.length)]);
    }

    startWinSequence() {
        this.state = 'WIN_ANIMATION'; // Triggers the fly-up in update()
        
        // Hide UI immediately
        const fork = this.uiRoot.querySelector('#tuning-fork-control');
        if(fork) fork.classList.add('hidden');
        
        // Play Sound/Haptic
        this.triggerHaptic(1000); // Long vibration
    }

    finalizeWin() {
        this.state = 'WON';
        
        // NOW we stop the loop, after the animation is done.
        if (this.stop) this.stop();

        this.showDialogue(
            `<b>POP!</b> The Magnesium atom flies free!`,
            'tintin',
            { animate: true, onClose: () => this.win() }
        );
    }

    // ============================================================
    // 🖌️ RENDERING (UPDATED FOR ASSETS)
    // ============================================================

    draw(ctx) {
        // Shake Transform
        const shakeX = (Math.random() - 0.5) * this.screenShake;
        const shakeY = (Math.random() - 0.5) * this.screenShake;

        ctx.save();
        ctx.translate(shakeX, shakeY);

        // 1. Draw Background Asset
        const bg = this.assetManager.get('g10_bg_microscope');
        if (bg) {
            ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        } else {
            // Fallback
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }

        // 2. Draw Lattice Connections
        // We draw lines BEHIND the atoms
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; // Faint connection lines
        ctx.lineWidth = 3;
        this.drawLatticeLines(ctx);

        // 3. Draw Atom Sprites
        this.atoms.forEach(atom => {
            this.drawAtomSprite(ctx, atom);
        });

        // 4. Draw The Wave
        if (this.state === 'GAME_ACTIVE') {
            const grad = ctx.createLinearGradient(this.waveX - 40, 0, this.waveX + 40, 0);
            grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
            grad.addColorStop(0.5, 'rgba(0, 255, 255, 0.4)');
            grad.addColorStop(1, 'rgba(0, 255, 255, 0)');

            ctx.fillStyle = grad;
            ctx.fillRect(this.waveX - 40, 0, 80, this.SAFE_HEIGHT);
            
            ctx.strokeStyle = 'rgba(200, 255, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.waveX, 0);
            ctx.lineTo(this.waveX, this.SAFE_HEIGHT);
            ctx.stroke();
        }

        if (this.dialogueShowing || (this.state != 'GAME_ACTIVE' && this.state != 'WIN_ANIMATION')) {
            // Dark Overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }

        ctx.restore();
    }

    drawLatticeLines(ctx) {
        // Simple Grid Logic
        for(let r=0; r<this.gridSize.rows; r++) {
            const start = this.atoms[r * this.gridSize.cols];
            const end = this.atoms[(r+1) * this.gridSize.cols - 1];
            ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        }
        for(let c=0; c<this.gridSize.cols; c++) {
            const start = this.atoms[c];
            const end = this.atoms[this.atoms.length - this.gridSize.cols + c];
            ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        }
    }

    drawAtomSprite(ctx, atom) {
        // Calculate Position
        let finalX = atom.x + atom.shakeX;
        if (atom.type === 'magnesium' && atom.swayOffset) {
             finalX += atom.swayOffset;
        }

        ctx.save();
        ctx.translate(finalX, atom.y + atom.shakeY); // Translate to Center
        ctx.rotate(atom.rotation);

        const size = 96 * atom.scale; 

        // --- FIX: DRAW FLASH (Centered Glow) ---
        // Drawn BEFORE the sprite so it's behind/around, or AFTER with blend mode.
        // We use a Radial Gradient for a "soft" center alignment.
        if (atom.flashTimer > 0 && atom.colorOverride) {
            ctx.save();
            // Reset rotation so the glow doesn't spin weirdly with the atom
            ctx.rotate(-atom.rotation); 
            
            const glow = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 0.8);
            if (atom.colorOverride === '#FFD700') { // Gold
                glow.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
                glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
            } else { // Blue
                glow.addColorStop(0, 'rgba(0, 136, 255, 0.8)');
                glow.addColorStop(1, 'rgba(0, 136, 255, 0)');
            }
            
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }

        // Draw Sprite
        let sprite;
        if (atom.type === 'magnesium') sprite = this.assetManager.get('g10_atom_magnesium');
        else sprite = this.assetManager.get('g10_atom_silver');

        if (sprite) {
            ctx.drawImage(sprite, -size/2, -size/2, size, size);
        } else {
            ctx.fillStyle = (atom.type === 'magnesium') ? '#888' : '#ccc';
            ctx.beginPath(); ctx.arc(0, 0, size/2, 0, Math.PI*2); ctx.fill();
        }

        // Highlight Ring (Momentum Indicator)
        // Shows 1, 2, or 3 rings based on momentum
        if (atom.type === 'magnesium' && this.currentMomentum > 0) {
            ctx.strokeStyle = `rgba(255, 215, 0, 0.6)`;
            ctx.lineWidth = 3;
            for(let i=0; i<this.currentMomentum; i++) {
                ctx.beginPath(); 
                ctx.arc(0,0, (size/2) + (i*6), 0, Math.PI*2); 
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    showToast(text) {
        this.showDialogue(
             text,
            'haddock',
            { animate: true, disableTypewriter: true }
        );
        setTimeout( () => { this.hideDialogue(); }, 1500 );
    }

    resize() {
        super.resize();

        // FIX: Safety Guard. 
        // During the initial super() call, 'this.atoms' is undefined.
        // We must strictly abort before attempting to render.
        if (!this.atoms || this.atoms.length === 0) return;
        
        // If the game loop is stopped (Intro/Quiz), the canvas was just cleared by the browser.
        // We must manually repaint one frame so the user doesn't see black.
        if (!this.isRunning) {
            this.renderFrame();
        }
    }
}
