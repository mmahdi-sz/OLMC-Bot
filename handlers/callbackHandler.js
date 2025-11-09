const { Rcon } = require('rcon-client'); 
const rankManager = require('./rankManager.js');
const db = require('../database.js');
const logger = require('../logger.js');
const { getText } = require('../i18n.js');
const registrationHandler = require('./registrationHandler.js');
const verifyHandler = require('../verify.js');

const MODULE_NAME = 'CALLBACK_HANDLER';

function escapeMarkdownV2Internal(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

function answerPermissionDenied(bot, callbackQueryId, userLang) {
    const alertText = getText(userLang, 'permission_denied');
    return bot.answerCallbackQuery(callbackQueryId, { text: alertText, show_alert: true });
}

async function showAdminPanel(bot, callbackQuery, userLang = 'fa') {
    const { message: { chat: { id: chatId }, message_id: messageId } } = callbackQuery;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '➕ ' + getText(userLang, 'btnAddAdmin'), callback_data: 'add_admin' },
                { text: '➖ ' + getText(userLang, 'btnRemoveAdmin'), callback_data: 'remove_admin_prompt' }
            ],
            [
                { text: '📋 ' + getText(userLang, 'btnListAdmins'), callback_data: 'list_admins' }
            ],
            [
                { text: '🏠 ' + getText(userLang, 'btnBackToMainMenu'), callback_data: 'start_menu' }
            ]
        ]
    };
    try {
        await bot.editMessageText(getText(userLang, 'adminPanelTitle'), {
            chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'MarkdownV2'
        });
    } catch (error) {
        if (!error.message.includes('message is not modified')) {
            logger.warn(MODULE_NAME, "Could not edit admin panel message.", { error: error.message });
        }
    }
}


async function showServerMenu(bot, callbackQuery, db, appConfig, isSuperAdmin, userLang = 'fa') {
    const { message: { chat: { id: chatId }, message_id: messageId }, from: { id: userId } } = callbackQuery;
    try {
        const ownerId = isSuperAdmin ? userId : appConfig.superAdminId;
        const userServers = await db.getServers(ownerId);
        
        const serverButtons = userServers.map(server => ([{ text: `🔌 ${server.name}`, callback_data: `connect_${server.id}` }]));
        
        const keyboardRows = [...serverButtons];
        if (isSuperAdmin) {
             keyboardRows.push(
                [{ text: '➕ ' + getText(userLang, 'btnAddServer'), callback_data: 'add_server' }, { text: '🗑 ' + getText(userLang, 'btnRemoveServer'), callback_data: 'remove_server_prompt' }]
             );
        }
        keyboardRows.push([{ text: '🏠 ' + getText(userLang, 'btnBackToMainMenu'), callback_data: 'start_menu' }]);
        
        const keyboard = { inline_keyboard: keyboardRows };
        const messageText = userServers.length > 0 ? getText(userLang, 'rconMenuTitle') : getText(userLang, 'rconMenuTitleNoServers');

        await bot.editMessageText(messageText, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'MarkdownV2' });
    } catch (error) {
        if (!error.message.includes('message is not modified')) {
            logger.error(MODULE_NAME, `Error in showServerMenu for user ${userId}`, { error: error.message });
        }
    }
}

