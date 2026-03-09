/* =========================================
   js/core/StateManager.js
   Handles Persistence (Save/Load) and 
   Navigation History (Back Button Support)
   ========================================= */

export class StateManager {
    constructor() {
        this.STORAGE_KEY = 'tintin_adventure_save_v1';
        this.currentState = this.loadProgress();
        
        // Bind context for event listeners
        this.handlePopState = this.handlePopState.bind(this);
    }

    // --- PART A: PERSISTENCE (LocalStorage) ---

    loadProgress() {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (raw) {
            try {
                const data = JSON.parse(raw);
                if (data.maxPageIndex === undefined) {
                    data.maxPageIndex = data.pageIndex || 0;
                    data.maxPanelIndex = data.panelIndex || 0;
                }
                return data;
            } catch (e) {
                console.warn("Corrupt save file. Resetting.");
            }
        }
        return {
            pageIndex: 0,
            panelIndex: 0,
            maxPageIndex: 0,
            maxPanelIndex: 0,
            completedGames: {} 
        };
    }

    saveProgress(pageIndex, panelIndex) {
        this.currentState.pageIndex = pageIndex;
        this.currentState.panelIndex = panelIndex;
        
        // Update max progress if we've read further than before
        if (this.currentState.maxPageIndex === undefined || pageIndex > this.currentState.maxPageIndex) {
            this.currentState.maxPageIndex = pageIndex;
            this.currentState.maxPanelIndex = panelIndex;
        } else if (pageIndex === this.currentState.maxPageIndex) {
            // If on the max page, check if we've moved to a further panel
            if (this.currentState.maxPanelIndex === undefined || panelIndex > this.currentState.maxPanelIndex) {
                this.currentState.maxPanelIndex = panelIndex;
            }
        }
        
        this._commit();
    }

    markGameComplete(moduleId, levelId) {
        // Create a unique key for specific game instances
        const key = `${moduleId}_${levelId}`;
        this.currentState.completedGames[key] = true;
        this._commit();
    }

    isGameComplete(moduleId, levelId) {
        const key = `${moduleId}_${levelId}`;
        return !!this.currentState.completedGames[key];
    }

    _commit() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentState));
    }

    // --- PART B: HISTORY (Back Button) ---

    initHistory(onNavigateBack) {
        this.onNavigateBack = onNavigateBack;

        // 1. Set initial state so we have something to pop back to
        // We replace the current "empty" state with our actual location
        const initialState = { 
            page: this.currentState.pageIndex, 
            panel: this.currentState.panelIndex 
        };
        history.replaceState(initialState, '', `?page=${this.currentState.pageIndex}`);

        // 2. Listen for the Back Button
        window.addEventListener('popstate', this.handlePopState);
    }

    pushState(pageIndex, panelIndex) {
        // Only push if different from current history state to avoid duplicates
        const state = { page: pageIndex, panel: panelIndex };
        
        // Update URL for easy sharing/debugging (e.g., ?page=102)
        const url = `?page=${pageIndex}`; // We can add &panel=${panelIndex} if desired
        
        history.pushState(state, '', url);
    }

    handlePopState(event) {
        if (event.state) {
            console.log("⬅️ History Back:", event.state);
            // Notify App to update the view
            if (this.onNavigateBack) {
                this.onNavigateBack(event.state.page, event.state.panel);
            }
        }
    }
}
