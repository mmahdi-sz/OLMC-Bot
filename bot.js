// bot.js

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { Rcon } = require('rcon-client');
const cron = require('node-cron');

// ===== IMPORTS & DEPENDENCIES =====
const logger = require('./logger.js');
const db = require('./database.js');
const callbackHandler = require('./handlers/callbackHandler.js');
const wizardHandler = require('./handlers/wizardHandler.js');
const rankManager = require('./handlers/rankManager.js');
const registrationHandler = require('./handlers/registrationHandler.js');
const { startLogReader } = require('./logReader.js');
const { startServerMonitor } = require('./serverMonitor.js');
const luckpermsDb = require('./luckpermsDb.js');
const { getText } = require('./i18n.js');

const MODULE_NAME = 'BOT_CORE';

// ===== HELPER FUNCTIONS =====

function formatDuration(seconds) {
    if (seconds <= 0) return "Expired";
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    return `${d}D ${h}H ${m}M ${s}S`;
}

function escapeMarkdown(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[_*[\]()`]/g, '\\$&');
}

// **تغییر: این تابع escapeMarkdownV2 در اینجا دیگر استفاده نمی‌شود**
// **منطق escape کردن کاراکترهای MarkdownV2 برای نام ادمین پشتیبانی به فایل i18n.js منتقل خواهد شد.**
// function escapeMarkdownV2(text) {
//     if (typeof text !== 'string') return '';
//     return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
// }

async function sendLanguageSelectionMenu(bot, chatId) {
    const message = getText('fa', 'choose_language_prompt');
    const keyboard = {
        inline_keyboard: [
            [{ text: '🇮🇷 پارسی (Persian)', callback_data: 'set_lang_fa' }],
            [{ text: '🇺🇸 English (انگلیسی)', callback_data: 'set_lang_en' }]
        ]
    };
    await bot.sendMessage(chatId, message, { reply_markup: keyboard });
}

async function sendRankList(bot, db) {
    logger.info('RANK_LIST', 'Attempting to generate and send new optimized rank list...');
    try {
        const mainGroupId = await db.getSetting('main_group_id');
        const rankTopicId = await db.getSetting('topic_id_rank');

        if (!mainGroupId || !rankTopicId) {
            return logger.info('RANK_LIST', 'Rank list module is not configured or enabled.');
        }

        const configuredGroups = await db.getRankGroups();
        if (configuredGroups.length === 0) {
            return logger.info('RANK_LIST', 'No groups configured for rank list.');
        }
        
        const configuredGroupNames = configuredGroups.map(g => g.group_name);
        const allMembers = await luckpermsDb.getAllConfiguredGroupMembers(configuredGroupNames);

        const players = {};
        for (const member of allMembers) {
            if (!players[member.username]) {
                players[member.username] = {
                    username: member.username,
                    groups: []
                };
            }
            players[member.username].groups.push({
                name: member.group,
                expiry: member.expiry
            });
        }

        const finalPlayerAssignments = {};
        for (const username in players) {
            const player = players[username];
            let highestGroup = null;
            let highestExpiry = 0;

            for (const configuredGroup of configuredGroups) {
                const playerGroup = player.groups.find(g => g.name === configuredGroup.group_name);
                if (playerGroup) {
                    highestGroup = configuredGroup.group_name;
                    highestExpiry = playerGroup.expiry;
                    break; 
                }
            }

            if (!highestGroup && player.groups.length > 0) {
                 highestGroup = player.groups[0].name;
                 highestExpiry = player.groups[0].expiry;
            }

            if (highestGroup) {
                if (!finalPlayerAssignments[highestGroup]) {
                    finalPlayerAssignments[highestGroup] = [];
                }
                finalPlayerAssignments[highestGroup].push({
                    username: player.username,
                    expiry: highestExpiry
                });
            }
        }

        let allGroupsText = [];
        for (const group of configuredGroups) {
            const members = finalPlayerAssignments[group.group_name] || [];
            
            members.sort((a, b) => b.expiry - a.expiry);

            let playerListText = '';
            if (members.length > 0) {
                const memberLines = members.map(member => {
                    const expiryText = member.expiry === 0 ? 'دائمی' : formatDuration(member.expiry - (Date.now() / 1000));
                    const escapedUsername = escapeMarkdown(member.username);
                    return group.player_template.replace(/#p/g, escapedUsername).replace(/#t/g, expiryText);
                });
                playerListText = memberLines.join('\n');
            } else {
                playerListText = '_هیچ عضوی یافت نشد_';
            }

            const groupBlock = group.group_template.replace(/#t/g, group.display_name).replace(/#p/g, playerListText);
            allGroupsText.push(groupBlock);
        }

        const finalMessage = allGroupsText.join('\n\n');
        await bot.sendMessage(mainGroupId, finalMessage, { message_thread_id: rankTopicId, parse_mode: 'Markdown' });
        logger.success('RANK_LIST', 'Successfully sent optimized rank list.');

    } catch (error) {
        logger.error('RANK_LIST', 'Failed to send optimized rank list', { error: error.message, stack: error.stack });
    }
}

async function updateOnlineStatusTopic(bot, db, rconClient) {
    const MODULE = 'STATUS_TOPIC';
    try {
        const mainGroupId = await db.getSetting('main_group_id');
        const onlineTopicId = await db.getSetting('topic_id_online');
        if (!mainGroupId || !onlineTopicId) return;

        const isOnline = rconClient !== null;
        const newTopicName = isOnline ? '🟢 server is online | سرور انلاینه 🟢' : '🔴 server is offline | سرور افلاینه 🔴';
        
        await bot.editForumTopic(mainGroupId, onlineTopicId, { name: newTopicName });
        logger.info(MODULE, `Topic name updated to: ${newTopicName}`);
        
    } catch (error) {
        if (error.response && error.response.body && error.response.body.description.includes('TOPIC_NOT_MODIFIED')) {
            logger.debug(MODULE, 'Topic name is already up to date.');
        } else {
            logger.error(MODULE, 'Failed to update online status topic', { error: error.message, stack: error.stack });
        }
    }
}

// =================================== MAIN FUNCTION ===================================

async function main() {
    logger.info(MODULE_NAME, 'Starting bot application...');

    const token = process.env.BOT_TOKEN;
    const superAdminId = parseInt(process.env.SUPER_ADMIN_ID, 10);
    const supportAdminUsername = process.env.SUPPORT_ADMIN_USERNAME || 'otherland_admin';
    const mainBotUsername = process.env.MAIN_BOT_USERNAME || 'OLMCrobot';

    if (!token || !superAdminId) {
        logger.error(MODULE_NAME, 'FATAL: Bot token or Super Admin ID not found in .env file.');
        process.exit(1);
    }
    
    await db.initDb();
    
    const bot = new TelegramBot(token, { polling: true });
    const activeConnections = {};
    
    const userChatTimestamps = {};
    const CHAT_COOLDOWN_SECONDS = 300;
    const UNLIMITED_CHAT_RANKS = ['master', 'avatar', 'ultimate-', 'owner', 'admin'];

    const appConfig = {
        mainGroupId: null,
        topicIds: {},
        rcon: {
            host: process.env.BRIDGE_RCON_HOST,
            port: parseInt(process.env.BRIDGE_RCON_PORT, 10),
            password: process.env.BRIDGE_RCON_PASSWORD,
            reconnectDelay: 10000
        }
    };

    const VALID_MODULES = ['chat', 'players', 'rank', 'status', 'online', 'auction'];

    if (!appConfig.rcon.host || !appConfig.rcon.port || !appConfig.rcon.password) {
        logger.error(MODULE_NAME, "FATAL: RCON configuration is missing from the .env file.");
        process.exit(1);
    }
    
    async function loadConfigFromDB() {
        logger.info(MODULE_NAME, 'Loading configuration from database...');
        try {
            const mainGroupId = await db.getSetting('main_group_id');
            if (mainGroupId) appConfig.mainGroupId = parseInt(mainGroupId, 10);

            for (const moduleName of VALID_MODULES) {
                const topicId = await db.getSetting(`topic_id_${moduleName}`);
                if (topicId) appConfig.topicIds[moduleName] = parseInt(topicId, 10);
            }
            logger.success(MODULE_NAME, 'Configuration loaded successfully.', { config: appConfig });
        } catch (error) {
            logger.error(MODULE_NAME, 'Failed to load settings from database.', { error: error.message });
        }
    }
    await loadConfigFromDB();

    let bridgeRconClient = null;
    const connectBridgeRcon = async () => {
        try {
            const rcon = new Rcon({ host: appConfig.rcon.host, port: appConfig.rcon.port, password: appConfig.rcon.password });
            rcon.on('connect', () => { 
                logger.success('RCON_BRIDGE', 'Persistent RCON connection established!');
                bridgeRconClient = rcon; 
                updateOnlineStatusTopic(bot, db, bridgeRconClient);
            });
            rcon.on('end', () => { 
                logger.warn('RCON_BRIDGE', `RCON connection closed. Reconnecting in ${appConfig.rcon.reconnectDelay / 1000}s...`); 
                bridgeRconClient = null; 
                updateOnlineStatusTopic(bot, db, bridgeRconClient);
                setTimeout(connectBridgeRcon, appConfig.rcon.reconnectDelay); 
            });
            rcon.on('error', (err) => {
                logger.error('RCON_BRIDGE', 'RCON connection error.', { error: err.message });
                if (bridgeRconClient !== null) {
                    bridgeRconClient = null;
                    updateOnlineStatusTopic(bot, db, bridgeRconClient);
                }
            });
            await rcon.connect();
        } catch (error) {
            logger.error('RCON_BRIDGE', `Failed to initiate RCON connection. Retrying...`);
            if (bridgeRconClient !== null) {
                bridgeRconClient = null;
                updateOnlineStatusTopic(bot, db, bridgeRconClient);
            }
            setTimeout(connectBridgeRcon, appConfig.rcon.reconnectDelay);
        }
    };
    connectBridgeRcon();
    
    startLogReader(bot, db);
    const monitor = startServerMonitor(bot, db, () => bridgeRconClient);

    let rankListCronJob = null;
    async function setupRankListCron() {
        if (rankListCronJob) {
            rankListCronJob.stop();
            logger.info('RANK_CRON', 'Existing rank list job stopped.');
        }
        
        const intervalMinutes = await db.getSetting('rank_list_interval_minutes');
        if (intervalMinutes && parseInt(intervalMinutes, 10) > 0) {
            const schedule = `*/${intervalMinutes} * * * *`;
            rankListCronJob = cron.schedule(schedule, () => sendRankList(bot, db));
            logger.info('RANK_CRON', `Rank list scheduled to run every ${intervalMinutes} minutes.`);
        } else {
            logger.info('RANK_CRON', 'Rank list scheduling is disabled.');
        }
    }
    await setupRankListCron();
    
    // <<<< CHANGE START >>>>
    /**
     * تابع مرکزی برای مدیریت منطق دستور /start.
     * این تابع به صورت مستقل تعریف شده تا بتوان آن را از جاهای مختلف فراخوانی کرد.
     */
    async function handleStartCommand(bot, msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        // برای گرفتن referrerId از پیام، چه واقعی باشد چه ساختگی
        const match = (msg.text || '').match(/\/start(?: (.+))?$/) || [];
        const referrerId = match[1];

        const activeWizard = await db.getWizardState(userId);
        if (activeWizard) {
            await db.deleteWizardState(userId);
            logger.info('WIZARD_HANDLER', `Wizard (${activeWizard.wizard_type}) for user ${userId} was cancelled by /start command.`);
        }
        
        logger.info(MODULE_NAME, '/start command received', { userId, chatId, referrerId: referrerId || 'none' });
        
        const userLang = await db.getUserLanguage(userId);
        
        if (!userLang) {
            return sendLanguageSelectionMenu(bot, chatId);
        }

        const isSuperAdmin = (userId === superAdminId);
        const isRegularAdmin = await db.isAdmin(userId);
        
        if (isSuperAdmin || isRegularAdmin) {
            const baseKeyboard = [
                [{ text: getText(userLang, 'btn_rcon_menu'), callback_data: 'rcon_menu' }]
            ];
            if (isSuperAdmin) {
                baseKeyboard.push([{ text: getText(userLang, 'btn_admin_panel'), callback_data: 'admin_panel' }]);
                baseKeyboard.push([{ text: getText(userLang, 'btn_rank_list_management'), callback_data: 'manage_rank_list' }]);
            }
            return bot.sendMessage(chatId, getText(userLang, 'greeting_admin'), { reply_markup: { inline_keyboard: baseKeyboard } });
        }
        
        try {
            const registration = await db.getRegistrationByTelegramId(userId);
            if (registration) {
                if (registration.status === 'pending') {
                    // **تغییر:** فراخوانی `escapeMarkdownV2` از اینجا حذف شد.
                    // منطق escape کردن اکنون به عهده `getText` در `i18n.js` خواهد بود.
                    const message = getText(userLang, 'greeting_user_pending', supportAdminUsername, registration.uuid);
                    return bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
                }
                
                if (registration.status === 'approved') {
                    const message = getText(userLang, 'greeting_user_approved');
                    const keyboard = { inline_keyboard: [[{ text: getText(userLang, 'btn_manage_account'), callback_data: 'manage_account' }]] };
                    return bot.sendMessage(chatId, message, { reply_markup: keyboard });
                }
            }
            // اگر ثبت‌نامی وجود ندارد، فرآیند ثبت‌نام را شروع کن
            return registrationHandler.startRegistration(bot, msg, referrerId, db);
        } catch (error) {
            logger.error(MODULE_NAME, `Error in /start command for user ${userId}`, { error: error.message, stack: error.stack });
            return bot.sendMessage(chatId, getText(userLang, 'error_generic'));
        }
    }
    // <<<< CHANGE END >>>>


    // =================================== EVENT LISTENERS ===================================
    bot.on('polling_error', (error) => logger.error(MODULE_NAME, 'Polling error occurred.', { code: error.code }));
    
    // <<<< CHANGE START >>>>
    // شنونده دستور /start اکنون فقط تابع مرکزی را فراخوانی می‌کند.
    bot.onText(/\/start(?: (.+))?$/, async (msg) => {
        await handleStartCommand(bot, msg);
    });
    // <<<< CHANGE END >>>>
    
    bot.onText(/\/language/, async (msg) => {
        const chatId = msg.chat.id;
        logger.info(MODULE_NAME, '/language command received', { userId: msg.from.id, chatId });
        await sendLanguageSelectionMenu(bot, chatId);
    });

    bot.onText(/\/enable (.+)/, async (msg, match) => {
        const requesterId = msg.from.id;
        const chatId = msg.chat.id;
        const moduleName = match[1].trim().toLowerCase();
        
        logger.info('ADMIN_CMD', '/enable command received', { requesterId, chatId, moduleName });

        if (requesterId !== superAdminId) return;
        if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') return bot.sendMessage(requesterId, 'این دستور فقط در گروه‌ها قابل استفاده است.');
        if (!msg.is_topic_message || !msg.message_thread_id) return bot.sendMessage(chatId, 'این دستور باید در یک تاپیک اجرا شود، نه در چت عمومی گروه.');
        if (!VALID_MODULES.includes(moduleName)) return bot.sendMessage(chatId, `⚠️ ماژول "${moduleName}" نامعتبر است.`, { message_thread_id: msg.message_thread_id });

        try {
            const topicId = msg.message_thread_id;
            await db.setSetting('main_group_id', chatId);
            await db.setSetting(`topic_id_${moduleName}`, topicId);
            appConfig.mainGroupId = chatId;
            appConfig.topicIds[moduleName] = topicId;
            if (moduleName === 'online') updateOnlineStatusTopic(bot, db, bridgeRconClient);
            
            logger.success('ADMIN_CMD', `Module '${moduleName}' enabled successfully for topic ${topicId} in chat ${chatId}.`);
            bot.sendMessage(chatId, `✅ ماژول *${moduleName}* با موفقیت برای این تاپیک فعال شد.`, { message_thread_id: topicId, parse_mode: 'Markdown' });
        } catch (error) {
            logger.error('ADMIN_CMD', `Failed to enable module "${moduleName}"`, { error: error.message, stack: error.stack });
            bot.sendMessage(chatId, `❌ خطایی در فعال‌سازی ماژول *${moduleName}* رخ داد.`, { message_thread_id: msg.message_thread_id, parse_mode: 'Markdown' });
        }
    });

    bot.onText(/\/disable (.+)/, async (msg, match) => {
        const requesterId = msg.from.id;
        const chatId = msg.chat.id;
        const moduleName = match[1].trim().toLowerCase();
        logger.info('ADMIN_CMD', '/disable command received', { requesterId, chatId, moduleName });

        if (requesterId !== superAdminId) return;
        if (!VALID_MODULES.includes(moduleName)) return bot.sendMessage(chatId, `⚠️ ماژول "${moduleName}" نامعتبر است.`);

        try {
            await db.deleteSetting(`topic_id_${moduleName}`);
            delete appConfig.topicIds[moduleName];
            logger.success('ADMIN_CMD', `Module '${moduleName}' disabled successfully.`);
            bot.sendMessage(chatId, `✅ ماژول *${moduleName}* با موفقیت غیرفعال شد.`, { parse_mode: 'Markdown' });
        } catch (error) {
            logger.error('ADMIN_CMD', `Failed to disable module "${moduleName}"`, { error: error.message });
            bot.sendMessage(chatId, `❌ خطایی در غیرفعال‌سازی ماژول *${moduleName}* رخ داد.`, { parse_mode: 'Markdown' });
        }
    });

    bot.onText(/\/del (.+)/, async (msg) => {
        registrationHandler.handleDeleteRegistration(bot, msg, db, superAdminId);
    });
    
    bot.onText(/\/sendranklist/, async (msg) => {
        const userId = msg.from.id;
        logger.info(MODULE_NAME, '/sendranklist command received', { userId });
        const isSuperAdmin = (userId === superAdminId);
        const isRegularAdmin = await db.isAdmin(userId);
        if (!isSuperAdmin && !isRegularAdmin) return;
        
        const rankTopicId = await db.getSetting('topic_id_rank');
        if (msg.is_topic_message && msg.message_thread_id.toString() === rankTopicId) {
            bot.sendMessage(msg.chat.id, '✅ دستور ارسال لیست رنک‌ها اجرا شد. پیام تا چند لحظه دیگر ارسال می‌شود.', { message_thread_id: msg.message_thread_id });
            sendRankList(bot, db);
        } else {
            bot.sendMessage(msg.chat.id, 'این دستور فقط در تاپیک مخصوص رنک قابل استفاده است.', { message_thread_id: msg.message_thread_id });
        }
    });

    bot.onText(/\/ranks/, async (msg, match) => {
        const chatId = msg.chat.id;
        const topicId = msg.message_thread_id;
        if (!msg.is_topic_message || chatId !== appConfig.mainGroupId || topicId !== appConfig.topicIds.rank) return;
        logger.info(MODULE_NAME, '/ranks command received', { chatId, topicId });
        
        const groups = await luckpermsDb.getAllGroups();
        if (groups.length === 0) {
            return bot.sendMessage(chatId, 'هیچ گروهی در دیتابیس LuckPerms پیدا نشد.', { message_thread_id: topicId });
        }
        
        let message = '📋 **لیست گروه‌های سرور:**\n\n' + groups.map(group => `🔹 \`${group}\``).join('\n');
        message += '\n\nبرای دیدن زمان انقضای رنک اعضای یک گروه از دستور زیر استفاده کنید:\n`/rankexpiry <group_name>`';
        bot.sendMessage(chatId, message, { message_thread_id: topicId, parse_mode: 'Markdown' });
    });

    bot.onText(/\/rankexpiry (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const topicId = msg.message_thread_id;
        const userId = msg.from.id;
        
        const isSuperAdmin = (userId === superAdminId);
        const isRegularAdmin = await db.isAdmin(userId);

        if (!isSuperAdmin && !isRegularAdmin) return;
        if (!msg.is_topic_message || chatId !== appConfig.mainGroupId || topicId !== appConfig.topicIds.rank) return;

        const groupName = match[1].trim().toLowerCase();
        logger.info(MODULE_NAME, '/rankexpiry command received', { userId, groupName });
        const waitingMessage = await bot.sendMessage(chatId, `در حال دریافت اطلاعات از دیتابیس LuckPerms برای گروه *${groupName}*...`, { message_thread_id: topicId, parse_mode: 'Markdown' });

        try {
            const players = await luckpermsDb.getGroupExpiry(groupName);
            if (players.length === 0) {
                return bot.editMessageText(`هیچ بازیکنی با رنک موقت در گروه *${groupName}* پیدا نشد.`, {
                    chat_id: chatId, message_id: waitingMessage.message_id, parse_mode: 'Markdown'
                });
            }

            const nowInSeconds = Date.now() / 1000;
            let responseText = `👑 **زمان باقی‌مانده رنک ${groupName.toUpperCase()}**\n\n`;
            players.sort((a, b) => a.expiry - b.expiry).forEach(player => {
                const remainingSeconds = player.expiry - nowInSeconds;
                responseText += `👤 \`${player.username}\`: \`${formatDuration(remainingSeconds)}\`\n`;
            });
            bot.editMessageText(responseText, {
                chat_id: chatId, message_id: waitingMessage.message_id, parse_mode: 'Markdown'
            });
        } catch (error) {
            logger.error(MODULE_NAME, 'Error fetching rank expiry', { error: error.message, stack: error.stack });
            bot.editMessageText('❌ خطایی در هنگام ارتباط با دیتابیس LuckPerms رخ داد.', {
                chat_id: chatId, message_id: waitingMessage.message_id
            });
        }
    });

    bot.onText(/\/players force/, async (msg) => {
        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const topicId = msg.message_thread_id;

        logger.info(MODULE_NAME, '/players force command received', { userId });

        const isSuperAdmin = (userId === superAdminId);
        const isRegularAdmin = await db.isAdmin(userId);
        if (!isSuperAdmin && !isRegularAdmin) return;

        const playersTopicId = await db.getSetting('topic_id_players');
        if (msg.is_topic_message && topicId.toString() === playersTopicId) {
            await monitor.forceNewPlayerListMessage();
            bot.sendMessage(chatId, '✅ پیام جدید لیست بازیکنان به زودی ارسال و جایگزین پیام قبلی خواهد شد.', { message_thread_id: topicId });
        } else {
            bot.sendMessage(chatId, 'این دستور فقط در تاپیک مخصوص لیست بازیکنان قابل استفاده است.', { reply_to_message_id: msg.message_id });
        }
    });

    // <<<< CHANGE START >>>>
    // تابع handleStartCommand به عنوان پارامتر آخر به callbackHandler پاس داده می‌شود.
    bot.on('callback_query', (callbackQuery) => {
        callbackHandler.handleCallback(bot, callbackQuery, db, activeConnections, superAdminId, mainBotUsername, setupRankListCron, handleStartCommand);
    });
    // <<<< CHANGE END >>>>


    bot.on('message', async (msg) => {
        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const topicId = msg.message_thread_id;
        const text = msg.text;

        const isHandledByRegistration = await registrationHandler.handleRegistrationWizard(bot, msg, db);
        if (isHandledByRegistration) return;

        const isHandledByWizard = await wizardHandler.handleWizardSteps(bot, msg, db, superAdminId);
        if (isHandledByWizard) return;

        if (msg.forum_topic_edited) {
            const newTopicName = msg.forum_topic_edited.name;
            if (newTopicName.includes('server is online') || newTopicName.includes('server is offline')) {
                try { await bot.deleteMessage(msg.chat.id, msg.message_id); } catch (error) { /* Ignore */ }
                return;
            }
        }
        
        if (!text) {
            return;
        }

        const commandPart = text.split(' ')[0];
        const commands = ['/start', '/language', '/disconnect', '/set', '/enable', '/disable', '/players force', '/ranks', '/rankexpiry', '/sendranklist', '/del'];
        if (commands.includes(commandPart)) return;
        
        const isSuperAdmin = (userId === superAdminId);
        const isRegularAdmin = await db.isAdmin(userId);
        const chatTopicId = appConfig.topicIds.chat;

        if (chatId === appConfig.mainGroupId && topicId === chatTopicId) {
            if (!bridgeRconClient) return logger.warn('CHAT_BRIDGE', 'RCON is down. Message from TG to Game ignored.');

            let username = null;

            if (isSuperAdmin || isRegularAdmin) {
                username = await db.getUserLink(userId);
                if (username) {
                    logger.debug('CHAT_BRIDGE', `Found manually linked username for admin ${userId}: ${username}`);
                }
            }

            if (!username) {
                const registration = await db.getRegistrationByTelegramId(userId);
                if (registration && registration.status === 'approved') {
                    username = registration.game_username;
                    logger.debug('CHAT_BRIDGE', `Found registered username for user ${userId}: ${username}`);
                }
            }

            if (!username) {
                const replyMsg = await bot.sendMessage(chatId, `شما نمیتوانید در چت صحبت کنید. لطفاً به بات @${mainBotUsername} رفته و مراحل ثبت نام خود را تکمیل کنید.`, { reply_to_message_id: msg.message_id, message_thread_id: topicId });
                setTimeout(() => { 
                    try {
                       bot.deleteMessage(chatId, msg.message_id); 
                       bot.deleteMessage(chatId, replyMsg.message_id); 
                    } catch(e) {/* ignore */}
                }, 20000);
                return;
            }

            let canSendMessage = false;

            if (isSuperAdmin || isRegularAdmin) {
                canSendMessage = true;
            } else {
                const hasUnlimitedChat = await luckpermsDb.isUserInGroups(username, UNLIMITED_CHAT_RANKS);
                if (hasUnlimitedChat) {
                    canSendMessage = true;
                    logger.debug('CHAT_BRIDGE', 'Unlimited rank user message to be sent.', { userId, username });
                } else {
                    const now = Date.now() / 1000;
                    const lastMessageTime = userChatTimestamps[userId] || 0;
                    const timeSinceLastMessage = now - lastMessageTime;

                    if (timeSinceLastMessage < CHAT_COOLDOWN_SECONDS) {
                        const remainingCooldown = Math.ceil(CHAT_COOLDOWN_SECONDS - timeSinceLastMessage);
                        const warningText = `شما بعد از ${remainingCooldown} ثانیه میتوانید پیام دیگری ارسال کنید. برای رفع محدودیت‌ها رنک Master یا بالاتر را تهیه کنید.\nتوجه کنید که این پیام و پیام شما حذف خواهد شد و به سرور فرستاده نخواهد شد.`;
                        const warningMsg = await bot.sendMessage(chatId, warningText, { reply_to_message_id: msg.message_id, message_thread_id: topicId });
                        
                        try {
                            const muteUntilTimestamp = Math.floor(Date.now() / 1000 + remainingCooldown);
                            
                            await bot.restrictChatMember(chatId, userId, {
                                can_send_messages: false,
                                until_date: muteUntilTimestamp
                            });
                            logger.info('CHAT_BRIDGE', `User muted for ${remainingCooldown}s due to cooldown.`, { userId, until: new Date(muteUntilTimestamp * 1000).toISOString() });
                        } catch(err) {
                            logger.error('CHAT_BRIDGE', `Failed to mute user ${userId}.`, { error: err.message });
                        }

                        setTimeout(() => { 
                            try {
                                bot.deleteMessage(chatId, msg.message_id);
                                bot.deleteMessage(chatId, warningMsg.message_id);
                            } catch(e) {/* ignore */}
                        }, 20000);
                        return;
                    }
                    
                    userChatTimestamps[userId] = now;
                    canSendMessage = true;
                    logger.debug('CHAT_BRIDGE', 'Regular user message to be sent.', { userId, username });
                }
            }
            
            if (canSendMessage) {
                try {
                    const sanitizedText = text.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
                    const command = `tellraw @a [{"text":"[Telegram] ","color":"aqua"},{"text":"${username}","color":"white"},{"text":": ${sanitizedText}","color":"gray"}]`;
                    await bridgeRconClient.send(command);
                } catch (error) {
                    logger.error('CHAT_BRIDGE', 'Failed to send message via RCON', { error: error.message, stack: error.stack });
                }
            }
            return;
        }

        if (msg.is_topic_message && chatId === appConfig.mainGroupId && topicId !== chatTopicId && !(isSuperAdmin || isRegularAdmin)) {
            logger.debug('AUTO_DELETE', `Deleting non-admin/non-command message in a restricted topic.`, { userId, topicId });
            bot.deleteMessage(chatId, msg.message_id).catch(() => {});
            return;
        }

        if (activeConnections[userId] && (isSuperAdmin || isRegularAdmin)) {
            logger.debug('RCON_SESSION', `User ${userId} sent RCON command`, { command: text });
            try {
                const response = await activeConnections[userId].send(text);
                const cleanedResponse = response.replace(/§./g, '');
                bot.sendMessage(chatId, `<code>${cleanedResponse || '(No response)'}</code>`, { parse_mode: 'HTML' });
            } catch (error) {
                    logger.error('RCON_SESSION', `Error sending command for user ${userId}`, { error: error.message });
                bot.sendMessage(chatId, `Error sending command: ${error.message}`);
            }
        }
    });

    bot.onText(/\/disconnect/, async (msg) => {
        const chatId = msg.chat.id;
        logger.info(MODULE_NAME, '/disconnect command received', { chatId });
        if (activeConnections[chatId]) {
            activeConnections[chatId].initiatedDisconnect = true; 
            await activeConnections[chatId].end();
            delete activeConnections[chatId];
            bot.sendMessage(chatId, '✅ اتصال شما با موفقیت قطع شد.');
        } else {
            bot.sendMessage(chatId, "شما در حال حاضر به هیچ سروری متصل نیستی.");
        }
    });

    bot.onText(/\/set (\d+) (.+)/, async (msg, match) => {
        if (msg.from.id !== superAdminId) return;
        const targetUserId = parseInt(match[1], 10);
        const ingameUsername = match[2].trim();
        logger.info('ADMIN_CMD', '/set command received', { targetUserId, ingameUsername });
        try {
            await db.setUserLink(targetUserId, ingameUsername);
            logger.success('ADMIN_CMD', 'User link set successfully.');
            bot.sendMessage(superAdminId, `✅ نام کاربری "${ingameUsername}" با موفقیت برای کاربر با شناسه "${targetUserId}" ثبت شد.`);
        } catch (error) {
            logger.error('ADMIN_CMD', 'Failed to execute /set command', { error: error.message });
            bot.sendMessage(superAdminId, '❌ خطایی در هنگام ثبت نام کاربری رخ داد.');
        }
    });
    
    logger.success(MODULE_NAME, "Bot is running and listening for events...");
}

main().catch(error => {
    logger.error(MODULE_NAME, "A fatal error occurred during bot startup:", { error: error.message, stack: error.stack });
    process.exit(1); 
});