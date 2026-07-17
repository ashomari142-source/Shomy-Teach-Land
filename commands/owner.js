const os = require('os');
const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ==============================================
// 👑 OWNER INFO CONFIG
// ==============================================
const CONFIG = {
    FOOTER: '⭐ SHOMY TEACH LAND ⭐',
    OWNER: {
        NAME: 'Shommy',
        TITLE: 'Base Developer',
        LOCATION: 'Tanzania 🇹🇿',
        PHONE_1: '0615944741',
        PHONE_2: '0612130873',
        INSTAGRAM: '@mickdady_official',
        GITHUB: 'Mickeymozy'
    },
    // ✅ Picha ya LOCAL (Root directory)
    IMAGE_PATH: path.join(process.cwd(), 'OMMY.jpg')
};

/**
 * Main owner command handler
 */
const ownerCommand = async (sock, chatId, message) => {
    const safeMessage = message || {};
    const messageKey = safeMessage.key || {};

    console.log('[owner] invoked for', chatId);

    try {
        // ✅ Muonekano kama kwenye picha yako
        const statusMessage = `╔═══════════════════════════════╗
║     👑 *OWNER INFO* 👑        ║
╚═══════════════════════════════╝

👤 *Jina:* ${CONFIG.OWNER.NAME}
💼 *Cheo:* ${CONFIG.OWNER.TITLE}
📍 *Mahali:* ${CONFIG.OWNER.LOCATION}
📱 *Namba 1:* ${CONFIG.OWNER.PHONE_1}
📱 *Namba 2:* ${CONFIG.OWNER.PHONE_2}

╔═══════════════════════════════╗
║   📞 *CONTACT OPTIONS*        ║
╚═══════════════════════════════╝

👇 *Bonyeza vitufe vilivyo hapa chini:*

❤️ *Mickey Glitch Technology™*`;

        // ✅ Buttons (2 tu kama kwenye picha)
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

        // ✅ Function ya kupunguza picha
        async function resizeImg(buffer, width = 300, height = 300) {
            try {
                const sharp = require('sharp');
                return await sharp(buffer)
                    .resize(width, height, { fit: 'cover' })
                    .jpeg({ quality: 85 })
                    .toBuffer();
            } catch (e) {
                console.error('[owner] Resize failed:', e.message);
                return buffer;
            }
        }

        // ✅ Send message with image
        const sendNativeButtonV2 = async () => {
            let thumbnailBuffer = null;

            // ✅ Jaribu kupakia picha LOCAL
            const localImage = getLocalImage();
            if (localImage) {
                try {
                    thumbnailBuffer = await resizeImg(localImage, 300, 300);
                    console.log('[owner] Local image ready, size:', thumbnailBuffer.length);
                } catch (e) {
                    console.error('[owner] Failed to process local image:', e.message);
                }
            }

            // ✅ Kama hakuna picha local, jaribu online backup
            if (!thumbnailBuffer) {
                try {
                    console.log('[owner] Trying online backup...');
                    const onlineUrl = 'https://raw.githubusercontent.com/Mickeymozy/Shomy-Teach-Land-/main/OMMY.jpg';
                    const res = await axios.get(onlineUrl, { 
                        responseType: 'arraybuffer', 
                        timeout: 10000 
                    });
                    const buf = Buffer.from(res.data);
                    thumbnailBuffer = await resizeImg(buf, 300, 300);
                    console.log('[owner] Online image loaded');
                } catch (e) {
                    console.error('[owner] Online backup failed:', e.message);
                }
            }

            const contextInfo = {
                forwardingScore: 999,
                isForwarded: true
            };

            const mentionJid = messageKey.participant || messageKey.remoteJid;
            if (mentionJid) contextInfo.mentionedJid = [mentionJid];

            // ✅ Generate message
            const msg = generateWAMessageFromContent(chatId, {
                buttonsMessage: {
                    contentText: statusMessage,
                    footerText: CONFIG.FOOTER,
                    headerType: 6,
                    locationMessage: {
                        degreesLatitude: -6.7924,
                        degreesLongitude: 39.2083,
                        name: CONFIG.OWNER.NAME,
                        address: CONFIG.OWNER.TITLE,
                        jpegThumbnail: thumbnailBuffer
                    },
                    viewOnce: true,
                    contextInfo,
                    buttons: nativeButtons
                }
            }, { 
                userJid: (sock && sock.user && sock.user.id) || '', 
                quoted: message || undefined 
            });

            // ✅ Send
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
            console.error('[owner] Send failed:', e.message);
            // ✅ Fallback: Tuma text tu
            await sock.sendMessage(chatId, { 
                text: statusMessage,
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 999
                }
            }, { quoted: message });
        }

    } catch (error) {
        console.error('Owner Error:', error);
        try {
            await sock.sendMessage(chatId, { 
                text: '❌ *Error!* Tafadhali jaribu tena.' 
            }, { quoted: message });
        } catch (e) { 
            console.error('Final error:', e);
        }
    }
};

module.exports = ownerCommand;