// commands/rankCommands.js

const db = require('../database');
const logger = require('../logger');
const luckpermsDb = require('../luckpermsDb');
const { formatDuration } = require('../utils/formatters'); // Helper function moved
const { sendRankList } = require('../utils/botUtils'); // Main function moved

// --- /sendranklist command ---
const sendRankListCommand = {
    name: '/sendranklist',
    regex: /\/sendranklist/,
    execute: async (bot, msg, match, appConfig) => {
        const userId = msg.from.id;
        const isSuperAdmin = (userId === appConfig.superAdminId);
        const isRegularAdmin = await db.isAdmin(userId);
        if (!isSuperAdmin && !isRegularAdmin) return;
        
        const rankTopicId = await db.getSetting('topic_id_rank');
        if (msg.is_topic_message && msg.message_thread_id.toString() === rankTopicId) {
            bot.sendMessage(msg.chat.id, '✅ دستور ارسال لیست رنک‌ها اجرا شد. پیام تا چند لحظه دیگر ارسال می‌شود.', { message_thread_id: msg.message_thread_id });
            sendRankList(bot, db);
        } else {
            bot.sendMessage(msg.chat.id, 'این دستور فقط در تاپیک مخصوص رنک قابل استفاده است.', { message_thread_id: msg.message_thread_id });
        }
    }
};

// --- /ranks command ---
const ranksCommand = {
    name: '/ranks',
    regex: /\/ranks/,
    execute: async (bot, msg, match, appConfig) => {
        const chatId = msg.chat.id;
        const topicId = msg.message_thread_id;
        if (!msg.is_topic_message || chatId !== appConfig.mainGroupId || topicId !== appConfig.topicIds.rank) return;
        
        const groups = await luckpermsDb.getAllGroups();
        if (groups.length === 0) {
            return bot.sendMessage(chatId, 'هیچ گروهی در دیتابیس LuckPerms پیدا نشد.', { message_thread_id: topicId });
        }
        
        let message = '📋 **لیست گروه‌های سرور:**\n\n' + groups.map(group => `🔹 \`${group}\``).join('\n');
        message += '\n\nبرای دیدن زمان انقضای رنک اعضای یک گروه از دستور زیر استفاده کنید:\n`/rankexpiry <group_name>`';
        bot.sendMessage(chatId, message, { message_thread_id: topicId, parse_mode: 'Markdown' });
    }
};

// --- /rankexpiry command ---
const rankExpiryCommand = {
    name: '/rankexpiry',
    regex: /\/rankexpiry (.+)/,
    execute: async (bot, msg, match, appConfig) => {
        const userId = msg.from.id;
        const isSuperAdmin = (userId === appConfig.superAdminId);
        const isRegularAdmin = await db.isAdmin(userId);
        if (!isSuperAdmin && !isRegularAdmin) return;

        const chatId = msg.chat.id;
        const topicId = msg.message_thread_id;
        if (!msg.is_topic_message || chatId !== appConfig.mainGroupId || topicId !== appConfig.topicIds.rank) return;

        const groupName = match[1].trim().toLowerCase();
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
            logger.error('CMD_RANKEXPIRY', 'Error fetching rank expiry', { error: error.message });
            bot.editMessageText('❌ خطایی در هنگام ارتباط با دیتابیس LuckPerms رخ داد.', {
                chat_id: chatId, message_id: waitingMessage.message_id
            });
        }
    }
};

module.exports = [
    sendRankListCommand,
    ranksCommand,
    rankExpiryCommand
];