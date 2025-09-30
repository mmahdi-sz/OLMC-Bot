// handlers/wizardHandler.js

const { Rcon } = require('rcon-client');
const callbackHandler = require('./callbackHandler.js');
const logger = require('../logger.js');
const { getText } = require('../i18n.js');

const MODULE_NAME = 'WIZARD_HANDLER';

// <<<< بخش بهبود یافته >>>>
// لیستی از ویزاردهایی که این فایل مدیریت می‌کند
const HANDLED_WIZARDS = ['add_server', 'add_admin', 'rcon_command'];
// <<<< پایان بخش بهبود یافته >>>>

const WIZARD_STEPS = {
    SERVER_AWAITING_IP: 'awaiting_ip',
    SERVER_AWAITING_PORT: 'awaiting_port',
    SERVER_AWAITING_PASSWORD: 'awaiting_password',
    SERVER_AWAITING_NAME: 'awaiting_name',
    ADMIN_AWAITING_ID: 'awaiting_admin_id',
    ADMIN_AWAITING_NAME: 'awaiting_admin_name',
    RCON_AWAITING_COMMAND: 'awaiting_command', // برای ویزارد اتصال به RCON
};

/**
 * Handles the logic for each step of any active wizard.
 */
async function handleWizardSteps(bot, msg, db, superAdminId) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text || '';

    const state = await db.getWizardState(userId);

    if (!state) {
        return false;
    }
    
    // <<<< بخش بهبود یافته (حل مشکل اصلی) >>>>
    // اگر ویزارد فعال، مربوط به این handler نیست، آن را نادیده بگیر و false برگردان
    if (!HANDLED_WIZARDS.includes(state.wizard_type)) {
        logger.debug(MODULE_NAME, `Skipping wizard type '${state.wizard_type}' as it is not handled by this module.`);
        return false;
    }
    // <<<< پایان بخش بهبود یافته >>>>

    const userLang = await db.getUserLanguage(userId) || 'fa';
    if (!state.data.lang) {
        state.data.lang = userLang;
    }
    
    logger.info(MODULE_NAME, `Processing wizard step for user ${userId}`, { wizard: state.wizard_type, step: state.step, lang: userLang });

    if (text.toLowerCase() === '/cancel' || text.toLowerCase() === '/disconnect') {
        logger.info(MODULE_NAME, `User ${userId} cancelled the wizard`, { wizard: state.wizard_type });
        await db.deleteWizardState(userId);
        await bot.sendMessage(chatId, getText(userLang, 'wizardCancelled'));
        return true;
    }

    try {
        switch (state.wizard_type) {
            case 'add_server':
                await handleAddServerWizard(bot, msg, db, state, superAdminId);
                break;
            case 'add_admin':
                await handleAddAdminWizard(bot, msg, db, state);
                break;
            case 'rcon_command': // <<<< اضافه شد >>>>
                await handleRconCommandWizard(bot, msg, db, state);
                break;
            default:
                // این بخش حالا به ندرت اجرا می‌شود، اما برای اطمینان باقی می‌ماند
                logger.warn(MODULE_NAME, `Unknown wizard type found for user ${userId}`, { state });
                await db.deleteWizardState(userId);
                return false;
        }
    } catch (error) {
        logger.error(MODULE_NAME, `An unhandled error occurred in wizard`, { userId, state, error: error.message, stack: error.stack });
        await db.deleteWizardState(userId);
        await bot.sendMessage(chatId, getText(userLang, 'wizardError'));
    }

    return true;
}

/**
 * Handles steps for the "add server" wizard.
 */
