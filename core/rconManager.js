// core/rconManager.js

const { Rcon } = require('rcon-client');
const logger = require('../logger');

let rconClient = null;
let reconnectTimer = null;
let stopRetrying = false;

function connectRcon(rconConfig, onStateChange, bot, superAdminId) {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    if (rconClient) {
        try {
            rconClient.end();
        } catch (e) {
            logger.warn('RCON_MANAGER', 'Error closing previous connection', { error: e.message });
        }
        rconClient = null;
    }
    
    stopRetrying = false;

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

            if (error.message && error.message.toLowerCase().includes('login failed')) {
                stopRetrying = true;
                logger.error('RCON_MANAGER', 'خطای حیاتی: احراز هویت RCON ناموفق بود. تلاش برای اتصال مجدد متوقف شد.');

                if (bot && superAdminId) {
                    const alertMessage = '⚠️ **خطای حیاتی در اتصال به RCON** ⚠️\n\nاتصال به سرور به دلیل **رمز عبور اشتباه** ناموفق بود.\n\nربات دیگر برای اتصال مجدد تلاش نخواهد کرد. لطفاً اطلاعات اتصال را در پنل مدیریت سرورها اصلاح کنید.';
                    bot.sendMessage(superAdminId, alertMessage, { parse_mode: 'Markdown' })
                       .catch(e => logger.error('RCON_MANAGER', 'ارسال پیام هشدار RCON به سوپرادمین ناموفق بود.', { error: e.message }));
                }
            } else {
                if (!stopRetrying) {
                    reconnectTimer = setTimeout(attemptConnection, reconnectDelay);
                }
            }
        }
    };

    attemptConnection();
}

function getRconClient() {
    return rconClient;
}

function disconnectRcon() {
    stopRetrying = true;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (rconClient) {
        try {
            rconClient.end();
        } catch (e) {
            logger.error('RCON_MANAGER', 'Error disconnecting RCON', { error: e.message });
        }
        rconClient = null;
    }
}

module.exports = {
    connectRcon,
    getRconClient,
    disconnectRcon
};