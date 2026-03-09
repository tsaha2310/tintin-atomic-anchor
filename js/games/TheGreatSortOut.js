/* =========================================
   js/games/TheGreatSortOut.js
   Game 13: "The Great Sort-Out"
   Theme: Separation of Mixtures (Magnetism, Solvation, Density, Evaporation, Filtration)
   Mechanic: LucasArts Logic Puzzle with Physics Particle Simulation
   ========================================= */

import { Game } from '../Game.js';
import { QuizOverlay } from '../components/QuizOverlay.js';

export class TheGreatSortOut extends Game {

    constructor(config) {
        super(config);
        
        this.lvl = this.tuning.level_1_lab || this.tuning;
        this.particles = [];
        this.liquidVolume = 0;
        
        // State Machine
        // STATES: DRY_MIX -> IRON_REMOVED -> SUSPENSION -> IN_CENTRIFUGE -> STRATIFIED -> SEPARATED
        this.gameState = 'DRY_MIX';
        this.isAnimating = false;
        
        // Apparatus Positions
        this.pos = {
            beaker: { x: 200, y: 440, w: 200, h: 256 },
            centrifuge: { x: 650, y: 430, w: 256, h: 256 },
            sieve: { x: 900, y: 460, w: 240, h: 128 }
        };
        this.crystalSize = 8;
        this.timesCentrifugeStalled = 0;

        // --- CENTRIFUGE ALIGNMENT CONFIGURATION ---
        // Tweak these values to perfectly match your specific image asset
        this.centrifugeAnim = {
            rotorOffsetX: -38,  
            rotorOffsetY: -90, 
            spinWidth: 40,     
            spinHeight: 9,    
            
            tubeW: 25,         
            tubeH: 58,         
            curve: 15,         // For liquid internal rounding

            // --- NEW: Slot Insertion Clipping ---
            // y-coord in local tube space where the slot lip starts (e.g., 10px from center)
            clipY: 10,      
            // y-coord of the curve's control point to create the perspective "smile"
            clipCurve: 22,  

            rotorRadius: 60, // Radius of the top-down rotor image
            rotorTopOffsetY: -75,

            // Distance (in pixels) from the top of the glass to the surface of the water
            liquidTopPadding: 10, 
            
            staticLeft: -7,    
            staticTop: -78,    
            
            goldRestY: -28,    
            sandRestY: -45,
            tiltFactor: 0.005  
        };

        this.centrifugeRPM = 0;
        this.centrifugeProgress = 0;
        this.screenShake = 0;
        this.accidentCount = 0;
        this.cleanupTimer = 0;
    }

    async init() {
        this.enableSmartRendering = true;
        this.quizUI = new QuizOverlay(this.uiRoot, this.assetManager);

        await this.preload([
            'g13_bg_workbench', 'g13_glass_beaker', 'g13_centrifuge_tube', 'g13_centrifuge_base',
            'g13_atom_iron', 'g13_atom_crystal', 'g13_atom_sand', 'g13_plate_gold',
            'g13_tool_magnet', 'ui_journal_bg', 'g13_gold_muddy', 'g13_pan_sieve', 'g13_centrifuge_rotor',
            'g13_haddock_scrub', 'g13_chalkboard'
        ]);

        this.injectCSS();
        this.spawnMixture();
        this.buildActionMenu();

/*      
        // ==========================================
        // 🚨 TEMPORARY DEBUG SHORTCUT (START) 🚨
        // Remove this block when you are done tweaking this.centrifugeAnim!
        // ==========================================
        this.gameState = 'IN_CENTRIFUGE';
        this.liquidVolume = 1.0; 
        this.totalIron = 0;
        
        // Remove iron and move the rest to the centrifuge
        this.particles = this.particles.filter(p => p.type !== 'iron');
        this.particles.forEach(p => p.container = 'centrifuge');
        
        // Wire up the spin button immediately
        const spinBtn = document.getElementById('btn_spin');
        spinBtn.innerText = "🚨 MASH TO SPIN!";
        spinBtn.style.background = "#FFC107";
        let spins = 0;
        spinBtn.onclick = () => {
            spins++;
            this.centrifugeRPM += 10;
            this.screenShake = this.centrifugeRPM * 0.1;
            this.triggerHaptic(15);
            if (spins > 45) {
                spinBtn.onclick = null; 
                this.finishCentrifuge();
            }
        };
        
        this.triggerRefresh();
        return; // Exit early to skip the normal intro dialogue
        
        // ==========================================
        // 🚨 TEMPORARY DEBUG SHORTCUT (END) 🚨
        // ==========================================
*/

/* --- RESTORE THIS WHEN DONE TWEAKING --- */


        this.showDialogue(
            "Here are the Professor's lab notes on this mixture:<br><i>Iron: Magnetic.<br>Blue Crystals: Soluble in H2O.<br>Gold: High Density.<br>Sand: Low Density.</i>",
            "tintin", { animate: true, comicTransition: true }
        );

        this.triggerRefresh();
/**/
    }

    injectCSS() {
        if (this.styleElement) this.styleElement.remove();
        this.styleElement = document.createElement('style');
        this.styleElement.innerHTML = `
            /* --- Icon-Only Tool Tray --- */
            .action-menu {
                position: absolute; bottom: 20px; left: 0; width: 100%;
                display: flex; gap: 15px; z-index: 100;
                justify-content: center; flex-wrap: wrap;
                background: transparent; border: none; pointer-events: none;
            }
            .action-btn {
                width: 64px; height: 64px; flex: 0 0 auto;
                padding: 0; font-size: 32px; 
                display: flex; align-items: center; justify-content: center;
                background: #ECEFF1; color: #1a1a1a; 
                border: 4px solid #90A4AE; border-radius: 12px;
                cursor: pointer; transition: all 0.2s; box-shadow: 0 6px 0 #78909C;
                -webkit-tap-highlight-color: transparent; pointer-events: auto;
            }
            .action-btn.active {
                background: #FFCA28; border-color: #FF8F00; box-shadow: 0 6px 0 #FF8F00;
            }
            .action-btn:hover { background: #FFFFFF; transform: translateY(-4px); box-shadow: 0 10px 0 #78909C; }
            .action-btn:active { transform: translateY(2px); box-shadow: 0 2px 0 #78909C; }
            .action-btn:disabled { opacity: 0.3; pointer-events: none; }
 
            /* Comic Action Words */
            .comic-word {
                position: absolute; font-family: "Comic Sans MS", fantasy, sans-serif;
                font-weight: bold; font-size: 48px; text-transform: uppercase;
                text-shadow: 3px 3px 0px #000, -2px -2px 0px #000;
                pointer-events: none; z-index: 500;
                white-space: nowrap; /* Keep long words from wrapping */
                animation: popUp 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            
            /* --- FIX: Added translate(-50%, -50%) to center text perfectly --- */
            @keyframes popUp {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.1) rotate(-15deg); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2) rotate(5deg); }
                80% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
                100% { opacity: 0; transform: translate(-50%, -100px) scale(0.9); }
            }           

            .quiz-overlay-themed h2 {
                background-color: rgba(255,255,255,0.85);
                padding: 15px; border-radius: 8px;
                margin-bottom: 20px; font-family: sans-serif; text-align: center;
            }

            /* MOBILE LAYOUTS */
            @media (max-width: 768px) and (orientation: portrait) {
                .comic-word { font-size: 24px; } /* Shrink font for narrow screens */
                .action-menu { 
                    padding: 10px; gap: 12px; justify-content: center; 
                    
                    /* --- FIX: Force 3-Top / 2-Bottom --- */
                    /* 3 buttons (56px) + 2 gaps (12px) = 192px. Clamping at 220px forces the 4th to wrap! */
                    width: 220px; left: 50%; transform: translateX(-50%);
                }
                .action-btn { 
                    font-size: 28px; width: 56px; height: 56px; 
                    min-width: 0; padding: 0; margin-bottom: 0; 
                }
            }
            @media (max-height: 500px) and (orientation: landscape) {
                .comic-word { font-size: 24px; } /* Shrink font for short screens */
                .action-menu { 
                    position: fixed; 
                    top: 0; right: env(safe-area-inset-right, 0); bottom: auto; left: auto; 
                    
                    /* --- FIX: Widened to 160px to account for button borders! --- */
                    width: 160px; 
                    height: 100vh; 
                    
                    flex-direction: row; flex-wrap: wrap; 
                    justify-content: center; align-content: center; 
                    
                    border-top: none; border-left: 4px solid #546E7A;
                    border-radius: 0;
                    padding: 10px; gap: 10px; 
                    transform: none; 
                    background: rgba(236, 239, 241, 0.85); 
                }
                .action-btn { 
                    font-size: 26px; 
                    width: 52px; height: 52px; /* 52px + 8px border = 60px actual width */
                    padding: 0; margin: 0; min-width: 0; max-width: none;
                    box-shadow: 0 3px 0 #78909C; 
                }
                .action-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 0 #78909C; }
                .action-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #78909C; }
            }           
        `;
        document.head.appendChild(this.styleElement);
    }

