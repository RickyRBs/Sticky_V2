import { getCurrentUser, logout } from './auth.js';
import { ensureProfile, getStreak, performCheckIn } from './data.js';
import GameManager from './games/GameManager.js';
import { showToast } from './utils.js';
import supabase from './supabaseClient.js';

async function init() {
    const user = await getCurrentUser();
    const authBtn = document.getElementById('authBtn');

    if (user) {
        // 登录状态
        if(authBtn) {
            authBtn.innerText = 'Logout';
            authBtn.href = '#';
            authBtn.onclick = async (e) => { e.preventDefault(); await logout(); };
        }

        // 1. 确保用户 Profile 存在
        await ensureProfile(user);
        
        // 2. 检查是否是新的一天，如果是则重置mood
        await checkAndResetDailyMood(user.id);

        // 3. 检查有没有人戳你或留言
        checkNotifications(user.id);

        // 4. 加载游戏和天数
        loadDashboard(user.id);
    } else {
        // 未登录状态
        if(authBtn) authBtn.innerText = 'Login';
        const gameContainer = document.getElementById('gameContainer');
        if(gameContainer) gameContainer.innerHTML = '<p class="empty-state">Login to Keep Sticky</p>';
    }
}

// 核心功能：检查通知
async function checkNotifications(userId) {
    const notifList = document.getElementById('notificationList');
    const notifBadge = document.getElementById('notifBadge');
    const notifBtn = document.getElementById('notificationBtn');
    const notifPanel = document.getElementById('notificationPanel');
    const closeBtn = document.getElementById('closeNotifBtn');
    
    if (!notifList) return;

    // 获取上次已读时间
    const lastReadKey = `notif_last_read_${userId}`;
    const lastReadTime = localStorage.getItem(lastReadKey) || new Date(0).toISOString();
    
    const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString();
    let html = '';
    let totalCount = 0;
    let unreadCount = 0;

    // 查 Poke
    const { data: pokes } = await supabase
        .from('friend_pokes')
        .select('sender:sender_id(username), created_at')
        .eq('receiver_id', userId)
        .gte('created_at', yesterday)
        .order('created_at', { ascending: false });

    if (pokes && pokes.length > 0) {
        pokes.forEach(p => {
            const timeAgo = getTimeAgo(new Date(p.created_at));
            const isUnread = p.created_at > lastReadTime;
            if (isUnread) unreadCount++;
            const readClass = isUnread ? '' : 'read';
            
            html += `
                <div class="notif-card poke ${readClass}" onclick="window.location.href='profile.html'">
                    <span class="notif-icon">👋</span>
                    <div class="notif-content">
                        <div><strong>${p.sender?.username || 'Someone'}</strong> stickied you!</div>
                        <div class="notif-time">${timeAgo}</div>
                    </div>
                </div>
            `;
            totalCount++;
        });
    }

    // 查 Notes
    const { data: notes } = await supabase
        .from('comments')
        .select('author:author_id(username), created_at, content')
        .eq('target_id', userId)
        .neq('author_id', userId)
        .gte('created_at', yesterday)
        .order('created_at', { ascending: false });

    if (notes && notes.length > 0) {
        notes.forEach(n => {
            const timeAgo = getTimeAgo(new Date(n.created_at));
            const preview = n.content.length > 40 ? n.content.substring(0, 40) + '...' : n.content;
            const isUnread = n.created_at > lastReadTime;
            if (isUnread) unreadCount++;
            const readClass = isUnread ? '' : 'read';
            
            html += `
                <div class="notif-card note ${readClass}" onclick="window.location.href='profile.html'">
                    <span class="notif-icon">📝</span>
                    <div class="notif-content">
                        <div><strong>${n.author?.username || 'Someone'}</strong> left a note:</div>
                        <div style="color: #666; font-size: 12px; margin-top: 2px;">"${preview}"</div>
                        <div class="notif-time">${timeAgo}</div>
                    </div>
                </div>
            `;
            totalCount++;
        });
    }

    notifList.innerHTML = html;

    // 更新徽章和按钮样式（只显示未读数量）
    if (unreadCount > 0) {
        notifBadge.innerText = unreadCount > 99 ? '99+' : unreadCount;
        notifBadge.style.display = 'flex';
        notifBtn.classList.add('has-notif');
    } else {
        notifBadge.style.display = 'none';
        notifBtn.classList.remove('has-notif');
    }

    // 绑定按钮事件
    notifBtn.onclick = () => {
        const isOpening = notifPanel.style.display === 'none';
        notifPanel.style.display = isOpening ? 'block' : 'none';
        
        // 打开面板时标记为已读（保存当前时间）
        if (isOpening) {
            localStorage.setItem(lastReadKey, new Date().toISOString());
            notifBadge.style.display = 'none';
            notifBtn.classList.remove('has-notif');
        }
    };

    closeBtn.onclick = () => {
        notifPanel.style.display = 'none';
    };
    
    // 清除全部通知
    const clearAllBtn = document.getElementById('clearAllNotifBtn');
    if (clearAllBtn) {
        clearAllBtn.onclick = () => {
            notifList.innerHTML = '';
            localStorage.setItem(lastReadKey, new Date().toISOString());
            notifBadge.style.display = 'none';
            notifBtn.classList.remove('has-notif');
            notifPanel.style.display = 'none';
        };
    }

    // 点击外部关闭
    document.addEventListener('click', (e) => {
        if (!notifBtn.contains(e.target) && !notifPanel.contains(e.target)) {
            notifPanel.style.display = 'none';
        }
    });
}

