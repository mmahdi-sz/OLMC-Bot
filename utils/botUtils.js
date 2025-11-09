const logger = require('../logger');
const db = require('../database');
const luckpermsDb = require('../luckpermsDb');
const { formatDuration, escapeMarkdown } = require('./formatters');

function escapeMarkdownV2(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

async function sendRankList(bot, db) {
    logger.info('RANK_LIST', 'Generating rank list...');
    try {
        const mainGroupId = await db.getSetting('main_group_id');
        const rankTopicId = await db.getSetting('topic_id_rank');

        if (!mainGroupId || !rankTopicId) {
            return logger.info('RANK_LIST', 'Rank list module not configured.');
        }

        const configuredGroups = await db.getRankGroups();
        if (configuredGroups.length === 0) {
            return logger.info('RANK_LIST', 'No groups configured.');
        }
        
        const configuredGroupNames = configuredGroups.map(g => g.group_name);
        const allMembers = await luckpermsDb.getAllConfiguredGroupMembers(configuredGroupNames);

        const players = {};
        for (const member of allMembers) {
            if (!players[member.username]) {
                players[member.username] = { username: member.username, groups: [] };
            }
            players[member.username].groups.push({ name: member.group, expiry: member.expiry });
        }

        const finalPlayerAssignments = {};

        for (const username in players) {
            const player = players[username];
            let assignedGroup = null;

            for (const priorityGroup of configuredGroups) {
                const playerGroupMembership = player.groups.find(g => g.name === priorityGroup.group_name);

                if (playerGroupMembership && playerGroupMembership.expiry > 0) {
                    assignedGroup = {
                        groupName: priorityGroup.group_name,
                        expiry: playerGroupMembership.expiry
                    };
                    break;
                }
            }

            if (assignedGroup) {
                if (!finalPlayerAssignments[assignedGroup.groupName]) {
                    finalPlayerAssignments[assignedGroup.groupName] = [];
                }
                finalPlayerAssignments[assignedGroup.groupName].push({
                    username: player.username,
                    expiry: assignedGroup.expiry
                });
            }
        }

        let allGroupsText = [];
        let totalPlayers = 0;
        
        for (const group of configuredGroups) {
            const members = finalPlayerAssignments[group.group_name] || [];
            
            if (members.length > 0) {
                totalPlayers += members.length;
                members.sort((a, b) => b.expiry - a.expiry);

                const memberLines = members.map((member, index) => {
                    const expiryText = formatDuration(member.expiry - (Date.now() / 1000));
                    const escapedUsername = escapeMarkdown(member.username);
                    const playerLine = group.player_template
                        .replace(/#p/g, escapedUsername)
                        .replace(/#t/g, expiryText);
                    return `${index + 1}\\. ${playerLine}`;
                });
                
                const playerListText = memberLines.join('\n');
                
                const groupTitle = `${group.display_name} (تعداد: ${members.length})`;

                const groupBlock = group.group_template
                    .replace(/#t/g, escapeMarkdownV2(groupTitle))
                    .replace(/#p/g, playerListText);
                allGroupsText.push(groupBlock);
            }
        }
        
        let finalMessage = '👑 *لیست رنک‌های فعال*\n\n━━━━━━━━━━━━━━━━\n\n';
        
        if (allGroupsText.length > 0) {
            finalMessage += allGroupsText.join('\n\n');
            finalMessage += `\n\n━━━━━━━━━━━━━━━━\n\n📊 *آمار کلی:*\n`;
            finalMessage += `• مجموع بازیکنان: *${totalPlayers}*\n`;
            finalMessage += `• تعداد گروه‌ها: *${allGroupsText.length}*`;
        } else {
            finalMessage += '_در حال حاضر هیچ بازیکنی با رنک موقت یافت نشد\\._';
        }
        
        const now = new Date();
        const time = now.toLocaleTimeString('fa-IR', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Asia/Tehran'
        });
        finalMessage += `\n\n🕒 آخرین بروزرسانی: ${time}`;

        await bot.sendMessage(mainGroupId, finalMessage, { 
            message_thread_id: rankTopicId, 
            parse_mode: 'MarkdownV2' 
        });
        
        logger.success('RANK_LIST', 'Rank list sent successfully', { totalPlayers });

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
        
        let playerCount = '';
        let onlineCount = 0;
        
        if (isOnline) {
            try {
                const response = await rconClient.send('list');
                const cleanedResponse = response.replace(/§./g, '');
                const match = cleanedResponse.match(/(\d+)\s*\/\s*(\d+)/);
                if (match) {
                    onlineCount = parseInt(match[1], 10);
                    playerCount = ` [${match[1]}/${match[2]}]`;
                }
            } catch (e) {
                logger.warn(MODULE, 'Failed to get player count', { error: e.message });
            }
        }
        
        const statusEmoji = isOnline ? '🟢' : '🔴';
        const statusTextFa = isOnline ? 'آنلاین' : 'آفلاین';
        const statusTextEn = isOnline ? 'Online' : 'Offline';
        
        let newTopicName = `${statusEmoji} ${statusTextFa}`;
        if (onlineTopicId === parseInt(await db.getSetting('topic_id_players'), 10) && isOnline) {
             newTopicName = `${statusEmoji} ${onlineCount} Player(s) Online 🟢`;
        } else {
             newTopicName = `${statusEmoji} ${statusTextFa}${playerCount} | ${statusTextEn} ${statusEmoji}`;
        }
        
        await bot.editForumTopic(mainGroupId, onlineTopicId, { name: newTopicName });
        
        logger.debug(MODULE, 'Status topic updated', { isOnline, playerCount });
        
    } catch (error) {
        if (!error.response?.body?.description.includes('TOPIC_NOT_MODIFIED')) {
            logger.error(MODULE, 'Failed to update status topic', { error: error.message });
        }
    }
}

module.exports = {
    sendRankList,
    updateOnlineStatusTopic
};