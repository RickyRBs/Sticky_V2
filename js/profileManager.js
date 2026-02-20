import supabase from './supabaseClient.js';
import { getCurrentUser, logout } from './auth.js';
import { showToast } from './utils.js';
import { CalendarRender } from './CalendarRender.js';

const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get('id');

async function initProfile() {
    const currentUser = await getCurrentUser();
    if (!currentUser) return window.location.href = 'login.html';

    // 设置登录按钮
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
        authBtn.innerText = 'Logout';
        authBtn.href = '#';
        authBtn.onclick = async (e) => { 
            e.preventDefault(); 
            await logout(); 
        };
    }

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
        // 显示问题管理按钮
        setupQuestionManagement(profile.id);
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
    const moods = ['🍀', '💤', '🎉', '💻', '☕', '😭', '😡', '❤️'];
    
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'profileEmojiOverlay';
    overlay.className = 'emoji-picker-overlay';
    
    // 创建picker容器
    const container = document.createElement('div');
    container.id = 'emojiPicker';
    container.className = 'emoji-picker';
    
    // 创建标题和网格
    const header = document.createElement('div');
    header.className = 'emoji-picker-header';
    header.textContent = 'SET YOUR MOOD';
    
    const grid = document.createElement('div');
    grid.className = 'emoji-picker-grid';

    moods.forEach(emoji => {
        const btn = document.createElement('button');
        btn.innerText = emoji;
        btn.className = 'emoji-picker-option';
        btn.dataset.mood = emoji;
        
        btn.onclick = async () => {
            showToast("Updating mood...");
            
            // A. 更新 Profile
            await supabase.from('profiles').update({ mood: emoji }).eq('id', userId);
            document.getElementById('moodText').innerText = emoji;
            
            // B. 尝试更新今天的 check_ins 记录 (实现"以此为准")
            const today = new Date().toISOString().split('T')[0];
            
            // 不管今天有没有签到，试着更新一下 check_in_date = today 的那条记录
            // 如果没签到，这个 update 不会影响任何行，也不会报错，非常安全
            await supabase.from('check_ins')
                .update({ mood: emoji })
                .eq('user_id', userId)
                .eq('check_in_date', today);

            // 关闭选择器
            container.classList.remove('show');
            overlay.classList.remove('show');
            
            // 直接用新的 emoji 刷新日历，不需要重新查询
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
        grid.appendChild(btn);
    });

    container.appendChild(header);
    container.appendChild(grid);

    return { picker: container, overlay };
}

