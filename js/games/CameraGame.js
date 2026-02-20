import { showToast } from '../utils.js';

export default class CameraGame {
    constructor(container, onCapture) {
        this.container = container;
        this.onCapture = onCapture;
        this.stream = null;
    }

    async render() {
        // 显示相机加载界面
        this.container.innerHTML = `
            <div class="camera-loading">
                <div class="loading-text">Starting camera...</div>
            </div>
            <video id="video" style="display:none;" autoplay playsinline muted></video>
            <canvas id="canvas" style="display:none;"></canvas>
            <div id="photoFlash" style="display:none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #fff; z-index: 9999; pointer-events: none;"></div>
        `;

        const video = this.container.querySelector('#video');
        const loadingDiv = this.container.querySelector('.camera-loading');

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "user" } 
            });
            video.srcObject = this.stream;
            
            video.onloadedmetadata = () => {
                video.play();
                // 相机启动后直接拍照，无需显示提示
                loadingDiv.style.display = 'none';
                
                // 等待相机完全启动后直接拍照
                setTimeout(() => {
                    this.snap();
                }, 500);
            };

        } catch (e) {
            console.error('Camera error:', e);
            showToast("Camera access required!", "error");
            this.container.innerHTML = `
                <div class="camera-error">
                    <div class="error-title">Camera Access Denied</div>
                    <div class="error-message">Please allow camera access to complete check-in</div>
                </div>
            `;
        }
    }

    snap() {
        const video = this.container.querySelector('#video');
        const canvas = this.container.querySelector('#canvas');
        const flash = this.container.querySelector('#photoFlash');
        
        if (!video || video.videoWidth === 0) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        // 显示白色闪光效果
        if (flash) {
            flash.style.display = 'block';
            flash.style.opacity = '1';
            
            setTimeout(() => {
                flash.style.transition = 'opacity 0.3s ease-out';
                flash.style.opacity = '0';
                
                // 显示照片飞入gallery的动画
                this.showPhotoFlyAnimation(dataUrl);
                
                setTimeout(() => {
                    this.onCapture(dataUrl);
                }, 2200);
            }, 100);
        } else {
            this.onCapture(dataUrl);
        }
    }
    
    showPhotoFlyAnimation(dataUrl) {
        const photo = document.createElement('div');
        photo.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 200px;
            height: 266px;
            background-image: url('${dataUrl}');
            background-size: cover;
            background-position: center;
            border: 2px solid #000;
            box-shadow: 2px 2px 0 rgba(0,0,0,0.8);
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(photo);
        
        // 动画：缩小并飞向右上角
        setTimeout(() => {
            photo.style.transition = 'all 2s cubic-bezier(0.34, 1.56, 0.64, 1)';
            photo.style.transform = 'translate(calc(42vw - 100px), calc(-42vh + 40px)) scale(0.25)';
            photo.style.opacity = '0';
            
            setTimeout(() => {
                document.body.removeChild(photo);
            }, 2000);
        }, 100);
    }
}