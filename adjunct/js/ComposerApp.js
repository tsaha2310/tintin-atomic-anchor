/* =========================================
   js/ComposerApp.js
   Sprite Composer Playground
   Modularized, Precision-Fixed, Animation Timeline
   ========================================= */

class SpriteComposer {
    constructor() {
        this.canvas = document.getElementById('composer-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.assets = {};
        this.selectedBoneId = null;
        this.renderOrder = []; 
        this.zoomLevel = 1.0;
        this.cameraX = 0;
        this.cameraY = 0;
        this.needsRedraw = true;

        // Mouse Drag State
        this.isDraggingBone = false;
        this.isPanning = false;
        this.dragStart = { x: 0, y: 0 };
        this.initialOffset = { x: 0, y: 0 };
        this.initialCamera = { x: 0, y: 0 };

        // Undo/Redo State Machine
        this.history = [];
        this.historyIndex = -1;

        // Animation Timeline State
        this.anim = {
            isPlaying: false,
            currentFrame: 0,
            maxFrames: 60,
            fps: 30,
            lastTime: 0,
            keyframes: {} // Maps frameIndex -> Rig Pose Snapshot
        };

        this.initDefaultRig();
        this.init();
    }

    initDefaultRig() {
        const def = { offsetX: 0, offsetY: 0, pivotX: 0.5, pivotY: 0.5, rotation: 0, scaleX: 1.0, scaleY: 1.0, 
            assetId: "none", zIndex: 0, defaultOffsetX: 0, defaultOffsetY: 0, defaultRotation: 0, defaultAssetId: "none" };
        const rawRig = {
            "root":        { parent: null, pivotX: 0.5, pivotY: 1.0 },
            "torso":       { parent: "root", assetId: "ch_tintin_side_torso" }
        };

        this.rig = {};
        for (const [id, data] of Object.entries(rawRig)) {
            this.rig[id] = { id, ...def, ...data };
        }
    }

    async init() {
        this.injectAllUI();
        await this.loadAssets();
        
        this.buildHierarchyUI();
        this.bindAllEvents();

        await this.loadLocalEnv();

        this.saveState(); // Save initial state for Undo/Reset
        requestAnimationFrame((t) => this.renderLoop(t));
    }

    async loadLocalEnv() {
        try {
            // Append a timestamp to prevent the browser from caching this config file
            const res = await fetch(`../local_env.json?t=${new Date().getTime()}`);
            if (!res.ok) return; // Silent fail if the file doesn't exist (e.g., in production)
            
            const env = await res.json();
            
            if (env.workspace) {
                this.logOutput("⚙️ Found local_env.json. Auto-loading workspace...");
                
                if (env.workspace.rig) {
                    const rigRes = await fetch('../'+env.workspace.rig);
                    if (rigRes.ok) this.processImportedJSON(await rigRes.text());
                }
                if (env.workspace.skin) {
                    const skinRes = await fetch('../'+env.workspace.skin);
                    if (skinRes.ok) this.processImportedSkinJSON(await skinRes.text());
                }
                if (env.workspace.anim) {
                    const animRes = await fetch('../'+env.workspace.anim);
                    if (animRes.ok) this.processImportedAnimJSON(await animRes.text());
                }

                setTimeout( this.hideConsole, 1000 );
            }
        } catch (err) {
            console.warn("No local_env.json found or failed to parse. Proceeding with default state.");
        }
    }

    // ==========================================
    // 1. UI INJECTION (MODULARIZED)
    // ==========================================
    injectAllUI() {
        this.injectHierarchyToolbar();
        this.injectInspectorExtensions();
        this.injectConsole();
        this.injectModals();
        this.injectTimelineUI();
    }

    injectHierarchyToolbar() {
        const rigHeader = document.querySelector('#hierarchy-panel .panel-header');
        if (!rigHeader || document.getElementById('btn-undo')) return;

        const toolbarHtml = `
        <div style="display: flex; gap: 5px; margin-bottom: 5px; margin-top: 5px;">
            <button id="btn-undo" style="flex: 1; font-size: 11px; cursor: pointer;">⟲ Undo</button>
            <button id="btn-redo" style="flex: 1; font-size: 11px; cursor: pointer;">⟳ Redo</button>
            <button id="btn-reset" style="flex: 1; font-size: 11px; background-color: #d9534f; color: white; border: none; cursor: pointer;">Reset</button>
        </div>
        <div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
            <button id="btn-export-rig" style="flex: 1; font-size: 11px; background: #007acc; color: white; border: none; cursor: pointer; padding: 4px;">💾 Rig JSON</button>
            <button id="btn-export-anim" style="flex: 1; font-size: 11px; background: #9b59b6; color: white; border: none; cursor: pointer; padding: 4px;">💾 Anim JSON</button>
            <button id="btn-export-assets" style="flex: 1; font-size: 11px; background: #28a745; color: white; border: none; cursor: pointer; padding: 4px;">💾 Assets JSON</button>
        </div>
        <div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
            <button id="btn-export-pngs" style="flex: 1; font-size: 11px; background: #17a2b8; color: white; border: none; cursor: pointer; padding: 4px;">🖼️ Export PNGs</button>
            <button id="btn-toggle-console" style="flex: 1; font-size: 11px; background: #666; color: white; border: none; cursor: pointer; padding: 4px;">🖥️ Console</button>
        </div>
        <div style="display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;">
            <button id="btn-import-file" style="flex: 1; font-size: 11px; background: #e67e22; color: white; border: none; cursor: pointer; padding: 4px;" title="Import Rig File">📂 Rig</button>
            <button id="btn-import-paste" style="flex: 1; font-size: 11px; background: #e67e22; color: white; border: none; cursor: pointer; padding: 4px;" title="Paste Rig JSON">📋 Rig</button>
            <button id="btn-import-skin-file" style="flex: 1; font-size: 11px; background: #20c997; color: white; border: none; cursor: pointer; padding: 4px;" title="Import Skin File">📂 Skin</button>
            <button id="btn-import-skin-paste" style="flex: 1; font-size: 11px; background: #20c997; color: white; border: none; cursor: pointer; padding: 4px;" title="Paste Skin JSON">📋 Skin</button>
            <button id="btn-import-anim-file" style="flex: 1; font-size: 11px; background: #8e44ad; color: white; border: none; cursor: pointer; padding: 4px;" title="Import Anim File">📂 Anim</button>
            <button id="btn-import-anim-paste" style="flex: 1; font-size: 11px; background: #8e44ad; color: white; border: none; cursor: pointer; padding: 4px;" title="Paste Anim JSON">📋 Anim</button>
            
            <input type="file" id="file-import-json" accept=".json" style="display: none;">
            <input type="file" id="file-import-skin" accept=".json" style="display: none;">
            <input type="file" id="file-import-anim" accept=".json" style="display: none;">
        </div>`;
        rigHeader.insertAdjacentHTML('afterbegin', toolbarHtml);
    }

    injectInspectorExtensions() {
        const propAssetId = document.getElementById('prop-asset-id');
        if (propAssetId && !document.getElementById('prop-asset-filter')) {
            const filterHtml = `<input type="text" id="prop-asset-filter" placeholder="🔍 Search assets..." style="width: 100%; margin-bottom: 5px; background: #3c3c3c; color: white; border: 1px solid #555; padding: 4px; border-radius: 3px; box-sizing: border-box;">`;
            propAssetId.insertAdjacentHTML('beforebegin', filterHtml);
        }

        // NEW: Inject Parent Bone Dropdown right after Bone Name
        const propBoneName = document.getElementById('prop-bone-name');
        if (propBoneName && !document.getElementById('prop-parent-id')) {
            const parentHtml = `
            <div class="prop-group">
                <label>Parent Bone</label>
                <select id="prop-parent-id" style="width: 100%; background: #3c3c3c; color: white; border: 1px solid #555; padding: 4px; border-radius: 3px;"></select>
            </div>`;
            propBoneName.insertAdjacentHTML('afterend', parentHtml);
        }

        // Inject Scale UI into the Inspector Panel
        if (propBoneName && !document.getElementById('prop-scale-x')) {
            const scaleHtml = `
            <div class="prop-group">
                <label>Scale (X, Y) relative to parent</label>
                <div class="prop-row">
                    <input type="number" id="prop-scale-x" step="0.05" value="1.0">
                    <input type="number" id="prop-scale-y" step="0.05" value="1.0">
                </div>
            </div>`;
            const pivotRow = document.getElementById('prop-pivot-x').closest('.prop-group');
            if (pivotRow) pivotRow.insertAdjacentHTML('afterend', scaleHtml);
        }
        document.getElementById('prop-offset-x').setAttribute('step', '0.1');
        document.getElementById('prop-offset-y').setAttribute('step', '0.1');
    }

    injectTimelineUI() {
        // Attempts to find the timeline panel from your original HTML layout
        let tlContainer = document.querySelector('#timeline-panel .panel-content');
        if (!tlContainer) return;

        tlContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
            <button id="btn-tl-play" style="padding: 5px 10px; background: #28a745; color: white; border: none; cursor: pointer; border-radius: 3px;">▶ Play</button>
            <input type="range" id="tl-scrubber" min="0" max="60" value="0" style="flex: 1; cursor: pointer;">
            <span id="tl-frame-display" style="min-width: 60px; font-family: monospace; font-size: 12px;">F: 0</span>
            <button id="btn-tl-keyframe" style="padding: 5px 10px; background: #e74c3c; color: white; border: none; cursor: pointer; border-radius: 3px;" title="Record current pose to this frame">⏺ Keyframe Pose</button>
            <button id="btn-tl-clear" style="padding: 5px 10px; background: #555; color: white; border: none; cursor: pointer; border-radius: 3px;">🗑️ Clear Timeline</button>
        </div>
        <div id="tl-markers" style="position: relative; height: 10px; width: 100%; margin-top: 5px; background: #1e1e1e; border-radius: 5px;"></div>
        `;
    }

    injectConsole() {
        if (document.getElementById('composer-console')) return;
        const consoleHtml = `
        <div id="composer-console" style="position: fixed; bottom: 0; left: 250px; right: 300px; height: 350px; background: #1e1e1e; border-top: 2px solid #007acc; display: none; flex-direction: column; z-index: 1000; box-shadow: 0 -5px 15px rgba(0,0,0,0.5);">
            <div style="background: #2d2d30; padding: 5px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333;">
                <span style="font-weight: bold; font-size: 12px; color: #ccc;">🛠️ Output Console</span>
                <div style="display: flex; gap: 10px;">
                    <button id="btn-console-clear" style="font-size: 11px; background: #555; color: white; border: none; padding: 3px 8px; cursor: pointer; border-radius: 3px;">🗑️ Clear Console</button>
                    <button id="btn-console-close" style="font-size: 11px; background: #d9534f; color: white; border: none; padding: 3px 8px; cursor: pointer; border-radius: 3px;">✖ Close</button>
                </div>
            </div>
            <div id="console-output-container" style="flex: 1; padding: 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;"></div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', consoleHtml);
    }

    injectModals() {
        if (document.getElementById('paste-modal')) return;
        const modalHtml = `
        <div id="paste-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:2000; justify-content:center; align-items:center;">
            <div style="background:#252526; padding:20px; width:600px; border-radius:5px; border:1px solid #333;">
                <h3 style="margin-top:0; color:white;">Paste JSON</h3>
                <textarea id="paste-textarea" style="width:100%; height:300px; background:#1e1e1e; color:#4CAF50; font-family:monospace; border:1px solid #555; padding:10px; resize:none; outline:none; box-sizing:border-box;"></textarea>
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
                    <button id="btn-paste-cancel" style="padding:5px 15px; cursor:pointer; background:#555; color:white; border:none; border-radius:3px;">Cancel</button>
                    <button id="btn-paste-load" style="padding:5px 15px; background:#007acc; color:white; border:none; cursor:pointer; border-radius:3px;">Load JSON</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Call this whenever a visual change happens
    requestRedraw() {
        this.needsRedraw = true;
    }

    // ==========================================
    // 2. EVENT BINDING (MODULARIZED)
    // ==========================================
    bindAllEvents() {
        this.bindGlobalShortcuts();
        this.bindHierarchyButtons();
        this.bindFileIOEvents();
        this.bindInspectorEvents();
        this.bindCanvasMouseEvents();
        this.bindTimelineEvents();
        this.bindConsoleEvents();
        this.bindAssetImporter();
    }

    bindGlobalShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
                if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); this.redo(); }
            }
        });
    }

    bindHierarchyButtons() {
        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('btn-redo').addEventListener('click', () => this.redo());
        document.getElementById('btn-reset').addEventListener('click', () => this.reset());

        document.getElementById('btn-new-rig').addEventListener('click', () => {
            if (!confirm("Clear current rig?")) return;
            this.rig = { "root": { id: "root", parent: null, offsetX: 0, offsetY: 0, pivotX: 0.5, pivotY: 1.0, rotation: 0, assetId: "none" } };
            this.selectedBoneId = "root";
            this.saveState();
            this.buildHierarchyUI();
        });

        document.getElementById('btn-add-bone').addEventListener('click', () => {
            if (!this.selectedBoneId) return alert("Select a parent bone first!");
            const name = prompt("Enter new bone name:");
            if (!name || this.rig[name]) return;
            this.rig[name] = { id: name, parent: this.selectedBoneId, offsetX: 0, offsetY: 0, pivotX: 0.5, pivotY: 0.5, rotation: 0, assetId: "none" };
            this.selectedBoneId = name;
            this.saveState();
            this.buildHierarchyUI();
        });

        document.getElementById('btn-delete-bone').addEventListener('click', () => {
            if (!this.selectedBoneId || this.selectedBoneId === "root") return;
            if (!confirm(`Delete ${this.selectedBoneId} and children?`)) return;
            const delRec = (tId) => {
                Object.values(this.rig).filter(b => b.parent === tId).forEach(c => delRec(c.id));
                delete this.rig[tId];
            };
            delRec(this.selectedBoneId);
            this.selectedBoneId = "root";
            this.saveState();
            this.refreshAllUI();
        });

        const btnAutoAlign = document.getElementById('btn-auto-align');
        if (btnAutoAlign) btnAutoAlign.addEventListener('click', () => this.handleAutoAlign());
    }

    bindFileIOEvents() {
        // Exports
        document.getElementById('btn-export-rig').addEventListener('click', () => this.handleExportRigJson());
        document.getElementById('btn-export-assets').addEventListener('click', () => this.handleExportAssetsJson());
        document.getElementById('btn-export-pngs').addEventListener('click', () => this.handleExportPngs());
        document.getElementById('btn-export-anim').addEventListener('click', () => this.handleExportAnimJson());

        // File Readers Generator
        const bindFileReader = (btnId, fileInputId, processCallback) => {
            const btn = document.getElementById(btnId);
            const input = document.getElementById(fileInputId);
            if (!btn || !input) return;
            btn.addEventListener('click', () => input.click());
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => processCallback(event.target.result);
                reader.readAsText(file);
                e.target.value = ''; 
            });
        };

        // Bind the File Buttons
        bindFileReader('btn-import-file', 'file-import-json', (data) => this.processImportedJSON(data));
        bindFileReader('btn-import-skin-file', 'file-import-skin', (data) => this.processImportedSkinJSON(data));
        bindFileReader('btn-import-anim-file', 'file-import-anim', (data) => this.processImportedAnimJSON(data));

        // Generic Paste Modal Handler
        const openPasteModal = (callback) => {
            document.getElementById('paste-textarea').value = '';
            document.getElementById('paste-modal').style.display = 'flex';
            
            // Clone the load button to wipe any previous event listeners cleanly
            const loadBtn = document.getElementById('btn-paste-load');
            const newLoadBtn = loadBtn.cloneNode(true);
            loadBtn.parentNode.replaceChild(newLoadBtn, loadBtn);
            
            newLoadBtn.addEventListener('click', () => {
                callback(document.getElementById('paste-textarea').value);
                document.getElementById('paste-modal').style.display = 'none';
            });
        };

        document.getElementById('btn-paste-cancel').addEventListener('click', () => document.getElementById('paste-modal').style.display = 'none');

        // Bind the Paste Buttons
        document.getElementById('btn-import-paste').addEventListener('click', () => openPasteModal((d) => this.processImportedJSON(d)));
        const btnSkinPaste = document.getElementById('btn-import-skin-paste');
        if (btnSkinPaste) btnSkinPaste.addEventListener('click', () => openPasteModal((d) => this.processImportedSkinJSON(d)));
        const btnAnimPaste = document.getElementById('btn-import-anim-paste');
        if (btnAnimPaste) btnAnimPaste.addEventListener('click', () => openPasteModal((d) => this.processImportedAnimJSON(d)));
    }

    bindTimelineEvents() {
        const btnPlay = document.getElementById('btn-tl-play');
        const scrubber = document.getElementById('tl-scrubber');
        if (!btnPlay || !scrubber) return;

        btnPlay.addEventListener('click', () => {
            this.anim.isPlaying = !this.anim.isPlaying;
            btnPlay.innerText = this.anim.isPlaying ? "⏸ Pause" : "▶ Play";
            if (this.anim.isPlaying && this.anim.currentFrame >= this.anim.maxFrames) {
                this.anim.currentFrame = 0; // loop back
            }
        });

        scrubber.addEventListener('input', (e) => {
            this.anim.currentFrame = parseInt(e.target.value);
            document.getElementById('tl-frame-display').innerText = `F: ${this.anim.currentFrame}`;
            this.applyInterpolatedPose(this.anim.currentFrame);
        });

        document.getElementById('btn-tl-keyframe').addEventListener('click', () => {
            this.saveKeyframe(this.anim.currentFrame);
        });

        document.getElementById('btn-tl-clear').addEventListener('click', () => {
            if(confirm("Delete all keyframes?")) {
                this.anim.keyframes = {};
                this.updateTimelineMarkers();
            }
        });
    }

    bindConsoleEvents() {
        document.getElementById('btn-toggle-console').addEventListener('click', () => { this.toggleConsole(); } );
        document.getElementById('btn-console-close').addEventListener('click', () => { this.hideConsole(); } );
        document.getElementById('btn-console-clear').addEventListener('click', () => {
            document.getElementById('console-output-container').innerHTML = ''; // Clears the distinct blocks
        });
    }

    toggleConsole() {
        const cons = document.getElementById('composer-console');
        cons.style.display = (cons.style.display === 'none' || cons.style.display === '') ? 'flex' : 'none';
    }

    hideConsole() {
        document.getElementById('composer-console').style.display = 'none';
    }

    bindInspectorEvents() {
        const updateBone = (prop, value) => {
            if (!this.selectedBoneId) return;
            this.rig[this.selectedBoneId][prop] = (prop === 'assetId' ? value : parseFloat(value));
            this.requestRedraw();
        };

        const saveOnChange = (id) => document.getElementById(id).addEventListener('change', () => this.saveState());

        const parentDrop = document.getElementById('prop-parent-id');
        if (parentDrop) {
            parentDrop.addEventListener('change', (e) => {
                if (!this.selectedBoneId || this.selectedBoneId === 'root') return;
                
                this.rig[this.selectedBoneId].parent = e.target.value;
                this.buildHierarchyUI(); // Instantly update the visual tree
                this.saveState();
                this.requestRedraw();
            });
        }

        document.getElementById('zoom-slider').addEventListener('input', (e) => {
            this.zoomLevel = parseFloat(e.target.value);
            document.getElementById('zoom-val').innerText = Math.round(this.zoomLevel * 100) + '%';
            this.requestRedraw();
        });

        document.getElementById('prop-asset-filter').addEventListener('keyup', (e) => this.populateAssetDropdown(e.target.value));
        
        document.getElementById('prop-asset-id').onchange = (e) => {
            updateBone('assetId', e.target.value);
            this.saveState();
        };

        ['prop-offset-x', 'prop-offset-y', 'prop-pivot-x', 'prop-pivot-y', 'prop-rotation', 'prop-rotation-slider', 'prop-scale-x', 'prop-scale-y'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return; // Failsafe
            saveOnChange(id);
            el.addEventListener('input', (e) => {
                if(id.includes('rotation')) {
                    document.getElementById('prop-rotation').value = e.target.value;
                    document.getElementById('prop-rotation-slider').value = e.target.value;
                    updateBone('rotation', e.target.value);
                } else {
                    // This clever regex maps "prop-scale-x" to "scaleX" dynamically
                    const propName = id.replace('prop-', '').replace(/-([a-z])/g, g => g[1].toUpperCase());
                    updateBone(propName, e.target.value);
                }
            });
        });
    }

    // ==========================================
    // 3. ANIMATION TIMELINE LOGIC
    // ==========================================
    saveKeyframe(frameIndex) {
        const snapshot = {};
        for (const [boneId, data] of Object.entries(this.rig)) {
            snapshot[boneId] = {
                offsetX: data.offsetX,
                offsetY: data.offsetY,
                rotation: data.rotation,
                scaleX: data.scaleX !== undefined ? data.scaleX : 1.0,
                scaleY: data.scaleY !== undefined ? data.scaleY : 1.0,
                assetId: data.assetId 
            };
        }
        this.anim.keyframes[frameIndex] = snapshot;
        this.updateTimelineMarkers();
        this.logOutput(`⏺ Saved pose, scale, & assets to Keyframe ${frameIndex}`);
    }

    updateTimelineMarkers() {
        const markerContainer = document.getElementById('tl-markers');
        if (!markerContainer) return;
        markerContainer.innerHTML = '';
        
        for (const frameStr in this.anim.keyframes) {
            const frame = parseInt(frameStr);
            const percent = (frame / this.anim.maxFrames) * 100;
            const dot = document.createElement('div');
            dot.style.cssText = `position: absolute; left: ${percent}%; top: 0; width: 4px; height: 10px; background: #e74c3c; cursor: pointer; transform: translateX(-50%);`;
            dot.title = `Frame ${frame}`;
            dot.onclick = () => {
                document.getElementById('tl-scrubber').value = frame;
                this.anim.currentFrame = frame;
                this.applyInterpolatedPose(frame);
            };
            markerContainer.appendChild(dot);
        }
    }

