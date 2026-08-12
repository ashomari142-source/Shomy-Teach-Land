/**
 * 🔐 SESSION MANAGER - Robust & Reliable
 * Handles all session operations: validation, recovery, cleanup, logout
 * VERSION: 2.0 - Enterprise Grade Session Management
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');

class SessionManager {
    constructor() {
        this.sessionDir = path.resolve(process.cwd(), 'session');
        this.backupDir = path.resolve(process.cwd(), 'session_backups');
        this.credsFile = path.join(this.sessionDir, 'creds.json');
        this.lockFile = path.join(this.sessionDir, '.session.lock');
        this.healthCheckFile = path.join(this.sessionDir, '.health');
        this.logDir = path.resolve(process.cwd(), 'session_logs');
        
        this.maxBackups = 10;
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
        this.lockTimeout = 5 * 60 * 1000; // 5 minutes
        
        this.ensureDirectories();
    }

    ensureDirectories() {
        [this.sessionDir, this.backupDir, this.logDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // ─────────────────────────────────────────
    // SESSION VALIDATION
    // ─────────────────────────────────────────
    
    /**
     * Comprehensive session validation
     */
    validateSession() {
        try {
            this.log('INFO', 'Validating session structure...');
            
            if (!fs.existsSync(this.sessionDir)) {
                this.log('WARN', 'Session directory does not exist');
                return {
                    valid: false,
                    reason: 'Session directory missing',
                    severity: 'CRITICAL'
                };
            }

            const files = fs.readdirSync(this.sessionDir);
            
            if (files.length === 0) {
                this.log('WARN', 'Session directory is empty');
                return {
                    valid: true,
                    reason: 'Fresh session',
                    severity: 'INFO',
                    isEmpty: true
                };
            }

            const validation = {
                valid: true,
                files: files.length,
                hasCreds: false,
                hasKeys: false,
                credsValid: false,
                severity: 'INFO',
                issues: []
            };

            // Check for creds.json
            if (fs.existsSync(this.credsFile)) {
                validation.hasCreds = true;
                try {
                    const credsData = JSON.parse(fs.readFileSync(this.credsFile, 'utf8'));
                    validation.credsValid = this.isCredsDataValid(credsData);
                    
                    if (!validation.credsValid) {
                        validation.issues.push('Credentials data is incomplete or invalid');
                        validation.severity = 'WARN';
                    }
                } catch (e) {
                    validation.issues.push('Credentials file is corrupted');
                    validation.severity = 'ERROR';
                    validation.valid = false;
                }
            } else {
                validation.issues.push('Credentials file missing');
                validation.severity = 'WARN';
            }

            // Check for key files
            const keyFiles = files.filter(f => f.startsWith('pre-key-') || f.startsWith('session-'));
            validation.hasKeys = keyFiles.length > 0;
            
            if (!validation.hasKeys) {
                validation.issues.push('Encryption keys missing');
                validation.severity = 'WARN';
            }

            // Check for app state files
            const appStateFiles = files.filter(f => f.startsWith('app-state-sync-'));
            if (appStateFiles.length > 0) {
                validation.appStateSync = appStateFiles.length;
            }

            this.log('INFO', `Session validation complete: ${validation.valid ? 'VALID' : 'INVALID'}`);
            return validation;
        } catch (err) {
            this.log('ERROR', `Validation error: ${err.message}`);
            return {
                valid: false,
                reason: err.message,
                severity: 'CRITICAL'
            };
        }
    }

    isCredsDataValid(credsData) {
        if (!credsData || typeof credsData !== 'object') return false;
        
        const requiredFields = ['creds'];
        return requiredFields.every(field => field in credsData);
    }

    /**
     * Get detailed session information
     */
    getSessionInfo() {
        try {
            const stats = {
                exists: fs.existsSync(this.sessionDir),
                createdAt: null,
                lastModified: null,
                size: 0,
                fileCount: 0,
                isPaired: false,
                pairedNumber: null,
                validation: null
            };

            if (stats.exists) {
                const dirStats = fs.statSync(this.sessionDir);
                stats.createdAt = dirStats.birthtime;
                stats.lastModified = dirStats.mtime;

                const files = fs.readdirSync(this.sessionDir);
                stats.fileCount = files.length;

                // Calculate total size
                files.forEach(file => {
                    const filePath = path.join(this.sessionDir, file);
                    const fileStats = fs.statSync(filePath);
                    stats.size += fileStats.size;
                });

                // Check if paired
                if (fs.existsSync(this.credsFile)) {
                    try {
                        const creds = JSON.parse(fs.readFileSync(this.credsFile, 'utf8'));
                        stats.isPaired = creds.creds?.registered === true;
                        if (stats.isPaired && creds.creds?.me?.id) {
                            stats.pairedNumber = creds.creds.me.id.split(':')[0];
                        }
                    } catch (e) {}
                }

                stats.validation = this.validateSession();
            }

            return stats;
        } catch (err) {
            this.log('ERROR', `Failed to get session info: ${err.message}`);
            return null;
        }
    }

    // ─────────────────────────────────────────
    // SESSION BACKUP & RESTORE
    // ─────────────────────────────────────────

    /**
     * Create a backup of current session
     */
    backupSession(reason = 'manual') {
        try {
            if (!fs.existsSync(this.sessionDir)) {
                this.log('WARN', 'No session to backup');
                return { success: false, reason: 'Session directory not found' };
            }

            this.ensureDirectories();

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `session_${reason}_${timestamp}`;
            const backupPath = path.join(this.backupDir, backupName);

            // Create backup
            fs.cpSync(this.sessionDir, backupPath, { recursive: true, force: true });

            // Get backup size
            const size = this.getDirSize(backupPath);
            
            this.log('SUCCESS', `Session backed up: ${backupName} (${this.formatBytes(size)})`);

            // Cleanup old backups
            this.cleanupOldBackups();

            return {
                success: true,
                path: backupPath,
                name: backupName,
                size: size,
                timestamp: new Date()
            };
        } catch (err) {
            this.log('ERROR', `Backup failed: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    /**
     * Restore session from backup
     */
    restoreSession(backupName) {
        try {
            const backupPath = path.join(this.backupDir, backupName);

            if (!fs.existsSync(backupPath)) {
                this.log('ERROR', `Backup not found: ${backupName}`);
                return { success: false, reason: 'Backup not found' };
            }

            // Create backup of current session before restore
            if (fs.existsSync(this.sessionDir)) {
                this.backupSession('before-restore');
            }

            // Clear current session
            if (fs.existsSync(this.sessionDir)) {
                fs.rmSync(this.sessionDir, { recursive: true, force: true });
            }

            // Restore
            fs.cpSync(backupPath, this.sessionDir, { recursive: true, force: true });

            this.log('SUCCESS', `Session restored from: ${backupName}`);

            return {
                success: true,
                restored: backupName,
                timestamp: new Date()
            };
        } catch (err) {
            this.log('ERROR', `Restore failed: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    /**
     * List all available backups
     */
    listBackups() {
        try {
            if (!fs.existsSync(this.backupDir)) {
                return [];
            }

            const backups = fs.readdirSync(this.backupDir)
                .filter(f => fs.statSync(path.join(this.backupDir, f)).isDirectory())
                .map(name => {
                    const backupPath = path.join(this.backupDir, name);
                    const stats = fs.statSync(backupPath);
                    return {
                        name,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        size: this.getDirSize(backupPath)
                    };
                })
                .sort((a, b) => b.modified - a.modified);

            return backups;
        } catch (err) {
            this.log('ERROR', `Failed to list backups: ${err.message}`);
            return [];
        }
    }

    cleanupOldBackups() {
        try {
            if (!fs.existsSync(this.backupDir)) return;

            const backups = fs.readdirSync(this.backupDir)
                .map(f => ({
                    name: f,
                    path: path.join(this.backupDir, f),
                    time: fs.statSync(path.join(this.backupDir, f)).mtimeMs
                }))
                .sort((a, b) => b.time - a.time);

            // Keep only maxBackups
            if (backups.length > this.maxBackups) {
                backups.slice(this.maxBackups).forEach(backup => {
                    try {
                        fs.rmSync(backup.path, { recursive: true, force: true });
                        this.log('INFO', `Removed old backup: ${backup.name}`);
                    } catch (e) {
                        this.log('WARN', `Failed to remove backup: ${backup.name}`);
                    }
                });
            }
        } catch (err) {
            this.log('WARN', `Backup cleanup error: ${err.message}`);
        }
    }

    // ─────────────────────────────────────────
    // SESSION REPAIR & RECOVERY
    // ─────────────────────────────────────────

    /**
     * Attempt to repair corrupted session
     */
    repairSession() {
        try {
            this.log('INFO', 'Starting session repair...');

            const validation = this.validateSession();

            if (validation.valid && !validation.isEmpty) {
                this.log('SUCCESS', 'Session is already valid');
                return { success: true, repaired: false, reason: 'No repairs needed' };
            }

            // Backup current session
            this.backupSession('before-repair');

            const repairs = [];

            // Check and fix creds.json
            if (!validation.hasCreds && fs.existsSync(this.credsFile)) {
                try {
                    const creds = JSON.parse(fs.readFileSync(this.credsFile, 'utf8'));
                    if (!creds.creds) {
                        creds.creds = {};
                    }
                    fs.writeFileSync(this.credsFile, JSON.stringify(creds, null, 2));
                    repairs.push('Fixed credentials structure');
                } catch (e) {
                    // Can't repair corrupted JSON
                    repairs.push('Credentials file is corrupted and cannot be auto-repaired');
                }
            }

            // Clean up orphaned files
            const orphanedFiles = this.findOrphanedFiles();
            if (orphanedFiles.length > 0) {
                orphanedFiles.forEach(file => {
                    try {
                        fs.unlinkSync(path.join(this.sessionDir, file));
                        repairs.push(`Removed orphaned file: ${file}`);
                    } catch (e) {}
                });
            }

            this.log('SUCCESS', `Session repair complete: ${repairs.length} issues fixed`);

            return {
                success: true,
                repaired: repairs.length > 0,
                repairs: repairs,
                timestamp: new Date()
            };
        } catch (err) {
            this.log('ERROR', `Repair failed: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    findOrphanedFiles() {
        try {
            if (!fs.existsSync(this.sessionDir)) return [];

            const files = fs.readdirSync(this.sessionDir);
            const orphaned = [];

            files.forEach(file => {
                const filePath = path.join(this.sessionDir, file);
                const stats = fs.statSync(filePath);

                // Check if file is empty or suspiciously small
                if (stats.isFile() && stats.size === 0) {
                    orphaned.push(file);
                }

                // Check if modification time is too old (stale)
                const age = Date.now() - stats.mtimeMs;
                if (age > this.sessionTimeout && !file.includes('creds')) {
                    orphaned.push(file);
                }
            });

            return orphaned;
        } catch (err) {
            return [];
        }
    }

    // ─────────────────────────────────────────
    // SESSION CLEANUP & LOGOUT
    // ─────────────────────────────────────────

    /**
     * Graceful logout and cleanup
     */
    async logout(preserveBackup = true) {
        try {
            this.log('INFO', 'Initiating graceful logout...');

            // Create safety backup
            if (preserveBackup) {
                this.backupSession('logout-backup');
            }

            // Clear credentials
            if (fs.existsSync(this.credsFile)) {
                const emptyCredsTemplate = {
                    creds: {
                        registered: false,
                        me: null
                    },
                    keys: {}
                };
                fs.writeFileSync(this.credsFile, JSON.stringify(emptyCredsTemplate, null, 2));
            }

            // Clear app state sync
            this.clearAppStateSync();

            // Remove lock file
            this.releaseLock();

            this.log('SUCCESS', 'Logout complete');

            return {
                success: true,
                loggedOut: true,
                timestamp: new Date()
            };
        } catch (err) {
            this.log('ERROR', `Logout error: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    /**
     * Hard reset - clear entire session
     */
    clearSession(createBackup = true) {
        try {
            this.log('INFO', 'Clearing entire session...');

            if (createBackup && fs.existsSync(this.sessionDir)) {
                this.backupSession('before-clear');
            }

            if (fs.existsSync(this.sessionDir)) {
                fs.rmSync(this.sessionDir, { recursive: true, force: true });
                fs.mkdirSync(this.sessionDir, { recursive: true });
            }

            this.log('SUCCESS', 'Session cleared completely');

            return {
                success: true,
                cleared: true,
                timestamp: new Date()
            };
        } catch (err) {
            this.log('ERROR', `Session clear failed: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    /**
     * Clean up old temporary files
     */
    cleanupTempFiles(maxAgeMs = 60 * 60 * 1000) {
        try {
            if (!fs.existsSync(this.sessionDir)) return { cleaned: 0 };

            let cleaned = 0;
            const now = Date.now();
            const files = fs.readdirSync(this.sessionDir);

            files.forEach(file => {
                // Skip important files
                if (file === 'creds.json' || file.startsWith('.')) return;

                const filePath = path.join(this.sessionDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    const age = now - stats.mtimeMs;

                    if (age > maxAgeMs) {
                        fs.unlinkSync(filePath);
                        cleaned++;
                    }
                } catch (e) {}
            });

            if (cleaned > 0) {
                this.log('INFO', `Cleaned ${cleaned} old temporary files`);
            }

            return { cleaned, timestamp: new Date() };
        } catch (err) {
            this.log('WARN', `Cleanup error: ${err.message}`);
            return { cleaned: 0, error: err.message };
        }
    }

    clearAppStateSync() {
        try {
            if (!fs.existsSync(this.sessionDir)) return;

            const files = fs.readdirSync(this.sessionDir)
                .filter(f => f.startsWith('app-state-sync-'));

            files.forEach(file => {
                try {
                    fs.unlinkSync(path.join(this.sessionDir, file));
                } catch (e) {}
            });

            if (files.length > 0) {
                this.log('INFO', `Cleared ${files.length} app state sync files`);
            }
        } catch (err) {
            this.log('WARN', `Failed to clear app state sync: ${err.message}`);
        }
    }

    // ─────────────────────────────────────────
    // LOCKING MECHANISM
    // ─────────────────────────────────────────

    acquireLock(timeout = this.lockTimeout) {
        try {
            const lockData = {
                timestamp: Date.now(),
                pid: process.pid
            };

            fs.writeFileSync(this.lockFile, JSON.stringify(lockData));
            return true;
        } catch (err) {
            this.log('WARN', `Lock acquisition failed: ${err.message}`);
            return false;
        }
    }

    releaseLock() {
        try {
            if (fs.existsSync(this.lockFile)) {
                fs.unlinkSync(this.lockFile);
            }
            return true;
        } catch (err) {
            this.log('WARN', `Lock release failed: ${err.message}`);
            return false;
        }
    }

    isLocked() {
        try {
            if (!fs.existsSync(this.lockFile)) return false;

            const lockData = JSON.parse(fs.readFileSync(this.lockFile, 'utf8'));
            const age = Date.now() - lockData.timestamp;

            // Lock expires after lockTimeout
            if (age > this.lockTimeout) {
                this.releaseLock();
                return false;
            }

            return true;
        } catch (err) {
            return false;
        }
    }

    // ─────────────────────────────────────────
    // HEALTH CHECK
    // ─────────────────────────────────────────

    recordHealthCheck(status = 'healthy') {
        try {
            const health = {
                status,
                timestamp: new Date().toISOString(),
                pid: process.pid,
                uptime: process.uptime(),
                memory: process.memoryUsage()
            };

            fs.writeFileSync(this.healthCheckFile, JSON.stringify(health, null, 2));
            return true;
        } catch (err) {
            this.log('WARN', `Health check recording failed: ${err.message}`);
            return false;
        }
    }

    getHealthStatus() {
        try {
            if (!fs.existsSync(this.healthCheckFile)) {
                return { status: 'unknown', lastCheck: null };
            }

            const health = JSON.parse(fs.readFileSync(this.healthCheckFile, 'utf8'));
            return health;
        } catch (err) {
            return { status: 'error', error: err.message };
        }
    }

    // ─────────────────────────────────────────
    // LOGGING
    // ─────────────────────────────────────────

    log(level, message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}\n`;

        try {
            const logFile = path.join(this.logDir, `session-${new Date().toISOString().split('T')[0]}.log`);
            fs.appendFileSync(logFile, logEntry);
        } catch (e) {}

        // Console output
        const colors = {
            INFO: chalk.blue,
            SUCCESS: chalk.green,
            WARN: chalk.yellow,
            ERROR: chalk.red
        };

        const color = colors[level] || chalk.white;
        if (process.env.SESSION_MANAGER_VERBOSE) {
            console.log(color(`[${level}] ${message}`));
        }
    }

    // ─────────────────────────────────────────
    // UTILITY FUNCTIONS
    // ─────────────────────────────────────────

    getDirSize(dir) {
        try {
            let size = 0;
            const files = fs.readdirSync(dir, { withFileTypes: true });

            files.forEach(file => {
                const fullPath = path.join(dir, file.name);
                if (file.isDirectory()) {
                    size += this.getDirSize(fullPath);
                } else {
                    size += fs.statSync(fullPath).size;
                }
            });

            return size;
        } catch (err) {
            return 0;
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = SessionManager;
