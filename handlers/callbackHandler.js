// handlers/callbackHandler.js

const { Rcon } = require('rcon-client');
const rankManager = require('./rankManager.js');
const wizardHandler = require('./wizardHandler.js');
const logger = require('../logger.js');
const { getText } = require('../i18n.js');

const MODULE_NAME = 'CALLBACK_HANDLER';

/**
 * Escapes characters for Telegram's MarkdownV2 parse mode.
 */
function escapeMarkdownV2(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

/**
 * Displays the main admin management panel.
 */
async function showAdminPanel(bot, db, callbackQuery, userLang = 'fa') {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const keyboard = {
        inline_keyboard: [
            [{ text: getText(userLang, 'btnAddAdmin'), callback_data: 'add_admin' }],
            [{ text: getText(userLang, 'btnRemoveAdmin'), callback_data: 'remove_admin_prompt' }],
            [{ text: getText(userLang, 'btnListAdmins'), callback_data: 'list_admins' }],
            [{ text: getText(userLang, 'btnBackToMainMenu'), callback_data: 'start_menu' }]
        ]
    };
    const messageText = getText(userLang, 'adminPanelTitle');

    try {
        if (messageId) {
            await bot.editMessageText(messageText, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: keyboard
            });
        } else {
            await bot.sendMessage(chatId, messageText, { reply_markup: keyboard });
        }
    } catch (error) {
        if (!error.message.includes('message is not modified')) {
            logger.warn(MODULE_NAME, "Could not edit admin panel message, sending a new one.", { error: error.message });
            await bot.sendMessage(chatId, messageText, { reply_markup: keyboard });
        }
    }
}

/**
 * Displays the RCON server management menu.
 */
