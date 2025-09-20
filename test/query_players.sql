-- ##############################################################
-- #             استخراج اطلاعات برای بازیکن amir1387man           #
-- ##############################################################

SET @playerName = 'amir1387man';
SET @playerUUID = (SELECT uuid FROM plan_users WHERE name = @playerName LIMIT 1); -- Add LIMIT 1 here

SELECT JSON_OBJECT(
    'PlayerName', (SELECT name FROM plan_users WHERE uuid = @playerUUID LIMIT 1),
    'UUID', @playerUUID,
    'IS_OP', (SELECT opped FROM plan_user_info WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1) LIMIT 1),
    'IS_BANNED', (SELECT banned FROM plan_user_info WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1) LIMIT 1),
    'Nicknames', (SELECT JSON_ARRAYAGG(nickname) FROM plan_nicknames WHERE uuid = @playerUUID),
    'Country', (SELECT geolocation FROM plan_geolocations WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1) ORDER BY last_used DESC LIMIT 1),
    'First_Join', FROM_UNIXTIME((SELECT MIN(session_start) FROM plan_sessions WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1))/1000),
    'Last_Join', FROM_UNIXTIME((SELECT MAX(session_end) FROM plan_sessions WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1))/1000),
    'Total_Sessions', (SELECT COUNT(id) FROM plan_sessions WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1)),
    'Total_AFK_Time_Seconds', (SELECT SUM(afk_time) / 1000 FROM plan_sessions WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1)),
    'World_Playtime', (SELECT JSON_ARRAYAGG(JSON_OBJECT('world_name', pw.world_name, 'time_in_seconds', (pwt.survival_time + pwt.creative_time + pwt.adventure_time + pwt.spectator_time) / 1000)) FROM plan_world_times pwt JOIN plan_worlds pw ON pwt.world_id = pw.id WHERE pwt.user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1) GROUP BY pw.world_name),
    'Total_Kills', (SELECT COUNT(*) FROM plan_kills WHERE killer_uuid = @playerUUID),
    'Total_Deaths', (SELECT COUNT(*) FROM plan_kills WHERE victim_uuid = @playerUUID),
    'Kills_List', (SELECT JSON_ARRAYAGG(JSON_OBJECT('Victim_Name', victim.name, 'Weapon', pk.weapon, 'Kill_Date', FROM_UNIXTIME(pk.date/1000))) FROM plan_kills pk JOIN plan_users victim ON pk.victim_uuid = victim.uuid WHERE pk.killer_uuid = @playerUUID),
    'Deaths_List', (SELECT JSON_ARRAYAGG(JSON_OBJECT('Killer_Name', killer.name, 'Weapon', pk.weapon, 'Death_Date', FROM_UNIXTIME(pk.date/1000))) FROM plan_kills pk JOIN plan_users killer ON pk.killer_uuid = killer.uuid WHERE pk.victim_uuid = @playerUUID),
    'Last_Client_Version', (SELECT string_value FROM plan_extension_user_values WHERE provider_id = (SELECT id FROM plan_extension_providers WHERE name = 'protocolVersion' LIMIT 1) AND uuid = @playerUUID LIMIT 1)
)
FROM plan_users pu -- Use pu as an alias for plan_users to ensure a main row for JSON_OBJECT.
WHERE pu.uuid = @playerUUID
GROUP BY pu.id; -- Group by main table's id to ensure a single JSON object for the player


-- ##############################################################
-- #             استخراج اطلاعات برای بازیکن _Mmm568              #
-- ##############################################################

SET @playerName = '_Mmm568';
SET @playerUUID = (SELECT uuid FROM plan_users WHERE name = @playerName LIMIT 1); -- Add LIMIT 1 here

SELECT JSON_OBJECT(
    'PlayerName', (SELECT name FROM plan_users WHERE uuid = @playerUUID LIMIT 1),
    'UUID', @playerUUID,
    'IS_OP', (SELECT opped FROM plan_user_info WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1) LIMIT 1),
    'IS_BANNED', (SELECT banned FROM plan_user_info WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1) LIMIT 1),
    'Nicknames', (SELECT JSON_ARRAYAGG(nickname) FROM plan_nicknames WHERE uuid = @playerUUID),
    'Country', (SELECT geolocation FROM plan_geolocations WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1) ORDER BY last_used DESC LIMIT 1),
    'First_Join', FROM_UNIXTIME((SELECT MIN(session_start) FROM plan_sessions WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1))/1000),
    'Last_Join', FROM_UNIXTIME((SELECT MAX(session_end) FROM plan_sessions WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1))/1000),
    'Total_Sessions', (SELECT COUNT(id) FROM plan_sessions WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1)),
    'Total_AFK_Time_Seconds', (SELECT SUM(afk_time) / 1000 FROM plan_sessions WHERE user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1)),
    'World_Playtime', (SELECT JSON_ARRAYAGG(JSON_OBJECT('world_name', pw.world_name, 'time_in_seconds', (pwt.survival_time + pwt.creative_time + pwt.adventure_time + pwt.spectator_time) / 1000)) FROM plan_world_times pwt JOIN plan_worlds pw ON pwt.world_id = pw.id WHERE pwt.user_id = (SELECT id FROM plan_users WHERE uuid = @playerUUID LIMIT 1) GROUP BY pw.world_name),
    'Total_Kills', (SELECT COUNT(*) FROM plan_kills WHERE killer_uuid = @playerUUID),
    'Total_Deaths', (SELECT COUNT(*) FROM plan_kills WHERE victim_uuid = @playerUUID),
    'Kills_List', (SELECT JSON_ARRAYAGG(JSON_OBJECT('Victim_Name', victim.name, 'Weapon', pk.weapon, 'Kill_Date', FROM_UNIXTIME(pk.date/1000))) FROM plan_kills pk JOIN plan_users victim ON pk.victim_uuid = victim.uuid WHERE pk.killer_uuid = @playerUUID),
    'Deaths_List', (SELECT JSON_ARRAYAGG(JSON_OBJECT('Killer_Name', killer.name, 'Weapon', pk.weapon, 'Death_Date', FROM_UNIXTIME(pk.date/1000))) FROM plan_kills pk JOIN plan_users killer ON pk.killer_uuid = killer.uuid WHERE pk.victim_uuid = @playerUUID),
    'Last_Client_Version', (SELECT string_value FROM plan_extension_user_values WHERE provider_id = (SELECT id FROM plan_extension_providers WHERE name = 'protocolVersion' LIMIT 1) AND uuid = @playerUUID LIMIT 1)
)
FROM plan_users pu -- Use pu as an alias for plan_users to ensure a main row for JSON_OBJECT.
WHERE pu.uuid = @playerUUID
GROUP BY pu.id; -- Group by main table's id to ensure a single JSON object for the player