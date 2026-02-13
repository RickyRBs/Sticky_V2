import supabase from './supabaseClient.js';
import { showToast } from './utils.js';

export async function loginOrSignup(email, password) {
    // 1. 尝试登录
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // 2. 如果登录失败且是因为账号不存在，尝试注册
    if (error && error.message.includes("Invalid login")) {
        showToast("Account not found, creating new account...", "info");
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
        
        if (signUpError) {
            throw new Error(signUpError.message);
        }
        return { user: signUpData.user, isNew: true };
    } else if (error) {
        throw error;
    }

    return { user: data.user, isNew: false };
}

export async function logout() {
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.href = 'login.html';
}

export async function getCurrentUser() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user || null;
}