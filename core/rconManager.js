// core/rconManager.js

const { Rcon } = require('rcon-client');
const logger = require('../logger');

let rconClient = null;

/**
 * Establishes a persistent RCON connection and handles automatic reconnection.
 * @param {object} rconConfig - RCON connection details (host, port, password, reconnectDelay).
 * @param {function} onConnectCallback - A function to call every time a connection is established.
 */
function connectRcon(rconConfig, onConnectCallback) {
    const { host, port, password, reconnectDelay } = rconConfig;

    const attemptConnection = async () => {
        try {
            const newRcon = new Rcon({ host, port, password });

            newRcon.on('connect', () => { 
                logger.success('RCON_MANAGER', 'Persistent RCON connection established!');
                rconClient = newRcon; 
                if (onConnectCallback) onConnectCallback();
            });

            newRcon.on('end', () => { 
                logger.warn('RCON_MANAGER', `RCON connection closed. Reconnecting in ${reconnectDelay / 1000}s...`); 
                rconClient = null;
                if (onConnectCallback) onConnectCallback(); // Update status to offline
                setTimeout(attemptConnection, reconnectDelay); 
            });

            newRcon.on('error', (err) => {
                // This event is often followed by 'end', so we just log it.
                logger.error('RCON_MANAGER', 'RCON connection error.', { error: err.message });
                rconClient = null;
                if (onConnectCallback) onConnectCallback();
            });

            await newRcon.connect();

        } catch (error) {
            logger.error('RCON_MANAGER', `Failed to initiate RCON connection. Retrying in ${reconnectDelay / 1000}s...`);
            rconClient = null;
            if (onConnectCallback) onConnectCallback();
            setTimeout(attemptConnection, reconnectDelay);
        }
    };

    attemptConnection();
}

/**
 * Returns the currently active RCON client instance.
 * @returns {Rcon|null} The Rcon client instance or null if not connected.
 */
function getRconClient() {
    return rconClient;
}

module.exports = {
    connectRcon,
    getRconClient
};