function setupEditing(userId) {
    // 1. Mood 编辑：直接点击 emoji 弹出选择器
    const moodBadge = document.getElementById('moodBadgeTop');
    const { picker, overlay } = createEmojiPicker(userId);
    document.body.appendChild(overlay);
    document.body.appendChild(picker);

    const togglePicker = (show) => {
        if (show) {
            picker.classList.add('show');
            overlay.classList.add('show');
        } else {
            picker.classList.remove('show');
            overlay.classList.remove('show');
        }
    };

    moodBadge.onclick = (e) => {
        e.stopPropagation();
        const isShowing = picker.classList.contains('show');
        togglePicker(!isShowing);
    };

    // 点击overlay关闭
    overlay.onclick = () => {
        togglePicker(false);
    };

    // 点击其他地方关闭选择器
    document.addEventListener('click', (e) => {
        if (!picker.contains(e.target) && e.target !== moodBadge && !overlay.contains(e.target)) {
            togglePicker(false);
        }
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
        
        showToast('Uploading...', 'info');
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
        showToast('Avatar updated!', 'success');
    };
}

// 辅助函数保持不变
async function loadUserGroups(uid) {
    const el = document.getElementById('userGroupsBadges');
    if(!el) return;
    const {data} = await supabase.from('group_members').select('groups:group_id(name, total_group_check_ins)').eq('user_id', uid);
    el.innerHTML = data ? data.map(m=>{
        const groupName = m.groups.name;
        const checkIns = m.groups.total_group_check_ins || 0;
        return `<span style="background:#f5f5f7;color:#000;font-size:10px;padding:4px 8px;border:2px solid #000;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;display:inline-flex;align-items:center;gap:6px;">
            ${groupName}
            <span style="background:#000;color:#fff;padding:2px 6px;font-size:9px;border-radius:0;">${checkIns}d</span>
        </span>`;
    }).join('') : '';
}

async function loadUserCalendar(userId) {
    // 修改 select，多取一个 mood
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
    calendar.render(checks, profile?.mood || '⚙️');
}

function renderProfile(p) {
    document.getElementById('username').innerText = p.username || 'User';
    
    // 渲染 Mood
    document.getElementById('moodText').innerText = p.mood || '⚙️'; // 默认齿轮表示未设置
    
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
        // 分离主评论和回复，用 Map 预先索引回复（O(n) 替代 O(n²)）
        const mainComments = [];
        const repliesMap = new Map();
        data.forEach(c => {
            if (!c.parent_id) {
                mainComments.push(c);
            } else {
                if (!repliesMap.has(c.parent_id)) repliesMap.set(c.parent_id, []);
                repliesMap.get(c.parent_id).push(c);
            }
        });

        // 构建评论树
        let html = '';
        mainComments.forEach(comment => {
            const isOwn = comment.author_id === uid;
            const replyBtn = !isOwn ? `<button class="reply-btn" data-comment-id="${comment.id}" data-author="${comment.author.username}">Reply</button>` : '';

            html += `<div class="comment-thread">
                <div class="comment-item">
                    <strong>${comment.author.username}</strong>: ${comment.content}
                    ${replyBtn}
                </div>`;

            // 显示这条评论的回复
            const commentReplies = repliesMap.get(comment.id) || [];
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
    
    // 首先检查是否是好友关系
    checkFriendship(currentUserId, targetUserId).then(isFriend => {
        if (!isFriend) {
            btn.innerText = 'Not Friends';
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            return;
        }
        
        // 检查今天是否已经 check-in 过
        checkTodayCheckIn(currentUserId, targetUserId).then(alreadyChecked => {
            if (alreadyChecked) {
                btn.innerText = 'Stickied Today';
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        });
    });
    
    btn.onclick = async () => {
        if (btn.disabled) return;
        
        // 检查好友关系
        const isFriend = await checkFriendship(currentUserId, targetUserId);
        if (!isFriend) {
            showToast('You must be friends to sticky!', 'error');
            return;
        }
        
        // 获取目标用户的问题
        const { data: questions } = await supabase
            .from('user_questions')
            .select('*')
            .eq('user_id', targetUserId);
        
        if (!questions || questions.length < 3) {
            showToast(`${targetUsername} hasn't set up security questions yet (need 3+)`, 'error');
            return;
        }
        
        // 随机选择一个问题
        await askSecurityQuestion(questions, currentUserId, targetUserId, targetUsername, btn);
    };
}

async function checkFriendship(userId1, userId2) {
    const { data } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', userId1)
        .eq('friend_id', userId2)
        .maybeSingle();
    
    return !!data;
}

async function askSecurityQuestion(questions, currentUserId, targetUserId, targetUsername, btn) {
    // 随机选择一个问题
    let currentQuestionIndex = Math.floor(Math.random() * questions.length);
    let currentQuestion = questions[currentQuestionIndex];
    
    const answerInput = currentQuestion.answer_type === 'yesno' 
        ? confirm(`Security Question:\n\n${currentQuestion.question}\n\n(OK = Yes, Cancel = No)`) ? 'Y' : 'N'
        : prompt(`Security Question:\n\n${currentQuestion.question}\n\n(Enter a number, or type "NEXT" for another question)`);
    
    if (answerInput === null) {
        return; // 用户取消
    }
    
    // 如果输入NEXT，换一个问题
    if (answerInput.toUpperCase() === 'NEXT' && currentQuestion.answer_type === 'number') {
        const availableQuestions = questions.filter((q, i) => i !== currentQuestionIndex);
        if (availableQuestions.length > 0) {
            return askSecurityQuestion(availableQuestions, currentUserId, targetUserId, targetUsername, btn);
        } else {
            showToast('No more questions available', 'error');
            return;
        }
    }
    
    // 验证答案
    const isCorrect = answerInput.toString().trim() === currentQuestion.answer.toString().trim();
    
    if (!isCorrect) {
        showToast('Wrong answer! Try again.', 'error');
        return;
    }
    
    // 答案正确，记录friend poke
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
    
    btn.innerText = 'Stickied Today';
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
    
    showToast('Stickied your friend!', 'success');
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

// ===================================
// 问题管理功能
// ===================================
function setupQuestionManagement(userId) {
    const btn = document.getElementById('questionManageBtn');
    const panel = document.getElementById('questionPanel');
    const closeBtn = document.getElementById('closeQuestionBtn');
    const addBtn = document.getElementById('addQuestionBtn');
    
    btn.style.display = 'flex';
    
    btn.onclick = () => {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        if (panel.style.display === 'block') {
            loadUserQuestions(userId);
        }
    };
    
    closeBtn.onclick = () => {
        panel.style.display = 'none';
    };
    
    addBtn.onclick = () => addNewQuestion(userId);
}

async function loadUserQuestions(userId) {
    const list = document.getElementById('questionList');
    list.innerHTML = '<p style="color:#aaa; text-align:center; padding:20px;">Loading...</p>';
    
    const { data: questions } = await supabase
        .from('user_questions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    
    if (!questions || questions.length === 0) {
        list.innerHTML = '<p style="color:#aaa; text-align:center; padding:20px;">No questions yet. Add at least 3 questions!</p>';
        return;
    }
    
    list.innerHTML = questions.map(q => `
        <div class="notif-item" style="display: flex; justify-content: space-between; align-items: flex-start; padding: 12px; border-bottom: 1px solid #eee;">
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px;">${q.question}</div>
                <div style="font-size: 11px; color: #666;">Answer: ${q.answer} (${q.answer_type === 'number' ? 'Number' : 'Y/N'})</div>
            </div>
            <button class="close-notif-btn" onclick="deleteQuestion('${q.id}', '${userId}')" style="position: static; margin-left: 10px;">×</button>
        </div>
    `).join('');
}

async function addNewQuestion(userId) {
    const question = prompt('Enter your security question:');
    if (!question || question.trim().length < 5) {
        showToast('Question must be at least 5 characters', 'error');
        return;
    }
    
    const answerType = confirm('Is the answer a number? (OK = Number, Cancel = Y/N)') ? 'number' : 'yesno';
    
    let answer;
    if (answerType === 'number') {
        answer = prompt('Enter the answer (number):');
        if (!answer || isNaN(answer)) {
            showToast('Answer must be a valid number', 'error');
            return;
        }
    } else {
        const isYes = confirm('Is the answer YES? (OK = Yes, Cancel = No)');
        answer = isYes ? 'Y' : 'N';
    }
    
    const { error } = await supabase.from('user_questions').insert([{
        user_id: userId,
        question: question.trim(),
        answer: answer.toString(),
        answer_type: answerType
    }]);
    
    if (error) {
        console.error(error);
        showToast('Error adding question', 'error');
        return;
    }
    
    showToast('Question added!', 'success');
    loadUserQuestions(userId);
}

window.deleteQuestion = async function(questionId, userId) {
    if (!confirm('Delete this question?')) return;
    
    const { error } = await supabase
        .from('user_questions')
        .delete()
        .eq('id', questionId);
    
    if (error) {
        console.error(error);
        showToast('Error deleting question', 'error');
        return;
    }
    
    showToast('Question deleted', 'success');
    loadUserQuestions(userId);
};

initProfile();