async function handleCallback(bot, callbackQuery, db, appConfig, setupRankListCron, startCommandHandler) {
    const { data: action, message: msg, from: { id: userId } } = callbackQuery;
    const { chat: { id: chatId }, message_id: messageId } = msg;

    logger.info(MODULE_NAME, `Callback received`, { userId, chatId, action });

    const isSuperAdmin = (userId === appConfig.superAdminId);
    const userLang = await db.getUserLanguage(userId);

    try {
        if (action.startsWith('set_lang_')) {
            const langCode = action.split('_').pop();
            await db.setUserLanguage(userId, langCode);
            await bot.answerCallbackQuery(callbackQuery.id, { text: getText(langCode, 'language_changed') });
            await bot.deleteMessage(chatId, messageId);
            
            const updatedMsg = {
                ...msg,
                from: callbackQuery.from,
                text: '/start'
            };
            return startCommandHandler(bot, updatedMsg, ['/start'], appConfig, db);
        }

        if (action.startsWith('rankmgr_') || action.startsWith('rank_interval_')) {
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            return rankManager.handleRankManagerCallback(bot, callbackQuery, db, setupRankListCron);
        }

        if (action.startsWith('register_')) {
            return registrationHandler.handleRegistrationCallback(bot, callbackQuery, db);
        }
        
        if (action === 'start_menu') {
            await bot.answerCallbackQuery(callbackQuery.id);
            const updatedMsg = { ...msg, from: callbackQuery.from, text: '/start' };
            return startCommandHandler(bot, updatedMsg, ['/start'], appConfig, db);
        }
        
        if (action === 'manage_account') {
            await bot.answerCallbackQuery(callbackQuery.id);
            const registration = await db.getRegistrationByTelegramId(userId);
            const isVerified = registration ? !!registration.is_verified : false;
            
            let statusEmoji = isVerified ? '✅' : '⚠️';
            let statusText = isVerified 
                ? getText(userLang, 'statusVerified')
                : getText(userLang, 'statusNotVerified');
            
            const message = `${statusEmoji} *${statusText}*\n\n` + getText(userLang, 'accountPanelTitle');
            
            const buttons = [
                [{ 
                    text: '💎 ' + getText(userLang, 'btnReferralInfo'), 
                    callback_data: 'show_referral_info' 
                }]
            ];
            
            if (isVerified) {
                buttons.push([{ 
                    text: '📊 ' + getText(userLang, 'btnPlayerStats'), 
                    callback_data: 'show_player_stats' 
                }]);
            } else {
                buttons.push([{ 
                    text: '🔐 ' + getText(userLang, 'btnVerifyAccount'), 
                    callback_data: 'start_verification' 
                }]);
            }
            
            buttons.push([{ 
                text: '◀️ ' + getText(userLang, 'btnBackToMainMenu'), 
                callback_data: 'user_start_menu' 
            }]);
            
            const keyboard = { inline_keyboard: buttons };

            return bot.editMessageText(message, { 
                chat_id: chatId, 
                message_id: messageId, 
                reply_markup: keyboard, 
                parse_mode: 'MarkdownV2' 
            });
        }
        
        if (action === 'show_referral_info') {
            await bot.answerCallbackQuery(callbackQuery.id);
            const referralLink = `https://t.me/${appConfig.mainBotUsername}?start=${userId}`;
            const message = getText(userLang, 'referralInfoMessage', referralLink);
            const keyboard = { inline_keyboard: [[{ text: '◀️ ' + getText(userLang, 'btnBackToAccountPanel'), callback_data: 'manage_account' }]] };
            return bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'MarkdownV2' });
        }
        
        if (action === 'show_player_stats') {
            await bot.answerCallbackQuery(callbackQuery.id);
    
            const registration = await db.getRegistrationByTelegramId(userId);
            if (!registration) {
                return bot.answerCallbackQuery(callbackQuery.id, { text: getText(userLang, 'error_generic'), show_alert: true });
            }
            
            let statsMessage = '📊 *آمار بازی شما*\n\n━━━━━━━━━━━━━━━━\n\n';
            statsMessage += `👤 *نام کاربری:* \`${escapeMarkdownV2Internal(registration.game_username)}\`\n`;
            statsMessage += `📦 *نسخه:* ${registration.game_edition === 'java' ? '☕️ Java' : '📱 Bedrock'}\n`;
            statsMessage += `🎂 *سن:* ${registration.age}\n`;
            statsMessage += `✅ *وضعیت:* ${registration.is_verified ? getText(userLang, 'statusVerified') : getText(userLang, 'statusNotVerified')}\n`;
            statsMessage += `📅 *تاریخ ثبت‌نام:* ${new Date(registration.created_at).toLocaleDateString('fa-IR')}\n\n`;
            
            statsMessage += `━━━━━━━━━━━━━━━━\n\n`;
            statsMessage += `💡 *نکته:* آمار تکمیلی به زودی اضافه می‌شود`;
            
            const keyboard = {
                inline_keyboard: [[
                    { text: '◀️ ' + getText(userLang, 'btnBackToAccountPanel'), callback_data: 'manage_account' }
                ]]
            };
            
            return bot.editMessageText(statsMessage, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: keyboard,
                parse_mode: 'MarkdownV2'
            });
        }
        
        if (action === 'user_start_menu') {
            await bot.answerCallbackQuery(callbackQuery.id);
            const message = getText(userLang, 'greeting_user_approved');
            const keyboard = { inline_keyboard: [[{ text: getText(userLang, 'btn_manage_account'), callback_data: 'manage_account' }]] };
            return bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'MarkdownV2' });
        }

        if (action === 'start_verification') {
            await bot.answerCallbackQuery(callbackQuery.id);
            const message = getText(userLang, 'verifyChooseMethod');
            const keyboard = {
                inline_keyboard: [
                    [{ text: getText(userLang, 'btnVerifyFromBot'), callback_data: 'verify_from_bot' }],
                    [{ text: getText(userLang, 'btnVerifyFromGame'), callback_data: 'verify_from_game' }],
                    [{ text: '◀️ ' + getText(userLang, 'btnBackToAccountPanel'), callback_data: 'manage_account' }]
                ]
            };
            return bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'MarkdownV2' });
        }

        if (action === 'verify_from_bot' || action === 'verify_refresh_code') {
            await bot.answerCallbackQuery(callbackQuery.id, { text: getText(userLang, 'gettingGroupList') });
            const result = await verifyHandler.handleStartVerificationFromBot(userId, userLang);
            return bot.editMessageText(result.message, { chat_id: chatId, message_id: messageId, reply_markup: result.keyboard, parse_mode: 'MarkdownV2' });
        }

        if (action === 'verify_from_game') {
            await bot.answerCallbackQuery(callbackQuery.id);
            const message = getText(userLang, 'verifyInstructionsGameToBot');
            const keyboard = { inline_keyboard: [[{ text: '◀️ ' + getText(userLang, 'btnBackToVerifyMenu'), callback_data: 'start_verification' }]] };
            return bot.editMessageText(message, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'MarkdownV2' });
        }

        const isRegularAdmin = await db.isAdmin(userId);
        if (!isSuperAdmin && !isRegularAdmin) {
            return answerPermissionDenied(bot, callbackQuery.id, userLang);
        }

        await bot.answerCallbackQuery(callbackQuery.id).catch(() => {});

        if (action === 'rcon_menu') {
            return showServerMenu(bot, callbackQuery, db, appConfig, isSuperAdmin, userLang);
        }
        
        if (action.startsWith('connect_')) {
            const serverId = parseInt(action.split('_')[1], 10);
            const ownerId = isSuperAdmin ? userId : appConfig.superAdminId;
            const servers = await db.getServers(ownerId);
            const server = servers.find(s => s.id === serverId);

            if (!server) {
                await bot.answerCallbackQuery(callbackQuery.id, { text: 'خطا: سرور یافت نشد.', show_alert: true });
                return showServerMenu(bot, callbackQuery, db, appConfig, isSuperAdmin, userLang);
            }

            await db.setWizardState(userId, 'rcon_command', 'awaiting_command', { serverId: server.id, serverName: server.name });
            
            const connectingMsg = await bot.editMessageText(getText(userLang, 'rconConnecting', server.name), {
                chat_id: chatId, message_id: messageId, parse_mode: 'MarkdownV2'
            });
            
            try {
                const rcon = new Rcon({ host: server.ip, port: parseInt(server.port, 10), password: server.password });
                await rcon.connect();
                await rcon.end();
                await bot.editMessageText(getText(userLang, 'rconSuccess', server.name), {
                    chat_id: chatId, message_id: connectingMsg.message_id, parse_mode: 'MarkdownV2'
                });
            } catch(e) {
                await db.deleteWizardState(userId);
                await bot.editMessageText(getText(userLang, 'rconFailed', server.name, e.message), {
                    chat_id: chatId, message_id: connectingMsg.message_id, parse_mode: 'MarkdownV2'
                });
                return showServerMenu(bot, callbackQuery, db, appConfig, isSuperAdmin, userLang);
            }
            return;
        }
        
        if (action === 'manage_rank_list') {
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            await bot.deleteMessage(chatId, messageId).catch(()=>{});
            return rankManager.startRankManager(bot, msg, db, setupRankListCron);
        }

        if (action === 'admin_panel') {
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            return showAdminPanel(bot, callbackQuery, userLang);
        }
        
        if (action === 'add_admin') {
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            await db.setWizardState(userId, 'add_admin', 'awaiting_admin_id', { lang: userLang });
            return bot.editMessageText(getText(userLang, 'promptAddAdmin'), { chat_id: chatId, message_id: messageId, parse_mode: 'MarkdownV2' });
        }
        
        if (action === 'list_admins') {
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            const admins = await db.getAdmins();
            
            if (admins.length === 0) {
                const keyboard = {
                    inline_keyboard: [[
                        { text: '◀️ ' + getText(userLang, 'btnBack'), callback_data: 'admin_panel' }
                    ]]
                };
                return bot.editMessageText(getText(userLang, 'noAdminsFound'), { 
                    chat_id: chatId, 
                    message_id: messageId, 
                    reply_markup: keyboard,
                    parse_mode: 'MarkdownV2'
                });
            }

            let adminList = getText(userLang, 'adminListTitle') + '\n\n';
            
            admins.forEach((admin, index) => {
                const number = index + 1;
                const name = escapeMarkdownV2Internal(admin.name);
                adminList += `${number}\\. ${getText(userLang, 'adminListEntryName')}: *${name}*\n`;
                adminList += `   ${getText(userLang, 'adminListEntryId')}: \`${admin.user_id}\`\n\n`;
            });
            
            const keyboard = {
                inline_keyboard: [[
                    { text: '◀️ ' + getText(userLang, 'btnBack'), callback_data: 'admin_panel' }
                ]]
            };
            
            return bot.editMessageText(adminList, { 
                chat_id: chatId, 
                message_id: messageId, 
                parse_mode: 'MarkdownV2', 
                reply_markup: keyboard 
            });
        }

        if (action.startsWith('remove_admin_')) {
            
        }
        
        if (action === 'add_server') {
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            await db.setWizardState(userId, 'add_server', 'awaiting_ip', { lang: userLang });
            return bot.editMessageText(getText(userLang, 'promptAddServerIP'), { chat_id: chatId, message_id: messageId, parse_mode: 'MarkdownV2' });
        }
        
        if (action.startsWith('remove_server_')) {
            if (!isSuperAdmin) return answerPermissionDenied(bot, callbackQuery.id, userLang);
            const parts = action.split('_');
            const stage = parts[2];
            const serverId = parts[3];
            
            if (stage === 'prompt') {
                const servers = await db.getServers(userId);
                if (servers.length === 0) return bot.answerCallbackQuery(callbackQuery.id, { text: getText(userLang, 'errorNoServersToDelete'), show_alert: true });
                
                const serverButtons = servers.map(server => ([{ text: `🗑️ ${server.name}`, callback_data: `remove_server_confirm_${server.id}` }]));
                serverButtons.push([{ text: '◀️ ' + getText(userLang, 'btnBack'), callback_data: 'rcon_menu' }]);
                return bot.editMessageText(getText(userLang, 'promptDeleteServer'), { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: serverButtons } });
            }

            if (stage === 'confirm') {
                const keyboard = { inline_keyboard: [[{ text: getText(userLang, 'btnCancel'), callback_data: 'remove_server_prompt' }, { text: getText(userLang, 'btnConfirmDelete'), callback_data: `remove_server_execute_${serverId}` }]] };
                return bot.editMessageText(getText(userLang, 'confirmDeleteServer'), { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
            }
            
            if (stage === 'execute') {
                await db.deleteServerById(parseInt(serverId, 10)); 
                logger.success(MODULE_NAME, `Server ${serverId} removed by ${userId}.`);
                await bot.answerCallbackQuery(callbackQuery.id, { text: getText(userLang, 'deleteServerSuccess') });
                return showServerMenu(bot, callbackQuery, db, appConfig, isSuperAdmin, userLang);
            }
        }

        logger.warn(MODULE_NAME, `Unknown callback action received`, { action, userId });

    } catch (e) {
        if (!e.message?.includes('message is not modified')) {
             logger.error(MODULE_NAME, `A critical error occurred for action "${action}"`, { error: e.message, stack: e.stack });
        }
    }
}

module.exports = { handleCallback, showServerMenu, showAdminPanel };