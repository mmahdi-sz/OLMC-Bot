// handlers/callbackHandler.js

const rankManager = require('./rankManager.js');
const db = require('../database.js'); // db is needed for wizards, etc.
const logger = require('../logger.js');
const { getText } = require('../i18n.js');
const registrationHandler = require('./registrationHandler.js'); // Ensure it's required at the top

const MODULE_NAME = 'CALLBACK_HANDLER';

/**
 * Helper function to send a "permission denied" alert.
 */
function answerPermissionDenied(bot, callbackQueryId, userLang) {
    // You should add this key to your i18n.js file
    // fa: { permission_denied: "شما اجازه انجام این کار را ندارید." }
    // en: { permission_denied: "You do not have permission to do this." }
    const alertText = getText(userLang, 'permission_denied', "شما اجازه دسترسی ندارید.");
    return bot.answerCallbackQuery(callbackQueryId, { text: alertText, show_alert: true });
}

async function showAdminPanel(bot, callbackQuery, userLang = 'fa') {
    const { message: { chat: { id: chatId }, message_id: messageId } } = callbackQuery;
    const keyboard = {
        inline_keyboard: [
            [{ text: getText(userLang, 'btnAddAdmin'), callback_data: 'add_admin' }],
            [{ text: getText(userLang, 'btnRemoveAdmin'), callback_data: 'remove_admin_prompt' }],
            [{ text: getText(userLang, 'btnListAdmins'), callback_data: 'list_admins' }],
            [{ text: getText(userLang, 'btnBackToMainMenu'), callback_data: 'start_menu' }]
        ]
    };
    try {
        await bot.editMessageText(getText(userLang, 'adminPanelTitle'), {
            chat_id: chatId, message_id: messageId, reply_markup: keyboard
        });
    } catch (error) {
        if (!error.message.includes('message is not modified')) {
            logger.warn(MODULE_NAME, "Could not edit admin panel message.", { error: error.message });
        }
    }
}

