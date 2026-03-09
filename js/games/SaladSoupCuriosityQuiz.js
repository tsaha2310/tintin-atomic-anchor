/* =========================================
   js/games/SaladSoupCuriosityQuiz.js
   Game 12: "The Curiosity Quiz"
   Theme: Mixture vs. Compound (Rubber-band physics)
   ========================================= */

import { Game } from '../Game.js';
import { QuizOverlay } from '../components/QuizOverlay.js';

export class SaladSoupCuriosityQuiz extends Game {

    async init() {
        this.enableSmartRendering = true;
        this.lvl = this.tuning.level_1_microscope || this.tuning; 
        this.phys = this.lvl.physics;
        this.lay = this.lvl.layout;

        // --- NEW: Animation State Management ---
        this.phase = 'ZOOM_IN'; // Start with the zoom animation
        // other phases are MIXTURE -> HEATING -> COMPOUND -> QUIZ
        this.introTimer = 0;
        this.introDuration = 1.2; // 1.2 seconds for the aperture to open
        this.currentLensRadius = 0; // Starts completely closed

        // State Management
        this.atoms = [];
        this.draggedAtom = null;
        this.hoveredAtom = null;
        this.dragOffset = { x: 0, y: 0 };
        this.screenShake = 0;
        this.heatProgress = 0;
        this.isHeating = false;

        this.quizUI = new QuizOverlay(this.uiRoot, this.assetManager);

        await this.preload([
            'g12_bg_microscope', 'g12_atom_iron', 'g12_atom_sulfur', 
            'g12_molecule_ironsulfide', 'ui_icon_tweezers', 'ui_icon_tweezers_closed', 'ui_journal_bg'
        ]);

        this.injectCSS();
        this.spawnMixture();
    }

    injectCSS() {
        if (this.styleElement) this.styleElement.remove();
        this.styleElement = document.createElement('style');
        this.styleElement.innerHTML = `
            /* --- GLOBAL FIX: Prevent browser-level scrollbars when Snowy animates off-screen --- */
            body, html, #game-ui-layer { overflow-x: hidden !important; }

            /* --- Action Button Styling --- */
            .action-button {
                position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
                padding: 12px 36px; font-size: 22px; font-family: "Comic Sans MS", sans-serif;
                font-weight: bold; color: white; border-radius: 50px; cursor: pointer; 
                transition: all 0.15s ease; z-index: 100; -webkit-tap-highlight-color: transparent;
                white-space: nowrap; text-align: center; display: none; 
            }
            .btn-heat { background-color: #F44336; border: 4px solid #B71C1C; box-shadow: 0 6px 0 #B71C1C, 0 15px 20px rgba(0,0,0,0.4); }
            .btn-heat:hover { background-color: #EF5350; transform: translateX(-50%) translateY(-2px); box-shadow: 0 8px 0 #B71C1C, 0 18px 25px rgba(0,0,0,0.4); }
            .action-button.visible { display: block; animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
            @keyframes popIn { 0% { transform: translateX(-50%) scale(0); } 100% { transform: translateX(-50%) scale(1); } }
            @media (max-width: 768px), (max-height: 500px) { .action-button { font-size: 16px; padding: 10px 28px; bottom: 20px; border-width: 3px; } }

            /* --- QUIZ LAYOUT REFACTOR (Strict Aspect Ratio) --- */

            .quiz-overlay-themed h2 {
                background-color: rgba(255,255,255,0.85);
                padding: 15px; border-radius: 8px;
                margin-bottom: 20px; font-family: sans-serif; text-align: center;
            }
            .quiz-choice-btn {
                font-size: 16px !important; padding: 12px !important; margin: 5px 0 !important;
                flex-shrink: 0; 
            }


            /* --- MOBILE PORTRAIT (Scaled down maintaining exactly 1:1.2 ratio) --- */
            @media (max-width: 768px) and (orientation: portrait) {
                .quiz-overlay-themed h2 { font-size: 12px; padding: 10px; margin-bottom: 10px; }
                .quiz-choice-btn { font-size: 12px !important; padding: 10px !important; margin: 4px 0 !important; }
            }

            /* --- MOBILE LANDSCAPE (Scaled down drastically to fit height) --- */
            @media (max-height: 500px) and (orientation: landscape) {
                .quiz-overlay-themed h2 { font-size: 12px; padding: 8px; margin-bottom: 8px; }
                .quiz-choice-btn { font-size: 10px !important; padding: 6px !important; margin: 3px 0 !important; line-height: 1.1; }
            }

        `;
        document.head.appendChild(this.styleElement);

        this.uiRoot.insertAdjacentHTML('beforeend', `<button class="action-button btn-heat" id="btn-laser">🔥 FIRE LASER</button>`);
        this.bindHeatButton();
    }

