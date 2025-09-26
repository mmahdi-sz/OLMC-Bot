const db = require('../database');
const logger = require('../logger');
// این خط که باعث خطا می‌شد حذف گردید
const registrationHandler = require('../handlers/registrationHandler');

// --- /enable command ---
const enableCommand = {
    name: '/enable',
    regex: /\/enable (.+)/,
    execute: async (bot, msg, match, appConfig) => {
        const requesterId = msg.from.id;
        if (requesterId !== appConfig.superAdminId) return;

        const chatId = msg.chat.id;
        const moduleName = match[1].trim().toLowerCase();
        
        logger.info('ADMIN_CMD', '/enable command received', { requesterId, chatId, moduleName });

        if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
            return bot.sendMessage(requesterId, 'این دستور فقط در گروه‌ها قابل استفاده است.');
        }
        if (!msg.is_topic_message || !msg.message_thread_id) {
            return bot.sendMessage(chatId, 'این دستور باید در یک تاپیک اجرا شود، نه در چت عمومی گروه.');
        }
        // بهبود: استفاده از appConfig.validModules به جای متغیر وارد شده
        if (!appConfig.validModules.includes(moduleName)) {
            return bot.sendMessage(chatId, `⚠️ ماژول "${moduleName}" نامعتبر است.`, { message_thread_id: msg.message_thread_id });
        }

        try {
            const topicId = msg.message_thread_id;
            await db.setSetting('main_group_id', chatId);
            await db.setSetting(`topic_id_${moduleName}`, topicId);
            
            // Reload config in memory
            appConfig.mainGroupId = chatId;
            appConfig.topicIds[moduleName] = topicId;
            
            logger.success('ADMIN_CMD', `Module '${moduleName}' enabled successfully for topic ${topicId} in chat ${chatId}.`);
            bot.sendMessage(chatId, `✅ ماژول *${moduleName}* با موفقیت برای این تاپیک فعال شد.`, { message_thread_id: topicId, parse_mode: 'Markdown' });
        } catch (error) {
            logger.error('ADMIN_CMD', `Failed to enable module "${moduleName}"`, { error: error.message });
            bot.sendMessage(chatId, `❌ خطایی در فعال‌سازی ماژول *${moduleName}* رخ داد.`, { message_thread_id: msg.message_thread_id, parse_mode: 'Markdown' });
        }
    }
};

// --- /disable command ---
const disableCommand = {
    name: '/disable',
    regex: /\/disable (.+)/,
    execute: async (bot, msg, match, appConfig) => {
        const requesterId = msg.from.id;
        if (requesterId !== appConfig.superAdminId) return;
        
        const chatId = msg.chat.id;
        const moduleName = match[1].trim().toLowerCase();
        logger.info('ADMIN_CMD', '/disable command received', { requesterId, chatId, moduleName });

        // بهبود: استفاده از appConfig.validModules به جای متغیر وارد شده
        if (!appConfig.validModules.includes(moduleName)) {
            return bot.sendMessage(chatId, `⚠️ ماژول "${moduleName}" نامعتبر است.`);
        }

        try {
            await db.deleteSetting(`topic_id_${moduleName}`);
            delete appConfig.topicIds[moduleName];
            logger.success('ADMIN_CMD', `Module '${moduleName}' disabled successfully.`);
            bot.sendMessage(chatId, `✅ ماژول *${moduleName}* با موفقیت غیرفعال شد.`, { parse_mode: 'Markdown' });
        } catch (error) {
            logger.error('ADMIN_CMD', `Failed to disable module "${moduleName}"`, { error: error.message });
            bot.sendMessage(chatId, `❌ خطایی در غیرفعال‌سازی ماژول *${moduleName}* رخ داد.`, { parse_mode: 'Markdown' });
        }
    }
};

// --- /del command ---
const delCommand = {
    name: '/del',
    regex: /\/del (.+)/,
    execute: (bot, msg, match, appConfig) => {
        // Delegate to the original handler, passing the superAdminId
        registrationHandler.handleDeleteRegistration(bot, msg, db, appConfig.superAdminId);
    }
};

// --- /set command ---
const setCommand = {
    name: '/set',
    regex: /\/set (\d+) (.+)/,
    execute: async (bot, msg, match, appConfig) => {
        if (msg.from.id !== appConfig.superAdminId) return;
        
        const targetUserId = parseInt(match[1], 10);
        const ingameUsername = match[2].trim();
        logger.info('ADMIN_CMD', '/set command received', { targetUserId, ingameUsername });
        
        try {
            await db.setUserLink(targetUserId, ingameUsername);
            logger.success('ADMIN_CMD', 'User link set successfully.');
            bot.sendMessage(appConfig.superAdminId, `✅ نام کاربری "${ingameUsername}" با موفقیت برای کاربر با شناسه "${targetUserId}" ثبت شد.`);
        } catch (error) {
            logger.error('ADMIN_CMD', 'Failed to execute /set command', { error: error.message });
            bot.sendMessage(appConfig.superAdminId, '❌ خطایی در هنگام ثبت نام کاربری رخ داد.');
        }
    }
};

// --- /setconfig command (Solves Problem #11) ---
const setConfigCommand = {
    name: '/setconfig',
    regex: /\/setconfig (\w+) (.+)/,
    execute: async (bot, msg, match, appConfig) => {
        if (msg.from.id !== appConfig.superAdminId) return;

        const key = match[1].trim();
        const value = match[2].trim();
        logger.info('ADMIN_CMD', '/setconfig command received', { key, value });

        try {
            await db.setSetting(key, value);
            
            // Dynamically update the in-memory config
            if (key === 'unlimited_chat_ranks') {
                appConfig.chat.unlimitedChatRanks = value.split(',').map(r => r.trim());
            } else if (key === 'chat_cooldown_seconds') {
                appConfig.chat.cooldownSeconds = parseInt(value, 10);
            }
            
            logger.success('ADMIN_CMD', `Config key '${key}' updated successfully.`);
            bot.sendMessage(appConfig.superAdminId, `✅ تنظیمات *${key}* با موفقیت به مقدار \`${value}\` به‌روزرسانی شد.`, { parse_mode: 'Markdown' });
        } catch (error) {
            logger.error('ADMIN_CMD', `Failed to set config for key '${key}'`, { error: error.message });
            bot.sendMessage(appConfig.superAdminId, `❌ خطایی در هنگام به‌روزرسانی تنظیمات *${key}* رخ داد.`, { parse_mode: 'Markdown' });
        }
    }
};


module.exports = [
    enableCommand,
    disableCommand,
    delCommand,
    setCommand,
    setConfigCommand
];