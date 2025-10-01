const logger = require('../logger');
const { getText } = require('../i18n');
const registrationHandler = require('../handlers/registrationHandler');

async function sendLanguageSelectionMenu(bot, chatId, messageId = null) {
    // از آنجایی که این متن ثابت است، زبان 'fa' را به عنوان پیش‌فرض انتخاب می‌کنیم
    const message = getText('fa', 'choose_language_prompt');
    const keyboard = {
        inline_keyboard: [
            [{ text: '🇮🇷 پارسی (Persian)', callback_data: 'set_lang_fa' }],
            [{ text: '🇺🇸 English (انگلیسی)', callback_data: 'set_lang_en' }]
        ]
    };
    
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
        // <<<< CHANGE START >>>>
        // متغیر supportBotUsername برای استفاده‌های آتی از appConfig استخراج می‌شود.
        // متغیر supportBotUsername نیز برای منطق جدید اضافه شد
        const { superAdminId, supportAdminUsername, supportBotUsername } = appConfig;
        // <<<< CHANGE END >>>>
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const referrerId = match[1];

        const isCallback = !!msg.reply_markup;

        const activeWizard = await db.getWizardState(userId);
        if (activeWizard) {
            await db.deleteWizardState(userId);
            logger.info('WIZARD_HANDLER', `Wizard cancelled by /start command.`);
        }
        
        logger.info('CMD_START', '/start command received', { userId, isCallback });
        
        const userLang = await db.getUserLanguage(userId);
        
        // اگر کاربر زبان انتخاب نکرده باشد، ابتدا منوی انتخاب زبان نمایش داده می‌شود.
        //getUserLanguage یک مقدار پیش‌فرض 'fa' برمی‌گرداند، بنابراین این شرط تقریباً هیچ‌وقت برقرار نمی‌شود
        // مگر اینکه منطق getUserLanguage تغییر کند. برای اطمینان باقی می‌ماند.
        if (!userLang) {
            return sendLanguageSelectionMenu(bot, chatId, isCallback ? msg.message_id : null);
        }
        
        const isSuperAdmin = (userId === superAdminId);
        const isRegularAdmin = await db.isAdmin(userId);
        
        let responseText = '';
        let responseKeyboard = {};

        // منوی ادمین
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
            // منوی کاربر عادی
            try {
                const registration = await db.getRegistrationByTelegramId(userId);
                if (registration) {
                    // <<<< CHANGE START >>>>
                    // منطق برای وضعیت 'pending' ساده‌سازی شد، زیرا کاربر اکنون دکمه مستقیم دارد.
                    if (registration.status === 'pending') {
                        // این پیام برای موارد نادری است که کاربر دکمه را نادیده گرفته و دوباره /start را می‌زند.
                        // --- بخش بهبود یافته ---
                        // به جای ارسال یک پیام متنی، پیام نهایی‌سازی را دوباره برای کاربر ارسال می‌کنیم.
                        // این کار تضمین می‌کند که کاربر هرگز در این مرحله گیر نمی‌کند.
                        logger.info('CMD_START', `Resending finalization message for pending user ${userId}.`);
                        await registrationHandler.resendFinalizationMessage(bot, userId, db, supportBotUsername);
                        return; // اجرای دستور را در اینجا متوقف می‌کنیم چون پیام لازم ارسال شده است.
                        // --- پایان بخش بهبود یافته ---
                    } else if (registration.status === 'approved') {
                        responseText = getText(userLang, 'greeting_user_approved');
                        responseKeyboard = { inline_keyboard: [[{ text: getText(userLang, 'btn_manage_account'), callback_data: 'manage_account' }]] };
                    }
                    // <<<< CHANGE END >>>>
                } else {
                    // اگر ثبت‌نامی وجود ندارد، فرآیند را شروع کن
                    return registrationHandler.startRegistration(bot, msg, referrerId, db);
                }
            } catch (error) {
                logger.error('CMD_START', `Error in /start command for user ${userId}`, { error: error.message });
                responseText = getText(userLang, 'error_generic');
            }
        }

        // منطق ارسال یا ویرایش پیام
        if (isCallback) {
            try {
                await bot.editMessageText(responseText, {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    reply_markup: responseKeyboard,
                    parse_mode: 'MarkdownV2'
                });
            } catch (error) {
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
        const isCallback = !!msg.reply_markup;
        await sendLanguageSelectionMenu(bot, chatId, isCallback ? msg.message_id : null);
    }
};

module.exports = [startCommand, languageCommand];