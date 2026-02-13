import { showToast } from '../utils.js';

export default class SliderGame {
    constructor(container, onSuccess) {
        this.container = container;
        this.onSuccess = onSuccess;
    }

    render() {
        // 随机目标位置 (20% 到 80% 之间)
        const targetPercent = Math.floor(Math.random() * 60) + 20;

        this.container.innerHTML = `
            <div class="slider-container">
                <h3>Slide to Check-in</h3>
                <div class="slider-track" id="track">
                    <div class="slider-target" style="left: ${targetPercent}%"></div>
                    <div class="slider-thumb" id="thumb">➜</div>
                </div>
                <div class="slider-hint">Align the arrow with the notch</div>
            </div>
        `;

        const track = this.container.querySelector('#track');
        const thumb = this.container.querySelector('#thumb');
        let isDragging = false;

        // 通用移动处理函数
        const handleMove = (clientX) => {
            if (!isDragging) return;
            const rect = track.getBoundingClientRect();
            let offsetX = clientX - rect.left;
            
            // 边界限制
            if (offsetX < 0) offsetX = 0;
            if (offsetX > rect.width) offsetX = rect.width;
            
            thumb.style.left = offsetX + 'px';
        };

        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;

            const rect = track.getBoundingClientRect();
            const thumbLeft = parseInt(thumb.style.left || '0');
            const currentPercent = (thumbLeft / rect.width) * 100;

            // 允许 5% 的误差
            if (Math.abs(currentPercent - targetPercent) < 5) {
                thumb.style.background = '#4CAF50';
                thumb.innerHTML = '✓';
                setTimeout(() => this.onSuccess(), 500);
            } else {
                // 失败回弹
                thumb.style.transition = 'left 0.3s ease';
                thumb.style.left = '0px';
                showToast("Missed it!", "error");
                setTimeout(() => { thumb.style.transition = 'none'; }, 300);
            }
        };

        // 鼠标事件
        thumb.addEventListener('mousedown', () => isDragging = true);
        document.addEventListener('mousemove', (e) => handleMove(e.clientX));
        document.addEventListener('mouseup', handleEnd);

        // 触摸事件 (手机端)
        thumb.addEventListener('touchstart', (e) => { isDragging = true; e.preventDefault(); });
        document.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientX));
        document.addEventListener('touchend', handleEnd);
    }
}