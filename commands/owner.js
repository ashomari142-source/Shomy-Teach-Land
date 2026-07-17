const os = require('os');
const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ==============================================
// 👑 OWNER INFO CONFIG
// ==============================================
const CONFIG = {
    FOOTER: '👑 SHOMY TEACH • PROFILE 👑',
    OWNER: {
        NAME: 'Shomy Teach',
        TITLE: 'Base Developer',
        LOCATION: 'Tanzania 🇹🇿',
        PHONE_1: '255790991272',
        PHONE_2: '255612130873'
    },
    // ✅ Picha ya LOCAL (Root directory)
    IMAGE_PATH: path.join(process.cwd(), 'OMMY.jpg')
};

/**
 * Main owner command handler
 */
const ownerCommand = async (sock, chatId, message) => {
    // Linda isisababishe crash kama message iko undefined
    const safeMessage = message || {};
    const messageKey = safeMessage.key || {};
    
    console.log('[owner] invoked for', chatId, 'from', messageKey.participant || messageKey.remoteJid || 'Unknown');

    try {
        // ✅ Muonekano kama wa awali lakini umeboreshwa
        const statusMessage = `🤖 *— OWNER INFO*\n\n` +
            `👤 *Jina:* ${CONFIG.OWNER.NAME}\n` +
            `💼 *Cheo:* ${CONFIG.OWNER.TITLE}\n` +
            `📍 *Mahali:* ${CONFIG.OWNER.LOCATION}\n\n` +
            `_Shomy Teach Technology™_`;

        // ✅ Buttons (2 tu)
        const nativeButtons = [
            { 
                buttonId: `phone:${CONFIG.OWNER.PHONE_1}`, 
                buttonText: { displayText: `📞 Call Line 1 (${CONFIG.OWNER.PHONE_1})` }, 
                type: 1 
            },
            { 
                buttonId: `phone:${CONFIG.OWNER.PHONE_2}`, 
                buttonText: { displayText: `📞 Call Line 2 (${CONFIG.OWNER.PHONE_2})` }, 
                type: 1 
            }
        ];

        // ✅ Function ya kupakia picha LOCAL
        const getLocalImage = () => {
            try {
                const imagePath = CONFIG.IMAGE_PATH;
                console.log('[owner] Looking for image at:', imagePath);
                
                if (fs.existsSync(imagePath)) {
                    const imageBuffer = fs.readFileSync(imagePath);
                    console.log('[owner] Local image found, size:', imageBuffer.length);
                    return imageBuffer;
                } else {
                    console.log('[owner] Local image NOT found at:', imagePath);
                    return null;
                }
            } catch (e) {
                console.error('[owner] Error reading local image:', e.message);
                return null;
            }
        };

        const fetchBuffer = async (url) => {
            const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
            return Buffer.from(res.data);
        };

        async function resizeImg(buffer, width = 300, height = 300) {
            try {
                const sharp = require('sharp');
                return await sharp(buffer).resize(width, height, { fit: 'cover' }).toBuffer();
            } catch {
                return buffer;
            }
        }

        const sendNativeButtonV2 = async () => {
            let thumbnailBuffer = null;

            // ✅ Kwanza jaribu picha LOCAL
            const localImage = getLocalImage();
            if (localImage) {
                try {
                    thumbnailBuffer = await resizeImg(localImage, 300, 300);
                    console.log('[owner] Local image ready, size:', thumbnailBuffer.length);
                } catch (e) {
                    console.error('[owner] Failed to process local image:', e.message);
                }
            }

            // ✅ Kama hakuna local, jaribu online backup
            if (!thumbnailBuffer) {
                try {
                    console.log('[owner] Trying online backup...');
                    const onlineUrl = 'https://raw.githubusercontent.com/Mickeymozy/Shomy-Teach-Land-/main/OMMY.jpg';
                    const buf = await fetchBuffer(onlineUrl);
                    thumbnailBuffer = await resizeImg(buf, 300, 300);
                    console.log('[owner] Online image loaded');
                } catch (e) {
                    console.error('[owner] Online backup failed:', e.message);
                }
            }

            const contextInfo = {
                forwardingScore: 999,
                isForwarded: true,
            };
            const mentionJid = messageKey.participant || messageKey.remoteJid;
            if (mentionJid) contextInfo.mentionedJid = [mentionJid];

            // ✅ Muundo wa buttonsMessage na locationMessage
            const msg = generateWAMessageFromContent(chatId, {
                buttonsMessage: {
                    contentText: statusMessage,
                    footerText: CONFIG.FOOTER,
                    headerType: 6,
                    locationMessage: {
                        degreesLatitude: 0,
                        degreesLongitude: 0,
                        name: CONFIG.OWNER.NAME,
                        address: CONFIG.OWNER.TITLE,
                        jpegThumbnail: thumbnailBuffer
                    },
                    viewOnce: true,
                    contextInfo,
                    buttons: nativeButtons
                }
            }, { userJid: (sock && sock.user && sock.user.id) || '', quoted: message || undefined });

            // ✅ Kutuma kwa relayMessage
            await sock.relayMessage(chatId, msg.message, {
                messageId: msg.key?.id || sock.generateMessageID(),
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
        };

        try {
            await sendNativeButtonV2();
        } catch (e) {
            console.error('[owner] sendNativeButtonV2 failed:', e && e.message ? e.message : e);
            try {
                await sock.sendMessage(chatId, { text: statusMessage }, { quoted: message });
            } catch (ee) {
                console.error('[owner] fallback send failed', ee && ee.message ? ee.message : ee);
            }
        }

    } catch (error) {
        console.error('Critical Error in Owner Command:', error);
        try {
            await sock.sendMessage(chatId, { 
                text: '❌ *System Error:* Kushindwa kupakia wasifu.\n```' + error.message + '```' 
            }, { quoted: message });
        } catch (e) { }
    }
};

module.exports = ownerCommand;