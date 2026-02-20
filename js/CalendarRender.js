// js/CalendarRender.js
import { getTodayStr } from './utils.js';

export class CalendarRender {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    render(checkIns, currentMood = '✨') {
        // 注意：现在传入的 checkIns 应该是一个对象数组，不仅仅是日期字符串
        // 格式: [{ check_in_date: '2026-02-11', mood: '<emoji>' }, ...]
        // currentMood: 用户当前的心情（用于显示今天未签到时的状态）
        
        // 为了方便查找，把数组转成 Map: key=date, value=mood
        // 过滤掉默认的'⚙️'mood，不在日历上显示
        const recordMap = {};
        checkIns.forEach(item => {
            if (item.mood && item.mood !== '⚙️') {
                recordMap[item.check_in_date] = item.mood;
            }
        });

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); 
        
        const firstDayIndex = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        let html = `
            <div class="calendar-header">
                <span>${monthNames[month]} ${year}</span>
            </div>
            <div class="calendar-grid">
                <div class="weekday-label">S</div>
                <div class="weekday-label">M</div>
                <div class="weekday-label">T</div>
                <div class="weekday-label">W</div>
                <div class="weekday-label">T</div>
                <div class="weekday-label">F</div>
                <div class="weekday-label">S</div>
        `;

        for (let i = 0; i < firstDayIndex; i++) {
            html += `<div class="day-cell future"></div>`;
        }

        const todayStr = getTodayStr();

        for (let day = 1; day <= daysInMonth; day++) {
            const currentStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            let classes = 'day-cell';
            let content = `<span>${day}</span>`;
            
            const isToday = currentStr === todayStr;
            const isPast = currentStr < todayStr;
            
            // 检查是否有签到记录
            const hasRecord = recordMap.hasOwnProperty(currentStr);
            
            if (hasRecord) {
                classes += ' checked';
                
                // 核心逻辑：如果是今天，显示实时心情（未结算）
                if (isToday) {
                    // 今天如果mood是默认的⚙️，不显示在日历上
                    if (currentMood !== '⚙️') {
                        content += `<span class="day-mood">${currentMood}</span>`;
                    }
                } else {
                    // 过去的日子：显示已结算的 mood
                    const mood = recordMap[currentStr];
                    if (mood) {
                        content += `<span class="day-mood">${mood}</span>`;
                    }
                }
            } else if (isToday) {
                // 今天但还没签到：如果mood不是默认的⚙️，才显示半透明心情
                if (currentMood !== '⚙️') {
                    content += `<span class="day-mood" style="opacity: 0.4;">${currentMood}</span>`;
                }
            }
            
            if (isPast && !isToday) classes += ' past';
            if (isToday) classes += ' is-today';
            if (currentStr > todayStr) classes += ' future';

            html += `<div class="${classes}">${content}</div>`;
        }

        html += `</div>`;
        
        if(this.container) this.container.innerHTML = html;
    }
}