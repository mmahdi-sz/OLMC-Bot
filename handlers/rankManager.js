const luckpermsDb = require('../luckpermsDb.js');
const logger = require('../logger.js');
const { getText } = require('../i18n.js');

const MODULE_NAME = 'RANK_MANAGER';

const WIZARD_STEPS = {
    AWAITING_DISPLAY_NAME: 'awaiting_rank_display_name',
    AWAITING_GROUP_TEMPLATE: 'awaiting_rank_group_template',
    AWAITING_PLAYER_TEMPLATE: 'awaiting_rank_player_template',
    AWAITING_GROUP_SELECTION: 'awaiting_addtime_group_selection',
    AWAITING_TIME_ADJUSTMENT: 'awaiting_addtime_time_adjustment',
};

function escapeMarkdownV2(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

async function startRankManager(bot, msg, db, setupRankListCron) {
    const chatId = msg.chat.id;
    const topicId = msg.message_thread_id;
    const userId = msg.from?.id || msg.chat.id;
    const userLang = await db.getUserLanguage(userId) || 'fa';
    
    logger.info(MODULE_NAME, `Displaying main menu in chat ${chatId}`);

    try {
        const configuredGroups = await db.getRankGroups();
        let messageText = `${getText(userLang, 'rankManagerTitle')}\n\n`;

        if (configuredGroups.length > 0) {
            messageText += `${getText(userLang, 'rankManagerConfiguredGroups')}:\n\n`;
            configuredGroups.forEach((group, index) => {
                const displayName = escapeMarkdownV2(group.display_name);
                const groupName = escapeMarkdownV2(group.group_name);
                messageText += `${index + 1}\\. *${displayName}* \\(\`${groupName}\`\\)\n`;
            });
        } else {
            messageText += getText(userLang, 'rankManagerNoGroups');
        }

        const keyboard = {
            inline_keyboard: [
                [
                    { text: getText(userLang, 'btnRankMgrAddGroup'), callback_data: 'rankmgr_add_prompt' }, 
                    { text: getText(userLang, 'btnRankMgrDeleteGroup'), callback_data: 'rankmgr_delete_prompt' }
                ],
                [
                    { text: getText(userLang, 'btnRankMgrSort'), callback_data: 'rankmgr_sort_prompt' }, 
                    { text: getText(userLang, 'btnRankMgrAddTime'), callback_data: 'rankmgr_addtime_prompt' }
                ],
                [
                    { text: getText(userLang, 'btnRankMgrSettings'), callback_data: 'rankmgr_settings' }
                ],
                [
                    { text: getText(userLang, 'btnRankMgrExit'), callback_data: 'rankmgr_exit' }
                ]
            ]
        };

        const options = { chat_id: chatId, reply_markup: keyboard, parse_mode: 'MarkdownV2' };
        
        if (msg.message_id) {
            await bot.editMessageText(messageText, { ...options, message_id: msg.message_id }).catch(async (err) => {
                if (err.message.includes('message to edit not found') || err.message.includes('message can\'t be edited')) {
                    logger.warn(MODULE_NAME, 'Failed to edit message, sending a new one.', { reason: err.message });
                    await bot.sendMessage(chatId, messageText, { ...options, message_thread_id: topicId });
                } else if (!err.message.includes('message is not modified')) {
                    logger.error(MODULE_NAME, 'Error editing rank manager message', { error: err.message });
                }
            });
        } else {
            await bot.sendMessage(chatId, messageText, { ...options, message_thread_id: topicId });
        }
    } catch (error) {
        logger.error(MODULE_NAME, 'Error in startRankManager', { error: error.message, stack: error.stack });
    }
}

async function handleRankManagerCallback(bot, callbackQuery, db, setupRankListCron) {
    const action = callbackQuery.data;
    const userId = callbackQuery.from.id;
    logger.debug(MODULE_NAME, `Handling callback action`, { userId, action });
    
    try {
        if (action.startsWith('rankmgr_add_')) {
            await handleAddGroupWizard(bot, callbackQuery, db);
        } else if (action.startsWith('rankmgr_delete_')) {
            await handleDeleteGroup(bot, callbackQuery, db, setupRankListCron);
        } else if (action.startsWith('rankmgr_sort_')) {
            await handleSortOrderMenu(bot, callbackQuery, db);
        } else if (action.startsWith('rankmgr_addtime_')) {
            await handleAddTimeWizard(bot, callbackQuery, db, setupRankListCron);
        } else if (action.startsWith('rankmgr_settings') || action.startsWith('rank_interval_')) {
            await handleSettings(bot, callbackQuery, db, setupRankListCron);
        } else if (action === 'rankmgr_exit') {
            logger.info(MODULE_NAME, `User ${userId} exited the menu.`);
            await bot.answerCallbackQuery(callbackQuery.id);
            await bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id).catch(() => {});
        } else if (action === 'rankmgr_back_to_main') {
            logger.info(MODULE_NAME, `User ${userId} returned to the main menu.`);
            await db.deleteWizardState(userId);
            await startRankManager(bot, callbackQuery.message, db, setupRankListCron);
        } else {
            await bot.answerCallbackQuery(callbackQuery.id);
        }
    } catch (error) {
        if (error.message && error.message.includes('message is not modified')) {
            logger.warn(MODULE_NAME, 'Callback resulted in no message change.', { action });
            await bot.answerCallbackQuery(callbackQuery.id);
        } else {
            logger.error(MODULE_NAME, 'Error handling callback', { userId, action, error: error.message, stack: error.stack });
        }
    }
}

