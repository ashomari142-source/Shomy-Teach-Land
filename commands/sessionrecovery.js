/**
 * 🔧 SESSION RECOVERY COMMAND
 * Advanced diagnostics and recovery tools
 * Diagnose, repair, and manage session issues
 */

const SessionManager = require('../lib/sessionManager');
const CredentialsManager = require('../lib/credentialsManager');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
        console.error(`[SESSION RECOVERY] Send message error: ${error.message}`);
        return false;
    }
}

/**
 * Main session recovery command handler
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

        const action = args[0]?.toLowerCase() || 'status';
        const validActions = ['status', 'diagnose', 'repair', 'validate', 'restore', 'cleanup', 'list-backups'];

        if (!validActions.includes(action)) {
            const usage = `
<b>❌ Invalid action</b>

Valid actions:
<code>/sessionrecovery status</code> - Show session status
<code>/sessionrecovery diagnose</code> - Run full diagnostics
<code>/sessionrecovery repair</code> - Auto-repair issues
<code>/sessionrecovery validate</code> - Validate session structure
<code>/sessionrecovery restore [backup-name]</code> - Restore from backup
<code>/sessionrecovery cleanup</code> - Clean temporary files
<code>/sessionrecovery list-backups</code> - List available backups
            `;
            return await sock.sendMessage(chatId, { text: usage });
        }

        let result;

        switch (action) {
            case 'status':
                result = await handleStatus(sock, chatId);
                break;
            case 'diagnose':
                result = await handleDiagnose(sock, chatId);
                break;
            case 'repair':
                result = await handleRepair(sock, chatId);
                break;
            case 'validate':
                result = await handleValidate(sock, chatId);
                break;
            case 'restore':
                result = await handleRestore(sock, chatId, args[1]);
                break;
            case 'cleanup':
                result = await handleCleanup(sock, chatId);
                break;
            case 'list-backups':
                result = await handleListBackups(sock, chatId);
                break;
        }

        return result;

    } catch (error) {
        console.error(`[SESSION RECOVERY] Error: ${error.message}`);
        try {
            await sock.sendMessage(chatId, {
                text: `❌ <b>Error:</b>\n<code>${error.message}</code>`
            });
        } catch (e) {}
        return false;
    }
}

/**
 * Show session status
 */
async function handleStatus(sock, chatId) {
    try {
        const sessionInfo = sessionManager.getSessionInfo();
        const credsInfo = credsManager.getCredsSummary();
        const health = sessionManager.getHealthStatus();

        const message = `📊 <b>SESSION STATUS</b>\n\n` +
            `<b>Connection:</b>\n` +
            `• Paired: ${credsInfo.paired ? '✅' : '❌'} ${credsInfo.status}\n` +
            `• Number: ${credsInfo.phoneNumber || 'Not paired'}\n` +
            `• Session ID: ${credsInfo.sessionId ? `<code>${credsInfo.sessionId.substring(0, 12)}...</code>` : 'None'}\n\n` +
            `<b>Session Files:</b>\n` +
            `• Directory: ${sessionInfo.exists ? '✅ Exists' : '❌ Missing'}\n` +
            `• Files: ${sessionInfo.fileCount}\n` +
            `• Size: ${sessionManager.formatBytes(sessionInfo.size)}\n\n` +
            `<b>Health:</b>\n` +
            `• Status: ${health.status}\n` +
            `• Last Check: ${health.timestamp ? new Date(health.timestamp).toLocaleString() : 'Never'}\n`;

        return await sock.sendMessage(chatId, { text: message });

    } catch (error) {
        throw error;
    }
}

/**
 * Run full diagnostics
 */
async function handleDiagnose(sock, chatId) {
    try {
        await sock.sendMessage(chatId, {
            text: '🔍 Running full diagnostics...\n\n⏳ This may take a moment...'
        });

        const diagnosis = {
            timestamp: new Date().toISOString(),
            checks: []
        };

        // Check 1: Session directory
        const sessionInfo = sessionManager.getSessionInfo();
        diagnosis.checks.push({
            name: 'Session Directory',
            status: sessionInfo.exists ? '✅' : '❌',
            details: `${sessionInfo.exists ? 'Exists' : 'Missing'}`
        });

        // Check 2: Credentials file
        const credsValid = credsManager.validateCredentials();
        diagnosis.checks.push({
            name: 'Credentials',
            status: credsValid.valid ? '✅' : '❌',
            details: credsValid.issues.length > 0 ? credsValid.issues[0] : 'Valid',
            warnings: credsValid.warnings
        });

        // Check 3: Pairing status
        const isPaired = credsManager.isPaired();
        diagnosis.checks.push({
            name: 'Pairing Status',
            status: isPaired ? '✅' : '❌',
            details: isPaired ? 'Paired and active' : 'Not paired or inactive'
        });

        // Check 4: Session validation
        const validation = sessionManager.validateSession();
        diagnosis.checks.push({
            name: 'Session Validation',
            status: validation.valid ? '✅' : '❌',
            details: validation.reason || 'Structure valid',
            issues: validation.issues || []
        });

        // Check 5: Backup availability
        const backups = sessionManager.listBackups();
        diagnosis.checks.push({
            name: 'Backups',
            status: backups.length > 0 ? '✅' : '⚠️',
            details: `${backups.length} backup(s) available`
        });

        // Check 6: Health status
        const health = sessionManager.getHealthStatus();
        diagnosis.checks.push({
            name: 'System Health',
            status: health.status === 'healthy' ? '✅' : '⚠️',
            details: health.status
        });

        // Format report
        let report = `🔍 <b>DIAGNOSTICS REPORT</b>\n\n`;
        
        diagnosis.checks.forEach(check => {
            report += `${check.status} <b>${check.name}</b>\n`;
            report += `   ${check.details}\n`;
            if (check.warnings && check.warnings.length > 0) {
                report += `   ⚠️ Warnings: ${check.warnings.join(', ')}\n`;
            }
            if (check.issues && check.issues.length > 0) {
                report += `   ❌ Issues: ${check.issues.join(', ')}\n`;
            }
            report += '\n';
        });

        // Overall health
        const hasIssues = diagnosis.checks.some(c => c.status === '❌');
        const hasWarnings = diagnosis.checks.some(c => c.status === '⚠️');

        report += hasIssues ? '🔴 <b>Critical Issues Found</b>' :
                  hasWarnings ? '🟡 <b>Warnings Found</b>' :
                  '🟢 <b>System Healthy</b>';

        return await sock.sendMessage(chatId, { text: report });

    } catch (error) {
        throw error;
    }
}