async function showServerMenu(bot, context, db, isSuperAdmin, superAdminId, userLang = 'fa') {
    const isCallback = typeof context === 'object' && context.message;
    const chatId = isCallback ? context.message.chat.id : context;
    const messageId = isCallback ? context.message.message_id : null;

    try {
        const userServers = await db.getServers(superAdminId);
        const serverButtons = userServers.map(server => ([{ text: `🔌 ${server.name}`, callback_data: `connect_${server.name}` }]));
        
        const keyboardRows = [...serverButtons];
        if (isSuperAdmin) {
             keyboardRows.push(
                [{ text: getText(userLang, 'btnAddServer'), callback_data: 'add_server' }, { text: getText(userLang, 'btnRemoveServer'), callback_data: 'remove_server_prompt' }]
             );
        }
        keyboardRows.push([{ text: getText(userLang, 'btnBackToMainMenu'), callback_data: 'start_menu' }]);
        
        const keyboard = { inline_keyboard: keyboardRows };
        const messageText = userServers.length > 0
            ? getText(userLang, 'rconMenuTitle')
            : getText(userLang, 'rconMenuTitleNoServers');

        if (isCallback && messageId) {
            await bot.editMessageText(messageText, { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
        } else {
            await bot.sendMessage(chatId, messageText, { reply_markup: keyboard });
        }
    } catch (error) {
        if (!(isCallback && error.message.includes('message is not modified'))) {
            logger.error(MODULE_NAME, `An error occurred in showServerMenu for user ${chatId}`, { error: error.message, stack: error.stack });
            await bot.sendMessage(chatId, getText(userLang, 'errorMenu'), { reply_markup: { inline_keyboard: [[{ text: getText(userLang, 'btnBackToMainMenu'), callback_data: 'start_menu' }]] } });
        }
    }
}

/**
 * Handles all callback queries for the bot.
 */
// <<<< CHANGE START >>>>
// پارامتر جدید handleStartCommand به انتهای لیست پارامترها اضافه شد.
async function handleCallback(bot, callbackQuery, db, activeConnections, superAdminId, mainBotUsername, setupRankListCron, handleStartCommand) {
// <<<< CHANGE END >>>>
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id;
    const messageId = msg.message_id;

    logger.info(MODULE_NAME, `Callback received`, { userId, chatId, action });

    const isSuperAdmin = (userId === superAdminId);
    
    const userLang = await db.getUserLanguage(userId) || 'fa';

    try {
        // <<<< CHANGE START >>>>
        // بخش مدیریت انتخاب زبان به طور کامل بازنویسی شد
        if (action.startsWith('set_lang_')) {
            const langCode = action.split('_').pop(); // 'fa' or 'en'
            await db.setUserLanguage(userId, langCode);
            
            await bot.answerCallbackQuery(callbackQuery.id, { text: getText(langCode, 'language_changed') });
            
            // ابتدا پیام قدیمی را حذف می‌کنیم
            await bot.deleteMessage(chatId, messageId);

            // به جای bot.emit، از فراخوانی مستقیم و پایدار تابع handleStartCommand استفاده می‌کنیم
            const fakeMsg = { 
                ...msg, 
                text: '/start', // متن دستور
                from: { id: userId }, // اطلاعات فرستنده
                chat: { id: chatId } // اطلاعات چت
            };
            await handleStartCommand(bot, fakeMsg);
            
            return; // پردازش را در همینجا تمام می‌کنیم
        }
        // <<<< CHANGE END >>>>

        if (action.startsWith('rankmgr_') || action.startsWith('rank_interval_')) {
            await bot.answerCallbackQuery(callbackQuery.id);
            logger.debug(MODULE_NAME, `Routing to RankManager`, { action });
            return rankManager.handleRankManagerCallback(bot, callbackQuery, db, setupRankListCron);
        }
        if (action.startsWith('register_')) {
            logger.debug(MODULE_NAME, `Routing to RegistrationHandler`, { action });
            // نکته: برای جلوگیری از خطا، require را در سطح بالای فایل قرار دهید
            return require('./registrationHandler.js').handleRegistrationCallback(bot, callbackQuery, db);
        }

        await bot.answerCallbackQuery(callbackQuery.id);

        switch (true) {
            case action === 'start_menu': {
                logger.debug(MODULE_NAME, 'Executing action: start_menu');
                // <<<< CHANGE START >>>>
                // برای بازگشت به منوی اصلی نیز از تابع مرکزی استفاده می‌کنیم تا کد تکراری نباشد
                const fakeMsg = { from: { id: userId }, chat: { id: chatId }, text: '/start', message_id: messageId };
                await handleStartCommand(bot, fakeMsg);
                // <<<< CHANGE END >>>>
                break;
            }
            case action === 'rcon_menu':
                logger.debug(MODULE_NAME, 'Executing action: rcon_menu');
                await showServerMenu(bot, callbackQuery, db, isSuperAdmin, superAdminId, userLang);
                break;

            case action === 'manage_rank_list':
                logger.debug(MODULE_NAME, 'Executing action: manage_rank_list');
                if (!isSuperAdmin) return;
                await bot.deleteMessage(chatId, messageId);
                await rankManager.startRankManager(bot, msg, db, setupRankListCron);
                break;

            case action === 'manage_account': {
                 logger.debug(MODULE_NAME, 'Executing action: manage_account');
                 const message = getText(userLang, 'accountPanelTitle');
                 const keyboard = { inline_keyboard: [
                     [{ text: getText(userLang, 'btnReferralInfo'), callback_data: 'show_referral_info' }],
                     [{ text: getText(userLang, 'btnBack'), callback_data: 'user_start_menu' }]
                 ]};
                 await bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'Markdown' });
                 break;
            }
            case action === 'show_referral_info': {
                logger.debug(MODULE_NAME, 'Executing action: show_referral_info');
                const referralLink = `https://t.me/${mainBotUsername}?start=${userId}`;
                const message = getText(userLang, 'referralInfoMessage', referralLink);
                const keyboard = { inline_keyboard: [[{ text: getText(userLang, 'btnBackToAccountPanel'), callback_data: 'manage_account' }]] };
                await bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'Markdown' });
                break;
            }
            case action === 'user_start_menu': {
                logger.debug(MODULE_NAME, 'Executing action: user_start_menu');
                const message = getText(userLang, 'greeting_user_approved');
                const keyboard = { inline_keyboard: [[{ text: getText(userLang, 'btn_manage_account'), callback_data: 'manage_account' }]] };
                await bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
                break;
            }

            case action === 'admin_panel':
                logger.debug(MODULE_NAME, 'Executing action: admin_panel');
                if (isSuperAdmin) await showAdminPanel(bot, db, callbackQuery, userLang);
                break;
            case action === 'add_admin':
                if (!isSuperAdmin) return;
                await db.setWizardState(userId, 'add_admin', 'awaiting_admin_id', {});
                await bot.editMessageText(getText(userLang, 'promptAddAdmin'), { chat_id: chatId, message_id: messageId });
                break;
            case action === 'list_admins': {
                if (!isSuperAdmin) return;
                const admins = await db.getAdmins();
                let adminList = `${getText(userLang, 'adminListTitle')}\n\n`;
                if (admins.length === 0) {
                    adminList = getText(userLang, 'noAdminsFound');
                } else {
                    admins.forEach(admin => {
                        adminList += `${getText(userLang, 'adminListEntryName')}: ${escapeMarkdownV2(admin.name)}\n${getText(userLang, 'adminListEntryId')}: \`${admin.user_id}\`\n\n`;
                    });
                }
                await bot.editMessageText(adminList, { chat_id: chatId, message_id: messageId, parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: getText(userLang, 'btnBack'), callback_data: 'admin_panel' }]] } });
                break;
            }
            case action.startsWith('remove_admin'): {
                const parts = action.split('_');
                const stage = parts[2];
                const adminIdToRemove = parts[3];

                if (!isSuperAdmin) return;

                if (stage === 'prompt') {
                    const admins = await db.getAdmins();
                    if (admins.length === 0) return bot.answerCallbackQuery(callbackQuery.id, { text: getText(userLang, 'noAdminsToRemove'), show_alert: true });
                    const adminButtons = admins.map(admin => ([{ text: `🗑️ ${admin.name}`, callback_data: `remove_admin_confirm_${admin.user_id}` }]));
                    adminButtons.push([{ text: getText(userLang, 'btnBack'), callback_data: 'admin_panel' }]);
                    await bot.editMessageText(getText(userLang, 'promptRemoveAdmin'), { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: adminButtons } });
                } else if (stage === 'confirm') {
                    const keyboard = { inline_keyboard: [[{ text: getText(userLang, 'btnCancel'), callback_data: 'admin_panel' }, { text: getText(userLang, 'btnConfirmDelete'), callback_data: `remove_admin_execute_${adminIdToRemove}` }]] };
                    await bot.editMessageText(getText(userLang, 'confirmRemoveAdmin', adminIdToRemove), { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'Markdown' });
                } else if (stage === 'execute') {
                    await db.removeAdmin(parseInt(adminIdToRemove, 10));
                    logger.success(MODULE_NAME, `Admin ${adminIdToRemove} removed successfully.`);
                    await showAdminPanel(bot, db, callbackQuery, userLang);
                }
                break;
            }

            case action === 'add_server':
                if (!isSuperAdmin) return;
                await db.setWizardState(userId, 'add_server', 'awaiting_ip', {});
                await bot.editMessageText(getText(userLang, 'promptAddServerIP'), { chat_id: chatId, message_id: messageId });
                break;
            case action.startsWith('remove_server'): {
                // ...
                break;
            }
            
            case action.startsWith('connect_'): {
                // ...
                break;
            }

            case action.startsWith('rcon_retry_connect_'): {
                // ...
                break;
            }

            case action.startsWith('rcon_edit_server_'): {
                // ...
                break;
            }
            
            default:
                logger.warn(MODULE_NAME, `Unknown callback action received`, { action, userId });
        }
    } catch (e) {
        if (!e.message.includes('message is not modified')) {
             logger.error(MODULE_NAME, `A critical error occurred for action "${action}"`, { error: e.message, stack: e.stack });
        }
    }
}

module.exports = { handleCallback, showServerMenu, showAdminPanel };