/* =========================================
   js/games/TheLeydenJarConundrum.js
   Game 15: "The Leyden Jar Conundrum"
   Fully implemented with 4-Pillar FSM Architecture, Canvas Raycasting, & DOM UI logic
   ========================================= */

import { PacAdventureGame } from '../middleware/PacAdventureGame.js';
import { SkeletonRig } from '../core/SkeletonRig.js';
import { AnimationController } from '../core/AnimationController.js';
import { StateMachine } from '../core/StateMachine.js';
import { PolygonNavSystem } from '../components/PolygonNavSystem.js';
import { QuizOverlay } from '../components/QuizOverlay.js';

const bridgeStartX = 2450;
const bridgeEndX = 3000; 

const bridgeStartY = 500; 
const bridgeEndY = 400;

const showDebug = false; // Toggle to false when done

const infographicHTML = `
<div class="calc-wizard" style="font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif; width: 100%; height: 100%; user-select: none;">
    <style>
        /* ===== CORE WIZARD SHELL ===== */
        .calc-wizard { 
            --brown: #4a2511; --tan: #f4e8d1; --gold: #e6a15c; --red: #e74c3c; --blue: #3498db; 
            display: grid;
            grid-template-rows: auto 1fr auto; /* Header sizes to content, Body fills space, Footer sizes to content */
            overflow: hidden; /* Locks the outer bounds */
        }
        
        .wiz-header { 
            background: linear-gradient(135deg, #4a2511 0%, #7d3f1d 100%);
            color: #fff; padding: 12px 15px; border-radius: 8px 8px 0 0;
            text-align: center; border-bottom: 4px solid var(--brown);
            position: relative; overflow: hidden; 
        }
        .wiz-header::after {
            content: '⚡'; position: absolute; right: 15px; top: 5px;
            font-size: 2.5rem; opacity: 0.15; animation: bob 2s ease-in-out infinite;
        }
        
        .wiz-header h2 { margin: 0; font-size: 1.4rem; letter-spacing: 1px; text-shadow: 2px 2px 0 rgba(0,0,0,0.4); font-family: 'Courier New', Courier, monospace; font-weight: 900; }
        .wiz-header .sub { font-size: 0.85rem; opacity: 0.9; margin-top: 4px; font-style: italic; }
        
        .wiz-body { 
            background-color: var(--tan); 
            background-image: radial-gradient(var(--gold) 1.5px, transparent 1.5px);
            background-size: 18px 18px;
            padding: 15px; 
            overflow-y: scroll !important; /* Forces the native scrollbar */
            -webkit-overflow-scrolling: touch; /* Ensures smooth scrolling on iOS */
            pointer-events: auto; /* Guarantees interaction */
            border-left: 3px solid #8b4513; border-right: 3px solid #8b4513;
        }        
        .wiz-footer { 
            background: #e0cc9f; padding: 12px 15px; border-radius: 0 0 8px 8px;
            border: 3px solid #8b4513; border-top: 3px dashed #8b4513;
            display: flex; justify-content: space-between; align-items: center; gap: 8px;
            flex-shrink: 0; flex-wrap: nowrap;
        }
        
        /* ===== PAGE SYSTEM ===== */
        .wiz-page { display: none; animation: pageIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .wiz-page.active { display: block; }
        @keyframes pageIn { from { opacity: 0; transform: translateX(30px) scale(0.98); } to { opacity: 1; transform: translateX(0) scale(1); } }
        
        .wiz-page h3 { text-align: center; color: var(--brown); margin: 0 0 12px 0; font-size: 1.3rem; background: rgba(255,255,255,0.7); padding: 5px; border-radius: 8px; border: 2px solid var(--gold); }
        .page-num { text-align: center; color: #8b4513; font-size: 0.8rem; margin-top: 15px; font-weight: bold; opacity: 0.8; font-family: monospace; }
        
        /* ===== BUTTONS & NAV ===== */
        .wiz-btn {
            background: linear-gradient(to bottom, #f39c12, #d35400);
            border: 2px solid var(--brown); color: white;
            padding: 8px 10px; border-radius: 20px;
            font-family: 'Comic Sans MS', sans-serif; font-weight: bold; cursor: pointer; font-size: 0.95rem;
            transition: all 0.15s; box-shadow: 0 4px 0 var(--brown); text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
            flex: 1; min-width: 70px; max-width: 120px; text-align: center;
            white-space: nowrap; box-sizing: border-box;
        }
        .wiz-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 0 var(--brown); filter: brightness(1.1); }
        .wiz-btn:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 2px 0 var(--brown); }
        .wiz-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: 0 2px 0 var(--brown); background: #95a5a6; border-color: #7f8c8d; }
        
        .wiz-dots { display: flex; gap: 8px; align-items: center; justify-content: center; flex: 2; min-width: 80px; }
        .wiz-dot { width: 12px; height: 12px; border-radius: 50%; background: #f1c40f; border: 2px solid var(--brown); cursor: pointer; transition: all 0.3s; position: relative; }
        .wiz-dot:hover { transform: scale(1.3); }
        .wiz-dot.active { background: var(--red); transform: scale(1.4); }
        
        /* ===== PAGE 1: COVER ===== */
        .cover-wrap { text-align: center; }
        .cover-stamp { 
            display: inline-block; background: var(--red); color: white;
            padding: 4px 14px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;
            transform: rotate(-5deg); box-shadow: 2px 2px 0 rgba(0,0,0,0.2); margin-bottom: 8px;
            border: 2px dashed white; font-family: monospace;
        }
        .cover-icon { font-size: 4rem; margin: 5px 0; display: inline-block; animation: bob 3s ease-in-out infinite; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); }
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .cover-title { font-size: 1.6rem; color: var(--brown); margin: 5px 0; font-weight: 900; line-height: 1.2; text-shadow: 1px 1px 0px white; }
        .cover-sub { font-size: 1rem; color: #d35400; margin-bottom: 12px; font-weight: bold; }
        .cover-text { color: var(--brown); line-height: 1.5; font-size: 0.95rem; text-align: left; background: rgba(255,255,255,0.8); padding: 12px; border-radius: 8px; border: 2px solid var(--gold); box-shadow: inset 0 0 10px rgba(0,0,0,0.05); }
        .cover-text strong { color: var(--red); }
 
        /* ===== PAGE 2: THE LADDER ===== */
        .ladder-wrap { position: relative; height: 320px; margin: 15px 0; }
        
        .ladder-axis {
            position: absolute; left: 50%; top: 0; bottom: 0; width: 8px;
            background: linear-gradient(to bottom, var(--red), var(--blue));
            transform: translateX(-50%); border-radius: 4px;
            box-shadow: 0 0 10px rgba(52, 152, 219, 0.4), inset 0 0 4px rgba(0,0,0,0.5);
        }
        .ladder-axis::before, .ladder-axis::after {
            content: attr(data-label); position: absolute; left: 50%; transform: translateX(-50%);
            font-weight: 900; font-size: 0.8rem; white-space: nowrap; font-family: monospace; background: white; padding: 2px 6px; border-radius: 4px; border: 2px solid; z-index: 10;
        }
        .ladder-axis::before { content: 'LOSES e⁻ (+)'; top: -15px; color: var(--red); border-color: var(--red); }
        .ladder-axis::after { content: 'STEALS e⁻ (-)'; bottom: -15px; color: var(--blue); border-color: var(--blue); }
        
        /* ⚡ NEW: The Traveling Electron */
        .axis-electron {
            position: absolute; left: 50%; top: 5%; width: 22px; height: 22px;
            border-radius: 50%; transform: translateX(-50%); z-index: 5;
            display: flex; align-items: center; justify-content: center;
            font-size: 0.65rem; font-weight: 900; font-family: monospace;
            border: 2px solid white; box-shadow: 0 0 15px rgba(255,255,255,0.8);
            animation: electronTravel 4s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }
        @keyframes electronTravel {
            0%, 100% { top: 5%; background: var(--red); box-shadow: 0 0 15px var(--red); color: white; }
            50% { top: 85%; background: var(--blue); box-shadow: 0 0 15px var(--blue); color: white; }
        }

        .ladder-rung { 
            display: flex; align-items: center; position: absolute; left: 0; right: 0;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); cursor: default; height: 28px;
        }
        .ladder-rung:hover { transform: scale(1.08) translateY(-2px); z-index: 12; }
        
        /* ✨ NEW: Glossy Shine Effect */
        .rung-bar { 
            height: 100%; border-radius: 14px; display: flex; align-items: center;
            justify-content: center; color: white; font-weight: bold; font-size: 0.85rem;
            text-shadow: 1px 1px 0 rgba(0,0,0,0.4); 
            box-shadow: 0 4px 6px rgba(0,0,0,0.3), inset 0 2px 2px rgba(255,255,255,0.4);
            border: 1px solid rgba(255,255,255,0.5);
            position: relative; overflow: hidden;
        }
        .rung-bar::after {
            content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
            animation: shine 3.5s infinite;
        }
        .ladder-rung:nth-child(even) .rung-bar::after { animation-delay: 1.75s; }
        @keyframes shine { 0% { left: -100%; } 20%, 100% { left: 200%; } }
        
        .rung-pos { background: linear-gradient(90deg, #ff7675, var(--red)); }
        .rung-neu { background: linear-gradient(90deg, #f1c40f, #e67e22); width: 50% !important; margin: 0 auto; }
        .rung-neg { background: linear-gradient(90deg, #3498db, #2980b9); margin-left: auto; }
        
        /* 😃 NEW: Emoji Bobble */
        .rung-emoji { font-size: 1.2rem; margin-right: 6px; display: inline-block; animation: subtleBob 2s infinite ease-in-out; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); }
        .ladder-rung:nth-child(odd) .rung-emoji { animation-delay: 1s; }
        @keyframes subtleBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px) scale(1.15); } }

        .rung-tag { position: absolute; font-size: 0.7rem; font-weight: 900; opacity: 0.9; background: rgba(255,255,255,0.9); padding: 3px 6px; border-radius: 6px; border: 2px dashed; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .tag-left { left: 2px; color: var(--red); border-color: var(--red); }
        .tag-right { right: 2px; color: var(--blue); border-color: var(--blue); }       
        
        /* ===== PAGE 3: FRICTION MAGIC ===== */
        .friction-stage { display: flex; justify-content: center; align-items: center; gap: 10px; margin: 15px 0; }
        .friction-actor { 
            width: 90px; height: 90px; border-radius: 12px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3); border: 3px solid white;
        }
        .actor-pos { background: var(--red); transform: rotate(-5deg); }
        .actor-neg { background: var(--blue); transform: rotate(5deg); }
        .actor-emoji { font-size: 2.5rem; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.4)); }
        .actor-label { color: white; font-size: 0.65rem; font-weight: bold; margin-top: 2px; text-align: center; }
        
        .friction-action { text-align: center; font-weight: 900; color: var(--brown); }
        .friction-arrow { font-size: 1.8rem; animation: shove 0.6s infinite alternate; }
        @keyframes shove { from { transform: translateX(-4px); } to { transform: translateX(4px); } }
        
        .friction-caption { text-align: center; color: var(--brown); font-size: 0.9rem; line-height: 1.4; background: rgba(255,255,255,0.8); padding: 10px; border-radius: 8px; border: 2px dashed var(--gold); margin-top: 15px; }
        
        /* ===== PAGE 4: THE RIDDLE ===== */
        .riddle-card { 
            background: #fff; border: 3px solid #d35400; border-radius: 12px;
            padding: 12px; margin: 10px 0; box-shadow: 4px 4px 0 rgba(211, 84, 0, 0.2);
        }
        .riddle-text { font-size: 0.95rem; color: #333; line-height: 1.5; margin-bottom: 10px; font-weight: bold; }
        .clue-list { list-style: none; padding: 0; margin: 0; }
        .clue-list li { background: #fdf2e9; padding: 8px; border-radius: 6px; margin-bottom: 8px; font-size: 0.85rem; border-left: 4px solid #e67e22; color: #555; display: flex; align-items: center; gap: 8px; }
        .clue-list li::before { content: '🔍'; font-size: 1.2rem; }
        
        .combo-flow {
            background: linear-gradient(90deg, #e74c3c, #8e44ad, #3498db);
            color: white; font-weight: 900; text-align: center; padding: 10px;
            border-radius: 25px; margin-top: 15px; text-transform: uppercase;
            box-shadow: inset 0 2px 5px rgba(0,0,0,0.3); border: 2px solid white;
            animation: pulseBg 2s infinite;
        }
        @keyframes pulseBg { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.2); } }

        /* ===== PAGE 5: CHEAT SHEET ===== */
        .cheat-grid { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 10px; }
        .cheat-cell { 
            background: white; border: 2px solid var(--gold); border-radius: 8px;
            padding: 10px; font-size: 0.85rem; display: flex; align-items: center; gap: 10px;
        }
        .cheat-icon { font-size: 1.5rem; }
        .cheat-content strong { display: block; color: var(--brown); margin-bottom: 2px; }
        
    </style>

    <!-- HEADER -->
    <div class="wiz-header">
        <h2>🔬 Field Notes</h2>
        <div class="sub">The Secret Science of Static!</div>
    </div>

    <!-- BODY -->
    <div class="wiz-body">
        
        <!-- PAGE 1: Cover -->
        <div class="wiz-page active" data-wiz-page="1">
            <div class="cover-wrap">
                <div class="cover-stamp">TOP SECRET</div>
                <div class="cover-icon">⚡</div>
                <div class="cover-title">The Triboelectric Series</div>
                <div class="cover-sub">A Guide to Stealing Electrons</div>
                <div class="cover-text">
                    <strong>Dear Tintin,</strong><br><br>
                    Did you know electrons love to jump? When two different materials rub together, they play a game of tug-of-war!<br><br>
                    Materials at the <strong>TOP</strong> of the list lose electrons and become <strong style="color:var(--red);">Positive (+)</strong>.<br> 
                    Materials at the <strong>BOTTOM</strong> steal electrons and become <strong style="color:var(--blue);">Negative (−)</strong>.<br><br>
                    <em>The farther apart they are, the bigger the ZAP!</em>
                </div>
            </div>
            <div class="page-num">Page 1 of 5</div>
        </div>

        <!-- PAGE 2: The Ladder -->
        <div class="wiz-page" data-wiz-page="2">
            <h3>📈 The Electron Ladder</h3>
            <div class="ladder-wrap">
                <div class="ladder-axis">
                    <div class="axis-electron">e⁻</div>
                </div>
                
                <div class="ladder-rung" style="top: 5%;">
                    <div class="rung-bar rung-pos" style="width: 85%;">
                        <span class="rung-emoji">🧔🏻</span><span class="rung-name">Coarse Bristles / Hair</span>
                    </div>
                    <div class="rung-tag tag-left">Top!</div>
                </div>
                <div class="ladder-rung" style="top: 20%;">
                    <div class="rung-bar rung-pos" style="width: 70%; background: linear-gradient(90deg, #ffab91, #ff6b6b);">
                        <span class="rung-emoji">🪟</span><span class="rung-name">Glass</span>
                    </div>
                </div>
                <div class="ladder-rung" style="top: 35%;">
                    <div class="rung-bar rung-pos" style="width: 55%; background: linear-gradient(90deg, #ffcc80, #ff8a65);">
                        <span class="rung-emoji">🐛</span><span class="rung-name">Silk</span>
                    </div>
                </div>
                <div class="ladder-rung" style="top: 50%;">
                    <div class="rung-bar rung-neu">
                        <span class="rung-name">⚖️ Neutral</span>
                    </div>
                </div>
                <div class="ladder-rung" style="top: 65%;">
                    <div class="rung-bar rung-neg" style="width: 55%; background: linear-gradient(90deg, #81d4fa, #4fc3f7);">
                        <span class="rung-name">🎈 Rubber</span>
                    </div>
                </div>
                <div class="ladder-rung" style="top: 85%;">
                    <div class="rung-bar rung-neg" style="width: 85%; background: linear-gradient(90deg, #4db6ac, #00897b);">
                        <span class="rung-name">🍳 Extreme Polymer (Teflon)</span>
                    </div>
                    <div class="rung-tag tag-right">Bottom!</div>
                </div>
            </div>
            <div class="page-num">Page 2 of 5</div>
        </div>

        <!-- PAGE 3: Friction Magic -->
        <div class="wiz-page" data-wiz-page="3">
            <h3>✨ Friction = Magic!</h3>
            
            <div class="friction-stage">
                <div class="friction-actor actor-pos">
                    <div class="actor-emoji">🧔🏻</div>
                    <div class="actor-label">COARSE HAIR</div>
                </div>
                
                <div class="friction-action">
                    <div class="friction-arrow">RUB!</div>
                    <div style="font-size:0.7rem; color:var(--red);">e⁻ jumps!</div>
                </div>
                
                <div class="friction-actor actor-neg">
                    <div class="actor-emoji">🍳</div>
                    <div class="actor-label">POLYMER</div>
                </div>
            </div>
            
            <div class="friction-caption">
                Look at the ladder! <strong>Coarse Hair</strong> is way up top, and <strong>Polymers (like cooking non-stick)</strong> are way down at the bottom.<br><br>
                When you rub them together, the electron difference is <strong>HUGE</strong>! That's how we get maximum power! 🎯
            </div>
            <div class="page-num">Page 3 of 5</div>
        </div>

        <!-- PAGE 4: The Riddle -->
        <div class="wiz-page" data-wiz-page="4">
            <h3>🕵️‍♂️ The Scientist's Riddle</h3>
            
            <div class="riddle-card">
                <div class="riddle-text">
                    "To safely cross the positive bridge, we must capture a colossal <strong style="color:var(--blue);">NEGATIVE</strong> force inside our Leyden Jar!"
                </div>
                <ul class="clue-list">
                    <li>Find a modern, slippery polymer used to stop food from sticking to metal.</li>
                    <li>Find a source of extremely coarse, bristly hair. <br></li>
                </ul>
            </div>
            
            <div class="combo-flow">⚡ Combine them vigorously! ⚡</div>
            <div class="page-num">Page 4 of 5</div>
        </div>

        <!-- PAGE 5: Cheat Sheet -->
        <div class="wiz-page" data-wiz-page="5">
            <h3>📝 Laboratory Rules</h3>
            
            <div class="cheat-grid">
                <div class="cheat-cell" style="border-left-color: var(--red);">
                    <div class="cheat-icon">➕</div>
                    <div class="cheat-content">
                        <strong>Positives Lose Electrons</strong>
                        Silk on glass creates a Positive charge.
                    </div>
                </div>
                <div class="cheat-cell" style="border-left-color: var(--blue);">
                    <div class="cheat-icon">➖</div>
                    <div class="cheat-content">
                        <strong>Negatives Steal Electrons</strong>
                        Polymer on coarse whiskers creates a MASSIVE Negative charge!
                    </div>
                </div>
                <div class="cheat-cell" style="border-left-color: #9b59b6; background: #fdf2e9;">
                    <div class="cheat-icon">⚠️</div>
                    <div class="cheat-content">
                        <strong>Warning!</strong>
                        Don't mix Positive and Negative inside the jar, or they will cancel each other out!
                    </div>
                </div>
            </div>
            
            <div style="text-align:center; font-size:2rem; margin-top:10px;">⚡🔋🧪</div>
            <div class="page-num">Page 5 of 5</div>
        </div>
    </div>

    <!-- FOOTER -->
    <div class="wiz-footer">
        <button class="wiz-btn wiz-prev" disabled>← Back</button>
        <div class="wiz-dots">
            <button class="wiz-dot active" data-wiz-goto="1"></button>
            <button class="wiz-dot" data-wiz-goto="2"></button>
            <button class="wiz-dot" data-wiz-goto="3"></button>
            <button class="wiz-dot" data-wiz-goto="4"></button>
            <button class="wiz-dot" data-wiz-goto="5"></button>
        </div>
        <button class="wiz-btn wiz-next">Next →</button>
    </div>
</div>
`;

