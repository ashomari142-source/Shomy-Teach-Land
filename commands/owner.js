const os = require('os');
const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { OMMY_IMAGE_URL, OMMY_IMAGE_PATH, hasLocalOmmyImage } = require('../lib/ommyMedia');

// ═══════════════════════════════════════════════════════════════
// 👑 OWNER PROFILE COMMAND - SHOMY TEACH CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
    FOOTER: '👑 SHOMY TEACH • OWNER PROFILE 👑',
    OWNER: {
        NAME: 'Shomy Teach',
        TITLE: 'Base Developer & Bot Creator',
        LOCATION: 'Tanzania 🇹🇿',
        PHONE_1: '255790991272',
        PHONE_2: '255612130873',
        STATUS: '🟢 Active Developer'
    },
    IMAGE_PATH: OMMY_IMAGE_PATH
};

/**
 * Main owner command handler
 * Displays owner profile with contact information and profile image
 */
const ownerCommand = async (sock, chatId, message) => {
    const safeMessage = message || {};
    const messageKey = safeMessage.key || {};
    
    console.log('[📋 Owner] Command invoked by:', messageKey.participant || messageKey.remoteJid || 'Unknown');

    try {
        // ═══════════════════════════════════════════════════════════════
        // STATUS MESSAGE - FORMATTED WITH EMOJIS AND STRUCTURE
        // ═══════════════════════════════════════════════════════════════
        const statusMessage = `
╔═══════════════════════════════════════╗
║  👑 *SHOMY TEACH - OWNER PROFILE* 👑  ║
╚═══════════════════════════════════════╝

╭────────────────────────────────────╮
│ 👤 *PERSONAL INFORMATION*
├────────────────────────────────────┤
│ 📛 *Name:* ${CONFIG.OWNER.NAME}
│ 💼 *Title:* ${CONFIG.OWNER.TITLE}
│ 📍 *Location:* ${CONFIG.OWNER.LOCATION}
│ 🟢 *Status:* ${CONFIG.OWNER.STATUS}
╰────────────────────────────────────╯

╭────────────────────────────────────╮
│ 📱 *CONTACT METHODS*
├────────────────────────────────────┤
│ ☎️ Line 1: ${CONFIG.OWNER.PHONE_1}
│ ☎️ Line 2: ${CONFIG.OWNER.PHONE_2}
╰────────────────────────────────────╯

✨ *_Shomy Teach Technology™_*
`.trim();

        // ═══════════════════════════════════════════════════════════════
        // INTERACTIVE BUTTONS - CONTACT OPTIONS
        // ═══════════════════════════════════════════════════════════════
        const contactButtons = [
            { 
                buttonId: `phone:${CONFIG.OWNER.PHONE_1}`, 
                buttonText: { displayText: `☎️ Call Line 1` }, 
                type: 1 
            },
            { 
                buttonId: `phone:${CONFIG.OWNER.PHONE_2}`, 
                buttonText: { displayText: `☎️ Call Line 2` }, 
                type: 1 
            }
        ];

        // ═══════════════════════════════════════════════════════════════
        // IMAGE HANDLING - LOCAL & REMOTE FALLBACK
        // ═══════════════════════════════════════════════════════════════

        /**
         * Load profile image from local storage
         * @returns {Buffer|null} Image buffer or null if not found
         */
        const getLocalImage = () => {
            try {
                const imagePath = CONFIG.IMAGE_PATH;
                console.log('  📦 Checking local image at:', imagePath);
                
                if (hasLocalOmmyImage()) {
                    const imageBuffer = fs.readFileSync(imagePath);
                    console.log('  ✅ Local image found -', imageBuffer.length, 'bytes');
                    return imageBuffer;
                } else {
                    console.log('  ⚠️  Local image not found at:', imagePath);
                    return null;
                }
            } catch (error) {
                console.error('  ❌ Error reading local image:', error.message);
                return null;
            }
        };

        /**
         * Fetch image from remote URL
         * @param {string} url - Remote image URL
         * @returns {Promise<Buffer>} Image buffer
         */
        const fetchRemoteImage = async (url) => {
            console.log('  🌐 Fetching from remote:', url);
            const response = await axios.get(url, { 
                responseType: 'arraybuffer', 
                timeout: 10000 
            });
            return Buffer.from(response.data);
        };

        /**
         * Resize image to specified dimensions
         * @param {Buffer} buffer - Image buffer
         * @param {number} width - Target width
         * @param {number} height - Target height
         * @returns {Promise<Buffer>} Resized image buffer
         */
        const resizeImage = async (buffer, width = 300, height = 300) => {
            try {
                const sharp = require('sharp');
                console.log('  📐 Resizing image to', width, 'x', height);
                return await sharp(buffer)
                    .resize(width, height, { fit: 'cover' })
                    .toBuffer();
            } catch (error) {
                console.warn('  ⚠️  Image resizing failed, using original:', error.message);
                return buffer;
            }
        };

        // ═══════════════════════════════════════════════════════════════
        // MESSAGE BUILDER - NATIVE BUTTON WITH IMAGE
        // ═══════════════════════════════════════════════════════════════
        const sendProfileMessage = async () => {
            let profileImage = null;

            // Step 1: Try to load local image first
            console.log('\n  [Step 1] Loading profile image...');
            const localImage = getLocalImage();
            if (localImage) {
                try {
                    profileImage = await resizeImage(localImage, 300, 300);
                    console.log('  ✅ Profile image ready from local storage');
                } catch (error) {
                    console.error('  ❌ Failed to process local image:', error.message);
                }
            }

            // Step 2: Fallback to remote image if local failed
            if (!profileImage) {
                try {
                    console.log('  [Step 2] Attempting remote image fallback...');
                    const remoteBuffer = await fetchRemoteImage(OMMY_IMAGE_URL);
                    profileImage = await resizeImage(remoteBuffer, 300, 300);
                    console.log('  ✅ Profile image loaded from remote source');
                } catch (error) {
                    console.warn('  ⚠️  Remote image fallback failed:', error.message);
                }
            }

            // Step 3: Prepare message context
            const contextInfo = {
                forwardingScore: 999,
                isForwarded: true,
            };
            
            const mentionJid = messageKey.participant || messageKey.remoteJid;
            if (mentionJid) contextInfo.mentionedJid = [mentionJid];

            // Step 4: Build and send the message
            console.log('  [Step 3] Building message structure...');
            const messageContent = generateWAMessageFromContent(chatId, {
                buttonsMessage: {
                    contentText: statusMessage,
                    footerText: CONFIG.FOOTER,
                    headerType: 6,
                    locationMessage: {
                        degreesLatitude: 0,
                        degreesLongitude: 0,
                        name: CONFIG.OWNER.NAME,
                        address: CONFIG.OWNER.TITLE,
                        jpegThumbnail: profileImage
                    },
                    viewOnce: true,
                    contextInfo,
                    buttons: contactButtons
                }
            }, { userJid: (sock && sock.user && sock.user.id) || '', quoted: message || undefined });

            console.log('  [Step 4] Sending message via relay...');
            await sock.relayMessage(chatId, messageContent.message, {
                messageId: messageContent.key?.id || sock.generateMessageID(),
                additionalNodes: [
                    {
                        tag: 'biz',
                        attrs: {},
                        content: [
                            {
                                tag: 'interactive',
                                attrs: { type: 'native_flow', v: '1' },
                                content: [
                                    {
                                        tag: 'native_flow',
                                        attrs: { v: '9', name: 'mixed' }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            });
            console.log('  ✅ Profile message sent successfully\n');
        };

        // ═══════════════════════════════════════════════════════════════
        // EXECUTION - TRY PRIMARY, FALLBACK TO SIMPLE TEXT
        // ═══════════════════════════════════════════════════════════════
        try {
            console.log('📤 Attempting primary message send method...');
            await sendProfileMessage();
        } catch (primaryError) {
            console.warn('⚠️  Primary method failed:', primaryError?.message || primaryError);
            console.log('📤 Attempting fallback text message...');
            
            try {
                await sock.sendMessage(chatId, { text: statusMessage }, { quoted: message });
                console.log('✅ Message sent via fallback method');
            } catch (fallbackError) {
                console.error('❌ All send methods failed');
                console.error('   Primary error:', primaryError?.message);
                console.error('   Fallback error:', fallbackError?.message);
            }
        }

    } catch (error) {
        console.error('🔴 CRITICAL ERROR in Owner Command:', error?.message || error);
        
        try {
            const errorMessage = `
╭─────────────────────────────────╮
│ ❌ *System Error*
├─────────────────────────────────┤
│ Failed to load owner profile
│ Error: ${error?.message || 'Unknown error'}
╰─────────────────────────────────╯

Please try again later.
`.trim();

            await sock.sendMessage(chatId, { text: errorMessage }, { quoted: message });
        } catch (sendError) {
            console.error('❌ Could not send error message:', sendError?.message);
        }
    }
};

module.exports = ownerCommand;