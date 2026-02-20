export const getTodayStr = () => {
    // 返回 YYYY-MM-DD 格式
    const now = new Date();
    // 简单处理时区，确保是当地时间
    const offset = now.getTimezoneOffset() * 60000;
    const local = new Date(now - offset);
    return local.toISOString().split('T')[0];
};

export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export function showToast(msg, type = 'info') {
    const colors = {
        success: { bg: '#1a7a4a', border: '#1a7a4a' },
        error:   { bg: '#c00',    border: '#c00'    },
        info:    { bg: '#000',    border: '#000'    },
    };
    const { bg, border } = colors[type] || colors.info;

    const div = document.createElement('div');
    div.innerText = msg;
    div.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: ${bg}; color: #fff; padding: 10px 20px;
        border-radius: 0; border: 2px solid ${border};
        box-shadow: 2px 2px 0 rgba(0,0,0,0.8); z-index: 9999;
        font-weight: 700; font-size: 13px; text-transform: uppercase;
        letter-spacing: 0.5px; white-space: nowrap;
        transition: opacity 0.4s;
    `;
    document.body.appendChild(div);
    setTimeout(() => { div.style.opacity = '0'; }, 2600);
    setTimeout(() => div.remove(), 3000);
}