export class TheLeydenJarConundrum extends PacAdventureGame {

    async init() {
        this.enableSmartRendering = true;
        this.phase = 'SCAVENGE'; 
        this.combineTarget = null; 

        this.lastActionTime = Date.now();
        this.idleHintCount = 0;
        this.quizUI = new QuizOverlay(this.uiRoot, this.assetManager);
        
        this.environmentItems = []; 
        this.activeParticles = []; 
        
        // FIX: Timer & State cleanup arrays
        this.activeIntervals = [];
        this.activeTimeouts = [];
        this.inputLocked = false; 

        this.flags = {
            jarAssembled: false,
            teflonChargeCount: 0, 
            jarCharged: false,
            wireAttached: false,
            calculusTalkCount: 0
        };

        // Initialize the Nav System
        this.navSystem = new PolygonNavSystem({
            gridSize: 10,
            mapMaxX: 3100,
            mapMaxY: 1200,
            horizonY: 350
        });

        const legacyPolygons = [];

        legacyPolygons.push([   // Cliff left
            { x: 241, y: 860 },
            { x: 89, y: 506 },
            { x: 22, y: 418 },
            { x: 17, y: 857 }
        ]);
        legacyPolygons.push([   // Stone 
            { x: 197, y: 712 },
            { x: 268, y: 608 },
            { x: 294, y: 598 },
            { x: 347, y: 470 },
            { x: 390, y: 476 },
            { x: 442, y: 580 },
            { x: 463, y: 593 },
            { x: 516, y: 706 },
            { x: 369, y: 763 },
            { x: 263, y: 713 }
        ]);
        legacyPolygons.push([   // Cliff bottom left
            { x: 241, y: 859 },
            { x: 303, y: 859 },
            { x: 392, y: 958 },
            { x: 445, y: 967 },
            { x: 498, y: 1022 },
            { x: 233, y: 1023 }
        ]);
        legacyPolygons.push([   // Vehicle
            { x: 134, y: 274 },
            { x: 150, y: 412 },
            { x: 288, y: 439 },
            { x: 402, y: 409 },
            { x: 379, y: 336 },
            { x: 323, y: 322 },
            { x: 312, y: 279 },
            { x: 224, y: 262 }
        ]);
        legacyPolygons.push([   // Crates near the vehicle
            { x: 119, y: 456 },
            { x: 149, y: 444 },
            { x: 180, y: 460 },
            { x: 186, y: 496 },
            { x: 222, y: 545 },
            { x: 150, y: 567 },
            { x: 111, y: 554 }
        ]);
        legacyPolygons.push([ // Cliff top left
            { x: 125, y: 194 },
            { x: 69, y: 334 },
            { x: 108, y: 433 },
            { x: 53, y: 448 },
            { x: 4, y: 362 },
            { x: 7, y: 188 }
        ]);
        legacyPolygons.push([   // Crates near the tent (near Haddock)
            { x: 731, y: 402 },
            { x: 732, y: 456 },
            { x: 776, y: 463 },
            { x: 837, y: 443 },
            { x: 846, y: 393 }
        ]);
        legacyPolygons.push([   // Tent top middle (near Haddock)
            { x: 836, y: 435 },
            { x: 946, y: 543 },
            { x: 1150, y: 469 },
            { x: 1067, y: 322 },
            { x: 872, y: 286 }
        ]);
        legacyPolygons.push([   // Tent (on the right, near the cliff)
            { x: 1784, y: 504 },
            { x: 1975, y: 559 },
            { x: 2092, y: 564 },
            { x: 2167, y: 498 },
            { x: 2076, y: 325 },
            { x: 1743, y: 353 }
        ]);
        legacyPolygons.push([   // Crate
            { x: 1006, y: 551 },
            { x: 1068, y: 541 },
            { x: 1117, y: 556 },
            { x: 1116, y: 604 },
            { x: 1062, y: 616 },
            { x: 1008, y: 598 }
        ]);
        legacyPolygons.push([   // Crate
            { x: 1236, y: 894 },
            { x: 1317, y: 864 },
            { x: 1371, y: 879 },
            { x: 1374, y: 926 },
            { x: 1297, y: 970 },
            { x: 1235, y: 940 }
        ]);
        legacyPolygons.push([   // Create and sack
            { x: 1359, y: 838 },
            { x: 1442, y: 798 },
            { x: 1486, y: 815 },
            { x: 1486, y: 852 },
            { x: 1460, y: 899 },
            { x: 1416, y: 915 },
            { x: 1361, y: 884 }
        ]);
        legacyPolygons.push([   // Bedding
            { x: 1487, y: 657 },
            { x: 1575, y: 631 },
            { x: 1607, y: 659 },
            { x: 1517, y: 696 },
            { x: 1482, y: 677 }
        ]);
        legacyPolygons.push( [  // Rucksack
            { x: 1367, y: 541 },
            { x: 1416, y: 541 },
            { x: 1458, y: 650 },
            { x: 1380, y: 656 }
        ]);
        legacyPolygons.push([   // Two Crates
            { x: 879, y: 716 },
            { x: 925, y: 698 },
            { x: 924, y: 658 },
            { x: 962, y: 648 },
            { x: 1026, y: 658 },
            { x: 1026, y: 721 },
            { x: 992, y: 739 },
            { x: 986, y: 787 },
            { x: 938, y: 812 },
            { x: 874, y: 789 }
        ]);
        legacyPolygons.push([   // Two crates, bottom left
            { x: 333, y: 881 },
            { x: 426, y: 850 },
            { x: 477, y: 867 },
            { x: 478, y: 825 },
            { x: 562, y: 799 },
            { x: 751, y: 842 },
            { x: 751, y: 951 },
            { x: 684, y: 993 },
            { x: 528, y: 952 },
            { x: 524, y: 982 },
            { x: 491, y: 1007 }
        ]);
        legacyPolygons.push([   // Campfire
            { x: 1605, y: 728 },
            { x: 1680, y: 767 },
            { x: 1765, y: 724 },
            { x: 1683, y: 618 }
        ]);
        legacyPolygons.push([   // Campfire
            { x: 2145, y: 594 },
            { x: 2183, y: 535 },
            { x: 2241, y: 594 },
            { x: 2195, y: 623 }
        ]);
        legacyPolygons.push([   // Stone near campfire
            { x: 2041, y: 707 },
            { x: 2070, y: 674 },
            { x: 2122, y: 644 },
            { x: 2167, y: 668 },
            { x: 2193, y: 711 },
            { x: 2131, y: 737 }
        ]);
        legacyPolygons.push([   // Crate and sack near the cliff at the bottom right
            { x: 1838, y: 860 },
            { x: 1899, y: 831 },
            { x: 1918, y: 800 },
            { x: 2003, y: 747 },
            { x: 2061, y: 776 },
            { x: 2061, y: 848 },
            { x: 1939, y: 926 }
        ]);
        legacyPolygons.push([   // Stones near cliff
            { x: 1481, y: 1023 },
            { x: 1504, y: 984 },
            { x: 1548, y: 968 },
            { x: 1578, y: 978 },
            { x: 1612, y: 955 },
            { x: 1686, y: 945 },
            { x: 1687, y: 910 },
            { x: 1789, y: 855 },
            { x: 1821, y: 911 },
            { x: 1915, y: 961 },
            { x: 2003, y: 1023 }
        ]);
        legacyPolygons.push([   // Cliff (bottom-right)
            { x: 1930, y: 966 },
            { x: 2143, y: 827 },
            { x: 2101, y: 808 },
            { x: 2509, y: 537 },
            { x: 2553, y: 1022 },
            { x: 2014, y: 1020 }
        ]);
        legacyPolygons.push([  // Cliff/sky between the tent and bridge
            { x: 2142, y: 423 },
            { x: 2413, y: 461 },
            { x: 2384, y: 341 },
            { x: 2090, y: 344 },
        ]);
        this.navSystem.setObstacles(legacyPolygons);


        // FIX: Added Pith Ball State
        this.pithBallState = 'g15_test_ball_neutral'; 

        const assetsToLoad = [
            'g15_bg_panorama', 'ui_journal_bg',
            
            // Rigs
            'rig_tintin_side', 'rig_haddock_front', 'rig_calculus_front', 'rig_snowy_side', 'rig_thomson_front',
            
            // Skins (Scraper will auto-find 'greybox_actor' inside these!)
            'skin_tintin_side_base', 'skin_haddock_front_base', 'skin_calculus_front_base', 'skin_snowy_side_base', 'skin_thomson_front_base',
            
            // FSMs (Scraper will auto-find all the 'anim_xxx' references inside these!)
            'fsm_tintin_g15', 'fsm_haddock_g15', 'fsm_snowy_g15', 'fsm_calculus_g15', 'fsm_thomson_g15',
            
            // Standalone VFX & Testing Station
            'g15_vfx_spark_blue', 'g15_vfx_spark_red', 'g15_vfx_dust_cloud',
            'g15_test_stand_base', 'g15_test_ball_neutral', 'g15_test_ball_swing'
        ];
        
        if (!this.tuning || !this.tuning.items) {
            console.error("❌ Missing Level Data for TheLeydenJarConundrum");
            return;
        }

        this.tuning.items.forEach(i => {
            assetsToLoad.push(i.assetId);
            if (i.overlayAssetId) assetsToLoad.push(i.overlayAssetId);
        });
        
        Object.keys(this.tuning.itemManifest).forEach(i => {
            const manifestItem = this.tuning.itemManifest[i];
            assetsToLoad.push(manifestItem.assetId);
            if (manifestItem.overlayAssetId) assetsToLoad.push(manifestItem.overlayAssetId);
        });
        
        await this.preload(assetsToLoad);

        this.initCharacters();
        this.setupInterface(['LOOK', 'TAKE', 'USE', 'TALK']); 

        // ==========================================
        // INVENTORY EVENT SHIELD & WHEEL FIX
        // ==========================================
        const invContainer = document.querySelector('.inventory-grid');
        if (invContainer) {
            const invShield = (e) => {
                const isSlot = e.target.closest('.inv-slot');
                
                // Detect if the user is clicking the scrollbar track at the bottom of the container
                const isScrollbar = e.target === invContainer && (e.offsetY >= invContainer.clientHeight - 5);

                if (isSlot || isScrollbar) {
                    // User is interacting with the UI. Block the game engine.
                    e.stopPropagation(); 
                } else if (e.type === 'pointerdown' || e.type === 'mousedown' || e.type === 'touchstart') {
                    // User clicked a gap or dead space! 
                    // 1. Make the UI a ghost temporarily
                    invContainer.style.pointerEvents = 'none';
                    
                    // 2. Find the game canvas underneath the mouse
                    const underlyingElement = document.elementFromPoint(e.clientX, e.clientY);
                    
                    if (underlyingElement && underlyingElement.tagName.toLowerCase() === 'canvas') {
                        // 3. Clone the event and fire it directly at the canvas
                        const clone = new e.constructor(e.type, e);
                        underlyingElement.dispatchEvent(clone);
                    }
                    
                    // 4. Restore the UI's physical presence
                    invContainer.style.pointerEvents = 'auto';
                    e.stopPropagation(); // Stop the original click from double-firing
                }
            };
            
            const blockEvents = [
                'touchstart', 'touchmove', 'touchend', 
                'mousedown', 'mousemove', 'mouseup', 
                'pointerdown', 'pointermove', 'pointerup'
            ];
            
            blockEvents.forEach(evt => {
                invContainer.addEventListener(evt, invShield, true); 
            });

            // Translates Vertical Mouse Wheel to Horizontal Scrolling
            invContainer.addEventListener('wheel', (e) => {
                e.stopPropagation();
                e.preventDefault();
                invContainer.scrollLeft += e.deltaY;
            }, { passive: false, capture: true });
        }

        // ==========================================

        this.tuning.items.forEach(itemData => {
            if (itemData.startsInWorld) this.addEnvironmentItem(itemData);
            else if (itemData.startsInInventory) this.addInventoryItem(itemData);
        });

        this.addInterval(() => { this.idleStatePeriodicActions(); }, 1500); 

        this.injectCSS();
        this.initCamera();

        this.showDialogue("Calculus: 'We need a massive, sustained Negative charge! If only we had an 18th-century Dutch capacitor...'", "calculus");
        this.triggerRefresh();

        if (showDebug) {
            // ==========================================
            // 🚨 DEBUG SHORTCUTS - REMOVE BEFORE RELEASE
            // ==========================================
            window.addEventListener('keydown', (e) => {
                // Press '1': Test the Positive Trap (Fails at start)
                if (e.key === '1') {
                    console.log("DEBUG: Triggering Positive Trap");
                    this.startBridgeSequence('leyden_jar_wired_positive');
                }
                // Press '2': Test the Weak Negative (Fails in middle)
                if (e.key === '2') {
                    console.log("DEBUG: Triggering Weak Trap");
                    this.startBridgeSequence('leyden_jar_wired_weak');
                }
                // Press '3': Test the Master Solution (Succeeds)
                if (e.key === '3') {
                    console.log("DEBUG: Triggering Master Solution");
                    this.startBridgeSequence('leyden_jar_wired');
                }
            });

            // ==========================================
            // 🚨 DEBUG SHORTCUTS - REMOVE BEFORE RELEASE
            // ==========================================
            this.currentDebugPolygon = [];

            this.canvas.addEventListener('pointerdown', (e) => {
                if (e.shiftKey) {
                    e.stopPropagation(); // Stop Tintin from walking
                    
                    const rect = this.canvas.getBoundingClientRect();
                    const scaleX = this.camera.viewportWidth / rect.width;
                    const scaleY = this.camera.viewportHeight / rect.height;
                    
                    // Calculate true world coordinates including camera offset
                    const worldX = (e.clientX - rect.left) * scaleX + this.camera.x;
                    const worldY = (e.clientY - rect.top) * scaleY + this.camera.y;
                    
                    this.currentDebugPolygon.push({ x: Math.round(worldX), y: Math.round(worldY) });
                    this.triggerRefresh();
                }
            });

            window.addEventListener('keydown', (e) => {
                // Press 'Enter' to finalize the polygon
                if (e.key === 'Enter' && this.currentDebugPolygon.length > 2) {
                    let polyString = "[\n";
                    this.currentDebugPolygon.forEach(pt => {
                        polyString += `    { x: ${pt.x}, y: ${pt.y} },\n`;
                    });
                    polyString += "],";
                    
                    console.log("New Polygon Generated:\n", polyString);
                    
                    // Add it to the live nav system so you can test walking around it immediately!
                    this.navSystem.polygons.push([...this.currentDebugPolygon]);
                    
                    this.currentDebugPolygon = [];
                    this.triggerRefresh();
                } 
                // Press 'Escape' to cancel drawing
                else if (e.key === 'Escape') {
                    this.currentDebugPolygon = [];
                    this.triggerRefresh();
                }
                
                // Existing Bridge Debug Triggers
                if (e.key === '1') this.startBridgeSequence('leyden_jar_wired_positive');
                if (e.key === '2') this.startBridgeSequence('leyden_jar_wired_weak');
                if (e.key === '3') this.startBridgeSequence('leyden_jar_wired');
            });
            // ==========================================
        }
    }

