export class SkeletonRig {
    constructor(rigData) {
        this.rigId = rigData.rigId; 
        this.bones = {};
        this.rootBoneId = "root";
        
        // 1. Initialize Bones from JSON
        rigData.bones.forEach(boneDef => {
            this.bones[boneDef.name] = {
                id: boneDef.name,
                parent: boneDef.parent,
                pivotX: boneDef.pivot.x,
                pivotY: boneDef.pivot.y,

                // Save Base rig transforms safely
                baseOffsetX: boneDef.defaultOffset.x,
                baseOffsetY: boneDef.defaultOffset.y,
                baseRotation: boneDef.defaultRotation,
                baseAssetId: "none",
                
                // Active transforms (Modified by Animator)
                offsetX: boneDef.defaultOffset.x,
                offsetY: boneDef.defaultOffset.y,
                rotation: boneDef.defaultRotation,
                
                // Active transforms (Modified by Animator and Skin)
                scaleX: 1.0,
                scaleY: 1.0,
                skinScale: 1.0, // FIX 1: Dedicated skin scale multiplier
                
                // Rendering data
                baseZIndex: boneDef.zIndex,
                currentZIndex: boneDef.zIndex, // FIX 2: Dynamic Z-Index
                currentAssetId: "none",
                
                children: [] 
            };
        });

        // 2. Build the Hierarchy Tree
        Object.values(this.bones).forEach(bone => {
            if (bone.parent && this.bones[bone.parent]) {
                this.bones[bone.parent].children.push(bone.id);
            }
        });

        this.sortRenderOrder();
    }

    /**
     * Applies a skin profile to map assets, scales, and z-offsets to the skeleton.
     */
    applySkin(skinData) {
        let requiresResort = false;

        // FIX 3: Prevent "Partial Skin" State Leakage
        // First, reset all bones to "none" and strip previous skin modifications
        for (const boneId in this.bones) {
            const bone = this.bones[boneId];
            bone.currentAssetId = "none";
            bone.skinScale = 1.0;
            
            if (bone.currentZIndex !== bone.baseZIndex) {
                bone.currentZIndex = bone.baseZIndex;
                requiresResort = true;
            }
        }

        // Apply new skin mappings
        for (const [boneName, mapping] of Object.entries(skinData.mappings)) {
            if (this.bones[boneName]) {
                const bone = this.bones[boneName];
                bone.currentAssetId = mapping.assetId;
                bone.baseAssetId = mapping.assetId;
                
                // FIX 1: Apply skin-specific scaling
                if (mapping.scale !== undefined) {
                    bone.skinScale = mapping.scale;
                }

                // FIX 2: Apply dynamic Z-Index offsets
                if (mapping.zIndexOffset !== undefined && mapping.zIndexOffset !== 0) {
                    bone.currentZIndex = bone.baseZIndex + mapping.zIndexOffset;
                    requiresResort = true;
                }
            }
        }

        // FIX 2: Re-sort the render array if Z-indexes changed
        if (requiresResort) {
            this.sortRenderOrder();
        }
    }

    sortRenderOrder() {
        this.renderOrder = Object.keys(this.bones).sort((a, b) => {
            return this.bones[a].currentZIndex - this.bones[b].currentZIndex;
        });
    }

    draw(ctx, assetManager, x, y, flipX = false, scale = 1.0) {
        ctx.save();
        ctx.translate(x, y);
        if (flipX) ctx.scale(-1, 1);
        ctx.scale(scale, scale);

        this._calculateTransforms(ctx, this.rootBoneId);

        // Draw everything in the dynamically sorted Z-Index order
        this.renderOrder.forEach(boneId => {
            const bone = this.bones[boneId];
            if (bone.currentAssetId !== "none" && bone.worldMatrix) {
                const imgAsset = assetManager.get(bone.currentAssetId);
                if (imgAsset) {
                    ctx.save();
                    ctx.setTransform(bone.worldMatrix);

                    // 1. Detect if this is a greybox (canvas) vs a real image
                    const isPlaceholder = imgAsset instanceof HTMLCanvasElement;
                    
                    // 2. If it's a placeholder, multiply by the inverse scale to cancel it out
                    const placeholderCorrection = isPlaceholder ? (1.0 / scale) : 1.0;

                    // 3. Apply the correction alongside the skinScale
                    const finalWidth = imgAsset.width * bone.skinScale * placeholderCorrection;
                    const finalHeight = imgAsset.height * bone.skinScale * placeholderCorrection;

                    const drawX = -(finalWidth * bone.pivotX);
                    const drawY = -(finalHeight * bone.pivotY);
                    
                    ctx.drawImage(imgAsset, drawX, drawY, finalWidth, finalHeight);
                    
                    ctx.restore();
                }
            }
        });

        ctx.restore();
    }

    _calculateTransforms(ctx, boneId) {
        const bone = this.bones[boneId];
        if (!bone) return;

        ctx.save();
        ctx.translate(bone.offsetX, bone.offsetY);
        ctx.rotate(bone.rotation * (Math.PI / 180));
        ctx.scale(bone.scaleX, bone.scaleY);

        bone.worldMatrix = ctx.getTransform();

        bone.children.forEach(childId => {
            this._calculateTransforms(ctx, childId);
        });

        ctx.restore();
    }
}
