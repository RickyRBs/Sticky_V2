import { showToast } from '../utils.js';

export default class SliderGame {
    constructor(container, onSuccess) {
        this.container = container;
        this.onSuccess = onSuccess;
        this.isDragging = false;
    }

    render() {
        // 随机目标位置 (20% 到 80% 之间)
        const targetPercent = Math.floor(Math.random() * 60) + 20;

        this.container.innerHTML = `
            <div class="slider-container">
                <div class="slider-header">
                    <h3>Slide to Check-in</h3>
                    <div class="slider-subtitle">Align the arrow with the target</div>
                </div>
                <div class="slider-track" id="track">
                    <div class="slider-target" id="target" style="left: ${targetPercent}%"></div>
                    <div class="slider-thumb" id="thumb">
                        <span class="thumb-icon">&gt;</span>
                    </div>
                </div>
                <div class="slider-hint">Drag the arrow to match the marker</div>
            </div>
        `;

        const track = this.container.querySelector('#track');
        const thumb = this.container.querySelector('#thumb');
        const target = this.container.querySelector('#target');
        
        let animationFrameId = null;
        let pendingPosition = null;

        // 通用移动处理函数 - 使用 RAF 提升流畅度
        const handleMove = (clientX) => {
            if (!this.isDragging) return;
            
            const rect = track.getBoundingClientRect();
            let offsetX = clientX - rect.left - (thumb.offsetWidth / 2);
            
            // 边界限制
            const maxOffset = rect.width - thumb.offsetWidth;
            if (offsetX < 0) offsetX = 0;
            if (offsetX > maxOffset) offsetX = maxOffset;
            
            // 存储待处理的位置
            pendingPosition = offsetX;
            
            // 使用 requestAnimationFrame 确保流畅
            if (animationFrameId === null) {
                animationFrameId = requestAnimationFrame(() => {
                    animationFrameId = null;
                    if (pendingPosition !== null) {
                        thumb.style.left = pendingPosition + 'px';
                        
                        // 实时距离反馈
                        const thumbCenter = pendingPosition + (thumb.offsetWidth / 2);
                        const targetCenter = (targetPercent / 100) * rect.width;
                        const distance = Math.abs(thumbCenter - targetCenter);
                        const proximity = Math.max(0, 1 - (distance / 50));
                        
                        if (proximity > 0.7) {
                            thumb.classList.add('near');
                        } else {
                            thumb.classList.remove('near');
                        }
                        
                        pendingPosition = null;
                    }
                });
            }
        };

        const handleEnd = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            thumb.classList.remove('dragging');
            
            // 取消待处理的动画帧
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            const rect = track.getBoundingClientRect();
            const thumbCenter = parseInt(thumb.style.left || '0') + (thumb.offsetWidth / 2);
            const currentPercent = (thumbCenter / rect.width) * 100;

            // 允许 5% 的误差
            if (Math.abs(currentPercent - targetPercent) < 5) {
                thumb.classList.remove('near');
                thumb.classList.add('success');
                target.classList.add('matched');
                showToast("Perfect match!", "success");
                setTimeout(() => this.onSuccess(), 600);
            } else {
                // 失败回弹 - 添加 transition 类
                thumb.classList.add('fail', 'bouncing');
                thumb.style.left = '0px';
                showToast("Missed! Try again", "error");
                setTimeout(() => { 
                    thumb.classList.remove('fail', 'near', 'bouncing');
                }, 400);
            }
        };

        // 鼠标事件
        const mouseMoveHandler = (e) => {
            e.preventDefault();
            handleMove(e.clientX);
        };
        
        const mouseUpHandler = (e) => {
            handleEnd();
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
        };
        
        thumb.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.isDragging = true;
            thumb.classList.add('dragging');
            thumb.style.transition = 'none';
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });

        // 触摸事件 (手机端)
        const touchMoveHandler = (e) => {
            if (e.touches.length > 0) {
                e.preventDefault();
                handleMove(e.touches[0].clientX);
            }
        };
        
        const touchEndHandler = (e) => {
            handleEnd();
            document.removeEventListener('touchmove', touchMoveHandler);
            document.removeEventListener('touchend', touchEndHandler);
        };
        
        thumb.addEventListener('touchstart', (e) => { 
            e.preventDefault();
            this.isDragging = true;
            thumb.classList.add('dragging');
            thumb.style.transition = 'none';
            document.addEventListener('touchmove', touchMoveHandler, { passive: false });
            document.addEventListener('touchend', touchEndHandler);
        }, { passive: false });
    }
}