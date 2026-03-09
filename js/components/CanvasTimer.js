export class CanvasTimer {
    constructor(assetManager, size = 120) {
        this.assetManager = assetManager;
        this.size = size;
    }

    draw(ctx, x, y, timeSpent, totalTime) {
        const body = this.assetManager.get('ui_timer_body');
        const hand = this.assetManager.get('ui_timer_hand');
        
        // Draw Body
        if (body) {
            ctx.drawImage(body, x, y, this.size, this.size);
        } else {
            ctx.fillStyle = '#eee';
            ctx.beginPath();
            ctx.arc(x + this.size/2, y + this.size/2, this.size/2, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // Draw Hand
        if (hand) {
            ctx.save();
            const cx = x + this.size/2;
            const cy = y + this.size/2;
            
            const pct = Math.min(1, timeSpent / totalTime);
            const angle = pct * (Math.PI * 2);

            ctx.translate(cx, cy);
            ctx.rotate(angle);
            
            const handW = this.size * 0.15;
            const handH = this.size * 0.4; 
            ctx.drawImage(hand, -handW/2, -handH + (this.size*0.08), handW, handH); 
            ctx.restore();
        }
        
        // Draw Text
        const timeLeft = Math.max(0, totalTime - timeSpent).toFixed(0);
        
        if (timeLeft <= 10) ctx.fillStyle = '#FF4444'; // Or adapt your custom logic
        else if (timeLeft <= totalTime/2) ctx.fillStyle = '#FFAA00';
        else ctx.fillStyle = '#00FF00';
        
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.shadowColor = 'black'; 
        ctx.shadowBlur = 4;
        ctx.fillText(timeLeft + "s", x + this.size/2, y + this.size + 20);
        ctx.shadowBlur = 0;
    }
}