    async preload(assetList) {
        // Swap loadBatch for loadWithDependencies
        await this.assetManager.loadWithDependencies(assetList);
    }

    // --- CAMERA SYSTEM SETUP ---
    initCamera() {
        this.camera = {
            x: 0, y: 0,
            targetX: 0, targetY: 0,
            viewportWidth: 1024,
            viewportHeight: 768,
            boundsMaxX: 3100, // Width of g15_bg_panorama
            boundsMaxY: 1024  // Height of g15_bg_panorama
        };

        this.camera.maxScrollX = Math.max(0, this.camera.boundsMaxX - this.camera.viewportWidth);
        this.camera.maxScrollY = Math.max(0, this.camera.boundsMaxY - this.camera.viewportHeight);

        // Start camera at the bottom-left where the campsite is
        this.camera.x = 0;
        this.camera.y = this.camera.maxScrollY;
        this.camera.targetX = this.camera.x;
        this.camera.targetY = this.camera.y;
    }


    // ==========================================
    // CSS & UI INJECTION
    // ==========================================

    injectCSS() {
        if (this.styleElement) this.styleElement.remove();
        this.styleElement = document.createElement('style');
        this.styleElement.innerHTML = `
            /* --- INVENTORY SCROLL & RESIZE FIX --- */
            .inventory-grid {
                display: flex !important;
                flex-wrap: nowrap !important;
                overflow-x: auto !important;
                overflow-y: hidden !important;
                
                width: max-content !important; 
                max-width: 100vw !important;     
                box-sizing: border-box !important;
                
                gap: 8px !important;
                padding-bottom: 10px !important; 
                scroll-behavior: smooth !important;
                -webkit-overflow-scrolling: touch !important;

                /* Forces mobile browsers to allow horizontal swiping */
                touch-action: pan-x !important; 
                /* Stops the scroll from bouncing the whole web page */
                overscroll-behavior-x: contain !important;

                background: transparent !important; /* Removes the solid block background */
                border: none !important;
                box-shadow: none !important;
            }
            /* Completely hides the inventory UI if there are zero items inside it */
            .inventory-grid:empty {
                display: none !important;
            }

            .inv-slot { 
                /* MAGIC BULLET: Tells Flexbox "Do not grow, do not shrink, stay exactly your assigned size" */
                flex: 0 0 auto !important; 
                
                /* !important overrides any inline sizes the JS engine tries to inject */
                width: clamp(60px, 9vw, 85px) !important; 
                height: clamp(60px, 9vw, 85px) !important; 
                
                /* Failsafes for stubborn browsers */
                min-width: 60px !important;
                max-width: 85px !important;

                /* Gives the slots a nice translucent backing so items are visible against the background */
                background: rgba(30, 45, 60, 0.6) !important; 
                border-radius: 6px !important;
                border: 1px solid rgba(255, 255, 255, 0.2) !important;
            }

            /* Snazzy Custom Scrollbar matching your UI colors */
            .inventory-grid::-webkit-scrollbar {
                height: 8px;
            }
            .inventory-grid::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 4px;
            }
            .inventory-grid::-webkit-scrollbar-thumb {
                background: #e6a15c; /* Matches your UI Gold */
                border-radius: 4px;
                border: 1px solid #4a2511;
            }
            .inventory-grid::-webkit-scrollbar-thumb:hover {
                background: #f39c12; 
            }

            /* --- CELEBRATION BANNER --- */
            .celebration-banner {
                /* Changed to translate3d for hardware acceleration */
                position: absolute; top: 30%; left: 50%; transform: translate3d(-50%, -50%, 0) scale(0);
                background: linear-gradient(135deg, #f1c40f, #d35400);
                color: #fff; font-family: 'Courier New', Courier, monospace; font-size: clamp(1.8rem, 5vw, 3rem); 
                font-weight: 900; padding: 20px 40px; border-radius: 12px; border: 4px dashed #fff;
                box-shadow: 0 10px 20px rgba(0,0,0,0.5), inset 0 0 15px rgba(255,255,255,0.3); 
                text-align: center; z-index: 1000; text-shadow: 3px 3px 0 #8b4513;
                animation: bannerPop 3.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                pointer-events: none; width: max-content; max-width: 90%;
                /* NEW: Anti-aliasing and blur-prevention properties */
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                backface-visibility: hidden;
                will-change: transform, opacity;
            }
            @keyframes bannerPop {
                0% { transform: translate3d(-50%, -50%, 0) scale(0) rotate(-10deg); opacity: 0; }
                10% { transform: translate3d(-50%, -50%, 0) scale(1.1) rotate(5deg); opacity: 1; }
                20% { transform: translate3d(-50%, -50%, 0) scale(1) rotate(0deg); opacity: 1; }
                85% { transform: translate3d(-50%, -50%, 0) scale(1) rotate(0deg); opacity: 1; }
                100% { transform: translate3d(-50%, -50%, 0) scale(1.2) rotate(-5deg); opacity: 0; filter: blur(4px); }
            }

            .quiz-header {
                padding-top: 40px;
                color: #226622 !important;
            }

            /* --- MOBILE PORTRAIT QUIZ FIX --- */
            @media (max-width: 768px) and (orientation: portrait) {
                .quiz-header { padding-top: 70px; }
            }

            /* --- MOBILE LANDSCAPE QUIZ FIX --- */
            @media (max-height: 500px) and (orientation: landscape) {
                .quiz-overlay-container {
                    top: 50% !important;
                    transform: translate(-50%, -50%) !important;
                    height: 95vh !important; 
                    width: 80vw !important; 
                    max-width: 600px !important; 
                    display: flex !important;
                    flex-direction: column;
                }
                .quiz-overlay-themed {
                    padding-top: 55px !important; /* Adjusted for squished landscape spiral */
                    padding-left: 30px !important;
                    padding-right: 30px !important;
                    padding-bottom: 10px !important; /* Reduced to maximize bottom screen real estate */
                }
                .quiz-scroll-wrapper {
                    padding: 2px 5px; /* Tighter padding to fit all buttons */
                }
                .quiz-header {
                    font-size: 1.1rem !important;
                    margin-bottom: 6px !important;
                }
                .quiz-choice-btn {
                    padding: 8px !important;
                    font-size: 0.85rem !important;
                    line-height: 1.2 !important;
                    min-height: 35px;
                }
            }

            /* --- OTHER RESPONSIVE MOBILE FIXES --- */
            @media (max-width: 768px) and (orientation: portrait) {
                .inv-slot { width: 64px; height: 64px; }

            }

            /* ===== RESPONSIVE TWEAKS ===== */
            @media (max-height: 500px) { /* Landscape mobile */
                .cover-icon { font-size: 2.5rem; margin: 0; }
                .wiz-body { padding: 10px; }
                .riddle-card { padding: 8px; }
                .clue-list li { padding: 5px; margin-bottom: 5px; }
            }
            @media (max-height: 500px) and (orientation: landscape) {
                .inv-slot { 
                    /* Overrides the global clamp to force a tiny footprint */
                    width: 45px !important; 
                    height: 45px !important; 
                    min-width: 45px !important;
                    max-width: 45px !important;
                }
                .inventory-grid {
                    /* Tightens up the spacing so the bar takes up minimum vertical space */
                    gap: 4px !important;
                    padding-bottom: 4px !important; 
                }
                /* Force strict vertical bounds to trigger scrolling */
                .doc-content { height: 100%; }
                /* --- MOVE VERBS TO FAR LEFT --- */
                .verb-bank {
                    position: fixed !important;
                    /* Pin to the left edge of the screen */
                    left: env(safe-area-inset-left, 10px) !important;
                    
                    /* Center it vertically */
                    top: 50% !important;
                    transform: translateY(-50%) !important;
                    
                    /* Make the buttons a bit more compact so they fit the margin */
                    width: 85px !important; 
                    padding: 0 !important;
                    margin: 0 !important;
                }
                /* Makes the buttons see-through so the world is visible */
                .verb-btn {
                    width: 100% !important;
                    padding: 8px 4px !important;
                    font-size: 0.8rem !important; /* Slightly smaller text to prevent overflow */
                }
                /* --- SKIP BUTTON TRANSPARENCY --- */
                .secondary-btn {
                    position: fixed !important;
                    /* Use the right edge of the screen, respecting camera notches */
                    right: env(safe-area-inset-right, 15px) !important;
                    top: 15px !important;
                    /* Clear any legacy positioning the engine might have applied */
                    left: auto !important; 
                    transform: none !important; 
                    margin: 0 !important;
                }
            }

            /* --- NEW: DOCUMENT VIEWER OVERLAY --- */
            .doc-overlay {
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.75);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000; /* Force it above the canvas */
                opacity: 0;
                transition: opacity 0.3s ease;
                padding: 15px; box-sizing: border-box;
            }

            .doc-content {
                background: transparent;
                width: 100%;
                max-width: 650px;
                height: 100%;
                max-height: 100%;
                display: flex;
                flex-direction: column;
                position: relative;
                min-height: 0;
                overflow: hidden;
            }

            .doc-close-btn {
                display: block;
                width: 100%;
                padding: 12px;
                background: #8b4513;
                color: white;
                border: 2px solid #5a2e15;
                border-top: none;
                border-radius: 0 0 8px 8px;
                font-weight: bold;
                font-size: 1.1rem;
                cursor: pointer;
                box-shadow: 0 4px 10px rgba(0,0,0,0.4);
                transition: background 0.2s;
                flex-shrink: 0;
            }
            .doc-close-btn:hover { background: #a0522d; }
        `;
        document.head.appendChild(this.styleElement);
    }

    //
    // Attaches click handlers to a wizard inside the document overlay.
    // Call this immediately after contentBox.innerHTML = htmlContent.
    //
    initWizardNavigation(container) {
        const pages = container.querySelectorAll('.wiz-page');
        const dots = container.querySelectorAll('.wiz-dot');
        const prevBtn = container.querySelector('.wiz-prev');
        const nextBtn = container.querySelector('.wiz-next');
        
        if (!pages.length || !prevBtn || !nextBtn) return; // Not a wizard
        
        let current = 1;
        const total = pages.length;
        
        const update = () => {
            pages.forEach(p => p.classList.toggle('active', parseInt(p.dataset.wizPage) === current));
            dots.forEach(d => d.classList.toggle('active', parseInt(d.dataset.wizGoto) === current));
            prevBtn.disabled = current === 1;
            
            if (current === total) {
                nextBtn.textContent = 'Done ✓';
            } else {
                nextBtn.textContent = 'Next →';
            }
        };
        
        const go = (n) => {
            if (n < 1 || n > total) return;
            current = n;
            update();
        };
        
        prevBtn.addEventListener('click', () => go(current - 1));
        nextBtn.addEventListener('click', () => {
            if (current === total) {
                // Auto-close on last page
                const overlay = container.closest('.doc-overlay');
                if (overlay) {
                    overlay.style.opacity = '0';
                    setTimeout(() => {
                        overlay.remove();
                        this.inputLocked = false;
                    }, 300);
                }
            } else {
                go(current + 1);
            }
        });
        
        dots.forEach(dot => {
            dot.addEventListener('click', () => go(parseInt(dot.dataset.wizGoto)));
        });
    }

    // ==========================================
    // UI EXTENSIONS
    // ==========================================

