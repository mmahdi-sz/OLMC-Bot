// bot.js (Final Refactored Version with Intelligent RCON)

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const logger = require('./logger.js');
const db = require('./database.js');
const { loadConfig, loadCommands, getCommandHandler } = require('./core/setup.js');
const { connectRcon, getRconClient } = require('./core/rconManager.js');
const { handleChatMessage } = require('./core/chatBridge.js');
const { sendRankList, updateOnlineStatusTopic } = require('./utils/botUtils.js');
const callbackHandler = require('./handlers/callbackHandler.js');
const wizardHandler = require('./handlers/wizardHandler.js');
const registrationHandler = require('./handlers/registrationHandler.js');
const verifyHandler = require('./verify.js');
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

    const handleRconStateChange = (rconClient) => {
        updateOnlineStatusTopic(bot, db, rconClient);
    };

    connectRcon(appConfig.rcon, handleRconStateChange, bot, appConfig.superAdminId);

    loadCommands(bot, appConfig);

    startLogReader(bot, db, getRconClient); 
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
        if (!msg.text || msg.text.startsWith('/')) return;

        const isWizardHandled = await wizardHandler.handleWizardSteps(bot, msg, db, appConfig.superAdminId) ||
                                  await registrationHandler.handleRegistrationWizard(bot, msg, db, appConfig);
        if (isWizardHandled) return;

        if (msg.chat.type === 'private' && /^\d{6}$/.test(msg.text.trim())) {
            const code = msg.text.trim();
            const userId = msg.from.id;
            const userLang = await db.getUserLanguage(userId);

            const result = await verifyHandler.handleCodeSubmission(userId, code, userLang);
            await bot.sendMessage(userId, result.message, { parse_mode: 'Markdown' });
            
            return; 
        }
        
        if (msg.chat.id === appConfig.mainGroupId && msg.message_thread_id === appConfig.topicIds.chat) {
            return handleChatMessage(bot, msg, db, appConfig, getRconClient());
        }

        if (msg.is_topic_message && msg.chat.id === appConfig.mainGroupId) {
            const userId = msg.from.id;
            const topicId = msg.message_thread_id;
            
            if (topicId === appConfig.topicIds.chat) {
                return;
            }
            
            const isSuperAdmin = userId === appConfig.superAdminId;
            const isRegularAdmin = await db.isAdmin(userId);
            
            if (!isSuperAdmin && !isRegularAdmin) {
                try {
                    await bot.deleteMessage(msg.chat.id, msg.message_id);
                    logger.info('MESSAGE_FILTER', `Deleted unauthorized message in topic ${topicId}`, { userId });
                } catch (error) {
                    logger.error('MESSAGE_FILTER', 'Failed to delete unauthorized message', { error: error.message });
                }
            }
        }
    });
    
    logger.success(MODULE_NAME, "Bot is running and listening for events...");
}

main().catch(error => {
    logger.error(MODULE_NAME, "A fatal error occurred during bot startup:", { error: error.message, stack: error.stack });
    process.exit(1); 
});