async function showServerMenu(bot, callbackQuery, db, isSuperAdmin, userLang = 'fa') {
    const { message: { chat: { id: chatId }, message_id: messageId }, from: { id: userId } } = callbackQuery;
    try {
        // Only super admin can manage servers, so we fetch their servers.
        const userServers = await db.getServers(isSuperAdmin ? userId : appConfig.superAdminId);
        const serverButtons = userServers.map(server => ([{ text: `🔌 ${server.name}`, callback_data: `connect_${server.name}` }]));
        
        const keyboardRows = [...serverButtons];
        if (isSuperAdmin) {
             keyboardRows.push(
                [{ text: getText(userLang, 'btnAddServer'), callback_data: 'add_server' }, { text: getText(userLang, 'btnRemoveServer'), callback_data: 'remove_server_prompt' }]
             );
        }
        keyboardRows.push([{ text: getText(userLang, 'btnBackToMainMenu'), callback_data: 'start_menu' }]);
        
        const keyboard = { inline_keyboard: keyboardRows };
        const messageText = userServers.length > 0 ? getText(userLang, 'rconMenuTitle') : getText(userLang, 'rconMenuTitleNoServers');

        await bot.editMessageText(messageText, { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
    } catch (error) {
        if (!error.message.includes('message is not modified')) {
            logger.error(MODULE_NAME, `Error in showServerMenu for user ${userId}`, { error: error.message });
        }
    }
}


// <<<< CHANGE START >>>> (Simplified parameters and structure)
async function handleCallback(bot, callbackQuery, db, appConfig, setupRankListCron, startCommandHandler) {
// <<<< CHANGE END >>>>
    const { data: action, message: msg, from: { id: userId } } = callbackQuery;
    const { chat: { id: chatId }, message_id: messageId } = msg;

    logger.info(MODULE_NAME, `Callback received`, { userId, chatId, action });

    const isSuperAdmin = (userId === appConfig.superAdminId);
    const userLang = await db.getUserLanguage(userId);

    try {
        // --- Universal Handlers ---
        if (action.startsWith('set_lang_')) {
            const langCode = action.split('_').pop();
            await db.setUserLanguage(userId, langCode);
            await bot.answerCallbackQuery(callbackQuery.id, { text: getText(langCode, 'language_changed') });
            await bot.deleteMessage(chatId, messageId);
            // <<<< CHANGE START >>>> (Problem 10: Removed fake message object)
            // Directly call the start command handler.
            return startCommandHandler(bot, { ...msg, text: '/start' }, ['/start'], appConfig, db);
            // <<<< CHANGE END >>>>
        }

        if (action.startsWith('rankmgr_') || action.startsWith('rank_interval_')) {
            // <<<< CHANGE START >>>> (Problem 12: Permission Feedback)
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            // <<<< CHANGE END >>>>
            return rankManager.handleRankManagerCallback(bot, callbackQuery, db, setupRankListCron);
        }

        if (action.startsWith('register_')) {
            return registrationHandler.handleRegistrationCallback(bot, callbackQuery, db);
        }
        
        // --- Main Menu and User Actions ---
        if (action === 'start_menu') {
            await bot.answerCallbackQuery(callbackQuery.id);
             // <<<< CHANGE START >>>> (Problem 10: Removed fake message object)
            return startCommandHandler(bot, { ...msg, text: '/start' }, ['/start'], appConfig, db);
            // <<<< CHANGE END >>>>
        }
        
        if (action === 'manage_account') {
            await bot.answerCallbackQuery(callbackQuery.id);
            const message = getText(userLang, 'accountPanelTitle');
            const keyboard = { inline_keyboard: [
                [{ text: getText(userLang, 'btnReferralInfo'), callback_data: 'show_referral_info' }],
                [{ text: getText(userLang, 'btnBack'), callback_data: 'user_start_menu' }]
            ]};
            return bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'Markdown' });
        }
        
        if (action === 'show_referral_info') {
            await bot.answerCallbackQuery(callbackQuery.id);
            const referralLink = `https://t.me/${appConfig.mainBotUsername}?start=${userId}`;
            const message = getText(userLang, 'referralInfoMessage', referralLink);
            const keyboard = { inline_keyboard: [[{ text: getText(userLang, 'btnBackToAccountPanel'), callback_data: 'manage_account' }]] };
            return bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'Markdown' });
        }
        
        if (action === 'user_start_menu') {
            await bot.answerCallbackQuery(callbackQuery.id);
            const message = getText(userLang, 'greeting_user_approved');
            const keyboard = { inline_keyboard: [[{ text: getText(userLang, 'btn_manage_account'), callback_data: 'manage_account' }]] };
            return bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
        }

        // --- Admin-only Actions ---

        // Permission check for all subsequent admin actions
        const isRegularAdmin = await db.isAdmin(userId);
        if (!isSuperAdmin && !isRegularAdmin) {
            return answerPermissionDenied(bot, callbackQuery.id, userLang);
        }

        await bot.answerCallbackQuery(callbackQuery.id); // Answer query for all admin actions

        if (action === 'rcon_menu') {
            return showServerMenu(bot, callbackQuery, db, isSuperAdmin, userLang);
        }

        if (action === 'manage_rank_list') {
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            await bot.deleteMessage(chatId, messageId);
            return rankManager.startRankManager(bot, msg, db, setupRankListCron);
        }

        if (action === 'admin_panel') {
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            return showAdminPanel(bot, callbackQuery, userLang);
        }

        if (action === 'add_admin') {
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            await db.setWizardState(userId, 'add_admin', 'awaiting_admin_id', {});
            return bot.editMessageText(getText(userLang, 'promptAddAdmin'), { chat_id: chatId, message_id: messageId });
        }

        if (action === 'list_admins') {
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            const admins = await db.getAdmins();
            const adminList = admins.length === 0
                ? getText(userLang, 'noAdminsFound')
                : `${getText(userLang, 'adminListTitle')}\n\n` + admins.map(admin => 
                    `${getText(userLang, 'adminListEntryName')}: ${admin.name.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')}\n` +
                    `${getText(userLang, 'adminListEntryId')}: \`${admin.user_id}\``
                  ).join('\n\n');
            return bot.editMessageText(adminList, { chat_id: chatId, message_id: messageId, parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: getText(userLang, 'btnBack'), callback_data: 'admin_panel' }]] } });
        }

        if (action.startsWith('remove_admin_')) {
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            const parts = action.split('_');
            const stage = parts[2];
            const adminIdToRemove = parts[3];

            if (stage === 'prompt') {
                const admins = await db.getAdmins();
                if (admins.length === 0) return bot.answerCallbackQuery(callbackQuery.id, { text: getText(userLang, 'noAdminsToRemove'), show_alert: true });
                const adminButtons = admins.map(admin => ([{ text: `🗑️ ${admin.name}`, callback_data: `remove_admin_confirm_${admin.user_id}` }]));
                adminButtons.push([{ text: getText(userLang, 'btnBack'), callback_data: 'admin_panel' }]);
                return bot.editMessageText(getText(userLang, 'promptRemoveAdmin'), { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: adminButtons } });
            } 
            if (stage === 'confirm') {
                const keyboard = { inline_keyboard: [[{ text: getText(userLang, 'btnCancel'), callback_data: 'admin_panel' }, { text: getText(userLang, 'btnConfirmDelete'), callback_data: `remove_admin_execute_${adminIdToRemove}` }]] };
                return bot.editMessageText(getText(userLang, 'confirmRemoveAdmin', adminIdToRemove), { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'Markdown' });
            }
            if (stage === 'execute') {
                await db.removeAdmin(parseInt(adminIdToRemove, 10));
                logger.success(MODULE_NAME, `Admin ${adminIdToRemove} removed successfully.`);
                return showAdminPanel(bot, callbackQuery, userLang);
            }
        }
        
        // RCON server management (only Super Admin)
        if (action === 'add_server') {
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            await db.setWizardState(userId, 'add_server', 'awaiting_ip', {});
            return bot.editMessageText(getText(userLang, 'promptAddServerIP'), { chat_id: chatId, message_id: messageId });
        }

        // Fallback for unknown actions
        logger.warn(MODULE_NAME, `Unknown callback action received`, { action, userId });

    } catch (e) {
        if (!e.message?.includes('message is not modified')) {
             logger.error(MODULE_NAME, `A critical error occurred for action "${action}"`, { error: e.message, stack: e.stack });
        }
    }
}

// The export signature is simplified as only handleCallback is needed externally now.
module.exports = { handleCallback };