async function handleAddServerWizard(bot, msg, db, state, superAdminId) {
    // ... محتوای این تابع بدون هیچ تغییری باقی می‌ماند ...
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const userLang = state.data.lang || 'fa';

    const cancelKeyboard = {
        inline_keyboard: [[{ text: getText(userLang, 'btnCancelAndBack'), callback_data: 'rcon_menu' }]]
    };

    switch (state.step) {
        case WIZARD_STEPS.SERVER_AWAITING_IP:
            state.data.ip = text;
            logger.debug(MODULE_NAME, 'Add Server Wizard: Received IP', { userId, ip: text });
            await db.setWizardState(userId, 'add_server', WIZARD_STEPS.SERVER_AWAITING_PORT, state.data);
            await bot.sendMessage(chatId, getText(userLang, 'promptServerPort'), { reply_markup: cancelKeyboard });
            break;

        case WIZARD_STEPS.SERVER_AWAITING_PORT:
            state.data.port = text;
            logger.debug(MODULE_NAME, 'Add Server Wizard: Received Port', { userId, port: text });
            await db.setWizardState(userId, 'add_server', WIZARD_STEPS.SERVER_AWAITING_PASSWORD, state.data);
            await bot.sendMessage(chatId, getText(userLang, 'promptServerPassword'), { reply_markup: cancelKeyboard });
            break;

        case WIZARD_STEPS.SERVER_AWAITING_PASSWORD:
            state.data.password = text;
            logger.debug(MODULE_NAME, 'Add Server Wizard: Received Password', { userId });
            await db.setWizardState(userId, 'add_server', WIZARD_STEPS.SERVER_AWAITING_NAME, state.data);
            await bot.sendMessage(chatId, getText(userLang, 'promptServerName'), { reply_markup: cancelKeyboard });
            break;

        case WIZARD_STEPS.SERVER_AWAITING_NAME:
            state.data.name = text;
            logger.debug(MODULE_NAME, 'Add Server Wizard: Received Name', { userId, name: text });
            
            let serverId;
            try {
                serverId = await db.addServer(userId, state.data.name, state.data.ip, state.data.port, state.data.password);
                await db.deleteWizardState(userId);
                logger.success(MODULE_NAME, 'Add Server Wizard: Server added to DB', { userId, serverId, serverData: state.data });

                const statusMsg = await bot.sendMessage(chatId, getText(userLang, 'testingConnection', state.data.name));
                
                const rcon = new Rcon({ host: state.data.ip, port: parseInt(state.data.port, 10), password: state.data.password });
                await rcon.connect();
                await rcon.end();
                
                logger.success(MODULE_NAME, `RCON connection test successful for new server ${serverId}.`);
                await bot.editMessageText(getText(userLang, 'connectionSuccess'), { chat_id: chatId, message_id: statusMsg.message_id });
                
                // شبیه‌سازی callbackQuery برای نمایش مجدد منو
                const mockCallbackQuery = { message: { chat: { id: chatId }, message_id: statusMsg.message_id }, from: { id: userId } };
                await callbackHandler.showServerMenu(bot, mockCallbackQuery, db, { superAdminId }, true, userLang);

            } catch (error) {
                await db.deleteWizardState(userId);
                
                if (error.code === 'ER_DUP_ENTRY') {
                    logger.warn(MODULE_NAME, 'Add Server Wizard: Failed due to duplicate entry', { userId, serverName: state.data.name });
                    await bot.sendMessage(chatId, getText(userLang, 'errorServerDuplicate', state.data.name));
                } else {
                    logger.error(MODULE_NAME, 'RCON connection test failed after adding server', { serverId, serverData: state.data, error: error.message });
                    const failureKeyboard = {
                        inline_keyboard: [[
                            { text: getText(userLang, 'btnRetryConnection'), callback_data: `rcon_retry_connect_${serverId}` },
                            { text: getText(userLang, 'btnEditServer'), callback_data: `rcon_edit_server_${serverId}` }
                        ]]
                    };
                    await bot.sendMessage(chatId, getText(userLang, 'errorConnectionFailed'), { reply_markup: failureKeyboard });
                }
            }
            break;
    }
}

/**
 * Handles steps for the "add admin" wizard.
 */