    applyInterpolatedPose(frame) {
        const keys = Object.keys(this.anim.keyframes).map(Number).sort((a,b)=>a-b);
        if (keys.length === 0) return; 

        document.getElementById('tl-frame-display').innerText = `F: ${frame}`;

        let snapshot = {};
        
        if (keys.includes(frame)) {
            snapshot = this.anim.keyframes[frame];
        } else if (frame < keys[0]) {
            snapshot = this.anim.keyframes[keys[0]];
        } else if (frame > keys[keys.length - 1]) {
            snapshot = this.anim.keyframes[keys[keys.length - 1]];
        } else {
            let f1 = keys[0], f2 = keys[keys.length - 1];
            for (let i = 0; i < keys.length - 1; i++) {
                if (frame > keys[i] && frame < keys[i+1]) {
                    f1 = keys[i]; f2 = keys[i+1]; break;
                }
            }
            const t = (frame - f1) / (f2 - f1);
            const pose1 = this.anim.keyframes[f1];
            const pose2 = this.anim.keyframes[f2];
            
            // Iterate over ALL bones to ensure none are skipped during interpolation
            for (const boneId in this.rig) {
                const b1 = pose1[boneId];
                const b2 = pose2[boneId];
                const bDef = this.rig[boneId];

                if (!b1 && !b2) {
                    snapshot[boneId] = {
                        offsetX: bDef.defaultOffsetX,
                        offsetY: bDef.defaultOffsetY,
                        rotation: bDef.defaultRotation,
                        scaleX: 1.0, scaleY: 1.0,
                        assetId: bDef.defaultAssetId
                    };
                    continue;
                }

                if (!b1) { snapshot[boneId] = { ...b2 }; continue; }
                if (!b2) { snapshot[boneId] = { ...b1 }; continue; }

                const sX1 = b1.scaleX !== undefined ? b1.scaleX : 1.0;
                const sY1 = b1.scaleY !== undefined ? b1.scaleY : 1.0;
                const sX2 = b2.scaleX !== undefined ? b2.scaleX : 1.0;
                const sY2 = b2.scaleY !== undefined ? b2.scaleY : 1.0;

                snapshot[boneId] = {
                    offsetX: b1.offsetX + (b2.offsetX - b1.offsetX) * t,
                    offsetY: b1.offsetY + (b2.offsetY - b1.offsetY) * t,
                    rotation: b1.rotation + (b2.rotation - b1.rotation) * t,
                    scaleX: sX1 + (sX2 - sX1) * t,
                    scaleY: sY1 + (sY2 - sY1) * t,
                    assetId: b1.assetId 
                };
            }
        }

        // Apply snapshot to live rig, guaranteeing all bones are updated even if snapshot was sparse
        for (const boneId in this.rig) {
            const data = snapshot[boneId];
            if (data) {
                this.rig[boneId].offsetX = data.offsetX;
                this.rig[boneId].offsetY = data.offsetY;
                this.rig[boneId].rotation = data.rotation;
                this.rig[boneId].scaleX = data.scaleX !== undefined ? data.scaleX : 1.0;
                this.rig[boneId].scaleY = data.scaleY !== undefined ? data.scaleY : 1.0;
                this.rig[boneId].assetId = data.assetId; 
            } else {
                // Failsafe for bones added AFTER keyframing or not present in the snapshot object
                this.rig[boneId].offsetX = this.rig[boneId].defaultOffsetX;
                this.rig[boneId].offsetY = this.rig[boneId].defaultOffsetY;
                this.rig[boneId].rotation = this.rig[boneId].defaultRotation;
                this.rig[boneId].scaleX = 1.0;
                this.rig[boneId].scaleY = 1.0;
                // Don't override assetId if it's missing, keep whatever is currently equipped
            }
        }

        // Update inspector UI dynamically if playing
        if (this.selectedBoneId && snapshot[this.selectedBoneId]) {
            const d = snapshot[this.selectedBoneId];
            const ox = document.getElementById('prop-offset-x'); if(ox) ox.value = d.offsetX.toFixed(2);
            const oy = document.getElementById('prop-offset-y'); if(oy) oy.value = d.offsetY.toFixed(2);
            const rot = document.getElementById('prop-rotation'); if(rot) rot.value = d.rotation.toFixed(2);
            const rs = document.getElementById('prop-rotation-slider'); if(rs) rs.value = d.rotation.toFixed(2);
            
            const sx = document.getElementById('prop-scale-x'); if(sx && d.scaleX !== undefined) sx.value = d.scaleX.toFixed(2);
            const sy = document.getElementById('prop-scale-y'); if(sy && d.scaleY !== undefined) sy.value = d.scaleY.toFixed(2);
            
            const assetDrop = document.getElementById('prop-asset-id'); if(assetDrop) assetDrop.value = d.assetId;
        }

        this.requestRedraw();
    }

