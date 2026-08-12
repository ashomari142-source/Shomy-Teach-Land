/**
 * 🔐 IMPROVED LOGOUT COMMAND
 * Graceful disconnection with session preservation
 * Supports: graceful logout, hard reset, backup creation
 */

const SessionManager = require('../lib/sessionManager');
const CredentialsManager = require('../lib/credentialsManager');
const axios = require('axios');

const sessionManager = new SessionManager();
const credsManager = new CredentialsManager();

async function sendTelegramMessage(chatId, text) {
    const settings = require('../settings');
    const token = settings.telegram?.botToken?.trim();
    if (!token) return false;

    try {
        const response = await axios.post(
            `https://api.telegram.org/bot${token}/sendMessage`,
            {
                chat_id: String(chatId),
                text: text,
                parse_mode: 'HTML'
            },
            { timeout: 30000 }
        );
        return response?.data?.ok === true;
    } catch (error) {
        console.error(`[LOGOUT CMD] Send message error: ${error.message}`);
        return false;
    }
}

/**
 * Main logout command handler
 */
async function execute(sock, chatId, args, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await require('../lib/isOwner')(senderId, sock, chatId);
        
        if (!message.key.fromMe && !isOwner) {
            return await sock.sendMessage(chatId, { 
                text: '❌ This command can only be used by the owner!'
            });
        }

        // Parse arguments
        const mode = args[0]?.toLowerCase() || 'graceful';
        const validModes = ['graceful', 'hard', 'reset', 'backup', 'info'];

        if (!validModes.includes(mode)) {
            const usage = `
<b>❌ Invalid mode</b>

Valid modes:
<code>/logout graceful</code> - Clean disconnect without session clear
<code>/logout hard</code> - Clear session and disconnect
<code>/logout reset</code> - Full system reset
<code>/logout backup</code> - Create emergency backup
<code>/logout info</code> - Show current session info
            `;
            return await sock.sendMessage(chatId, { text: usage });
        }

        // Show operation status
        await sock.sendMessage(chatId, {
            text: `⏳ Processing logout command: <b>${mode}</b>\n\nPlease wait...`
        });

        let result;

        switch (mode) {
            case 'graceful':
                result = await handleGracefulLogout(sock, chatId);
                break;
            case 'hard':
                result = await handleHardLogout(sock, chatId);
                break;
            case 'reset':
                result = await handleFullReset(sock, chatId);
                break;
            case 'backup':
                result = await handleEmergencyBackup(sock, chatId);
                break;
            case 'info':
                result = await handleSessionInfo(sock, chatId);
                break;
        }

        return result;

    } catch (error) {
        console.error(`[LOGOUT CMD] Error: ${error.message}`);
        try {
            await sock.sendMessage(chatId, {
                text: `❌ <b>Error:</b>\n<code>${error.message}</code>\n\nPlease try again or contact support.`
            });
        } catch (e) {}
        return false;
    }
}

/**
 * Graceful logout - clean disconnect
 */
async function handleGracefulLogout(sock, chatId) {
    try {
        const creds = credsManager.getPairedNumber();
        
        await sock.sendMessage(chatId, {
            text: '🔄 Initiating graceful disconnect...\n\n⏳ Saving session state and cleaning up...'
        });

        // Record disconnection
        credsManager.markAsDisconnected('graceful-logout-command');

        // Create backup
        const backup = sessionManager.backupSession('graceful-logout');

        // Clean up temporary files
        sessionManager.cleanupTempFiles();

        // Record health check
        sessionManager.recordHealthCheck('disconnected');

        await sock.sendMessage(chatId, {
            text: `✅ <b>Graceful Logout Complete!</b>\n\n` +
                  `📱 <b>Account:</b> <code>${creds || 'Not paired'}</code>\n` +
                  `💾 <b>Session:</b> Preserved (backup created)\n` +
                  `📊 <b>Backup:</b> <code>${backup.name}</code>\n` +
                  `⏱️ <b>Size:</b> <code>${backup.size} bytes</code>\n\n` +
                  `✓ To reconnect: Use /pair command\n` +
                  `✓ Session data is safe and preserved`
        });

        // Attempt graceful disconnect
        try {
            await sock.logout();
        } catch (e) {
            // Logout attempt may fail, that's ok
        }

        return true;

    } catch (error) {
        console.error(`[LOGOUT] Graceful logout error: ${error.message}`);
        throw error;
    }
}

/**
 * Hard logout - clear session and disconnect
 */
async function handleHardLogout(sock, chatId) {
    try {
        const creds = credsManager.getPairedNumber();
        
        await sock.sendMessage(chatId, {
            text: '⚠️ Initiating hard logout...\n\n🔍 Scanning session files...'
        });

        // Create backup before clearing
        const backup = sessionManager.backupSession('before-hard-logout');

        // Get session info before clearing
        const sessionInfo = sessionManager.getSessionInfo();

        // Clear session
        sessionManager.clearSession(false);

        // Clear credentials
        credsManager.clearPairing();

        await sock.sendMessage(chatId, {
            text: `✅ <b>Hard Logout Complete!</b>\n\n` +
                  `📱 <b>Account:</b> <code>${creds || 'Not paired'}</code>\n` +
                  `💾 <b>Session Files:</b> ${sessionInfo.fileCount} files deleted\n` +
                  `📊 <b>Size Freed:</b> <code>${sessionManager.formatBytes(sessionInfo.size)}</code>\n` +
                  `🔒 <b>Emergency Backup:</b> <code>${backup.name}</code>\n\n` +
                  `⚠️ All session data cleared\n` +
                  `✓ To set up new account: Use /pair command`
        });

        // Attempt disconnect
        try {
            await sock.logout();
        } catch (e) {
            // Logout attempt may fail, that's ok
        }

        return true;

    } catch (error) {
        console.error(`[LOGOUT] Hard logout error: ${error.message}`);
        throw error;
    }
}

