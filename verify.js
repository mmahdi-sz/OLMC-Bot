const db = require('./database');
const { getText } = require('./i18n');
const logger = require('./logger');

const MODULE_NAME = 'VERIFY_HANDLER';

function generateRandomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function handleStartVerificationFromBot(userId, userLang) {
    logger.info(MODULE_NAME, `Starting verification from bot for user ${userId}`);
    const code = generateRandomCode();
    await db.createVerificationCodeForUser(userId, code);

    const registration = await db.getRegistrationByTelegramId(userId);
    const username = registration.game_username;

    const message = getText(userLang, 'verifyInstructionsBotToGame', username, code);
    
    const keyboard = { 
        inline_keyboard: [
            [{ 
                text: getText(userLang, 'btnRefreshCode'), 
                callback_data: 'verify_refresh_code' 
            }],
            [{ 
                text: getText(userLang, 'btnBackToVerifyMenu'), 
                callback_data: 'start_verification' 
            }]
        ] 
    };
    
    return { message, keyboard };
}

async function handleCodeSubmission(userId, code, userLang) {
    logger.info(MODULE_NAME, `User ${userId} submitted verification code ${code}`);
    const gameUsername = await db.findUsernameByCode(code);

    if (!gameUsername) {
        logger.warn(MODULE_NAME, `Invalid or expired code '${code}' submitted by user ${userId}.`);
        return { success: false, message: getText(userLang, 'verificationFailedInvalidCode') };
    }

    const registration = await db.getRegistrationByTelegramId(userId);
    if (!registration) {
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

async function handleStartVerificationFromGame(username, getRconClient, bot) {
    const rcon = getRconClient();
    if (!rcon) {
        logger.warn(MODULE_NAME, `RCON client is not available. Cannot process verification request for ${username}.`);
        return;
    }

    logger.info(MODULE_NAME, `Starting verification from game for player ${username}`);
    const registration = await db.getRegistrationByUsername(username);

    if (!registration) {
        const errorMsg = `minecraft:tell ${username} شما ابتدا باید در ربات تلگرام ثبت نام کنید.`;
        try {
            await rcon.send(errorMsg);
        } catch (e) {
            logger.error(MODULE_NAME, "Failed to send 'not registered' message via RCON.", { error: e.message });
        }
        return;
    }

    const code = generateRandomCode();
    await db.createVerificationCodeForGameUser(username, code);

    const successMsg = `minecraft:tell ${username} کد تایید شما: ${code} - این کد را در ربات تلگرام ارسال کنید.`;
    try {
        await rcon.send(successMsg);
        logger.success(MODULE_NAME, `Successfully sent verification code ${code} to player ${username} via RCON.`);

        try {
            if (bot.notificationManager && registration.telegram_user_id) {
                const userId = registration.telegram_user_id;
                const userLang = await db.getUserLanguage(userId);
                const promptMessage = getText(userLang, 'promptEnterCodeFromGame');
                
                await bot.notificationManager.sendNotification(userId, promptMessage);
                logger.info(MODULE_NAME, `Sent a verification prompt to user ${userId} on Telegram.`);
            }
        } catch (telegramError) {
            logger.error(MODULE_NAME, 'Failed to send prompt message to user on Telegram.', { error: telegramError.message });
        }

    } catch (e) {
        logger.error(MODULE_NAME, "Failed to send verification code via RCON.", { error: e.message });
    }
}

async function handleVerifyFromGame(username, code, getRconClient) {
    const rcon = getRconClient();
    if (!rcon) {
        logger.warn(MODULE_NAME, `RCON client is not available. Cannot process verification for ${username}.`);
        return;
    }

    try {
        const registration = await db.getRegistrationByUsername(username);
        if (!registration) {
            await rcon.send(`minecraft:tell ${username} خطای داخلی: اطلاعات ثبت‌نام شما یافت نشد.`);
            return;
        }

        const userId = registration.telegram_user_id;
        const codeOwnerUserId = await db.findTelegramIdByCode(code);
        
        if (!codeOwnerUserId) {
            logger.warn(MODULE_NAME, `Player ${username} submitted an invalid or expired code ${code} in-game.`);
            await rcon.send(`minecraft:tell ${username} کد وارد شده نامعتبر یا منقضی شده است.`);
            return;
        }

        if (userId !== codeOwnerUserId) {
            logger.warn(MODULE_NAME, `Security Alert: Player ${username} tried to use a code belonging to another user.`);
            await rcon.send(`minecraft:tell ${username} این کد متعلق به شما نیست.`);
            return;
        }

        const success = await db.verifyUser(userId, username);
        if (success) {
            await db.deleteVerificationCode(code);
            logger.success(MODULE_NAME, `Player ${username} (TG: ${userId}) successfully verified from in-game command.`);
            await rcon.send(`minecraft:tell ${username} حساب شما با موفقیت به تلگرام متصل شد!`);
        } else {
            throw new Error('Database update failed.');
        }

    } catch (error) {
        logger.error(MODULE_NAME, 'An error occurred during in-game verification.', { username, code, error: error.message });
        await rcon.send(`minecraft:tell ${username} یک خطای پیش‌بینی نشده رخ داد. لطفا با ادمین تماس بگیرید.`);
    }
}

module.exports = {
    handleStartVerificationFromBot,
    handleCodeSubmission,
    handleStartVerificationFromGame,
    handleVerifyFromGame,
};