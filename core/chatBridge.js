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

    if (isSuperAdmin || isRegularAdmin) {
        username = await db.getUserLink(userId);
    }
    if (!username) {
        const registration = await db.getRegistrationByTelegramId(userId);
        if (registration && registration.status === 'approved') {
            username = registration.game_username;
        }
    }

    if (!username) {
        const warningEmoji = '⚠️';
        const mainBotLink = `@${mainBotUsername}`;
        
        const replyMsg = await bot.sendMessage(
            chatId, 
            `${warningEmoji} *شما مجاز به ارسال پیام نیستید*\n\n━━━━━━━━━━━━━━━━\n\nℹ️ ابتدا باید ثبت\\-نام کنید\\n\n👉 به ربات ${mainBotLink} مراجعه کنید`,
            {
                reply_to_message_id: messageId,
                message_thread_id: msg.message_thread_id,
                parse_mode: 'MarkdownV2'
            }
        );
        
        setTimeout(() => {
            bot.deleteMessage(chatId, messageId).catch(() => {});
            bot.deleteMessage(chatId, replyMsg.message_id).catch(() => {});
        }, 15000);
        
        return;
    }
    
    const hasUnlimitedChat = await luckpermsDb.isUserInGroups(username, unlimitedChatRanks);
    if (!isSuperAdmin && !isRegularAdmin && !hasUnlimitedChat) {
        const lastMessageTime = await db.getSetting(`chat_cooldown_${userId}`) || 0;
        const now = Math.floor(Date.now() / 1000);
        const timeSinceLastMessage = now - parseInt(lastMessageTime, 10);

        if (timeSinceLastMessage < cooldownSeconds) {
            const remaining = Math.ceil(cooldownSeconds - timeSinceLastMessage);
            
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            
            let timeText = '';
            if (minutes > 0) {
                timeText = `${minutes} دقیقه و ${seconds} ثانیه`;
            } else {
                timeText = `${seconds} ثانیه`;
            }

            const warningMsg = await bot.sendMessage(
                chatId, 
                `⏰ *کولداون چت*\n\n━━━━━━━━━━━━━━━━\n\n⚠️ شما می‌توانید بعد از *${timeText}* پیام بعدی را ارسال کنید\\n\n💡 *نکته:* برای چت نامحدود، رنک VIP تهیه کنید`,
                {
                    reply_to_message_id: messageId,
                    message_thread_id: msg.message_thread_id,
                    parse_mode: 'MarkdownV2'
                }
            );
            
            setTimeout(() => {
                bot.deleteMessage(chatId, messageId).catch(() => {});
                bot.deleteMessage(chatId, warningMsg.message_id).catch(() => {});
            }, remaining * 1000);
            
            return;
        }
        await db.setSetting(`chat_cooldown_${userId}`, now);
    }

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