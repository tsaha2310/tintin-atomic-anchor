/* =========================================
   js/components/QuizOverlay.js
   Extended to support custom background assets,
   Comic-Style Animations, Character Feedback (Snowy),
   and Pure CSS Confetti Bursts (Enhanced)
   ========================================= */

export class QuizOverlay {
    constructor(uiRoot, assetManager) {
        this.uiRoot = uiRoot;
        this.assetManager = assetManager; 
        this.overlayElement = null;
        this.injectCSS();
        
        // ENCAPSULATION: Silently preload the default feedback assets
        this.defaultAssets = {
            correct: new Image(),
            wrong: new Image()
        };
        this.defaultAssets.correct.src = 'assets/ui/snowy_correct.png';
        this.defaultAssets.wrong.src = 'assets/ui/snowy_incorrect.png';
    }

    injectCSS() {
        let styleElement = document.getElementById('quiz-overlay-styles');
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'quiz-overlay-styles';
            document.head.appendChild(styleElement);
        }

        styleElement.innerHTML = `
            .quiz-overlay-container {
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                width: 600px; max-width: 90%; 
                display: flex; flex-direction: column; gap: 12px;
                z-index: 2000;
            }
            .quiz-choice-btn {
                padding: 15px; font-size: 18px; cursor: pointer;
                background: rgba(255, 255, 255, 0.95);
                border: 2px solid #1a1a1a; border-radius: 12px;
                font-family: sans-serif; box-shadow: 0 4px 0 rgba(0,0,0,0.2);
                transition: transform 0.1s, background 0.2s, opacity 0.3s;
                text-align: left; line-height: 1.4;
                color: #1a1a1a;
            }
            
            .quiz-choice-btn:hover:not(:disabled) {
                background-color: #f0f8ff;    
                transform: translateY(-3px); box-shadow: 0 7px 0 rgba(0,0,0,0.15);
            }
            .quiz-choice-btn:active:not(:disabled) {
                transform: translateY(2px); box-shadow: 0 2px 0 rgba(0,0,0,0.2);
            }
            
            .quiz-choice-btn:disabled {
                background-color: #f8ecec; color: #a05a5a; border-color: #d0b0b0;
                box-shadow: none; transform: translateY(4px); opacity: 0.7; cursor: default;
            }
            
            .quiz-overlay-themed {
                /* CRITICAL FIX: Forces padding to shrink inward rather than push the container off screen */
                box-sizing: border-box !important; 
                
                background-size: 100% 100%;
                background-repeat: no-repeat;
                background-position: center;
                
                /* Increased Base Desktop Clearances */
                padding: 100px 40px 30px 40px; 
                width: 550px; 
                height: 700px; 
                max-height: 90vh; 
                justify-content: flex-start; /* Flow from top down */
            }

            .quiz-overlay-locked .quiz-choice-btn { pointer-events: none; }
            .quiz-choice-btn.dimmed { opacity: 0.4; filter: grayscale(100%); }

            /* --- GLOBAL SCROLL WRAPPER STYLES --- */
            /* Centralized here so any game appending these classes inherits perfect flexbox scrolling */
            .quiz-header {
                color: #2c1e16 !important; text-align: center; font-family: 'Comic Sans MS', sans-serif;
                margin-top: 0; margin-bottom: 12px; text-shadow: none !important; 
            }
            .quiz-scroll-wrapper {
                flex: 1 1 auto; min-height: 0; max-height: 100%; 
                overflow-y: auto; padding: 5px; display: flex; flex-direction: column; gap: 8px;
                -ms-overflow-style: none; scrollbar-width: none;
            }
            .quiz-scroll-wrapper::-webkit-scrollbar { display: none; }

            /* --- BUTTON ANIMATIONS --- */
            @keyframes comicPopCorrect {
                0%   { transform: scale(1); }
                30%  { transform: scale(1.08) rotate(-2deg); background-color: #2ecc71; border-color: #1a1a1a; box-shadow: 6px 6px 0 rgba(0,0,0,0.3); color: #fff; font-weight: bold; }
                50%  { transform: scale(1.12) rotate(1deg); background-color: #2ecc71; border-color: #1a1a1a; box-shadow: 8px 8px 0 rgba(0,0,0,0.2); color: #fff; font-weight: bold; }
                70%  { transform: scale(1.05) rotate(-1deg); background-color: #2ecc71; border-color: #1a1a1a; box-shadow: 4px 4px 0 rgba(0,0,0,0.3); color: #fff; font-weight: bold; }
                100% { transform: scale(1.05); background-color: #2ecc71; border-color: #1a1a1a; box-shadow: 4px 4px 0 rgba(0,0,0,0.3); color: #fff; font-weight: bold; }
            }
            .anim-correct { animation: comicPopCorrect 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; z-index: 10; position: relative; }

            @keyframes comicShakeWrong {
                0%, 100% { transform: translateX(0); }
                20%, 60% { transform: translateX(-6px); background-color: #e74c3c; color: white; border-color: #1a1a1a; }
                40%, 80% { transform: translateX(6px); background-color: #e74c3c; color: white; border-color: #1a1a1a; }
            }
            .anim-wrong { animation: comicShakeWrong 0.5s ease-in-out forwards; }

            /* --- CHARACTER FEEDBACK ANIMATIONS --- */
            .character-feedback {
                position: absolute; bottom: -30px; right: -60px; width: 160px; height: auto;
                z-index: 2005; pointer-events: none; opacity: 0; transform-origin: bottom center;
                filter: drop-shadow(4px 4px 0 rgba(0,0,0,0.3)) drop-shadow(0 0 15px rgba(255,255,255,0.9));
            }

            @keyframes characterPopIn {
                0% { opacity: 0; transform: translateY(50px) scale(0.6) rotate(10deg); }
                60% { opacity: 1; transform: translateY(-10px) scale(1.1) rotate(-5deg); }
                100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
            }

            @keyframes characterShakeIn {
                0% { opacity: 0; transform: translateY(30px) scale(0.8); }
                40% { opacity: 1; transform: translateY(0) scale(1) rotate(-8deg); }
                60% { transform: translateY(0) scale(1) rotate(6deg); }
                80% { transform: translateY(0) scale(1) rotate(-4deg); }
                100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
            }

            .anim-character-correct { animation: characterPopIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            .anim-character-wrong { animation: characterShakeIn 0.5s ease-out forwards; }

            /* --- BIGGER CONFETTI ANIMATIONS --- */
            .confetti-container { position: absolute; bottom: 40px; right: -10px; width: 1px; height: 1px; z-index: 2010; pointer-events: none; overflow: visible; }
            .confetti-particle {
                position: absolute; top: 0; left: 0; width: 14px; height: 14px; margin: -7px 0 0 -7px; 
                border: 2px solid #1a1a1a; border-radius: 2px;
                animation: confettiBurst 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
            }

            @keyframes confettiBurst {
                0% { transform: translate(0px, 0px) scale(1) rotate(0deg); opacity: 1; }
                70% { opacity: 1; }
                100% { transform: translate(var(--tx), var(--ty)) scale(0) rotate(var(--rot)); opacity: 0; }
            }

            /* --- MOBILE PORTRAIT (Stretches vertically to use black space) --- */
            @media (max-width: 768px) and (orientation: portrait) {
                .quiz-overlay-container:not(.quiz-overlay-themed) { width: 95%; gap: 8px; }
                
                .quiz-overlay-themed {
                    width: 92vw !important;
                    height: 90vh !important; /* Force taller container */
                    max-height: 850px !important;
                    padding-top: 80px !important; /* Spiral clearance */
                    padding-left: 20px !important;
                    padding-right: 20px !important;
                    padding-bottom: 25px !important;
                }
                .quiz-choice-btn {
                    padding: 12px !important; 
                    font-size: 14px !important; /* Slightly larger text */
                    margin: 4px 0 !important;
                    min-height: 44px; /* Easier to tap */
                }
                .quiz-header { font-size: 1.2rem !important; margin-bottom: 10px !important; }
                .character-feedback { width: 120px; right: -10px; bottom: -20px; }
                .confetti-container { right: 20px; bottom: 30px; }
            }

            /* --- MOBILE LANDSCAPE (Stretches horizontally to fit text lines) --- */
            @media (max-height: 500px) and (orientation: landscape) {
                .quiz-overlay-themed { 
                    height: 96vh !important; 
                    width: 85vw !important; /* Wider to prevent text wrapping */
                    max-width: 700px !important;
                    padding-top: 45px !important; /* Spiral is squished */
                    padding-left: 25px !important;
                    padding-right: 25px !important;
                    padding-bottom: 10px !important; 
                    gap: 6px !important;
                }
                .quiz-choice-btn { 
                    padding: 6px 12px !important; 
                    font-size: 12px !important; 
                    margin: 3px 0 !important; 
                    line-height: 1.1 !important;
                    min-height: 32px !important;
                }
                .quiz-overlay-themed h2, .quiz-header { 
                    font-size: 14px !important; 
                    padding: 4px !important; 
                    margin-bottom: 4px !important; 
                }
                .character-feedback { width: 90px; right: -15px; bottom: -10px; }
                .confetti-container { right: 0px; bottom: 20px; }
            }
        `;
    }

    show(optionsConfig, bgImageSrc = null, config = {}) {
        this.remove(); 
        
        const defaultCorrect = this.assetManager ? this.assetManager.get('snowy_correct') : null;
        const defaultWrong = this.assetManager ? this.assetManager.get('snowy_incorrect') : null;

        const { 
            keepOpenOnWrong = false, 
            feedbackCorrectSrc = defaultCorrect ? defaultCorrect.src : this.defaultAssets.correct.src, 
            feedbackWrongSrc = defaultWrong ? defaultWrong.src : this.defaultAssets.wrong.src 
        } = config;

        this.overlayElement = document.createElement('div');
        this.overlayElement.className = 'quiz-overlay-container';

        if (bgImageSrc) {
            this.overlayElement.classList.add('quiz-overlay-themed');
            this.overlayElement.style.backgroundImage = `url('${bgImageSrc}')`;
        }

        optionsConfig.forEach(opt => {
            const btn = document.createElement('button');
            btn.innerHTML = opt.text;
            btn.className = 'quiz-choice-btn';
            
            btn.onclick = () => {
                if (this.overlayElement.classList.contains('quiz-overlay-locked')) return;
                this.overlayElement.classList.add('quiz-overlay-locked');

                const allBtns = this.overlayElement.querySelectorAll('.quiz-choice-btn');
                const isCorrect = opt.correct === true || String(opt.correct).toLowerCase() === 'true';

                // Cleanup existing feedback and confetti
                const existingFeedback = this.overlayElement.querySelector('.character-feedback');
                if (existingFeedback) existingFeedback.remove();
                const existingConfetti = this.overlayElement.querySelector('.confetti-container');
                if (existingConfetti) existingConfetti.remove();

                if (isCorrect) {
                    btn.classList.add('anim-correct');
                    allBtns.forEach(b => { if (b !== btn) b.classList.add('dimmed'); });

                    // --- PURE CSS CONFETTI (More, Bigger, Wider) ---
                    const confettiBox = document.createElement('div');
                    confettiBox.className = 'confetti-container';
                    const colors = ['#FBC02D', '#D32F2F', '#008CBA', '#2ecc71', '#ffffff']; 
                    
                    // Increased particle count from 30 to 50
                    for(let i=0; i<50; i++) {
                        const p = document.createElement('div');
                        p.className = 'confetti-particle';
                        p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                        
                        // Increased Blast Radius for bigger particles
                        const angle = Math.random() * Math.PI * 2;
                        const velocity = 80 + Math.random() * 180; 
                        const tx = (Math.cos(angle) * velocity) + 'px';
                        const ty = (Math.sin(angle) * velocity - 60) + 'px'; // Stronger upward bias
                        const rot = (Math.random() * 720) + 'deg'; // More spin
                        
                        p.style.setProperty('--tx', tx);
                        p.style.setProperty('--ty', ty);
                        p.style.setProperty('--rot', rot);
                        
                        confettiBox.appendChild(p);
                    }
                    this.overlayElement.appendChild(confettiBox);

                    // Add Snowy Correct Image
                    if (feedbackCorrectSrc) {
                        const fbImg = document.createElement('img');
                        fbImg.src = feedbackCorrectSrc;
                        fbImg.className = 'character-feedback anim-character-correct';
                        this.overlayElement.appendChild(fbImg);
                    }

                    setTimeout(() => {
                        this.remove();
                        if (opt.onSelect) opt.onSelect(opt.correct);
                    }, 1800); // Extended wait slightly to let the longer animation finish

                } else {
                    btn.classList.add('anim-wrong');

                    let fbImg = null;
                    if (feedbackWrongSrc) {
                        fbImg = document.createElement('img');
                        fbImg.src = feedbackWrongSrc;
                        fbImg.className = 'character-feedback anim-character-wrong';
                        this.overlayElement.appendChild(fbImg);
                    }
                    
                    setTimeout(() => {
                        if (keepOpenOnWrong) {
                            btn.disabled = true; 
                            this.overlayElement.classList.remove('quiz-overlay-locked'); 
                            
                            // Fade out Snowy gracefully so he doesn't stay stuck on screen
                            if (fbImg) {
                                fbImg.style.transition = 'opacity 0.4s ease';
                                fbImg.style.opacity = '0';
                                setTimeout(() => fbImg.remove(), 400);
                            }

                            if (opt.onSelect) opt.onSelect(opt.correct);
                        } else {
                            this.remove();
                            if (opt.onSelect) opt.onSelect(opt.correct);
                        }
                    }, 1200); 
                }
            };
            this.overlayElement.appendChild(btn);
        });

        this.uiRoot.appendChild(this.overlayElement);
    }

    remove() {
        if (this.overlayElement) {
            this.overlayElement.remove();
            this.overlayElement = null;
        }
    }
}
