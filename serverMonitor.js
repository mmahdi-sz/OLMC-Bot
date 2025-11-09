const cron = require('node-cron');
const moment = require('moment-timezone');
const logger = require('./logger.js');

const MODULE_NAME = 'MONITOR';

let lastSentState = {
    isOnline: null,
    playerList: '',
};

const PLAYER_LIST_MESSAGE_ID_KEY = 'player_list_message_id';
const FORCE_UPDATE_INTERVAL_MINUTES = 15;
const MIN_UPDATE_INTERVAL = 10000; 
let lastUpdateAttemptTime = 0;

function escapeMarkdownV2(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

function parsePlayerList(rawResponse) {
    const customFormatMatch = rawResponse.match(/[^\d]*(\d+)\s*\/\s*(\d+)[^:]*:\s*(.*)/i);
    if (customFormatMatch) {
        const online = parseInt(customFormatMatch[1], 10);
        const max = parseInt(customFormatMatch[2], 10);
        const playerString = customFormatMatch[3].trim();
        const players = playerString ? playerString.split(/,\s*/).map(p => p.trim()).sort() : [];
        return { online, max, players };
    }

    const vanillaFormatMatch = rawResponse.match(/There are (\d+) of a max of (\d+) players online:(.*)/);
    if (vanillaFormatMatch) {
        const online = parseInt(vanillaFormatMatch[1], 10);
        const max = parseInt(vanillaFormatMatch[2], 10);
        const playerString = vanillaFormatMatch[3].trim();
        const players = playerString ? playerString.split(/,\s*/).map(p => p.trim()).sort() : [];
        return { online, max, players };
    }
    
    return null;
}

async function updatePlayerList(bot, db, rconClient, forceSend = false) {
    const now = Date.now();
    
    if (!forceSend && (now - lastUpdateAttemptTime) < MIN_UPDATE_INTERVAL) {
        logger.debug(MODULE_NAME, 'Skipping update: too soon since last attempt.');
        return;
    }
    
    lastUpdateAttemptTime = now;

    const mainGroupId = await db.getSetting('main_group_id');
    const playersTopicId = await db.getSetting('topic_id_players');

    if (!mainGroupId || !playersTopicId) {
        if (forceSend) logger.warn(MODULE_NAME, 'ماژول لیست بازیکنان پیکربندی نشده است.');
        return;
    }

    let playerListMessageId = await db.getSetting(PLAYER_LIST_MESSAGE_ID_KEY);
    const lastUpdateTime = parseInt(await db.getSetting('player_list_last_update_ts') || '0', 10);
    
    const tehranTime = () => moment().tz('Asia/Tehran').format('HH:mm:ss');
    const isOnline = rconClient !== null;

    if (!isOnline) {
        const time = tehranTime();
        
        let message = '🔴 *سرور آفلاین است*\n\n━━━━━━━━━━━━━━━━\n\n';
        message += '⚠️ اتصال به RCON قطع است\n';
        message += '💡 در حال تلاش برای اتصال مجدد\\.\\.\\.\n';
        message += `\n🕒 آخرین بررسی \\(تهران\\): *${time}*`;
        
        if (lastSentState.isOnline === false && !forceSend) {
             const minutesSinceLastUpdate = (now - lastUpdateTime) / (1000 * 60);
             const isUpdateTimeExpired = minutesSinceLastUpdate >= FORCE_UPDATE_INTERVAL_MINUTES;
             if (!isUpdateTimeExpired) return;
        }

        try {
            const options = { message_thread_id: playersTopicId, parse_mode: 'MarkdownV2' };
            if (playerListMessageId) {
                await bot.editMessageText(message, { chat_id: mainGroupId, message_id: playerListMessageId, ...options });
                await db.setSetting('player_list_last_update_ts', Date.now());
            } else {
                const sentMessage = await bot.sendMessage(mainGroupId, message, options);
                await db.setSetting(PLAYER_LIST_MESSAGE_ID_KEY, sentMessage.message_id);
                await db.setSetting('player_list_last_update_ts', Date.now());
            }
            lastSentState = { isOnline: false, playerList: '' };
        } catch (error) {
            if (error.response?.body?.description.includes('message to edit not found')) {
                logger.warn(MODULE_NAME, 'پیام آفلاین برای ویرایش یافت نشد. ورودی پایگاه داده پاک می‌شود.');
                await db.deleteSetting(PLAYER_LIST_MESSAGE_ID_KEY);
            } else if (!error.message.includes('message is not modified')) {
                logger.error(MODULE_NAME, 'ارسال/ویرایش پیام آفلاین ناموفق بود.', { error: error.message });
            }
        }
        return;
    }

    try {
        const response = await rconClient.send('list');
        const cleanedResponse = response.replace(/§./g, '');
        const parsedData = parsePlayerList(cleanedResponse);

        if (!parsedData) {
            logger.error(MODULE_NAME, 'تجزیه پاسخ RCON برای لیست بازیکنان ناموفق بود.');
            if (forceSend) await bot.sendMessage(mainGroupId, '❌ پاسخ RCON قابل تجزیه نیست.', { message_thread_id: playersTopicId, parse_mode: 'MarkdownV2' });
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

        let message = '🟢 *سرور آنلاین است*\n\n━━━━━━━━━━━━━━━━\n\n';
        message += `👥 *بازیکنان آنلاین:* *${parsedData.online}* / *${parsedData.max}*\n\n`;
        
        if (currentPlayers.length > 0) {
            message += '📋 *لیست بازیکنان:*\n\n';
            message += currentPlayers.map((p, i) => `${i + 1}\\. ${escapeMarkdownV2(p)}`).join('\n');
        } else {
            message += '📭 هیچ بازیکنی آنلاین نیست\\.';
        }
        
        const time = tehranTime();
        message += `\n\n━━━━━━━━━━━━━━━━\n🕒 آخرین آپدیت \\(تهران\\): *${time}*`;

        const options = { message_thread_id: playersTopicId, parse_mode: 'MarkdownV2' };

        if (forceSend) {
            await bot.sendMessage(mainGroupId, message, options);
            return;
        }

        if (playerListMessageId) {
            try {
                await bot.editMessageText(message, { chat_id: mainGroupId, message_id: playerListMessageId, ...options });
                await db.setSetting('player_list_last_update_ts', Date.now());
            } catch (error) {
                if (error.response?.body?.description.includes('message to edit not found')) {
                    logger.warn(MODULE_NAME, 'پیام برای ویرایش یافت نشد. در اجرای بعدی دوباره ایجاد خواهد شد.');
                    await db.deleteSetting(PLAYER_LIST_MESSAGE_ID_KEY); 
                    playerListMessageId = null; 
                } else if (!error.message.includes('message is not modified')) {
                    logger.error(MODULE_NAME, 'ویرایش پیام لیست بازیکنان ناموفق بود.', { error: error.message });
                }
            }
        }
        
        if (!playerListMessageId) {
            const sentMessage = await bot.sendMessage(mainGroupId, message, options);
            await db.setSetting(PLAYER_LIST_MESSAGE_ID_KEY, sentMessage.message_id);
            await db.setSetting('player_list_last_update_ts', Date.now());
            logger.success(MODULE_NAME, 'پیام جدید لیست بازیکنان ارسال و شناسه آن در پایگاه داده ذخیره شد.', { messageId: sentMessage.message_id });
        }

        lastSentState = { isOnline: true, playerList: currentPlayerListString };

    } catch (error) {
        logger.error(MODULE_NAME, 'خطا در دریافت لیست بازیکنان از طریق RCON', { error: error.message });
        if (forceSend) await bot.sendMessage(mainGroupId, '❌ خطا در واکشی لیست بازیکنان.', { message_thread_id: playersTopicId, parse_mode: 'MarkdownV2' });
    }
}

function startServerMonitor(bot, db, getRconClient) {
    logger.info(MODULE_NAME, 'مانیتور سرور شروع به کار کرد. هر 5 دقیقه وضعیت بررسی می‌شود.');

    setTimeout(() => {
        logger.info(MODULE_NAME, 'اجرای آپدیت اولیه لیست بازیکنان در زمان شروع...');
        updatePlayerList(bot, db, getRconClient(), false);
    }, 2000); 

    cron.schedule('*/5 * * * *', () => {
        updatePlayerList(bot, db, getRconClient(), false);
    });

    cron.schedule('0 0 * * *', async () => {
        logger.info(MODULE_NAME, 'ریست روزانه: پاک کردن شناسه پیام لیست بازیکنان از پایگاه داده.');
        await db.deleteSetting(PLAYER_LIST_MESSAGE_ID_KEY);
        await db.deleteSetting('player_list_last_update_ts');
    }, {
        timezone: "Asia/Tehran"
    });
}

async function forceNewPlayerListMessage(bot, db, getRconClient) {
    logger.info(MODULE_NAME, 'ایجاد یک پیام جدید برای لیست بازیکنان به صورت اجباری.');
    const mainGroupId = await db.getSetting('main_group_id');
    const playerListMessageId = await db.getSetting(PLAYER_LIST_MESSAGE_ID_KEY);
    if(mainGroupId && playerListMessageId) {
       await bot.deleteMessage(mainGroupId, playerListMessageId).catch(() => {});
    }
    await db.deleteSetting(PLAYER_LIST_MESSAGE_ID_KEY);
    await db.deleteSetting('player_list_last_update_ts');
    return updatePlayerList(bot, db, getRconClient(), false);
}


module.exports = { startServerMonitor, updatePlayerList, forceNewPlayerListMessage };