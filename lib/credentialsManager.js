/**
 * 🔑 ADVANCED CREDENTIALS MANAGER
 * Handles pairing, session persistence, and secure credential storage
 * VERSION: 2.0 - Enhanced with session manager integration
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const chalk = require('chalk');

class CredentialsManager {
    constructor() {
        this.credsDir = path.resolve(process.cwd(), 'data');
        this.credsFile = path.join(this.credsDir, 'whatsapp-creds.json');
        this.sessionMetaFile = path.join(this.credsDir, 'session-meta.json');
        
        this.ensureDirectory();
        this.initCredsFile();
    }

    ensureDirectory() {
        if (!fs.existsSync(this.credsDir)) {
            fs.mkdirSync(this.credsDir, { recursive: true });
        }
    }

    // ─────────────────────────────────────────
    // INITIALIZATION & DEFAULTS
    // ─────────────────────────────────────────

    initCredsFile() {
        if (!fs.existsSync(this.credsFile)) {
            const defaultCreds = this.getDefaultCreds();
            this.writeCreds(defaultCreds);
        }
    }

    getDefaultCreds() {
        return {
            paired: false,
            phoneNumber: null,
            pairingCode: null,
            sessionId: null,
            pairedAt: null,
            pairedFrom: null,
            telegramChatId: null,
            status: 'unpaired',
            lastUpdate: new Date().toISOString(),
            version: '2.0',
            metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                pairingAttempts: 0,
                lastPairingAttempt: null
            }
        };
    }

    // ─────────────────────────────────────────
    // READ / WRITE OPERATIONS
    // ─────────────────────────────────────────

    readCreds() {
        try {
            this.ensureDirectory();
            if (!fs.existsSync(this.credsFile)) {
                return this.getDefaultCreds();
            }
            const raw = fs.readFileSync(this.credsFile, 'utf8');
            return JSON.parse(raw);
        } catch (error) {
            console.error(`[CREDS] Error reading credentials: ${error.message}`);
            return this.getDefaultCreds();
        }
    }

    writeCreds(data) {
        try {
            this.ensureDirectory();
            const updated = {
                ...this.readCreds(),
                ...data,
                lastUpdate: new Date().toISOString()
            };
            
            // Update metadata
            if (!updated.metadata) updated.metadata = {};
            updated.metadata.updatedAt = new Date().toISOString();
            
            fs.writeFileSync(this.credsFile, JSON.stringify(updated, null, 2), 'utf8');
            return updated;
        } catch (error) {
            console.error(`[CREDS] Error writing credentials: ${error.message}`);
            return null;
        }
    }

    // ─────────────────────────────────────────
    // PAIRING OPERATIONS
    // ─────────────────────────────────────────

    /**
     * Initialize pairing process
     */
    initiatePairing(phoneNumber, telegramChatId, pairingCode = null) {
        try {
            const creds = this.readCreds();
            
            // Increment pairing attempts
            if (!creds.metadata) creds.metadata = {};
            if (!creds.metadata.pairingAttempts) creds.metadata.pairingAttempts = 0;
            creds.metadata.pairingAttempts++;
            creds.metadata.lastPairingAttempt = new Date().toISOString();

            return this.writeCreds({
                paired: false,
                phoneNumber: this.normalizePhoneNumber(phoneNumber),
                pairingCode: pairingCode,
                telegramChatId: telegramChatId,
                sessionId: `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
                status: 'pairing-in-progress',
                metadata: creds.metadata
            });
        } catch (error) {
            console.error(`[CREDS] Pairing init failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Mark as successfully paired
     */
    markAsPaired(phoneNumber, telegramChatId, sessionId = null) {
        try {
            const creds = this.readCreds();
            
            return this.writeCreds({
                paired: true,
                phoneNumber: this.normalizePhoneNumber(phoneNumber),
                telegramChatId: telegramChatId,
                sessionId: sessionId || creds.sessionId,
                pairedAt: new Date().toISOString(),
                pairedFrom: 'whatsapp-pairing',
                status: 'paired-active',
                pairingCode: null
            });
        } catch (error) {
            console.error(`[CREDS] Mark as paired failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Update pairing status
     */
    updatePairingStatus(status) {
        const validStatuses = [
            'unpaired',
            'pairing-in-progress',
            'pairing-failed',
            'paired-active',
            'paired-inactive',
            'disconnected',
            'error'
        ];

        if (!validStatuses.includes(status)) {
            console.error(`[CREDS] Invalid status: ${status}`);
            return null;
        }

        return this.writeCreds({ status });
    }

    /**
     * Record pairing failure
     */
    recordPairingFailure(reason) {
        try {
            const creds = this.readCreds();
            if (!creds.metadata) creds.metadata = {};
            if (!creds.metadata.pairingFailures) creds.metadata.pairingFailures = [];
            
            creds.metadata.pairingFailures.push({
                timestamp: new Date().toISOString(),
                reason: reason,
                attempt: creds.metadata.pairingAttempts || 1
            });

            // Keep only last 10 failures
            if (creds.metadata.pairingFailures.length > 10) {
                creds.metadata.pairingFailures.shift();
            }

            return this.writeCreds({
                status: 'pairing-failed',
                paired: false,
                pairingCode: null,
                metadata: creds.metadata
            });
        } catch (error) {
            console.error(`[CREDS] Failed to record pairing failure: ${error.message}`);
            return null;
        }
    }

    // ─────────────────────────────────────────
    // GETTERS
    // ─────────────────────────────────────────

    getPairedNumber() {
        const creds = this.readCreds();
        return creds.paired && creds.phoneNumber ? creds.phoneNumber : null;
    }

    isPaired() {
        const creds = this.readCreds();
        return creds.paired === true && !!creds.phoneNumber && creds.status === 'paired-active';
    }

    getSessionId() {
        const creds = this.readCreds();
        return creds.sessionId || null;
    }

    getStatus() {
        const creds = this.readCreds();
        return creds.status || 'unknown';
    }

    getAllCreds() {
        return this.readCreds();
    }

    getCredsSummary() {
        const creds = this.readCreds();
        return {
            paired: creds.paired,
            status: creds.status,
            phoneNumber: creds.paired ? creds.phoneNumber : null,
            pairedAt: creds.pairedAt,
            sessionId: creds.sessionId
        };
    }

    // ─────────────────────────────────────────
    // LOGOUT / UNPAIR
    // ─────────────────────────────────────────

    /**
     * Clear pairing (for unpair command)
     */
    clearPairing() {
        try {
            return this.writeCreds({
                paired: false,
                phoneNumber: null,
                sessionId: null,
                pairingCode: null,
                status: 'unpaired',
                pairedAt: null,
                pairedFrom: null
            });
        } catch (error) {
            console.error(`[CREDS] Clear pairing failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Mark as disconnected (for logout without clearing)
     */
    markAsDisconnected(reason = 'manual-logout') {
        try {
            const creds = this.readCreds();
            if (!creds.metadata) creds.metadata = {};
            if (!creds.metadata.disconnections) creds.metadata.disconnections = [];

            creds.metadata.disconnections.push({
                timestamp: new Date().toISOString(),
                reason: reason
            });

            // Keep only last 10 disconnections
            if (creds.metadata.disconnections.length > 10) {
                creds.metadata.disconnections.shift();
            }

            return this.writeCreds({
                status: 'disconnected',
                metadata: creds.metadata
            });
        } catch (error) {
            console.error(`[CREDS] Mark as disconnected failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Hard reset - clear everything
     */
    hardReset() {
        try {
            return this.writeCreds(this.getDefaultCreds());
        } catch (error) {
            console.error(`[CREDS] Hard reset failed: ${error.message}`);
            return null;
        }
    }

    // ─────────────────────────────────────────
    // UTILITY FUNCTIONS
    // ─────────────────────────────────────────

    normalizePhoneNumber(phone) {
        // Remove all non-numeric characters
        let cleaned = String(phone).replace(/[^0-9]/g, '');
        
        // If starts with 0, replace with 255 (Tanzania)
        if (cleaned.startsWith('0') && cleaned.length > 1) {
            cleaned = '255' + cleaned.substring(1);
        }
        // If doesn't start with 255, add it
        else if (!cleaned.startsWith('255') && cleaned.length > 0) {
            cleaned = '255' + cleaned;
        }
        
        // Validate length (Tanzania: 255XXXXXXXXX = 12 digits)
        if (cleaned.startsWith('255') && cleaned.length === 12) {
            return cleaned;
        }
        
        return cleaned;
    }

    /**
     * Get pairing history/metadata
     */
    getPairingHistory() {
        const creds = this.readCreds();
        return {
            currentStatus: creds.status,
            isPaired: creds.paired,
            phoneNumber: creds.phoneNumber,
            pairedAt: creds.pairedAt,
            sessionId: creds.sessionId,
            metadata: creds.metadata || {},
            pairingAttempts: creds.metadata?.pairingAttempts || 0,
            recentFailures: creds.metadata?.pairingFailures?.slice(-3) || [],
            recentDisconnections: creds.metadata?.disconnections?.slice(-3) || []
        };
    }

    /**
     * Validate credentials structure
     */
    validateCredentials() {
        try {
            const creds = this.readCreds();
            
            const validation = {
                valid: true,
                issues: [],
                warnings: []
            };

            // Check required fields
            if (!('paired' in creds)) {
                validation.issues.push('Missing "paired" field');
                validation.valid = false;
            }

            if (creds.paired === true) {
                if (!creds.phoneNumber) {
                    validation.issues.push('Paired but no phone number');
                    validation.valid = false;
                }
                if (!creds.pairedAt) {
                    validation.warnings.push('No pairing timestamp');
                }
            }

            if (!creds.version) {
                validation.warnings.push('Missing version info');
            }

            return validation;
        } catch (error) {
            return {
                valid: false,
                issues: [error.message],
                warnings: []
            };
        }
    }

    /**
     * Export credentials report (safe - no sensitive data)
     */
    getReport() {
        const creds = this.readCreds();
        return {
            timestamp: new Date().toISOString(),
            status: creds.status,
            paired: creds.paired,
            phoneNumber: creds.paired ? creds.phoneNumber : 'N/A',
            pairedAt: creds.pairedAt || 'N/A',
            pairingAttempts: creds.metadata?.pairingAttempts || 0,
            lastUpdate: creds.lastUpdate,
            validation: this.validateCredentials()
        };
    }
}

module.exports = CredentialsManager;