    // ==========================================
    // 4. CORE MATH & RENDERING
    // ==========================================
    renderLoop(timestamp) {
        // Handle Timeline Playback
        if (this.anim.isPlaying) {
            const elapsed = timestamp - this.anim.lastTime;
            const frameDuration = 1000 / this.anim.fps;
            if (elapsed > frameDuration) {
                this.anim.currentFrame++;
                if (this.anim.currentFrame > this.anim.maxFrames) this.anim.currentFrame = 0;
                
                document.getElementById('tl-scrubber').value = this.anim.currentFrame;
                this.applyInterpolatedPose(this.anim.currentFrame);
                this.anim.lastTime = timestamp;
            }
        } else {
            this.anim.lastTime = timestamp;
        }

        if (!this.anim.isPlaying && !this.needsRedraw) {
            requestAnimationFrame((t) => this.renderLoop(t));
            return;
        }
        
        this.needsRedraw = false;

        // Rendering logic
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate((this.canvas.width / 2) + this.cameraX, this.canvas.height - 200);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.imageSmoothingEnabled = false; 

        // Crosshair
        this.ctx.strokeStyle = '#555';
        this.ctx.beginPath(); this.ctx.moveTo(-20, 0); this.ctx.lineTo(20, 0); this.ctx.stroke();
        this.ctx.beginPath(); this.ctx.moveTo(0, -20); this.ctx.lineTo(0, 20); this.ctx.stroke();

        this.renderOrder = []; 
        
        // Pass 1: Calculate World Matrices hierarchically
        this.calcBoneTransforms("root");

        // Pass 2: Sort by Z-Index (matches SkeletonRig.js)
        this.renderOrder.sort((a, b) => {
            const zA = this.rig[a].zIndex !== undefined ? this.rig[a].zIndex : 0;
            const zB = this.rig[b].zIndex !== undefined ? this.rig[b].zIndex : 0;
            return zA - zB;
        });

        // Pass 3: Draw images in exact Z-Index order
        for (const boneId of this.renderOrder) {
            const bone = this.rig[boneId];
            if (bone.assetId !== "none" && this.assets[bone.assetId]) {
                const img = this.assets[bone.assetId];
                const drawX = -(img.width * bone.pivotX);
                const drawY = -(img.height * bone.pivotY);

                this.ctx.save();
                this.ctx.setTransform(bone.worldMatrix);
                this.ctx.drawImage(img.element, drawX, drawY, img.width, img.height);
                
                // Draw selection highlight
                if (this.selectedBoneId === boneId) {
                    this.ctx.fillStyle = '#007acc';
                    this.ctx.beginPath(); this.ctx.arc(0, 0, 5, 0, Math.PI*2); this.ctx.fill();
                    this.ctx.strokeStyle = '#fff'; this.ctx.strokeRect(drawX, drawY, img.width, img.height);
                }
                this.ctx.restore();
            }
        }

        this.ctx.restore();
        
        requestAnimationFrame((t) => this.renderLoop(t));
    }

