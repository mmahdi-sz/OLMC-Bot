// bot.js (Final Refactored Version with Intelligent RCON)

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const logger = require('./logger.js');
const db = require('./database.js');
const { loadConfig, loadCommands, getCommandHandler } = require('./core/setup.js');
const { connectRcon, getRconClient } = require('./core/rconManager.js'); // <<<< بدون تغییر
const { handleChatMessage } = require('./core/chatBridge.js');
const { sendRankList, updateOnlineStatusTopic } = require('./utils/botUtils.js');
const callbackHandler = require('./handlers/callbackHandler.js');
const wizardHandler = require('./handlers/wizardHandler.js');
const registrationHandler = require('./handlers/registrationHandler.js');
const { startLogReader } = require('./logReader.js');
const { startServerMonitor } = require('./serverMonitor.js');

const MODULE_NAME = 'BOT_CORE';

async function main() {
    logger.info(MODULE_NAME, 'Starting bot application...');

    const token = process.env.BOT_TOKEN;
    if (!token) {
        logger.error(MODULE_NAME, 'FATAL: Bot token not found in .env file.');
        process.exit(1);
    }

    await db.initDb();
    const appConfig = await loadConfig();

    const bot = new TelegramBot(token, { polling: { interval: 300, params: { timeout: 10 } } });
    await bot.deleteWebHook();
    await bot.getUpdates({ offset: -1 });
    logger.info(MODULE_NAME, 'Cleared pending updates to prevent message flood.');

    // <<<< CHANGE START >>>>
    // ---------- بخش اتصال RCON به طور کامل بازنویسی شده است ----------
    
    // این تابع callback هر زمان که وضعیت RCON تغییر کند (آنلاین/آفلاین) فراخوانی می‌شود.
    const handleRconStateChange = (rconClient) => {
        // ماژول‌هایی که به وضعیت زنده RCON وابسته‌اند، از این طریق به‌روز می‌شوند.
        updateOnlineStatusTopic(bot, db, rconClient);
        // سرویس مانیتورینگ بازیکنان نیز باید از وضعیت جدید مطلع شود.
        // (این بخش در فایل serverMonitor.js پیاده‌سازی خواهد شد)
    };

    // فراخوانی rconManager هوشمند جدید
    // ما نمونه bot و superAdminId را برای ارسال هشدارهای ضروری به آن پاس می‌دهیم.
    connectRcon(appConfig.rcon, handleRconStateChange, bot, appConfig.superAdminId);
    
    // ---------- پایان بخش تغییر یافته ----------
    // <<<< CHANGE END >>>>

    loadCommands(bot, appConfig);

    // Initialize background services
    startLogReader(bot, db);
    // ما getRconClient را به سرویس‌ها پاس می‌دهیم تا همیشه به آخرین وضعیت کلاینت دسترسی داشته باشند.
    startServerMonitor(bot, db, getRconClient); 

    let rankListCronJob = null;
    async function setupRankListCron() {
        if (rankListCronJob) rankListCronJob.stop();
        
        const interval = await db.getSetting('rank_list_interval_minutes');
        if (interval && parseInt(interval) > 0) {
            rankListCronJob = cron.schedule(`*/${interval} * * * *`, () => sendRankList(bot, db));
            logger.info('RANK_CRON', `Rank list scheduled to run every ${interval} minutes.`);
        } else {
            logger.info('RANK_CRON', 'Rank list scheduling is disabled.');
        }
    }
    await setupRankListCron();

    // =================================== EVENT LISTENERS ===================================

    bot.on('polling_error', (error) => logger.error(MODULE_NAME, 'Polling error occurred.', { code: error.code }));

    bot.on('callback_query', (callbackQuery) => {
        const startCommandHandler = getCommandHandler('/start');
        callbackHandler.handleCallback(bot, callbackQuery, db, appConfig, setupRankListCron, startCommandHandler);
    });

    bot.on('message', async (msg) => {
        if (msg.text && msg.text.startsWith('/')) return; // Commands are handled by onText

        const isWizardHandled = await wizardHandler.handleWizardSteps(bot, msg, db, appConfig.superAdminId) ||
                                  await registrationHandler.handleRegistrationWizard(bot, msg, db);
        if (isWizardHandled) return;
        
        // Chat Bridge Logic
        if (msg.chat.id === appConfig.mainGroupId && msg.message_thread_id === appConfig.topicIds.chat) {
            // chatBridge برای کار کردن به آخرین وضعیت کلاینت RCON نیاز دارد
            return handleChatMessage(bot, msg, db, appConfig, getRconClient());
        }

        // Auto-delete non-admin messages in restricted topics
        if (msg.is_topic_message && msg.chat.id === appConfig.mainGroupId && msg.message_thread_id !== appConfig.topicIds.chat) {
            const isSuperAdmin = msg.from.id === appConfig.superAdminId;
            const isRegularAdmin = await db.isAdmin(msg.from.id);
            if (!isSuperAdmin && !isRegularAdmin) {
                bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});
            }
        }
    });
    
    logger.success(MODULE_NAME, "Bot is running and listening for events...");
}

main().catch(error => {
    logger.error(MODULE_NAME, "A fatal error occurred during bot startup:", { error: error.message, stack: error.stack });
    process.exit(1); 
});