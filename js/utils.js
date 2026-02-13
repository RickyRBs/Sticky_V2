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
    // 简单的提示框逻辑
    const div = document.createElement('div');
    div.innerText = msg;
    div.style.position = 'fixed';
    div.style.bottom = '20px';
    div.style.left = '50%';
    div.style.transform = 'translateX(-50%)';
    div.style.background = type === 'error' ? '#ff4d4f' : '#000';
    div.style.color = '#fff';
    div.style.padding = '10px 20px';
    div.style.borderRadius = '0';
    div.style.border = '2px solid #000';
    div.style.boxShadow = '4px 4px 0 rgba(0,0,0,0.5)';
    div.style.zIndex = '9999';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}