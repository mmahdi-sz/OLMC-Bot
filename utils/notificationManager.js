const logger = require('../logger');

const MODULE_NAME = 'NOTIFICATION_MANAGER';

class NotificationManager {
    constructor(bot) {
        this.bot = bot;
        this.queue = [];
        this.processing = false;
        this.throttleDelay = 100; // Delay between sending messages in queue (ms)
    }

    async sendNotification(userId, message, options = {}) {
        this.queue.push({ userId, message, options });
        
        if (!this.processing) {
            await this.processQueue();
        }
    }

    async processQueue() {
        this.processing = true;
        
        while (this.queue.length > 0) {
            const notification = this.queue.shift();
            
            try {
                await this.bot.sendMessage(
                    notification.userId,
                    notification.message,
                    {
                        parse_mode: 'MarkdownV2',
                        ...notification.options
                    }
                );
                
                await new Promise(resolve => setTimeout(resolve, this.throttleDelay));
                
            } catch (error) {
                if (error.response?.body?.error_code === 403 || error.message?.includes('bot was blocked')) {
                    logger.warn(MODULE_NAME, `User ${notification.userId} blocked the bot. Removing from queue.`);
                } else if (!error.message?.includes('chat not found')) {
                    logger.error(MODULE_NAME, 'Failed to send notification', {
                        userId: notification.userId,
                        error: error.message
                    });
                }
            }
        }
        
        this.processing = false;
    }

    async broadcast(userIds, message, options = {}) {
        for (const userId of userIds) {
            // Adding a small delay for broadcast initiation
            await new Promise(resolve => setTimeout(resolve, 5));
            this.queue.push({ userId, message, options });
        }
        
        if (!this.processing) {
            await this.processQueue();
        }
    }
}

module.exports = NotificationManager;