/* =========================================
   js/core/AnimationController.js
   Pillar 3: The Animator & Tweening Engine
   ========================================= */

export class AnimationController {
    /**
     * @param {SkeletonRig} skeletonRig - The instantiated math rig to manipulate
     */
    constructor(skeletonRig) {
        this.rig = skeletonRig;
        
        // Playback State
        this.currentAnim = null;
        this.currentTime = 0; // In seconds
        this.fps = 30; // The authoring framerate from Sprite Composer
        this.duration = 0; // In seconds
        this.isLooping = true;
        this.isPlaying = false;

        // Blending State (Crossfading between animations)
        this.isBlending = false;
        this.blendTimer = 0;
        this.blendDuration = 0;
        this.blendSnapshot = {}; // Saves the exact rig pose when a blend starts

        // Track the last frame we rendered to avoid redundant math
        this.lastCalculatedFrame = -1;
    }

    /**
     * Loads and plays an animation JSON payload
     * @param {Object} animData - The parsed JSON data (e.g., from assets.get('anim_haddock_push'))
     * @param {boolean} loop - Whether to repeat
     * @param {number} blendTimeMs - Milliseconds to smoothly crossfade from current pose to new animation
     */
    play(animData, loop = true, blendTimeMs = 200) {
        if (!animData || !animData.tracks) {
            console.error("Invalid animation data provided to AnimationController");
            return;
        }

        // 1. Snapshot the current pose for smooth blending
        if (this.currentAnim && blendTimeMs > 0) {
            this._captureBlendSnapshot();
            this.isBlending = true;
            this.blendTimer = 0;
            this.blendDuration = blendTimeMs / 1000.0; // Convert to seconds
        } else {
            this.isBlending = false;
        }

        // 2. Initialize new animation state
        this.currentAnim = animData;
        this.currentTime = 0;
        this.isLooping = loop;
        this.isPlaying = true;
        this.lastCalculatedFrame = -1; // Reset dirty tracker on new animation
        
        // FIX: Dynamically calculate total duration by finding the latest keyframe
        let totalFrames = animData.length;
        if (!totalFrames) {
            let maxFrame = 0;
            for (const track of Object.values(animData.tracks)) {
                for (const keyframeArray of Object.values(track)) {
                    if (Array.isArray(keyframeArray) && keyframeArray.length > 0) {
                        const lastKey = keyframeArray[keyframeArray.length - 1];
                        if (lastKey.frame > maxFrame) maxFrame = lastKey.frame;
                    }
                }
            }
            totalFrames = maxFrame > 0 ? maxFrame : 60; // Safe fallback
        }
        
        this.duration = totalFrames / this.fps;
    }


    stop() {
        this.isPlaying = false;
    }

