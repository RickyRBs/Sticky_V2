import { showToast } from '../utils.js';

export default class ReactionGame {
    constructor(container, onSuccess) {
        this.container = container;
        this.onSuccess = onSuccess;
        
        this.PROMPTS = ['CLICK', 'TAP'];
        this.WIN_GOOD = 2;
        this.GOOD_MS = 700;
        this.DELAY_MIN = 1500;
        this.DELAY_MAX = 3500;
        
        this.mode = 'idle';
        this.timer = null;
        this.shownAt = 0;
        this.round = 0;
        this.good = 0;
    }

    render() {
        this.container.innerHTML = `
            <div class="reaction-container">
                <div class="reaction-header">
                    <h3>Reaction Test</h3>
                    <div class="reaction-stats">
                        <div class="reaction-stat">Round: <span id="reactionRound">1</span>/2</div>
                        <div class="reaction-stat">Good: <span id="reactionGood">0</span>/2</div>
                        <div class="reaction-stat">Last: <span id="reactionLast">—</span></div>
                    </div>
                </div>
                <div class="reaction-pad" id="reactionPad">
                    <div class="reaction-state" id="reactionState">CLICK TO START</div>
                </div>
                <div class="reaction-hint" id="reactionHint">
                    Wait... then click when the word appears. Don't click early.
                </div>
            </div>
        `;

        this.pad = this.container.querySelector('#reactionPad');
        this.stateEl = this.container.querySelector('#reactionState');
        this.hintEl = this.container.querySelector('#reactionHint');
        this.roundEl = this.container.querySelector('#reactionRound');
        this.goodEl = this.container.querySelector('#reactionGood');
        this.lastEl = this.container.querySelector('#reactionLast');

        this.pad.addEventListener('click', () => this.handleClick());
    }

    handleClick() {
        if (this.mode === 'idle') {
            this.startRound();
            return;
        }

        if (this.mode === 'waiting') {
            clearTimeout(this.timer);
            this.mode = 'idle';
            this.pad.classList.remove('waiting');
            this.stateEl.textContent = 'TOO EARLY';
            this.hintEl.textContent = 'Click to try the round again.';
            this.lastEl.textContent = 'early';
            return;
        }

        if (this.mode === 'show') {
            this.pad.classList.remove('ready');
            const ms = Math.round(performance.now() - this.shownAt);
            this.lastEl.textContent = ms + 'ms';

            if (ms <= this.GOOD_MS) {
                this.good++;
                this.goodEl.textContent = this.good;
                this.round++;

                if (this.good >= this.WIN_GOOD) {
                    this.win();
                    return;
                }

                if (this.round >= this.PROMPTS.length) {
                    this.win();
                    return;
                }

                this.mode = 'idle';
                this.stateEl.textContent = 'NICE';
                this.hintEl.textContent = `Good! Click to start Round ${this.round + 1}.`;
            } else {
                this.mode = 'idle';
                this.stateEl.textContent = 'SLOW';
                this.hintEl.textContent = `Try again. Need under ${this.GOOD_MS}ms. Click to retry Round ${this.round + 1}.`;
            }
            return;
        }

        if (this.mode === 'done') {
            // Already won, ignore clicks
        }
    }

    startRound() {
        clearTimeout(this.timer);
        this.mode = 'waiting';
        this.pad.classList.remove('ready');
        this.pad.classList.add('waiting');
        this.stateEl.textContent = 'WAIT...';
        this.hintEl.textContent = `Round ${this.round + 1}: wait for "${this.PROMPTS[this.round]}".`;
        this.roundEl.textContent = this.round + 1;

        const delay = this.DELAY_MIN + Math.random() * (this.DELAY_MAX - this.DELAY_MIN);
        this.timer = setTimeout(() => {
            this.mode = 'show';
            this.pad.classList.remove('waiting');
            this.pad.classList.add('ready');
            this.stateEl.textContent = this.PROMPTS[this.round];
            this.hintEl.textContent = 'NOW CLICK!';
            this.shownAt = performance.now();
        }, delay);
    }

    win() {
        this.mode = 'done';
        this.stateEl.textContent = 'PASS';
        this.hintEl.textContent = `2 good reactions under ${this.GOOD_MS}ms.`;
        clearTimeout(this.timer);
        showToast('Perfect reaction time!', 'success');
        setTimeout(() => this.onSuccess(), 1000);
    }
}