async function handleRankManagerWizard(bot, msg, db, setupRankListCron) {
    const userId = msg.from.id;
    const state = await db.getWizardState(userId);

    if (!state || !state.wizard_type.startsWith('rank_')) {
        return false;
    }
    
    logger.info(MODULE_NAME, `Processing wizard message for user ${userId}`, { wizard: state.wizard_type, step: state.step });

    try {
        if (state.wizard_type === 'rank_add_group') {
            await handleAddGroupWizardSteps(bot, msg, db, state, setupRankListCron);
        }
    } catch (error) {
        logger.error(MODULE_NAME, 'Error in wizard step processing', { userId, state, error: error.message, stack: error.stack });
    }
    
    return true;
}

async function handleAddGroupWizard(bot, callbackQuery, db) {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;
    const userLang = await db.getUserLanguage(userId) || 'fa';

    if (action === 'rankmgr_add_prompt') {
        logger.debug(MODULE_NAME, 'Add Group: Prompting for group selection', { userId });
        await bot.answerCallbackQuery(callbackQuery.id, { text: getText(userLang, 'gettingGroupList') });
        
        const allLPGroups = await luckpermsDb.getAllGroups();
        const configuredGroups = (await db.getRankGroups()).map(g => g.group_name);
        const availableGroups = allLPGroups.filter(g => !configuredGroups.includes(g));

        if (availableGroups.length === 0) {
            return bot.editMessageText(getText(userLang, 'errorAllGroupsAdded'), { 
                chat_id: msg.chat.id, 
                message_id: msg.message_id, 
                reply_markup: { inline_keyboard: [[{ text: '◀️ ' + getText(userLang, 'btnBack'), callback_data: 'rankmgr_back_to_main' }]] },
                parse_mode: 'MarkdownV2'
            });
        }

        const keyboardRows = availableGroups.reduce((acc, group, index) => {
            if (index % 2 === 0) acc.push([]);
            acc[acc.length - 1].push({ text: group, callback_data: `rankmgr_add_select_${group}` });
            return acc;
        }, []);
        keyboardRows.push([{ text: '◀️ ' + getText(userLang, 'btnBack'), callback_data: 'rankmgr_back_to_main' }]);
        await bot.editMessageText(getText(userLang, 'promptAddGroup'), { 
            chat_id: msg.chat.id, 
            message_id: msg.message_id, 
            reply_markup: { inline_keyboard: keyboardRows },
            parse_mode: 'MarkdownV2' 
        });

    } else if (action.startsWith('rankmgr_add_select_')) {
        const groupName = action.substring('rankmgr_add_select_'.length);
        logger.debug(MODULE_NAME, 'Add Group: Group selected, starting wizard', { userId, groupName });
        
        const wizardData = { groupName, topicId: msg.message_thread_id, lang: userLang };
        await db.setWizardState(userId, 'rank_add_group', WIZARD_STEPS.AWAITING_DISPLAY_NAME, wizardData);
        
        await bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});
        await bot.sendMessage(userId, getText(userLang, 'promptGroupDisplayName', groupName), { parse_mode: 'MarkdownV2' });
    }
}