    /**
     * Hook this into your Game.js loop
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        if (!this.isPlaying || !this.currentAnim) return false;

        // 1. Advance Time
        this.currentTime += dt;
        let hitEnd = false;

        if (this.currentTime >= this.duration) {
            if (this.isLooping) {
                this.currentTime = this.currentTime % this.duration;
                this.lastCalculatedFrame = -1; // Force visual update on wrap-around
            } else {
                this.currentTime = this.duration;
                this.isPlaying = false; 
                hitEnd = true;
            }
        }

        // 2. Advance Blend Timer
        let blendFactor = 1.0;
        if (this.isBlending) {
            this.blendTimer += dt;
            blendFactor = this.blendTimer / this.blendDuration;
            if (blendFactor >= 1.0) {
                blendFactor = 1.0;
                this.isBlending = false;
            }
        }

        // 3. OPTIMIZATION: Frame Quantization
        const currentFrame = this.currentTime * this.fps;
        const discreteFrame = Math.floor(currentFrame);
        
        let shouldUpdateVisuals = false;
        
        // Always run math at 60fps if crossfading, or if hitting the exact final frame
        if (this.isBlending || hitEnd) {
            shouldUpdateVisuals = true; 
        } 
        // Otherwise, only run math if the authoring frame (30fps) advanced
        else if (discreteFrame !== this.lastCalculatedFrame) {
            shouldUpdateVisuals = true;
            this.lastCalculatedFrame = discreteFrame;
        }

        // BAIL OUT: The character didn't move this frame, skip the math!
        if (!shouldUpdateVisuals) {
            if (hitEnd && this.onComplete) this.onComplete();
            return false; 
        }

        // 4. Apply timeline tracks to the Rig
        for (const boneId of Object.keys(this.rig.bones)) {
            const bone = this.rig.bones[boneId];
            const track = this.currentAnim.tracks[boneId] || {}; 

            const targetRot = this._interpolateTrack(track.rotation, currentFrame, bone.baseRotation);
            const targetOffsetX = this._interpolateTrack(track.offsetX, currentFrame, bone.baseOffsetX);
            const targetOffsetY = this._interpolateTrack(track.offsetY, currentFrame, bone.baseOffsetY);
            const targetScaleX = this._interpolateTrack(track.scaleX, currentFrame, 1.0); 
            const targetScaleY = this._interpolateTrack(track.scaleY, currentFrame, 1.0);
            
            const targetAssetId = this._getDiscreteValue(track.assetId, currentFrame, bone.baseAssetId);

            if (this.isBlending && this.blendSnapshot[boneId]) {
                const snap = this.blendSnapshot[boneId];
                bone.rotation = this._lerp(snap.rotation, targetRot, blendFactor);
                bone.offsetX = this._lerp(snap.offsetX, targetOffsetX, blendFactor);
                bone.offsetY = this._lerp(snap.offsetY, targetOffsetY, blendFactor);
                bone.scaleX = this._lerp(snap.scaleX, targetScaleX, blendFactor);
                bone.scaleY = this._lerp(snap.scaleY, targetScaleY, blendFactor);
            } else {
                bone.rotation = targetRot;
                bone.offsetX = targetOffsetX;
                bone.offsetY = targetOffsetY;
                bone.scaleX = targetScaleX;
                bone.scaleY = targetScaleY;
            }

            if (targetAssetId !== undefined) {
                bone.currentAssetId = targetAssetId;
            }
        }
        
        // Fire FSM event after drawing the final frame
        if (hitEnd && this.onComplete) this.onComplete();

        // Tell the game loop this character moved
        return true; 
    }


    /**
     * Caches the exact positions of all bones right before a new animation starts
     */
    _captureBlendSnapshot() {
        this.blendSnapshot = {};
        for (const boneId in this.rig.bones) {
            const b = this.rig.bones[boneId];
            this.blendSnapshot[boneId] = {
                rotation: b.rotation,
                offsetX: b.offsetX,
                offsetY: b.offsetY,
                scaleX: b.scaleX !== undefined ? b.scaleX : 1.0,
                scaleY: b.scaleY !== undefined ? b.scaleY : 1.0
            };
        }
    }

    /**
     * Finds the bounding keyframes and interpolates a value mathematically
     */
    _interpolateTrack(keyframeArray, currentFrame, fallbackValue) {
        if (!keyframeArray || keyframeArray.length === 0) return fallbackValue;
        if (keyframeArray.length === 1) return keyframeArray[0].value;

        let prevKey = keyframeArray[0];
        let nextKey = keyframeArray[keyframeArray.length - 1];

        // Bounds checking
        if (currentFrame <= prevKey.frame) return prevKey.value;
        if (currentFrame >= nextKey.frame) return nextKey.value;

        // Locate the bounding frames
        for (let i = 0; i < keyframeArray.length - 1; i++) {
            if (currentFrame >= keyframeArray[i].frame && currentFrame < keyframeArray[i+1].frame) {
                prevKey = keyframeArray[i];
                nextKey = keyframeArray[i+1];
                break;
            }
        }

        // Linear Interpolation (Lerp)
        const t = (currentFrame - prevKey.frame) / (nextKey.frame - prevKey.frame);
        return this._lerp(prevKey.value, nextKey.value, t);
    }

    /**
     * For string values (like asset IDs) that cannot be interpolated
     */
    _getDiscreteValue(keyframeArray, currentFrame, fallbackValue) {
        if (!keyframeArray || keyframeArray.length === 0) return fallbackValue;
        
        let activeValue = keyframeArray[0].value;
        for (let i = 0; i < keyframeArray.length; i++) {
            if (currentFrame >= keyframeArray[i].frame) {
                activeValue = keyframeArray[i].value;
            } else {
                break;
            }
        }
        return activeValue;
    }

    _lerp(start, end, t) {
        return start + (end - start) * t;
    }
}
