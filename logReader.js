// logReader.js

const { Tail } = require('tail');
const fs = require('fs');
const logger = require('./logger.js');

const MODULE_NAME = 'LOG_READER';

// <<<< CHANGE START >>>> (Problem 7: Excessive DB Queries)
// Cache for log reader settings to avoid repeated DB calls.
let logConfig = {
    mainGroupId: null,
    topicIds: {
        auction: null,
        chat: null,
    }
};

// Function to load/reload the configuration from the database.
async function loadLogReaderConfig(db) {
    logger.info(MODULE_NAME, 'Loading/Reloading log reader configuration...');
    try {
        logConfig.mainGroupId = await db.getSetting('main_group_id');
        logConfig.topicIds.auction = await db.getSetting('topic_id_auction');
        logConfig.topicIds.chat = await db.getSetting('topic_id_chat');
        logger.success(MODULE_NAME, 'Log reader configuration loaded successfully.');
    } catch (error) {
        logger.error(MODULE_NAME, 'Failed to load log reader configuration.', { error: error.message });
    }
}
// <<<< CHANGE END >>>>

const filteredWordsRaw = process.env.FILTERED_WORDS || '';
const filteredWords = filteredWordsRaw.split(',').map(word => word.trim()).filter(Boolean);
if (filteredWords.length > 0) {
    logger.info(MODULE_NAME, `Loaded ${filteredWords.length} filtered words.`);
}

function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/**
 * Processes auction-related log lines.
 * This function now uses the cached logConfig instead of querying the DB.
 */
async function handleAuctionLog(line, bot) {
    if (!logConfig.mainGroupId || !logConfig.topicIds.auction) return;

    let message = '';
    let eventType = 'unknown';

    // <<<< CHANGE START >>>> (Problem 4: Brittle Regex)
    // Regex made more flexible with \s+ to handle variable spacing.
    const addedMatch = line.match(/(\w+)\s+added\s+x(\d+)\s+(.+?)\s+in\s+auction\s+for\s+([\d,.\s]+?)\./);
    if (addedMatch) {
        eventType = 'item_added';
        const [, username, quantity, itemName, price] = addedMatch;
        const cleanPrice = price.replace(/[\s,]/g, '');
        message = `📦 *آیتم جدید برای فروش*\n\n👤 *فروشنده:* \`${username}\`\n🏷️ *نوع آیتم:* \`${itemName}\`\n🔢 *تعداد:* \`${quantity}\`\n💰 *قیمت:* \`${cleanPrice} OM\``;
    }

    const buyMatch = line.match(/(\w+)\s+buy\s+x(\d+)\s+(.+?)\s+to\s+(\w+)\s+for\s+([\d,.\s]+?)\$/);
    if (buyMatch) {
        eventType = 'item_bought';
        const [, buyer, quantity, itemName, seller, price] = buyMatch;
        const cleanPrice = price.replace(/[\s,]/g, '');
        message = `✅ *آیتم فروخته شد*\n\n🙋‍♂️ *خریدار:* \`${buyer}\`\n👨‍💼 *فروشنده:* \`${seller}\`\n🏷️ *نوع آیتم:* \`${itemName}\`\n🔢 *تعداد:* \`${quantity}\`\n💰 *قیمت:* \`${cleanPrice} OM\``;
    }
    // <<<< CHANGE END >>>>

    if (message) {
        logger.debug(MODULE_NAME, `Detected auction event`, { type: eventType });
        try {
            await bot.sendMessage(logConfig.mainGroupId, message, {
                message_thread_id: logConfig.topicIds.auction,
                parse_mode: 'Markdown'
            });
        } catch (error) {
            logger.error(MODULE_NAME, 'Failed to send auction house message', { error: error.message });
        }
    } else {
        // <<<< CHANGE START >>>> (Problem 4: Silent Failure)
        // Log a warning if a line contains the keyword but doesn't match any regex.
        logger.warn(MODULE_NAME, 'An auction log line was detected but not parsed. The log format may have changed.', { line });
        // <<<< CHANGE END >>>>
    }
}

