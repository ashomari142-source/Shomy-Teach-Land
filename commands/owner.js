const os = require('os');
const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const axios = require('axios');

// ==============================================
// 👑 OWNER INFO CONFIG - IMEBORESHA
// ==============================================
const CONFIG = {
    FOOTER: '👑 MICKDADY • PROFILE 👑',
    OWNER: {
        NAME: 'Mickdady',
        TITLE: 'Base Developer',
        LOCATION: 'Tanzania 🇹🇿',
        PHONE_1: '0615944741',
        PHONE_2: '0612130873',
        INSTAGRAM: '@mickdady_official',
        GITHUB: 'github.com/Mickeymozy'
    },
    // ✅ Picha Moja Tu (Imebadilishwa)
    IMAGE: 'https://github.com/Mickeymozy/Shomy-Teach-Land-/blob/main/OMMY.jpg'
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
        // 1. Picha Moja Tu (Fixed)
        const ownerImage = CONFIG.IMAGE;

        // 2. Muonekano ulioboreshwa wa maandishi
        const statusMessage = `╔═══════════════════════════════╗
║     👑 *OWNER PROFILE* 👑      ║
╚═══════════════════════════════╝

👤 *Jina:* ${CONFIG.OWNER.NAME}
💼 *Cheo:* ${CONFIG.OWNER.TITLE}
📍 *Mahali:* ${CONFIG.OWNER.LOCATION}
📱 *Namba:* ${CONFIG.OWNER.PHONE_1}
📱 *Namba 2:* ${CONFIG.OWNER.PHONE_2}
📸 *Instagram:* ${CONFIG.OWNER.INSTAGRAM}
💻 *GitHub:* ${CONFIG.OWNER.GITHUB}

╔═══════════════════════════════╗
║     📞 *CONTACT OPTIONS*       ║
╚═══════════════════════════════╝

👇 *Bonyeza vitufe vilivyo hapa chini:*

❤️ *𝚂𝚑𝚘𝚖𝚢 𝚃𝚎𝚊𝚌𝚑 𝙻𝚊𝚗𝚍™*`;

        // 3. Buttons zilizoboreshwa (3 buttons)
        const nativeButtons = [
            { 
                buttonId: `phone:${CONFIG.OWNER.PHONE_1}`, 
                buttonText: { displayText: `📞 Call ${CONFIG.OWNER.PHONE_1}` }, 
                type: 1 
            },
            { 
                buttonId: `phone:${CONFIG.OWNER.PHONE_2}`, 
                buttonText: { displayText: `📞 Call ${CONFIG.OWNER.PHONE_2}` }, 
                type: 1 
            },
            { 
                buttonId: '.menu', 
                buttonText: { displayText: `📂 Menu` }, 
                type: 1 
            }
        ];

        const fetchBuffer = async (url) => {
            const res = await axios.get(url, { 
                responseType: 'arraybuffer', 
                timeout: 15000 
            });
            return Buffer.from(res.data);
        };

        async function resizeImg(buffer, width = 400, height = 400) {
            try {
                const sharp = require('sharp');
                return await sharp(buffer)
                    .resize(width, height, { 
                        fit: 'cover',
                        position: 'center' 
                    })
                    .jpeg({ quality: 85 })
                    .toBuffer();
            } catch {
                return buffer;
            }
        }

        const sendNativeButtonV2 = async () => {
            let thumbnailBuffer = null;
            
            // ✅ Picha Moja Tu - Inatumika Kila Wakati
            if (ownerImage) {
                try {
                    console.log('[owner] Loading image:', ownerImage);
                    const buf = await fetchBuffer(ownerImage);
                    thumbnailBuffer = await resizeImg(buf, 400, 400);
                    console.log('[owner] Image loaded successfully');
                } catch (e) {
                    console.error('[owner] Image fetch failed:', e && e.message ? e.message : e);
                }
            }

            const contextInfo = {
                forwardingScore: 999,
                isForwarded: true,
                forwardingSource: {
                    name: '𝚂𝚑𝚘𝚖𝚢 𝚃𝚎𝚊𝚌𝚑 𝙻𝚊𝚗𝚍'
                }
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
                        degreesLatitude: -6.7924,  // Dar es Salaam
                        degreesLongitude: 39.2083,  // Dar es Salaam
                        name: CONFIG.OWNER.NAME,
                        address: `${CONFIG.OWNER.TITLE} • ${CONFIG.OWNER.LOCATION}`,
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

            // Send message
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
                await sock.sendMessage(chatId, { 
                    text: statusMessage,
                    contextInfo: {
                        isForwarded: true,
                        forwardingScore: 999
                    }
                }, { quoted: message });
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
        } catch (e) { 
            console.error('Final error handler failed:', e);
        }
    }
};

module.exports = ownerCommand;