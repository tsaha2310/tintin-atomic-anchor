/* =========================================
   js/core/AssetManager.js
   Updated to support dynamically fetching JSON files
   ========================================= */

export class AssetManager {
    constructor() {
        this.manifest = null;
        this.cache = new Map(); // Stores loaded Image objects AND JSON objects
        this.useGreybox = false; // Toggle for debugging
    }

    /**
     * Loads the master asset registry
     */
    async loadManifest() {
        const t = Date.now();
        const response = await fetch(`data/assets.json?t=${t}`);
        this.manifest = await response.json();
        console.log("📦 Asset Manifest Loaded");
    }

    /**
     * Preloads a list of asset IDs (e.g., ['bg_crate', 'prop_magnet', 'rig_haddock'])
     * Returns a Promise that resolves when all are ready.
     */
    async loadBatch(assetIds) {
        const promises = assetIds.map(id => this.loadOne(id));
        await Promise.all(promises);
    }

    /**
     * Loads a batch of assets, then automatically scrapes any loaded JSON files
     * for nested dependencies (like skins needing images, or FSMs needing animations)
     * and loads those too.
     */
    async loadWithDependencies(assetIds) {
        // 1. Load the primary requested assets (the FSMs, Skins, Rigs, etc.)
        await this.loadBatch(assetIds);
        
        // 2. Set up a unique collection to hold the discovered dependencies
        const discoveredDependencies = new Set();
        
        // 3. Scan the newly loaded assets
        assetIds.forEach(id => {
            const data = this.cache.get(id);
            // Only scrape pure JSON objects, skip Images and Canvases
            if (data && typeof data === 'object' && !(data instanceof Image) && !(data instanceof HTMLCanvasElement)) {
                this._scrapeForDependencies(data, discoveredDependencies);
            }
        });

        // 4. Filter out assets we already have in the cache
        const dependenciesToLoad = Array.from(discoveredDependencies).filter(depId => !this.cache.has(depId));

        // 5. If we found new things, load them!
        if (dependenciesToLoad.length > 0) {
            console.log(`🔍 Auto-loading ${dependenciesToLoad.length} discovered dependencies:`, dependenciesToLoad);
 
            // DEEP-LOADING ACTIVATED: Recursively scrape the newly loaded JSONs!
            await this.loadWithDependencies(dependenciesToLoad);            
        }
    }

    /**
     * Recursively walks through a JSON object looking for specific engine keys,
     * safely handling both static strings and animated keyframe arrays.
     */
    _scrapeForDependencies(obj, resultSet) {
        if (!obj) return;
        
        // A. Handle 'assetId' (Used by Skins and Animations)
        if (typeof obj.assetId === 'string') {
            // Static Skin Mapping: { "assetId": "ch_haddock_mouth" }
            resultSet.add(obj.assetId);   
        } 
        else if (Array.isArray(obj.assetId)) {
            // Animation Track: { "assetId": [ { frame: 0, value: "ch_haddock_mouth" } ] }
            obj.assetId.forEach(keyframe => {
                if (keyframe && typeof keyframe.value === 'string') {
                    resultSet.add(keyframe.value);
                }
            });
        }

        // B. Handle 'animation' (Used by FSM States)
        if (typeof obj.animation === 'string') {
            resultSet.add(obj.animation); 
        }
        
        // C. Recursively dig deeper into the JSON tree
        Object.values(obj).forEach(value => {
            if (value !== null && typeof value === 'object') {
                this._scrapeForDependencies(value, resultSet);
            }
        });
    }

    loadOne(id) {
        return new Promise((resolve, reject) => {
            if (this.cache.has(id)) return resolve(this.cache.get(id));

            let config = null;

            if (this.manifest.common && this.manifest.common[id]) {
                config = this.manifest.common[id];
            } else {
                for (const category in this.manifest) {
                    if (this.manifest[category][id]) {
                        config = this.manifest[category][id];
                        break;
                    }
                }
            }

            if (!config) {
                console.warn(`⚠️ Asset ID not found: ${id}`);
                this.cache.set(id, this.createPlaceholder(id, 64, 64, { placeholderColor: '#FF0000' }));
                return resolve();
            }

            // ==========================================
            // FIX: Explicitly check for missing src
            // ==========================================
            if (!config.src || this.useGreybox) {
                // Ensure we pass safe fallback dimensions if w/h are missing from JSON
                this.cache.set(id, this.createPlaceholder(id, config.w || 64, config.h || 64, config));
                return resolve();
            }

            if (config.type === 'json') {
                fetch(config.src)
                    .then(response => {
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        return response.json();
                    })
                    .then(data => {
                        this.cache.set(id, data);
                        resolve(data);
                    })
                    .catch(err => {
                        console.error(`❌ Failed to load JSON asset: ${config.src}`, err);
                        this.cache.set(id, null); 
                        resolve(); 
                    });
                
                return; 
            }

            const img = new Image();
            img.src = config.src;
            
            img.onload = () => {
                this.cache.set(id, img);
                resolve(img);
            };

            img.onerror = () => {
                console.error(`❌ Failed to load: ${config.src}`);
                this.cache.set(id, this.createPlaceholder(id, config.w || 64, config.h || 64, { ...config, placeholderColor: '#FFA500' }));
                resolve(); 
            };
        });
    }

    /**
     * Generates a smart placeholder canvas
     */
    createPlaceholder(id, w = 64, h = 64, config = {}) {
        const cvs = document.createElement('canvas');
        cvs.width = w;
        cvs.height = h;
        const ctx = cvs.getContext('2d');
        
        // 1. Generate a vibrant HSL color based on string hash (Avoids the hex black-box bug)
        const bgColor = config.placeholderColor || this._generateVibrantColor(id);
        
        // Draw Box
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);
        
        // Draw Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, w, h);

        // 2. Format Text (Strip gXX_ prefixes and _gXX suffixes)
        let displayText = config.placeholderText || id.replace(/^g\d+_+/, '').replace(/_+g\d+$/, '');
        let lines = displayText.split('_'); 

        // 3. Smart Typography
        // Ensure font is readable but fits the box
        let fontSize = Math.max(8, Math.min(20, Math.floor(w / 4)));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const lineHeight = fontSize * 1.2;
        const startY = (h / 2) - ((lines.length - 1) * lineHeight) / 2;

        lines.forEach((line, index) => {
            const safeLine = line.length > 8 ? line.substring(0, 7) + '…' : line;
            const y = startY + (index * lineHeight);
            
            // Draw thick black stroke for perfect contrast against any background color
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000000';
            ctx.strokeText(safeLine, w / 2, y);
            
            // Draw white fill
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(safeLine, w / 2, y);
        });

        return cvs; 
    }

    // --- Helper Math Methods ---

    _generateVibrantColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Use HSL (Hue, Saturation, Lightness) to guarantee a colorful background
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 75%, 45%)`; 
    }

    get(id) {
        return this.cache.get(id);
    }
}
