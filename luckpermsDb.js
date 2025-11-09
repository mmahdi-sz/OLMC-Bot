const mysql = require('mysql2/promise');
const logger = require('./logger.js');

const MODULE_NAME = 'LUCKPERMS_DB';

logger.info(MODULE_NAME, 'Initializing connection pool...');

const pool = mysql.createPool({
    host: process.env.LP_DB_HOST,
    user: process.env.LP_DB_USER,
    password: process.env.LP_DB_PASSWORD,
    database: process.env.LP_DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
});

let firstConnectionEstablished = false;
pool.on('connection', () => {
    if (!firstConnectionEstablished) {
        logger.success(MODULE_NAME, 'Successfully established first connection to the LuckPerms database.');
        firstConnectionEstablished = true;
    }
});

(async () => {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
    } catch (error) {
        logger.error(MODULE_NAME, 'Initial connection test failed', { error: error.message });
    }
})();

async function getAllGroups() {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT name FROM luckperms_groups ORDER BY name ASC');
        return rows.map(row => row.name);
    } catch (error) {
        logger.error(MODULE_NAME, 'Error fetching all groups', { error: error.message, stack: error.stack });
        return [];
    } finally {
        if (connection) connection.release();
    }
}

async function getGroupExpiry(groupName) {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(`
            SELECT
                lp.username,
                lup.expiry
            FROM
                luckperms_user_permissions AS lup
            JOIN
                luckperms_players AS lp ON lup.uuid = lp.uuid
            WHERE
                lup.permission = ? AND lup.expiry > 0
        `, [`group.${groupName.toLowerCase()}`]);
        
        return rows;
    } catch (error) {
        logger.error(MODULE_NAME, `Error fetching group expiry for '${groupName}'`, { error: error.message, stack: error.stack });
        return [];
    } finally {
        if (connection) connection.release();
    }
}

async function getChildGroups(groupName, connection) {
    try {
        const permissionToFind = `group.${groupName.toLowerCase()}`;
        const [rows] = await connection.execute(
            'SELECT name FROM luckperms_group_permissions WHERE permission = ?',
            [permissionToFind]
        );
        return rows.map(row => row.name);
    } catch (error) {
        logger.error(MODULE_NAME, `Error fetching child groups for '${groupName}'`, { error: error.message });
        return [];
    }
}

async function getGroupMembersWithExpiry(groupName) {
    let connection;
    try {
        connection = await pool.getConnection();
        const lowerGroupName = groupName.toLowerCase();
        const childGroups = await getChildGroups(lowerGroupName, connection);
        const allRelatedGroups = [lowerGroupName, ...childGroups];
        const permissionsToCheck = allRelatedGroups.map(name => `group.${name}`);
        const placeholders = permissionsToCheck.map(() => '?').join(',');
        const sql = `
            SELECT
                lp.username,
                MAX(lup.expiry) AS expiry 
            FROM
                luckperms_user_permissions AS lup
            JOIN
                luckperms_players AS lp ON lup.uuid = lp.uuid
            WHERE
                lup.permission IN (${placeholders})
            GROUP BY
                lp.uuid, lp.username
            ORDER BY
                expiry DESC, lp.username ASC
        `;
        const [rows] = await connection.execute(sql, permissionsToCheck);
        return rows;
    } catch (error) {
        logger.error(MODULE_NAME, `Error fetching all members for group '${groupName}'`, { error: error.message, stack: error.stack });
        return [];
    } finally {
        if (connection) connection.release();
    }
}

async function getAllConfiguredGroupMembers(configuredGroups) {
    if (!configuredGroups || configuredGroups.length === 0) {
        return [];
    }
    let connection;
    try {
        connection = await pool.getConnection();

        let allPermissionsToCheck = [];
        for (const groupName of configuredGroups) {
            const lowerGroupName = groupName.toLowerCase();
            const childGroups = await getChildGroups(lowerGroupName, connection);
            const allRelatedGroups = [lowerGroupName, ...childGroups];
            allPermissionsToCheck.push(...allRelatedGroups.map(name => `group.${name}`));
        }
        allPermissionsToCheck = [...new Set(allPermissionsToCheck)];

        if (allPermissionsToCheck.length === 0) {
            return [];
        }

        const placeholders = allPermissionsToCheck.map(() => '?').join(',');
        const sql = `
            SELECT
                lp.username,
                lup.permission,
                lup.expiry
            FROM
                luckperms_user_permissions AS lup
            JOIN
                luckperms_players AS lp ON lup.uuid = lp.uuid
            WHERE
                lup.permission IN (${placeholders})
        `;

        const [rows] = await connection.execute(sql, allPermissionsToCheck);

        return rows.map(row => ({
            username: row.username,
            group: row.permission.replace('group.', ''),
            expiry: row.expiry
        }));
    } catch (error) {
        logger.error(MODULE_NAME, `Error fetching all configured group members`, { error: error.message, stack: error.stack });
        return [];
    } finally {
        if (connection) connection.release();
    }
}

async function addTimeToTemporaryMembers(groupName, secondsToAdd) {
    let connection;
    try {
        connection = await pool.getConnection();
        const permission = `group.${groupName.toLowerCase()}`;
        
        const sql = `
            UPDATE luckperms_user_permissions 
            SET expiry = expiry + ? 
            WHERE permission = ? AND expiry > 0;
        `;

        const [result] = await connection.execute(sql, [secondsToAdd, permission]);
        logger.info(MODULE_NAME, `Added ${secondsToAdd}s to ${result.affectedRows} members of group '${groupName}'`);
        return result.affectedRows;
    } catch (error) {
        logger.error(MODULE_NAME, `Error adding time to group '${groupName}'`, { error: error.message, stack: error.stack });
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

async function isUserInGroups(username, groupNames) {
    if (!username || !Array.isArray(groupNames) || groupNames.length === 0) {
        return false;
    }

    let connection;
    try {
        connection = await pool.getConnection();
        
        const [playerRows] = await connection.execute(
            'SELECT uuid FROM luckperms_players WHERE username = ? LIMIT 1',
            [username]
        );

        if (playerRows.length === 0) {
            return false;
        }
        const playerUuid = playerRows[0].uuid;

        const permissionsToCheck = groupNames.map(name => `group.${name.toLowerCase()}`);
        
        const placeholders = permissionsToCheck.map(() => '?').join(',');
        const sql = `
            SELECT 1
            FROM luckperms_user_permissions
            WHERE uuid = ? AND permission IN (${placeholders}) AND (expiry = 0 OR expiry > UNIX_TIMESTAMP())
            LIMIT 1;
        `;

        const params = [playerUuid, ...permissionsToCheck];
        const [permissionRows] = await connection.execute(sql, params);
        
        return permissionRows.length > 0;

    } catch (error) {
        logger.error(MODULE_NAME, `Error checking group membership for user '${username}'`, { error: error.message, stack: error.stack });
        return false;
    } finally {
        if (connection) connection.release();
    }
}


module.exports = {
    getAllGroups,
    getGroupExpiry,
    getGroupMembersWithExpiry,
    addTimeToTemporaryMembers,
    isUserInGroups,
    getAllConfiguredGroupMembers
};