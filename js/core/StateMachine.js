/* =========================================
   js/core/StateMachine.js
   Pillar 4: The Brain (Logic & Transitions)
   ========================================= */

export class StateMachine {
    /**
     * @param {AnimationController} animator - The tweening engine to control
     * @param {Object} fsmConfig - The parsed JSON configuration for this level
     * @param {AssetManager} assetManager - To fetch the actual animation JSONs
     */
    constructor(animator, fsmConfig, assetManager) {
        this.animator = animator;
        this.config = fsmConfig;
        this.assetManager = assetManager;
        this.animator.onComplete = () => this._handleAnimationComplete();
        
        this.currentStateId = null;
        
        if (this.config && this.config.initialState) {
            this.forceState(this.config.initialState);
        }
    }

    _handleAnimationComplete() {
        if (!this.currentStateId) return;
        const currentState = this.config.states[this.currentStateId];
        
        // Look for an automatic transition when the animation finishes
        const transition = currentState.transitions?.find(t => t.trigger === "ON_ANIM_END");
        if (transition && this.config.states[transition.targetState]) {
            this._changeState(transition.targetState, transition.blendOverrideMs);
        }
    }

    /**
     * Sends an event/trigger to the brain. If a valid transition exists, 
     * the state changes and the new animation plays.
     * @param {string} triggerName - e.g., "PAN_RUBBED", "STAMINA_DEPLETED"
     */
    dispatch(triggerName) {
        if (!this.currentStateId || !this.config.states[this.currentStateId]) return;

        const currentState = this.config.states[this.currentStateId];
        
        // Look for a valid transition based on the trigger
        const transition = currentState.transitions?.find(t => t.trigger === triggerName);
        
        if (transition && this.config.states[transition.targetState]) {
            // Valid transition found! Change the state.
            this._changeState(transition.targetState, transition.blendOverrideMs);
        }
    }

    /**
     * Forces the machine into a specific state immediately (ignoring triggers)
     */
    forceState(newStateId) {
        if (this.config.states[newStateId]) {
            this._changeState(newStateId);
        } else {
            console.warn(`State '${newStateId}' not found in FSM config.`);
        }
    }

    /**
     * Internal logic to handle the state swap and tell the Animator what to do
     */
    _changeState(newStateId, blendOverrideMs = null) {
        this.currentStateId = newStateId;
        const stateData = this.config.states[newStateId];

        if (stateData.animation) {
            // Fetch the actual animation data using the ID specified in the FSM JSON
            const animData = this.assetManager.get(stateData.animation);
            
            if (animData) {
                // Use the state's defined blend duration, or an override if provided by the transition
                const blendTime = blendOverrideMs !== null ? blendOverrideMs : (stateData.blendDurationMs || 0);
                
                // By default, most idle/walking states loop. You can add a "loop: false" to your JSON for one-offs
                const shouldLoop = stateData.loop !== false; 
                
                this.animator.play(animData, shouldLoop, blendTime);
            } else {
                console.warn(`Animation '${stateData.animation}' requested by FSM but not found in AssetManager.`);
            }
        }
    }

    getCurrentState() {
        return this.currentStateId;
    }
}