async function handleAddGroupWizardSteps(bot, msg, db, state, setupRankListCron) {
    const userId = msg.from.id;
    const text = msg.text.trim();
    const { topicId, lang: userLang } = state.data;

    switch (state.step) {
        case WIZARD_STEPS.AWAITING_DISPLAY_NAME:
            state.data.displayName = text;
            logger.debug(MODULE_NAME, 'Add Group Wizard: Received display name', { userId, displayName: text });
            await db.setWizardState(userId, 'rank_add_group', WIZARD_STEPS.AWAITING_GROUP_TEMPLATE, state.data);
            await bot.sendMessage(userId, getText(userLang, 'promptGroupTemplate'), { parse_mode: 'MarkdownV2' });
            break;

        case WIZARD_STEPS.AWAITING_GROUP_TEMPLATE:
            state.data.groupTemplate = text;
            logger.debug(MODULE_NAME, 'Add Group Wizard: Received group template', { userId });
            await db.setWizardState(userId, 'rank_add_group', WIZARD_STEPS.AWAITING_PLAYER_TEMPLATE, state.data);
            await bot.sendMessage(userId, getText(userLang, 'promptPlayerTemplate'), { parse_mode: 'MarkdownV2' });
            break;

        case WIZARD_STEPS.AWAITING_PLAYER_TEMPLATE:
            const { groupName, displayName, groupTemplate } = state.data;
            logger.debug(MODULE_NAME, 'Add Group Wizard: Received player template, finalizing', { userId });
            try {
                await db.addRankGroup(groupName, displayName, groupTemplate, text);
                logger.success(MODULE_NAME, `Group '${groupName}' added successfully by user ${userId}.`);
                await bot.sendMessage(userId, getText(userLang, 'addGroupSuccess', displayName), { parse_mode: 'MarkdownV2' });
            } catch (error) {
                logger.error(MODULE_NAME, "Error adding rank group to DB", { error: error.message, stack: error.stack });
                await bot.sendMessage(userId, getText(userLang, 'errorAddGroupFailed'), { parse_mode: 'MarkdownV2' });
            } finally {
                await db.deleteWizardState(userId);
                const mockMsg = { chat: { id: userId }, message_thread_id: topicId, from: { id: userId } };
                await startRankManager(bot, mockMsg, db, setupRankListCron);
            }
            break;
    }
}

async function handleDeleteGroup(bot, callbackQuery, db, setupRankListCron) {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;
    const userLang = await db.getUserLanguage(userId) || 'fa';

    if (action === 'rankmgr_delete_prompt') {
        logger.debug(MODULE_NAME, 'Delete Group: Prompting for group selection', { userId });
        const configuredGroups = await db.getRankGroups();
        if (configuredGroups.length === 0) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: getText(userLang, 'errorNoGroupsToDelete'), show_alert: true });
        }
        const groupButtons = configuredGroups.map(group => ([{ text: `🗑️ ${group.display_name} (${group.group_name})`, callback_data: `rankmgr_delete_confirm_${group.group_name}` }]));
        groupButtons.push([{ text: '◀️ ' + getText(userLang, 'btnBack'), callback_data: 'rankmgr_back_to_main' }]);
        await bot.editMessageText(getText(userLang, 'promptDeleteGroup'), { 
            chat_id: msg.chat.id, 
            message_id: msg.message_id, 
            reply_markup: { inline_keyboard: groupButtons },
            parse_mode: 'MarkdownV2'
        });
    
    } else if (action.startsWith('rankmgr_delete_confirm_')) {
        const groupName = action.substring('rankmgr_delete_confirm_'.length);
        logger.info(MODULE_NAME, `User ${userId} confirmed deletion of group`, { groupName });
        await db.deleteRankGroup(groupName);
        logger.success(MODULE_NAME, `Group '${groupName}' deleted successfully.`);
        await bot.answerCallbackQuery(callbackQuery.id, { text: getText(userLang, 'deleteGroupSuccess', groupName) });
        await startRankManager(bot, msg, db, setupRankListCron);
    }
}

