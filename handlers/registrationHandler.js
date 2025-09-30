// handlers/registrationHandler.js

const crypto = require('crypto');
const logger = require('../logger.js');
const { getText } = require('../i18n.js');

const MODULE_NAME = 'REGISTRATION_HANDLER';

const WIZARD_STEPS = {
    AWAITING_EDITION: 'awaiting_edition',
    AWAITING_USERNAME: 'awaiting_username',
    AWAITING_AGE: 'awaiting_age',
};

const MINECRAFT_USERNAME_REGEX = /^[a-zA-Z0-9_]{3,16}$/;
// <<<< CHANGE START >>>>
// متغیر ثابت حذف شد. این مقدار از appConfig خوانده خواهد شد.
// const SUPPORT_ADMIN_USERNAME = process.env.SUPPORT_ADMIN_USERNAME || 'otherland_admin';
// <<<< CHANGE END >>>>

/**
 * نقطه شروع برای فرآیند ثبت‌نام کاربر.
 */
async function startRegistration(bot, msg, referrerId = null, db) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userLang = await db.getUserLanguage(userId) || 'fa';

    logger.info(MODULE_NAME, `Starting registration process for user ${userId}`, { referrerId: referrerId || 'none', lang: userLang });

    const wizardData = { referrerId: referrerId || null, lang: userLang };
    await db.setWizardState(userId, 'registration', WIZARD_STEPS.AWAITING_EDITION, wizardData);

    const message = getText(userLang, 'registrationWelcome');
    const keyboard = {
        inline_keyboard: [
            [{ text: getText(userLang, 'btnStartRegistration'), callback_data: 'register_start' }]
        ]
    };
    await bot.sendMessage(chatId, message, { reply_markup: keyboard });
}

/**
 * مدیریت کلیک روی دکمه‌های شیشه‌ای در فرآیند ثبت‌نام.
 */
async function handleRegistrationCallback(bot, callbackQuery, db) {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id;
    const userLang = await db.getUserLanguage(userId) || 'fa';

    try {
        await bot.answerCallbackQuery(callbackQuery.id);
        const userState = await db.getWizardState(userId);

        if (userState && !userState.data.lang) {
            userState.data.lang = userLang;
        }

        switch (action) {
            case 'register_start':
                logger.debug(MODULE_NAME, `User ${userId} clicked 'register_start'`);
                if (!userState || userState.wizard_type !== 'registration') {
                    logger.warn(MODULE_NAME, `User ${userId} had no state, creating a new one.`);
                    await db.setWizardState(userId, 'registration', WIZARD_STEPS.AWAITING_EDITION, { lang: userLang });
                }
                
                await bot.editMessageText(getText(userLang, 'promptEdition'), {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: getText(userLang, 'btnJavaEdition'), callback_data: 'register_edition_java' }],
                            [{ text: getText(userLang, 'btnBedrockEdition'), callback_data: 'register_edition_bedrock' }]
                        ]
                    }
                });
                break;

            case 'register_edition_java':
            case 'register_edition_bedrock':
                if (!userState || userState.step !== WIZARD_STEPS.AWAITING_EDITION) return;
                
                const edition = (action === 'register_edition_java') ? 'java' : 'bedrock';
                userState.data.edition = edition;
                logger.debug(MODULE_NAME, `User ${userId} selected edition`, { edition });
                await db.setWizardState(userId, 'registration', WIZARD_STEPS.AWAITING_USERNAME, userState.data);

                await bot.editMessageText(getText(userLang, 'promptUsername'), {
                    chat_id: chatId,
                    message_id: msg.message_id
                });
                break;
        }
    } catch (error) {
        if (!error.message.includes('message is not modified')) {
            logger.error(MODULE_NAME, `Error in registration callback for user ${userId}`, { action, error: error.message, stack: error.stack });
        }
    }
}

/**
 * مدیریت پیام‌های متنی کاربر در طول ویزارد ثبت‌نام.
 */