    calcBoneTransforms(boneId) {
        const bone = this.rig[boneId];
        if (!bone) return;

        this.ctx.save();
        this.ctx.translate(bone.offsetX, bone.offsetY);
        this.ctx.rotate(bone.rotation * (Math.PI / 180));
        this.ctx.scale(bone.scaleX !== undefined ? bone.scaleX : 1.0, bone.scaleY !== undefined ? bone.scaleY : 1.0);

        bone.worldMatrix = this.ctx.getTransform();
        this.renderOrder.push(boneId); // Track for the Z-sort phase

        const children = Object.values(this.rig).filter(b => b.parent === boneId);
        for (const child of children) {
            this.calcBoneTransforms(child.id);
        }

        this.ctx.restore();
    }

    // ==========================================
    // 5. EXPORT & IMPORT UTILITIES
    // ==========================================
    handleExportRigJson() {
        const scaleStr = prompt("Export offset scale factor (e.g. 0.5 for 50% shrunk PNGs):", "1.0");
        const scale = parseFloat(scaleStr);
        if (isNaN(scale) || scale <= 0) return;

        const sortedBoneIds = Object.keys(this.rig).sort();
        let maxName = 0, maxParent = 0, maxSkinName = 0, maxAsset = 0;

        // Pass 1: Measure padding limits
        for (const boneId of sortedBoneIds) {
            const bone = this.rig[boneId];
            maxName = Math.max(maxName, bone.id.length);
            maxParent = Math.max(maxParent, String(bone.parent).length);
            maxSkinName = Math.max(maxSkinName, bone.id.length);
            if (bone.assetId !== "none") maxAsset = Math.max(maxAsset, bone.assetId.length);
        }

        const padStr = (s, l) => `"${s}"`.padEnd(l + 2, ' ');
        const padNum = (n, l) => String(n).padEnd(l, ' ');

        // Pass 2: Column-Aligned Formatting
        const rigBonesFormatted = sortedBoneIds.map(boneId => {
            const b = this.rig[boneId];
            const nP = padStr(b.id, maxName);
            const pP = b.parent === null ? "null".padEnd(maxParent + 2, ' ') : padStr(b.parent, maxParent); 
            
            // Format nested objects into padded blocks so the next column perfectly aligns
            const px = parseFloat(b.pivotX.toFixed(4));
            const py = parseFloat(b.pivotY.toFixed(4));
            const pivotStr = `{ "x": ${px}, "y": ${py} }`.padEnd(26, ' ');

            const ox = parseFloat((b.offsetX * scale).toFixed(3));
            const oy = parseFloat((b.offsetY * scale).toFixed(3));
            const offsetStr = `{ "x": ${ox}, "y": ${oy} }`.padEnd(28, ' ');

            const rotStr = String(parseFloat(b.rotation.toFixed(2))).padEnd(5, ' ');
            const zIdx = b.zIndex !== undefined ? b.zIndex : 0;
            
            return `    { "name": ${nP}, "parent": ${pP}, "pivot": ${pivotStr}, "defaultOffset": ${offsetStr}, "defaultRotation": ${rotStr}, "zIndex": ${zIdx} }`;
        }).join(',\n');

        const rigJsonOut = `{\n  "rigId": "custom_rig",\n  "meta": { "exportScale": ${scale} },\n  "bones": [\n${rigBonesFormatted}\n  ]\n}`;

        const skinMappingsFormatted = sortedBoneIds.filter(id => this.rig[id].assetId !== "none").map(id => {
            const v = this.rig[id];
            const nP = `"${id}":`.padEnd(maxSkinName + 3, ' ');
            const aP = padStr(v.assetId, maxAsset);
            return `    ${nP} { "assetId": ${aP}, "scale": 1, "zIndexOffset": 0 }`;
        }).join(',\n');

        const skinJsonOut = `{\n  "skinId": "custom_skin",\n  "rigId": "custom_rig",\n  "mappings": {\n${skinMappingsFormatted}\n  }\n}`;

        this.logOutput("Rig JSON (Skeleton/Math)", rigJsonOut);
        this.logOutput("Skin JSON (Visuals/Assets)", skinJsonOut);
    }