async function handleSortOrderMenu(bot, callbackQuery, db) {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;
    const userLang = await db.getUserLanguage(userId) || 'fa';

    if (action.startsWith('rankmgr_sort_move_')) {
        const parts = action.split('_');
        const direction = parts[3]; 
        const groupId = parseInt(parts[4], 10);

        if (!isNaN(groupId)) {
            logger.debug(MODULE_NAME, `Sort Group: Moving group`, { userId, groupId, direction });
            await db.updateRankGroupSortOrder(groupId, direction);
        } else {
            logger.warn(MODULE_NAME, 'Sort Group: Invalid groupId received in callback', { action });
        }
    }

    const groups = await db.getRankGroups();
    const keyboardRows = [];
    groups.forEach((group, index) => {
        const row = [];
        const displayName = escapeMarkdownV2(group.display_name);
        row.push({ text: `${index + 1}. ${displayName}`, callback_data: 'noop' });
        if (index > 0) row.push({ text: '🔼', callback_data: `rankmgr_sort_move_up_${group.id}` });
        if (index < groups.length - 1) row.push({ text: '🔽', callback_data: `rankmgr_sort_move_down_${group.id}` });
        keyboardRows.push(row);
    });
    keyboardRows.push([{ text: '💾 ' + getText(userLang, 'btnSaveChangesAndBack'), callback_data: 'rankmgr_back_to_main' }]);

    await bot.editMessageText(getText(userLang, 'promptSortGroups'), { 
        chat_id: msg.chat.id, 
        message_id: msg.message_id, 
        reply_markup: { inline_keyboard: keyboardRows },
        parse_mode: 'MarkdownV2'
    });
}

async function handleAddTimeWizard(bot, callbackQuery, db, setupRankListCron) {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;
    const userLang = await db.getUserLanguage(userId) || 'fa';
    
    let state = await db.getWizardState(userId);

    if (action === 'rankmgr_addtime_prompt') {
        logger.debug(MODULE_NAME, 'Add Time Wizard: Starting', { userId });
        await db.deleteWizardState(userId); // Clear state for fresh start
        
        const allGroups = await luckpermsDb.getAllGroups();
        const wizardData = { allGroups, selectedGroups: [], timeToAdd: { d: 0, h: 0, m: 0 }, lang: userLang };
        await db.setWizardState(userId, 'rank_add_time', WIZARD_STEPS.AWAITING_GROUP_SELECTION, wizardData);
        
        const keyboard = buildGroupSelectionKeyboard(allGroups, [], userLang);
        await bot.editMessageText(getText(userLang, 'promptAddTimeSelectGroups'), { 
            chat_id: msg.chat.id, 
            message_id: msg.message_id, 
            reply_markup: keyboard,
            parse_mode: 'MarkdownV2' 
        });
        return;
    }
    
    if (!state || state.wizard_type !== 'rank_add_time') return;

    if (action.startsWith('rankmgr_addtime_toggle_')) {
        const groupName = action.substring('rankmgr_addtime_toggle_'.length);
        const index = state.data.selectedGroups.indexOf(groupName);
        if (index > -1) state.data.selectedGroups.splice(index, 1);
        else state.data.selectedGroups.push(groupName);
        
        logger.debug(MODULE_NAME, 'Add Time Wizard: Toggled group', { userId, groupName, selected: state.data.selectedGroups });
        await db.setWizardState(userId, 'rank_add_time', state.step, state.data);
        const keyboard = buildGroupSelectionKeyboard(state.data.allGroups, state.data.selectedGroups, userLang);
        await bot.editMessageReplyMarkup(keyboard, { chat_id: msg.chat.id, message_id: msg.message_id }).catch(err => {
             if (!err.message.includes('message is not modified')) {
                logger.error(MODULE_NAME, 'Failed to update keyboard', { error: err.message });
            }
        });

    } else if (action === 'rankmgr_addtime_confirm_groups') {
        if (state.data.selectedGroups.length === 0) return bot.answerCallbackQuery(callbackQuery.id, { text: getText(userLang, 'errorSelectAtLeastOneGroup'), show_alert: true });
        
        logger.debug(MODULE_NAME, 'Add Time Wizard: Confirmed groups, proceeding to time selection', { userId, groups: state.data.selectedGroups });
        await db.setWizardState(userId, 'rank_add_time', WIZARD_STEPS.AWAITING_TIME_ADJUSTMENT, state.data);
        const keyboard = buildTimeAdjustmentKeyboard(state.data.timeToAdd, userLang);
        await bot.editMessageText(getText(userLang, 'promptAddTimeAmount', state.data.selectedGroups.join(', ')), { 
            chat_id: msg.chat.id, 
            message_id: msg.message_id, 
            reply_markup: keyboard, 
            parse_mode: 'MarkdownV2' 
        });

    } else if (action.startsWith('rankmgr_addtime_adjust_')) {
        const [, , unit, amountStr] = action.split('_');
        const amount = parseInt(amountStr, 10);
        state.data.timeToAdd[unit] += amount;
        normalizeTime(state.data.timeToAdd);

        logger.debug(MODULE_NAME, 'Add Time Wizard: Adjusted time', { userId, adjustment: { unit, amount }, newTime: state.data.timeToAdd });
        await db.setWizardState(userId, 'rank_add_time', state.step, state.data);
        const keyboard = buildTimeAdjustmentKeyboard(state.data.timeToAdd, userLang);
        await bot.editMessageReplyMarkup(keyboard, { chat_id: msg.chat.id, message_id: msg.message_id }).catch(err => {
            if (!err.message.includes('message is not modified')) {
                logger.error(MODULE_NAME, 'Failed to update time display', { error: err.message });
            }
        });

    } else if (action === 'rankmgr_addtime_execute') {
        const { d, h, m } = state.data.timeToAdd;
        const totalSeconds = (d * 86400) + (h * 3600) + (m * 60);

        if (totalSeconds <= 0) return bot.answerCallbackQuery(callbackQuery.id, { text: getText(userLang, 'errorSelectTimeAmount'), show_alert: true });

        logger.info(MODULE_NAME, `Add Time Wizard: Executing time addition`, { userId, groups: state.data.selectedGroups, totalSeconds });
        
        const progressMsg = await bot.editMessageText(
            getText(userLang, 'addingTimeInProgress'), 
            { chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'MarkdownV2' }
        ).catch(() => null);
        
        let successCount = 0, errorCount = 0;
        const totalGroups = state.data.selectedGroups.length;
        
        for (let i = 0; i < state.data.selectedGroups.length; i++) {
            const groupName = state.data.selectedGroups[i];
            
            if (progressMsg && i % 2 === 0) {
                const progress = Math.floor(((i + 1) / totalGroups) * 100);
                await bot.editMessageText(
                    `⏳ *در حال افزایش زمان\\.\\.\\.*\n\n━━━━━━━━━━━━━━━━\n\n📊 پیشرفت: ${progress}% \\(${i + 1}/${totalGroups}\\)\n🔄 در حال پردازش گروه: \`${groupName}\``,
                    { chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'MarkdownV2' }
                ).catch(() => {});
            }
            
            try {
                await luckpermsDb.addTimeToTemporaryMembers(groupName, totalSeconds);
                successCount++;
            } catch (err) {
                logger.error(MODULE_NAME, `Add Time Wizard: Failed to add time to group`, { groupName, error: err.message });
                errorCount++;
            }
        }
        
        logger.success(MODULE_NAME, `Add Time Wizard: Execution finished`, { userId, successCount, errorCount });
        await db.deleteWizardState(userId);
        
        const resultMessage = getText(userLang, 'addTimeSuccess', successCount, errorCount);
        
        await bot.sendMessage(msg.chat.id, resultMessage, { 
            message_thread_id: msg.message_thread_id,
            parse_mode: 'MarkdownV2'
        }).catch(err => logger.error(MODULE_NAME, 'Failed to send result', { error: err.message }));
        
        const mockMsg = { chat: { id: msg.chat.id }, message_thread_id: msg.message_thread_id, from: { id: userId }, message_id: msg.message_id };
        await startRankManager(bot, mockMsg, db, setupRankListCron);
    }
}

