const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const db = require('../database');

const commands = new Map();

/**
 * Loads all command handlers from the /commands directory.
 */
function loadCommands(bot, appConfig) {
    const commandsPath = path.join(__dirname, '../commands');
    
    try {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                const commandList = require(filePath);

                if (Array.isArray(commandList)) {
                    for (const command of commandList) {
                        if (command.name && command.execute && command.regex) {
                            commands.set(command.name, command.execute);
                            bot.onText(command.regex, (msg, match) => {
                                // پاس دادن یک کانتکست مشترک (db, appConfig) به تمام دستورات
                                command.execute(bot, msg, match, appConfig, db);
                            });
                            logger.info('CMD_LOADER', `Loaded command: ${command.name}`);
                        } else {
                            logger.warn('CMD_LOADER', `Skipping invalid command object in file: ${file}`);
                        }
                    }
                }
            } catch (error) {
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
        const validModules = ['chat', 'players', 'rank', 'status', 'online', 'auction'];
        
        const config = {
            superAdminId: parseInt(process.env.SUPER_ADMIN_ID, 10),
            supportAdminUsername: process.env.SUPPORT_ADMIN_USERNAME || 'otherland_admin',
            mainBotUsername: process.env.MAIN_BOT_USERNAME || 'OLMCrobot',
            // <<<< CHANGE START >>>>
            // متغیر جدید برای نام کاربری یوزربات پشتیبانی اضافه شد
            supportBotUsername: process.env.SUPPORT_BOT_USERNAME || 'YourSupportBotUsername',
            // <<<< CHANGE END >>>>
            mainGroupId: null,
            topicIds: {},
            validModules: validModules,
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

        // <<<< CHANGE START >>>>
        // یک لاگ هشدار اضافه شد تا به کاربر اطلاع دهد که باید نام کاربری یوزربات را تنظیم کند
        if (config.supportBotUsername === 'YourSupportBotUsername') {
            logger.warn('APP_CONFIG', 'SUPPORT_BOT_USERNAME is not set in the .env file. The registration finalization button may not work correctly.');
        }
        // <<<< CHANGE END >>>>

        if (!config.superAdminId) {
             logger.error('APP_CONFIG', "FATAL: SUPER_ADMIN_ID is not set in the .env file.");
             process.exit(1);
        }
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
};