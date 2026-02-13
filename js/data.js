import supabase from './supabaseClient.js';
import { getTodayStr, showToast } from './utils.js';

// ⚠️ 关键修复：一定要加 'export' 关键字
export async function ensureProfile(user) {
    const { data } = await supabase.from('profiles').select('id').eq('id', user.id).single();
    if (!data) {
        // 如果用户不存在，创建一个新的
        await supabase.from('profiles').insert([{
            id: user.id,
            username: user.email.split('@')[0],
            avatar_url: `https://ui-avatars.com/api/?name=${user.email.split('@')[0]}`,
            total_check_ins: 0,
            bio: "I'm testing Sticky!"
        }]);
    }
}

export async function getStreak(userId) {
    const { data } = await supabase.from('profiles').select('total_check_ins').eq('id', userId).single();
    return data ? data.total_check_ins : 0;
}

export async function performCheckIn(userId, photoData) {
    const today = getTodayStr();
    
    // 测试阶段：允许一天多次签到 (注释掉重复检查)
    // const { data: existing } = ...

    // 1. 写入签到记录
    const { error } = await supabase.from('check_ins').insert([{
        user_id: userId,
        check_in_date: today,
        photo_url: photoData // 注意这里字段名要和数据库一致，如果是 photo_url
    }]);

    if (error) {
        console.error("Check-in error:", error);
        throw error;
    }

    // 2. 更新连续天数
    const streak = await getStreak(userId);
    await supabase.from('profiles').update({ total_check_ins: streak + 1 }).eq('id', userId);
    
    return true;
}