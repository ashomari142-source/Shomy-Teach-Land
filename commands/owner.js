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
        NAME: 'Shomy Teach',
        TITLE: 'Developer',
        LOCATION: 'Tanzania 🇹🇿',
        PHONE: '255790991272',
        INSTAGRAM: '@shomyteach',
        GITHUB: 'ShomyTeach'
    },
    IMAGE: 'https://raw.githubusercontent.com/Mickeymozy/Shomy-Teach-Land-/main/OMMY.jpg'
};

/**
 * Main owner command handler
 */
const ownerCommand = async (sock, chatId, message) => {
    const safeMessage = message || {};
    const messageKey = safeMessage.key || {};

    console.log('[owner] invoked for', chatId);

    try {
        const ownerImage = CONFIG.IMAGE;

        // ✅ Muonekano Mfupi na Mzuri
        const statusMessage = `╔══════════════════════╗
║  👑 *OWNER* 👑   ║
╚══════════════════════╝

👤 ${CONFIG.OWNER.NAME}
💼 ${CONFIG.OWNER.TITLE}
📍 ${CONFIG.OWNER.LOCATION}
📱 ${CONFIG.OWNER.PHONE}
📸 ${CONFIG.OWNER.INSTAGRAM}
💻 ${CONFIG.OWNER.GITHUB}

╔══════════════════════╗
║  📞 *CONTACT*  ║
╚══════════════════════╝

👇 *Bonyeza chini:*

❤️ *Shomy Teach Land*`;

        // ✅ Buttons (3 tu)
        const nativeButtons = [
            { 
                buttonId: `phone:${CONFIG.OWNER.PHONE}`, 
                buttonText: { displayText: `📞 Call` }, 
                type: 1 
            },
            { 
                buttonId: `.menu`, 
                buttonText: { displayText: `📂 Menu` }, 
                type: 1 
            },
            { 
                buttonId: `.alive`, 
                buttonText: { displayText: `✨ Alive` }, 
                type: 1 
            }
        ];

        // ✅ Function ya kupakia picha
        const fetchBuffer = async (url) => {
            try {
                console.log('[owner] Downloading image...');
                const res = await axios.get(url, { 
                    responseType: 'arraybuffer', 
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0'
                    }
                });
                console.log('[owner] Image downloaded, size:', res.data.length);
                return Buffer.from(res.data);
            } catch (e) {
                console.error('[owner] Download failed:', e.message);
                return null;
            }
        };

        // ✅ Function ya kupunguza picha
        async function resizeImg(buffer, width = 300, height = 300) {
            try {
                const sharp = require('sharp');
                return await sharp(buffer)
                    .resize(width, height, { fit: 'cover' })
                    .jpeg({ quality: 80 })
                    .toBuffer();
            } catch (e) {
                console.error('[owner] Resize failed:', e.message);
                return buffer;
            }
        }

        // ✅ Send message with image
        const sendNativeButtonV2 = async () => {
            let thumbnailBuffer = null;

            // Jaribu kupakia picha
            if (ownerImage) {
                try {
                    const buf = await fetchBuffer(ownerImage);
                    if (buf) {
                        thumbnailBuffer = await resizeImg(buf, 300, 300);
                        console.log('[owner] Image ready, size:', thumbnailBuffer.length);
                    }
                } catch (e) {
                    console.error('[owner] Image error:', e.message);
                }
            }

            // Ikiwa picha haijapakua, tumia local image au icon
            if (!thumbnailBuffer) {
                try {
                    // Jaribu kutumia local image ikiwa ipo
                    const localPath = path.join(__dirname, '../media/owner.jpg');
                    if (fs.existsSync(localPath)) {
                        thumbnailBuffer = fs.readFileSync(localPath);
                        console.log('[owner] Using local image');
                    }
                } catch (e) {
                    console.log('[owner] No local image found');
                }
            }

            const contextInfo = {
                forwardingScore: 999,
                isForwarded: true
            };

            const mentionJid = messageKey.participant || messageKey.remoteJid;
            if (mentionJid) contextInfo.mentionedJid = [mentionJid];

            // Generate message
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

            // Send
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
            // Fallback: Tuma text tu
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