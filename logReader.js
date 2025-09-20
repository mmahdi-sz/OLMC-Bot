// logReader.js

const { Tail } = require('tail');
const fs = require('fs');
const logger = require('./logger.js');

const MODULE_NAME = 'LOG_READER';

// Load filtered words from .env, split by comma, and filter out empty strings
const filteredWordsRaw = process.env.FILTERED_WORDS || '';
const filteredWords = filteredWordsRaw.split(',').map(word => word.trim()).filter(Boolean);
if (filteredWords.length > 0) {
    logger.info(MODULE_NAME, `Loaded ${filteredWords.length} filtered words.`);
}

/**
 * Escapes characters for Telegram's HTML parse mode.
 */
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/**
 * Processes auction-related log lines.
 */
async function handleAuctionLog(line, bot, db) {
    const mainGroupId = await db.getSetting('main_group_id');
    const auctionTopicId = await db.getSetting('topic_id_auction');
    if (!mainGroupId || !auctionTopicId) return;

    let message = '';
    let eventType = 'unknown';

    // Regex for item listing (added)
    const addedMatch = line.match(/(\w+)\s+added\s+x(\d+)\s+(.+?)\s+in\s+auction\s+for\s+([\d,.\s]+)\./);
    if (addedMatch) {
        eventType = 'item_added';
        const [, username, quantity, itemName, price] = addedMatch;
        const cleanPrice = price.replace(/[\s,]/g, '');
        message = `📦 *آیتم جدید برای فروش*\n\n👤 *فروشنده:* \`${username}\`\n🏷️ *نوع آیتم:* \`${itemName}\`\n🔢 *تعداد:* \`${quantity}\`\n💰 *قیمت:* \`${cleanPrice} OM\``;
    }

    // Regex for item purchase (buy)
    const buyMatch = line.match(/(\w+)\s+buy\s+x(\d+)\s+(.+?)\s+to\s+(\w+)\s+for\s+([\d,.\s]+)\$/);
    if (buyMatch) {
        eventType = 'item_bought';
        const [, buyer, quantity, itemName, seller, price] = buyMatch;
        const cleanPrice = price.replace(/[\s,]/g, '');
        message = `✅ *آیتم فروخته شد*\n\n🙋‍♂️ *خریدار:* \`${buyer}\`\n👨‍💼 *فروشنده:* \`${seller}\`\n🏷️ *نوع آیتم:* \`${itemName}\`\n🔢 *تعداد:* \`${quantity}\`\n💰 *قیمت:* \`${cleanPrice} OM\``;
    }

    if (message) {
        logger.debug(MODULE_NAME, `Detected auction event`, { type: eventType, line });
        try {
            await bot.sendMessage(mainGroupId, message, {
                message_thread_id: auctionTopicId,
                parse_mode: 'Markdown'
            });
            logger.success(MODULE_NAME, 'Successfully sent auction house message to Telegram.');
        } catch (error) {
            logger.error(MODULE_NAME, 'Failed to send auction house message', { error: error.message, stack: error.stack });
        }
    }
}

/**
 * Processes in-game chat messages.
 */
async function handleChatLog(line, bot, db) {
    // Regex جدید برای پشتیبانی از فرمت لاگ شما: "[Not Secure] PREFIX USERNAME: MESSAGE"
    const match = line.match(/\[Not Secure\]\s+(.+?):\s+(.*)/);
    if (!match) return;

    const fullSender = match[1].trim();
    const originalMessage = match[2].trim();

    // برای جدا کردن پیشوند از نام کاربری، آخرین کلمه را به عنوان نام کاربری در نظر می‌گیریم.
    const senderParts = fullSender.split(/\s+/);
    const username = senderParts.pop(); // آخرین بخش نام کاربری است
    const prefix = senderParts.join(' '); // بقیه بخش‌ها پیشوند هستند

    // Ignore messages sent from Telegram to avoid loops
    if (prefix === '[Telegram]') {
        return;
    }
    
    logger.debug(MODULE_NAME, 'Detected in-game chat message', { prefix, username, message: originalMessage });

    const mainGroupId = await db.getSetting('main_group_id');
    const chatTopicId = await db.getSetting('topic_id_chat');
    if (!mainGroupId || !chatTopicId) return;

    let messageToSend = originalMessage;
    let isFiltered = false;

    // Filter message content
    if (filteredWords.length > 0) {
        const hasFilteredWord = filteredWords.some(word => 
            new RegExp(`\\b${word}\\b`, 'i').test(originalMessage)
        );
        if (hasFilteredWord) {
            isFiltered = true;
            logger.info(MODULE_NAME, `Filtered message from user`, { username });
            messageToSend = '[متن پیام به دلیل مغایرت با قوانین، نمایش داده نشد]';
        }
    }

    // <<<<<<<<<<<<<<<<< CHANGE START >>>>>>>>>>>>>>>>>
    // خطای تایپی "&g t;" به "&gt;" اصلاح شد
    const formattedMessage = `🎮 <b>${escapeHTML(prefix)} ${escapeHTML(username)}</b> &gt;&gt; ${escapeHTML(messageToSend)}`;
    // <<<<<<<<<<<<<<<<< CHANGE END >>>>>>>>>>>>>>>>>
    
    try {
        await bot.sendMessage(mainGroupId, formattedMessage, {
            parse_mode: 'HTML',
            message_thread_id: chatTopicId
        });
        logger.success(MODULE_NAME, `Successfully sent chat message to Telegram.`, { username, filtered: isFiltered });
    } catch (error) {
        logger.error(MODULE_NAME, 'Failed to send chat message', { error: error.message, stack: error.stack });
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
        useWatchFile: true // More reliable for log rotation
    };

    try {
        if (!fs.existsSync(logFilePath)) {
            throw new Error(`Log file not found at ${logFilePath}`);
        }

        const tail = new Tail(logFilePath, options);
        logger.success(MODULE_NAME, 'Successfully started watching log file.');

        tail.on('line', async (line) => {
            if (line.includes('[zAuctionHouseV3')) {
                await handleAuctionLog(line, bot, db);
            } else if (line.includes('[Not Secure]')) {
                await handleChatLog(line, bot, db);
            }
        });

        tail.on('error', (error) => {
            logger.error(MODULE_NAME, 'Error watching log file. Attempting to re-watch in 10 seconds...', { error: error.message });
            try {
                tail.unwatch();
            } catch (unwatchError) {
                logger.error(MODULE_NAME, 'Error during unwatch attempt.', { error: unwatchError.message });
            }
            setTimeout(() => watchLogFile(logFilePath, bot, db), 10000);
        });

    } catch (error) {
        logger.error(MODULE_NAME, `Failed to start tailing. Retrying in 10 seconds...`, { error: error.message });
        setTimeout(() => watchLogFile(logFilePath, bot, db), 10000);
    }
}

/**
 * Initializes the log reader module.
 */
function startLogReader(bot, db) {
    const logFilePath = process.env.SERVER_LOG_FILE_PATH;

    if (!logFilePath) {
        logger.warn(MODULE_NAME, 'SERVER_LOG_FILE_PATH is not defined in .env. Game-to-Telegram bridge is disabled.');
        return;
    }

    watchLogFile(logFilePath, bot, db);
}

module.exports = { startLogReader };