    buildActionMenu() {
        // Clear Previous UI Safely
        this.clearDynamicUI();

        const menu = document.createElement('div');
        menu.className = 'action-menu';
        
        const actions = [
            { id: 'btn_water', label: '💧', onClick: () => this.useWater() },
            { id: 'btn_sieve', label: '🧺', onClick: () => this.useSieve() },
            { id: 'btn_magnet', label: '🧲', onClick: () => this.useMagnet() },
            { id: 'btn_heat', label: '♨️', onClick: () => this.useHeat() },
            { id: 'btn_spin', label: '⚙️', onClick: () => this.useCentrifuge() }
        ];

        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.className = 'action-btn';
            btn.id = a.id;
            btn.innerText = a.label;
            btn.onclick = () => { if (!this.isAnimating) a.onClick(); };
            menu.appendChild(btn);
        });

        this.uiRoot.appendChild(menu);
        this.updateMenuState();
    }

    updateMenuState() {
        const btns = this.uiRoot.querySelectorAll('.action-btn');
        btns.forEach(b => {
            b.classList.remove('active');
            b.disabled = false; // EVERY TOOL IS ALWAYS AVAILABLE!
        });
        
        if (this.activeTool === 'magnet') {
            const magBtn = this.uiRoot.querySelector('#btn_magnet');
            if (magBtn) magBtn.classList.add('active');
        }

        if (this.gameState === 'SEPARATED' || this.gameState === 'QUIZ') {
            const menu = this.uiRoot.querySelector('.action-menu');
            if (menu) menu.style.display = 'none'; // Hide UI during Quiz
        }
    }

    resetMixture() {
        this.gameState = 'DRY_MIX';
        this.liquidVolume = 0;
        this.panLiquid = 0;
        this.murkiness = 0;
        this.centrifugeRPM = 0;
        this.isAnimating = false;
        this.activeTool = null;
        this.timesCentrifugeStalled = 0;
        if (this.canvas) this.canvas.style.cursor = 'default';
        
        this.spawnMixture(); // Respawn the original dry particles
        // Rebuild the entire UI tray to wipe any hijacked buttons
        this.buildActionMenu();
        this.triggerRefresh();
    }

    spawnMixture() {
        this.particles = [];
        const bx = this.pos.beaker.x;
        const by = this.pos.beaker.y + 40; 
        
        const config = this.lvl.particles || { iron: 15, crystals: 12, sand: 25 };
        this.totalIron = config.iron; // Track for magnet logic

        // Gold Plate starts as muddy
        this.particles.push({ type: 'gold', x: bx, y: by + 20, vx: 0, vy: 0, size: 60, homeY: by + 20, container: 'beaker' });

        const spawnGroup = (type, count, size) => {
            for (let i = 0; i < count; i++) {
                this.particles.push({
                    type: type,
                    x: bx + (Math.random() - 0.5) * 80,
                    y: by - (Math.random() * 80),
                    vx: 0, vy: 0, size: size,
                    container: 'beaker'
                });
            }
        };

        spawnGroup('sand', config.sand, 16);
        spawnGroup('crystal', config.crystals, this.crystalSize);
        spawnGroup('iron', config.iron, 24);
    }

    spawnComicWord(text, x, y, color) {
        const word = document.createElement('div');
        word.className = 'comic-word';
        word.innerText = text;
        
        // --- FIX: Convert absolute game coordinates to UI percentages ---
        const leftPct = (x / this.SAFE_WIDTH) * 100;
        const topPct = (y / this.SAFE_HEIGHT) * 100;
        
        word.style.left = `${leftPct}%`;
        word.style.top = `${topPct}%`;
        word.style.color = color;
        
        this.uiRoot.appendChild(word);
        setTimeout(() => word.remove(), 1800);
    }

    // ==========================================
    // LOGIC & TRAPS
    // ==========================================

    triggerTrap(sarcasticText, character) {
        this.isAnimating = true;
        this.accidentCount++;
        
        // Disable all buttons immediately
        const btns = this.uiRoot.querySelectorAll('.action-btn');
        btns.forEach(b => { b.disabled = true; b.classList.remove('active'); });
        if (this.canvas) this.canvas.style.cursor = 'default';
        this.activeTool = null;

        this.showDialogue(sarcasticText, character, { 
            animate: true, 
            comicTransition: true, 
            onClose: () => {
                // Enter the 30-second unskippable cleanup phase
                this.gameState = 'CLEANUP';
                this.cleanupTimer = 30.0; // 30 second penalty!
                this.triggerRefresh();
            } 
        });
    }

    useMagnet() {
        // TRAP: Dipping magnet in water
        if (this.gameState === 'SUSPENSION' || this.gameState === 'STRATIFIED' || this.gameState === 'IN_CENTRIFUGE') {
            this.triggerTrap("Ah, fishing for iron in the mud? You'll catch nothing but rust and my eternal disappointment. Magnets and wet sludge make poor bedfellows.", "haddock");
            return;
        }

        // TRAP: Waving magnet over empty/dry dirt with no iron
        if (this.gameState !== 'DRY_MIX') {
            this.triggerTrap("Waving a magnet over a pile that has no iron left... Are you hoping to discover a new fundamental force of physics? Move on!", "calculus");
            return;
        }
        
        // Toggle Magnet Tool Selection
        this.activeTool = this.activeTool === 'magnet' ? null : 'magnet';
        if (this.canvas) this.canvas.style.cursor = this.activeTool === 'magnet' ? 'none' : 'default';
        this.updateMenuState();
    }


    useWater() {
        if (this.gameState === 'DRY_MIX') {
            this.spawnComicWord("SPLOOSH!", this.pos.beaker.x, this.pos.beaker.y, "#00BCD4");
            this.triggerHaptic(300);
            this.triggerTrap("Oh, brilliant. You've invented rust-flavored concrete. The masonry guild will be thrilled. Now I have to chisel this out...", "haddock");
            return;
        }

        if (this.gameState === 'EVAPORATING' || this.gameState === 'EVAPORATED' || this.gameState === 'FILTERING') {
            this.spawnComicWord("SPLOOSH!", this.pos.sieve.x, this.pos.sieve.y, "#00BCD4");
            this.triggerHaptic(200);
            this.triggerTrap("Ah, yes. We spend an hour boiling the water away to recover the crystals, and you immediately drown them again. A true pioneer of the infinite loop.", "tintin");
            return;
        }

        // TRAP: Already wet
        if (this.gameState === 'SUSPENSION' || this.gameState === 'STRATIFIED' || this.gameState === 'IN_CENTRIFUGE') {
            this.triggerTrap("Fascinating. You're attempting to drown a puddle. Next, perhaps you'll try to set fire to the sun? We have enough solvent, thank you.", "calculus");
            return;
        }

        if (this.gameState === 'IRON_REMOVED') {
            // CORRECT ACTION: Solvation
            this.isAnimating = true;
            this.liquidVolume = 0;
            this.dissolving = true;
            this.triggerHaptic(50);

            const dissolveInterval = setInterval(() => {
                this.liquidVolume += 0.05;
                let crystalsLeft = false;
                this.particles.forEach(p => {
                    if (p.type === 'crystal') {
                        p.size *= 0.9;
                        if (p.size > 2) crystalsLeft = true;
                    }
                });

                if (this.liquidVolume >= 1.0 && !crystalsLeft) {
                    clearInterval(dissolveInterval);
                    this.particles = this.particles.filter(p => p.type !== 'crystal');
                    this.gameState = 'SUSPENSION';
                    this.dissolving = false;
                    this.isAnimating = false;
                    this.updateMenuState();
                    this.showDialogue("The crystals dissolved into the water! Now we have a fluid medium.", "tintin");
                }
                this.triggerRefresh();
            }, 50);
        }
    }

    useCentrifuge() {
        // TRAP: Centrifuging dry dirt
        if (this.gameState === 'DRY_MIX' || this.gameState === 'IRON_REMOVED') {
            this.triggerHaptic(300);
            this.triggerTrap(
                "<b>CLANG! CLATTER! CRASH!</b><br>What a delightful symphony of scratching glass. If you wanted to grind rocks, you should have bought a blender. Centrifuges require a certain... fluid grace.", 
                "calculus"
            );
            return;
        }

        // TRAP: Centrifuging the Sieve
        if (this.gameState === 'EVAPORATING' || this.gameState === 'EVAPORATED' || this.gameState === 'FILTERING') {
            this.triggerTrap("Ah, the classic 'shove a large metal sieve into delicate high-speed machinery' maneuver. A bold choice for those who despise keeping their eyebrows attached.", "haddock");
            return;
        }

        // CORRECT ACTION
        if (this.gameState === 'SUSPENSION') {
            this.isAnimating = true;
            this.particles.forEach(p => { p.container = 'centrifuge'; });
            this.gameState = 'IN_CENTRIFUGE';
            this.centrifugeProgress = 0; 

            this.hasSpun = false; 
            this.centrifugeHintGiven = false;

                        // The Cryptic Hint
            this.showDialogue("Ah, my vintage hand-cranked centrifuge! It lacks an electric motor, so we must rely entirely on continuous mechanical momentum...", "calculus", { animate: true, comicTransition: true, onClose: () => {
                const spinBtn = document.getElementById('btn_spin');
                spinBtn.innerText = "🚨";
                spinBtn.style.background = "#FFC107";
                spinBtn.onclick = () => {
                    this.centrifugeRPM += 25; 
                    this.triggerHaptic(15);
                };
            }});
        } else if (this.gameState !== 'IN_CENTRIFUGE') {
            this.showDialogue("The centrifuge has already done its job!", "tintin");
        }
    }

    useHeat() {
        // TRAP: Boiling the wet mud too early
        if (this.gameState === 'SUSPENSION' || this.gameState === 'IN_CENTRIFUGE') {
            this.triggerTrap("Excellent. You're baking a mud pie. Just what I always wanted. Now the blue crystals are permanently entombed in terracotta.", "haddock");
            return;
        } 
        
        // TRAP: Heating an empty/dry beaker
        if (this.gameState === 'DRY_MIX' || this.gameState === 'IRON_REMOVED') {
            this.triggerTrap("Applying intense thermal radiation to dry glassware... Are we attempting to separate mixtures, or just practicing advanced methods of shattering beakers?", "tintin");
            return;
        }
       
        // TRAP: Heating already dry items
        if (this.gameState === 'EVAPORATED' || this.gameState === 'FILTERING' || this.gameState === 'SEPARATED') {
            this.triggerTrap("Brilliant. Let's apply intense heat to a pile of completely dry dust and a highly conductive gold plate. I'll fetch the fire extinguisher.", "calculus");
            return;
        }

        // CORRECT ACTION
        if (this.gameState === 'STRATIFIED') {
            this.isAnimating = true;
            this.triggerHaptic(100);

            this.liquidVolume = 0; 
            this.panLiquid = 1.0;  

            this.particles.forEach((p) => { 
                if (p.type === 'sand' || p.type === 'gold') {
                    p.container = 'sieve'; 
                    p.x = this.pos.sieve.x + (Math.random()-0.5)*80; 
                    p.y = this.pos.sieve.y - 60 - (Math.random()*30); 
                    p.vy = 0; 
                }
            });

            const config = this.lvl.particles || { crystals: 12 };
            for (let i = 0; i < config.crystals; i++) {
                this.particles.push({
                    type: 'crystal',
                    x: this.pos.sieve.x + (Math.random()-0.5)*80,
                    y: this.pos.sieve.y - 50 - (Math.random()*20), 
                    vx: 0, vy: 0, 
                    size: 10, 
                    container: 'sieve',
                    scale: 0 
                });
            }

            this.gameState = 'EVAPORATING'; 
            this.showDialogue("<b>Boiling!</b> The heat lamp is vaporizing the water. Watch the dissolved crystals reform as the water leaves!", "tintin");
            this.updateMenuState();
        }
    }

    useSieve() {
        if (this.gameState === 'DRY_MIX' || this.gameState === 'IRON_REMOVED') {
            this.triggerTrap("Fascinating strategy. You poured dry dirt through a hole, and it fell out the bottom. A true breakthrough in physics.", "calculus");
            return;
        }

        if (this.gameState === 'SUSPENSION' || this.gameState === 'STRATIFIED' || this.gameState === 'IN_CENTRIFUGE') {
            this.triggerTrap("Incredible. You just poured the dissolved crystals right through the mesh and into the drain. The sewer rats will have very shiny teeth.", "calculus");
            return;
        }

        // CORRECT ACTION
        if (this.gameState === 'EVAPORATED') {
            this.isAnimating = true;
            this.triggerHaptic(100);
            
            this.gameState = 'FILTERING';
            this.screenShake = 0; 
            
            this.particles.forEach(p => {
                if (p.container === 'sieve') p.vy = -50 - Math.random() * 100;
            });

            this.showDialogue("<b>Shake it!</b> The sieve's wire mesh will only let the tiny sand grains and crystals fall through...", "calculus", { animate: true, disableTypewriter: true });
            this.updateMenuState();
        }
    }

    finishCentrifuge() {
        const spinBtn = document.getElementById('btn_spin');
        if(spinBtn){
            spinBtn.innerText = "⚙️ ";
            spinBtn.style.background = "";
            spinBtn.onclick = () => { if (!this.isAnimating) this.useCentrifuge(); };
        }
        
        this.gameState = 'STRATIFIED';
        this.centrifugeRPM = 0;
        this.screenShake = 0;
        
        // --- NEW: Park the rotor perfectly at the front ---
        this.tubeOrbitAngle = Math.PI / 2; 
        
        const cfg = this.centrifugeAnim;
        const goldY = this.pos.centrifuge.y + cfg.goldRestY; 
        const sandY = this.pos.centrifuge.y + cfg.sandRestY; 

        this.particles.forEach(p => {
            if (p.type === 'gold') p.homeY = goldY;
            if (p.type === 'sand') p.homeY = sandY;
        });

        this.showDialogue("Marvelous! The immense G-force pushed the heaviest object (Gold) to the very bottom. The lighter sand sits in the middle, and the water floats on top!", "calculus");
        this.isAnimating = false;
        this.updateMenuState();
    }

    startQuiz() {
        this.gameState = 'QUIZ';
        this.updateMenuState(); // Hides the action menu
        
        // A fun, multi-character exchange to set up the science!
        this.showDialogue(
            "We found it, Captain! The pure Gold Plate! It was hiding in the filth all along!",
            "tintin", { 
                animate: true, comicTransition: true, onClose: () => {
            this.showDialogue(
                "Blistering Barnacles! Did you see that? The blue crystals magically appeared out of thin air!", 
                "haddock", { animate: true, comicTransition: true, onClose: () => {
                    this.showDialogue(
                        "Nonsense, Captain! It isn't magic, it is simple chemistry! Let's see if our young lab assistant understands what just happened...", 
                        "calculus", { animate: true, comicTransition: false, onClose: () => {
                            this.launchQuiz(0);
                        }}
                    );
                }}
            );
        }});
    }

    launchQuiz(qIndex) {
        const questions = this.lvl.questions;
        if (qIndex >= questions.length) {
            this.win();
            return;
        }

        const qData = questions[qIndex];
        const mappedOptions = qData.options.map(opt => ({
            text: opt.label,
            correct: (opt.id === qData.correctAnswerId),
            onSelect: (isCorrect) => {
                if (isCorrect) {
                    this.triggerHaptic(20);
                    this.launchQuiz(qIndex + 1);
                } else {
                    this.triggerHaptic(50);
                }
            }
        }));

        const bgSrc = this.assetManager.get('ui_journal_bg')?.src || null;
        this.quizUI.show(mappedOptions, bgSrc, { keepOpenOnWrong: true });

        if (this.quizUI.overlayElement) {
            const qTitle = document.createElement('h2');
            qTitle.innerText = qData.text;
            qTitle.className = 'quiz-header';
            this.quizUI.overlayElement.insertBefore(qTitle, this.quizUI.overlayElement.firstChild);
        }
    }

    // ==========================================
    // PHYSICS & RENDERING
    // ==========================================

    update(dt) {
        let needsRender = false;
        const safeDt = Math.min(dt, 0.05);

        if (this.screenShake > 0) {
            if (this.gameState !== 'IN_CENTRIFUGE' && this.gameState !== 'SEPARATED') {
                this.screenShake -= safeDt * 20;
                if (this.screenShake < 0) this.screenShake = 0;
            }
            needsRender = true;
        }

        // --- THE UNSKIPPABLE CLEANUP PENALTY ---
        if (this.gameState === 'CLEANUP') {
            this.cleanupTimer -= safeDt;
            needsRender = true;
            
            // --- NEW: Haddock's Comic Exclamations ---
            this.curseTimer = (this.curseTimer || 0) + safeDt;
            // Spawn a new angry word roughly every 5 seconds
            if (this.curseTimer > 5) {
                this.curseTimer = 0;
                if (Math.random() > 0.3) { // 70% chance to actually yell
                    const curses = this.commonTuning.haddockCurses || ["@#$*!", "BASHI-BAZOUKS!", "TROGLODYTES!"];
                    const word = curses[Math.floor(Math.random() * curses.length)];
                    
                    // Scatter them randomly around the center of the screen
                    const cx = (this.SAFE_WIDTH / 2) - 100 + (Math.random() * 200);
                    const cy = (this.SAFE_HEIGHT / 2) - 150 + (Math.random() * 300);
                    
                    // Pick a random comic-book color (Red, Blue, Yellow, or Green)
                    const colors = ["#D32F2F", "#1976D2", "#FBC02D", "#388E3C"];
                    const color = colors[Math.floor(Math.random() * colors.length)];

                    this.spawnComicWord(word, cx, cy, color);
                }
            }
            
            if (this.cleanupTimer <= 0) {
                this.curseTimer = 0; // Reset for next time
                this.resetMixture();
            }
        }

        // --- PHYSICS LOGIC ---
        const isMagnetPulling = (this.activeTool === 'magnet' && this.input.isDown);
        const influenceRadiusSq = 200 * 200;
        const time = performance.now() / 1000;

        // Track water murkiness over time
        if (this.gameState === 'SUSPENSION') {
            this.murkiness = Math.min(1, (this.murkiness || 0) + safeDt * 0.5);
        } else if (this.gameState === 'DRY_MIX') {
            this.murkiness = 0; // Only reset at the very beginning of the game
        }

        if (this.activeTool === 'magnet') needsRender = true;
        if (this.murkiness > 0 && this.murkiness < 1) needsRender = true;

        // Advance Orbit Angle once per frame
        if (this.gameState === 'IN_CENTRIFUGE') {
            // Start at 90 degrees (Math.PI / 2) so it perfectly aligns with the static asset
            this.tubeOrbitAngle = (this.tubeOrbitAngle || (Math.PI / 2)) + (this.centrifugeRPM * safeDt * 0.05);
        }

        this.particles.forEach((p, i) => {
            p.x += p.vx * safeDt;
            p.y += p.vy * safeDt;
            p.vx *= 0.9; // Friction
            p.vy *= 0.9; 

            // Active Magnet Pull
            if (isMagnetPulling && p.type === 'iron' && !p.remove) {
                const dx = this.input.x - p.x;
                const dy = this.input.y - p.y;
                const distSq = dx*dx + dy*dy;

                if (distSq < influenceRadiusSq && distSq > 400) {
                    const strength = 1 - (distSq / influenceRadiusSq);
                    const pull = 4000 * strength * safeDt;
                    p.vx += (dx / Math.sqrt(distSq)) * pull;
                    p.vy += (dy / Math.sqrt(distSq)) * pull - (600 * safeDt); 
                    needsRender = true;
                } else if (distSq <= 400) {
                    p.remove = true;
                    this.totalIron--;
                    if (Math.random() > 0.5) this.triggerHaptic(10);
                    needsRender = true;
                }
            }

            // --- 1. BEAKER PHYSICS (Floating vs Dry) ---
            if (p.container === 'beaker') {
                // Adjust floor by half the particle size so images don't clip below the beaker
                const floor = this.pos.beaker.y + 80 - (p.size / 2);
                
                // ONLY SUSPENSION IS WET. IRON_REMOVED IS DRY!
                if (this.gameState === 'SUSPENSION') {
                    // Adjust liquid top boundary by half the particle size as well
                    const liqTop = this.pos.beaker.y + 80 - (100 * this.liquidVolume) + (p.size / 2);
                    
                    if (p.type === 'sand') {
                        // Aggressive swirling fluid dynamics for sand
                        p.vy += Math.sin(time * 3 + p.x) * 180 * safeDt; 
                        p.vx += Math.cos(time * 2.5 + p.y) * 120 * safeDt; 
                        p.vy += 10 * safeDt; // Very slight gravity bias
                    } else if (p.type === 'gold') {
                        // Muddy gold wobbles heavily, sinks slowly
                        p.vy += 30 * safeDt; 
                        p.vx += Math.sin(time * 4 + p.y) * 60 * safeDt;
                    }

                    // Soft Contain within liquid bounds (using adjusted floor and top)
                    if (p.y > floor) { p.y = floor; p.vy *= -0.5; }
                    if (p.y < liqTop) { p.y = liqTop; p.vy *= -0.5; }

                } else {
                    // Dry Physics (Gravity) - Applies to DRY_MIX and IRON_REMOVED
                    let pileY = floor;
                    
                    // Create a scattered, messy heap for sand, iron, and crystals
                    if (p.type !== 'gold') {
                        // Use the array index 'i' to generate a stable random resting height
                        const randomYOffset = (i * 17) % 28; 
                        const distFromCenter = Math.abs(p.x - this.pos.beaker.x);
                        const moundShape = Math.max(0, 30 - distFromCenter) * 0.4; // Slightly higher in the middle
                        
                        pileY = floor - randomYOffset - moundShape;
                    }

                    // Apply gravity if above the pile
                    if (p.y < pileY && p.type !== 'gold' && !isMagnetPulling) {
                        p.vy += 500 * safeDt; 
                    }
                    
                    // Stop at the pile's surface
                    if (p.y > pileY) {
                        // Let the magnet pull iron freely, but stop everything else
                        if (!(isMagnetPulling && p.type === 'iron')) {
                            p.y = pileY; 
                            p.vy = 0; 
                            p.vx *= 0.8; // Dampen sliding to settle the pile
                        }
                    }
                }

                // Horizontal Beaker Bounds (Adjusted by particle size so they don't clip through walls)
                const leftBound = this.pos.beaker.x - 50 + (p.size / 2);
                const rightBound = this.pos.beaker.x + 50 - (p.size / 2);
                if (p.x < leftBound) { p.x = leftBound; p.vx *= -0.5; }
                if (p.x > rightBound) { p.x = rightBound; p.vx *= -0.5; }
                
                if (this.dissolving) {
                    p.x += (Math.random()-0.5) * 4; p.y += (Math.random()-0.5) * 4;
                }
            }
            
            // --- 2. CENTRIFUGE PHYSICS ---
            if (p.container === 'centrifuge') {
                const cfg = this.centrifugeAnim;
                const rotorCX = this.pos.centrifuge.x + cfg.rotorOffsetX;
                const rotorCY = this.pos.centrifuge.y + cfg.rotorOffsetY;
                
                if (this.gameState === 'IN_CENTRIFUGE') {
                    // Calculate orbit perfectly linked to the config
                    const angle = this.tubeOrbitAngle || (Math.PI / 2);
                    const tubeCenterX = rotorCX + Math.cos(angle) * cfg.spinWidth;
                    const tubeCenterY = rotorCY + Math.sin(angle) * cfg.spinHeight; 

                    // Calculate center of the liquid mass to keep particles submerged
                    const liquidCenterY = (cfg.liquidTopPadding) / 2;

                    p.x = tubeCenterX + (Math.random()-0.5) * (this.centrifugeRPM * 0.1);
                    p.y = tubeCenterY + liquidCenterY + (Math.random()-0.5) * (this.centrifugeRPM * 0.2);
                    
                } else if (this.gameState === 'STRATIFIED') {
                    // Rest Center X is derived from the staticLeft + half width
                    const restCenterX = this.pos.centrifuge.x + cfg.staticLeft + (cfg.tubeW / 2); 

                    // No noise for Gold so it centers perfectly. Reduce noise for sand to fit narrow tube.
                    const noiseX = (p.type === 'gold') ? 0 : (i % 12) - 6; 
                    const noiseY = (p.type === 'gold') ? 0 : (i % 6) - 3;
                    
                    // Keep gold perfectly flat, but let sand "breathe" slightly
                    const settlePulse = (p.type === 'gold') ? 0 : Math.sin(time * 2 + i) * 1.5; 
                    
                    const targetX = restCenterX + noiseX;
                    const targetY = p.homeY + noiseY + settlePulse;

                    if (Math.abs(p.y - targetY) > 0.5) p.y += (targetY - p.y) * 8 * safeDt;
                    if (Math.abs(p.x - targetX) > 0.5) p.x += (targetX - p.x) * 8 * safeDt;
                    needsRender = true;
                }
            }

            // --- 3. SIEVE PHYSICS (Boiling & Filtering) ---
            if (p.container === 'sieve') {
                const meshY = this.pos.sieve.y - 20; // The wire mesh near the top
                const bucketBottomY = this.pos.sieve.y + 75; // Inside the bottom bucket
                
                if (this.gameState === 'EVAPORATING' || this.gameState === 'EVAPORATED') {

                    let targetX = p.x;
                    let restY = meshY; // Default flat rest for the large gold plate

                    // --- POLISH: Make sand and crystals form an organic mound on TOP of the mesh ---
                    if (p.type === 'sand' || p.type === 'crystal') {
                        // Gather them towards the center horizontally
                        const spreadX = ((i * 137) % 60) - 30; 
                        targetX = this.pos.sieve.x + spreadX;
                        
                        // Add organic bumpiness
                        const noiseX = Math.sin(i * 12.5) * 30; 
                        const noiseY = Math.cos(i * 7.3) * 6;
                        const moundHeight = Math.max(0, 25 - Math.abs(noiseX)) * 0.3;
                        
                        restY = meshY - 2 + noiseY - moundHeight;
                    }

                    // Apply gravity until they hit their organic resting spot
                    if (p.y < restY) {
                        p.vy += 600 * safeDt; 
                        // Gently guide the small particles horizontally into the pile as they fall
                        if (p.type !== 'gold') p.x += (targetX - p.x) * 5 * safeDt;
                    } else { 
                        p.y = restY; 
                        if (p.type !== 'gold') p.x = targetX; 
                        p.vy = 0; 
                        p.vx = 0; 
                    }

                } else if (this.gameState === 'FILTERING' || this.gameState === 'SEPARATED') {
                    
                    // Small particles (Sand AND Crystals) trickle through!
                    if (p.type === 'sand' || p.type === 'crystal') {
                        const spreadX = ((i * 137) % 70) - 35; 
                        const distFromCenter = Math.abs(spreadX);
                        const targetX = this.pos.sieve.x + spreadX; 
                        
                        const noiseX = Math.sin(i * 12.5) * 50; 
                        const noiseY = Math.cos(i * 7.3) * 8;
                        const moundHeight = Math.max(0, 30 - Math.abs(noiseX)) * 0.3;
                        const pileY = bucketBottomY - 5 + noiseY - moundHeight; 
                        
                        if (p.y < pileY) {
                            if (p.y > meshY - 5 && p.y < meshY + 10) {
                                p.vy = 40 + Math.random() * 40; // Sifting slow-down
                                p.x += (Math.random() - 0.5) * 6; 
                            } else {
                                p.vy += 800 * safeDt; 
                            }
                            if (p.y > meshY + 10) p.x += (targetX - p.x) * 6 * safeDt; 
                        } else {
                            p.y = pileY; p.x = targetX; p.vy = 0; p.vx = 0;
                        }
                    } else if (p.type === 'gold') {
                        // Gold plate is too big, gets caught by the top mesh
                        if (p.y < meshY) p.vy += 600 * safeDt;
                        else { 
                            if (p.vy > 80) {
                                p.y = meshY; p.vy *= -0.3; // Bounce
                                if (Math.random() > 0.5) this.triggerHaptic(15); 
                            } else {
                                p.y = meshY; p.vy = 0; 
                            }
                        }
                    }
                }
            }
            
            if (Math.abs(p.vx) > 0 || Math.abs(p.vy) > 0) needsRender = true;
        });

        // Cleanup removed iron
        this.particles = this.particles.filter(p => !p.remove);

        // Phase Transitions
        if (this.gameState === 'DRY_MIX' && this.totalIron <= 0) {
            this.gameState = 'IRON_REMOVED';
            this.activeTool = null;
            if (this.canvas) this.canvas.style.cursor = 'default';
            this.updateMenuState();
            this.spawnComicWord("CLACK!", this.pos.beaker.x, this.pos.beaker.y - 100, "#FFFFFF");
            this.showDialogue("Perfect! The magnetic iron is extracted. Now, how do we separate the sand from the blue crystals?", "tintin");
        }

        if (this.gameState === 'EVAPORATING') {
            if (this.panLiquid > 0) {
                this.panLiquid -= safeDt * 0.35; 
                if (this.panLiquid < 0) this.panLiquid = 0;
                
                // Grow the image assets dynamically as water boils!
                this.particles.forEach(p => {
                    if (p.type === 'crystal') p.scale = 1 - this.panLiquid; 
                });
                needsRender = true;
            } else {
                this.gameState = 'EVAPORATED';
                this.isAnimating = false;
                this.triggerRefresh();
                this.updateMenuState();
            }
        }

        if (this.gameState === 'FILTERING') {
            const isFalling = this.particles.some(p => (p.type === 'sand' || p.type === 'crystal') && p.vy > 0);
            if (!isFalling) {
                this.screenShake = 0;
                this.gameState = 'SEPARATED';
                this.isAnimating = false;
                this.goldRevealAnim = 0; // Triggers the Gold Flash
                this.updateMenuState();
                this.spawnComicWord("TA-DA!", this.pos.sieve.x, this.pos.sieve.y - 100, "#FBC02D");
                this.startQuiz();
            }
        }

        // --- CENTRIFUGE RPM, DECAY, AND COMPLETION LOGIC ---
        if (this.gameState === 'IN_CENTRIFUGE') {
            const oldcentrifugeRPM = this.centrifugeRPM;
            
            // 1. Apply constant friction (Decay)
            if (this.centrifugeRPM > 0) {
                this.centrifugeRPM -= safeDt * 40; // Loses 40 RPM per second
                if (this.centrifugeRPM < 0) this.centrifugeRPM = 0;

                // Flag that the player has at least tried cranking it
                this.hasSpun = true; 
            }

            // 2. Cap the maximum speed
            if (this.centrifugeRPM > 200) this.centrifugeRPM = 200;

            // 3. Screen shake based on current RPM
            this.screenShake = this.centrifugeRPM * 0.05;
            if (this.centrifugeRPM > 0) needsRender = true;

            if (this.centrifugeRPM === 0 && oldcentrifugeRPM > this.centrifugeRPM) {
                ++this.timesCentrifugeStalled;

                // If they cranked it, but let it stop completely without finishing the phase
                if (this.hasSpun && this.centrifugeRPM === 0) {
                    if (this.timesCentrifugeStalled > 9 && !this.dialogueShowing && !this.centrifugeHintGiven) {
                        this.centrifugeHintGiven = true; // Only show this hint once!
                        this.showDialogue("It lost momentum and stopped! You can't just crank it once, Captain. You have to keep pushing it to build up the speed!", "tintin", { comicTransition: true });
                    }
                }
            }

            // 4. Completion Logic (Hold > 120 RPM for 2 seconds)
            if (this.centrifugeRPM > 120) {
                this.centrifugeProgress += safeDt;
                // Optional: Change button color to green as they hold it
                const spinBtn = document.getElementById('btn_spin');
                if (spinBtn && this.centrifugeProgress > 0.5) spinBtn.style.background = "#4CAF50";
                
                // If they held it long enough, finish!
                if (this.centrifugeProgress >= 2.0) {
                    this.finishCentrifuge();
                }
            } else {
                // If they drop below the target speed, slowly lose progress
                this.centrifugeProgress -= safeDt;
                if (this.centrifugeProgress < 0) this.centrifugeProgress = 0;
                
                const spinBtn = document.getElementById('btn_spin');
                if (spinBtn) spinBtn.style.background = "#FFC107"; // Back to yellow
            }
        }

        // Handle Gold Reveal & Steam Fade Animation
        if (this.gameState === 'SEPARATED' && this.goldRevealAnim !== undefined && this.goldRevealAnim < 2) {
            // Progress the animation timer safely using delta time
            this.goldRevealAnim += safeDt * 2; 
            needsRender = true; // Keep the canvas refreshing until steam is gone!
        }

        if (needsRender || this.isAnimating || this.liquidVolume > 0) {
            this.triggerRefresh();
        }
    }

    draw(ctx) {
        ctx.save();
        const sx = (Math.random() - 0.5) * this.screenShake;
        const sy = (Math.random() - 0.5) * this.screenShake;
        ctx.translate(sx, sy);

        // 1. Background
        const bg = this.assetManager.get('g13_bg_workbench');
        if (bg) ctx.drawImage(bg, 0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        else { ctx.fillStyle = '#455A64'; ctx.fillRect(0,0, this.SAFE_WIDTH, this.SAFE_HEIGHT); }

        // --- Draw the Lab Accident Counter ---
        const chalk = this.assetManager.get('g13_chalkboard');
        if (chalk) {
            const cbSz = {w: 256, h: 192 };
            ctx.drawImage(chalk, this.SAFE_WIDTH - cbSz.w - 20, 20, cbSz.w, cbSz.h);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 48px "Comic Sans MS", cursive';
            // Cross out the zero and write the real number of accidents
            ctx.fillText(this.accidentCount.toString(), this.SAFE_WIDTH - cbSz.w / 2 - 20, 160);
        }

        // Darkish overlay so that our lab items pop out
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        // 2. Draw Apparatuses
        this.drawSprite(ctx, 'g13_glass_beaker', this.pos.beaker);

        // Draw the Base Machine
        this.drawSprite(ctx, 'g13_centrifuge_base', this.pos.centrifuge);
 
        // DRAW ORBITING CENTRIFUGE TUBES & LIQUID (With Slot Insertion Clipping) 
        const cfg = this.centrifugeAnim;
        const rotorCX = this.pos.centrifuge.x + cfg.rotorOffsetX;
        const rotorCY = this.pos.centrifuge.y + cfg.rotorOffsetY;

        // DRAW ROTATING ROTOR DISC WITH 3D PERSPECTIVE ---
        if (this.gameState === 'IN_CENTRIFUGE') {
            const rotorImg = this.assetManager.get('g13_centrifuge_rotor');
            if (rotorImg) {
                const rotorTopCY = this.pos.centrifuge.y + cfg.rotorTopOffsetY;
                ctx.save();
                ctx.translate(rotorCX, rotorTopCY);
                
                // MAGIC TRICK: Squash the Y-axis to match our orbit's exact perspective!
                ctx.scale(1, cfg.spinHeight / cfg.spinWidth);
                
                // Rotate the disc to perfectly match the tubes' angle
                ctx.rotate(this.tubeOrbitAngle || (Math.PI / 2));
                
                // Draw the top-down image centered
                ctx.drawImage(rotorImg, -cfg.rotorRadius, -cfg.rotorRadius, cfg.rotorRadius * 2, cfg.rotorRadius * 2);
                ctx.restore();
            }       
        }

        const tubeImg = this.assetManager.get('g13_centrifuge_tube');

        // 1. Calculate depths and sort tubes back-to-front
        let tubes = [];
        const baseAngle = this.tubeOrbitAngle || (Math.PI / 2);
        
        for(let i = 0; i < 4; i++) {
            // If we are stopped, we ONLY process the main tube (0)
            //if (this.gameState !== 'IN_CENTRIFUGE' && i !== 0) continue;
            if (this.gameState !== 'IN_CENTRIFUGE') {
                if (this.gameState === 'STRATIFIED') {
                    if (i != 0) break;
                } else {
                    break;
                }
            }
            
            const angle = baseAngle + (i * Math.PI / 2);
            // Math.sin(angle) gives us the Y-axis depth. Negative is back, Positive is front.
            tubes.push({ id: i, angle: angle, depth: Math.sin(angle) });
        }
        
        // Sort ascending by depth (Back tubes drawn first, Front tubes drawn last)
        tubes.sort((a, b) => a.depth - b.depth);

        // 2. Draw them in the sorted order
        for (const tube of tubes) {
            const i = tube.id;
            let tubeCX, tubeCY, tilt = 0;

            // BUG FIX: Only use orbit math while actively IN_CENTRIFUGE
            if (this.gameState === 'IN_CENTRIFUGE') {
                tubeCX = rotorCX + Math.cos(tube.angle) * cfg.spinWidth;
                tubeCY = rotorCY + Math.sin(tube.angle) * cfg.spinHeight;

                if (this.centrifugeRPM > 0) {
                    tilt = Math.cos(tube.angle) * (this.centrifugeRPM * cfg.tiltFactor);
                }
            } else {
                // Return to static resting position when STRATIFIED
                tubeCX = this.pos.centrifuge.x + cfg.staticLeft + (cfg.tubeW / 2);
                tubeCY = this.pos.centrifuge.y + cfg.staticTop + (cfg.tubeH / 2);
            }

            if (i === 0 && this.gameState === 'STRATIFIED') {
                // Darkish overlay so that the final test tube stands out
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
            }

            ctx.save(); 
            ctx.translate(tubeCX, tubeCY);
            ctx.rotate(tilt);

            // --- 1. DEFINE SLOT CLIPPING MASK ---
            const halfW = cfg.tubeW / 2;
            const halfH = cfg.tubeH / 2;

            // FIX: clip the tube into the slot while it's inside the machine!
            if (this.gameState === 'IN_CENTRIFUGE') {
                ctx.beginPath();
                ctx.moveTo(-halfW, -halfH); 
                ctx.lineTo(halfW, -halfH);  
                ctx.lineTo(halfW, cfg.clipY); 
                ctx.quadraticCurveTo(0, cfg.clipCurve, -halfW, cfg.clipY);
                ctx.closePath();
                ctx.clip(); 
            }

            // --- 2. DRAW TUBE ASSET (Clipped or Unclipped) ---
            if (tubeImg) {
                // Add a pulsating glow to the main solution tube when finished!
                if (i === 0 && this.gameState === 'STRATIFIED') {
                    const pulse = 25 + Math.sin(performance.now() / 150) * 10;
                    ctx.shadowColor = 'rgba(0, 209, 255, 0.95)'; // Bright cyan chemistry glow
                    ctx.shadowBlur = pulse;
                }

                ctx.drawImage(tubeImg, -halfW, -halfH, cfg.tubeW, cfg.tubeH);
                
                ctx.shadowBlur = 0; // Reset so it doesn't affect other drawings
            }

            // --- 3. DRAW LIQUID CONTENTS ---
            if (i === 0 && (this.gameState === 'IN_CENTRIFUGE' || this.gameState === 'STRATIFIED')) {
                ctx.save(); 
                
                // Create internal glass clipping mask
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(-halfW + 2, -halfH + 2, cfg.tubeW - 4, cfg.tubeH - 4, [0, 0, cfg.curve, cfg.curve]);
                } else {
                    ctx.rect(-halfW + 2, -halfH + 2, cfg.tubeW - 4, cfg.tubeH - 4);
                }
                ctx.clip(); 

                // Set Murky Color
                let r = 0, g = 188, b = 212; 
                if (this.murkiness > 0) {
                    r = 0 + (90 - 0) * this.murkiness; g = 188 + (100 - 188) * this.murkiness; b = 212 + (80 - 212) * this.murkiness;
                }
                ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, 0.85)`;

                // Draw Wavy Liquid
                const waveOffset = Math.sin(performance.now() / 150) * 2; 
                const liqTop = -halfH + cfg.liquidTopPadding;
                
                ctx.beginPath();
                ctx.moveTo(-halfW - 10, liqTop + waveOffset);
                ctx.lineTo(halfW + 10, liqTop - waveOffset);
                ctx.lineTo(halfW + 10, halfH + 10);
                ctx.lineTo(-halfW - 10, halfH + 10);
                ctx.closePath();
                ctx.fill();

                // Surface Highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.fillRect(-halfW, liqTop + waveOffset, cfg.tubeW, 2);

                ctx.restore(); 
            }

            ctx.restore(); 
        }

        // High-speed horizontal streaks (Drawn globally over the machine)
        if (this.centrifugeRPM > 0 && this.gameState === 'IN_CENTRIFUGE') {
            ctx.fillStyle = `rgba(255, 255, 255, 0.4)`;
            for(let s=0; s<6; s++) {
                ctx.fillRect(rotorCX - cfg.spinWidth - 10 + Math.random()*(cfg.spinWidth*2 + 20), rotorCY - 20 + Math.random()*40, 40 + Math.random()*80, 2);
            }
        }

        // --- POLISH: Localized Sieve Shaking Animation ---
        let sieveVisualPos = { 
            x: this.pos.sieve.x, 
            y: this.pos.sieve.y, 
            w: this.pos.sieve.w, 
            h: this.pos.sieve.h 
        };
        
        if (this.gameState === 'FILTERING') {
            // Rapid horizontal jitter and slight vertical rattle
            sieveVisualPos.x += Math.sin(performance.now() / 20) * 4;
            sieveVisualPos.y += Math.cos(performance.now() / 15) * 1.5;
        }

        this.drawSprite(ctx, 'g13_pan_sieve', sieveVisualPos);

        // 3. Draw Procedural Liquid (With Murkiness & Curved Bottom Clipping)
        if (this.liquidVolume > 0) {
            let r = 0, g = 188, b = 212; // Bright Cyan Default
            
            // Blend to Murky Brown-Green during suspension
            if (this.murkiness > 0) {
                r = 0 + (90 - 0) * this.murkiness;
                g = 188 + (100 - 188) * this.murkiness;
                b = 212 + (80 - 212) * this.murkiness;
            }
            ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, 0.85)`;
            
            // ONLY draw the Beaker liquid here. 
            // The Centrifuge liquid is already drawn perfectly in the Z-Sorted loop above!
            if (this.gameState === 'SUSPENSION' || this.gameState === 'IRON_REMOVED') {
                ctx.save(); // Save before clipping
                
                // CREATE BEAKER CLIPPING MASK (Straight sides, curved bottom)
                ctx.beginPath();
                ctx.moveTo(this.pos.beaker.x - 55, this.pos.beaker.y - 50); // Top Left
                ctx.lineTo(this.pos.beaker.x + 58, this.pos.beaker.y - 50); // Top Right
                ctx.lineTo(this.pos.beaker.x + 58, this.pos.beaker.y + 80); // Down to start of curve
                // Draw the curved bottom
                ctx.quadraticCurveTo(this.pos.beaker.x, this.pos.beaker.y + 100, this.pos.beaker.x - 55, this.pos.beaker.y + 80);
                ctx.closePath();
                ctx.clip(); // Restrict all drawing to this shape!

                // Smooth wave animation inside the beaker
                const lh = 100 * this.liquidVolume;
                const waveOffset = Math.sin(performance.now() / 150) * 4 * this.liquidVolume;
                
                // Draw liquid slightly wider and taller than bounds so the clip shapes it
                const liqX = this.pos.beaker.x - 60; 
                const liqY = this.pos.beaker.y + 80 - lh;
                const liqW = 120;

                ctx.beginPath();
                ctx.moveTo(liqX, liqY + waveOffset);
                ctx.lineTo(liqX + liqW, liqY - waveOffset);
                ctx.lineTo(liqX + liqW, this.pos.beaker.y + 100); // Draw well past the bottom
                ctx.lineTo(liqX, this.pos.beaker.y + 100);
                ctx.closePath();
                ctx.fill();

                // Surface Highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.fillRect(liqX, liqY + waveOffset, liqW, 3);
                
                ctx.restore(); // Remove clip
            } 
            // NOTE: The 'else if (IN_CENTRIFUGE)' block that was here has been completely removed!
        }

        // 4. Evaporation Pan: Boiling Liquid & Steam
        if (this.gameState === 'EVAPORATING' || this.gameState === 'EVAPORATED' || this.gameState === 'FILTERING' || this.gameState === 'SEPARATED') {
            
            const panBaseY = this.pos.sieve.y - 20; // Pool sits on the mesh
            
            // --- DRAW BOILING SOLUTION ---
            if (this.gameState === 'EVAPORATING' && this.panLiquid > 0) {
                ctx.save();
                ctx.fillStyle = `rgba(0, 188, 212, ${0.4 + this.panLiquid * 0.5})`; 
                
                const liqWidth = 100;
                const liqHeight = 20 * this.panLiquid; 
                
                ctx.beginPath();
                ctx.ellipse(this.pos.sieve.x, panBaseY - liqHeight/2, liqWidth/2, liqHeight/2, 0, 0, Math.PI*2);
                ctx.fill();
                
                // Bubbles
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                for(let b=0; b<8; b++) {
                    const bx = this.pos.sieve.x - 40 + (b * 10) + (Math.sin(performance.now()/100 + b)*4);
                    const by = (panBaseY - liqHeight/2) + (Math.cos(performance.now()/80 + b) * liqHeight/2);
                    if(Math.random() > 0.3) {
                        ctx.beginPath(); ctx.arc(bx, by, 1 + Math.random()*2, 0, Math.PI*2); ctx.fill();
                    }
                }
                ctx.restore();
            }

            // --- POLISHED STEAM EFFECT ---
            if (this.gameState === 'EVAPORATING' || (this.gameState === 'SEPARATED' && this.goldRevealAnim < 2)) {
                let steamIntensity = 0;
                if (this.gameState === 'EVAPORATING') steamIntensity = (1 - this.panLiquid) + 0.2;
                else if (this.gameState === 'SEPARATED') steamIntensity = (2 - this.goldRevealAnim) * 0.5;

                if (steamIntensity > 0) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, steamIntensity * 0.6)})`;
                    for (let s=0; s<4; s++) {
                        ctx.beginPath();
                        const steamY = this.pos.sieve.y - 10 - ((performance.now()/20 + s*40) % 70);
                        const steamX = this.pos.sieve.x + Math.sin(steamY/10) * 15;
                        ctx.arc(steamX, steamY, 10 + (this.pos.sieve.y - steamY)/3, 0, Math.PI*2);
                        ctx.fill();
                    }
                }
            }
        }

        // 5. Draw Particles (With Underwater Blur)
        this.particles.forEach(p => {
            let goldAsset = 'g13_gold_muddy';
            let isCleanGold = false;

            if (p.type === 'gold' && (this.gameState === 'SEPARATED' || this.gameState === 'QUIZ' || this.gameState === 'FILTERING')) {
                goldAsset = 'g13_plate_gold'; 
                isCleanGold = true;
            }

            // --- TWEAK: Scale down particles so they fit in the narrow test tube ---
            let drawSize = p.size;
            if (p.container === 'centrifuge') {
                if (p.type === 'gold') {
                    // Force the gold plate to be 80% of the tube's width so it never overflows
                    drawSize = this.centrifugeAnim.tubeW * 0.8; 
                } else {
                    // Shrink sand down as well so it fits the scale
                    drawSize = p.size * 0.4; 
                }
            }

            // Handle scaling for crystals growing during evaporation
            if (p.scale !== undefined) {
                drawSize *= p.scale;
                if (drawSize <= 0.1) return; // Skip drawing if too small to see yet
            }

            const imgId = p.type === 'gold' ? goldAsset : `g13_atom_${p.type}`;
            const img = this.assetManager.get(imgId);
            
            ctx.save();
            
            // --- Murky Water Blur Effect ---
            const isSubmergedInBeaker = (this.gameState === 'SUSPENSION' && p.container === 'beaker');
            const isSubmergedInCentrifuge = (p.container === 'centrifuge' && (this.gameState === 'IN_CENTRIFUGE' || this.gameState === 'STRATIFIED'));

            if ((isSubmergedInBeaker || isSubmergedInCentrifuge) && (p.type === 'sand' || p.type === 'gold')) {
                if (isSubmergedInBeaker) {
                    // Heavy blur for the thick mixture in the wide beaker
                    ctx.filter = `blur(${1 + this.murkiness * 1.5}px)`;
                    ctx.globalAlpha = 1 - (this.murkiness * 0.2); 
                } else {
                    // Lighter blur for the narrow test tube so the physical shaking remains visible!
                    ctx.filter = `blur(${0.5 + this.murkiness * 0.5}px)`;
                    ctx.globalAlpha = 1 - (this.murkiness * 0.05); 
                }
            }

            if (img) {
                // Add shiny pulsing glow to the final revealed gold
                if (isCleanGold) {
                    // --- POLISH: Gold Reveal Flash & Scale ---
                    if (this.goldRevealAnim !== undefined && this.goldRevealAnim < 1.5) {
                        // Quick scale bounce
                        const bounce = Math.sin(this.goldRevealAnim * Math.PI) * 0.3;
                        drawSize *= (1 + bounce);
                        
                        // Bright flash effect
                        ctx.shadowColor = '#FFFFFF';
                        ctx.shadowBlur = 40 * (1.5 - this.goldRevealAnim); 
                    } else {
                        // Standard idle pulse
                        const pulse = 15 + Math.sin(performance.now() / 200) * 10;
                        ctx.shadowColor = '#FFD700'; 
                        ctx.shadowBlur = pulse;
                    }
                }
                // USE drawSize instead of p.size!
                ctx.drawImage(img, p.x - drawSize/2, p.y - drawSize/2, drawSize, drawSize);
            } else {
                ctx.fillStyle = p.type === 'gold' ? '#FFD700' : p.type === 'iron' ? '#212121' : p.type === 'sand' ? '#8D6E63' : '#00BCD4';
                ctx.beginPath(); ctx.arc(p.x, p.y, drawSize/2, 0, Math.PI*2); ctx.fill();
            }
            
            ctx.restore();
        });

        // 6. Draw Interactive Magnet Tracking Cursor
        if (this.activeTool === 'magnet') {
            const magImg = this.assetManager.get('g13_tool_magnet');
            if (magImg) {
                ctx.shadowColor = 'rgba(0, 229, 255, 0.5)'; ctx.shadowBlur = 20; // Magnetic glow
                ctx.drawImage(magImg, this.input.x - 64, this.input.y - 64, 128, 128);
                ctx.shadowBlur = 0;
            }
        }

        // --- The 30-Second Scrubbing Overlay ---
        if (this.gameState === 'CLEANUP') {
            this.drawHaddockScrub(ctx);
        }

        if (this.dialogueShowing) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);
        }

        ctx.restore();
    }

    drawSprite(ctx, id, pos) {
        const img = this.assetManager.get(id);
        if (img) ctx.drawImage(img, pos.x - pos.w/2, pos.y - pos.h/2, pos.w, pos.h);
        else {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.strokeRect(pos.x - pos.w/2, pos.y - pos.h/2, pos.w, pos.h);
        }
    }

    drawHaddockScrub(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; // Soapy haze
        ctx.fillRect(0, 0, this.SAFE_WIDTH, this.SAFE_HEIGHT);

        const scrubImg = this.assetManager.get('g13_haddock_scrub');
        if (scrubImg) {
            const time = performance.now();
            
            // --- POLISH: Smoother, slower sweeping motion ---
            // Dividing by larger numbers (800 and 600) slows down the sine/cosine waves significantly
            const scrubX = (this.SAFE_WIDTH / 2) + Math.sin(time / 800) * 200; 
            const scrubY = (this.SAFE_HEIGHT / 2) - 100 + Math.cos(time / 600) * 60; 

            // --- SPRITE SHEET ANIMATION (2x2 Grid, 1876x1024) ---
            const frameW = 938;  
            const frameH = 512;  
            
            // Scrubbing speed (Reduced from 12 down to 6 for a more deliberate, less jerky look)
            const fps = 2; 
            const frameIndex = Math.floor(time / (1000 / fps)) % 4;

            const sx = (frameIndex % 2) * frameW;
            const sy = Math.floor(frameIndex / 2) * frameH;

            const destW = 400;
            const destH = destW * (frameH / frameW); 

            ctx.drawImage(
                scrubImg, 
                sx, sy, frameW, frameH,                                      
                scrubX - (destW / 2), scrubY - (destH / 2), destW, destH     
            );
        }

        // Draw the countdown timer so they know they are being punished
        ctx.fillStyle = '#D32F2F';
        ctx.font = 'bold 48px "Comic Sans MS", cursive';
        ctx.textAlign = 'center';
        ctx.fillText(`CLEANUP CREW: ${Math.ceil(this.cleanupTimer)}s`, this.SAFE_WIDTH / 2, 80);
        ctx.textAlign = 'left';
    }

    resize() {
        super.resize();
        if (this.state === undefined) return;
        if (!this.isRunning) this.renderFrame();
    }

    destroy() {
        if (this.styleElement) this.styleElement.remove();
        if (this.quizUI) this.quizUI.remove();
        super.destroy();
    }
}
