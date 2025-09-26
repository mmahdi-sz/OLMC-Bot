const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const db = require('../database');

const commands = new Map();
// بهبود: این ثابت به داخل تابع loadConfig منتقل می‌شود تا بخشی از آبجکت کانفیگ سراسری باشد.

/**
 * Loads all command handlers from the /commands directory.
 */
function loadCommands(bot, appConfig) {
    const commandsPath = path.join(__dirname, '../commands');
    
    try {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            // --- بهبود: افزایش پایداری با مدیریت خطای هر فایل به صورت جداگانه ---
            try {
                const commandList = require(filePath);

                if (Array.isArray(commandList)) {
                    for (const command of commandList) {
                        if (command.name && command.execute && command.regex) {
                            commands.set(command.name, command.execute);
                            // پاس دادن یک کانتکست مشترک (db, appConfig) به تمام دستورات
                            bot.onText(command.regex, (msg, match) => {
                                command.execute(bot, msg, match, appConfig, db);
                            });
                            logger.info('CMD_LOADER', `Loaded command: ${command.name}`);
                        } else {
                            logger.warn('CMD_LOADER', `Skipping invalid command object in file: ${file}`);
                        }
                    }
                }
            } catch (error) {
                // اگر یک فایل دستور مشکل داشته باشد، فقط همان فایل نادیده گرفته شده و برنامه متوقف نمی‌شود.
                logger.error('CMD_LOADER', `Failed to load commands from file: ${file}`, { error: error.message, stack: error.stack });
            }
        }
    } catch (error) {
        logger.error('CMD_LOADER', 'Could not read commands directory.', { error: error.message });
    }
}

/**
 * Retrieves a command's execution function by its name.
 */
function getCommandHandler(commandName) {
    return commands.get(commandName);
}

/**
 * Loads all application settings from .env and the database.
 */
async function loadConfig() {
    logger.info('APP_CONFIG', 'Loading application configuration...');
    try {
        // --- بهبود: متغیر VALID_MODULES به اینجا منتقل شده است ---
        const validModules = ['chat', 'players', 'rank', 'status', 'online', 'auction'];
        
        const config = {
            superAdminId: parseInt(process.env.SUPER_ADMIN_ID, 10),
            supportAdminUsername: process.env.SUPPORT_ADMIN_USERNAME || 'otherland_admin',
            mainBotUsername: process.env.MAIN_BOT_USERNAME || 'OLMCrobot',
            mainGroupId: null,
            topicIds: {},
            validModules: validModules, // اضافه شدن به آبجکت کانفیگ
            rcon: {
                host: process.env.BRIDGE_RCON_HOST,
                port: parseInt(process.env.BRIDGE_RCON_PORT, 10),
                password: process.env.BRIDGE_RCON_PASSWORD,
                reconnectDelay: 10000
            },
            chat: {
                cooldownSeconds: 300,
                unlimitedChatRanks: ['owner', 'admin']
            }
        };

        if (!config.rcon.host || !config.rcon.port || !config.rcon.password) {
            logger.error('APP_CONFIG', "FATAL: RCON configuration is missing from the .env file.");
            process.exit(1);
        }

        const mainGroupId = await db.getSetting('main_group_id');
        if (mainGroupId) config.mainGroupId = parseInt(mainGroupId, 10);

        for (const moduleName of config.validModules) {
            const topicId = await db.getSetting(`topic_id_${moduleName}`);
            if (topicId) config.topicIds[moduleName] = parseInt(topicId, 10);
        }
        
        const cooldownDb = await db.getSetting('chat_cooldown_seconds');
        if (cooldownDb) config.chat.cooldownSeconds = parseInt(cooldownDb, 10);

        const unlimitedRanksDb = await db.getSetting('unlimited_chat_ranks');
        if (unlimitedRanksDb) config.chat.unlimitedChatRanks = unlimitedRanksDb.split(',').map(r => r.trim());

        logger.success('APP_CONFIG', 'Configuration loaded successfully.');
        return config;

    } catch (error) {
        logger.error('APP_CONFIG', 'A fatal error occurred while loading settings from database.', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}


module.exports = {
    loadCommands,
    getCommandHandler,
    loadConfig,
    // بهبود: دیگر نیازی به export کردن VALID_MODULES به صورت جداگانه نیست.
};