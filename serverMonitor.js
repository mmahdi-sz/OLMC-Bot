// serverMonitor.js

const cron = require('node-cron');
const moment = require('moment-timezone');
const logger = require('./logger.js');

const MODULE_NAME = 'MONITOR';

// <<<< CHANGE START >>>>
// The playerListMessageId is no longer stored in memory.
// It will be fetched from the database on each run.
// State related to the content of the last sent message is still useful to prevent unnecessary edits.
let lastSentState = {
    isOnline: null,
    playerList: '',
};

// Key for storing the message ID in the settings table
const PLAYER_LIST_MESSAGE_ID_KEY = 'player_list_message_id';
// <<<< CHANGE END >>>>

// This was moved from an in-memory variable to a constant.
const FORCE_UPDATE_INTERVAL_MINUTES = 15;


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

    // <<<< CHANGE START >>>>
    // Fetch the message ID from the database at the beginning of the function.
    let playerListMessageId = await db.getSetting(PLAYER_LIST_MESSAGE_ID_KEY);
    const lastUpdateTime = parseInt(await db.getSetting('player_list_last_update_ts') || '0', 10);
    // <<<< CHANGE END >>>>

    const tehranTime = () => moment().tz('Asia/Tehran').format('HH:mm:ss');
    const isOnline = rconClient !== null;

    // --- Offline Message Logic ---
    if (!isOnline) {
        if (lastSentState.isOnline === false && !forceSend) return; // No change in state
        
        const message = `🔌 *Server Status*\n\n- RCON connection is currently down\\.\n- Last check: ${tehranTime()}`;
        try {
            if (playerListMessageId && !forceSend) {
                await bot.editMessageText(message, { chat_id: mainGroupId, message_id: playerListMessageId, parse_mode: 'MarkdownV2' });
            } else {
                // Delete the old message ID from DB if it exists, as we are creating a new one.
                if (playerListMessageId) await db.deleteSetting(PLAYER_LIST_MESSAGE_ID_KEY);
                
                const sentMessage = await bot.sendMessage(mainGroupId, message, { message_thread_id: playersTopicId, parse_mode: 'MarkdownV2' });
                
                if (!forceSend) {
                    await db.setSetting(PLAYER_LIST_MESSAGE_ID_KEY, sentMessage.message_id);
                }
            }
            lastSentState = { isOnline: false, playerList: '' };
        } catch (error) {
            if (error.response?.body?.description.includes('message to edit not found')) {
                logger.warn(MODULE_NAME, 'Offline message to edit not found. Clearing DB entry.');
                await db.deleteSetting(PLAYER_LIST_MESSAGE_ID_KEY);
            } else if (!error.message.includes('message is not modified')) {
                logger.error(MODULE_NAME, 'Failed to send/edit offline message', { error: error.message });
            }
        }
        return;
    }

    // --- Online Message Logic ---
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

        const isPlayerListUnchanged = lastSentState.isOnline === true && lastSentState.playerList === currentPlayerListString;
        const minutesSinceLastUpdate = (Date.now() - lastUpdateTime) / (1000 * 60);
        const isUpdateTimeExpired = minutesSinceLastUpdate >= FORCE_UPDATE_INTERVAL_MINUTES;

        if (isPlayerListUnchanged && !isUpdateTimeExpired && !forceSend) {
            logger.debug(MODULE_NAME, 'Skipping update: Player list unchanged and interval not expired.', { minutesSinceLastUpdate });
            return;
        }
        if (isPlayerListUnchanged && isUpdateTimeExpired) {
            logger.info(MODULE_NAME, 'Forcing time update because interval has expired.');
        }

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
            return; // Don't interact with the main message ID on a forced send
        }

        if (playerListMessageId) {
            try {
                await bot.editMessageText(message, { chat_id: mainGroupId, message_id: playerListMessageId, ...options });
                await db.setSetting('player_list_last_update_ts', Date.now()); // Update timestamp on successful edit
            } catch (error) {
                if (error.response?.body?.description.includes('message to edit not found')) {
                    logger.warn(MODULE_NAME, 'Message to edit not found. It will be recreated on the next run.');
                    await db.deleteSetting(PLAYER_LIST_MESSAGE_ID_KEY); // Invalidate the stored ID
                    playerListMessageId = null; // Ensure a new message is created below
                } else if (!error.message.includes('message is not modified')) {
                    logger.error(MODULE_NAME, 'Failed to edit player list message', { error: error.message });
                }
            }
        }
        
        if (!playerListMessageId) {
            const sentMessage = await bot.sendMessage(mainGroupId, message, options);
            await db.setSetting(PLAYER_LIST_MESSAGE_ID_KEY, sentMessage.message_id);
            await db.setSetting('player_list_last_update_ts', Date.now());
            logger.success(MODULE_NAME, 'New player list message sent and its ID saved to DB.', { messageId: sentMessage.message_id });
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

    // Run once at startup to ensure the message is created/updated immediately.
    setTimeout(() => {
        logger.info(MODULE_NAME, 'Performing initial player list update on startup...');
        const rconClient = getRconClient();
        updatePlayerList(bot, db, rconClient, false);
    }, 2000); // Small delay to allow DB/RCON connections to establish.

    cron.schedule('*/5 * * * *', () => {
        const rconClient = getRconClient();
        updatePlayerList(bot, db, rconClient, false);
    });

    cron.schedule('0 0 * * *', async () => {
        logger.info(MODULE_NAME, 'Daily reset: Clearing player list message ID from DB.');
        // <<<< CHANGE START >>>>
        // Instead of nulling a variable, we delete the setting from the database.
        await db.deleteSetting(PLAYER_LIST_MESSAGE_ID_KEY);
        await db.deleteSetting('player_list_last_update_ts');
        // <<<< CHANGE END >>>>
    }, {
        timezone: "Asia/Tehran"
    });

    return {
        // This function is for one-off sends and doesn't affect the main message.
        sendPlayerList: () => {
            logger.info(MODULE_NAME, 'Manual one-time player list request received.');
            const rconClient = getRconClient();
            return updatePlayerList(bot, db, rconClient, true);
        },
        // This function forces the bot to forget the old message and create a new one.
        forceNewPlayerListMessage: async () => {
            logger.info(MODULE_NAME, 'Forcing a new player list message to be the main target.');
            // <<<< CHANGE START >>>>
            // We delete the setting from the database to trigger a new message creation.
            await db.deleteSetting(PLAYER_LAST_MESSAGE_ID_KEY);
            await db.deleteSetting('player_list_last_update_ts');
            // <<<< CHANGE END >>>>
            const rconClient = getRconClient();
            return updatePlayerList(bot, db, rconClient, false);
        }
    };
}

module.exports = { startServerMonitor };