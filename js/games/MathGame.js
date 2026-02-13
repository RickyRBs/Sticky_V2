import { randInt, showToast } from '../utils.js';

export default class MathGame {
    constructor(container, onSuccess) {
        this.container = container;
        this.onSuccess = onSuccess;
        this.q = this.generateQuestion();
    }

    generateQuestion() {
        const a = randInt(1, 9);
        const b = randInt(1, 9);
        // 随机加法或乘法
        if (Math.random() > 0.5) {
            return { str: `${a} + ${b} = ?`, ans: a + b };
        } else {
            return { str: `${a} × ${b} = ?`, ans: a * b };
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="math-container">
                <h3>Solve to Check-in</h3>
                <div class="math-question">${this.q.str}</div>
                <input type="number" id="mathInput" class="math-input" placeholder="?" inputmode="numeric" autofocus>
                <button id="verifyBtn" class="primary-btn" style="width:100%">Verify</button>
            </div>
        `;

        const btn = this.container.querySelector('#verifyBtn');
        const input = this.container.querySelector('#mathInput');

        // 绑定点击和回车事件
        const check = () => {
            if (parseInt(input.value) === this.q.ans) {
                this.onSuccess();
            } else {
                showToast("Wrong answer", "error");
                input.value = '';
                input.focus();
            }
        };

        btn.onclick = check;
        input.onkeydown = (e) => { if (e.key === 'Enter') check(); };
    }
}