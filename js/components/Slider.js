export class Slider {
    constructor(config) {
        this.x = config.x;
        this.y = config.y;
        this.w = config.w || 40;
        this.h = config.h || 300;
        
        // NEW: Allow padding inside the track asset
        this.yStart = config.yStart !== undefined ? config.yStart : 0;
        this.yEnd = config.yEnd !== undefined ? config.yEnd : this.h;
        
        this.value = config.value || 0.5; // 0.0 to 1.0
        this.isVertical = config.isVertical !== false; // Default true
        this.isDragging = false;
        
        this.trackAsset = config.trackAsset;
        this.thumbAsset = config.thumbAsset;
        this.assetManager = config.assetManager;
    }

    handleInput(type, x, y) {
        // Hit Box with generous padding (matches original easy-grab logic)
        const hitX = x >= this.x - 40 && x <= this.x + this.w + 40;
        const hitY = y >= this.y - 50 && y <= this.y + this.h + 50;

        if (type === 'DOWN' && hitX && hitY) {
            this.isDragging = true;
            this.updateValue(x, y);
            return true; 
        } else if (type === 'MOVE' && this.isDragging) {
            this.updateValue(x, y);
            return true;
        } else if (type === 'UP') {
            this.isDragging = false;
        }
        return false;
    }

    updateValue(inputX, inputY) {
        if (this.isVertical) {
            // Constrain mapping between yStart and yEnd instead of 0 and h
            const activeHeight = this.yEnd - this.yStart;
            let val = 1.0 - ((inputY - (this.y + this.yStart)) / activeHeight);
            this.value = Math.max(0, Math.min(1, val));
        } else {
            let val = (inputX - this.x) / this.w;
            this.value = Math.max(0, Math.min(1, val));
        }
    }

    draw(ctx) {
        // Draw Track
        const trackImg = this.assetManager.get(this.trackAsset);
        if (trackImg) {
            ctx.drawImage(trackImg, this.x, this.y, this.w, this.h);
        } else {
            ctx.fillStyle = '#444';
            ctx.fillRect(this.x + this.w/2 - 5, this.y, 10, this.h);
        }

        // Draw Thumb
        let thumbX = this.x + this.w/2;
        let thumbY;

        if (this.isVertical) {
            // Constrain rendering to yStart and yEnd bounds
            const activeHeight = this.yEnd - this.yStart;
            thumbY = this.y + this.yStart + (1.0 - this.value) * activeHeight;
        } else {
            thumbX = this.x + (this.value * this.w);
            thumbY = this.y + this.h/2;
        }
        
        const thumbImg = this.assetManager.get(this.thumbAsset);
        if (thumbImg) {
            ctx.drawImage(thumbImg, thumbX - 32, thumbY - 32, 64, 64);
        } else {
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(thumbX, thumbY, 20, 0, Math.PI*2); ctx.fill();
        }
    }
}