// 时间格式化辅助函数
function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

async function loadDashboard(userId) {
    const streak = await getStreak(userId);
    const streakEl = document.getElementById('consecutiveDays');
    if(streakEl) streakEl.innerText = streak;

    // 检查今天是否签到（通过日期字符串匹配）
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase.from('check_ins')
        .select('id')
        .eq('user_id', userId)
        .eq('check_in_date', today)
        .maybeSingle();

    if (existing) {
        showCheckedInState(streak);
        setupMainMoodPicker();
        return;
    }

    // 启动游戏
    const gm = new GameManager('gameContainer', async (photoData) => {
        try {
            document.getElementById('statusMessage').innerText = "Uploading...";
            const success = await performCheckIn(userId, photoData);
            if (success) {
                const newStreak = await getStreak(userId);
                showCheckedInState(newStreak);
                setupMainMoodPicker();
                showToast("Check-in Successful!", "success");
            }
        } catch (e) {
            showToast("Error: " + e.message, "error");
        }
    });

    gm.startDailyChallenge();
}

function showCheckedInState(streak) {
    const beforeEl = document.getElementById('beforeCheckIn');
    const afterEl = document.getElementById('afterCheckIn');
    const card = document.querySelector('.card');
    
    // 锁定卡片高度，防止跳动
    if (card) {
        card.style.minHeight = card.offsetHeight + 'px';
    }
    
    if(beforeEl) {
        beforeEl.style.transition = 'opacity 0.3s ease-out';
        beforeEl.style.opacity = '0';
        setTimeout(() => {
            beforeEl.style.display = 'none';
            
            // 显示 afterCheckIn
            if(afterEl) {
                afterEl.style.display = 'flex';
                afterEl.style.opacity = '0';
                setTimeout(() => {
                    afterEl.style.opacity = '1';
                    document.getElementById('finalStreak').innerText = streak;
                    
                    // 解除高度锁定
                    setTimeout(() => {
                        if (card) card.style.minHeight = '';
                    }, 500);
                }, 50);
            }
        }, 300);
    }
}

async function setupMainMoodPicker() {
    const user = await getCurrentUser();
    if (!user) return;
    const display = document.getElementById('currentMoodDisplay');
    const picker = document.getElementById('mainEmojiPicker');
    const overlay = document.getElementById('emojiPickerOverlay');
    if(!display || !picker || !overlay) return;

    const { data: profile } = await supabase.from('profiles').select('mood').eq('id', user.id).single();
    display.innerText = profile?.mood || '⚙️';

    // 打开/关闭 picker 的函数
    const togglePicker = (show) => {
        if (show) {
            picker.classList.add('show');
            overlay.classList.add('show');
        } else {
            picker.classList.remove('show');
            overlay.classList.remove('show');
        }
    };

    display.onclick = (e) => {
        e.stopPropagation();
        const isShowing = picker.classList.contains('show');
        togglePicker(!isShowing);
    };

    // 点击 overlay 关闭
    overlay.onclick = () => {
        togglePicker(false);
    };

    // 点击其他地方关闭
    document.addEventListener('click', (e) => {
        if (!picker.contains(e.target) && e.target !== display && !overlay.contains(e.target)) {
            togglePicker(false);
        }
    });

    const moods = ['🍀', '💤', '🎉', '💻', '☕', '😭', '😡', '❤️'];
    picker.innerHTML = `
        <div class="emoji-picker-header">SET YOUR MOOD</div>
        <div class="emoji-picker-grid">
            ${moods.map(m => `<button class="emoji-picker-option" data-mood="${m}">${m}</button>`).join('')}
        </div>
    `;

    picker.querySelectorAll('.emoji-picker-option').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const m = btn.dataset.mood;
            await supabase.from('profiles').update({ mood: m }).eq('id', user.id);
            // 更新今天的 Check-in 记录
            const today = new Date().toISOString().split('T')[0];
            await supabase.from('check_ins').update({ mood: m }).eq('user_id', user.id).eq('check_in_date', today);
            
            display.innerText = m;
            togglePicker(false);
            showToast(`Mood updated to ${m}`, 'success');
        };
    });
}

// 检查并重置每日mood
async function checkAndResetDailyMood(userId) {
    const today = new Date().toISOString().split('T')[0];
    
    // 检查用户今天是否已经签到过
    const { data: todayCheckIn } = await supabase
        .from('check_ins')
        .select('id')
        .eq('user_id', userId)
        .eq('check_in_date', today)
        .maybeSingle();
    
    // 如果今天还没签到，说明是新的一天，重置mood为默认值⚙️
    if (!todayCheckIn) {
        await supabase.from('profiles').update({ mood: '⚙️' }).eq('id', userId);
    }
    // 如果今天已经签到过，保留当前mood（不做任何操作）
}

init();