/**
 * Full system reset
 */
async function handleFullReset(sock, chatId) {
    try {
        await sock.sendMessage(chatId, {
            text: '⚠️⚠️⚠️ <b>FULL SYSTEM RESET</b> ⚠️⚠️⚠️\n\n' +
                  '🔄 Clearing all data and reinitializing...\n' +
                  '⏳ This will take a moment...'
        });

        // Create comprehensive backup
        const backup = sessionManager.backupSession('full-system-reset');

        // Get metrics
        const sessionInfo = sessionManager.getSessionInfo();
        const backups = sessionManager.listBackups();

        // Clear everything
        sessionManager.clearSession(false);
        credsManager.hardReset();

        // Clean up old backups to save space
        sessionManager.cleanupOldBackups();

        await sock.sendMessage(chatId, {
            text: `✅ <b>Full System Reset Complete!</b>\n\n` +
                  `🗑️ <b>Data Cleared:</b> ${sessionInfo.fileCount} files\n` +
                  `📊 <b>Space Freed:</b> ${sessionManager.formatBytes(sessionInfo.size)}\n` +
                  `💾 <b>Emergency Backup:</b> <code>${backup.name}</code>\n` +
                  `📁 <b>Total Backups:</b> ${backups.length}\n\n` +
                  `✓ System reset to factory defaults\n` +
                  `✓ Ready for fresh setup with /pair command`
        });

        try {
            await sock.logout();
        } catch (e) {}

        return true;

    } catch (error) {
        console.error(`[LOGOUT] Full reset error: ${error.message}`);
        throw error;
    }
}

/**
 * Create emergency backup
 */
async function handleEmergencyBackup(sock, chatId) {
    try {
        await sock.sendMessage(chatId, {
            text: '💾 Creating emergency backup...\n\n⏳ Scanning and archiving session data...'
        });

        // Create backup
        const backup = sessionManager.backupSession('emergency-backup');

        // Get all backups
        const allBackups = sessionManager.listBackups();
        const totalBackupSize = allBackups.reduce((sum, b) => sum + b.size, 0);

        // Get current session size
        const sessionInfo = sessionManager.getSessionInfo();

        const backupList = allBackups
            .slice(0, 5)
            .map((b, i) => `${i + 1}. <code>${b.name}</code> (${sessionManager.formatBytes(b.size)})`)
            .join('\n');

        await sock.sendMessage(chatId, {
            text: `✅ <b>Emergency Backup Created!</b>\n\n` +
                  `📊 <b>Backup Details:</b>\n` +
                  `• Name: <code>${backup.name}</code>\n` +
                  `• Size: <code>${sessionManager.formatBytes(backup.size)}</code>\n` +
                  `• Created: <code>${backup.timestamp.toISOString()}</code>\n\n` +
                  `📁 <b>Recent Backups (Top 5):</b>\n${backupList}\n\n` +
                  `💾 <b>Total Backup Storage:</b> ${sessionManager.formatBytes(totalBackupSize)}\n` +
                  `📌 <b>Current Session Size:</b> ${sessionManager.formatBytes(sessionInfo.size)}\n\n` +
                  `✓ Your session data is safely backed up`
        });

        return true;

    } catch (error) {
        console.error(`[LOGOUT] Backup error: ${error.message}`);
        throw error;
    }
}

/**
 * Show session info
 */
async function handleSessionInfo(sock, chatId) {
    try {
        const sessionInfo = sessionManager.getSessionInfo();
        const credsInfo = credsManager.getCredsSummary();
        const backups = sessionManager.listBackups();
        const validation = sessionManager.validateSession();

        const message = `📊 <b>SESSION INFORMATION</b>\n\n` +
            `<b>Connection Status:</b>\n` +
            `• Paired: ${credsInfo.paired ? '✅ Yes' : '❌ No'}\n` +
            `• Status: <code>${credsInfo.status}</code>\n` +
            `• Phone: ${credsInfo.phoneNumber ? `<code>${credsInfo.phoneNumber}</code>` : 'N/A'}\n` +
            `• Paired At: ${credsInfo.pairedAt ? credsInfo.pairedAt.substring(0, 10) : 'N/A'}\n\n` +
            `<b>Session Details:</b>\n` +
            `• Exists: ${sessionInfo.exists ? '✅ Yes' : '❌ No'}\n` +
            `• Files: ${sessionInfo.fileCount}\n` +
            `• Size: ${sessionManager.formatBytes(sessionInfo.size)}\n` +
            `• Validation: ${validation.valid ? '✅ Valid' : '⚠️ Issues'}\n\n` +
            `<b>Backups Available:</b>\n` +
            `• Total: ${backups.length}\n` +
            `• Latest: ${backups[0] ? backups[0].name : 'N/A'}\n` +
            `• Total Size: ${sessionManager.formatBytes(backups.reduce((sum, b) => sum + b.size, 0))}\n\n` +
            `<b>Commands:</b>\n` +
            `• <code>/logout graceful</code> - Clean disconnect\n` +
            `• <code>/logout hard</code> - Clear and disconnect\n` +
            `• <code>/logout reset</code> - Full reset\n` +
            `• <code>/logout backup</code> - Emergency backup`;

        return await sock.sendMessage(chatId, { text: message });

    } catch (error) {
        console.error(`[LOGOUT] Info error: ${error.message}`);
        throw error;
    }
}

module.exports = {
    name: 'logout',
    aliases: ['disconnect', 'bye', 'exit'],
    config: {
        description: 'Graceful logout with session management',
        category: 'account',
        usage: '/logout [graceful|hard|reset|backup|info]'
    },
    execute
};
