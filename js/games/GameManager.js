import MathGame from './MathGame.js';
import SliderGame from './SliderGame.js';
import PuzzleGame from './PuzzleGame.js';
import CameraGame from './CameraGame.js';

export default class GameManager {
    constructor(containerId, onComplete) {
        this.container = document.getElementById(containerId);
        this.onComplete = onComplete;
    }

    startDailyChallenge() {
        this.container.innerHTML = ''; // 清空容器
        
        // 1. 定义游戏池
        const games = [MathGame, SliderGame, PuzzleGame];
        
        // 2. 随机选一个
        const RandomGame = games[Math.floor(Math.random() * games.length)];
        
        // 3. 实例化并开始
        const gameInstance = new RandomGame(this.container, () => {
            // 验证通过后的回调 -> 启动相机
            this.startCameraPhase();
        });
        gameInstance.render();
    }

    startCameraPhase() {
        this.container.innerHTML = ''; // 清空容器
        
        const camera = new CameraGame(this.container, (photoData) => {
            // 拍照完成后的回调 -> 提交数据
            this.onComplete(photoData);
        });
        camera.render();
    }
}