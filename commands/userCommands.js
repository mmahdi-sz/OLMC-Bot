const logger = require('../logger');
const { getText } = require('../i18n');
const registrationHandler = require('../handlers/registrationHandler');

function escapeMarkdownV2(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

async function sendLanguageSelectionMenu(bot, chatId, messageId = null) {
    const message = getText('fa', 'choose_language_prompt');
    const keyboard = {
        inline_keyboard: [
            [{ text: '🇮🇷 پارسی (Persian)', callback_data: 'set_lang_fa' }],
            [{ text: '🇺🇸 English (انگلیسی)', callback_data: 'set_lang_en' }]
        ]
    };
    
    if (messageId) {
        try {
            await bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'MarkdownV2' });
        } catch (e) { /* پیام تغییری نکرده یا مشکلی وجود دارد، مهم نیست */ }
    } else {
        await bot.sendMessage(chatId, message, { reply_markup: keyboard, parse_mode: 'MarkdownV2' });
    }
}

const startCommand = {
    name: '/start',
    regex: /\/start(?: (.+))?$/,
    execute: async (bot, msg, match, appConfig, db) => {
        const { superAdminId, supportBotUsername } = appConfig;
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
        
        if (!userLang) {
            return sendLanguageSelectionMenu(bot, chatId, isCallback ? msg.message_id : null);
        }
        
        const isSuperAdmin = (userId === superAdminId);
        const isRegularAdmin = await db.isAdmin(userId);
        
        let responseText = '';
        let responseKeyboard = {};

        if (isSuperAdmin || isRegularAdmin) {
            responseText = getText(userLang, 'greeting_admin');
            const baseKeyboard = [
                [{ text: getText(userLang, 'btn_rcon_menu'), callback_data: 'rcon_menu' }]
            ];
            if (isSuperAdmin) {
                baseKeyboard.push([{ text: getText(userLang, 'btn_admin_panel'), callback_data: 'admin_panel' }]);
                baseKeyboard.push([{ text: getText(userLang, 'btn_rank_list_management'), callback_data: 'manage_rank_list' }]);
            }
            baseKeyboard.push([{ text: getText(userLang, 'btnBackToMainMenu'), callback_data: 'start_menu' }]);
            responseKeyboard = { inline_keyboard: baseKeyboard };
        } else {
            try {
                const registration = await db.getRegistrationByTelegramId(userId);
                if (registration) {
                    if (registration.status === 'pending') {
                        logger.info('CMD_START', `Resending finalization message for pending user ${userId}.`);
                        await registrationHandler.resendFinalizationMessage(bot, userId, db, supportBotUsername);
                        return;
                    } else if (registration.status === 'approved') {
                        responseText = getText(userLang, 'greeting_user_approved');
                        responseKeyboard = { inline_keyboard: [[{ text: getText(userLang, 'btn_manage_account'), callback_data: 'manage_account' }]] };
                    }
                } else {
                    return registrationHandler.startRegistration(bot, msg, referrerId, db);
                }
            } catch (error) {
                logger.error('CMD_START', `Error in /start command for user ${userId}`, { error: error.message });
                responseText = getText(userLang, 'error_generic');
            }
        }

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

const helpCommand = {
    name: '/help',
    regex: /\/help/,
    execute: async (bot, msg, match, appConfig, db) => {
        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const userLang = await db.getUserLanguage(userId);
        
        const isSuperAdmin = (userId === appConfig.superAdminId);
        const isRegularAdmin = await db.isAdmin(userId);
        
        let helpText = '⚙️ *راهنمای دستورات*\n\n━━━━━━━━━━━━━━━━\n\n';
        
        if (isSuperAdmin || isRegularAdmin) {
            helpText += `${getText(userLang, 'helpAdminTitle')}\n\n`;
            helpText += `${getText(userLang, 'helpAdminGeneral')}\n`;
            helpText += `• \`/start\` \\- منوی اصلی\n`;
            helpText += `• \`/help\` \\- نمایش راهنما\n`;
            helpText += `• \`/language\` \\- تغییر زبان\n\n`;
            
            if (isSuperAdmin) {
                helpText += `${getText(userLang, 'helpSuperAdminCommands')}\n`;
                helpText += `• \`/enable <module>\` \\- فعال‌سازی ماژول\n`;
                helpText += `• \`/disable <module>\` \\- غیرفعال‌سازی ماژول\n`;
                helpText += `• \`/set <user_id> <username>\` \\- تنظیم لینک کاربر\n`;
                helpText += `• \`/del <uuid>\` \\- حذف درخواست ثبت‌نام\n`;
                helpText += `• \`/setconfig <key> <value>\` \\- تنظیمات\n\n`;
            }
            
            helpText += `${getText(userLang, 'helpRankCommands')}\n`;
            helpText += `• \`/sendranklist\` \\- ارسال دستی لیست (در تاپیک رنک)\n`;
            helpText += `• \`/ranks\` \\- لیست گروه‌ها (در تاپیک رنک)\n`;
            helpText += `• \`/rankexpiry <group>\` \\- زمان انقضا (در تاپیک رنک)\n\n`;
            
            helpText += `━━━━━━━━━━━━━━━━\n\n`;
            helpText += getText(userLang, 'helpNotes');
            
        } else {
            helpText = `${getText(userLang, 'helpUserTitle')}\n\n━━━━━━━━━━━━━━━━\n\n`;
            helpText += `${getText(userLang, 'helpUserGeneral')}\n\n`;
            helpText += `${getText(userLang, 'helpUserFeatures')}\n\n`;
            
            helpText += `━━━━━━━━━━━━━━━━\n\n`;
            helpText += getText(userLang, 'helpUserSupport');
        }
        
        const keyboard = {
            inline_keyboard: [[
                { text: '🏠 منوی اصلی', callback_data: 'start_menu' }
            ]]
        };
        
        await bot.sendMessage(chatId, helpText, {
            parse_mode: 'MarkdownV2',
            reply_markup: keyboard
        });
    }
};

module.exports = [startCommand, languageCommand, helpCommand];