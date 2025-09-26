// utils/formatters.js

function formatDuration(seconds) {
    if (seconds <= 0) return "Expired";
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    return `${d}D ${h}H ${m}M ${s}S`;
}

function escapeMarkdown(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[_*[\]()`]/g, '\\$&');
}

module.exports = {
    formatDuration,
    escapeMarkdown
};