    showDocumentOverlay(htmlContent) {
        if (document.querySelector('.doc-overlay')) return;
    
        this.inputLocked = true;
    
        const overlay = document.createElement('div');
        overlay.className = 'doc-overlay';
    
        const contentBox = document.createElement('div');
        contentBox.className = 'doc-content';
        contentBox.innerHTML = htmlContent;
    
        const closeBtn = document.createElement('button');
        closeBtn.className = 'doc-close-btn';
        closeBtn.innerText = 'CLOSE NOTES';
        closeBtn.onclick = () => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                this.inputLocked = false;
            }, 300);
        };
    
        contentBox.appendChild(closeBtn);
        overlay.appendChild(contentBox);
        this.uiRoot.appendChild(overlay); // <-- Now protected by the UI whitelist!
    
        // Initialize wizard nav if this content is a wizard
        this.initWizardNavigation(contentBox);

        // ==========================================
        // THE NUCLEAR EVENT SHIELD
        // ==========================================
        // Intercepts events in the capture phase, stopping them from 
        // ever reaching the game engine's document-level listeners.
        const shield = (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            // We explicitly DO NOT call preventDefault() here because 
            // we want the browser's native scroll behavior to execute.
        };

        const eventTypes = [
            'wheel', 'scroll', 'mousedown', 'mousemove', 'mouseup', 
            'touchstart', 'touchmove', 'touchend', 
            'pointerdown', 'pointermove', 'pointerup'
        ];
        
        eventTypes.forEach(evt => {
            // The 'true' argument forces this listener to run FIRST
            contentBox.addEventListener(evt, shield, true);
        });
        // ==========================================
  
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });
    }

    // ==========================================
    // TIMER UTILITIES (FIX #4 & #9)
    // ==========================================
    
    addTimeout(fn, delay) {
        const id = setTimeout(fn, delay);
        this.activeTimeouts.push(id);
        return id;
    }

    addInterval(fn, delay) {
        const id = setInterval(fn, delay);
        this.activeIntervals.push(id);
        return id;
    }

    // ==========================================
    // ENGINE CORE & INPUT ROUTING
    // ==========================================

    addEnvironmentItem(itemData) {
        const asset = this.assetManager.get(itemData.assetId);
        if (!itemData.w) itemData.w = asset ? asset.width : 64;
        if (!itemData.h) itemData.h = asset ? asset.height : 64;
        this.environmentItems.push(itemData);
        this.triggerRefresh(); // FIX #2
    }

    removeEnvironmentItem(itemData) {
        this.environmentItems = this.environmentItems.filter(i => i.id !== itemData.id);
        this.triggerRefresh();
    }

    triggerHaptic(ms) {
        if (navigator.vibrate) navigator.vibrate(ms);
    }

    onPointerDown(e) {
        // Reset idle timer on any click
        this.lastActionTime = Date.now();

        if (this.dialogueCloseHandler || this.inputLocked) return; 

        // 1. UI LAYER CHECK (Screen Space)
        // Let the base PacAdventureGame handle standard verb/inventory clicks first
        if (typeof super.onPointerDown === 'function') {
            const uiHandled = super.onPointerDown(e);
            if (uiHandled) return; // Stop processing if a UI button was clicked
        }

        // 2. WORLD LAYER CHECK (World Space)
        // Apply 2D camera offsets to convert the screen click into a true world coordinate
        const worldX = this.input.x + this.camera.x; 
        const worldY = this.input.y + this.camera.y;

        let hitFound = false;

        // Adds a 20px invisible "fudge factor" around small items for fat fingers
        const touchPadding = 20;

        // Check Environment Item Hitboxes using World coordinates
        for (const item of this.environmentItems) {
            if (worldX >= (item.x - touchPadding) && worldX <= (item.x + item.w + touchPadding) &&
                worldY >= (item.y - touchPadding) && worldY <= (item.y + item.h + touchPadding)) {
                this.handleVerbAction(this.selectedVerb, item);
                hitFound = true;
                break;
            }
        }

        if (hitFound) return;

        // Check Character Hitboxes using World coordinates
        for (const [id, actor] of Object.entries(this.actors)) {
            if (worldX >= actor.x - actor.w/2 && worldX <= actor.x + actor.w/2 &&
                worldY >= actor.y - actor.h && worldY <= actor.y) {
                this.handleCharacterClick(id);
                hitFound = true;
                break;
            }
        }

        if (hitFound) return;

        if (!hitFound && this.combineTarget) {
            this.combineTarget = null;
            this.hideDialogue();
        }
        // If nothing was clicked, treat it as a walk command to the world coordinates!
        else if (!hitFound && !this.inputLocked) {
            if (this.navSystem.isWalkable(worldX, worldY)) {
                // Respect the horizon line from the depth scaling so he can't walk into the sky
                const walkTargetY = Math.max(350, worldY); 
                this.walkTo('tintin', worldX, walkTargetY);
            } else {
                // Optional: Show a brief visual cue or dialogue that he can't go there
                this.showDialogue("I can't walk through that.", "tintin", { "hideAfter": 1500 });
            }
        }
    }

    // ==========================================
    // INITIALIZATION & LOGIC
    // ==========================================

    initCharacters() {
        const createActor = (rigId, skinId, fsmId, x, y, w, h, flip = false, scale = 0.15) => {
            const rig = new SkeletonRig(this.assetManager.get(rigId));
            rig.applySkin(this.assetManager.get(skinId));
            const anim = new AnimationController(rig);
            const sm = new StateMachine(anim, this.assetManager.get(fsmId), this.assetManager);
            return { rig, anim, sm, x, y, w, h, flip, scale, baseScale: scale };
        };

        this.actors = {
            haddock: createActor('rig_haddock_front', 'skin_haddock_front_base', 'fsm_haddock_g15', 1200, 450, 70, 140),
            snowy: createActor('rig_snowy_side', 'skin_snowy_side_base', 'fsm_snowy_g15', 570, 435, 80, 80, false),
            calculus: createActor('rig_calculus_front', 'skin_calculus_front_base', 'fsm_calculus_g15', 820, 690, 80, 180, false, 0.09),
            tintin: createActor('rig_tintin_side', 'skin_tintin_side_base', 'fsm_tintin_g15', 680, 615, 80, 180, false),
            
            // Thomson (Right side, flipped to face left)
            thomson: createActor('rig_thomson_front', 'skin_thomson_front_base', 'fsm_thomson_g15', 2860, 425, 100, 250, true),
            // Thompson (Left side, normal orientation facing right)
            thompson: createActor('rig_thomson_front', 'skin_thomson_front_base', 'fsm_thomson_g15', 2790, 423, 100, 250, false) 
        };

        // --- TWIN SETUP LOGIC ---
        ['thomson', 'thompson'].forEach((id, index) => {
            const twin = this.actors[id];
            
            // 1. Save their starting positions so they have a center point to vibrate around
            twin.baseX = twin.x;
            twin.baseY = twin.y;
            
            // 2. Fake a 3/4 turn by squishing the horizontal scale slightly 
            twin.rig.bones['root'].scaleX = 0.8; 
            
            // 3. Rotate them slightly inward (Thomson leans left, Thompson leans right)
            twin.rig.bones['root'].rotation = index === 0 ? -6 : 6; 
        });
    }

    idleStatePeriodicActions() {
        const timeSinceLastAction = Date.now() - this.lastActionTime;
        // Trigger if idle for 15 seconds, and no dialogue/cutscene is currently happening
        if (timeSinceLastAction > 15000 && !this.dialogueShowing && !this.inputLocked) {
            this.triggerIdleHint();
            this.lastActionTime = Date.now(); // Reset to prevent spamming
        }

        const haddockSm = this.actors.haddock.sm;
        const haddockAnim = this.actors.haddock.anim;

        // Make sure he's actually idling and not currently being shocked!
        // AND the previous animation has completely finished
        if (haddockSm.getCurrentState() === 'BASIC_IDLE' && !haddockAnim.isPlaying) {
            // 30% chance to scratch beard every 3 seconds
            if (Math.random() < 0.3) { 
                this.actors.haddock.sm.dispatch('TRIGGER_SCRATCH');
                // 50% chance to generate a tiny static spark when he scratches!
                if (Math.random() < 0.5) {
                    this.addTimeout(() => {
                        // Spawn a small spark near his chin/chest area
                        this.spawnParticles('g15_vfx_spark_blue', this.actors.haddock.x, this.actors.haddock.y - 120, 0.2, 0.3);
                    }, 500); // Time it to match when his hand rubs the beard
                }
            } else {
                this.actors.haddock.sm.dispatch('PLAY_IDLE');
            }
        }

        const tintinSm = this.actors.tintin.sm;
        const tintinAnim = this.actors.tintin.anim;

        // If Tintin is resting in the IDLE state and his animation has finished
        if (tintinSm.getCurrentState() === 'IDLE' && !tintinAnim.isPlaying && !this.actors.tintin.isPuppeteered) {
            // Give him a 40% chance to organically trigger the animation again
            // This interval ticks every 1500ms, creating natural gaps!
            if (Math.random() > 0.75) {
                tintinSm.dispatch('PLAY_IDLE');
            }
        }

        const snowySm = this.actors.snowy.sm;
        const snowyAnim = this.actors.snowy.anim;

        if (snowySm.getCurrentState() === 'IDLE' && !snowyAnim.isPlaying) {
            if (Math.random() > 0.7) {
                snowySm.dispatch('PLAY_IDLE');
            }
        }

        const calculusSm = this.actors.calculus.sm;
        const calculusAnim = this.actors.calculus.anim;

        // Check if he is in the IDLE state and his animation has fully stopped
        if (calculusSm.getCurrentState() === 'IDLE' && !calculusAnim.isPlaying) {
            // 40% chance to play his idle animation again (adjust this number to make him fidget more or less)
            if (Math.random() > 0.60) {
                calculusSm.dispatch('PLAY_IDLE');
            }
        }
    }

    triggerIdleHint() {
        const hints = [
            "Tintin: 'I should probably click somewhere on the ground if I want to walk over there.'",
            "Calculus: 'Remember, my boy! The USE verb requires TWO steps! First, click the item you want to use, then click your target!'",
            "Haddock: 'Thundering typhoons! Are we just going to stand here all day? Combine something in your inventory!'",
            "Thomson: 'To be perfectly frank, standing perfectly still is highly suspicious behavior.'",
            "Snowy: *Woof!* (If you're stuck, try talking to everyone again!)"
        ];
        
        const hint = hints[this.idleHintCount % hints.length];
        
        // Dynamically assign the speaker based on the text string
        let speaker = "tintin";
        if (hint.includes("Calculus")) speaker = "calculus";
        if (hint.includes("Haddock")) speaker = "haddock";
        if (hint.includes("Thomson")) speaker = "thomson";

        this.showDialogue(hint, speaker, { "hideAfter": 4500 });
        this.idleHintCount++;
    }

    handleVerbAction(verb, item) {
        this.triggerRefresh();

        if (verb === 'LOOK') {
            this.showDialogue(item.desc, "tintin");
            this.combineTarget = null;
        } 
        else if (verb === 'TAKE') {
            if (item.id === 'pith_station') {
                this.showDialogue("Calculus would be furious if I dismantled his testing station.", "tintin");
                return;
            }
            if (this.environmentItems.includes(item)) {
                this.removeEnvironmentItem(item);
                this.addInventoryItem(item);
                this.showDialogue(`Picked up: ${item.name}`, "tintin", { "hideAfter": 2000 } );
                
            }
        }
        else if (verb === 'USE') {
            if (!this.combineTarget) {
                this.combineTarget = item;
                this.showDialogue(`Use ${item.name} on who or what?`, "tintin", { "hideAfter": 2000 });
            } else {
                // FIX #3: Pith ball routing
                if (item.id === 'pith_station') {
                    this.testPithBall(this.combineTarget);
                } else {
                    this.attemptCombination(this.combineTarget, item);
                }
                this.combineTarget = null;
            }
        }
    }

    handleCharacterClick(characterId) {
        this.triggerRefresh();

        if (this.selectedVerb === 'USE' && this.combineTarget) {
            this.attemptCharacterInteraction(this.combineTarget, characterId);
            this.combineTarget = null;
        } 
        else if (this.selectedVerb === 'TALK') {
            this.handleDialogueTrigger(characterId);
        }
    }

    handleDialogueTrigger(characterId) {
        if (characterId === 'calculus') {
            this.actors.calculus.sm.dispatch('TRIGGER_EXPLAIN');

            // State 1: Start of the game. Needs to build the jar.
            if (!this.flags.jarAssembled) {
                if (this.flags.calculusTalkCount === 0) {
                    this.showDialogue("Calculus: 'The bridge is charged with positive ions! We need to build an 18th-century Dutch capacitor to neutralize it!'", "calculus");
                } else if (this.flags.calculusTalkCount === 1) {
                    this.showDialogue("Calculus: 'To build a Leyden Jar, you need a glass vessel, an outer metal lining, and a conductive liquid inside!'", "calculus");
                } else {
                    this.showDialogue("Calculus: 'Seal the bottle with something non-conductive, and pierce it with metal to create an electrode!'", "calculus");
                }
                this.flags.calculusTalkCount = (this.flags.calculusTalkCount + 1) % 3;
            } 
            
            // State 2: Jar is built, but they haven't figured out the Teflon/Haddock combo yet.
            else if (this.flags.jarAssembled && this.flags.teflonChargeCount === 0) {
                if (Math.random() > 0.5) {
                    this.showDialogue("Calculus: 'Splendid jar! Now we need negative electrons. Test your materials on the Pith Ball station!'", "calculus");
                } else {
                    // Short dialogue to introduce the action
                    this.showDialogue("Calculus: 'Here, review my notes on the Triboelectric Series! We need to combine the highest Positive with the lowest Negative!'", "calculus", { "hideAfter": 2000 });
                    
                    // Wait for his dialogue to finish, then pop the HTML chart
                    this.addTimeout(() => {
                        this.showDocumentOverlay(infographicHTML);
                    }, 2200);
                }
            } 
            
            // State 3: They figured out the Haddock zap, but haven't fully charged the jar.
            else if (this.flags.teflonChargeCount > 0 && this.phase !== 'CROSS') {
                this.showDialogue("Calculus: 'Excellent! Use the charged pan on the jar's nail to transfer the electrons. It will take multiple zaps to fill it!'", "calculus");
            } 
            
            // State 4: Jar is fully charged, but they need to wire it.
            else if (this.phase === 'CROSS') {
                // Check if they have the wired jar in their inventory yet
                const hasWiredJar = this.inventory.some(item => item.id.includes('wired'));
                if (!hasWiredJar) {
                    this.showDialogue("Calculus: 'The jar is glowing! Now, you must ground it to yourself using a highly conductive metal wire!'", "calculus");
                } else {
                    this.showDialogue("Calculus: 'The Static Shuffle! Step onto the bridge, my boy! Your negative field will perfectly neutralize the trap!'", "calculus");
                }
            }

            // Always stop the animation after 2.5 seconds so he returns to idle
            this.addTimeout(() => this.actors.calculus.sm.dispatch('STOP_EXPLAIN'), 2500);
        }
        else if (characterId === 'thomson' || characterId === 'thompson') {
            // Initialize the joke counter if it doesn't exist
            if (this.flags.twinJokeCount === undefined) this.flags.twinJokeCount = 0;
            
            const twinJokes = [
                "Thomson: 'To be perfectly frank, I find this highly unprofessional!'",
                "Thompson: 'Precisely! To neutralize the bridge, we must simply arrest the electrons!'",
                "Thomson: 'Have you tried showing the trap your badge? That usually works.'",
                "Thompson: 'I suspect Calculus is behind this. He looks suspiciously like a scientist.'"
            ];
            
            // Show the joke and increment the counter
            this.showDialogue(twinJokes[this.flags.twinJokeCount], 'thomson', { "hideAfter": 3500 });
            this.flags.twinJokeCount = (this.flags.twinJokeCount + 1) % twinJokes.length;
        }
        else if (characterId === 'haddock') {
            // Check if he's already been zapped to change his dialogue!
            if (this.flags.teflonChargeCount > 0) {
                this.showDialogue("Haddock: 'Keep your static electricity away from me, you blistered barnacle!'", "haddock", { "hideAfter": 3000 });
            } else {
                this.showDialogue("Haddock: 'Blistering blue barnacles, Tintin! Calculus and his invisible forces are driving me mad!'", "haddock", { "hideAfter": 3000 });
            }
        }
        else if (characterId === 'snowy') {
            // Trigger his little puff animation for fun when you talk to him
            this.playSnowyPuff();
            this.showDialogue("Snowy: *Woof!* (I think we need more bones and fewer electrons.)", "tintin", { "hideAfter": 2500 });
        }
    }

    // ==========================================
    // LOGIC: Assembly & Triboelectric Math
    // ==========================================

    attemptCombination(itemA, itemB) {
        const ids = [itemA.id, itemB.id];

        // Red Herrings
        if (ids.includes('wooden_stick') || ids.includes('car_battery_dead') || ids.includes('magnet')) {
            this.showDialogue("That won't work. Calculus would call that 'bad physics'.", "tintin", { "hideAfter": 3000 });
            return;
        }

        // --- Contextual Clues for Invalid Permutations ---
        if (ids.includes('bottle_empty') && ids.includes('cork')) {
            this.showDialogue("I should probably fill it with a conductive liquid before I seal it.", "tintin", { "hideAfter": 3000 });
            return;
        }
        
        if (ids.includes('bottle_empty') && ids.includes('river_water')) {
            this.showDialogue("Calculus said it needs an outer metal lining first. Better wrap it before I get it wet.", "tintin", { "hideAfter": 4000 });
            return;
        }

        if (ids.includes('silk_handkerchief') && ids.includes('rubber_weak')) {
            this.showDialogue("Calculus: 'It's no use! Silk and rubber are too close on the Triboelectric series. The electron transfer maxes out instantly. We need materials with a much greater affinity difference!'", "calculus", { "hideAfter": 5500 });
            return;
        }

        if (ids.includes('cork_with_nail') && ids.includes('bottle_wrapped')) {
            this.showDialogue("I almost forgot the inner conductor! Doesn't make sense to seal the bottle before filling it with electrode.", "tintin", { "hideAfter": 4500 });
            return;
        }

        // Assembly
        if (ids.includes('foil_wrapper') && ids.includes('bottle_empty')) {
            this.removeAndReplace(itemA, itemB, 'bottle_wrapped');
            this.showDialogue("I've wrapped the outside of the glass with foil. That's the outer metal lining sorted.", "tintin", { "hideAfter": 4000 });
        }
        else if (ids.includes('river_water') && ids.includes('bottle_wrapped')) {
            this.removeAndReplace(itemA, itemB, 'bottle_filled');
            this.showDialogue("I've filled the wrapped bottle with river water. The minerals will act as an internal conductor.", "tintin", { "hideAfter": 4000 });
        }
        else if (ids.includes('nail_rusty') && ids.includes('cork')) {
            this.removeAndReplace(itemA, itemB, 'cork_with_nail');
            this.showDialogue("I've pushed the rusty nail through the cork. This will act as the central electrode.", "tintin", { "hideAfter": 4000 });
        }
        else if (ids.includes('cork_with_nail') && ids.includes('bottle_filled')) {
            this.removeAndReplace(itemA, itemB, 'leyden_jar_uncharged');
            this.flags.jarAssembled = true;
            this.phase = 'TRAP';
            this.showDialogue("A makeshift Leyden Jar! It's perfectly assembled, but completely empty of charge.", "tintin", { "hideAfter": 4500 });
        }

        // FIX #5: Create intermediate charged items & Prevent logically conflicting charges
        else if (ids.includes('silk_handkerchief') && ids.find(id => id.includes('teflon_pan'))) {
            this.showDialogue("Silk is too delicate to properly charge this dense polymer. I need a much coarser, rougher source of friction.", "tintin", { "hideAfter": 4500 });
        }
        else if (ids.includes('silk_handkerchief') && ids.includes('bottle_empty')) {
            this.removeAndReplace(itemA, itemB, 'bottle_positive'); // Returns Silk + new Charged Bottle
            this.addInventoryItem(this.tuning.itemManifest['silk_handkerchief']); 
            this.showDialogue("The silk rubbed on the glass... the bottle now has a Positive charge.", "tintin");
        }
        else if (ids.includes('silk_handkerchief') && ids.includes('rubber_patch')) {
            // 1. Check if they already have the weak jar
            const hasWeakJar = this.inventory.some(i => i.id === 'leyden_jar_weak' || i.id === 'leyden_jar_wired_weak');
            if (hasWeakJar) {
                this.showDialogue("I already transferred this weak charge to the jar. Doing it again won't increase the power. I need a stronger source of friction.", "tintin", { "hideAfter": 5000 });
                return;
            }
            
            // 2. Check if they already have a heavily charged jar from the Teflon Pan
            const hasStrongJar = this.inventory.some(i => i.id.includes('partial') || i.id === 'leyden_jar_charged' || i.id === 'leyden_jar_wired');
            if (hasStrongJar) {
                this.showDialogue("The jar is already holding a massive charge. This weak static won't add anything useful.", "tintin", { "hideAfter": 4000 });
                return;
            }

            this.removeAndReplace(itemA, itemB, 'rubber_weak');
            this.addInventoryItem(this.tuning.itemManifest['silk_handkerchief']); 
            this.showDialogue("Rubbing silk on rubber... the patch holds a weak negative charge.", "tintin");
        }
        else if (ids.includes('silk_handkerchief') && ids.find(id => id.includes('leyden_jar'))) {
            const jarId = ids.find(id => id.includes('leyden_jar'));
            
            // Allow charging the assembled jar directly!
            if (jarId === 'leyden_jar_uncharged') {
                const jarItem = itemA.id === 'leyden_jar_uncharged' ? itemA : itemB;
                const silkItem = itemA.id === 'silk_handkerchief' ? itemA : itemB;
                
                this.removeInventoryItem(jarItem);
                this.removeInventoryItem(silkItem);
                
                this._giveFreshItem('leyden_jar_positive');
                this._giveFreshItem('silk_handkerchief'); // Give the silk back
                this.showDialogue("Rubbing the silk on the glass jar... it now holds a Positive charge.", "tintin");
            } 
            // Guard: Already Positive
            else if (jarId === 'leyden_jar_positive' || jarId === 'leyden_jar_wired_positive') {
                this.showDialogue("It's already holding a Positive charge from the silk. Rubbing it more won't help.", "tintin", { "hideAfter": 3500 });
            } 
            // Guard: Prevent ruining the Negative charge!
            else {
                this.showDialogue("The jar is currently holding Negative electrons! Rubbing the glass with silk now would create a conflicting Positive surface charge and ruin the capacitor!", "tintin", { "hideAfter": 6000 });
            }
        }
        
        // ==========================================
        // 1. WIRING (Moved UP to intercept the wire first!)
        // ==========================================
        else if (ids.find(id => id.includes('leyden_jar')) && ids.includes('copper_wire')) {
            const currentJarId = ids.find(id => id.includes('leyden_jar'));
            
            // Helpful hints preventing players from prematurely wiring uncharged/partial jars
            if (currentJarId.includes('uncharged')) {
                this.showDialogue("I shouldn't wire it up yet. It isn't holding any charge.", "tintin", { "hideAfter": 3500 });
                return;
            } else if (currentJarId.includes('partial')) {
                this.showDialogue("The jar is only partially charged. I'd better fill it up completely before I seal it with the wire.", "tintin", { "hideAfter": 4500 });
                return;
            }

            const jarItem = itemA.id === currentJarId ? itemA : itemB;
            const wireItem = itemA.id === 'copper_wire' ? itemA : itemB;
            
            this.removeInventoryItem(jarItem);
            this.removeInventoryItem(wireItem); 
            
            // Cleanly map the wired item ID based on the jar's current state
            let wiredId;
            if (currentJarId.includes('positive')) wiredId = 'leyden_jar_wired_positive';
            else if (currentJarId.includes('weak')) wiredId = 'leyden_jar_wired_weak';
            else wiredId = 'leyden_jar_wired'; // Fully charged

            this._giveFreshItem(wiredId);
            this.showDialogue("Wired up. Now to attach it to myself...", "tintin");
        }

        // ==========================================
        // GUARD: Conflicting Charges (Positive Jar + Negative Source)
        // ==========================================
        else if (ids.find(id => id.includes('leyden_jar_positive')) && ids.some(id => id === 'teflon_pan_charged' || id === 'rubber_weak')) {
            this.showDialogue("Tintin: 'The jar is currently holding a Positive charge. If I introduce Negative electrons now, they will just neutralize each other! I need an empty jar.'", "tintin", { "hideAfter": 5500 });
            return;
        }
        
        // ==========================================
        // GUARD: Conflicting Raw Materials (Positive Glass + Negative Source)
        // ==========================================
        else if (ids.includes('bottle_positive') && ids.some(id => id === 'teflon_pan_charged' || id === 'rubber_weak')) {
            this.showDialogue("Tintin: 'The glass is positively charged. Touching it with a negative item will just cause a spark and discharge them both. I should keep them separated.'", "tintin", { "hideAfter": 5500 });
            return;
        }

        // ==========================================
        // 2. TRANSFERRING CHARGE (Moved DOWN to act as a fallback)
        // ==========================================
        else if (ids.some(id => id.includes('leyden_jar_uncharged') || id.includes('leyden_jar_partial') || id.includes('leyden_jar_weak'))) {
            
            // Dynamically figure out which state the jar is currently in
            const activeJarId = ids.find(id => id.includes('leyden_jar_uncharged') || id.includes('leyden_jar_partial') || id.includes('leyden_jar_weak'));
            
            // Safely assign the jar and the "other" item
            const jarItem = itemA.id === activeJarId ? itemA : itemB;
            const otherItem = itemA.id === activeJarId ? itemB : itemA;
            
            if (otherItem.id === 'bottle_positive') {
                this.removeInventoryItem(jarItem);
                this.removeInventoryItem(otherItem);
                this._giveFreshItem('leyden_jar_positive');
                this._giveFreshItem('bottle_empty'); 
                this.showDialogue("The strong positive field from the glass neutralized the jar's negative electrons and completely overtook it", "tintin");
            }
            else if (otherItem.id === 'rubber_weak') {
                // Prevent stacking the weak charge on itself
                if (jarItem.id === 'leyden_jar_weak') {
                    this.showDialogue("The jar already has this weak charge. Adding more won't help.", "tintin", { "hideAfter": 3500 });
                    return;
                }
                this.removeInventoryItem(jarItem);
                this.removeInventoryItem(otherItem);
                this._giveFreshItem('leyden_jar_weak');
                this._giveFreshItem('rubber_patch'); 
            }
            else if (otherItem.id === 'teflon_pan_charged') {
                this.flags.teflonChargeCount++;

                // 1. Instantly deplete the pan back to its uncharged state
                this.removeInventoryItem(otherItem); 
                this._giveFreshItem('teflon_pan');
                
                // 2. Remove the old jar state
                this.removeInventoryItem(jarItem);

                // 3. Add the new formal jar state and update Tintin's dialogue to prompt the player
                if (this.flags.teflonChargeCount === 1) {
                    this._giveFreshItem('leyden_jar_partial_1');
                    // Acknowledge the player's upgrade from the weak jar!
                    if (jarItem.id === 'leyden_jar_weak') {
                        this.showDialogue("The massive charge from the pan completely overpowered the weak static! The jar is now 1/3 full. I'll need to zap Haddock again.", "tintin", { "hideAfter": 5000 });
                    } else {
                        this.showDialogue("It stored the charge! But the pan is empty again. I'll need to zap Haddock.", "tintin", { "hideAfter": 4000 });
                    }
                } else if (this.flags.teflonChargeCount === 2) {
                    this._giveFreshItem('leyden_jar_partial_2');
                    this.showDialogue("The jar is 2/3 full, but the pan is dead. One more Haddock zap should do it.", "tintin");
                } else {
                    this._giveFreshItem('leyden_jar_charged');
                    this.phase = 'CROSS';
                    this.showDialogue("The jar is glowing blue! Fully charged.", "tintin");
                }
            } else {
                // If the player clicks the jar with the uncharged pan or anything else
                this.showDialogue("That didn't work. I need a charged item to transfer electrons into the jar.", "tintin");
            }
        }       

        
        else {
            // --- Randomized Humorous Fallbacks for Combinations ---
            const fallbacks = [
                "I don't think those go together.",
                "Calculus would lecture me for an hour if I tried that.",
                "That defies several laws of physics.",
                "I'm an investigative reporter, not a modern artist.",
                "That won't work. Thomson and Thompson would call it 'highly unprofessional'."
            ];
            const randomLine = fallbacks[Math.floor(Math.random() * fallbacks.length)];
            this.showDialogue(randomLine, "tintin", { "hideAfter": 3000 });
        }
    }

    testPithBall(item) {
        // --- Detect Assembled Leyden Jar Charges ---
        if (item.id.includes('leyden_jar')) {
            
            // FIX: Catch "uncharged" FIRST so it doesn't trigger the "charged" substring below!
            if (item.id.includes('uncharged')) {
                this.showDialogue("No reaction. The jar is completely uncharged.", "tintin", { "hideAfter": 3000 });
            } 
            else if (item.id.includes('positive')) {
                this.pithBallState = 'g15_test_ball_swing';
                this.showDialogue("The ball aggressively attracts to the jar! It's holding a strong Positive charge.", "tintin", { "hideAfter": 4500 });
            } 
            else if (item.id.includes('weak')) {
                this.pithBallState = 'g15_test_ball_swing';
                this.showDialogue("A slight repulsion. The jar holds a weak Negative charge. Not enough to clear the bridge.", "tintin", { "hideAfter": 4500 });
            } 
            else if (item.id.includes('partial')) {
                this.pithBallState = 'g15_test_ball_swing';
                this.showDialogue("The ball repels firmly. The jar has a decent Negative charge, but it can hold more.", "tintin", { "hideAfter": 4500 });
            } 
            else if (item.id.includes('charged') || (item.id.includes('wired') && !item.id.includes('positive') && !item.id.includes('weak'))) {
                this.pithBallState = 'g15_test_ball_swing';
                this.showDialogue("The ball violently repels! The jar is fully loaded with a massive Negative charge!", "tintin", { "hideAfter": 4500 });
            }
        } 
        // --- Existing Raw Material Checks ---
        else if (item.id === 'teflon_pan_charged') {
            this.pithBallState = 'g15_test_ball_swing';
            this.showDialogue("The ball violently repels! 'Like charges repel.' The pan is holding a massive Negative charge!", "tintin", { "hideAfter": 4000 });
        } else if (item.id === 'bottle_positive') {
            this.pithBallState = 'g15_test_ball_swing';
            this.showDialogue("The ball aggressively attracts to the glass. 'Opposites attract!' The glass is highly Positive.", "tintin", { "hideAfter": 4000 });
        } else if (item.id === 'rubber_weak') {
            this.pithBallState = 'g15_test_ball_swing';
            this.showDialogue("A slight repulsion. It's negative, but very weak. I need something with more friction.", "tintin", { "hideAfter": 4000 });
        } else {
            this.showDialogue("No reaction. The item has no electrical charge.", "tintin", { "hideAfter": 3000 });
        }
        
        this.triggerRefresh();
        
        // Reset the pith ball visual after 2 seconds
        this.addTimeout(() => {
            this.pithBallState = 'g15_test_ball_neutral';
            this.triggerRefresh();
        }, 2000);
    }

    // ==========================================
    // CLIMAX: Character Interactions
    // ==========================================

    attemptCharacterInteraction(item, characterId) {
        // FIX #1: Chocolate Bar on Tintin
        if (characterId === 'tintin' && item.id === 'chocolate_bar') {
            // Check where the item came from and remove it properly ---
            if (this.environmentItems.includes(item)) {
                this.removeEnvironmentItem(item);
            } else {
                this.removeInventoryItem(item);
            }
            this.triggerEatAnimation();
            return;
        }

        if (item.id === 'chocolate_bar') {
            if (characterId === 'snowy') {
                this.playSnowyPuff();
                this.showDialogue("Tintin: 'No, Snowy! Chocolate is extremely toxic to dogs. Stick to bones!'", "tintin", { "hideAfter": 4000 });
                return;
            } else if (characterId === 'haddock') {
                this.showDialogue("Haddock: 'Chocolate? Do I look like a Swiss schoolboy? Bring me a bottle of Loch Lomond!'", "haddock", { "hideAfter": 4500 });
                return;
            } else if (characterId === 'calculus') {
                this.showDialogue("Calculus: 'A block of slate? No, no, my boy, I use paper for my calculations!'", "calculus", { "hideAfter": 4500 });
                return;
            } else if (characterId === 'thomson' || characterId === 'thompson') {
                this.showDialogue("Thomson: 'To be perfectly frank, snacking on duty is strictly forbidden! ...Though I wouldn't mind a piece.'", "thomson", { "hideAfter": 5000 });
                return;
            }
        }

        // --- Humorous Empty Rum Bottle Interactions ---
        if (item.id === 'bottle_empty') {
            if (characterId === 'haddock') {
                this.showDialogue("Haddock: 'An empty bottle?! Thundering typhoons, are you trying to mock my suffering?!'", "haddock", { "hideAfter": 4500 });
                return;
            } else if (characterId === 'calculus') {
                this.showDialogue("Calculus: 'A glass ear trumpet? No thank you, my boy, my hearing is absolutely perfect!'", "calculus", { "hideAfter": 4500 });
                return;
            } else if (characterId === 'snowy') {
                this.playSnowyPuff();
                this.showDialogue("Snowy: *Sniff... Cough!* (Keep that sailor juice away from my sensitive nose!)", "tintin", { "hideAfter": 4000 });
                return;
            } else if (characterId === 'thomson' || characterId === 'thompson') {
                this.showDialogue("Thomson: 'Aha! Exhibit A! The suspect was clearly intoxicated!'", "thomson", { "hideAfter": 4500 });
                return;
            } else if (characterId === 'tintin') {
                this.showDialogue("Tintin: 'I'd better not hold onto this too long, or the Captain will think I drank it.'", "tintin", { "hideAfter": 4000 });
                return;
            }
        }

        if (characterId === 'snowy' && item.id === 'river_water') {
            this.showDialogue("Tintin: 'Better not. He's already had his bath this month.'", "tintin", { "hideAfter": 3500 });
            return;
        }

        // --- Humorous Leyden Jar Interactions & Hints ---
        if (item.id.includes('leyden_jar')) {
            if (characterId === 'tintin') {
                // If it's wired, proceed to the climax!
                if (item.id.includes('wired')) {
                    this.removeInventoryItem(item); 
                    this.startBridgeSequence(item.id);
                    return;
                } 
                // Hint 1: The jar is assembled but uncharged
                else if (item.id.includes('uncharged')) {
                    this.showDialogue("Tintin: 'It's perfectly assembled, but holding it does nothing. It needs a massive electron deficit before it's useful.'", "tintin", { "hideAfter": 4500 });
                    return;
                } 
                // Hint 2: The jar has some charge, but no wire
                else {
                    this.showDialogue("Tintin: 'I can feel the static humming through the glass, but I can't safely channel the field into myself. I need a conductive tether.'", "tintin", { "hideAfter": 5000 });
                    return;
                }
            } else if (characterId === 'haddock') {
                this.showDialogue("Tintin: 'The Captain has had enough shocks for one day. Handing him a capacitor would be cruel.'", "tintin", { "hideAfter": 4500 });
                return;
            } else if (characterId === 'calculus') {
                this.showDialogue("Calculus: 'No, no, my boy! *You* must cross the bridge! My shoes are completely ungrounded!'", "calculus", { "hideAfter": 4500 });
                return;
            } else if (characterId === 'snowy') {
                this.playSnowyPuff();
                this.showDialogue("Tintin: 'Snowy's fur is already full of static. Handing him a capacitor would turn him into a walking spark plug.'", "tintin", { "hideAfter": 4500 });
                return;
            } else if (characterId === 'thomson' || characterId === 'thompson') {
                this.showDialogue("Thomson: 'A jar of invisible energy? We prefer our evidence tangible, thank you very much!'", "thomson", { "hideAfter": 4500 });
                return;
            }
        }

        // --- Prevent using inferior items on Haddock's beard ---
        if (characterId === 'haddock' && item.id.includes('rubber_patch')) {
            this.showDialogue("Tintin: 'The rubber patch is far too small to gather a massive charge from his beard. I need an item with a much larger surface area.'", "tintin", { "hideAfter": 5500 });
            return;
        }
        
        if (characterId === 'haddock' && item.id === 'silk_handkerchief') {
            this.showDialogue("Tintin: 'Rubbing silk on his beard would generate static, but the silk can't store a dense charge.'", "tintin", { "hideAfter": 5000 });
            return;
        }

        // --- Humorous Teflon Pan Interactions (Hints) ---
        if (item.id.includes('teflon_pan') && characterId !== 'haddock' && characterId !== 'snowy') {
            if (characterId === 'calculus') {
                this.showDialogue("Calculus: 'Careful with that polymer, my boy! Its electronegativity is immense! We need to forcefully rub it against extreme Keratin!'", "calculus", { "hideAfter": 5500 });
                return;
            } else if (characterId === 'thomson' || characterId === 'thompson') {
                this.showDialogue("Thomson: 'A frying pan? I'm on official business, Tintin, I haven't the time for a fry-up!'", "thomson", { "hideAfter": 4500 });
                return;
            } else if (characterId === 'tintin') {
                this.showDialogue("Tintin: 'My hair isn't coarse enough to generate a strong static charge. I need a thicker, bristly beard.'", "tintin", { "hideAfter": 4500 });
                return;
            }
        }

        if (characterId === 'snowy' && ['teflon_pan', 'rubber_patch', 'silk_handkerchief'].includes(item.id)) {
            this.playSnowyPuff();
            this.showDialogue("Tintin: 'I am not rubbing that on my dog. Besides, Calculus said we need a massive, coarse source of hair to generate enough friction.'", "tintin", { "hideAfter": 4000 });
            return;
        }

        if (characterId === 'haddock' && item.id.includes('teflon_pan')) {

            // GUARD 1: Prevent double-charging the pan
            if (item.id === 'teflon_pan_charged') {
                this.showDialogue("Tintin: 'The pan is already holding a massive static charge. I should transfer it into the Leyden jar before I zap him again.'", "tintin", { "hideAfter": 5000 });
                return; 
            }
            
            // GUARD 2: Prevent unnecessary torture once the jar is full
            if (this.phase === 'CROSS' || this.flags.teflonChargeCount >= 3) {
                this.showDialogue("Tintin: 'The Leyden jar is fully charged! I think the Captain has suffered enough for science.'", "tintin", { "hideAfter": 4500 });
                return;
            }

            // Opening Dialogue
            this.showDialogue("Tintin: 'Hold still, Captain. I just need to borrow some friction...'", "tintin");

            this.inputLocked = true; // Stop the player from clicking away during the sequence

            // --- 1. MAKE TINTIN WALK TO A SAFE SPOT NEAR HADDOCK ---
            // Safely outside the tent polygon (X > 1150)
            const targetX = this.actors.haddock.x - 35; 
            const targetY = this.actors.haddock.y + 30; 
            this.walkTo('tintin', targetX, targetY, 150);

            // Wait for him to arrive using a polling interval
            const arrivalCheck = this.addInterval(() => {
                if (!this.actors.tintin.isMoving) {
                    clearInterval(arrivalCheck);
                    this.hideDialogue();
                    
                    // Force Tintin to face Haddock
                    this.actors.tintin.flip = false; 
                    
                    // --- 2. EQUIP THE PAN ---
                    const rig = this.actors.tintin.rig;
                    let handSocket = rig.bones['socket_hand_r'];

                    // 1. Create socket if it doesn't exist yet
                    if (!handSocket) {
                        handSocket = { id: 'socket_hand_r', parent: 'hand_r', children: [] };
                        rig.bones['socket_hand_r'] = handSocket;
                        if (rig.bones['hand_r']) {
                            rig.bones['hand_r'].children.push('socket_hand_r');
                            rig.sortRenderOrder(); 
                        }
                    }
                    
                    // 2. ALWAYS force the correct visual parameters for the PAN!
                    handSocket.pivotX = 0.5; 
                    handSocket.pivotY = 0.5; 
                    handSocket.baseOffsetX = 0; 
                    handSocket.baseOffsetY = 100; 
                    handSocket.baseRotation = 0;
                    handSocket.offsetX = 10; 
                    handSocket.offsetY = 150; 
                    handSocket.rotation = 90; 
                    handSocket.scaleX = 1.2; 
                    handSocket.scaleY = 1.2; 
                    handSocket.skinScale = 1.8;
                    handSocket.baseZIndex = 50; // Force draw in front!
                    handSocket.currentZIndex = 50;
                    
                    const panAssetId = item.assetId || (this.tuning.itemManifest[item.id] ? this.tuning.itemManifest[item.id].assetId : item.id);
                    if (handSocket) {
                        handSocket.baseAssetId = panAssetId;
                        handSocket.currentAssetId = panAssetId;
                    }

                    // --- 3. PUPPETEER THE ARM TO REACH THE BEARD ---
                    this.actors.tintin.isPuppeteered = true; // Tell the animation controller to back off
                    this.actors.tintin.anim.isPlaying = false; 

                    const upperArm = rig.bones['upper_arm_r'];
                    const lowerArm = rig.bones['lower_arm_r'];
                    
                    // Math to raise his hand to beard level
                    const targetUpperRot = (upperArm ? upperArm.rotation : 0) - 80; 
                    const targetLowerRot = (lowerArm ? lowerArm.rotation : 0) - 65;
            
                    // --- PHASE 1: THE FRICTION BUILD-UP ---
                    let rubTicks = 0;
                    const rubInterval = this.addInterval(() => {
                        rubTicks++;

                        // Procedurally animate Tintin's arm!
                        if (upperArm && lowerArm) {
                            upperArm.rotation = targetUpperRot;
                            // The sine wave creates a rapid, mechanical back-and-forth scrubbing motion
                            lowerArm.rotation = targetLowerRot + Math.sin(rubTicks * 1.5) * 30;
                        }
                        
                        // Vibrate Haddock's head and root to simulate aggressive rubbing
                        this.actors.haddock.rig.bones['root'].rotation = Math.sin(rubTicks) * 4;
                        if (this.actors.haddock.rig.bones['head']) {
                            this.actors.haddock.rig.bones['head'].rotation = Math.cos(rubTicks * 1.5) * 12;
                        }

                        // Friction sparks at beard level
                        if (rubTicks % 2 === 0) {
                            this.spawnParticles('g15_vfx_spark_blue', 
                                this.actors.haddock.x - 25 + Math.random() * 30, 
                                this.actors.haddock.y - 120 + Math.random() * 30, 
                                0.2, 0.3, {
                                    vx: (Math.random() - 0.5) * 300, 
                                    vy: -Math.random() * 150, 
                                    gravity: 400,
                                    vrot: Math.random() * 15
                                }
                            );
                        }
                        this.triggerRefresh();
                    }, 1000 / 30);

                    // --- PHASE 2: THE ZAP ---
                    this.addTimeout(() => {
                        clearInterval(rubInterval); 

                        // --- 2. UNEQUIP THE PAN ---
                        if (handSocket) {
                            handSocket.baseAssetId = 'none';
                            handSocket.currentAssetId = 'none';
                        }

                        // 2. Release Tintin's arm back to the engine
                        this.actors.tintin.isPuppeteered = false;
                        this.actors.tintin.sm.dispatch('PLAY_IDLE');

                        // 3. Shock Haddock                        
                        this.actors.haddock.rig.bones['root'].rotation = 0;
                        if (this.actors.haddock.rig.bones['head']) this.actors.haddock.rig.bones['head'].rotation = 0;
                        this.actors.haddock.sm.dispatch('TRIGGER_ZAP'); 
                        this.triggerHaptic(800); 

                        // CAPTURE START X TO PREVENT THE 'NaN' VANISHING BUG!
                        const startX = this.actors.haddock.x;

                        // 1. Explosive Particle Burst (Smaller sparks!)
                        for (let i = 0; i < 20; i++) {
                            this.spawnParticles('g15_vfx_spark_blue', 
                                this.actors.haddock.x, 
                                this.actors.haddock.y - 130, 
                                Math.random() * 0.2 + 0.1, // Reduced size from 0.4-1.0 down to 0.1-0.3
                                0.6 + Math.random() * 0.4, 
                                {
                                    vx: (Math.random() - 0.5) * 600, 
                                    vy: (Math.random() - 1.0) * 400, 
                                    gravity: 600,
                                    vrot: (Math.random() - 0.5) * 30
                                }
                            );
                        }

                        // 2. Code-Driven Shock Vibration & Knockback
                        let zapTicks = 0;
                        const zapInterval = this.addInterval(() => {
                            zapTicks++;
                            if (zapTicks > 15) { 
                                clearInterval(zapInterval);
                                this.actors.haddock.x = startX; // Snap back to captured X safely
                                if(this.actors.haddock.rig.bones['torso']) this.actors.haddock.rig.bones['torso'].scaleY = 1;
                                return;
                            }
                            
                            // Shake him using startX
                            this.actors.haddock.x = startX + (Math.random() * 12 - 6);
                            
                            if(this.actors.haddock.rig.bones['torso']) {
                                this.actors.haddock.rig.bones['torso'].scaleY = 0.9 + (Math.random() * 0.2); 
                            }
                            this.triggerRefresh();
                        }, 1000 / 30);

                        // Counters and Inventory Logic...
                        if (this.flags.haddockZapCount === undefined) this.flags.haddockZapCount = 0;
                        this.flags.haddockZapCount++;
                        
                        // We should also safely remove the pan using the same logic just in case!
                        if (this.environmentItems.includes(item)) {
                            this.removeEnvironmentItem(item);
                        } else {
                            this.removeInventoryItem(item);
                        }

                        // Give back a freshly charged pan (Just 1 charge now!)
                        this._giveFreshItem('teflon_pan_charged');
                        
                        // Grab the newly added item to inject dynamic states
                        const chargedPan = this.inventory[this.inventory.length - 1];
                        
                        // 3. Apply a vibrant blue CSS glow effect directly to the HTML button
                        if (chargedPan.uiElement) {
                            chargedPan.uiElement.style.boxShadow = "inset 0 0 25px 8px rgba(0, 150, 255, 0.9)";
                            chargedPan.uiElement.style.transition = "box-shadow 0.1s ease-in";
                        }
                        
                        let haddockLine = "Haddock: 'YEEEEOUCH!'";
                        if (this.flags.haddockZapCount === 2) {
                            haddockLine = "Haddock: 'Blistering barnacles! Keep that infernal pan away from my beard!'";
                        } else if (this.flags.haddockZapCount >= 3) {
                            haddockLine = "Haddock: 'Thundering typhoons! Do I look like a lightning rod to you, you bashi-bazouk?!'";
                        }
                        this.showDialogue(haddockLine, "haddock", { "hideAfter": 3000 });
                        
                        this.addTimeout(() => {
                            this.actors.haddock.sm.dispatch('STOP_ZAP');
                            this.inputLocked = false; // Important
                        }, 1500);

                    }, 1200); // 1.2s rub duration

                }
            }, 100); // Check if Tintin has arrived every 100ms

            return; // <- Added Return to stop fallback execution
        }

        // --- Generic Fallback for Character Interactions ---
        // If the player clicks an item on a character and no specific logic catches it,
        // it falls down to here instead of doing nothing!
        const fallbacks = [
            "'I don't think they'd appreciate that.'",
            "'That wouldn't be very polite.'",
            "'I should probably keep this to myself.'",
            "'I don't think that will help them.'"
        ];
        const randomLine = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        this.showDialogue(randomLine, "tintin", { "hideAfter": 2500 });
    }

    startBridgeSequence(jarTypeId) {
        this.inputLocked = true; 

        // Clear any lingering sequences just in case!
        if (this.bridgeInterval) {
            clearInterval(this.bridgeInterval);
        }

        const tintinRig = this.actors.tintin.rig;
        
        // 1. Dynamically create a dedicated belt socket if it doesn't exist
        if (!tintinRig.bones['socket_belt']) {
            tintinRig.bones['socket_belt'] = {
                id: 'socket_belt',
                parent: 'torso',
                pivotX: 0.5, pivotY: 0.5,
                // Adjust these to place it exactly on his belt relative to the torso
                baseOffsetX: 20, baseOffsetY: 120, 
                baseRotation: 0,
                offsetX: 20, offsetY: 180, rotation: 0,
                scaleX: 1, scaleY: 1, skinScale: 0.3, // Make it prominent
                baseAssetId: 'none', currentAssetId: 'none',
                baseZIndex: 15, // High Z-Index to force it to draw in front of his legs
                currentZIndex: 15,
                children: []
            };
            
            // Attach it to the torso so it inherits the walking bounce mathematically
            if (tintinRig.bones['torso']) {
                tintinRig.bones['torso'].children.push('socket_belt');
            }
            tintinRig.sortRenderOrder(); // Register the new bone with the renderer
        }

        const attachmentBone = tintinRig.bones['socket_belt'];
        
        if (attachmentBone) {
            const jarData = this.tuning.itemManifest[jarTypeId];
            let finalAssetId = jarData.assetId;

            // DYNAMIC COMPOSITING: Merge the base and overlay onto a hidden canvas
            if (jarData.overlayAssetId) {
                finalAssetId = jarTypeId + '_composited'; 
                
                if (!this.assetManager.get(finalAssetId)) {
                    const baseImg = this.assetManager.get(jarData.assetId);
                    const overlayImg = this.assetManager.get(jarData.overlayAssetId);
                    
                    if (baseImg && overlayImg) {
                        const offscreenCanvas = document.createElement('canvas');
                        offscreenCanvas.width = baseImg.width || 256;
                        offscreenCanvas.height = baseImg.height || 256;
                        const ctx = offscreenCanvas.getContext('2d');
                        
                        ctx.drawImage(baseImg, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
                        ctx.drawImage(overlayImg, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
                        
                        const originalGet = this.assetManager.get.bind(this.assetManager);
                        this.assetManager.get = (id) => {
                            if (id === finalAssetId) return offscreenCanvas;
                            return originalGet(id);
                        };
                    }
                }
            }
            
            // 2. CRITICAL FIX: Set BOTH base and current IDs so the Animator doesn't erase it
            attachmentBone.baseAssetId = finalAssetId;
            attachmentBone.currentAssetId = finalAssetId;
        }

        this.showDialogue("Here goes nothing! The Static Shuffle!", "tintin", { "hideAfter": 1500 });
        
        const initialSpeed = 60; 
        this.walkTo('tintin', bridgeStartX, bridgeStartY, initialSpeed);

        let phase = 1;

        // Bind to "this" to prevent scope death!
        this.bridgeInterval = this.addInterval(() => {
            const tintin = this.actors.tintin;

            if (phase === 1) {
                if (!tintin.isMoving) {
                    phase = 2;
                    this.walkTo('tintin', bridgeEndX, bridgeEndY, initialSpeed);
                }
            } else if (phase === 2) {
                const progressOnBridge = tintin.x - bridgeStartX;

                // 1. POSITIVE JAR: Immediate, violent failure at the edge
                if (jarTypeId === 'leyden_jar_wired_positive' && tintin.x >= bridgeStartX) {
                    clearInterval(this.bridgeInterval);
                    this.triggerRepelFailure('g15_vfx_spark_red', 200, jarTypeId);
                }
                
                // 2. WEAK JAR: The Struggle Sequence
                else if (jarTypeId === 'leyden_jar_wired_weak' && tintin.x >= bridgeStartX) {
                    
                    // A. Visual Struggle: Random warning sparks bouncing off him
                    if (Math.random() < 0.25) { // 25% chance per frame to spark
                        const sparkX = tintin.x + (Math.random() * 40 - 20);
                        const sparkY = tintin.y - 40 - (Math.random() * 80);
                        this.spawnParticles('g15_vfx_spark_red', sparkX, sparkY);
                    }

                    // B. Cinematic Struggle: Slight camera shake
                    if (this.camera && Math.random() < 0.3) {
                        this.camera.x += (Math.random() * 6 - 3);
                        this.camera.y += (Math.random() * 4 - 2);
                    }

                    // C. Physical Struggle: Dynamically drain his movement speed as he pushes forward
                    // He starts at 60 speed, and it drops drastically the further he goes
                    tintin.moveSpeed = Math.max(5, initialSpeed - (progressOnBridge * 0.45));

                    // D. The Breaking Point: He fails around 120 pixels in (well before the middle)
                    if (progressOnBridge >= 120) {
                        clearInterval(this.bridgeInterval);
                        
                        // Calculate a guaranteed safe landing zone outside the bridge
                        const safeKnockbackDistance = progressOnBridge + 60; 
                        
                        this.triggerRepelFailure('g15_vfx_spark_red', safeKnockbackDistance, jarTypeId);
                    }
                }
                
                // 3. MASTER JAR: Smooth success
                else if (jarTypeId === 'leyden_jar_wired' && tintin.x >= bridgeEndX) {
                    clearInterval(this.bridgeInterval);
                    tintin.isMoving = false; 
                    tintin.path = null;
                    tintin.sm.dispatch('STOP_WALK');
                    this.triggerCelebration();
                    this.showDialogue("'By Jove, you've done it! The bridge is neutralized! Now, let's review our findings in the field journal!'", "calculus", { 
                        "hideAfter": 4000,
                        "onClose": () => this.startQuiz()
                    });
                }
            }
        }, 1000 / 30);
    }

    triggerRepelFailure(sparkVfx, knockbackDistance, failedJarId = null) {
        // --- AGGRESSIVE STATE WIPE ---
        // Ensure the engine completely forgets his previous walking destination
        this.actors.tintin.isMoving = false;
        this.actors.tintin.path = null;
        this.actors.tintin.destX = this.actors.tintin.x;
        this.actors.tintin.destY = this.actors.tintin.y;
        this.actors.tintin.sm.dispatch('TRIGGER_REPEL');
        
        this.spawnParticles(sparkVfx, this.actors.tintin.x, this.actors.tintin.y - 100);
        this.triggerHaptic(600);
        this.showDialogue("Tintin: 'Oof! The charges repelled!'", "tintin");

        const startX = this.actors.tintin.x;
        const currentY = this.actors.tintin.y; 
        
        // Ray-cast the knockback vector
        let safeTargetX = startX;
        const steps = 20; 
        const safetyMargin = 5; 
        
        for (let i = 1; i <= steps; i++) {
            let testX = startX - (knockbackDistance * (i / steps));
            if (!this.navSystem.isWalkable(testX, currentY, safetyMargin)) {
                break; 
            }
            safeTargetX = testX;
        }
        
        const targetX = safeTargetX;
        this.spawnParticles('g15_vfx_dust_cloud', targetX, currentY);
        
        let elapsed = 0;
        const duration = 400; // 400ms physical throw duration

        // Animate the physical knockback
        const knockbackInterval = this.addInterval(() => {
            elapsed += (1000 / 30);
            const progress = Math.min(elapsed / duration, 1);
            
            // Simple ease-out formula so he slows down as he lands
            const easeOut = 1 - Math.pow(1 - progress, 3);
            this.actors.tintin.x = startX - ((startX - targetX) * easeOut);

            this.triggerRefresh();

            if (progress >= 1) {
                clearInterval(knockbackInterval);
                
                // Wait a moment after he lands before resetting him
                this.addTimeout(() => {
                    this.actors.tintin.sm.dispatch('STOP_REPEL');

                    //  Only return items if he was actually equipped with a jar
                    if (failedJarId) {
                        // Remove socketed item securely
                        const attachmentBone = this.actors.tintin.rig.bones['socket_belt'];
                        if (attachmentBone) {
                            attachmentBone.baseAssetId = "none";
                            attachmentBone.currentAssetId = "none";
                        }
                        
                        // Break the failed jar back down into its base components
                        this._giveFreshItem('leyden_jar_uncharged'); 
                        this._giveFreshItem('copper_wire'); 

                        if (failedJarId === 'leyden_jar_wired_positive') {
                            this.showDialogue("Calculus: 'No, no, no! The bridge is Positive, and you brought a Positive jar! Positive repels Positive! We need Negative electrons!'", "calculus", { "hideAfter": 4500 });
                        } else if (failedJarId === 'leyden_jar_wired_weak') {
                            this.showDialogue("Calculus: 'Not enough charge! Silk and rubber only generate a weak field! We need a much stronger Negative source!'", "calculus", { "hideAfter": 4500 });
                        } else {
                            this.showDialogue("Tintin: 'The blast drained the charge and knocked the wire loose!'", "tintin", { "hideAfter": 3000 });
                        }
                    } else {
                        this.showDialogue("Calculus: 'Stop! You must ground yourself to a Negative charge before crossing!'", "calculus", { "hideAfter": 3000 });
                    }
                    
                    this.flags.teflonChargeCount = 0;
                    this.inputLocked = false; 
                }, 1200);
            }
        }, 1000 / 30);
    }

    triggerCelebration() {
        this.triggerHaptic(1000);

        // Humorous Celebratory Banner
        const banner = document.createElement('div');
        banner.className = 'celebration-banner';
        banner.innerHTML = "⚡ SUCCESS! ⚡";
        this.uiRoot.appendChild(banner);
        
        // Clean up the banner after the animation finishes
        setTimeout(() => {
            if (banner) banner.remove();
        }, 3600);

        // Grand Particle Burst
        for (let i = 0; i < 60; i++) {
            this.spawnParticles('g15_vfx_spark_blue',
                this.actors.tintin.x + (Math.random() - 0.5) * 80,
                this.actors.tintin.y - 120 + (Math.random() - 0.5) * 80,
                Math.random() * 0.5 + 0.2, // Size variance
                2.0, // Longer life for celebration
                {
                    vx: (Math.random() - 0.5) * 1000, // Massive horizontal explosion
                    vy: (Math.random() - 1.0) * 800,  // Shoot upwards
                    gravity: 400,
                    vrot: (Math.random() - 0.5) * 30
                }
            );
        }
    }

    triggerEatAnimation() {
        const tintin = this.actors.tintin;
        const rig = tintin.rig;
        
        this.inputLocked = true;
        tintin.isPuppeteered = true;
        tintin.anim.isPlaying = false;
        
        const upperArm = rig.bones['upper_arm_r'];
        const lowerArm = rig.bones['lower_arm_r'];
        const hand = rig.bones['hand_r'];
        const mouth = rig.bones['mouth'];
        
        if (!upperArm || !lowerArm || !hand) return; 

        // --- 1. CREATE DYNAMIC HAND SOCKET ---
        let handSocket = rig.bones['socket_hand_r'];
        
        // Create socket if it doesn't exist yet
        if (!handSocket) {
            handSocket = { id: 'socket_hand_r', parent: 'hand_r', children: [] };
            rig.bones['socket_hand_r'] = handSocket;
            if (rig.bones['hand_r']) {
                rig.bones['hand_r'].children.push('socket_hand_r');
                rig.sortRenderOrder(); // Tell the renderer about the new bone
            }
        }
        
        // ALWAYS force the correct visual parameters for the CHOCOLATE!
        handSocket.pivotX = 0.5; 
        handSocket.pivotY = 0.8; 
        handSocket.baseOffsetX = 20; 
        handSocket.baseOffsetY = 120; 
        handSocket.baseRotation = 20;
        handSocket.offsetX = 20; 
        handSocket.offsetY = 170; 
        handSocket.rotation = 45;
        handSocket.scaleX = 0.9; 
        handSocket.scaleY = 0.9; 
        handSocket.skinScale = 0.9; 
        handSocket.baseZIndex = 10; 
        handSocket.currentZIndex = 10;

        // --- 2. EQUIP THE CHOCOLATE ---
        handSocket.baseAssetId = 'g15_prop_chocolate';
        handSocket.currentAssetId = 'g15_prop_chocolate';

        const startUpperRot = upperArm.rotation;
        const startLowerRot = lowerArm.rotation;
        
        const targetUpperRot = startUpperRot - 70; 
        const targetLowerRot = startLowerRot - 90;

        let elapsed = 0;
        const duration = 400; 

        // STEP 1: Raise the hand to the mouth
        const raiseInterval = this.addInterval(() => {
            elapsed += (1000 / 30);
            let progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            
            upperArm.rotation = startUpperRot + (targetUpperRot - startUpperRot) * ease;
            lowerArm.rotation = startLowerRot + (targetLowerRot - startLowerRot) * ease;
            
            this.triggerRefresh();

            if (progress >= 1) {
                clearInterval(raiseInterval);
                
                // STEP 2: The "Chew" 
                let chewTicks = 0;
                const chewInterval = this.addInterval(() => {
                    chewTicks++;
                    
                    if (mouth) {
                        mouth.scaleY = (chewTicks % 2 === 0) ? 0.4 : 1.6;
                    }
                    this.triggerRefresh();
                    
                    if (chewTicks >= 6) { 
                        clearInterval(chewInterval);
                        if (mouth) mouth.scaleY = 1.0; 
                        
                        // --- 3. SWAP CHOCOLATE FOR FOIL WRAPPER ---
                        handSocket.baseAssetId = 'g15_prop_foil';
                        handSocket.currentAssetId = 'g15_prop_foil';
                        
                        // STEP 3: Lower the arm back to the resting position
                        let dropElapsed = 0;
                        const dropInterval = this.addInterval(() => {
                            dropElapsed += (1000 / 30);
                            let dropProgress = Math.min(dropElapsed / duration, 1);
                            
                            upperArm.rotation = targetUpperRot + (startUpperRot - targetUpperRot) * dropProgress;
                            lowerArm.rotation = targetLowerRot + (startLowerRot - targetLowerRot) * dropProgress;
                            
                            this.triggerRefresh();
                            
                            if (dropProgress >= 1) {
                                clearInterval(dropInterval);
                                
                                // --- 4. CLEAR THE HAND SOCKET ---
                                handSocket.baseAssetId = 'none';
                                handSocket.currentAssetId = 'none';

                                tintin.isPuppeteered = false;
                                this.inputLocked = false;
                                tintin.sm.dispatch('PLAY_IDLE');

                                this._giveFreshItem('foil_wrapper');
                                this.showDialogue("A sugar rush, and now I have a sheet of metal foil.", "tintin");
                            }
                        }, 1000 / 30);
                    }
                }, 150); 
            }
        }, 1000 / 30);
    }

    playSnowyPuff() {
        const snowy = this.actors.snowy;
        if (!snowy || !snowy.rig) return;

        let elapsed = 0;
        const duration = 400; // Sped up the puff slightly
        const originalScaleX = snowy.rig.bones['root'].scaleX || 1;
        const originalScaleY = snowy.rig.bones['root'].scaleY || 1;

        const puffInterval = this.addInterval(() => {
            elapsed += (1000 / 30);
            let progress = Math.min(elapsed / duration, 1);
            
            // 1. Smooth Squash & Stretch (No random jitter!)
            // Expands horizontally by 15% and squashes vertically by 10%
            const bulgeX = Math.sin(progress * Math.PI) * 0.15; 
            const bulgeY = Math.sin(progress * Math.PI) * -0.10; 
            
            snowy.rig.bones['root'].scaleX = originalScaleX + bulgeX;
            snowy.rig.bones['root'].scaleY = originalScaleY + bulgeY;

            // 2. Smaller, subtle dust particles
            if (Math.random() > 0.5) {
                this.spawnParticles('g15_vfx_dust_cloud', 
                    snowy.x + (Math.random() * 20 - 10), 
                    snowy.y - 15 - Math.random() * 20, 
                    Math.random() * 0.15 + 0.05, // Drastically smaller (5% to 20% scale)
                    0.5, // Shorter life
                    {
                        vx: (Math.random() - 0.5) * 80, 
                        vy: -Math.random() * 40 - 20,
                        gravity: 40,
                        vrot: (Math.random() - 0.5) * 2
                    }
                );
            }

            this.triggerRefresh();

            // Cleanup when done
            if (progress >= 1) {
                clearInterval(puffInterval);
                snowy.rig.bones['root'].scaleX = originalScaleX;
                snowy.rig.bones['root'].scaleY = originalScaleY;
                this.triggerRefresh();
            }
        }, 1000 / 30);
    }

    spawnParticles(vfxId, x, y, scale = 1.0, duration = 1.0, options = {}) {
        this.activeParticles.push({
            id: vfxId, 
            x: x, 
            y: y,
            life: duration, 
            maxLife: duration,
            scale: scale,
            vx: options.vx || 0,        // X Velocity
            vy: options.vy || 0,        // Y Velocity
            gravity: options.gravity !== undefined ? options.gravity : 500, // Downward pull
            rotation: options.rotation || 0,
            vrot: options.vrot || 0     // Rotational velocity
        });
        this.triggerRefresh();
    }

    applyDepthScaling(actor) {
        // The Y coordinate where the ground meets the background (furthest point)
        const horizonY = 350; 
        // The Y coordinate closest to the camera
        const foregroundY = 768; 
        
        // Define how much characters should shrink at the horizon (0.08 / 0.15 is roughly 53%)
        const horizonShrinkFactor = 0.533; 
    
        const clampedY = Math.max(horizonY, Math.min(foregroundY, actor.y));
        const depthRatio = (clampedY - horizonY) / (foregroundY - horizonY);
        
        // Calculate the current multiplier (from ~0.533 at horizon to 1.0 at foreground)
        const currentShrinkFactor = horizonShrinkFactor + ((1.0 - horizonShrinkFactor) * depthRatio);
        
        // Apply depth correctly relative to their unique base scale
        actor.scale = actor.baseScale * currentShrinkFactor;
    }

    walkTo(actorId, targetX, targetY, speed = 150) {
        const actor = this.actors[actorId];
        if (!actor) return;

        // Ask the component to generate the path!
        actor.path = this.navSystem.findPath(actor.x, actor.y, targetX, targetY, 5);
        actor.pathIndex = 1; 
        actor.moveSpeed = speed;
        actor.isMoving = true;

        this.setNextWaypoint(actor);
        actor.sm.dispatch('TRIGGER_WALK');
    }

    setNextWaypoint(actor) {
        if (actor.path && actor.pathIndex < actor.path.length) {
            const nextPt = actor.path[actor.pathIndex];
            actor.destX = nextPt.x;
            actor.destY = nextPt.y;
            
            // Automatically flip the rig based on the new segment
            if (actor.destX < actor.x) actor.flip = true;
            else if (actor.destX > actor.x) actor.flip = false;
        } else {
            // Reached final destination
            actor.isMoving = false;
            actor.path = null;
            actor.sm.dispatch('STOP_WALK');
        }
    }

    // --- VECTOR MOVEMENT LOGIC ---
    updateActorMovement(dt, actor) {
        let needsRedraw = false;
        if (actor.isMoving) {
            const dx = actor.destX - actor.x;
            const dy = actor.destY - actor.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // NEW: If within 5 pixels, snap to target and advance the waypoint!
            if (distance < 5) {
                actor.x = actor.destX;
                actor.y = actor.destY;
                actor.pathIndex++;
                this.setNextWaypoint(actor);
            } else {
                // Calculate how far to step this frame
                const moveDist = actor.moveSpeed * dt;
                
                // Normalize the vector and apply the step
                const ratio = moveDist / distance;
                actor.x += dx * ratio;
                actor.y += dy * ratio;

                // EXISTING: Bridge Trap check
                if (actor === this.actors.tintin && actor.x >= bridgeStartX && !this.inputLocked) {
                    actor.isMoving = false;
                    actor.path = null;
                    actor.sm.dispatch('STOP_WALK');
                    this.inputLocked = true;
                    
                    this.showDialogue("Tintin: 'Yikes! The static charge is too strong!'", "tintin");
                    this.triggerRepelFailure('g15_vfx_spark_red', 200, null); 
                }
            }
            needsRedraw = true;
        }
        return needsRedraw;
    }
   

    // ==========================================
    // INVENTORY MANAGEMENT UPGRADES
    // ==========================================

    /**
     * Guarantees a fresh, clickable UI element by cloning the manifest data
     * and wiping any old DOM references before adding it to the inventory.
     */
    _giveFreshItem(itemId) {
        const template = this.tuning.itemManifest[itemId] || this.tuning.items.find(i => i.id === itemId);
        if (!template) {
            console.warn(`Missing definition for ${itemId}`);
            return;
        }
        const freshClone = { ...template };
        delete freshClone.uiElement; 
        this.addInventoryItem(freshClone);
    }

    removeAndReplace(itemA, itemB, newItemId) {
        // Check origin of itemA and remove accordingly
        if (this.environmentItems.includes(itemA)) {
            this.removeEnvironmentItem(itemA);
        } else {
            this.removeInventoryItem(itemA);
        }
        
        // Check origin of itemB and remove accordingly
        if (this.environmentItems.includes(itemB)) {
            this.removeEnvironmentItem(itemB);
        } else {
            this.removeInventoryItem(itemB);
        }
        
        // Spawn the new combined item using your fresh item generator
        this._giveFreshItem(newItemId); 
    }

    addInventoryItem(itemData) {
        // 1. Let the base class build the standard inventory item and UI element
        super.addInventoryItem(itemData);
        
        // 2. Grab the item we just added to inject the overlay
        const addedItem = this.inventory[this.inventory.length - 1];
        
        if (addedItem && addedItem.uiElement && addedItem.overlayAssetId) {
            // Ensure the parent slot can anchor the overlay
            addedItem.uiElement.style.position = 'relative';
            
            const overlayImg = document.createElement('img');
            const loadedAsset = this.assetManager.get(addedItem.overlayAssetId);
            
            if (loadedAsset) {
                overlayImg.src = loadedAsset.src;
                overlayImg.style.position = 'absolute';
                overlayImg.style.top = '0';
                overlayImg.style.left = '0';
                overlayImg.style.width = '100%';
                overlayImg.style.height = '100%';
                overlayImg.style.pointerEvents = 'none'; // Clicks pass through to the slot underneath
                
                addedItem.uiElement.appendChild(overlayImg);
            }
        }
    }

    handleItemCursorHover(dt) {
        if (this.input && this.canvas) {
            const worldX = this.input.x + this.camera.x;
            const worldY = this.input.y + this.camera.y;
            let isHovering = false;

            // 1. Check Environment Items First (With Padding!)
            const hoverPadding = 30;
            for (const item of this.environmentItems) {
                if (worldX >= (item.x - hoverPadding) && worldX <= (item.x + item.w + hoverPadding) &&
                    worldY >= (item.y - hoverPadding) && worldY <= (item.y + item.h + hoverPadding)) {
                    isHovering = true;
                    break;
                }
            }

            // 2. Check Characters Second
            if (!isHovering) {
                for (const [id, actor] of Object.entries(this.actors)) {
                    if (worldX >= actor.x - actor.w/2 && worldX <= actor.x + actor.w/2 &&
                        worldY >= actor.y - actor.h && worldY <= actor.y) {
                        isHovering = true;
                        break;
                    }
                }
            }

            // Apply standard CSS pointer if an interaction is available
            this.canvas.style.cursor = isHovering ? 'pointer' : 'default';
        }
    }

    // ==========================================
    // QUIZ
    // ==========================================

    startQuiz() {
        if (this.canvas) this.canvas.style.cursor = 'default';
        this.inputLocked = true;
        
        // Freeze the game engine loop
        this.phase = 'QUIZ'; 

        const verbBank = document.querySelector('.verb-bank');
        const invGrid = document.querySelector('.inventory-grid');
        const skipBtn = document.querySelector('.secondary-btn');
        if (verbBank) verbBank.style.setProperty('display', 'none', 'important');
        if (invGrid) invGrid.style.setProperty('display', 'none', 'important');
        if (skipBtn) skipBtn.style.setProperty('display', 'none', 'important');

        this.triggerRefresh(); // Force the black canvas clear
        
        // Grab questions from the loaded tuning data
        const questions = this.tuning.questions || [];
        if (questions.length > 0) {
            this.runQuizSequence(questions, 0);
        } else {
            this.win(); // Fallback if missing
        }
    }

    runQuizSequence(questions, qIndex) {
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
                    this.runQuizSequence(questions, qIndex + 1);
                } else {
                    this.triggerHaptic(50);
                }
            }
        }));

        const bgImgAsset = this.assetManager.get('ui_journal_bg');

        // Launch the UI, using keepOpenOnWrong for educational retries
        this.quizUI.show(mappedOptions, bgImgAsset?.src, { keepOpenOnWrong: true });

        // Mobile Landscape Scroll Fix
        if (this.quizUI.overlayElement) {
            // 1. Create the scrolling container
            const scrollWrapper = document.createElement('div');
            scrollWrapper.className = 'quiz-scroll-wrapper';

            // 2. Move all the dynamically generated buttons into our scroll wrapper
            while (this.quizUI.overlayElement.firstChild) {
                scrollWrapper.appendChild(this.quizUI.overlayElement.firstChild);
            }

            // 3. Create and prepend the Title Header
            const qTitle = document.createElement('h2');
            qTitle.innerText = qData.text;
            qTitle.className = 'quiz-header';
            scrollWrapper.insertBefore(qTitle, scrollWrapper.firstChild);

            // 4. Re-attach the wrapped content to the main overlay
            this.quizUI.overlayElement.appendChild(scrollWrapper);
        }
    }
          

    // ==========================================
    // RENDER LOOP & CLEANUP
    // ==========================================

    update(dt) {
        this.handleItemCursorHover(dt);

        // If the quiz is active, completely halt the game loop!
        // No character updates, no physics, no rendering redraws.
        if (this.phase === 'QUIZ') return;

        let needsRedraw = false;
        
        // Initialize our diagnostic tracker
        if (!this.debugRedrawReasons) this.debugRedrawReasons = new Set();
        this.debugRedrawReasons.clear(); 

        // --- GLOBAL CULLING HELPER ---
        // Checks if an object is inside the camera view (with a 150px safety buffer)
        const checkVisibility = (objX, objW) => {
            return (objX + objW / 2 >= this.camera.x - 150) && 
                   (objX - objW / 2 <= this.camera.x + this.camera.viewportWidth + 150);
        };

        // --- TWIN VIBRATION LOGIC ---
        ['thomson', 'thompson'].forEach(id => {
            const twin = this.actors[id];
            if (twin && twin.baseX) {
                if (checkVisibility(twin.baseX, twin.w)) {
                    twin.x = twin.baseX + (Math.random() * 3 - 1.5);
                    twin.y = twin.baseY + (Math.random() * 3 - 1.5);
                    needsRedraw = true; 
                    this.debugRedrawReasons.add(`Vibration: ${id}`);
                } else {
                    twin.x = twin.baseX;
                    twin.y = twin.baseY;
                }
            }
        });

        // --- ACTOR MOVEMENT & ANIMATION (HEAVILY OPTIMIZED) ---
        Object.entries(this.actors).forEach(([id, actor]) => {
            this.applyDepthScaling(actor);
            
            // Check if this specific character is currently on-screen
            const isVisible = checkVisibility(actor.x, actor.w);

            // 1. Always process movement (so off-screen characters can walk into view)
            if (this.updateActorMovement(dt, actor)) {
                // BUT only force a screen redraw if they are actually visible!
                if (isVisible) {
                    needsRedraw = true;
                    this.debugRedrawReasons.add(`Movement: ${id}`);
                }
            }

            // 2. Always process animations (so timers/states don't desync)
            if (actor.anim && actor.anim.isPlaying) {
                const animChanged = actor.anim.update(dt);
                // BUT only force a screen redraw if the camera can see them!
                if (animChanged && isVisible) {
                    needsRedraw = true;
                    this.debugRedrawReasons.add(`Animation: ${id}`);
                }
            }
        });

        // --- PARTICLES (UPGRADED PHYSICS) ---
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            let p = this.activeParticles[i];
            p.life -= dt;
            
            // Apply Code-Driven Physics
            if (p.vx) p.x += p.vx * dt;
            if (p.vy || p.gravity) {
                p.y += p.vy * dt;
                p.vy += p.gravity * dt; // Apply gravity over time
            }
            if (p.vrot) p.rotation += p.vrot * dt;

            if (p.life <= 0) {
                this.activeParticles.splice(i, 1);
            } else if (checkVisibility(p.x, 50)) {
                needsRedraw = true; 
                this.debugRedrawReasons.add(`Particles Active`); 
            }
        }

        // --- RESTORED: AUTO-CAMERA TRACKING WITH DEADZONE ---
        const player = this.actors.tintin;
        if (player) {
            const screenX = player.x - this.camera.x;
            const screenY = player.y - this.camera.y;

            const deadzoneLeft = this.camera.viewportWidth * 0.4;    
            const deadzoneRight = this.camera.viewportWidth * 0.6;   
            const deadzoneTop = this.camera.viewportHeight * 0.4;    
            const deadzoneBottom = this.camera.viewportHeight * 0.55; 

            if (screenX < deadzoneLeft) {
                this.camera.targetX = player.x - deadzoneLeft;
            } else if (screenX > deadzoneRight) {
                this.camera.targetX = player.x - deadzoneRight;
            }

            if (screenY < deadzoneTop) {
                this.camera.targetY = player.y - deadzoneTop;
            } else if (screenY > deadzoneBottom) {
                this.camera.targetY = player.y - deadzoneBottom;
            }

            this.camera.targetX = Math.max(0, Math.min(this.camera.targetX, this.camera.maxScrollX));
            this.camera.targetY = Math.max(0, Math.min(this.camera.targetY, this.camera.maxScrollY));
        }

        // --- CAMERA LERP (SMOOTH PANNING) ---
        if (Math.abs(this.camera.targetX - this.camera.x) > 0.5 || 
            Math.abs(this.camera.targetY - this.camera.y) > 0.5) {
            
            this.camera.x += (this.camera.targetX - this.camera.x) * 5 * dt;
            this.camera.y += (this.camera.targetY - this.camera.y) * 5 * dt;
            needsRedraw = true;
            this.debugRedrawReasons.add('Camera Panning'); 
        } else {
            this.camera.x = this.camera.targetX; 
            this.camera.y = this.camera.targetY; 
        }

        // --- FINAL DRAW TRIGGER ---
        if (needsRedraw) this.triggerRefresh();
    }


    draw(ctx) {
        // Clear screen to black during the quiz
        if (this.phase === 'QUIZ') {
            // Reset any transforms just in case, then paint black
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            return; // Exit immediately so nothing else draws!
        }

        ctx.save();

        // Translate the canvas context by both X and Y camera offsets
        ctx.translate(-this.camera.x, -this.camera.y);

        const bg = this.assetManager.get('g15_bg_panorama');
        if (bg) ctx.drawImage(bg, 0, 0);

        this.environmentItems.forEach(item => {
            const img = this.assetManager.get(item.assetId);
            if (img) ctx.drawImage(img, item.x, item.y, item.w, item.h);
        });

        const pithStationItem = this.environmentItems.find(i => i.id === 'pith_station');
        if (pithStationItem) {
            const pithBall = this.assetManager.get(this.pithBallState);
            if (pithBall)
                ctx.drawImage(pithBall, pithStationItem.x, pithStationItem.y, 100, 100);
        }

        // --- STABLE DEPTH SORTING ---
        // Sort based on their stable baseY if it exists, otherwise fallback to standard y.
        // This prevents Z-fighting when characters vibrate or bounce on the same Y plane.
        const sortedActors = Object.values(this.actors).sort((a, b) => {
            const yA = a.baseY !== undefined ? a.baseY : a.y;
            const yB = b.baseY !== undefined ? b.baseY : b.y;
            return yA - yB;
        });

        sortedActors.forEach(actor => {
            if (actor.rig) actor.rig.draw(ctx, this.assetManager, actor.x, actor.y, actor.flip, actor.scale);

            // --- DEBUG HITBOXES ---
            // Draw this to verify the clickable area perfectly covers the character
            if (showDebug) {
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)'; // Transparent green
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    actor.x - actor.w / 2, // Left edge
                    actor.y - actor.h,     // Top edge
                    actor.w,               // Full width
                    actor.h                // Full height
                );
                
                // Draw a small crosshair at the root anchor (x, y)
                ctx.fillStyle = 'red';
                ctx.fillRect(actor.x - 2, actor.y - 2, 4, 4);

                if (actor.path && actor.path.length > 0 && actor.isMoving) {
                    // Draw the line connecting the waypoints
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // Yellow line
                    ctx.lineWidth = 3;
                    
                    ctx.moveTo(actor.x, actor.y); // Line starts from Tintin
                    
                    // Draw line to current destination, then to all future waypoints
                    for (let i = actor.pathIndex; i < actor.path.length; i++) {
                        ctx.lineTo(actor.path[i].x, actor.path[i].y);
                    }
                    ctx.stroke();

                    // Draw bright cyan dots at the exact corners/waypoints
                    ctx.fillStyle = 'cyan';
                    actor.path.forEach(pt => {
                        ctx.beginPath();
                        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
                        ctx.fill();
                    });
                }
            }
            // ----------------------
        });

        if (showDebug) {
            // 1. Draw all active Nav Mesh Polygons
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 1;
            
            this.navSystem.polygons.forEach(poly => {
                if (poly.length < 3) return;
                ctx.beginPath();
                ctx.moveTo(poly[0].x, poly[0].y);
                for (let i = 1; i < poly.length; i++) {
                    ctx.lineTo(poly[i].x, poly[i].y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            });

            // 2. Draw the Polygon currently being plotted
            if (this.currentDebugPolygon && this.currentDebugPolygon.length > 0) {
                ctx.strokeStyle = 'rgba(0, 150, 255, 0.9)'; // Bright blue lines
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(this.currentDebugPolygon[0].x, this.currentDebugPolygon[0].y);
                
                for (let i = 1; i < this.currentDebugPolygon.length; i++) {
                    ctx.lineTo(this.currentDebugPolygon[i].x, this.currentDebugPolygon[i].y);
                }
                ctx.stroke(); // Don't close the path yet!
                
                // Draw dots at the vertices
                ctx.fillStyle = 'cyan';
                this.currentDebugPolygon.forEach(pt => {
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                });
            }
        }

        this.activeParticles.forEach(p => {
            const img = this.assetManager.get(p.id);
            if (img) {
                ctx.save(); // Save canvas state for rotational math
                ctx.globalAlpha = Math.max(0, p.life / p.maxLife); 
                
                const drawWidth = img.width * (p.scale || 1.0);
                const drawHeight = img.height * (p.scale || 1.0);
                
                // Move context to particle center, rotate, draw, then restore
                ctx.translate(p.x, p.y);
                if (p.rotation) ctx.rotate(p.rotation);
                
                ctx.drawImage(img, -drawWidth/2, -drawHeight/2, drawWidth, drawHeight);
                ctx.restore(); // Clean up transform
            }
        });

        // Restore context so UI draws perfectly in place on the screen!
        ctx.restore(); // Reset the canvas transform

        // --- NEW: DIAGNOSTIC HUD ---
        if (showDebug && this.debugRedrawReasons && this.debugRedrawReasons.size > 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(210, 100, 250, 30 + (this.debugRedrawReasons.size * 20));
            
            ctx.fillStyle = 'lime';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`Redraw Triggers (${this.debugRedrawReasons.size}):`, 220, 130);
            
            let i = 0;
            ctx.fillStyle = 'white';
            ctx.font = '12px monospace';
            this.debugRedrawReasons.forEach(reason => {
                ctx.fillText(`- ${reason}`, 220, 150 + (i * 20));
                i++;
            });
        }
    }

    destroy() {
        // Restore the Engine UI Elements
        const verbBank = document.querySelector('.verb-bank');
        const invGrid = document.querySelector('.inventory-grid');
        const skipBtn = document.querySelector('.secondary-btn');
        if (verbBank) verbBank.style.removeProperty('display');
        if (invGrid) invGrid.style.removeProperty('display');
        if (skipBtn) skipBtn.style.removeProperty('display');

        // 1. Clean up DOM Elements
        if (this.styleElement) this.styleElement.remove();
        
        // 2. Clear all Timers
        this.activeIntervals.forEach(clearInterval);
        this.activeTimeouts.forEach(clearTimeout);
        this.activeIntervals = [];
        this.activeTimeouts = [];

        // 3. Purge Dynamically Created Composites from Memory
        const dynamicAssetIds = [
            'leyden_jar_wired_composited', 
            'leyden_jar_wired_positive_composited', 
            'leyden_jar_wired_weak_composited'
        ];
        
        dynamicAssetIds.forEach(id => {
            // If we generated this custom canvas, explicitly delete it from the cache
            if (this.assetManager && this.assetManager.assets && this.assetManager.assets[id]) {
                delete this.assetManager.assets[id];
            }
        });

        // 4. Release large memory objects for Javascript Garbage Collection
        this.activeParticles = [];
        this.obstacles = [];
        this.environmentItems = [];
        this.actors = {}; 

        // Cleanup Quiz UI
        if (this.quizUI) this.quizUI.remove();

        // 5. Fire parent cleanup
        super.destroy();
    }
}
