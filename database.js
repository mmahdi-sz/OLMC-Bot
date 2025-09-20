// database.js

const mysql = require('mysql2/promise');
const logger = require('./logger.js');

const MODULE_NAME = 'DATABASE';

logger.info(MODULE_NAME, 'Initializing database connection pool...');

// ===== CONFIGURATION & CONSTANTS =====
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.on('error', (err) => {
    logger.error(MODULE_NAME, 'Pool-level error occurred', { error: err.message, stack: err.stack });
});


// ===== SCHEMA INITIALIZATION =====
async function initDb() {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.ping();
        logger.success(MODULE_NAME, 'Initial database connection test successful.');

        logger.info(MODULE_NAME, 'Connected to MariaDB and initializing schema...');

        // Servers Table
        await connection.execute(`CREATE TABLE IF NOT EXISTS servers (id INT PRIMARY KEY AUTO_INCREMENT, user_id BIGINT NOT NULL, name VARCHAR(255) NOT NULL UNIQUE, ip VARCHAR(255) NOT NULL, port VARCHAR(255) NOT NULL, password TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
        // Admins Table
        await connection.execute(`CREATE TABLE IF NOT EXISTS admins (user_id BIGINT PRIMARY KEY, name VARCHAR(255) NOT NULL, added_at DATETIME DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
        // User Links Table
        await connection.execute(`CREATE TABLE IF NOT EXISTS user_links (telegram_user_id BIGINT PRIMARY KEY, ingame_username VARCHAR(255) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
        // Settings Table
        await connection.execute(`CREATE TABLE IF NOT EXISTS settings (\`key\` VARCHAR(255) PRIMARY KEY, value TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);

        try {
            const [rows] = await connection.execute(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = ? AND table_name = 'rank_list_groups' AND column_name = 'template' LIMIT 1`, [process.env.DB_DATABASE]);
            if (rows.length > 0) {
                logger.warn(MODULE_NAME, "Old 'rank_list_groups' table schema detected. Dropping table to recreate with new schema...");
                await connection.execute('DROP TABLE rank_list_groups');
            }
        } catch (error) { /* Ignore */ }

        // Rank List Groups Table
        await connection.execute(`CREATE TABLE IF NOT EXISTS rank_list_groups (id INT PRIMARY KEY AUTO_INCREMENT, group_name VARCHAR(255) NOT NULL UNIQUE, display_name VARCHAR(255) NOT NULL, group_template TEXT NOT NULL, player_template TEXT NOT NULL, sort_order INT DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
        // Registrations Table
        await connection.execute(`CREATE TABLE IF NOT EXISTS registrations (id INT PRIMARY KEY AUTO_INCREMENT, telegram_user_id BIGINT NOT NULL UNIQUE, game_edition VARCHAR(10) NOT NULL, game_username VARCHAR(255) NOT NULL, age INT NOT NULL, uuid VARCHAR(16) NOT NULL UNIQUE, status VARCHAR(20) NOT NULL DEFAULT 'pending', referrer_telegram_id BIGINT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
        
        // --- Language Column Migration ---
        try {
            await connection.execute(`ALTER TABLE registrations ADD COLUMN language_code VARCHAR(5) DEFAULT 'fa'`);
            logger.info(MODULE_NAME, "Column 'language_code' added to 'registrations' table.");
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                logger.debug(MODULE_NAME, "Column 'language_code' already exists in 'registrations' table.");
            } else {
                throw error;
            }
        }
        
        const [updateResult] = await connection.execute(`UPDATE registrations SET language_code = 'fa' WHERE language_code IS NULL OR language_code = ''`);
        if (updateResult.affectedRows > 0) {
            logger.info(MODULE_NAME, `Updated language_code for ${updateResult.affectedRows} existing users to 'fa'.`);
        }
        
        // Wizard States Table
        await connection.execute(`CREATE TABLE IF NOT EXISTS wizard_states (user_id BIGINT PRIMARY KEY, wizard_type VARCHAR(50) NOT NULL, step VARCHAR(50) NOT NULL, data JSON, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
        
        // <<<< CHANGE START >>>>
        // بخش جدید: ایجاد جدول تنظیمات کاربران
        // این جدول برای ذخیره زبان و سایر تنظیمات کاربر، حتی قبل از ثبت‌نام کامل، استفاده می‌شود.
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS user_settings (
                telegram_user_id BIGINT PRIMARY KEY,
                language_code VARCHAR(5) DEFAULT 'fa'
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        logger.info(MODULE_NAME, "Table 'user_settings' is ready.");
        // <<<< CHANGE END >>>>

        logger.success(MODULE_NAME, 'Schema initialization complete.');
    } catch (error) {
        logger.error(MODULE_NAME, 'FATAL: Failed to initialize database schema', { error: error.message, stack: error.stack });
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
};

async function executeAndLog(sql, params) {
    try {
        return await pool.execute(sql, params);
    } catch (error) {
        logger.error(MODULE_NAME, 'Query execution failed', { sql, params, error: error.message });
        throw error;
    }
}

// ===== DATABASE FUNCTIONS =====

// --- Server Management ---
async function addServer(userId, name, ip, port, password) {
    const sql = "INSERT INTO servers (user_id, name, ip, port, password) VALUES (?, ?, ?, ?, ?)";
    const [result] = await executeAndLog(sql, [userId, name, ip, port, password]);
    return result.insertId;
}
async function getServers(userId) {
    const sql = "SELECT id, name, ip, port, password FROM servers WHERE user_id = ?";
    const [rows] = await executeAndLog(sql, [userId]);
    return rows;
}
async function deleteServer(userId, serverName) {
    const sql = "DELETE FROM servers WHERE user_id = ? AND name = ?";
    const [result] = await executeAndLog(sql, [userId, serverName]);
    return result.affectedRows;
}

// --- Admin Management ---
async function addAdmin(userId, name) {
    const sql = "INSERT INTO admins (user_id, name) VALUES (?, ?)";
    const [result] = await executeAndLog(sql, [userId, name]);
    return result.insertId;
}
async function getAdmins() {
    const sql = "SELECT user_id, name FROM admins ORDER BY added_at DESC";
    const [rows] = await executeAndLog(sql);
    return rows;
}
async function removeAdmin(userId) {
    const sql = "DELETE FROM admins WHERE user_id = ?";
    const [result] = await executeAndLog(sql, [userId]);
    return result.affectedRows;
}
async function isAdmin(userId) {
    const sql = "SELECT 1 FROM admins WHERE user_id = ? LIMIT 1";
    const [rows] = await executeAndLog(sql, [userId]);
    return rows.length > 0;
}

// --- User Link Management ---
async function setUserLink(telegramUserId, ingameUsername) {
    const sql = "INSERT INTO user_links (telegram_user_id, ingame_username) VALUES (?, ?) ON DUPLICATE KEY UPDATE ingame_username = VALUES(ingame_username)";
    const [result] = await executeAndLog(sql, [telegramUserId, ingameUsername]);
    return result.affectedRows;
}
async function getUserLink(telegramUserId) {
    const sql = "SELECT ingame_username FROM user_links WHERE telegram_user_id = ?";
    const [rows] = await executeAndLog(sql, [telegramUserId]);
    return rows.length > 0 ? rows[0].ingame_username : null;
}

// <<<< CHANGE START >>>>
// --- User Language Management (بخش بازنویسی شده) ---

/**
 * زبان کاربر را در جدول user_settings ذخیره یا به‌روزرسانی می‌کند.
 * این تابع هم برای کاربران جدید و هم قدیمی کار می‌کند.
 */
async function setUserLanguage(telegramUserId, languageCode) {
    // این دستور اگر کاربر در جدول تنظیمات وجود نداشته باشد او را اضافه می‌کند (INSERT)
    // و اگر وجود داشته باشد، زبانش را آپدیت می‌کند (UPDATE).
    const sql = "INSERT INTO user_settings (telegram_user_id, language_code) VALUES (?, ?) ON DUPLICATE KEY UPDATE language_code = VALUES(language_code)";
    const [result] = await executeAndLog(sql, [telegramUserId, languageCode]);

    // برای هماهنگی داده‌ها، سعی می‌کنیم زبان را در جدول ثبت‌نام هم آپدیت کنیم
    // این کار برای کاربرانی است که از قبل ثبت‌نام کرده‌اند.
    try {
        const updateRegSql = "UPDATE registrations SET language_code = ? WHERE telegram_user_id = ?";
        await executeAndLog(updateRegSql, [languageCode, telegramUserId]);
    } catch (e) {
        // اگر کاربر هنوز ثبت‌نام نکرده باشد، این بخش خطا می‌دهد که طبیعی است و نادیده گرفته می‌شود.
        logger.debug(MODULE_NAME, `User ${telegramUserId} not in registrations table yet, skipping language update there.`);
    }

    return result.affectedRows;
}

/**
 * زبان کاربر را بازیابی می‌کند.
 * ابتدا جدول جدید user_settings را چک می‌کند، سپس جدول قدیمی registrations.
 */
async function getUserLanguage(telegramUserId) {
    // 1. اولویت با جدول جدید تنظیمات است
    let sql = "SELECT language_code FROM user_settings WHERE telegram_user_id = ? LIMIT 1";
    let [rows] = await executeAndLog(sql, [telegramUserId]);

    if (rows.length > 0 && rows[0].language_code) {
        return rows[0].language_code;
    }

    // 2. اگر در جدول جدید نبود، جدول قدیمی ثبت‌نام را برای سازگاری چک می‌کنیم
    sql = "SELECT language_code FROM registrations WHERE telegram_user_id = ? LIMIT 1";
    [rows] = await executeAndLog(sql, [telegramUserId]);
    
    return rows.length > 0 ? rows[0].language_code : null;
}
// <<<< CHANGE END >>>>


// --- Settings Management ---
async function setSetting(key, value) {
    const sql = "INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)";
    const [result] = await executeAndLog(sql, [key, String(value)]);
    return result.affectedRows;
}
async function getSetting(key) {
    const sql = "SELECT value FROM settings WHERE `key` = ?";
    const [rows] = await executeAndLog(sql, [key]);
    return rows.length > 0 ? rows[0].value : null;
}
async function deleteSetting(key) {
    const sql = "DELETE FROM settings WHERE `key` = ?";
    const [result] = await executeAndLog(sql, [key]);
    return result.affectedRows;
}

// --- Rank Group Management ---
async function addRankGroup(groupName, displayName, groupTemplate, playerTemplate) {
    const sql = "INSERT INTO rank_list_groups (group_name, display_name, group_template, player_template) VALUES (?, ?, ?, ?)";
    const [result] = await executeAndLog(sql, [groupName, displayName, groupTemplate, playerTemplate]);
    return result.insertId;
}
async function getRankGroups() {
    const sql = "SELECT id, group_name, display_name, group_template, player_template, sort_order FROM rank_list_groups ORDER BY sort_order ASC, id ASC";
    const [rows] = await executeAndLog(sql);
    return rows;
}
async function getRankGroupByName(groupName) {
    const sql = "SELECT id, group_name, display_name, group_template, player_template FROM rank_list_groups WHERE group_name = ?";
    const [rows] = await executeAndLog(sql, [groupName]);
    return rows.length > 0 ? rows[0] : null;
}
async function deleteRankGroup(groupName) {
    const sql = "DELETE FROM rank_list_groups WHERE group_name = ?";
    const [result] = await executeAndLog(sql, [groupName]);
    return result.affectedRows;
}
async function updateRankGroupTemplate(groupName, newGroupTemplate) {
    const sql = "UPDATE rank_list_groups SET group_template = ? WHERE group_name = ?";
    const [result] = await executeAndLog(sql, [newGroupTemplate, groupName]);
    return result.affectedRows;
}
async function updatePlayerTemplate(groupName, newPlayerTemplate) {
    const sql = "UPDATE rank_list_groups SET player_template = ? WHERE group_name = ?";
    const [result] = await executeAndLog(sql, [newPlayerTemplate, groupName]);
    return result.affectedRows;
}

async function updateRankGroupSortOrder(groupId, direction) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [groups] = await connection.execute('SELECT id, sort_order FROM rank_list_groups ORDER BY sort_order ASC, id ASC');
        const groupIndex = groups.findIndex(g => g.id === groupId);

        if (groupIndex === -1) throw new Error('Group not found');

        let needsUpdate = false;
        if (direction === 'up' && groupIndex > 0) {
            const currentGroup = groups[groupIndex];
            const swapGroup = groups[groupIndex - 1];
            [currentGroup.sort_order, swapGroup.sort_order] = [swapGroup.sort_order, currentGroup.sort_order];
            await connection.execute('UPDATE rank_list_groups SET sort_order = ? WHERE id = ?', [currentGroup.sort_order, currentGroup.id]);
            await connection.execute('UPDATE rank_list_groups SET sort_order = ? WHERE id = ?', [swapGroup.sort_order, swapGroup.id]);
            needsUpdate = true;
        } else if (direction === 'down' && groupIndex < groups.length - 1) {
            const currentGroup = groups[groupIndex];
            const swapGroup = groups[groupIndex + 1];
            [currentGroup.sort_order, swapGroup.sort_order] = [swapGroup.sort_order, currentGroup.sort_order];
            await connection.execute('UPDATE rank_list_groups SET sort_order = ? WHERE id = ?', [currentGroup.sort_order, currentGroup.id]);
            await connection.execute('UPDATE rank_list_groups SET sort_order = ? WHERE id = ?', [swapGroup.sort_order, swapGroup.id]);
            needsUpdate = true;
        }

        if (needsUpdate) {
            const [sortedGroups] = await connection.execute('SELECT id FROM rank_list_groups ORDER BY sort_order ASC, id ASC');
            for (let i = 0; i < sortedGroups.length; i++) {
                await connection.execute('UPDATE rank_list_groups SET sort_order = ? WHERE id = ?', [i, sortedGroups[i].id]);
            }
        }
        
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        logger.error(MODULE_NAME, "Failed to update sort order (transaction rolled back)", { error: error.message, stack: error.stack });
        throw error;
    } finally {
        connection.release();
    }
}

// --- Registration Management ---
// <<<< CHANGE START >>>>
// تابع addRegistration کمی تغییر کرد تا زبان کاربر را هم ذخیره کند
async function addRegistration(data) {
    // language_code را از دیتا استخراج می‌کنیم
    const { telegram_user_id, game_edition, game_username, age, uuid, referrer_telegram_id, language_code } = data;
    const sql = `INSERT INTO registrations (telegram_user_id, game_edition, game_username, age, uuid, status, referrer_telegram_id, created_at, language_code) VALUES (?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, ?) ON DUPLICATE KEY UPDATE game_edition = VALUES(game_edition), game_username = VALUES(game_username), age = VALUES(age), uuid = VALUES(uuid), status = 'pending', referrer_telegram_id = VALUES(referrer_telegram_id), created_at = CURRENT_TIMESTAMP, language_code = VALUES(language_code);`;
    const [result] = await executeAndLog(sql, [telegram_user_id, game_edition, game_username, age, uuid, referrer_telegram_id || null, language_code || 'fa']);
    return result;
}
// <<<< CHANGE END >>>>

async function deleteRegistration(uuid) {
    const sql = "DELETE FROM registrations WHERE uuid = ?";
    const [result] = await executeAndLog(sql, [uuid]);
    return result.affectedRows;
}
async function getRegistrationByUuid(uuid) {
    const sql = "SELECT telegram_user_id, game_username, status FROM registrations WHERE uuid = ?";
    const [rows] = await executeAndLog(sql, [uuid]);
    return rows.length > 0 ? rows[0] : null;
}
async function getRegistrationByTelegramId(telegramUserId) {
    const sql = "SELECT telegram_user_id, game_username, status, uuid, language_code FROM registrations WHERE telegram_user_id = ?";
    const [rows] = await executeAndLog(sql, [telegramUserId]);
    return rows.length > 0 ? rows[0] : null;
}
async function updateRegistrationStatus(uuid, newStatus) {
    const sql = `UPDATE registrations SET status = ? WHERE uuid = ?`;
    const [result] = await executeAndLog(sql, [newStatus, uuid]);
    return result.affectedRows > 0;
}
async function isUsernameTaken(username) {
    const sql = "SELECT 1 FROM registrations WHERE game_username = ? LIMIT 1";
    const [rows] = await executeAndLog(sql, [username]);
    return rows.length > 0;
}

// --- Wizard State Management ---
async function setWizardState(userId, wizardType, step, data) {
    const sql = `INSERT INTO wizard_states (user_id, wizard_type, step, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE wizard_type = VALUES(wizard_type), step = VALUES(step), data = VALUES(data);`;
    return executeAndLog(sql, [userId, wizardType, step, JSON.stringify(data || {})]);
}
async function getWizardState(userId) {
    const sql = "SELECT wizard_type, step, data FROM wizard_states WHERE user_id = ?";
    const [rows] = await executeAndLog(sql, [userId]);
    if (rows.length === 0) return null;
    try {
        rows[0].data = JSON.parse(rows[0].data || '{}');
    } catch (e) {
        logger.error(MODULE_NAME, `Failed to parse wizard state JSON for user ${userId}`, { data: rows[0].data });
        rows[0].data = {};
    }
    return rows[0];
}
async function deleteWizardState(userId) {
    const sql = "DELETE FROM wizard_states WHERE user_id = ?";
    return executeAndLog(sql, [userId]);
}


// ===== EXPORTS =====
const db = {
    initDb,
    addServer, getServers, deleteServer,
    addAdmin, getAdmins, removeAdmin, isAdmin,
    setUserLink, getUserLink,
    getSetting, setSetting, deleteSetting,
    addRankGroup, getRankGroups, deleteRankGroup, updateRankGroupTemplate, updatePlayerTemplate, getRankGroupByName,
    updateRankGroupSortOrder,
    addRegistration, deleteRegistration, getRegistrationByUuid, getRegistrationByTelegramId, updateRegistrationStatus,
    isUsernameTaken,
    setWizardState, getWizardState, deleteWizardState,
    setUserLanguage, getUserLanguage
};

module.exports = db;