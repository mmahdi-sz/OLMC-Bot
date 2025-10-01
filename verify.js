// verify.js
const db = require('./database');
const { getText } = require('./i18n');
const logger = require('./logger');

const MODULE_NAME = 'VERIFY_HANDLER';

/**
 * Generates a random 6-digit verification code.
 * @returns {string} The generated code.
 */
function generateRandomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Handles the logic when a user starts the verification process from the bot.
 * (Bot -> Game flow)
 * @param {number} userId - The Telegram user ID of the requester.
 * @param {string} userLang - The user's preferred language code.
 * @returns {Promise<{message: string, keyboard: object}>} An object containing the message and keyboard to be sent.
 */
async function handleStartVerificationFromBot(userId, userLang) {
    logger.info(MODULE_NAME, `Starting verification from bot for user ${userId}`);
    const code = generateRandomCode();
    await db.createVerificationCodeForUser(userId, code);

    const registration = await db.getRegistrationByTelegramId(userId);
    const username = registration.game_username;

    const message = getText(userLang, 'verifyInstructionsBotToGame', username, code);
    const keyboard = { inline_keyboard: [[{ text: getText(userLang, 'btnBackToVerifyMenu'), callback_data: 'start_verification' }]] };
    
    return { message, keyboard };
}

/**
 * Handles the submission of a verification code received from the bot.
 * (Game -> Bot flow)
 * @param {number} userId - The Telegram user ID submitting the code.
 * @param {string} code - The 6-digit code submitted by the user.
 * @param {string} userLang - The user's preferred language code.
 * @returns {Promise<{success: boolean, message: string}>} An object indicating the result of the verification.
 */
async function handleCodeSubmission(userId, code, userLang) {
    logger.info(MODULE_NAME, `User ${userId} submitted verification code ${code}`);
    const gameUsername = await db.findUsernameByCode(code);

    if (!gameUsername) {
        logger.warn(MODULE_NAME, `Invalid or expired code '${code}' submitted by user ${userId}.`);
        return { success: false, message: getText(userLang, 'verificationFailedInvalidCode') };
    }

    const registration = await db.getRegistrationByTelegramId(userId);
    if (!registration) {
        // This case is unlikely if they are in the bot, but good to have a check.
        return { success: false, message: getText(userLang, 'verificationFailedError') };
    }
    
    if (registration.game_username.toLowerCase() !== gameUsername.toLowerCase()) {
        logger.warn(MODULE_NAME, `Verification failed for user ${userId}. Code belongs to '${gameUsername}', but user is registered as '${registration.game_username}'.`);
        return { success: false, message: getText(userLang, 'verificationFailedMismatch') };
    }
    
    const success = await db.verifyUser(userId, gameUsername);
    if (success) {
        await db.deleteVerificationCode(code);
        logger.success(MODULE_NAME, `User ${userId} successfully verified and linked with Minecraft account '${gameUsername}'.`);
        return { success: true, message: getText(userLang, 'verificationSuccess', gameUsername) };
    } else {
        logger.error(MODULE_NAME, `Database update failed during verification for user ${userId} and username '${gameUsername}'.`);
        return { success: false, message: getText(userLang, 'verificationFailedError') };
    }
}

/**
 * Handles the logic when a user starts the verification process from the game.
 * (Game -> Bot flow, initiated by logReader)
 * @param {string} username - The Minecraft username of the player.
 * @param {function} getRconClient - A function to get the active RCON client.
 * @param {object} bot - The Telegram bot instance.
 */
async function handleStartVerificationFromGame(username, getRconClient, bot) {
    const rcon = getRconClient();
    if (!rcon) {
        logger.warn(MODULE_NAME, `RCON client is not available. Cannot process verification request for ${username}.`);
        return;
    }

    logger.info(MODULE_NAME, `Starting verification from game for player ${username}`);
    // --- بخش بهبود یافته: استفاده از تابع جدید برای گرفتن اطلاعات کامل کاربر ---
    const registration = await db.getRegistrationByUsername(username);

    if (!registration) {
        // بخش اصلاح شده: استفاده از 'minecraft:tell'
        const errorMsg = `minecraft:tell ${username} شما ابتدا باید در ربات تلگرام ثبت نام کنید.`;
        try {
            const response = await rcon.send(errorMsg);
            logger.info(MODULE_NAME, "RCON response for 'not registered' message:", { response });
        } catch (e) {
            logger.error(MODULE_NAME, "Failed to send 'not registered' message via RCON.", { error: e.message });
        }
        return;
    }

    const code = generateRandomCode();
    await db.createVerificationCodeForGameUser(username, code);

    // بخش اصلاح شده: استفاده از 'minecraft:tell'
    const successMsg = `minecraft:tell ${username} کد تایید شما: ${code} - این کد را در ربات تلگرام ارسال کنید.`;
    try {
        const response = await rcon.send(successMsg);
        logger.success(MODULE_NAME, `Successfully sent verification code ${code} to player ${username} via RCON.`);
        logger.info(MODULE_NAME, "RCON response for success message:", { response });

        // --- بخش اصلی بهبود: ارسال پیام یادآوری در تلگرام ---
        try {
            if (bot && registration.telegram_user_id) {
                const userId = registration.telegram_user_id;
                const userLang = await db.getUserLanguage(userId);
                // متن پیام جدید را از i18n درخواست می‌کنیم
                const promptMessage = getText(userLang, 'promptEnterCodeFromGame');
                
                // ارسال پیام به چت خصوصی کاربر
                await bot.sendMessage(userId, promptMessage);
                logger.info(MODULE_NAME, `Sent a verification prompt to user ${userId} on Telegram.`);
            }
        } catch (telegramError) {
            logger.error(MODULE_NAME, 'Failed to send prompt message to user on Telegram.', { error: telegramError.message });
        }
        // --- پایان بخش بهبود ---

    } catch (e) {
        logger.error(MODULE_NAME, "Failed to send verification code via RCON.", { error: e.message });
    }
}


module.exports = {
    handleStartVerificationFromBot,
    handleCodeSubmission,
    handleStartVerificationFromGame,
};