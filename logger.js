// logger.js

const moment = require('moment-timezone');

/**
 * سطوح مختلف لاگ برای رنگ‌بندی در کنسول
 */
const LOG_LEVELS = {
    INFO: { color: '\x1b[36m' },    // Cyan
    DEBUG: { color: '\x1b[34m' },   // Blue
    WARN: { color: '\x1b[33m' },    // Yellow
    ERROR: { color: '\x1b[31m' },   // Red
    SUCCESS: { color: '\x1b[32m' }, // Green
};
const RESET_COLOR = '\x1b[0m';

/**
 * یک لاگر ساده و متمرکز برای کل برنامه
 * @param {string} level - سطح لاگ (INFO, DEBUG, WARN, ERROR, SUCCESS)
 * @param {string} module - نام ماژولی که لاگ از آنجا می‌آید (e.g., 'BOT', 'DB', 'CALLBACK')
 * @param {string} message - پیام اصلی لاگ
 * @param {object} [data={}] - داده‌های اضافی برای نمایش به صورت JSON
 */
function log(level, module, message, data = {}) {
    const levelInfo = LOG_LEVELS[level.toUpperCase()] || { color: '' };
    const timestamp = moment().tz('Asia/Tehran').format('YYYY-MM-DD HH:mm:ss');
    
    let logString = `${levelInfo.color}[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}${RESET_COLOR}`;
    
    // فقط در صورت وجود داده، آن را به لاگ اضافه کن
    if (data && Object.keys(data).length > 0) {
        // برای لاگ‌های خطا، stack trace را کامل نمایش بده
        if (level.toUpperCase() === 'ERROR' && data.stack) {
            logString += `\n${data.stack}`;
        } else {
            try {
                // نمایش زیبا و خوانای JSON
                const jsonData = JSON.stringify(data, null, 2);
                logString += `\n${levelInfo.color}Data: ${jsonData}${RESET_COLOR}`;
            } catch (e) {
                // اگر تبدیل به JSON ممکن نبود
                logString += `\n${levelInfo.color}Data: [Unserializable Object]${RESET_COLOR}`;
            }
        }
    }
    
    console.log(logString);
}

// ایجاد توابع میانبر برای استفاده آسان‌تر
const logger = {
    info: (module, message, data) => log('INFO', module, message, data),
    debug: (module, message, data) => log('DEBUG', module, message, data),
    warn: (module, message, data) => log('WARN', module, message, data),
    error: (module, message, data) => log('ERROR', module, message, data),
    success: (module, message, data) => log('SUCCESS', module, message, data),
};

module.exports = logger;