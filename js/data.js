import supabase from './supabaseClient.js';
import { getTodayStr, showToast } from './utils.js';

// 关键修复：一定要加 'export' 关键字
export async function ensureProfile(user) {
    const { data } = await supabase.from('profiles').select('id').eq('id', user.id).single();
    if (!data) {
        // 如果用户不存在，创建一个新的
        await supabase.from('profiles').insert([{
            id: user.id,
            username: user.email.split('@')[0],
            avatar_url: `https://ui-avatars.com/api/?name=${user.email.split('@')[0]}`,
            total_check_ins: 0,
            bio: "I'm testing Sticky!",
            mood: '⚙️'  // 默认mood，表示"Set Your Mood"
        }]);
    }
}

export async function getStreak(userId) {
    const { data } = await supabase.from('profiles').select('total_check_ins').eq('id', userId).single();
    return data ? data.total_check_ins : 0;
}

export async function performCheckIn(userId, photoData) {
    const today = getTodayStr();
    
    // 检查今天是否已经签到
    const { data: existing } = await supabase
        .from('check_ins')
        .select('id')
        .eq('user_id', userId)
        .eq('check_in_date', today)
        .maybeSingle();
    
    // 获取用户当前的 mood（无论是否已签到都需要）
    const { data: profile } = await supabase.from('profiles').select('mood').eq('id', userId).single();
    const currentMood = profile?.mood || '⚙️';

    if (existing) {
        // 如果今天已经签到过，不再重复计数，但允许更新mood
        await supabase
            .from('check_ins')
            .update({ mood: currentMood, photo_url: photoData })
            .eq('id', existing.id);

        return true;
    }

    // 1. 写入签到记录（包含mood）
    const { error } = await supabase.from('check_ins').insert([{
        user_id: userId,
        check_in_date: today,
        photo_url: photoData,
        mood: currentMood
    }]);

    if (error) {
        console.error("Check-in error:", error);
        throw error;
    }

    // 2. 更新连续天数（仅在首次签到时）
    const streak = await getStreak(userId);
    await supabase.from('profiles').update({ total_check_ins: streak + 1 }).eq('id', userId);
    
    // 3. 检查用户所属的groups，判断是否完成group check-in
    await checkGroupCheckIns(userId, today);
    
    return true;
}

// 检查并记录group check-in
async function checkGroupCheckIns(userId, today) {
    try {
        // 获取用户所属的所有groups
        const { data: memberships } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', userId);
        
        if (!memberships || memberships.length === 0) {
            console.log('User is not in any groups');
            return;
        }
        
        const groupIds = memberships.map(m => m.group_id);

        // 批量获取所有相关 group 的成员（2 次查询替代 N 次）
        const { data: allGroupMembers } = await supabase
            .from('group_members')
            .select('group_id, user_id')
            .in('group_id', groupIds);

        if (!allGroupMembers || allGroupMembers.length === 0) return;

        // 按 group_id 分组成员
        const membersByGroup = new Map();
        allGroupMembers.forEach(m => {
            if (!membersByGroup.has(m.group_id)) membersByGroup.set(m.group_id, []);
            membersByGroup.get(m.group_id).push(m.user_id);
        });

        // 批量获取今天所有相关用户的 check-in
        const allMemberIds = [...new Set(allGroupMembers.map(m => m.user_id))];
        const { data: todayCheckIns } = await supabase
            .from('check_ins')
            .select('user_id')
            .in('user_id', allMemberIds)
            .eq('check_in_date', today);
        const checkedInUserIds = new Set(todayCheckIns?.map(c => c.user_id) || []);

        // 批量获取今天已经记录过的 group check-ins
        const { data: existingGroupCheckIns } = await supabase
            .from('group_check_ins')
            .select('group_id')
            .in('group_id', groupIds)
            .eq('check_in_date', today);
        const alreadyRecordedGroups = new Set(existingGroupCheckIns?.map(g => g.group_id) || []);

        // 遍历每个 group 判断是否全员完成
        for (const groupId of groupIds) {
            const memberIds = membersByGroup.get(groupId) || [];
            if (memberIds.length === 0) continue;

            const allCheckedIn = memberIds.every(id => checkedInUserIds.has(id));

            if (allCheckedIn && !alreadyRecordedGroups.has(groupId)) {
                const { error: insertError } = await supabase.from('group_check_ins').insert([{
                    group_id: groupId,
                    check_in_date: today
                }]);

                if (insertError) {
                    console.error('Error inserting group check-in:', insertError);
                    continue;
                }

                // 更新 group 总计数
                const { data: group } = await supabase
                    .from('groups')
                    .select('total_group_check_ins')
                    .eq('id', groupId)
                    .single();

                const currentCount = group?.total_group_check_ins || 0;
                await supabase
                    .from('groups')
                    .update({ total_group_check_ins: currentCount + 1 })
                    .eq('id', groupId);
            }
        }
    } catch (error) {
        console.error('Error checking group check-ins:', error);
    }
}

export { checkGroupCheckIns };