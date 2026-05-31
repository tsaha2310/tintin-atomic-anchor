import { ComicReader } from './core/ComicReader.js';
import { AssetManager } from './core/AssetManager.js';
import { StateManager } from './core/StateManager.js';
import { NotebookOverlay } from './components/NotebookOverlay.js';

import { CollectorSieve } from './games/CollectorSieve.js'; 
import { JuniorReporterQuiz } from './games/JuniorReporterQuiz.js'; 
import { PackingPuzzle } from './games/PackingPuzzle.js';
import { ThompsonHoleInvestigation } from './games/ThompsonHoleInvestigation.js';
import { CastafioreSoupQuiz } from './games/CastafioreSoupQuiz.js';
import { ThermalEquilibrium } from './games/ThermalEquilibrium.js';
import { GhostlyInquiry } from './games/GhostlyInquiry.js';
import { CondensationCatch } from './games/CondensationCatch.js';
import { CaptainsFinalExam } from './games/CaptainsFinalExam.js';
import { AtomicKeyhole } from './games/AtomicKeyhole.js';
import { AtomicRoundup } from './games/AtomicRoundup.js';
import { SaladSoupCuriosityQuiz } from './games/SaladSoupCuriosityQuiz.js';
import { TheGreatSortOut } from './games/TheGreatSortOut.js';
import { TheHaddockHeave } from './games/TheHaddockHeave.js';
import { TheLeydenJarConundrum } from './games/TheLeydenJarConundrum.js';
import { SnowyRunner } from './games/SnowyRunner.js';

// DEBUG: Set to 'sorting_junk' to test Game 1, or null for normal mode.
const DEBUG_GAME_ID = null;

class App {
    constructor() {
        this.config = {
            comicSource: null,
            gameManifest: null,
            levelTuning: null
        };
        this.runtimeManifest = null;
        this.reader = null;
        this.activeGame = null; 
        
        // State Tracking for the Sequence System
        this.activeTriggerConfig = null; 
        this.activeModuleId = null;
        this.activeLevelId = null;
        this.isNotebookLaunch = false;

        this.assets = new AssetManager();
        this.stateManager = new StateManager();
        
        this.ui = {
            startScreen: document.getElementById('start-screen'),
            loading: document.querySelector('.loading-indicator'),
            btnStart: document.getElementById('btn-start-adventure'),
            host: document.getElementById('comic-host'),
            guest: document.getElementById('game-guest'),
            btnSkip: document.getElementById('btn-skip-puzzle')
        };

        this.init();
    }

    init() {
        this.ui.btnStart.addEventListener('click', () => this.startSession());
        
        // Emergency Skip: Fails the current game but lets the sequence continue
        this.ui.btnSkip.addEventListener('click', () => {
             if(this.activeGame) this.endGame({ success: false }); 
        });

        // Inject Notebook Button into the main HUD container (usually body or #game-guest)
        this.injectNotebook();

        this.preloadCoverArt();

        // Check if a save file exists (using your StateManager's key)
        const saveFile = localStorage.getItem('tintin_adventure_save_v1');
        const startBtn = document.getElementById('btn-start-adventure');
        
        if (saveFile && startBtn) {
            const parsedSave = JSON.parse(saveFile);
            // If they are past the first page, change the text!
            if (parsedSave.pageIndex > 0 || parsedSave.panelIndex > 0) {
                startBtn.innerText = "RESUME INVESTIGATION ➔";
                startBtn.style.backgroundColor = "#FBC02D"; // Make it Tintin Yellow for returning players
                startBtn.style.color = "#000";
            }
        }
    }

