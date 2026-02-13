import supabase from './supabaseClient.js';
import { getCurrentUser } from './auth.js';
import { showToast } from './utils.js';
import { CalendarRender } from './CalendarRender.js';

const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get('id');

async function initProfile() {
    const currentUser = await getCurrentUser();
    if (!currentUser) return window.location.href = 'login.html';

    const profileId = targetId || currentUser.id;
    const isMe = (profileId === currentUser.id);

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', profileId).single();
    if (!profile) return document.body.innerHTML = "<h3>User not found.</h3>";

    renderProfile(profile);
    loadUserGroups(profileId);
    loadUserCalendar(profileId);
    loadComments(profileId, currentUser.id);
    
    // 显示用户 ID 并设置复制功能
    document.getElementById('userId').innerText = profileId.substring(0, 8) + '...';
    document.getElementById('userIdDisplay').onclick = () => {
        navigator.clipboard.writeText(profileId).then(() => {
            showToast('已复制 ID', 'success');
        });
    };

    if (isMe) {
        setupEditing(profile.id);
        // 显示 friend check-ins
        loadFriendCheckIns(profile.id);
        document.getElementById('friendCheckInsSection').style.display = 'block';
    } else {
        // 隐藏所有编辑入口
        document.querySelectorAll('.edit-only').forEach(el => el.style.display = 'none');
        document.querySelector('.avatar-wrapper').style.pointerEvents = 'none';
        // 显示 friend check-in 按钮
        setupFriendCheckIn(currentUser.id, profileId, profile.username);
    }
}

// 渲染 Emoji 选择器
function createEmojiPicker(userId) {
    const moods = ['🔥', '💀', '🍀', '💤', '🎉', '💻', '☕', '😭', '😡', '❤️', '🚀', '✨'];
    
    const container = document.createElement('div');
    container.id = 'emojiPicker';
    container.style.cssText = `
        display: none; 
        gap: 5px; 
        flex-wrap: wrap; 
        background: #fff; 
        padding: 10px; 
        border-radius: 0; 
        box-shadow: 2px 2px 0 rgba(0,0,0,0.5);
        position: absolute;
        top: 40px; right: 0; z-index: 1000;
        width: 160px;
        border: 1px solid #000;
    `;

    moods.forEach(emoji => {
        const btn = document.createElement('span');
        btn.innerText = emoji;
        btn.style.cssText = 'cursor: pointer; font-size: 20px; padding: 4px; border-radius: 0; transition: background 0.1s;';
        btn.onmouseover = () => btn.style.background = '#f0f0f0';
        btn.onmouseout = () => btn.style.background = 'transparent';
        
        btn.onclick = async () => {
            showToast("Updating mood...");
            
            // A. 更新 Profile
            await supabase.from('profiles').update({ mood: emoji }).eq('id', userId);
            document.getElementById('moodText').innerText = emoji;
            
            // B. ⚠️ 核心：尝试更新今天的 check_ins 记录 (实现"以此为准")
            const today = new Date().toISOString().split('T')[0];
            
            // 不管今天有没有签到，试着更新一下 check_in_date = today 的那条记录
            // 如果没签到，这个 update 不会影响任何行，也不会报错，非常安全
            await supabase.from('check_ins')
                .update({ mood: emoji })
                .eq('user_id', userId)
                .eq('check_in_date', today);

            // 关闭选择器
            container.style.display = 'none';
            
            // ⚠️ 直接用新的 emoji 刷新日历，不需要重新查询
            const { data: checks } = await supabase
                .from('check_ins')
                .select('check_in_date, mood')
                .eq('user_id', userId);
            
            if (checks) {
                const calendar = new CalendarRender('calendarArea');
                calendar.render(checks, emoji); // 直接传入新的 emoji
            }
            
            showToast("Mood updated!");
        };
        container.appendChild(btn);
    });

    return container;
}

