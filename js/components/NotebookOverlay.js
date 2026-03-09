/* =========================================
   js/components/NotebookOverlay.js
   The Hub / Level Select Menu
   ========================================= */

export class NotebookOverlay {
    constructor(uiRoot, stateManager, tuning, gameManifest, onLaunchGame) {
        this.uiRoot = uiRoot;
        this.stateManager = stateManager;
        this.tuning = tuning;
        this.gameManifest = gameManifest;
        this.onLaunchGame = onLaunchGame; 
        
        this.overlay = null;
        this.injectCSS();
    }

    injectCSS() {
        if (document.getElementById('notebook-css')) return;
        const style = document.createElement('style');
        style.id = 'notebook-css';
        style.innerHTML = `
            #notebook-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex; justify-content: center; align-items: center;
                z-index: 9000;
                backdrop-filter: blur(5px);
                opacity: 0; transition: opacity 0.3s ease;
            }
            #notebook-overlay.show { opacity: 1; }
            
            .notebook-container {
                background: #FDFBF7; 
                width: 85%; max-width: 800px; height: 80%; max-height: 600px;
                border-radius: 8px 16px 16px 8px; border: 4px solid #3E2723;
                box-shadow: 15px 15px 0 rgba(0,0,0,0.4), inset 20px 0 0 rgba(0,0,0,0.05);
                display: flex; flex-direction: column;
                position: relative; overflow: hidden;
                transform: scale(0.9) translateY(20px); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                /* Spiral binding effect */
                border-left: 25px solid #1A1A1A;
            }
            #notebook-overlay.show .notebook-container { transform: scale(1) translateY(0); }

            .notebook-header {
                background: #D32F2F; color: white; padding: 15px;
                text-align: center; font-family: "Comic Sans MS", fantasy, sans-serif;
                font-size: 26px; font-weight: bold; letter-spacing: 2px;
                border-bottom: 4px solid #1A1A1A;
                text-shadow: 2px 2px 0 #1A1A1A;
            }
            .notebook-close {
                position: absolute; top: 10px; right: 15px;
                background: none; border: none; color: white;
                font-size: 36px; cursor: pointer; font-weight: bold;
                line-height: 1; text-shadow: 2px 2px 0 #1A1A1A;
            }
            .notebook-close:hover { color: #FBC02D; }

            .notebook-grid {
                display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                gap: 20px; padding: 25px 20px 25px 35px; overflow-y: auto; flex-grow: 1;
                /* Subtle lined paper background */
                background-image: linear-gradient(transparent 95%, #E0E0E0 5%);
                background-size: 100% 30px;
            }
            .notebook-entry {
                background: #FFF; border: 2px dashed #BCAAA4; border-radius: 8px;
                padding: 15px; text-align: center; cursor: pointer;
                transition: transform 0.15s, box-shadow 0.15s;
                position: relative;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.05);
            }
            .notebook-entry:hover {
                transform: translateY(-4px) rotate(-1deg); box-shadow: 0 8px 15px rgba(0,0,0,0.15);
                border-color: #8D6E63; border-style: solid;
            }
            .entry-title {
                font-family: sans-serif; font-weight: bold; color: #3E2723;
                font-size: 16px; margin-bottom: 15px; text-transform: capitalize;
            }
            .entry-stamp {
                font-family: "Comic Sans MS", fantasy, sans-serif; font-size: 20px; font-weight: bold;
                padding: 4px 12px; border-radius: 6px; display: inline-block;
                transform: rotate(-12deg); box-shadow: inset 0 0 0 3px rgba(255,255,255,0.5);
            }
            .stamp-solved { color: #4CAF50; border: 4px solid #4CAF50; background: rgba(76, 175, 80, 0.1); }
            .stamp-todo { color: #FF9800; border: 4px solid #FF9800; background: rgba(255, 152, 0, 0.1); opacity: 0.8; transform: rotate(5deg); }
        `;
        document.head.appendChild(style);
    }

    formatTitle(id) {
        // Safety check just in case an ID is missing
        if (!id) return "Unknown Record"; 
        return id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    playPaperSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            
            // Create a short burst of white noise
            const bufferSize = ctx.sampleRate * 0.15; // 150ms duration
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1; // White noise
            }
            
            const noiseSource = ctx.createBufferSource();
            noiseSource.buffer = buffer;
            
            // Apply a volume envelope to shape the noise into a "swish/rustle"
            const gainNode = ctx.createGain();
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05); // Quick attack
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15); // Fade out
            
            // Filter out harsh high frequencies to make it sound like thick paper
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 2500;
            
            noiseSource.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            noiseSource.start();
        } catch (e) {
            console.log("Audio context not ready for paper sound.");
        }
    }

    show() {
        if (this.overlay) this.overlay.remove();

        // Trigger the visual flair sound!
        this.playPaperSound();

        this.overlay = document.createElement('div');
        this.overlay.id = 'notebook-overlay';

        let gridHTML = '';
        const uniqueGames = [];

        this.gameManifest.forEach(gameDef => {
            const tasks = gameDef.sequence || [{ moduleId: gameDef.game_module_id, levelId: gameDef.level_id }];
            
            tasks.forEach(task => {
                if (!task.moduleId) return; 
                // --- FIX A: Exclude the endless runner from the notebook ---
                if (task.moduleId === 'snowy_runner') return; 
                
                const isDuplicate = uniqueGames.some(g => g.moduleId === task.moduleId && g.levelId === task.levelId);
                if (!isDuplicate) {
                    uniqueGames.push(task);
                }
            });
        });

        uniqueGames.forEach(game => {
            const moduleId = game.moduleId;
            const levelId = game.levelId;
            const title = this.formatTitle(moduleId);
            
            const isComplete = this.stateManager.isGameComplete(moduleId, levelId);
            const stampClass = isComplete ? 'stamp-solved' : 'stamp-todo';
            const stampText = isComplete ? 'SOLVED' : 'TO DO';

            gridHTML += `
                <div class="notebook-entry" data-module="${moduleId}" data-level="${levelId}">
                    <div class="entry-title">${title}</div>
                    <div class="entry-stamp ${stampClass}">${stampText}</div>
                </div>
            `;
        });

        this.overlay.innerHTML = `
            <div class="notebook-container">
                <button class="notebook-close" title="Close">×</button>
                <div class="notebook-header">
                    FIELD NOTES
                </div>
                <div class="notebook-grid">
                    ${gridHTML}
                </div>
            </div>
        `;

        this.overlay.querySelector('.notebook-close').addEventListener('click', () => this.hide());
        
        const entries = this.overlay.querySelectorAll('.notebook-entry');
        entries.forEach(entry => {
            entry.addEventListener('click', () => {
                const modId = entry.getAttribute('data-module');
                const lvlId = entry.getAttribute('data-level');
                this.hide();
                this.onLaunchGame(modId, lvlId);
            });
        });

        document.body.appendChild(this.overlay);
        
        void this.overlay.offsetWidth;
        this.overlay.classList.add('show');
    }


    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('show');
            setTimeout(() => {
                if (this.overlay) {
                    this.overlay.remove();
                    this.overlay = null;
                }
            }, 300); // Wait for CSS transition
        }
    }
}