    handleExportAnimJson() {
        if (Object.keys(this.anim.keyframes).length === 0) return alert("No keyframes found on timeline!");
        
        const scaleStr = prompt("Export offset scale factor for animation offsets:", "1.0");
        const scale = parseFloat(scaleStr);
        if (isNaN(scale) || scale <= 0) return;

        const animOut = {
            meta: { exportScale: scale, generator: "Sprite Composer v1.1 - Optimized" },
            animId: "anim_custom",
            length: this.anim.maxFrames,
            tracks: {}
        };

        const rawTracks = {};

        for (const [frame, snapshot] of Object.entries(this.anim.keyframes)) {
            for (const [boneId, data] of Object.entries(snapshot)) {
                if (!rawTracks[boneId]) rawTracks[boneId] = { rotation: [], offsetX: [], offsetY: [], scaleX: [], scaleY: [], assetId: [] };
                
                const sX = data.scaleX !== undefined ? data.scaleX : 1.0;
                const sY = data.scaleY !== undefined ? data.scaleY : 1.0;
                
                rawTracks[boneId].rotation.push({ frame: parseInt(frame), value: parseFloat(data.rotation.toFixed(2)) });
                rawTracks[boneId].offsetX.push({ frame: parseInt(frame), value: parseFloat((data.offsetX * scale).toFixed(3)) });
                rawTracks[boneId].offsetY.push({ frame: parseInt(frame), value: parseFloat((data.offsetY * scale).toFixed(3)) });
                rawTracks[boneId].scaleX.push({ frame: parseInt(frame), value: parseFloat(sX.toFixed(2)) });
                rawTracks[boneId].scaleY.push({ frame: parseInt(frame), value: parseFloat(sY.toFixed(2)) });
                rawTracks[boneId].assetId.push({ frame: parseInt(frame), value: data.assetId }); 
            }
        }

        // NEW: Helper function to compress identical contiguous keyframes
        const reduceTrack = (arr) => {
            if (!arr || arr.length === 0) return [];
            const result = [arr[0]];
            for (let i = 1; i < arr.length; i++) {
                if (arr[i].value !== result[result.length - 1].value) {
                    result.push(arr[i]);
                }
            }
            return result;
        };

        // Redundancy Filtering & Compression
        Object.keys(rawTracks).sort().forEach(boneId => {
            const track = rawTracks[boneId];
            const baseBone = this.rig[boneId];
            if (!baseBone) return;

            const bRot = parseFloat(baseBone.defaultRotation.toFixed(2));
            const bOx = parseFloat((baseBone.defaultOffsetX * scale).toFixed(3));
            const bOy = parseFloat((baseBone.defaultOffsetY * scale).toFixed(3));
            const bAsset = baseBone.defaultAssetId;

            // Compress all tracks to remove duplicate contiguous values
            const rRot = reduceTrack(track.rotation);
            const rOx = reduceTrack(track.offsetX);
            const rOy = reduceTrack(track.offsetY);
            const rSx = reduceTrack(track.scaleX);
            const rSy = reduceTrack(track.scaleY);
            const rAsset = reduceTrack(track.assetId);

            const keeps = {};
            
            // Only keep the track if it has multiple keyframes (meaning it animates) 
            // OR if it has 1 keyframe but that value deviates from the baseline rig/skin
            if (rRot.length > 1 || (rRot.length === 1 && rRot[0].value !== bRot)) keeps.rotation = rRot;
            if (rOx.length > 1 || (rOx.length === 1 && rOx[0].value !== bOx)) keeps.offsetX = rOx;
            if (rOy.length > 1 || (rOy.length === 1 && rOy[0].value !== bOy)) keeps.offsetY = rOy;
            if (rSx.length > 1 || (rSx.length === 1 && rSx[0].value !== 1.0)) keeps.scaleX = rSx;
            if (rSy.length > 1 || (rSy.length === 1 && rSy[0].value !== 1.0)) keeps.scaleY = rSy;
            if (rAsset.length > 1 || (rAsset.length === 1 && rAsset[0].value !== bAsset)) keeps.assetId = rAsset;

            // Only add the bone to the JSON if it actually has tracks left
            if (Object.keys(keeps).length > 0) animOut.tracks[boneId] = keeps;
        });

        // Inline Array Formatting
        let trackLines = [];
        Object.entries(animOut.tracks).forEach(([boneId, tracks]) => {
            let boneStr = `    "${boneId}": {\n`;
            let trackStrs = [];
            Object.entries(tracks).forEach(([trackName, frames]) => {
                let frameLines = frames.map(f => {
                    const fStr = String(f.frame).padEnd(2, ' ');
                    const vStr = typeof f.value === 'string' ? `"${f.value}"` : f.value;
                    return `        { "frame": ${fStr}, "value": ${vStr} }`;
                });
                trackStrs.push(`      "${trackName}": [\n${frameLines.join(',\n')}\n      ]`);
            });
            boneStr += trackStrs.join(',\n') + `\n    }`;
            trackLines.push(boneStr);
        });

        const metaStr = `"meta": { "exportScale": ${scale}, "generator": "Sprite Composer v1.1 - Optimized" }`;
        const animJsonOut = `{\n  ${metaStr},\n  "animId": "${animOut.animId}",\n  "length": ${animOut.length},\n  "tracks": {\n${trackLines.join(',\n')}\n  }\n}`;
        
        this.logOutput("Animation JSON", animJsonOut);
    }

    handleExportAssetsJson() {
        const used = new Set(); 
        for (const b in this.rig) {
            if (this.rig[b].assetId && this.rig[b].assetId !== "none") used.add(this.rig[b].assetId);
        }
        
        if (!used.size) return alert("No image assets assigned!");
        const sc = parseFloat(prompt("Scale factor:", "0.5")); 
        if (isNaN(sc) || sc <= 0) return;
        
        let j = `{\n  "characters_custom": {\n`; 
        
        // NEW: Convert the Set to an Array and sort it alphabetically
        const arr = Array.from(used).sort();
        
        arr.forEach((id, i) => {
            const a = this.assets[id]; if (!a) return;
            j += `    "${id}": { "src": "assets/characters/${a.file ? a.file.name : id+'.png'}", "w": ${Math.max(1, Math.round(a.width * sc))}, "h": ${Math.max(1, Math.round(a.height * sc))} }${i === arr.length - 1 ? "" : ","}\n`;
        });
        j += `  }\n}`;
        
        this.logOutput("Assets JSON fragment", j);
    }

