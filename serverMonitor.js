// serverMonitor.js

const cron = require('node-cron');
const moment = require('moment-timezone');
const logger = require('./logger.js'); // <<<< اضافه شد >>>>

const MODULE_NAME = 'MONITOR';

let lastSentState = {
    isOnline: null,
    playerList: '',
};

let playerListMessageId = null;

// <<<<<<<<<<<<<<<<< CHANGE START >>>>>>>>>>>>>>>>>
// متغیر جدید برای ذخیره زمان آخرین ویرایش موفق
let lastSuccessfulEditTimestamp = 0;
// ثابت جدید برای تعیین بازه زمانی به‌روزرسانی اجباری (به دقیقه)
const FORCE_UPDATE_INTERVAL_MINUTES = 15;
// <<<<<<<<<<<<<<<<< CHANGE END >>>>>>>>>>>>>>>>>


/**
 * Escapes special characters for Telegram's MarkdownV2 parse mode.
 */
function escapeMarkdownV2(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

/**
 * Parses the raw response from the RCON 'list' command.
 */
function parsePlayerList(rawResponse) {
    const customFormatMatch = rawResponse.match(/[^\d]*(\d+)\/(\d+)[^\:]*:\s*(.*)/i);
    if (customFormatMatch) {
        const online = parseInt(customFormatMatch[1], 10);
        const max = parseInt(customFormatMatch[2], 10);
        const playerString = customFormatMatch[3].trim();
        const players = playerString ? playerString.split(',').map(p => p.trim()).sort() : [];
        return { online, max, players };
    }

    const vanillaFormatMatch = rawResponse.match(/There are (\d+) of a max of (\d+) players online:(.*)/);
    if (vanillaFormatMatch) {
        const online = parseInt(vanillaFormatMatch[1], 10);
        const max = parseInt(vanillaFormatMatch[2], 10);
        const playerString = vanillaFormatMatch[3].trim();
        const players = playerString ? playerString.split(',').map(p => p.trim()).sort() : [];
        return { online, max, players };
    }
    
    return null;
}

/**
 * Fetches the player list and updates the message.
 */
async function updatePlayerList(bot, db, rconClient, forceSend = false) {
    const mainGroupId = await db.getSetting('main_group_id');
    const playersTopicId = await db.getSetting('topic_id_players');

    if (!mainGroupId || !playersTopicId) {
        if (forceSend) logger.warn(MODULE_NAME, 'Player list module is not configured.');
        return;
    }

    const tehranTime = () => moment().tz('Asia/Tehran').format('HH:mm:ss');
    const isOnline = rconClient !== null;

    if (!isOnline) {
        if (lastSentState.isOnline === false && !forceSend) return;
        const message = `🔌 *Server Status*\n\n- RCON connection is currently down\\.\n- Last check: ${tehranTime()}`;
        try {
            if (playerListMessageId && !forceSend) {
                await bot.editMessageText(message, { chat_id: mainGroupId, message_id: playerListMessageId, message_thread_id: playersTopicId, parse_mode: 'MarkdownV2' });
            } else {
                const sentMessage = await bot.sendMessage(mainGroupId, message, { message_thread_id: playersTopicId, parse_mode: 'MarkdownV2' });
                if (!forceSend) playerListMessageId = sentMessage.message_id;
            }
            lastSentState = { isOnline: false, playerList: '' };
            lastSuccessfulEditTimestamp = Date.now(); // ریست زمان
        } catch (error) {
            if (!error.message.includes('message is not modified')) {
                logger.error(MODULE_NAME, 'Failed to send/edit offline message', { error: error.message });
            }
        }
        return;
    }

    try {
        const response = await rconClient.send('list');
        const cleanedResponse = response.replace(/§./g, '');
        
        const parsedData = parsePlayerList(cleanedResponse);

        if (!parsedData) {
            logger.error(MODULE_NAME, 'Failed to parse RCON response for player list.');
            if (forceSend) await bot.sendMessage(mainGroupId, '❌ Could not parse RCON response.', { message_thread_id: playersTopicId });
            return;
        }

        const { players: currentPlayers } = parsedData;
        const currentPlayerListString = currentPlayers.join(', ');

        // <<<<<<<<<<<<<<<<< CHANGE START >>>>>>>>>>>>>>>>>
        // منطق بهینه‌سازی بهبود یافت
        const isPlayerListUnchanged = lastSentState.isOnline === true && lastSentState.playerList === currentPlayerListString;
        const minutesSinceLastUpdate = (Date.now() - lastSuccessfulEditTimestamp) / (1000 * 60);
        const isUpdateTimeExpired = minutesSinceLastUpdate >= FORCE_UPDATE_INTERVAL_MINUTES;

        if (isPlayerListUnchanged && !isUpdateTimeExpired && !forceSend) {
            logger.debug(MODULE_NAME, 'Skipping update: Player list unchanged and interval not expired.', { minutesSinceLastUpdate });
            return;
        }
        if (isPlayerListUnchanged && isUpdateTimeExpired) {
            logger.info(MODULE_NAME, 'Forcing time update because interval has expired.');
        }
        // <<<<<<<<<<<<<<<<< CHANGE END >>>>>>>>>>>>>>>>>

        let message = '👥 *Online Players*\n\n';
        message += `\\- Online: *${parsedData.online} / ${parsedData.max}*\n\n`;
        if (currentPlayers.length > 0) {
            message += currentPlayers.map(p => `\\- ${escapeMarkdownV2(p)}`).join('\n');
        } else {
            message += '\\- No players are currently online\\.';
        }
        message += `\n\n🕒 Last Updated \\(Tehran\\): *${tehranTime()}*`;

        const options = { message_thread_id: playersTopicId, parse_mode: 'MarkdownV2' };

        if (forceSend) {
            await bot.sendMessage(mainGroupId, message, options);
        } else if (playerListMessageId) {
            try {
                await bot.editMessageText(message, { chat_id: mainGroupId, message_id: playerListMessageId, ...options });
                lastSuccessfulEditTimestamp = Date.now(); // زمان آپدیت شد
            } catch (error) {
                if (error.response?.body?.description.includes('message to edit not found')) {
                    logger.warn(MODULE_NAME, 'Message to edit not found. It will be recreated.');
                    playerListMessageId = null;
                } else if (!error.message.includes('message is not modified')) {
                    logger.error(MODULE_NAME, 'Failed to edit player list message', { error: error.message });
                }
            }
        }
        
        if (!playerListMessageId && !forceSend) {
            const sentMessage = await bot.sendMessage(mainGroupId, message, options);
            playerListMessageId = sentMessage.message_id;
            lastSuccessfulEditTimestamp = Date.now(); // زمان آپدیت شد
            logger.success(MODULE_NAME, 'New player list message sent', { messageId: playerListMessageId });
        }

        lastSentState = { isOnline: true, playerList: currentPlayerListString };

    } catch (error) {
        logger.error(MODULE_NAME, 'Error getting player list via RCON', { error: error.message });
        if (forceSend) await bot.sendMessage(mainGroupId, '❌ Error fetching player list.', { message_thread_id: playersTopicId });
    }
}

/**
 * Initializes the server monitoring tasks.
 */
function startServerMonitor(bot, db, getRconClient) {
    logger.info(MODULE_NAME, 'Server monitor has started. Will check every 5 minutes.');

    cron.schedule('*/5 * * * *', () => {
        const rconClient = getRconClient();
        updatePlayerList(bot, db, rconClient, false);
    });

    cron.schedule('0 0 * * *', () => {
        logger.info(MODULE_NAME, 'Daily reset: Clearing player list message ID.');
        playerListMessageId = null;
        lastSuccessfulEditTimestamp = 0; // ریست کردن تایمر
    }, {
        timezone: "Asia/Tehran"
    });

    return {
        sendPlayerList: () => {
            logger.info(MODULE_NAME, 'Manual one-time player list request received.');
            const rconClient = getRconClient();
            return updatePlayerList(bot, db, rconClient, true);
        },
        forceNewPlayerListMessage: () => {
            logger.info(MODULE_NAME, 'Forcing a new player list message to be the main target.');
            playerListMessageId = null;
            lastSuccessfulEditTimestamp = 0; // ریست کردن تایمر
            const rconClient = getRconClient();
            return updatePlayerList(bot, db, rconClient, false);
        }
    };
}

module.exports = { startServerMonitor };