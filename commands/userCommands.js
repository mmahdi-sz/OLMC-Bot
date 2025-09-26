// commands/userCommands.js

const db = require('../database');
const logger = require('../logger');
const { getText } = require('../i18n');
const registrationHandler = require('../handlers/registrationHandler');

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

// --- /start command ---
const startCommand = {
    name: '/start',
    regex: /\/start(?: (.+))?$/,
    execute: async (bot, msg, match, appConfig) => {
        const { superAdminId, supportAdminUsername } = appConfig;
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const referrerId = match[1];

        // Cancel any active wizard
        const activeWizard = await db.getWizardState(userId);
        if (activeWizard) {
            await db.deleteWizardState(userId);
            logger.info('WIZARD_HANDLER', `Wizard (${activeWizard.wizard_type}) for user ${userId} was cancelled by /start command.`);
        }
        
        logger.info('CMD_START', '/start command received', { userId, chatId, referrerId: referrerId || 'none' });
        
        const userLang = await db.getUserLanguage(userId);
        
        // If user has no language set, prompt them to choose one.
        if (!userLang || userLang === 'fa') { // Default to showing menu if no lang
            return sendLanguageSelectionMenu(bot, chatId);
        }

        const isSuperAdmin = (userId === superAdminId);
        const isRegularAdmin = await db.isAdmin(userId);
        
        // Admin Menu
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
        
        // Regular User Menu
        try {
            const registration = await db.getRegistrationByTelegramId(userId);
            if (registration) {
                if (registration.status === 'pending') {
                    const message = getText(userLang, 'greeting_user_pending', supportAdminUsername, registration.uuid);
                    return bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
                }
                
                if (registration.status === 'approved') {
                    const message = getText(userLang, 'greeting_user_approved');
                    const keyboard = { inline_keyboard: [[{ text: getText(userLang, 'btn_manage_account'), callback_data: 'manage_account' }]] };
                    return bot.sendMessage(chatId, message, { reply_markup: keyboard });
                }
            }
            // If no registration exists, start the process.
            return registrationHandler.startRegistration(bot, msg, referrerId, db);
        } catch (error) {
            logger.error('CMD_START', `Error in /start command for user ${userId}`, { error: error.message });
            return bot.sendMessage(chatId, getText(userLang, 'error_generic'));
        }
    }
};

// --- /language command ---
const languageCommand = {
    name: '/language',
    regex: /\/language/,
    execute: async (bot, msg) => {
        const chatId = msg.chat.id;
        logger.info('CMD_LANG', '/language command received', { userId: msg.from.id, chatId });
        await sendLanguageSelectionMenu(bot, chatId);
    }
};

module.exports = [startCommand, languageCommand];