    bindHeatButton() {
        const heatBtn = document.getElementById('btn-laser');
        
        const startHeat = (e) => { 
            if (e) e.preventDefault(); 
            this.isHeating = true; 
            // Transition phase when button is actually pressed
            this.phase = 'HEATING';
            heatBtn.innerHTML = "🔥 HEATING..."; 
            heatBtn.style.transform = "translateX(-50%) translateY(6px)"; 
            heatBtn.style.boxShadow = "0 0px 0 #B71C1C, 0 4px 8px rgba(0,0,0,0.5)";
            this.hideDialogue();
        };
        
        const stopHeat = (e) => { 
            this.isHeating = false; 
            if (heatBtn) {
                heatBtn.innerHTML = "🔥 FIRE LASER";
                heatBtn.style.transform = "";
                heatBtn.style.boxShadow = "";
            }
        };
        
        heatBtn.addEventListener('mousedown', startHeat);
        heatBtn.addEventListener('touchstart', startHeat, { passive: false });
        window.addEventListener('mouseup', stopHeat);
        window.addEventListener('touchend', stopHeat);
        heatBtn.addEventListener('touchcancel', stopHeat);
    }

    spawnMixture() {
        this.atoms = [];
        const spawnRadius = this.lay.lensRadius - 60;

        for (let i = 0; i < this.lay.ironCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * spawnRadius;
            this.atoms.push({
                id: `Fe_${i}`, type: 'iron',
                x: this.lay.lensCenter.x + Math.cos(angle) * r,
                y: this.lay.lensCenter.y + Math.sin(angle) * r,
                vx: 0, vy: 0, w: 100, h: 100
            });
        }
        for (let i = 0; i < this.lay.sulfurCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * spawnRadius;
            this.atoms.push({
                id: `S_${i}`, type: 'sulfur',
                x: this.lay.lensCenter.x + Math.cos(angle) * r,
                y: this.lay.lensCenter.y + Math.sin(angle) * r,
                vx: 0, vy: 0, w: 80, h: 80
            });
        }
    }