function setupEditing(userId) {
    // 1. Mood 编辑：直接点击 emoji 弹出选择器
    const moodBadge = document.getElementById('moodBadgeTop');
    const picker = createEmojiPicker(userId);
    moodBadge.appendChild(picker);

    moodBadge.onclick = (e) => {
        e.stopPropagation(); // 防止冒泡
        picker.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
    };

    // 点击其他地方关闭选择器
    document.addEventListener('click', (e) => {
        if (!moodBadge.contains(e.target)) picker.style.display = 'none';
    });

    // 2. Name 编辑
    const nameBtn = document.getElementById('editNameBtn');
    nameBtn.classList.add('edit-only');
    const nameContainer = document.getElementById('editNameContainer');
    
    nameBtn.onclick = () => {
        nameContainer.style.display = 'block';
        document.getElementById('newNameInput').value = document.getElementById('username').innerText;
    };
    document.getElementById('saveNameBtn').onclick = async () => {
        const newName = document.getElementById('newNameInput').value.trim();
        if(!newName) return;
        await supabase.from('profiles').update({ username: newName }).eq('id', userId);
        document.getElementById('username').innerText = newName;
        nameContainer.style.display = 'none';
    };

    // 3. Avatar 编辑
    const avatarWrapper = document.querySelector('.avatar-wrapper');
    const fileInput = document.getElementById('avatarInput');
    document.getElementById('avatarOverlay').classList.add('edit-only');

    avatarWrapper.onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // 验证文件大小（限制5MB）
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image too large (max 5MB)', 'error');
            return;
        }
        
        showToast('📸 Uploading...', 'info');
        const fileExt = file.name.split('.').pop();
        const filePath = `${userId}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
        
        if (uploadError) {
            showToast('Upload failed', 'error');
            console.error(uploadError);
            return;
        }
        
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId);
        document.getElementById('avatar').src = data.publicUrl + '?t=' + Date.now();
        showToast('✨ Avatar updated!', 'success');
    };
}

// 辅助函数保持不变
async function loadUserGroups(uid) {
    const el = document.getElementById('userGroupsBadges');
    if(!el) return;
    const {data} = await supabase.from('group_members').select('groups:group_id(name)').eq('user_id', uid);
    el.innerHTML = data ? data.map(m=>`<span style="background:#eee;color:#555;font-size:10px;padding:2px 6px;border-radius:0;border:1px solid #ccc;">${m.groups.name}</span>`).join('') : '';
}

async function loadUserCalendar(userId) {
    // ⚠️ 修改 select，多取一个 mood
    const { data: checks } = await supabase
        .from('check_ins')
        .select('check_in_date, mood') 
        .eq('user_id', userId);

    // 获取用户当前的心情（用于显示今天未签到时的状态）
    const { data: profile } = await supabase
        .from('profiles')
        .select('mood')
        .eq('id', userId)
        .single();

    if (!checks) return;

    // 直接把整个对象数组和当前心情传给 render
    const calendar = new CalendarRender('calendarArea');
    calendar.render(checks, profile?.mood || '✨');
}

function renderProfile(p) {
    document.getElementById('username').innerText = p.username || 'User';
    
    // 渲染 Mood
    document.getElementById('moodText').innerText = p.mood || '✨'; // 默认闪光
    
    document.querySelector('.streak-number').innerText = p.total_check_ins || 0;
    let ava = p.avatar_url || `https://ui-avatars.com/api/?name=${p.username}&background=random`;
    if(p.avatar_url) ava += '?t=' + Date.now();
    document.getElementById('avatar').src = ava;
}
async function loadComments(tid, uid) {
    const list = document.getElementById('commentsList');
    const {data} = await supabase.from('comments').select(`id, content, author_id, parent_id, created_at, author:profiles!author_id(username)`).eq('target_id',tid).order('created_at',{ascending:false});
    
    if (!data || data.length === 0) {
        list.innerHTML = '<p style="color:#aaa">No notes.</p>';
    } else {
        // 分离主评论和回复
        const mainComments = data.filter(c => !c.parent_id);
        const replies = data.filter(c => c.parent_id);
        
        // 构建评论树
        let html = '';
        mainComments.forEach(comment => {
            const isOwn = comment.author_id === uid;
            const replyBtn = !isOwn ? `<button class="reply-btn" data-comment-id="${comment.id}" data-author="${comment.author.username}">↩️</button>` : '';
            
            html += `<div class="comment-thread">
                <div class="comment-item">
                    <strong>${comment.author.username}</strong>: ${comment.content}
                    ${replyBtn}
                </div>`;
            
            // 显示这条评论的回复
            const commentReplies = replies.filter(r => r.parent_id === comment.id);
            commentReplies.forEach(reply => {
                html += `<div class="comment-item comment-reply">
                    <strong>${reply.author.username}</strong>: ${reply.content}
                </div>`;
            });
            
            html += `</div>`;
        });
        
        list.innerHTML = html;
        
        // 绑定回复按钮
        document.querySelectorAll('.reply-btn').forEach(btn => {
            btn.onclick = () => {
                const commentId = btn.getAttribute('data-comment-id');
                const authorName = btn.getAttribute('data-author');
                const input = document.getElementById('commentInput');
                input.placeholder = `Reply to ${authorName}...`;
                input.focus();
                input.setAttribute('data-parent-id', commentId);
            };
        });
    }
    
    document.getElementById('sendCommentBtn').onclick = async()=>{
        const input = document.getElementById('commentInput');
        const val = input.value.trim();
        if(!val) return;
        
        const parentId = input.getAttribute('data-parent-id');
        const insertData = {
            author_id: uid,
            target_id: tid,
            content: val
        };
        
        if (parentId) {
            insertData.parent_id = parentId;
        }
        
        await supabase.from('comments').insert([insertData]);
        input.value = '';
        input.placeholder = 'Leave a sticky note...';
        input.removeAttribute('data-parent-id');
        loadComments(tid, uid);
    };
}