async function handleSettings(bot, callbackQuery, db, setupRankListCron) {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;
    const userLang = await db.getUserLanguage(userId) || 'fa';

    if (action === 'rankmgr_settings') {
        logger.debug(MODULE_NAME, 'Settings: Opening interval settings', { userId });
        const currentInterval = await db.getSetting('rank_list_interval_minutes') || 0;
        const keyboard = { inline_keyboard: [
            [{ text: getText(userLang, 'settingCurrentInterval', currentInterval), callback_data: 'noop' }],
            [{ text: '-10', callback_data: 'rank_interval_sub_10' }, { text: '-1', callback_data: 'rank_interval_sub_1' }, { text: '+1', callback_data: 'rank_interval_add_1' }, { text: '+10', callback_data: 'rank_interval_add_10' }],
            [{ text: '-60 (1h)', callback_data: 'rank_interval_sub_60' }, { text: '+60 (1h)', callback_data: 'rank_interval_add_60' }],
            [{ text: '💾 ' + getText(userLang, 'btnSaveChangesAndBack'), callback_data: 'rank_interval_save' }],
            [{ text: '◀️ ' + getText(userLang, 'btnBack'), callback_data: 'rankmgr_back_to_main' }]
        ]};
        await bot.editMessageText(getText(userLang, 'promptSetInterval'), { 
            chat_id: msg.chat.id, 
            message_id: msg.message_id, 
            reply_markup: keyboard,
            parse_mode: 'MarkdownV2'
        });
        return;
    }

    if (action.startsWith('rank_interval_')) {
        const currentText = msg.reply_markup.inline_keyboard[0][0].text;
        let currentInterval = parseInt(currentText.match(/(\d+)/)[0], 10);

        if (action === 'rank_interval_save') {
            logger.info(MODULE_NAME, `Settings: Saving rank list interval`, { userId, interval: currentInterval });
            await db.setSetting('rank_list_interval_minutes', currentInterval);
            
            if (setupRankListCron) {
                await setupRankListCron();
                await bot.answerCallbackQuery(callbackQuery.id, { text: getText(userLang, 'settingsSavedAndApplied') });
            } else {
                await bot.answerCallbackQuery(callbackQuery.id, { text: getText(userLang, 'settingsSavedRestartNeeded') });
            }
            
            await startRankManager(bot, msg, db, setupRankListCron);
        } else {
            const operation = action.includes('_add_') ? 'add' : 'sub';
            const value = parseInt(action.match(/\d+$/)[0], 10);
            currentInterval += (operation === 'add' ? value : -value);
            if (currentInterval < 0) currentInterval = 0;
            
            logger.debug(MODULE_NAME, 'Settings: Adjusting interval', { userId, newInterval: currentInterval });
            const newKeyboard = JSON.parse(JSON.stringify(msg.reply_markup));
            newKeyboard.inline_keyboard[0][0].text = getText(userLang, 'settingCurrentInterval', currentInterval);
            await bot.editMessageReplyMarkup(newKeyboard, { chat_id: msg.chat.id, message_id: msg.message_id });
        }
    }
}

