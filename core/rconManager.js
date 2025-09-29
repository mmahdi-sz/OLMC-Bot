// core/rconManager.js

const { Rcon } = require('rcon-client');
const logger = require('../logger');

let rconClient = null;
let reconnectTimer = null;
let stopRetrying = false; // فلگ برای متوقف کردن تلاش‌های اتصال در صورت بروز خطای دائمی

/**
 * اتصال پایدار به RCON را برقرار کرده و مدیریت می‌کند.
 * این تابع به صورت هوشمند خطاهای دائمی (مانند رمز عبور اشتباه) را از خطاهای موقت (مانند ری‌استارت سرور) تشخیص می‌دهد.
 *
 * @param {object} rconConfig - تنظیمات اتصال (host, port, password, reconnectDelay).
 * @param {function} onStateChange - یک تابع callback که در زمان تغییر وضعیت اتصال (آنلاین/آفلاین) فراخوانی می‌شود. این تابع rconClient یا null را به عنوان ورودی می‌گیرد.
 * @param {object} bot - نمونه (instance) ربات تلگرام برای ارسال هشدار به ادمین.
 * @param {number} superAdminId - شناسه سوپرادمین برای دریافت هشدارهای حیاتی.
 */
function connectRcon(rconConfig, onStateChange, bot, superAdminId) {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
    stopRetrying = false; // ریست کردن وضعیت در هر بار فراخوانی

    const { host, port, password, reconnectDelay } = rconConfig;

    const attemptConnection = async () => {
        if (stopRetrying) {
            logger.warn('RCON_MANAGER', 'تلاش برای اتصال مجدد به دلیل خطای دائمی متوقف شده است.');
            return;
        }

        try {
            const newRcon = new Rcon({ host, port, password });

            newRcon.on('connect', () => {
                logger.success('RCON_MANAGER', 'اتصال به سرور RCON با موفقیت برقرار شد. پل ارتباطی فعال است.');
                rconClient = newRcon;
                if (onStateChange) onStateChange(rconClient);
            });

            newRcon.on('end', () => {
                logger.warn('RCON_MANAGER', `اتصال RCON قطع شد. تلاش مجدد تا ${reconnectDelay / 1000} ثانیه دیگر...`);
                rconClient = null;
                if (onStateChange) onStateChange(null);
                
                if (!stopRetrying) {
                    reconnectTimer = setTimeout(attemptConnection, reconnectDelay);
                }
            });

            newRcon.on('error', (err) => {
                logger.error('RCON_MANAGER', 'خطایی در اتصال RCON رخ داد.', { error: err.message });
            });

            await newRcon.connect();

        } catch (error) {
            logger.error('RCON_MANAGER', 'شروع اتصال به RCON ناموفق بود.', { error: error.message });
            rconClient = null;
            if (onStateChange) onStateChange(null);

            // <<<< بخش کلیدی: تشخیص نوع خطا >>>>
            if (error.message && error.message.toLowerCase().includes('login failed')) {
                stopRetrying = true; // <<<< جلوی تلاش‌های بعدی را بگیر
                logger.error('RCON_MANAGER', 'خطای حیاتی: احراز هویت RCON ناموفق بود. تلاش برای اتصال مجدد متوقف شد.');

                if (bot && superAdminId) {
                    const alertMessage = '⚠️ **خطای حیاتی در اتصال به RCON** ⚠️\n\nاتصال به سرور به دلیل **رمز عبور اشتباه** ناموفق بود.\n\nربات دیگر برای اتصال مجدد تلاش نخواهد کرد. لطفاً اطلاعات اتصال را در پنل مدیریت سرورها اصلاح کنید.';
                    bot.sendMessage(superAdminId, alertMessage, { parse_mode: 'Markdown' })
                       .catch(e => logger.error('RCON_MANAGER', 'ارسال پیام هشدار RCON به سوپرادمین ناموفق بود.', { error: e.message }));
                }
            } else {
                // برای خطاهای دیگر (مثل خاموش بودن سرور)، دوباره تلاش می‌کنیم
                reconnectTimer = setTimeout(attemptConnection, reconnectDelay);
            }
        }
    };

    attemptConnection();
}

/**
 * نمونه (instance) فعال RCON را برمی‌گرداند.
 * @returns {Rcon|null} کلاینت RCON یا null اگر متصل نباشد.
 */
function getRconClient() {
    return rconClient;
}

module.exports = {
    connectRcon,
    getRconClient
};