    injectNotebook() {
        // 1. Inject Responsive CSS instead of inline styles
        if (!document.getElementById('notebook-btn-css')) {
            const style = document.createElement('style');
            style.id = 'notebook-btn-css';
            style.innerHTML = `
                #btn-open-notebook {
                    position: fixed; top: 15px; right: 15px;
                    background: #FBC02D; border: 3px solid #1A1A1A; border-radius: 8px;
                    padding: 10px 16px; font-weight: bold; font-family: sans-serif; font-size: 14px;
                    cursor: pointer; z-index: 8000; box-shadow: 3px 5px 0 rgba(0,0,0,0.2);
                    display: none; align-items: center; color: #1A1A1A;
                    transition: all 0.2s ease;
                }
                #btn-open-notebook:hover { background: #FDD835; transform: translateY(-2px); box-shadow: 3px 7px 0 rgba(0,0,0,0.3); }
                #btn-open-notebook:active { transform: translateY(2px); box-shadow: 1px 2px 0 rgba(0,0,0,0.3); }
                
                /* Mobile Portrait Tweak */
                @media (max-width: 768px) and (orientation: portrait) {
                    #btn-open-notebook { top: 10px; right: 10px; padding: 8px 12px; font-size: 12px; border-width: 2px; }
                }

                /* Mobile Landscape Fix: Icon-only and semi-transparent */
                @media (max-height: 500px) and (orientation: landscape) {
                    #btn-open-notebook { 
                        top: 5px; right: 5px; 
                        padding: 8px; /* Make it a small square */
                        border-width: 2px;
                        box-shadow: 2px 3px 0 rgba(0,0,0,0.2);
                        opacity: 0.65; /* See-through to read text underneath */
                    }
                    #btn-open-notebook:hover, #btn-open-notebook:active { opacity: 1; }
                    #btn-open-notebook .btn-text { display: none; } /* Hide the text */
                    #btn-open-notebook svg { margin-right: 0 !important; width: 18px; height: 18px; } /* Center the icon */
                }
            `;
            document.head.appendChild(style);
        }

        // 2. Create the HTML Button
        const notebookBtn = document.createElement('button');
        notebookBtn.id = 'btn-open-notebook';

        // Wrap the text in a span so we can hide it independently in CSS
        notebookBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <span class="btn-text">FIELD NOTES</span>
        `;
        document.body.appendChild(notebookBtn);
        this.ui.btnNotebook = notebookBtn;

        // 3. Bind the Click Event
        this.ui.btnNotebook.addEventListener('click', () => {
            if (!this.notebook) {
                if (!this.config || !this.config.gameManifest) {
                    console.warn("Manifest not loaded yet!");
                    return; 
                }
                this.notebook = new NotebookOverlay(
                    document.body, 
                    this.stateManager, 
                    this.config.levelTuning, 
                    this.config.gameManifest,
                    (modId, lvlId) => this.forceLaunchGame(modId, lvlId)
                );
            }
            this.notebook.show();
        });
    }

    hideNotebookButton() {
        if (this.ui.btnNotebook) this.ui.btnNotebook.style.display = 'none';
    }

    showNotebookButton() {
        if (this.ui.btnNotebook) this.ui.btnNotebook.style.display = 'flex';           
    }

    preloadCoverArt() {
        const coverEl = document.querySelector('.cover-art-container');
        const initialLoader = document.getElementById('initial-cover-loader');
        const coverLayout = document.querySelector('.cover-layout');
        
        if (!coverEl || !coverLayout) return;

        // Dynamically grab whatever URL you put in CSS
        let bgUrl = window.getComputedStyle(coverEl).backgroundImage;
        bgUrl = bgUrl.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');

        if (bgUrl && bgUrl !== 'none') {
            const img = new Image();
            img.src = bgUrl;
            // Once loaded (or if it fails), slam the book down!
            img.onload = img.onerror = () => this.revealCover(initialLoader, coverLayout);
        } else {
            this.revealCover(initialLoader, coverLayout); // Fallback
        }
    }

    revealCover(loader, coverLayout) {
        if (loader) loader.classList.add('hidden');
        coverLayout.classList.remove('pre-load-hidden');
        coverLayout.classList.add('anim-entrance');
    }

    forceLaunchGame(moduleId, levelId) {
        console.log(`📓 Notebook Launch: ${moduleId} / ${levelId}`);
        
        // Flag this so endGame knows not to continue a sequence!
        this.isNotebookLaunch = true; 
        
        // Resolve Tuning Data
        const specificTuning = (this.config.levelTuning[moduleId] && this.config.levelTuning[moduleId][levelId]) || {};
        const commonTuning = this.config.levelTuning.common || {};
        
        this.launchGameModule(moduleId, levelId, specificTuning, commonTuning);
    }

    async startSession() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();

        this.ui.btnStart.classList.add('hidden');
        this.ui.loading.classList.remove('hidden');

        try {
            await Promise.all([
                this.loadConfiguration(),
                this.assets.loadManifest()
            ]);

            if (this.assets.manifest && this.assets.manifest.common) {
                await this.assets.loadBatch(Object.keys(this.assets.manifest.common));
            }

            this.buildRuntimeManifest();

            // Reveal the Notebook button now that the data is fully loaded
            if (this.ui.btnNotebook) {
                this.ui.btnNotebook.style.display = 'flex';
            }

            // --- DEBUG MODE ---
            if (DEBUG_GAME_ID) {
                console.log(`🛠️ DEBUG LAUNCH: ${DEBUG_GAME_ID}`);
                const gameDef = this.config.gameManifest.find(g => g.game_module_id === DEBUG_GAME_ID);
                
                // Mock a "Sequence" of 1 item for debug
                const mockPanelData = {
                    gameConfig: {
                        sequence: [{ 
                            moduleId: gameDef.game_module_id, 
                            levelId: gameDef.level_id 
                        }],
                        tuning: this.config.levelTuning
                    }
                };
                this.handleGameTrigger(mockPanelData);
                return; 
            }

            // --- NORMAL LAUNCH (Resume Logic) ---
            const urlParams = new URLSearchParams(window.location.search);
            const deepLinkPage = urlParams.get('page');
            const pageIdParam = urlParams.get('pageId');
            
            let startPage = 0;
            let startPanel = 0;

            if (pageIdParam || deepLinkPage) {
                let foundIndex = -1;
                if (pageIdParam) foundIndex = this.runtimeManifest.pages.findIndex(p => p.id === pageIdParam);
                if (deepLinkPage) {
                    startPage = foundIndex !== -1 ? foundIndex : (parseInt(deepLinkPage) || 0);
                } else {
                    startPage = foundIndex !== -1 ? foundIndex : 0;
                }
            } else {
                const save = this.stateManager.currentState;
                startPage = save.pageIndex || 0;
                startPanel = save.panelIndex || 0;
            }

            this.stateManager.initHistory((page, panel) => {
                if (this.reader) this.reader.forceView(page, panel);
            });

            // === 1. PRELOAD COMIC IMAGE TO CACHE ===
            // Look up the first page to find its image URL
            const pageData = this.runtimeManifest.pages[startPage];
            
            // Check common property names used for comic images
            const imgSrc = pageData ? (pageData.image || pageData.src || pageData.bgImage || pageData.url) : null;
            
            if (imgSrc) {
                // Pause JS execution until the network finishes downloading the image
                await new Promise(resolve => {
                    const img = new Image();
                    img.onload = img.onerror = resolve; // Continue even on error so it doesn't hang
                    img.src = imgSrc;
                });
            } else {
                // Fallback buffer if the image property name is non-standard
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // === 2. LAUNCH COMIC IN THE BACKGROUND ===
            // Pass 'true' so we don't hide the Start Screen yet!
            this.launchComic(startPage, startPanel, true);

            // Give the browser 1 frame to inject the comic DOM behind the cover
            await new Promise(resolve => requestAnimationFrame(resolve));

            // === 3. ANIMATE BOOK OPENING ===
            const coverLayout = document.querySelector('.cover-layout');
            const isLandscape = window.innerHeight <= 500 && window.innerWidth > window.innerHeight;
            
            // Hide the loading spinner right before the animation starts
            this.ui.loading.classList.add('hidden');

            if (coverLayout) {
                coverLayout.classList.remove('anim-entrance'); 
                coverLayout.classList.add('anim-open-book');
                
                // Wait for the CSS 3D flip animation to finish
                await new Promise(resolve => setTimeout(resolve, isLandscape ? 500 : 850));
            }

            // === 4. CLEANUP ===
            // Now that the cover has swung open, we can safely hide the start screen completely
            this.ui.startScreen.classList.add('hidden');


        } catch (error) {
            console.error("CRITICAL ERROR:", error);
            alert("Game failed to start. Check console.");
        }
    }

    async loadConfiguration() {
        const t = Date.now(); 
        const [source, manifest, levels] = await Promise.all([
            fetch(`data/comic_source.json?t=${t}`).then(r => r.json()),
            fetch(`data/game_manifest.json?t=${t}`).then(r => r.json()),
            fetch(`data/levels.json?t=${t}`).then(r => r.json())
        ]);
        this.config.comicSource = source;
        this.config.gameManifest = manifest;
        this.config.levelTuning = levels;
    }

    // ============================================================
    // ⚙️ MANIFEST BUILDER (Crucial for Sequence Support)
    // ============================================================
    buildRuntimeManifest() {
        const rawPages = Array.isArray(this.config.comicSource) ? this.config.comicSource : this.config.comicSource.pages;
        this.runtimeManifest = { title: "Tintin Vol 1", pages: JSON.parse(JSON.stringify(rawPages)) };

        const gameMap = new Map();
        if (this.config.gameManifest) {
            this.config.gameManifest.forEach(entry => gameMap.set(entry.trigger_panel_id, entry));
        }

        this.runtimeManifest.pages.forEach((page, pageIndex) => {
            if (!page.panels && page.frames) page.panels = page.frames;

            page.panels.forEach((panel, index) => {
                if (panel.w !== undefined) panel.width = panel.w;
                if (panel.h !== undefined) panel.height = panel.h;
                if (!panel.id) panel.id = `${page.id}_${index}`;
                panel.units = 'percent'; 

                // INJECT GAME LOGIC
                if (gameMap.has(panel.id)) {
                    const gameDef = gameMap.get(panel.id);

                    // --- Stamp BOTH page and panel index onto the game definition ---
                    gameDef.pageIndex = pageIndex;
                    gameDef.panelIndex = index;
                    
                    // --- NORMALIZATION STEP ---
                    // Convert old "single game" format to new "Sequence Array" format
                    let sequence = [];
                    if (gameDef.sequence) {
                        sequence = gameDef.sequence;
                    } else {
                        // Legacy Fallback
                        sequence = [{ 
                            moduleId: gameDef.game_module_id, 
                            levelId: gameDef.level_id 
                        }];
                    }

                    panel.gameConfig = {
                        // FIX: Key must be 'type' to match ComicReader.js expectation
                        type: gameDef.trigger_type || 'immediate', 
                        sequence: sequence, 
                        tuning: this.config.levelTuning 
                    };
                    console.log(`🔗 Panel [${panel.id}] linked to sequence:`, sequence);
                }
            });
        });
    }

    launchComic(startPage, startPanel, keepStartScreenVisible = false) {
        
        if (!keepStartScreenVisible) {
            this.ui.startScreen.classList.add('hidden');
        }
        
        this.ui.host.classList.remove('hidden');

        // Prevent re-instantiating the reader if we are just returning to it from a mini-game
        if (!this.reader) {
            this.reader = new ComicReader({
                containerId: 'comic-viewport',
                manifest: this.runtimeManifest,
                onGameTrigger: (panelData) => this.handleGameTrigger(panelData),
                onPanelChange: (panelIdx) => {
                    const pageIdx = this.reader.currentPageIndex;
                    this.stateManager.saveProgress(pageIdx, panelIdx);
                    this.stateManager.pushState(pageIdx, panelIdx);
                }
            });
        }

        this.reader.loadPage(startPage, startPanel);
    }


    // ============================================================
    // 🎮 SEQUENCE ORCHESTRATOR
    // ============================================================
    handleGameTrigger(panelData) {
        // 1. Persist the config so we can loop back to it after a game ends
        this.activeTriggerConfig = panelData.gameConfig;
        
        const { sequence, tuning } = this.activeTriggerConfig;

        // 2. Find the FIRST uncompleted task in the list
        const nextTask = sequence.find(task => 
            !this.stateManager.isGameComplete(task.moduleId, task.levelId)
        );

        if (nextTask) {
            console.log(`🎯 Sequence Trigger: Launching [${nextTask.moduleId}]`);
            
            // Resolve Tuning Data immediately
            const specificTuning = (tuning[nextTask.moduleId] && tuning[nextTask.moduleId][nextTask.levelId]) || {};
            // Grab the common/shared tuning block as well
            const commonTuning = tuning.common || {};
            
            this.launchGameModule(nextTask.moduleId, nextTask.levelId, specificTuning, commonTuning);
        } else {
            // 3. No tasks left? Sequence is done.
            console.log(`✅ Sequence Complete. Restoring Comic View.`);
            
            // --- FIX START: Restore UI Visibility ---
            this.ui.guest.classList.add('hidden'); // Hide Game Canvas
            this.ui.host.classList.remove('hidden'); // Show Comic Reader
            this.ui.btnSkip.classList.add('hidden');
            this.ui.loading.classList.add('hidden'); 
            // --- FIX END ---

            this.reader.unlock();
        }
    }

    launchGameModule(moduleId, levelId, tuningData, commonTuning = {}) {
        console.log(`⚡ Init Module: ${moduleId} / ${levelId}`);
        
        // Track ID for saving later
        this.activeModuleId = moduleId;
        this.activeLevelId = levelId;

        this.ui.host.classList.add('hidden');
        this.ui.guest.classList.remove('hidden');
        this.ui.btnSkip.classList.remove('hidden');
        this.ui.loading.classList.remove('hidden'); 
        this.hideNotebookButton();

        const gameInitConfig = {
            canvas: document.getElementById('game-canvas'),
            uiRoot: document.getElementById('game-ui-layer'),
            tuning: tuningData, // <--- Passed directly
            commonTuning: commonTuning,
            assets: this.assets,
            onComplete: (result) => this.endGame(result),
            onReady: () => {
                this.ui.loading.classList.add('hidden');
            }
        };

        try {
            switch(moduleId) {
                case 'sorting_junk':
                    this.activeGame = new CollectorSieve(gameInitConfig);
                    break;
                case 'junior_reporter_quiz': 
                    this.activeGame = new JuniorReporterQuiz(gameInitConfig);
                    break;
                case 'packing_puzzle':
                    this.activeGame = new PackingPuzzle(gameInitConfig);
                    break;
                case 'thompson_hole_investigation':
                    this.activeGame = new ThompsonHoleInvestigation(gameInitConfig);
                    break;
                case 'castafiore_soup_quiz':
                    this.activeGame = new CastafioreSoupQuiz(gameInitConfig);
                    break;
                case 'thermal_equilibrium':
                    this.activeGame = new ThermalEquilibrium(gameInitConfig);
                    break;
                case 'ghostly_inquiry':
                    this.activeGame = new GhostlyInquiry(gameInitConfig);
                    break;
                case 'condensation_catch':
                    this.activeGame = new CondensationCatch(gameInitConfig);
                    break;
                case 'captains_final_exam':
                    this.activeGame = new CaptainsFinalExam(gameInitConfig);
                    break;
                case 'atomic_keyhole':
                    this.activeGame = new AtomicKeyhole(gameInitConfig);
                    break;
                case 'atomic_roundup':
                    this.activeGame = new AtomicRoundup(gameInitConfig);
                    break;
                case 'salad_soup_curiosity':
                    this.activeGame = new SaladSoupCuriosityQuiz(gameInitConfig);
                    break;
                case 'the_great_sort_out':
                    this.activeGame = new TheGreatSortOut(gameInitConfig);
                    break;
                case 'the_haddock_heave':
                    this.activeGame = new TheHaddockHeave(gameInitConfig);
                    break;
                case 'snowy_runner':
                    this.activeGame = new SnowyRunner(gameInitConfig);
                    break;
                case 'the_leyden_jar_conundrum':
                    this.activeGame = new TheLeydenJarConundrum(gameInitConfig);
                    break;
                default:
                    console.error("Unknown Module:", moduleId);
                    this.endGame({ success: true }); // Skip broken game
                    return;
            }
        } catch(e) {
            console.error("Game Init Crash:", e);
            this.endGame({ success: false }); // Fail gracefully
        }
    }

    endGame(result) {
        console.log("🏁 Game Ended. Success:", result.success);

        // 1. Cleanup
        if (this.activeGame) {
            this.activeGame.destroy();
            this.activeGame = null;
        }

        // 2. Save ONLY if the player actually won
        if (result.success && this.activeModuleId && this.activeLevelId) {
            this.stateManager.markGameComplete(this.activeModuleId, this.activeLevelId);
        }

        // 3. ROUTING LOGIC
        if (this.isNotebookLaunch) {
            // Drop them back into the notebook menu
            console.log("📓 Returning to Notebook...");
            this.isNotebookLaunch = false; 
            
            this.ui.guest.classList.add('hidden'); 
            this.ui.btnSkip.classList.add('hidden');
            this.ui.loading.classList.add('hidden'); 
            // Restore the comic reader (in background) BEFORE showing the notebook 
            this.ui.host.classList.remove('hidden');
 
            this.showNotebookButton();
            if (this.notebook) this.notebook.show();
            
        } else if (result.success && this.activeTriggerConfig) {
            // Trigger the next game in the sequence
            this.handleGameTrigger({ gameConfig: this.activeTriggerConfig });
            
        } else {
            // Sequence aborted (Skipped). Return to comic.
            console.log("⏭️ Sequence aborted. Returning to comic.");
            this.activeTriggerConfig = null; 

            this.ui.guest.classList.add('hidden'); 
            this.ui.host.classList.remove('hidden'); 
            this.ui.btnSkip.classList.add('hidden');
            this.ui.loading.classList.add('hidden'); 
            this.showNotebookButton();

            this.reader.unlock();
        }
    }

}

document.addEventListener('DOMContentLoaded', () => { window.gameApp = new App(); });