// Friend Check-in 功能
function setupFriendCheckIn(currentUserId, targetUserId, targetUsername) {
    const btn = document.getElementById('friendCheckInBtn');
    btn.style.display = 'block';
    
    // 检查今天是否已经 check-in 过
    checkTodayCheckIn(currentUserId, targetUserId).then(alreadyChecked => {
        if (alreadyChecked) {
            btn.innerText = '✅ Stickied Today';
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        }
    });
    
    btn.onclick = async () => {
        if (btn.disabled) return;
        
        const { error } = await supabase
            .from('friend_pokes')
            .insert([{
                sender_id: currentUserId,
                receiver_id: targetUserId
            }]);
        
        if (error) {
            console.error(error);
            showToast('Failed to sticky friend.', 'error');
            return;
        }
        
        btn.innerText = '✅ Stickied Today';
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        
        showToast('✨ Stickied your friend!', 'success');
    };
}

async function checkTodayCheckIn(currentUserId, targetUserId) {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
        .from('friend_pokes')
        .select('id')
        .eq('sender_id', currentUserId)
        .eq('receiver_id', targetUserId)
        .gte('created_at', today)
        .maybeSingle();
    
    return !!data;
}

async function loadFriendCheckIns(userId) {
    const list = document.getElementById('friendCheckInsList');
    
    // 查询谁 check-in 了我
    const { data: checkIns } = await supabase
        .from('friend_pokes')
        .select(`
            sender_id,
            created_at,
            profiles:sender_id (username)
        `)
        .eq('receiver_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (!checkIns || checkIns.length === 0) {
        list.innerHTML = '<p style="color:#aaa; font-size:12px;">No friend check-ins yet.</p>';
        return;
    }
    
    list.innerHTML = checkIns.map(c => {
        return `
            <div class="friend-checkin-item">
                <span class="friend-name">${c.profiles?.username || 'Anonymous'}</span>
            </div>
        `;
    }).join('');
}

function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
}

initProfile();