    formCompound() {
        this.phase = 'COMPOUND';
        const newMolecules = [];
        const startX = this.lay.lensCenter.x - 150;
        const startY = this.lay.lensCenter.y - 150;
        const spacing = 120;

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (newMolecules.length >= Math.min(this.lay.ironCount, this.lay.sulfurCount)) break;
                newMolecules.push({
                    id: `FeS_${row}_${col}`, type: 'compound',
                    x: startX + (col * spacing),
                    y: startY + (row * spacing),
                    homeX: startX + (col * spacing), 
                    homeY: startY + (row * spacing),
                    vx: 0, vy: 0, w: 175, h: 128,
                    rotation: (Math.random() > 0.5) ? 0 : Math.PI / 2 
                });
            }
        }
        this.atoms = newMolecules;
        this.triggerHaptic(500);
        this.screenShake = 20;
        
        const btn = document.getElementById('btn-laser');
        if (btn) btn.classList.remove('visible');

        this.showDialogue(
            "Fascinating! The heat forced them to 'click' together into a completely new structure! They are chemically married! Try to pluck a piece out now!",
            "calculus", { animate: true });
    }

    startIntro() {
        this.stop();
        this.showDialogue(
            "Observe! The Iron and Sand are just sharing space like roommates. They bounce right off each other without connecting.<br><br> Use the <b>Nano-Tweezers</b> to pull a yellow sand atom!",
            "calculus",
            { animate: true, comicTransition: true, onClose: () => this.start() }
        );
        if (this.canvas) this.canvas.style.cursor = 'none';
    }

    // ==========================================
    // INPUT HANDLING
    // ==========================================
    onPointerDown(e) {
        if (this.dialogueShowing || this.phase === 'HEATING' || this.phase === 'QUIZ' || this.phase === 'HEATING_READY') return;

        const tip = this.getTweezerTip(); // Will use raw touch coords since draggedAtom is currently null
        let closestAtom = null;
        let minDist = Infinity;

        // Explicitly calculate hit detection on touch-down
        for (let i = this.atoms.length - 1; i >= 0; i--) {
            const a = this.atoms[i];
            const dist = Math.hypot(tip.x - a.x, tip.y - a.y);
            
            // Generous fat-finger buffer for mobile reliability
            const hitRadius = (a.type === 'compound') ? 95 : (a.w / 2) + 25;
            
            if (dist < hitRadius && dist < minDist) {
                minDist = dist;
                closestAtom = a;
            }
        }

        if (closestAtom) {
            this.draggedAtom = closestAtom;
            this.dragOffset = { x: tip.x - closestAtom.x, y: tip.y - closestAtom.y }; 
            
            // Move grabbed atom to top of Z-index array
            const index = this.atoms.indexOf(closestAtom);
            if (index > -1) {
                this.atoms.splice(index, 1);
                this.atoms.push(closestAtom);
            }
            
            this.triggerHaptic(15);
            this.triggerRefresh();
        }
    }

    onPointerUp(e) {
        if (this.draggedAtom) {
            
            // --- FIX Issue 1: Trigger dialogue only on release ---
            if (this.phase === 'MIXTURE' && this.draggedAtom.type === 'sulfur' && !this.flags?.firstPullDone) {
                 this.flags = { firstPullDone: true };
                 
                 // Reset cursor immediately so it doesn't look like a tweezer during dialogue
                 if (this.canvas) this.canvas.style.cursor = 'default';

                 this.showDialogue("See? A perfect Salad! Moving the Sand doesn't bother the Iron. Let's cook this soup!", "calculus", { 
                    animate: true, 
                    onClose: () => {
                        // --- FIX Issue 3: Enter interim state where button is visible but tweezers are gone ---
                        this.phase = 'HEATING_READY'; 
                        const btn = document.getElementById('btn-laser');
                        if (btn) btn.classList.add('visible');
                    }
                });
            }

            if (this.phase === 'COMPOUND') {
                this.draggedAtom.vx = (this.draggedAtom.homeX - this.draggedAtom.x) * 10;
                this.draggedAtom.vy = (this.draggedAtom.homeY - this.draggedAtom.y) * 10;
                this.triggerHaptic(30);
            }
            
            // --- FIX Issue 2: Ensure draggedAtom is cleared so tweezers don't stick closed ---
            this.draggedAtom = null;
            this.triggerRefresh();
        }
    }

    getTweezerTip() {
        const isMobile = window.innerWidth < 768 || window.innerHeight < 500;
        
        // FIX: Only float the action point above the finger AFTER an item is grabbed.
        // This ensures the initial tap happens exactly where the user touches.
        const isDragging = this.draggedAtom !== null;
        const offsetY = (isMobile && this.input.isTouch && isDragging) ? -70 : 0;
        
        return {
            x: this.input.x,
            y: this.input.y + offsetY
        };
    }

    // ==========================================
    // GAME LOOP
    // ==========================================
    update(dt) {
        const safeDt = Math.min(dt, 0.05);
        let needsRender = false;

        if (this.phase === 'QUIZ') return;

        // --- INTRO ZOOM ANIMATION ---
        if (this.phase === 'ZOOM_IN') {
            this.introTimer += safeDt;
            const progress = Math.min(1, this.introTimer / this.introDuration);
            
            // Smooth Ease-Out Cubic function
            const ease = 1 - Math.pow(1 - progress, 3);
            this.currentLensRadius = this.lay.lensRadius * ease;

            if (progress >= 1) {
                this.phase = 'MIXTURE';
                this.currentLensRadius = this.lay.lensRadius; // Snap to final size
                this.startIntro(); // Trigger Calculus's dialogue now!
            }
            this.triggerRefresh(); // Force redraw every frame during animation
            return; // Skip physics processing until the lens is fully open
        }

        if (this.screenShake > 0) {
            this.screenShake -= safeDt * 30;
            if (this.screenShake < 0) this.screenShake = 0;
            needsRender = true;
        }

        // --- HEATING PHASE ---
        if (this.phase === 'HEATING') {
            if (this.isHeating) {
                this.heatProgress += safeDt;
                this.screenShake = this.heatProgress * 3;
                if (Math.random() > 0.6) this.triggerHaptic(10);
                
                this.atoms.forEach(a => {
                    a.x += (Math.random() - 0.5) * 10;
                    a.y += (Math.random() - 0.5) * 10;
                });

                if (this.heatProgress >= this.phys.heatDuration) {
                    this.formCompound();
                }
                needsRender = true;
            } else if (this.heatProgress > 0) {
                this.heatProgress = Math.max(0, this.heatProgress - safeDt * 2);
                needsRender = true;
            }
        }

        // --- HOVER DETECTION ---
        // Only check for hovers if we aren't currently dragging something, and game is active
        let prevHover = this.hoveredAtom;
        this.hoveredAtom = null; 

        if (!this.draggedAtom && (this.phase === 'MIXTURE' || this.phase === 'COMPOUND')) {
            const tip = this.getTweezerTip();
            let minDist = Infinity;
            
            // Iterate backwards to hover the top-most atom
            for (let i = this.atoms.length - 1; i >= 0; i--) {
                const a = this.atoms[i];
                const dist = Math.hypot(tip.x - a.x, tip.y - a.y);
                const hitRadius = (a.type === 'compound') ? 80 : (a.w / 2) + 10;
                
                if (dist < hitRadius && dist < minDist) {
                    minDist = dist;
                    this.hoveredAtom = a;
                }
            }
        }

        // If the hovered atom changed this frame, force a redraw
        if (prevHover !== this.hoveredAtom) {
            needsRender = true;
        }

        // --- ATOM PHYSICS ---
        const isMobile = window.innerWidth < 768 || window.innerHeight < 500;
        
        this.atoms.forEach(a => {
            if (this.draggedAtom === a) {
                const tip = this.getTweezerTip();
                const targetX = tip.x - this.dragOffset.x;
                const targetY = tip.y - this.dragOffset.y; 

                if (this.phase === 'MIXTURE') {
                    // Set velocity for throwing momentum
                    a.vx = (targetX - a.x) / safeDt * 0.5;
                    a.vy = (targetY - a.y) / safeDt * 0.5;
                    
                    // FIX: Actually apply the movement to the atom!
                    a.x += a.vx * safeDt;
                    a.y += a.vy * safeDt;
                    
                } else if (this.phase === 'COMPOUND') {
                    const dx = targetX - a.homeX;
                    const dy = targetY - a.homeY;
                    const dist = Math.hypot(dx, dy);

                    if (dist > this.phys.snapThreshold) {
                        this.draggedAtom = null;
                        a.vx = -dx * 5; 
                        a.vy = -dy * 5;
                        this.screenShake = 15;
                        this.triggerHaptic(100);
                        
                        if (!this.flags?.quizTriggered) {
                            this.flags.quizTriggered = true;
                            setTimeout(() => this.startQuiz(), 1500);
                        }
                    } else {
                        a.x = a.homeX + (dx * this.phys.springTension);
                        a.y = a.homeY + (dy * this.phys.springTension);
                    }
                }
                needsRender = true;
            } else {
                if (Math.abs(a.vx) > 0.1 || Math.abs(a.vy) > 0.1) {
                    a.x += a.vx * safeDt;
                    a.y += a.vy * safeDt;
                    
                    if (this.phase === 'MIXTURE') {
                        a.vx *= this.phys.mixtureFriction;
                        a.vy *= this.phys.mixtureFriction;
                    } else if (this.phase === 'COMPOUND') {
                        a.vx += (a.homeX - a.x) * 20 * safeDt;
                        a.vy += (a.homeY - a.y) * 20 * safeDt;
                        a.vx *= 0.8; 
                        a.vy *= 0.8;
                    }
                    needsRender = true;
                }
            }

            // Lens Boundary Collision
            const dx = a.x - this.lay.lensCenter.x;
            const dy = a.y - this.lay.lensCenter.y;
            const distFromCenter = Math.hypot(dx, dy);
            const maxRadius = this.lay.lensRadius - (a.w/2);

            if (distFromCenter > maxRadius) {
                const angle = Math.atan2(dy, dx);
                a.x = this.lay.lensCenter.x + Math.cos(angle) * maxRadius;
                a.y = this.lay.lensCenter.y + Math.sin(angle) * maxRadius;
                a.vx *= -0.5;
                a.vy *= -0.5;
                needsRender = true;
            }
        });

        // Simple Circle Collision for Mixture
        if (this.phase === 'MIXTURE') {
            for (let i = 0; i < this.atoms.length; i++) {
                for (let j = i + 1; j < this.atoms.length; j++) {
                    const a1 = this.atoms[i];
                    const a2 = this.atoms[j];
                    const dx = a2.x - a1.x;
                    const dy = a2.y - a1.y;
                    const dist = Math.hypot(dx, dy);
                    const minDist = (a1.w + a2.w) / 2 - 10;

                    if (dist < minDist && dist > 0) {
                        const overlap = minDist - dist;
                        const nx = dx / dist;
                        const ny = dy / dist;
                        
                        const pushX = nx * overlap * 0.5;
                        const pushY = ny * overlap * 0.5;
                        
                        if (this.draggedAtom !== a1) { a1.x -= pushX; a1.vx -= pushX * 10; }
                        if (this.draggedAtom !== a2) { a2.x += pushX; a2.vx += pushX * 10; }
                        needsRender = true;
                    }
                }
            }
        }

        if (this.input.x !== this.lastX || this.input.y !== this.lastY) {
            this.lastX = this.input.x;
            this.lastY = this.input.y;
            needsRender = true;
        }

        if (needsRender) this.triggerRefresh();
    }

    // ==========================================
    // RENDER LOGIC
    // ==========================================
    draw(ctx) {
        ctx.save();
        
        const sx = (Math.random() - 0.5) * this.screenShake;
        const sy = (Math.random() - 0.5) * this.screenShake;
        ctx.translate(sx, sy);

        // 1. Background
        const bg = this.assetManager.get('g12_bg_microscope');
        if (bg) ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        // 2. Microscope Lens Mask
        ctx.save();
        ctx.beginPath();
        // Use currentLensRadius instead of lay.lensRadius
        ctx.arc(this.lay.lensCenter.x, this.lay.lensCenter.y, Math.max(0.1, this.currentLensRadius), 0, Math.PI * 2);
        ctx.clip();

        // Inner lens background
        ctx.fillStyle = '#0a192f';
        ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        // --- Radial Heat Glow ---
        if (this.heatProgress > 0) {
            const centerX = this.lay.lensCenter.x;
            const centerY = this.lay.lensCenter.y;
            const radius = this.lay.lensRadius;
            
            const heatGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
            const intensity = Math.min(0.6, this.heatProgress / this.phys.heatDuration);
            const pulse = 0.5 + Math.sin(performance.now() / 80) * 0.5;
            const finalAlpha = intensity * (0.8 + 0.2 * pulse);
            
            heatGrad.addColorStop(0, `rgba(255, 60, 0, ${finalAlpha})`);
            heatGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');
            
            ctx.fillStyle = heatGrad;
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }

        // --- Optical Zoom Transform for Atoms ---
        ctx.save();
        if (this.phase === 'ZOOM_IN') {
            // Zoom from 0.5x up to 1.0x as the lens opens
            const opticalZoom = 0.5 + (0.5 * (this.currentLensRadius / this.lay.lensRadius));
            ctx.translate(this.lay.lensCenter.x, this.lay.lensCenter.y);
            ctx.scale(opticalZoom, opticalZoom);
            ctx.translate(-this.lay.lensCenter.x, -this.lay.lensCenter.y);
        }

        // 3. Draw Atoms
        this.atoms.forEach(a => {
            ctx.save();
            ctx.translate(a.x, a.y);
            if (a.rotation) ctx.rotate(a.rotation);

            // Rubber-band tension visual
            if (this.phase === 'COMPOUND' && this.draggedAtom === a) {
                const dist = Math.hypot(a.x - a.homeX, a.y - a.homeY);
                if (dist > 5) {
                    ctx.save();
                    ctx.rotate(-a.rotation);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(a.homeX - a.x, a.homeY - a.y);
                    
                    const tensionPct = Math.min(1, dist / this.phys.snapThreshold);
                    const r = Math.floor(tensionPct * 255);
                    const g = Math.floor((1 - tensionPct) * 255);
                    
                    ctx.strokeStyle = `rgba(${r}, ${g}, 0, 0.8)`;
                    ctx.lineWidth = 15 - (tensionPct * 10);
                    ctx.stroke();
                    ctx.restore();
                }
            }

            // --- Selection & Hover Glows ---
            if (this.draggedAtom === a) {
                // Actively Dragged (Bright Yellow, Large Scale)
                ctx.shadowColor = '#FFEB3B'; 
                ctx.shadowBlur = 25;
                ctx.scale(1.15, 1.15); 
            } else if (this.hoveredAtom === a && !this.isHeating) {
                // --- NEW: Hovered (Bright White, Medium Scale) ---
                ctx.shadowColor = '#FFFFFF'; 
                ctx.shadowBlur = 20;
                ctx.scale(1.08, 1.08);
            } else if (!this.isHeating) {
                // Default Resting State (Soft Cyan)
                ctx.shadowColor = "rgba(0, 255, 255, 0.2)";
                ctx.shadowBlur = 10;
            }

            let assetId = '';
            if (a.type === 'iron') assetId = 'g12_atom_iron';
            else if (a.type === 'sulfur') assetId = 'g12_atom_sulfur';
            else if (a.type === 'compound') assetId = 'g12_molecule_ironsulfide';

            const img = this.assetManager.get(assetId);
            if (img) {
                ctx.drawImage(img, -a.w/2, -a.h/2, a.w, a.h);
            } else {
                ctx.fillStyle = a.type === 'iron' ? '#555' : '#ffeb3b';
                ctx.beginPath(); ctx.arc(0, 0, a.w/2, 0, Math.PI*2); ctx.fill();
            }

            ctx.restore();
        });

        // Remove the Optical Zoom and the Lens Mask
        ctx.restore();
        ctx.restore();

        this.drawLensFrame(ctx);

        // 4. Custom Cursor (Nano-Tweezers)
        if (this.phase === 'MIXTURE' || this.phase === 'COMPOUND') {
            const tweezersOpen = this.assetManager.get('ui_icon_tweezers');
            const tweezersClosed = this.assetManager.get('ui_icon_tweezers_closed');
            
            ctx.save();
            ctx.translate(this.input.x, this.input.y);
            ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 10;

            // LOGIC FIX: Tweezers are closed if we are holding an atom OR actively clicking
            const isGripping = (this.draggedAtom !== null);
            
            // --- FIX: VISUAL ALIGNMENT ---
            // Shift the graphic upwards and to the left so that the bottom-left 
            // "prongs" of the tweezers exactly hit the (0,0) center of the cursor.
            const tipOffsetX = -15;
            const tipOffsetY = -70;

            if (isGripping) {
                if (tweezersClosed) {
                    ctx.drawImage(tweezersClosed, tipOffsetX, tipOffsetY, 80, 80);
                } else if (tweezersOpen) {
                    // Fallback squish effect
                    ctx.scale(0.65, 1.05); 
                    ctx.drawImage(tweezersOpen, tipOffsetX / 0.65, tipOffsetY, 80, 80);
                }
            } else {
                // Default Open State
                if (tweezersOpen) {
                    ctx.drawImage(tweezersOpen, tipOffsetX, tipOffsetY, 80, 80);
                }
            }

            ctx.restore();
        } else {
            // Ensure default cursor is restored if we are in HEATING_READY phase
            if (this.canvas && this.phase === 'HEATING_READY' && this.canvas.style.cursor !== 'default') {
                 this.canvas.style.cursor = 'default';
            }
        }

        if (this.dialogueShowing) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }

        ctx.restore();
    }

    drawLensFrame(ctx) {
        ctx.save();
        const cx = this.lay.lensCenter.x;
        const cy = this.lay.lensCenter.y;

        // --- Use the dynamic radius ---
        const r = this.currentLensRadius || this.lay.lensRadius; 
        
        // Prevent drawing errors when the radius is near 0
        if (r < 7) { 
            ctx.restore(); 
            return; 
        }

        try {
        // 1. Inner Depth Shadow (Hides mask aliasing perfectly)
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(10, 25, 47, 0.9)'; // Matches dark navy background
        ctx.stroke();

        // 2. Thick Metallic Base
        ctx.beginPath();
        ctx.arc(cx, cy, r + 18, 0, Math.PI * 2);
        ctx.lineWidth = 36;
        const frameGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        frameGrad.addColorStop(0, '#e0e0e0'); // Top-left highlight
        frameGrad.addColorStop(0.3, '#9e9e9e');
        frameGrad.addColorStop(0.7, '#616161');
        frameGrad.addColorStop(1, '#212121'); // Bottom-right shadow
        ctx.strokeStyle = frameGrad;
        ctx.stroke();

        // 3. Beveled Inner Ridge (Inverted gradient for 3D depth)
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.lineWidth = 4;
        const innerGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        innerGrad.addColorStop(0, '#424242'); 
        innerGrad.addColorStop(1, '#f5f5f5');
        ctx.strokeStyle = innerGrad;
        ctx.stroke();

        // 4. Beveled Outer Ridge
        ctx.beginPath();
        ctx.arc(cx, cy, r + 34, 0, Math.PI * 2);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#111'; // Sharp dark outer edge
        ctx.stroke();

        // 5. Mechanical Detail: Screws/Rivets
        ctx.fillStyle = '#424242';
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const screwX = cx + Math.cos(angle) * (r + 18);
            const screwY = cy + Math.sin(angle) * (r + 18);
            
            // Screw head base
            ctx.beginPath();
            ctx.arc(screwX, screwY, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // Screw diagonal indent
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(screwX - 3, screwY - 3);
            ctx.lineTo(screwX + 3, screwY + 3);
            ctx.stroke();
        }

        // 6. Sleek Glass Glare (Replaces the weird thick blur)
        // A sharp crescent highlight on the top-left inner rim
        ctx.beginPath();
        ctx.arc(cx, cy, r - 6, Math.PI * 0.9, Math.PI * 1.4);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.stroke();
        
        // Minor secondary dot highlight
        ctx.beginPath();
        ctx.arc(cx, cy, r - 6, Math.PI * 1.45, Math.PI * 1.50);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.stroke();
        } catch (err) { 
            console.error( err );
        }

        ctx.restore();
    }

    // ==========================================
    // QUIZ FINALE
    // ==========================================
    startQuiz() {
        this.phase = 'QUIZ';
        if (this.canvas) this.canvas.style.cursor = 'default';
        
        const btn = document.getElementById('btn-laser');
        if (btn) btn.remove();

        this.showDialogue(
            "Blistering barnacles! So the original sludge was just a loose salad, but cooking it turned it into an unbreakable soup?! What kind of witchcraft is this?!",
            "haddock", {
                animate: true, disableTypewriter: true, comicTransition: true,
                onClose: () => this.launchQuiz()
            });
    }

    launchQuiz() {
        const qData = this.lvl.questions[0];
        
        const mappedOptions = qData.options.map(opt => ({
            text: opt.label,
            correct: (opt.id === qData.correctAnswerId),
            onSelect: (isCorrect) => {
                if (isCorrect) {
                    this.triggerHaptic(20);
                    this.showDialogue("Exactly! They clicked together to form a Compound. It's a brand new substance! To un-mix this, we can't just use tweezers to separate them physically...<br>speaking of which, here come the Thomsons!", "tintin", {
                        animate: true, onClose: () => this.win()
                    });
                } else {
                    this.triggerHaptic(50);
                }
            }
        }));

        const bgImgAsset = this.assetManager.get('ui_journal_bg');
        this.quizUI.show(mappedOptions, bgImgAsset?.src, { keepOpenOnWrong: true });

        if (this.quizUI.overlayElement) {
            // FIX: Create a scroll wrapper to contain the buttons and header
            const scrollWrapper = document.createElement('div');
            scrollWrapper.className = 'quiz-scroll-wrapper';

            // Move all the buttons (which QuizOverlay just appended) into our scroll wrapper
            while (this.quizUI.overlayElement.firstChild) {
                scrollWrapper.appendChild(this.quizUI.overlayElement.firstChild);
            }

            // Create and prepend the Title Header
            const qTitle = document.createElement('h2');
            qTitle.innerText = qData.text;
            qTitle.className = 'quiz-header'; 
            scrollWrapper.insertBefore(qTitle, scrollWrapper.firstChild);

            // Re-attach the wrapped content to the main overlay
            this.quizUI.overlayElement.appendChild(scrollWrapper);
        }
    }

    destroy() {
        if (this.styleElement) this.styleElement.remove();
        if (this.canvas) this.canvas.style.cursor = 'default';
        if (this.quizUI) this.quizUI.remove();
        super.destroy();
    }
}