    // --- IMPORT ANIMATION JSON ---
    processImportedAnimJSON(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (!data.tracks) throw new Error("Missing animation tracks.");
            
            let scale = 1;
            if (data.meta && data.meta.exportScale) {
                this.logOutput(`🔍 Auto-detected Anim JSON scale metadata: ${data.meta.exportScale}.`);
                scale = data.meta.exportScale;
            } else {
                const scaleStr = prompt("Legacy Anim JSON detected. Enter export scale (e.g., 0.5):", "1.0");
                scale = parseFloat(scaleStr);
                if (isNaN(scale) || scale <= 0) return;
            }

            this.anim.keyframes = {};
            this.anim.maxFrames = data.length || 60;
            
            // 1. Find all unique keyframe timestamps across all tracks
            const allFramesSet = new Set();
            allFramesSet.add(0); // Ensure frame 0 is always a keyframe
            for (const track of Object.values(data.tracks)) {
                for (const keyList of Object.values(track)) {
                    if (Array.isArray(keyList)) keyList.forEach(k => allFramesSet.add(k.frame));
                }
            }
            const sortedFrames = Array.from(allFramesSet).sort((a,b)=>a-b);
            
            // Helper to mathematically interpolate a specific track property
            const interpolateTrack = (trackArr, frame, defaultVal) => {
                if (!trackArr || trackArr.length === 0) return defaultVal;
                if (trackArr.length === 1) return trackArr[0].value;
                
                let prev = trackArr[0], next = trackArr[trackArr.length - 1];
                if (frame <= prev.frame) return prev.value;
                if (frame >= next.frame) return next.value;
                
                for (let i = 0; i < trackArr.length - 1; i++) {
                    if (frame >= trackArr[i].frame && frame <= trackArr[i+1].frame) {
                        prev = trackArr[i]; next = trackArr[i+1]; break;
                    }
                }
                if (typeof prev.value === 'string') return prev.value; // Discrete (assetId)
                const t = (frame - prev.frame) / (next.frame - prev.frame);
                return prev.value + (next.value - prev.value) * t;
            };

            // 2. Expand the sparse optimized tracks back into full snapshots
            sortedFrames.forEach(f => {
                this.anim.keyframes[f] = {};
                for (const boneId of Object.keys(this.rig)) {
                    const boneData = data.tracks[boneId] || {};
                    const bDef = this.rig[boneId];
                    
                    this.anim.keyframes[f][boneId] = {
                        rotation: interpolateTrack(boneData.rotation, f, bDef.defaultRotation),
                        offsetX: interpolateTrack(boneData.offsetX, f, bDef.defaultOffsetX * scale) / scale,
                        offsetY: interpolateTrack(boneData.offsetY, f, bDef.defaultOffsetY * scale) / scale,
                        scaleX: interpolateTrack(boneData.scaleX, f, 1.0),
                        scaleY: interpolateTrack(boneData.scaleY, f, 1.0),
                        assetId: interpolateTrack(boneData.assetId, f, bDef.defaultAssetId)
                    };
                }
            });
            
            this.updateTimelineMarkers();
            this.anim.currentFrame = 0;
            this.applyInterpolatedPose(0);
            
            const scrubber = document.getElementById('tl-scrubber');
            if (scrubber) { scrubber.max = this.anim.maxFrames; scrubber.value = 0; }
            
            this.logOutput(`✅ Animation loaded! Expanded optimized tracks into ${sortedFrames.length} keyframes.`);
        } catch (err) {
            alert("Error loading Anim JSON: " + err.message);
        }
    }

    processImportedJSON(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            const rigData = data.rig || data;
            if (!rigData.bones) throw new Error("Missing 'bones' array in Rig JSON");

            let corrScale = 1;
            const meta = data.meta || rigData.meta;
            if (meta && meta.exportScale) {
                this.logOutput(`🔍 Detected rig scale metadata: ${meta.exportScale}`);
            } else {
                corrScale = parseFloat(prompt("Legacy JSON. Enter scale correction factor:", "1")) || 1;
            }

            this.rig = {};
            rigData.bones.forEach(bone => {
                const map = (data.skin && data.skin.mappings) ? data.skin.mappings[bone.name] : null;
                
                this.rig[bone.name] = {
                    id: bone.name, 
                    parent: bone.parent,
                    // FIX: Save the true defaults to compare against later when stripping redundant animation data
                    defaultOffsetX: (bone.defaultOffset ? bone.defaultOffset.x : 0) * corrScale, 
                    defaultOffsetY: (bone.defaultOffset ? bone.defaultOffset.y : 0) * corrScale,
                    defaultRotation: bone.defaultRotation || 0,
                    defaultAssetId: map ? map.assetId : "none",
                    
                    offsetX: (bone.defaultOffset ? bone.defaultOffset.x : 0) * corrScale, 
                    offsetY: (bone.defaultOffset ? bone.defaultOffset.y : 0) * corrScale,
                    pivotX: bone.pivot ? bone.pivot.x : 0.5, 
                    pivotY: bone.pivot ? bone.pivot.y : 0.5,
                    rotation: bone.defaultRotation || 0, 
                    assetId: map ? map.assetId : "none",
                    zIndex: bone.zIndex !== undefined ? bone.zIndex : 0 // FIX: Stop overriding zIndex
                };
            });
            this.selectedBoneId = "root";
            this.saveState(); this.refreshAllUI();
            this.logOutput(`✅ Rig loaded successfully!`);
        } catch (err) {
            alert("Error parsing Rig JSON: " + err.message);
        }
    }

    processImportedSkinJSON(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            const skinData = data.skin || data;
            if (!skinData.mappings) throw new Error("Missing 'mappings' object in Skin JSON");

            let appliedCount = 0;
            for (const [boneId, mapping] of Object.entries(skinData.mappings)) {
                if (this.rig[boneId]) {
                    this.rig[boneId].assetId = mapping.assetId || "none";
                    // NEW: Update the baseline default so the exporter knows what to strip
                    this.rig[boneId].defaultAssetId = mapping.assetId || "none"; 
                    appliedCount++;
                }
            }
            
            this.saveState();
            if (this.selectedBoneId) this.selectBone(this.selectedBoneId);
            this.requestRedraw();
            this.logOutput(`✅ Skin loaded! Applied ${appliedCount} asset mappings to the current rig.`);
        } catch (err) {
            alert("Error parsing Skin JSON: " + err.message);
        }
    }


    // ==========================================
    // OTHER HELPERS (Assets, State, History, AutoAlign)
    // ==========================================
    
    saveState() {
        const stateStr = JSON.stringify(this.rig);
        if (this.historyIndex >= 0 && this.history[this.historyIndex] === stateStr) return;
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(stateStr);
        this.historyIndex++;
    }

    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.rig = JSON.parse(this.history[this.historyIndex]); this.refreshAllUI(); } }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.rig = JSON.parse(this.history[this.historyIndex]); this.refreshAllUI(); } }
    reset() { if (confirm("Reset?")) { this.historyIndex = 0; this.rig = JSON.parse(this.history[0]); this.history = [this.history[0]]; this.refreshAllUI(); } }

    logOutput(title, jsonContent = null) {
        const cons = document.getElementById('composer-console');
        const container = document.getElementById('console-output-container');
        if (!cons || !container) return;
        
        cons.style.display = 'flex'; // Auto-open console
        
        const block = document.createElement('div');
        // Ensure the block itself is structured to contain the scrolling area cleanly
        block.style.cssText = "background: #252526; border: 1px solid #333; border-radius: 4px; overflow: hidden; font-family: monospace; font-size: 12px; display: flex; flex-direction: column;";
        
        const header = document.createElement('div');
        // Prevent the header from shrinking when the container gets full
        header.style.cssText = "background: #2d2d30; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; color: #ccc; font-weight: bold; flex-shrink: 0;";
        
        const titleSpan = document.createElement('span');
        titleSpan.innerText = `[${new Date().toLocaleTimeString()}] ${title}`;
        header.appendChild(titleSpan);
        
        // Add Copy Button if there is JSON payload
        if (jsonContent) {
            const copyBtn = document.createElement('button');
            copyBtn.innerText = "📋 Copy JSON";
            copyBtn.style.cssText = "background: #007acc; color: white; border: none; padding: 4px 8px; cursor: pointer; border-radius: 3px; font-size: 11px; font-weight: bold;";
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(jsonContent).then(() => {
                    copyBtn.innerText = "✅ Copied!";
                    copyBtn.style.background = "#28a745";
                    setTimeout(() => {
                        copyBtn.innerText = "📋 Copy JSON";
                        copyBtn.style.background = "#007acc";
                    }, 2000);
                });
            };
            header.appendChild(copyBtn);
        }
        
        block.appendChild(header);
        
        // Add JSON content block
        if (jsonContent) {
            const pre = document.createElement('pre');
            // THE FIX: Added max-height: 250px, overflow: auto, and white-space: pre
            // This forces the JSON to stay inside a scrollable box without breaking the layout
            pre.style.cssText = "margin: 0; padding: 10px; overflow: auto; max-height: 250px; color: #4CAF50; white-space: pre;";
            pre.innerText = jsonContent;
            block.appendChild(pre);
        }
        
        container.appendChild(block);
        
        // Auto-scroll the main container to the bottom so the new block is visible
        container.scrollTop = container.scrollHeight; 
    }

    buildHierarchyUI() {
        const c = document.getElementById('hierarchy-tree');
        if(!c) return;
        c.innerHTML = '';
        const bn = (bId, d) => {
            const b = this.rig[bId]; if (!b) return;
            const v = document.createElement('div'); v.className = 'bone-item'; v.innerText = b.id;
            if (d > 0) v.classList.add('indent');
            if (bId === this.selectedBoneId) v.classList.add('selected');
            v.onclick = () => this.selectBone(bId);
            c.appendChild(v);
            Object.values(this.rig).filter(x => x.parent === bId).forEach(child => bn(child.id, d + 1));
        };
        bn("root", 0);
    }

    selectBone(bId) {
        this.selectedBoneId = bId; this.buildHierarchyUI();
        const b = this.rig[bId];
        document.getElementById('no-selection').style.display = 'none'; document.getElementById('bone-props').style.display = 'block';
        document.getElementById('prop-bone-name').innerText = b.id;
        
        this.populateParentDropdown(bId);

        ['offsetX','offsetY','pivotX','pivotY','scaleX','scaleY','rotation'].forEach(p => {
            const el = document.getElementById(`prop-${p.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}`);
            if(el) el.value = b[p];
        });
        const rs = document.getElementById('prop-rotation-slider'); if(rs) rs.value = b.rotation;
        this.populateAssetDropdown(document.getElementById('prop-asset-filter') ? document.getElementById('prop-asset-filter').value : '');
        this.requestRedraw();
    }

    refreshAllUI() {
        this.buildHierarchyUI();
        if (this.selectedBoneId && this.rig[this.selectedBoneId]) this.selectBone(this.selectedBoneId);
        else { document.getElementById('no-selection').style.display = 'block'; document.getElementById('bone-props').style.display = 'none'; }
    }

    getMousePos(e) {
        const r = this.canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (this.canvas.width / r.width), y: (e.clientY - r.top) * (this.canvas.height / r.height) };
    }

    bindCanvasMouseEvents() {
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('mousedown', (e) => {
            this._handleMouseDown(e);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            const m = this.getMousePos(e);
            if (this.isPanning) { 
                this.cameraX = this.initialCamera.x + (m.x - this.dragStart.x); 
                this.cameraY = this.initialCamera.y + (m.y - this.dragStart.y); 
                this.requestRedraw(); 
                return; 
            }
            if (!this.isDraggingBone || !this.selectedBoneId) return;
            const b = this.rig[this.selectedBoneId]; let pM = new DOMMatrix();
            if (b.parent && this.rig[b.parent].worldMatrix) pM = this.rig[b.parent].worldMatrix;
            else { pM.translateSelf((this.canvas.width / 2) + this.cameraX, (this.canvas.height / 2) + this.cameraY); pM.scaleSelf(this.zoomLevel, this.zoomLevel); }
            const inv = pM.inverse();
            const p0x = inv.a * this.dragStart.x + inv.c * this.dragStart.y + inv.e, p0y = inv.b * this.dragStart.x + inv.d * this.dragStart.y + inv.f;
            const p1x = inv.a * m.x + inv.c * m.y + inv.e, p1y = inv.b * m.x + inv.d * m.y + inv.f;
            b.offsetX = this.initialOffset.x + (p1x - p0x); b.offsetY = this.initialOffset.y + (p1y - p0y);
            const ox = document.getElementById('prop-offset-x'), oy = document.getElementById('prop-offset-y');
            if(ox) ox.value = b.offsetX.toFixed(2); if(oy) oy.value = b.offsetY.toFixed(2);
            this.requestRedraw();
        });

        const stop = () => { if (this.isDraggingBone) this.saveState(); this.isDraggingBone = false; this.isPanning = false; this.canvas.style.cursor = 'default'; };
        this.canvas.addEventListener('mouseup', stop); this.canvas.addEventListener('mouseleave', stop);
    }

    _handleMouseDown(e) {
            const m = this.getMousePos(e);
            
            // --- NEW: Visual Pivot Setting (Shift + Click) ---
            if (e.shiftKey && this.selectedBoneId) {
                const bone = this.rig[this.selectedBoneId];
                if (!bone || bone.assetId === "none" || !this.assets[bone.assetId]) return;

                const img = this.assets[bone.assetId];

                // 1. Get mouse in the Parent's coordinate space (to update X/Y Offsets)
                let pM = new DOMMatrix();
                if (bone.parent && this.rig[bone.parent].worldMatrix) {
                    pM = this.rig[bone.parent].worldMatrix;
                } else {
                    pM.translateSelf((this.canvas.width / 2) + this.cameraX, (this.canvas.height / 2) + this.cameraY);
                    pM.scaleSelf(this.zoomLevel, this.zoomLevel);
                }
                const pInv = pM.inverse();
                const parentMouseX = pInv.a * m.x + pInv.c * m.y + pInv.e;
                const parentMouseY = pInv.b * m.x + pInv.d * m.y + pInv.f;

                // 2. Get mouse in the Bone's current local space (to update the Pivot)
                const bInv = bone.worldMatrix.inverse();
                const localMouseX = bInv.a * m.x + bInv.c * m.y + bInv.e;
                const localMouseY = bInv.b * m.x + bInv.d * m.y + bInv.f;

                // Calculate the exact percentage across the PNG where the click happened
                const newPivotX = bone.pivotX + (localMouseX / img.width);
                const newPivotY = bone.pivotY + (localMouseY / img.height);

                // 3. Apply changes (Clamped between 0.0 and 1.0 to keep it on the image)
                bone.pivotX = Math.max(0, Math.min(1, newPivotX));
                bone.pivotY = Math.max(0, Math.min(1, newPivotY));
                
                // Only update the offset if the pivot actually moved (wasn't clamped out of bounds)
                bone.offsetX = parentMouseX;
                bone.offsetY = parentMouseY;

                // 4. Update the UI and save history
                this.selectBone(this.selectedBoneId); 
                this.saveState();
                this.requestRedraw();
                
                this.logOutput(`🎯 Pivot updated visually for ${this.selectedBoneId}`);
                return; // Stop here so we don't accidentally start dragging the bone
            }

            // ... Existing panning and dragging logic continues below ...
            if (e.button === 2) { this.isPanning = true; this.dragStart = { x: m.x, y: m.y }; this.initialCamera = { x: this.cameraX, y: this.cameraY }; this.canvas.style.cursor = 'grabbing'; return; }
            let cB = null;
            for (let i = this.renderOrder.length - 1; i >= 0; i--) {
                const b = this.rig[this.renderOrder[i]];
                if (!b.worldMatrix || b.assetId === "none" || !this.assets[b.assetId]) continue;
                const im = this.assets[b.assetId], inv = b.worldMatrix.inverse();
                const lX = inv.a * m.x + inv.c * m.y + inv.e, lY = inv.b * m.x + inv.d * m.y + inv.f;
                const l = -(im.width * b.pivotX), r = l + im.width, t = -(im.height * b.pivotY), bot = t + im.height;
                if (lX >= l && lX <= r && lY >= t && lY <= bot) { cB = b.id; break; }
            }
            if (cB) { 
                this.selectBone(cB); 
                this.isDraggingBone = true; 
                this.dragStart = { x: m.x, y: m.y }; 
                this.initialOffset = { x: this.rig[cB].offsetX, y: this.rig[cB].offsetY }; 
                this.requestRedraw();
            } 
            else { 
                this.selectedBoneId = null; 
                this.refreshAllUI(); 
                this.requestRedraw();
            }

    }

    async loadAssets() {
        try {
            const res = await fetch('../data/assets.json'); const data = await res.json();
            for (const cat in data) for (const [k, v] of Object.entries(data[cat])) {
                const img = new Image(); img.src = '../' + v.src;
                // Safely pass the originalX and originalY values into the state
                this.assets[k] = { 
                    element: img, 
                    width: v.w, 
                    height: v.h, 
                    category: cat,
                    originalX: v.originalX, 
                    originalY: v.originalY 
                };
            }
            if (this.selectedBoneId) this.selectBone(this.selectedBoneId);
        } catch (e) { console.warn("Missing assets.json"); }
        this.requestRedraw();
    }

    populateAssetDropdown(ft = '') {
        const sel = document.getElementById('prop-asset-id'), b = this.rig[this.selectedBoneId];
        if (!sel || !b) return;
        sel.innerHTML = '<option value="none">None (Invisible)</option>';
        const grp = {};
        for(const [k, a] of Object.entries(this.assets)) {
            if (ft && !k.toLowerCase().includes(ft.toLowerCase())) continue;
            const c = a.category || 'Imported'; if (!grp[c]) grp[c] = []; grp[c].push(k);
        }
        for (const c in grp) {
            const og = document.createElement('optgroup'); og.label = `--- ${c.toUpperCase()} ---`;
            grp[c].forEach(k => { const opt = document.createElement('option'); opt.value = k; opt.textContent = k; if (b.assetId === k) opt.selected = true; og.appendChild(opt); });
            sel.appendChild(og);
        }
    }

    populateParentDropdown(selectedId) {
        const sel = document.getElementById('prop-parent-id');
        if (!sel) return;
        sel.innerHTML = '';

        // Root cannot have a parent
        if (selectedId === 'root') {
            sel.innerHTML = '<option value="none">None (Root)</option>';
            sel.disabled = true;
            return;
        }
        sel.disabled = false;

        // Prevent circular parenting (a bone cannot be parented to its own descendant)
        const getDescendants = (id) => {
            let desc = [];
            const children = Object.values(this.rig).filter(b => b.parent === id).map(b => b.id);
            for (const child of children) {
                desc.push(child, ...getDescendants(child));
            }
            return desc;
        };
        const invalidParents = [selectedId, ...getDescendants(selectedId)];

        // Populate valid options
        for (const boneId of Object.keys(this.rig)) {
            if (invalidParents.includes(boneId)) continue;
            
            const opt = document.createElement('option');
            opt.value = boneId;
            opt.textContent = boneId;
            if (this.rig[selectedId].parent === boneId) opt.selected = true;
            sel.appendChild(opt);
        }
    }

    bindAssetImporter() {
        const uploader = document.getElementById('local-asset-upload'); if(!uploader) return;
        
        // 1. Allow the uploader to accept JSON files alongside PNGs
        uploader.setAttribute('accept', 'image/png, application/json, .json');
        
        uploader.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files); if (!files.length) return;

            // 2. Separate the JSON file from the PNGs
            const jsonFile = files.find(f => f.name.endsWith('.json'));
            const pngFiles = files.filter(f => f.name.endsWith('.png'));

            // 3. Parse the alignment data if a JSON was included
            let alignmentData = {};
            if (jsonFile) {
                try {
                    const text = await jsonFile.text();
                    const parsed = JSON.parse(text);
                    for (const cat in parsed) {
                        for (const [key, val] of Object.entries(parsed[cat])) {
                            alignmentData[key] = val;
                        }
                    }
                    this.logOutput(`🔍 Found alignment JSON containing data for ${Object.keys(alignmentData).length} assets.`);
                } catch(err) { console.error("Bad JSON", err); }
            }

            const proc = (f) => new Promise((res) => {
                const u = URL.createObjectURL(f), img = new Image();
                const assetKey = f.name.replace('.png', '');
                
                img.onload = () => {
                    // 4. If we have GIMP JSON data for this image, use it! (Bypass auto-crop)
                    if (alignmentData[assetKey] && alignmentData[assetKey].originalX !== undefined) {
                        res({ 
                            element: img, 
                            width: img.width, 
                            height: img.height, 
                            originalX: alignmentData[assetKey].originalX, 
                            originalY: alignmentData[assetKey].originalY, 
                            file: f 
                        });
                        return;
                    }

                    // 5. Fallback: If no JSON data exists, do the old slow browser auto-crop
                    const cvs = document.createElement('canvas'); cvs.width = img.width; cvs.height = img.height;
                    const ctx = cvs.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0);
                    const d = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
                    let mx = cvs.width, my = cvs.height, Mx = 0, My = 0;
                    for (let y = 0; y < cvs.height; y++) for (let x = 0; x < cvs.width; x++) if (d[(y * cvs.width + x) * 4 + 3] > 10) { if (x < mx) mx = x; if (x > Mx) Mx = x; if (y < my) my = y; if (y > My) My = y; }
                    if (Mx < mx) { res(null); return; }
                    const cW = Mx - mx + 1, cH = My - my + 1, cC = document.createElement('canvas'); cC.width = cW; cC.height = cH;
                    cC.getContext('2d').drawImage(cvs, mx, my, cW, cH, 0, 0, cW, cH);
                    res({ element: cC, width: cW, height: cH, originalX: mx, originalY: my, file: f });
                }; 
                img.src = u;
            });

            const loaded = (await Promise.all(pngFiles.map(proc))).filter(f => f !== null);
            loaded.forEach(a => this.assets[a.file.name.replace('.png', '')] = { ...a, category: 'Imported_New' });
            
            this.logOutput(`✅ Imported ${loaded.length} assets.`);
            if (this.selectedBoneId) this.selectBone(this.selectedBoneId);
            this.requestRedraw();
        });
    }

    handleExportPngs() {
        const used = new Set(); for (const b in this.rig) if (this.rig[b].assetId && this.rig[b].assetId !== "none") used.add(this.rig[b].assetId);
        if (!used.size) return alert("No image assets assigned!");
        const sc = parseFloat(prompt("Scale factor:", "0.5")); if (isNaN(sc) || sc <= 0) return;
        let c = 0;
        for (const id of used) {
            const a = this.assets[id]; if (!a || !a.element) continue;
            const cvs = document.createElement('canvas'); cvs.width = Math.max(1, Math.round(a.width * sc)); cvs.height = Math.max(1, Math.round(a.height * sc));
            cvs.getContext('2d').drawImage(a.element, 0, 0, cvs.width, cvs.height);
            const l = document.createElement('a'); l.download = id + ".png"; l.href = cvs.toDataURL(); l.click(); c++;
        }
        this.logOutput(`Exported ${c} PNGs.`);
    }

    handleAutoAlign() {
        let mx = Infinity, my = Infinity, Mx = -Infinity, My = -Infinity;
        for (const k in this.assets) {
            const a = this.assets[k];
            if (a.originalX !== undefined) { if (a.originalX < mx) mx = a.originalX; if (a.originalY < my) my = a.originalY; if (a.originalX + a.width > Mx) Mx = a.originalX + a.width; if (a.originalY + a.height > My) My = a.originalY + a.height; }
        }
        if (mx === Infinity) { mx = 0; my = 0; Mx = 1000; My = 1000; }
        const cX = mx + (Mx - mx) / 2, bY = My, abs = {};
        const getAbs = (bId) => {
            if (bId === "root") return { x: cX, y: bY };
            const b = this.rig[bId];
            if (!b || b.assetId === "none" || !this.assets[b.assetId]) return b.parent ? getAbs(b.parent) : { x: cX, y: bY };
            const a = this.assets[b.assetId]; return { x: a.originalX + (a.width * b.pivotX), y: a.originalY + (a.height * b.pivotY) };
        };
        for (const b in this.rig) abs[b] = getAbs(b);
        for (const b in this.rig) { if (b === "root") continue; this.rig[b].offsetX = abs[b].x - (abs[this.rig[b].parent] || {x:cX,y:bY}).x; this.rig[b].offsetY = abs[b].y - (abs[this.rig[b].parent] || {x:cX,y:bY}).y; }
        this.saveState(); if (this.selectedBoneId) this.selectBone(this.selectedBoneId);
        this.requestRedraw();
    }
}

window.onload = () => { window.composer = new SpriteComposer(); };