/**
 * Auto-repair session
 */
async function handleRepair(sock, chatId) {
    try {
        await sock.sendMessage(chatId, {
            text: '🔧 Starting session repair...\n\n⏳ Analyzing and fixing issues...'
        });

        // Run repair
        const repairResult = sessionManager.repairSession();

        const message = repairResult.success ?
            `✅ <b>Repair Complete!</b>\n\n` +
            `<b>Actions Taken:</b>\n` +
            repairResult.repairs.map(r => `• ${r}`).join('\n') +
            `\n\n✓ Session is now ready to use` :
            `❌ <b>Repair Failed</b>\n\n${repairResult.error}`;

        return await sock.sendMessage(chatId, { text: message });

    } catch (error) {
        throw error;
    }
}

/**
 * Validate session structure
 */
async function handleValidate(sock, chatId) {
    try {
        const validation = sessionManager.validateSession();

        let message = `✅ <b>SESSION VALIDATION</b>\n\n`;
        message += `<b>Overall:</b> ${validation.valid ? '✅ Valid' : '❌ Invalid'}\n`;
        message += `<b>Reason:</b> ${validation.reason}\n`;
        message += `<b>Severity:</b> ${validation.severity}\n\n`;

        if (validation.issues && validation.issues.length > 0) {
            message += `<b>Issues Found:</b>\n`;
            validation.issues.forEach(issue => {
                message += `• ${issue}\n`;
            });
        } else {
            message += `✓ No issues found\n`;
        }

        return await sock.sendMessage(chatId, { text: message });

    } catch (error) {
        throw error;
    }
}

/**
 * Restore from backup
 */
async function handleRestore(sock, chatId, backupName) {
    try {
        if (!backupName) {
            return await sock.sendMessage(chatId, {
                text: '❌ Backup name required\n\nUsage: /sessionrecovery restore <backup-name>'
            });
        }

        await sock.sendMessage(chatId, {
            text: `🔄 Restoring from backup: <code>${backupName}</code>\n\n⏳ This will replace current session...`
        });

        const result = sessionManager.restoreSession(backupName);

        const message = result.success ?
            `✅ <b>Restore Complete!</b>\n\n` +
            `<b>Backup:</b> <code>${result.restored}</code>\n` +
            `<b>Restored At:</b> ${result.timestamp.toISOString()}\n\n` +
            `✓ Session restored successfully\n` +
            `✓ Please restart the bot to apply changes` :
            `❌ <b>Restore Failed</b>\n\n${result.error || result.reason}`;

        return await sock.sendMessage(chatId, { text: message });

    } catch (error) {
        throw error;
    }
}

/**
 * Cleanup temporary files
 */
async function handleCleanup(sock, chatId) {
    try {
        await sock.sendMessage(chatId, {
            text: '🧹 Cleaning up temporary files...\n\n⏳ Scanning...'
        });

        const cleanup = sessionManager.cleanupTempFiles();

        const message = cleanup.error ?
            `⚠️ <b>Cleanup Warning</b>\n\n${cleanup.error}` :
            `✅ <b>Cleanup Complete!</b>\n\n` +
            `<b>Files Removed:</b> ${cleanup.cleaned}\n` +
            `<b>Time:</b> ${cleanup.timestamp.toISOString()}`;

        return await sock.sendMessage(chatId, { text: message });

    } catch (error) {
        throw error;
    }
}

/**
 * List available backups
 */
async function handleListBackups(sock, chatId) {
    try {
        const backups = sessionManager.listBackups();

        let message = `💾 <b>AVAILABLE BACKUPS</b> (${backups.length})\n\n`;

        if (backups.length === 0) {
            message += `No backups available yet.`;
        } else {
            backups.forEach((backup, index) => {
                const created = new Date(backup.created).toLocaleString();
                const size = sessionManager.formatBytes(backup.size);
                message += `<b>${index + 1}.</b> <code>${backup.name}</code>\n`;
                message += `   📅 ${created}\n`;
                message += `   📊 ${size}\n\n`;
            });

            const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
            message += `<b>Total Storage:</b> ${sessionManager.formatBytes(totalSize)}`;
        }

        return await sock.sendMessage(chatId, { text: message });

    } catch (error) {
        throw error;
    }
}

module.exports = {
    name: 'sessionrecovery',
    aliases: ['sessionfix', 'session-recovery', 'sr'],
    config: {
        description: 'Session diagnostics and recovery tools',
        category: 'admin',
        usage: '/sessionrecovery [status|diagnose|repair|validate|restore|cleanup|list-backups]'
    },
    execute
};