/**
 * Processes in-game chat messages.
 * This function now uses the cached logConfig instead of querying the DB.
 */
async function handleChatLog(line, bot) {
    if (!logConfig.mainGroupId || !logConfig.topicIds.chat) return;

    // <<<< CHANGE START >>>> (Problem 4: Brittle Regex)
    // Regex made more robust against small format changes.
    const match = line.match(/\[Not Secure\]\s*([^:]+):\s*(.*)/);
    // <<<< CHANGE END >>>>
    
    if (!match) {
        // <<<< CHANGE START >>>> (Problem 4: Silent Failure)
        logger.warn(MODULE_NAME, 'A chat log line was detected but not parsed. The log format may have changed.', { line });
        // <<<< CHANGE END >>>>
        return;
    }

    const fullSender = match[1].trim();
    const originalMessage = match[2].trim();

    const senderParts = fullSender.split(/\s+/);
    const username = senderParts.pop();
    const prefix = senderParts.join(' ');

    if (prefix === '[Telegram]') {
        return; // Ignore messages from the bot itself to prevent loops
    }
    
    let messageToSend = originalMessage;
    const hasFilteredWord = filteredWords.some(word => 
        new RegExp(`\\b${word}\\b`, 'i').test(originalMessage)
    );

    if (hasFilteredWord) {
        logger.info(MODULE_NAME, `Filtered message from user`, { username });
        messageToSend = '[متن پیام به دلیل مغایرت با قوانین، نمایش داده نشد]';
    }

    const formattedMessage = `🎮 <b>${escapeHTML(prefix)} ${escapeHTML(username)}</b> &gt;&gt; ${escapeHTML(messageToSend)}`;
    
    try {
        await bot.sendMessage(logConfig.mainGroupId, formattedMessage, {
            parse_mode: 'HTML',
            message_thread_id: logConfig.topicIds.chat
        });
    } catch (error) {
        logger.error(MODULE_NAME, 'Failed to send chat message', { error: error.message });
    }
}

/**
 * Watches the log file and dispatches lines to appropriate handlers.
 */
function watchLogFile(logFilePath, bot, db) {
    logger.info(MODULE_NAME, `Attempting to watch log file at: ${logFilePath}`);
    
    const options = {
        fromBeginning: false,
        follow: true,
        useWatchFile: true
    };

    try {
        if (!fs.existsSync(logFilePath)) {
            throw new Error(`Log file not found at ${logFilePath}`);
        }

        const tail = new Tail(logFilePath, options);
        logger.success(MODULE_NAME, 'Successfully started watching log file.');

        tail.on('line', (line) => {
            // The handlers no longer need the 'db' object for settings.
            if (line.includes('[zAuctionHouseV3')) {
                handleAuctionLog(line, bot);
            } else if (line.includes('[Not Secure]')) {
                handleChatLog(line, bot);
            }
        });

        tail.on('error', (error) => {
            logger.error(MODULE_NAME, 'Error watching log file. Re-watching in 10s...', { error: error.message });
            try { tail.unwatch(); } catch (e) { /* ignore */ }
            setTimeout(() => watchLogFile(logFilePath, bot, db), 10000);
        });

    } catch (error) {
        logger.error(MODULE_NAME, `Failed to start tailing. Retrying in 10s...`, { error: error.message });
        setTimeout(() => watchLogFile(logFilePath, bot, db), 10000);
    }
}

/**
 * Initializes the log reader module.
 */
async function startLogReader(bot, db) {
    const logFilePath = process.env.SERVER_LOG_FILE_PATH;

    if (!logFilePath) {
        logger.warn(MODULE_NAME, 'SERVER_LOG_FILE_PATH not defined. Game-to-Telegram bridge is disabled.');
        return;
    }

    // <<<< CHANGE START >>>> (Problem 7: Excessive DB Queries)
    // Load the configuration once at the start.
    await loadLogReaderConfig(db);
    // <<<< CHANGE END >>>>

    watchLogFile(logFilePath, bot, db);
}

// Export the reload function so it can be called from other modules if settings change.
module.exports = { startLogReader, loadLogReaderConfig };