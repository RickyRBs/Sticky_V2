import { showToast } from '../utils.js';

export default class PuzzleGame {
    constructor(container, onSuccess) {
        this.container = container;
        this.onSuccess = onSuccess;
        this.flipped = [];
        this.matchedPairs = 0;
        this.totalPairs = 4;
        this.isProcessing = false;
    }

    render() {
        // 准备 4 对 Emoji
        const emojis = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D'];
        // 洗牌
        emojis.sort(() => Math.random() - 0.5);

        this.container.innerHTML = `
            <div class="puzzle-container">
                <div class="puzzle-header">
                    <h3>Match All Pairs</h3>
                    <div class="puzzle-progress">
                        <span id="pairsMatched">0</span>/<span>${this.totalPairs}</span> pairs
                    </div>
                </div>
                <div class="puzzle-grid" id="grid"></div>
                <p class="puzzle-hint">Find all pairs to unlock check-in</p>
            </div>
        `;

        const grid = this.container.querySelector('#grid');
        
        emojis.forEach((emoji, index) => {
            const card = document.createElement('div');
            card.className = 'puzzle-card';
            card.dataset.val = emoji;
            card.dataset.idx = index;
            card.innerText = ''; // 默认不显示
            
            card.onclick = () => this.flip(card);
            grid.appendChild(card);
        });
    }

    flip(card) {
        // 如果已经翻开、匹配或正在处理两个，则无视
        if (card.classList.contains('open') || 
            card.classList.contains('matched') || 
            this.flipped.length >= 2 || 
            this.isProcessing) {
            return;
        }

        // 翻开动作
        card.classList.add('open');
        card.innerText = card.dataset.val;
        this.flipped.push(card);

        // 检查匹配
        if (this.flipped.length === 2) {
            this.isProcessing = true;
            const [c1, c2] = this.flipped;
            
            if (c1.dataset.val === c2.dataset.val) {
                // 匹配成功
                setTimeout(() => {
                    c1.classList.add('matched');
                    c2.classList.add('matched');
                    this.matchedPairs++;
                    
                    // 更新进度
                    const progressEl = document.getElementById('pairsMatched');
                    if (progressEl) {
                        progressEl.textContent = this.matchedPairs;
                        progressEl.classList.add('bounce');
                        setTimeout(() => progressEl.classList.remove('bounce'), 500);
                    }
                    
                    this.flipped = [];
                    this.isProcessing = false;
                    
                    if (this.matchedPairs === this.totalPairs) {
                        showToast("Perfect! All pairs matched!", "success");
                        setTimeout(() => this.onSuccess(), 800);
                    }
                }, 400);
            } else {
                // 匹配失败，延时盖回
                setTimeout(() => {
                    c1.classList.remove('open');
                    c1.innerText = '';
                    c2.classList.remove('open');
                    c2.innerText = '';
                    this.flipped = [];
                    this.isProcessing = false;
                }, 1000);
            }
        }
    }
}