async function handleAddAdminWizard(bot, msg, db, state) {
    // ... محتوای این تابع بدون هیچ تغییری باقی می‌ماند ...
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const userLang = state.data.lang || 'fa';

    switch (state.step) {
        case WIZARD_STEPS.ADMIN_AWAITING_ID:
            let adminId;
            if (msg.forward_from) {
                adminId = msg.forward_from.id;
            } else if (msg.text && /^\d+$/.test(msg.text.trim())) {
                adminId = parseInt(msg.text.trim(), 10);
            }

            if (adminId) {
                state.data.id = adminId;
                logger.debug(MODULE_NAME, 'Add Admin Wizard: Received ID', { initiator: userId, newAdminId: adminId });
                await db.setWizardState(userId, 'add_admin', WIZARD_STEPS.ADMIN_AWAITING_NAME, state.data);
                await bot.sendMessage(chatId, getText(userLang, 'promptAdminName', adminId));
            } else {
                logger.warn(MODULE_NAME, 'Add Admin Wizard: Invalid ID provided', { initiator: userId, text: msg.text });
                await bot.sendMessage(chatId, getText(userLang, 'errorInvalidAdminId'));
            }
            break;

        case WIZARD_STEPS.ADMIN_AWAITING_NAME:
            const adminName = msg.text.trim();
            const newAdminId = state.data.id;
            logger.debug(MODULE_NAME, 'Add Admin Wizard: Received Name', { initiator: userId, newAdminId, adminName });
            try {
                await db.addAdmin(newAdminId, adminName);
                await db.deleteWizardState(userId);
                logger.success(MODULE_NAME, 'Add Admin Wizard: Admin added successfully', { initiator: userId, newAdminId, adminName });
                await bot.sendMessage(chatId, getText(userLang, 'addAdminSuccess', adminName, newAdminId));
                
                const mockCallbackQuery = { message: { chat: { id: chatId }, message_id: null }, from: { id: userId } }; 
                await callbackHandler.showAdminPanel(bot, mockCallbackQuery, userLang);

            } catch (error) {
                await db.deleteWizardState(userId);
                if (error.code === 'ER_DUP_ENTRY') {
                    logger.warn(MODULE_NAME, 'Add Admin Wizard: Failed due to duplicate entry', { initiator: userId, newAdminId });
                    await bot.sendMessage(chatId, getText(userLang, 'errorAdminDuplicate'));
                } else {
                    logger.error(MODULE_NAME, 'Add Admin Wizard: Failed to add admin to DB', { initiator: userId, newAdminId, adminName, error: error.message, stack: error.stack });
                    await bot.sendMessage(chatId, getText(userLang, 'errorAddAdminFailed'));
                }
            }
            break;
    }
}

// <<<< تابع جدید >>>>
/**
 * Handles the wizard for sending RCON commands.
 */
async function handleRconCommandWizard(bot, msg, db, state) {
    if (state.step !== WIZARD_STEPS.RCON_AWAITING_COMMAND) return;

    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const commandText = msg.text.trim();
    const { serverId, serverName } = state.data;
    
    // این ویزارد تا زمانی که کاربر /disconnect را ارسال کند فعال می‌ماند
    
    const ownerId = await db.isAdmin(userId) ? (await db.getSetting('super_admin_id')) : userId; // فرض می‌کنیم سوپرادمین در دیتابیس ذخیره شده
    const servers = await db.getServers(ownerId);
    const server = servers.find(s => s.id === serverId);

    if (!server) {
        await bot.sendMessage(chatId, `خطا: اطلاعات سرور *${serverName}* یافت نشد. ممکن است حذف شده باشد.`, { parse_mode: 'Markdown' });
        await db.deleteWizardState(userId);
        return;
    }

    try {
        const rcon = new Rcon({ host: server.ip, port: parseInt(server.port, 10), password: server.password });
        await rcon.connect();
        const response = await rcon.send(commandText);
        await rcon.end();
        
        const cleanedResponse = response.replace(/§./g, '');
        await bot.sendMessage(chatId, `<b>Response from ${serverName}:</b>\n<pre>${cleanedResponse || '(No response)'}</pre>`, { parse_mode: 'HTML' });
        
    } catch (error) {
        logger.error(MODULE_NAME, 'RCON Command Wizard: Failed to send command', { userId, serverName, command: commandText, error: error.message });
        await bot.sendMessage(chatId, `❌ خطایی در ارسال دستور به سرور *${serverName}* رخ داد:\n\`${error.message}\``, { parse_mode: 'Markdown' });
    }
}
// <<<< پایان تابع جدید >>>>

module.exports = { handleWizardSteps };