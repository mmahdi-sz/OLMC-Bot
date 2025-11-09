// core/chatBridge.js

const logger = require('../logger');
const db = require('../database');
const luckpermsDb = require('../luckpermsDb');

async function handleChatMessage(bot, msg, db, appConfig, rconClient) {
    const { from: { id: userId }, chat: { id: chatId }, message_id: messageId, text } = msg;

    if (!rconClient) {
        return logger.warn('CHAT_BRIDGE', 'RCON client is not connected. Message from Telegram to game is ignored.');
    }

    const { superAdminId, mainBotUsername, chat: { unlimitedChatRanks, cooldownSeconds } } = appConfig;
    const isSuperAdmin = (userId === superAdminId);
    const isRegularAdmin = await db.isAdmin(userId);
    let username = null;

    // 1. Find the user's in-game name
    if (isSuperAdmin || isRegularAdmin) {
        username = await db.getUserLink(userId);
    }
    if (!username) {
        const registration = await db.getRegistrationByTelegramId(userId);
        if (registration && registration.status === 'approved') {
            username = registration.game_username;
        }
    }

    // 2. If user is not registered, send a warning and delete it
    if (!username) {
        const replyMsg = await bot.sendMessage(chatId, `شما نمی‌توانید در چت صحبت کنید. لطفاً به بات @${mainBotUsername} رفته و مراحل ثبت نام خود را تکمیل کنید.`, {
            reply_to_message_id: messageId,
            message_thread_id: msg.message_thread_id
        });
        setTimeout(() => {
            bot.deleteMessage(chatId, messageId).catch(() => {});
            bot.deleteMessage(chatId, replyMsg.message_id).catch(() => {});
        }, 20000);
        return;
    }
    
    // 3. Check for cooldown
    const hasUnlimitedChat = await luckpermsDb.isUserInGroups(username, unlimitedChatRanks);
    if (!isSuperAdmin && !isRegularAdmin && !hasUnlimitedChat) {
        const lastMessageTime = await db.getSetting(`chat_cooldown_${userId}`) || 0;
        const now = Math.floor(Date.now() / 1000);
        const timeSinceLastMessage = now - parseInt(lastMessageTime, 10);

        if (timeSinceLastMessage < cooldownSeconds) {
            const remaining = Math.ceil(cooldownSeconds - timeSinceLastMessage);
            const warningMsg = await bot.sendMessage(chatId, `شما بعد از ${remaining} ثانیه می‌توانید پیام دیگری ارسال کنید.`, {
                reply_to_message_id: messageId,
                message_thread_id: msg.message_thread_id
            });
            setTimeout(() => {
                bot.deleteMessage(chatId, messageId).catch(() => {});
                bot.deleteMessage(chatId, warningMsg.message_id).catch(() => {});
            }, 20000);
            return;
        }
        await db.setSetting(`chat_cooldown_${userId}`, now);
    }

    // 4. Sanitize and send the message to the game via RCON
    try {
        const sanitizedUsername = username.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const sanitizedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        
        const command = `tellraw @a [{"text":"[Telegram] ","color":"aqua"},{"text":"${sanitizedUsername}","color":"white"},{"text":": ${sanitizedText}","color":"gray"}]`;
        
        await rconClient.send(command);
        logger.info('CHAT_BRIDGE', `Message from ${username} (TG: ${userId}) sent to game.`);
    } catch (error) {
        logger.error('CHAT_BRIDGE', 'Failed to send message via RCON', { error: error.message });
    }
}

module.exports = {
    handleChatMessage
};