// <<<< CHANGE START >>>>
// پارامتر appConfig برای دسترسی به تنظیمات سراسری اضافه شد
async function handleRegistrationWizard(bot, msg, db, appConfig) { 
// <<<< CHANGE END >>>>
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const text = msg.text || '';

    const state = await db.getWizardState(userId);
    if (!state || state.wizard_type !== 'registration') {
        return false;
    }
    
    const userLang = state.data.lang || 'fa';

    switch (state.step) {
        case WIZARD_STEPS.AWAITING_USERNAME:
            const username = text.trim();
            if (!MINECRAFT_USERNAME_REGEX.test(username)) {
                logger.warn(MODULE_NAME, `User ${userId} provided invalid username`, { username });
                await bot.sendMessage(chatId, getText(userLang, 'errorInvalidUsername'));
                return true;
            }

            const isTaken = await db.isUsernameTaken(username);
            if (isTaken) {
                logger.warn(MODULE_NAME, `User ${userId} tried to register with a taken username`, { username });
                // <<<< CHANGE START >>>>
                // استفاده از appConfig برای دریافت نام کاربری ادمین
                await bot.sendMessage(chatId, getText(userLang, 'errorUsernameTaken', appConfig.supportAdminUsername));
                // <<<< CHANGE END >>>>
                return true;
            }

            state.data.username = username;
            logger.debug(MODULE_NAME, `User ${userId} provided username`, { username });
            await db.setWizardState(userId, 'registration', WIZARD_STEPS.AWAITING_AGE, state.data);
            
            await bot.sendMessage(chatId, getText(userLang, 'promptAge', username), { parse_mode: 'Markdown' });
            break;

        case WIZARD_STEPS.AWAITING_AGE:
            const ageText = text.trim().replace(/[\u0660-\u0669]/g, c => c.charCodeAt(0) - 0x0660);
            const age = parseInt(ageText, 10);

            if (isNaN(age) || age < 10 || age > 70) {
                logger.warn(MODULE_NAME, `User ${userId} provided invalid age`, { ageText });
                await bot.sendMessage(chatId, getText(userLang, 'errorInvalidAge'));
                return true;
            }

            state.data.age = age;
            logger.debug(MODULE_NAME, `User ${userId} provided age`, { age });
            
            try {
                const uuid = crypto.randomBytes(8).toString('hex').toUpperCase();
                let finalUsername = state.data.username;

                if (state.data.edition === 'bedrock') {
                    finalUsername = finalUsername.replace(/\s/g, '_');
                    if (!finalUsername.startsWith('_')) {
                         finalUsername = `_${finalUsername}`;
                    }
                }
                
                const registrationData = {
                    telegram_user_id: userId,
                    game_edition: state.data.edition,
                    game_username: finalUsername,
                    age: state.data.age,
                    uuid: uuid,
                    referrer_telegram_id: state.data.referrerId || null
                };
                
                // زبان کاربر دیگر در این جدول ذخیره نمی‌شود و به جدول user_settings منتقل شده است
                // language_code: userLang

                await db.addRegistration(registrationData);
                logger.success(MODULE_NAME, `User ${userId} successfully registered`, { data: registrationData });

                // <<<< CHANGE START >>>>
                // --- منطق جدید برای ارسال دکمه شیشه‌ای ---

                // 1. ساخت لینک هوشمند با استفاده از نام کاربری یوزربات از appConfig
                const finalizationUrl = `https://t.me/${appConfig.supportBotUsername}?text=${uuid}`;

                // 2. ساخت دکمه شیشه‌ای با متنی که از i18n خوانده می‌شود
                const keyboard = {
                    inline_keyboard: [
                        [
                            { 
                                text: getText(userLang, 'btnFinalizeRegistration'), 
                                url: finalizationUrl 
                            }
                        ]
                    ]
                };

                // 3. دریافت پیام راهنمای جدید از i18n
                const finalMessage = getText(userLang, 'registrationSuccess');
                
                // 4. ارسال پیام نهایی به همراه دکمه
                await bot.sendMessage(chatId, finalMessage, { 
                    reply_markup: keyboard,
                    parse_mode: 'Markdown' // یا MarkdownV2 بسته به نیاز متن
                });

                // --- کد قدیمی حذف شد ---
                // const finalMessage = getText(userLang, 'registrationSuccess', appConfig.supportAdminUsername);
                // await bot.sendMessage(chatId, finalMessage, { parse_mode: 'MarkdownV2' });
                // await bot.sendMessage(chatId, `\`${uuid}\``, { parse_mode: 'Markdown' });

                // <<<< CHANGE END >>>>

            } catch (error) {
                logger.error(MODULE_NAME, `DATABASE ERROR during registration for user ${userId}`, { 
                    errorMessage: error.message, 
                    errorCode: error.code,
                    stack: error.stack 
                });
                await bot.sendMessage(chatId, getText(userLang, 'errorRegistrationFailed'));
            } finally {
                await db.deleteWizardState(userId);
                logger.debug(MODULE_NAME, `Wizard state for user ${userId} has been cleared.`);
            }
            break;
    }
    return true;
}

/**
 * مدیریت دستور حذف یک درخواست ثبت‌نام توسط سوپر ادمین.
 */
async function handleDeleteRegistration(bot, msg, db, superAdminId) {
    const requesterId = msg.from.id;
    if (requesterId !== superAdminId) return;

    const userLang = await db.getUserLanguage(requesterId) || 'fa';

    const parts = msg.text.split(' ');
    if (parts.length < 2) {
        return bot.sendMessage(requesterId, getText(userLang, 'usageDelCommand'));
    }
    const uuid = parts[1].trim();
    logger.info(MODULE_NAME, `SuperAdmin ${requesterId} is attempting to delete registration`, { uuid });

    try {
        const result = await db.deleteRegistration(uuid);
        if (result > 0) {
            logger.success(MODULE_NAME, `Registration with UUID ${uuid} deleted successfully.`);
            await bot.sendMessage(requesterId, getText(userLang, 'delSuccess', uuid), { parse_mode: 'Markdown' });
        } else {
            logger.warn(MODULE_NAME, `Registration with UUID ${uuid} not found for deletion.`);
            await bot.sendMessage(requesterId, getText(userLang, 'delNotFound', uuid), { parse_mode: 'Markdown' });
        }
    } catch (error) {
        logger.error(MODULE_NAME, `Error deleting registration with UUID ${uuid}`, { error: error.message, stack: error.stack });
        await bot.sendMessage(requesterId, getText(userLang, 'delError'));
    }
}

module.exports = {
    startRegistration,
    handleRegistrationCallback,
    handleRegistrationWizard,
    handleDeleteRegistration
};