function buildGroupSelectionKeyboard(allGroups, selectedGroups, userLang) {
    const keyboardRows = allGroups.reduce((acc, group, index) => {
        const isSelected = selectedGroups.includes(group);
        const button = { text: `${isSelected ? '✅' : '❌'} ${group}`, callback_data: `rankmgr_addtime_toggle_${group}` };
        if (index % 2 === 0) acc.push([button]);
        else acc[acc.length - 1].push(button);
        return acc;
    }, []);
    keyboardRows.push([
        { text: '◀️ ' + getText(userLang, 'btnBack'), callback_data: 'rankmgr_back_to_main' },
        { text: getText(userLang, 'btnNext'), callback_data: 'rankmgr_addtime_confirm_groups' }
    ]);
    return { inline_keyboard: keyboardRows };
}

function buildTimeAdjustmentKeyboard(time, userLang) {
    const { d, h, m } = time;
    return { inline_keyboard: [
        [{ text: getText(userLang, 'timeAdjustmentDisplay', d, h, m), callback_data: 'noop' }],
        [{ text: getText(userLang, 'btnSub5Min'), callback_data: 'rankmgr_addtime_adjust_m_-5' }, { text: getText(userLang, 'btnAdd5Min'), callback_data: 'rankmgr_addtime_adjust_m_5' }],
        [{ text: getText(userLang, 'btnSub1Hour'), callback_data: 'rankmgr_addtime_adjust_h_-1' }, { text: getText(userLang, 'btnAdd1Hour'), callback_data: 'rankmgr_addtime_adjust_h_1' }],
        [{ text: getText(userLang, 'btnSub1Day'), callback_data: 'rankmgr_addtime_adjust_d_-1' }, { text: getText(userLang, 'btnAdd1Day'), callback_data: 'rankmgr_addtime_adjust_d_1' }],
        [{ text: '◀️ ' + getText(userLang, 'btnBack'), callback_data: 'rankmgr_addtime_prompt' }, { text: getText(userLang, 'btnConfirm'), callback_data: 'rankmgr_addtime_execute' }]
    ]};
}

function normalizeTime(time) {
    let totalMinutes = (time.d * 1440) + (time.h * 60) + time.m;
    if (totalMinutes < 0) totalMinutes = 0;
    time.d = Math.floor(totalMinutes / 1440);
    const remMins = totalMinutes % 1440;
    time.h = Math.floor(remMins / 60);
    time.m = remMins % 60;
}

module.exports = {
    startRankManager,
    handleRankManagerCallback,
    handleRankManagerWizard
};