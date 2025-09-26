// utils/botUtils.js

const logger = require('../logger');
const db = require('../database');
const luckpermsDb = require('../luckpermsDb');
const { formatDuration, escapeMarkdown } = require('./formatters');

async function sendRankList(bot, db) {
    logger.info('RANK_LIST', 'Attempting to generate and send new rank list...');
    try {
        const mainGroupId = await db.getSetting('main_group_id');
        const rankTopicId = await db.getSetting('topic_id_rank');

        if (!mainGroupId || !rankTopicId) {
            return logger.info('RANK_LIST', 'Rank list module is not configured or enabled.');
        }

        const configuredGroups = await db.getRankGroups();
        if (configuredGroups.length === 0) {
            return logger.info('RANK_LIST', 'No groups configured for rank list.');
        }
        
        const configuredGroupNames = configuredGroups.map(g => g.group_name);
        const allMembers = await luckpermsDb.getAllConfiguredGroupMembers(configuredGroupNames);

        // Step 1: Group all permissions by player username.
        const players = {};
        for (const member of allMembers) {
            if (!players[member.username]) {
                players[member.username] = { username: member.username, groups: [] };
            }
            players[member.username].groups.push({ name: member.group, expiry: member.expiry });
        }

        // <<<< CHANGE START >>>> (Problems 5 & 6: Flawed Logic)
        // This entire block is the new, refactored logic.
        const finalPlayerAssignments = {};

        // Iterate over each player to determine their correct temporary group.
        for (const username in players) {
            const player = players[username];
            let assignedGroup = null;

            // Iterate through the ADMIN-CONFIGURED priority list of groups.
            for (const priorityGroup of configuredGroups) {
                // Find if the player has a permission for this priority group.
                const playerGroupMembership = player.groups.find(g => g.name === priorityGroup.group_name);

                // Check if the membership exists AND is temporary.
                if (playerGroupMembership && playerGroupMembership.expiry > 0) {
                    // This is a match! Assign the player to this group and stop searching.
                    assignedGroup = {
                        groupName: priorityGroup.group_name,
                        expiry: playerGroupMembership.expiry
                    };
                    break; // Exit the loop to respect the priority order.
                }
            }

            // If a temporary group was found for the player, add them to the final list.
            if (assignedGroup) {
                if (!finalPlayerAssignments[assignedGroup.groupName]) {
                    finalPlayerAssignments[assignedGroup.groupName] = [];
                }
                finalPlayerAssignments[assignedGroup.groupName].push({
                    username: player.username,
                    expiry: assignedGroup.expiry
                });
            }
            // If assignedGroup is null, it means the player only has permanent ranks, so they are ignored.
        }
        // <<<< CHANGE END >>>>

        // Step 3: Build the final message string.
        let allGroupsText = [];
        for (const group of configuredGroups) {
            const members = finalPlayerAssignments[group.group_name] || [];
            
            // Only proceed if there are temporary members in this group.
            if (members.length > 0) {
                // Sort members by expiry time, longest remaining time first.
                members.sort((a, b) => b.expiry - a.expiry);

                const memberLines = members.map(member => {
                    // We know expiry > 0 because of the new logic, so no need to check for 'دائمی'.
                    const expiryText = formatDuration(member.expiry - (Date.now() / 1000));
                    const escapedUsername = escapeMarkdown(member.username);
                    return group.player_template.replace(/#p/g, escapedUsername).replace(/#t/g, expiryText);
                });
                
                const playerListText = memberLines.join('\n');
                const groupBlock = group.group_template.replace(/#t/g, group.display_name).replace(/#p/g, playerListText);
                allGroupsText.push(groupBlock);
            }
        }
        
        let finalMessage;
        if (allGroupsText.length > 0) {
            finalMessage = allGroupsText.join('\n\n');
        } else {
            finalMessage = '_هیچ بازیکنی با رنک موقت یافت نشد._';
        }

        await bot.sendMessage(mainGroupId, finalMessage, { message_thread_id: rankTopicId, parse_mode: 'Markdown' });
        logger.success('RANK_LIST', 'Successfully sent new rank list with corrected logic.');

    } catch (error) {
        logger.error('RANK_LIST', 'Failed to send rank list', { error: error.message, stack: error.stack });
    }
}

async function updateOnlineStatusTopic(bot, db, rconClient) {
    const MODULE = 'STATUS_TOPIC';
    try {
        const mainGroupId = await db.getSetting('main_group_id');
        const onlineTopicId = await db.getSetting('topic_id_online');
        if (!mainGroupId || !onlineTopicId) return;

        const isOnline = rconClient !== null;
        const newTopicName = isOnline ? '🟢 server is online | سرور انلاینه 🟢' : '🔴 server is offline | سرور افلاینه 🔴';
        
        await bot.editForumTopic(mainGroupId, onlineTopicId, { name: newTopicName });
        
    } catch (error) {
        if (!error.response?.body?.description.includes('TOPIC_NOT_MODIFIED')) {
            logger.error(MODULE, 'Failed to update online status topic', { error: error.message });
        }
    }
}

module.exports = {
    sendRankList,
    updateOnlineStatusTopic
};