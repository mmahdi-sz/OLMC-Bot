// const db = require('../database'); // <<<< حذف شد >>>>
const logger = require('../logger');
const { getText } = require('../i18n');
const registrationHandler = require('../handlers/registrationHandler');

async function sendLanguageSelectionMenu(bot, chatId, messageId = null) {
    const message = getText('fa', 'choose_language_prompt');
    const keyboard = {
        inline_keyboard: [
            [{ text: '🇮🇷 پارسی (Persian)', callback_data: 'set_lang_fa' }],
            [{ text: '🇺🇸 English (انگلیسی)', callback_data: 'set_lang_en' }]
        ]
    };
    
    // --- بهبود: اگر از داخل منو فراخوانی شود، پیام را ویرایش می‌کند ---
    if (messageId) {
        try {
            await bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
        } catch (e) { /* پیام تغییری نکرده یا مشکلی وجود دارد، مهم نیست */ }
    } else {
        await bot.sendMessage(chatId, message, { reply_markup: keyboard });
    }
}

// --- /start command ---
const startCommand = {
    name: '/start',
    regex: /\/start(?: (.+))?$/,
    execute: async (bot, msg, match, appConfig, db) => {
        const { superAdminId, supportAdminUsername } = appConfig;
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const referrerId = match[1];

        // --- بهبود: تشخیص اینکه آیا دستور از طریق یک دکمه (callback) فراخوانی شده است ---
        const isCallback = !!msg.reply_markup;

        const activeWizard = await db.getWizardState(userId);
        if (activeWizard) {
            await db.deleteWizardState(userId);
            logger.info('WIZARD_HANDLER', `Wizard cancelled by /start command.`);
        }
        
        logger.info('CMD_START', '/start command received', { userId, isCallback });
        
        let userLang = await db.getUserLanguage(userId);
        
        if (!userLang) {
            return sendLanguageSelectionMenu(bot, chatId, isCallback ? msg.message_id : null);
        }
        
        const isSuperAdmin = (userId === superAdminId);
        const isRegularAdmin = await db.isAdmin(userId);
        
        // --- بهبود: متن و دکمه‌ها قبل از ارسال آماده می‌شوند ---
        let responseText = '';
        let responseKeyboard = {};

        // Admin Menu
        if (isSuperAdmin || isRegularAdmin) {
            responseText = getText(userLang, 'greeting_admin');
            const baseKeyboard = [
                [{ text: getText(userLang, 'btn_rcon_menu'), callback_data: 'rcon_menu' }]
            ];
            if (isSuperAdmin) {
                baseKeyboard.push([{ text: getText(userLang, 'btn_admin_panel'), callback_data: 'admin_panel' }]);
                baseKeyboard.push([{ text: getText(userLang, 'btn_rank_list_management'), callback_data: 'manage_rank_list' }]);
            }
            responseKeyboard = { inline_keyboard: baseKeyboard };
        } else {
            // Regular User Menu
            try {
                const registration = await db.getRegistrationByTelegramId(userId);
                if (registration) {
                    if (registration.status === 'pending') {
                        responseText = getText(userLang, 'greeting_user_pending', supportAdminUsername, registration.uuid);
                        // برای این پیام دکمه‌ای وجود ندارد
                    } else if (registration.status === 'approved') {
                        responseText = getText(userLang, 'greeting_user_approved');
                        responseKeyboard = { inline_keyboard: [[{ text: getText(userLang, 'btn_manage_account'), callback_data: 'manage_account' }]] };
                    }
                } else {
                    // اگر ثبت‌نامی وجود ندارد، فرآیند را شروع کن
                    return registrationHandler.startRegistration(bot, msg, referrerId, db);
                }
            } catch (error) {
                logger.error('CMD_START', `Error in /start command for user ${userId}`, { error: error.message });
                responseText = getText(userLang || 'fa', 'error_generic');
            }
        }

        // --- بهبود: منطق اصلی برای ویرایش یا ارسال پیام جدید ---
        if (isCallback) {
            try {
                await bot.editMessageText(responseText, {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    reply_markup: responseKeyboard,
                    parse_mode: 'MarkdownV2' // برای پیام‌های خاص استفاده می‌شود
                });
            } catch (error) {
                // اگر پیام تغییری نکرده، خطا را نادیده بگیر
                if (!error.message.includes('message is not modified')) {
                    logger.error('CMD_START', 'Failed to edit start menu message', { error: error.message });
                }
            }
        } else {
            await bot.sendMessage(chatId, responseText, {
                reply_markup: responseKeyboard,
                parse_mode: 'MarkdownV2'
            });
        }
    }
};

// --- /language command ---
const languageCommand = {
    name: '/language',
    regex: /\/language/,
    execute: async (bot, msg, match, appConfig, db) => {
        const chatId = msg.chat.id;
        logger.info('CMD_LANG', '/language command received', { userId: msg.from.id });
        // --- بهبود: تشخیص می‌دهد که آیا باید پیام را ویرایش کند یا جدید ارسال کند ---
        const isCallback = !!msg.reply_markup;
        await sendLanguageSelectionMenu(bot, chatId, isCallback ? msg.message_id : null);
    }
};

module.exports = [startCommand, languageCommand];