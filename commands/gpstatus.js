const {
    downloadContentFromMessage,
    downloadMediaMessage,
    normalizeMessageContent
} = require('@whiskeysockets/baileys');

const COMMANDS = [
    'gpstatus',
    'gp-status',
    'uploadstatus',
    'upload-status',
    'status',
    'gstatus',
    'gcsw',
    'swgc',
    'upgcsw',
    'upswgc'
];

function getTextFromMessage(message) {
    if (!message) return '';

    const main = message?.message || message || {};
    const content = normalizeMessageContent(main) || main;

    return String(
        content?.conversation ||
        content?.extendedTextMessage?.text ||
        content?.imageMessage?.caption ||
        content?.videoMessage?.caption ||
        content?.documentMessage?.caption ||
        content?.audioMessage?.caption ||
        ''
    ).trim();
}

function getQuoted(message) {
    if (!message) return null;

    return (
        message?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        message?.quoted ||
        message?.msg?.msg?.contextInfo?.quotedMessage ||
        null
    );
}

function getQuotedText(quoted) {
    if (!quoted) return '';

    const msg = quoted?.message || quoted;

    return String(
        msg?.conversation ||
        msg?.extendedTextMessage?.text ||
        msg?.imageMessage?.caption ||
        msg?.videoMessage?.caption ||
        msg?.documentMessage?.caption ||
        msg?.audioMessage?.caption ||
        ''
    ).trim();
}

function cleanCommandText(text) {
    if (!text) return '';

    let value = String(text).trim();
    const commandRegex = new RegExp(
        `^[.!/#]?(${COMMANDS.join('|')})(?:\\s+|$)`,
        'i'
    );

    value = value.replace(commandRegex, '').trim();
    return value;
}

function getMediaType(message, quoted = null) {
    const current = normalizeMessageContent(message?.message) || message?.message || {};
    const quotedRaw = quoted?.message || quoted || {};
    const quotedContent = normalizeMessageContent(quotedRaw) || quotedRaw;

    if (current.imageMessage || quotedContent.imageMessage) return 'image';
    if (current.videoMessage || quotedContent.videoMessage) return 'video';
    return null;
}

function getMediaMessage(message, type) {
    if (!type) return null;

    const key = `${type}Message`;
    const currentContent = normalizeMessageContent(message?.message) || message?.message || {};
    const quotedRaw = getQuoted(message)?.message || getQuoted(message) || {};
    const quotedContent = normalizeMessageContent(quotedRaw) || quotedRaw;

    if (currentContent[key]) return currentContent[key];
    if (quotedContent[key]) return quotedContent[key];
    if (message?.quoted?.[key]) return message.quoted[key];
    if (message?.msg?.msg?.[key]) return message.msg.msg[key];

    return null;
}

async function downloadMedia(message, type) {
    let lastError = null;

    const downloadContent = async (mediaMessage) => {
        if (!mediaMessage) return null;

        const stream = await downloadContentFromMessage(mediaMessage, type);
        const chunks = [];

        for await (const chunk of stream) {
            chunks.push(chunk);
        }

        const buffer = Buffer.concat(chunks);
        return buffer.length > 0 ? buffer : null;
    };

    try {
        const mediaMessage = getMediaMessage(message, type);
        const buffer = await downloadContent(mediaMessage);
        if (buffer) return buffer;
    } catch (error) {
        lastError = error;
    }

    try {
        if (message?.message && message.message[type + 'Message']) {
            const buffer = await downloadContent(message.message[type + 'Message']);
            if (buffer) return buffer;
        }
    } catch (error) {
        lastError = error;
    }

    try {
        const quoted = getQuoted(message);
        const mediaMessage = quoted?.[type + 'Message'] || quoted?.message?.[type + 'Message'];
        const buffer = await downloadContent(mediaMessage);
        if (buffer) return buffer;
    } catch (error) {
        lastError = error;
    }

    try {
        if (message?.key && message?.message) {
            const buffer = await downloadMediaMessage(
                message,
                'buffer',
                {},
                { logger: undefined }
            );

            if (buffer && Buffer.isBuffer(buffer) && buffer.length > 0) {
                return buffer;
            }
        }
    } catch (error) {
        lastError = error;
    }

    if (lastError) {
        console.error('[GPSTATUS DOWNLOAD ERROR]', lastError);
    }

    return null;
}

const gpstatusCommand = async (sock, chatId, message) => {
    try {
        const rawText = getTextFromMessage(message) || message?.text || '';
        const commandText = cleanCommandText(rawText);
        const quoted = getQuoted(message);
        const quotedText = getQuotedText(quoted);
        const input = commandText || quotedText || '';
        const isViewOnce = /viewonce|once/i.test(rawText);

        if (!rawText && !quoted) {
            await sock.sendMessage(chatId, {
                text: '📸 *GROUP STATUS*\n\nReply picha/video kisha tuma:\n. gpstatus\n\nAu:\n.gpstatus caption text\n\n.gpstatus viewonce'
            }, { quoted: message });
            return;
        }

        if (!quoted && !message?.message?.imageMessage && !message?.message?.videoMessage) {
            await sock.sendMessage(chatId, {
                text: '📸 *Matumizi:* Reply picha/video kisha tuma `.gpstatus`\n\n• `.gpstatus`\n• `.gpstatus viewonce`\n• `.gpstatus Caption text`'
            }, { quoted: message });
            return;
        }

        const mediaType = getMediaType(message, quoted);
        let mediaBuffer = null;

        if (mediaType) {
            mediaBuffer = await downloadMedia(message, mediaType);

            if (!mediaBuffer) {
                await sock.sendMessage(chatId, {
                    text: '❌ Imeshindikana kupakua media. Tafadhali jaribu tena na u-reply picha/video moja kwa moja.'
                }, { quoted: message });
                return;
            }
        }

        if (!input && !mediaBuffer) {
            await sock.sendMessage(chatId, {
                text: '📤 *GROUP STATUS*\n\nTuma text:\n.gpstatus Hello group\n\nAu reply image/video kisha tuma:\n.gpstatus'
            }, { quoted: message });
            return;
        }

        const mediaMessage = getMediaMessage(message, mediaType);
        const statusCaption = input.replace(/viewonce/gi, '').trim() ||
            mediaMessage?.caption ||
            (mediaType === 'image' ? '📸 Status' : '🎥 Status');

        const statusContext = {
            statusAudienceMetadata: {
                audienceType: 1,
                listName: `Group Status - ${chatId.split('@')[0]}`,
                listEmoji: '🏷️'
            }
        };

        const payload = mediaType === 'image'
            ? {
                image: mediaBuffer,
                caption: statusCaption,
                viewOnce: isViewOnce,
                contextInfo: statusContext,
                groupStatus: true
            }
            : mediaType === 'video'
                ? {
                    video: mediaBuffer,
                    caption: statusCaption,
                    gifPlayback: false,
                    viewOnce: isViewOnce,
                    contextInfo: statusContext,
                    groupStatus: true
                }
                : {
                    text: statusCaption,
                    contextInfo: statusContext,
                    groupStatus: true
                };

        await sock.sendMessage('status@broadcast', payload, {
            statusJidList: [chatId]
        });

        await sock.sendMessage(chatId, {
            text: `✅ *Success!* Status imetumwa kwenye WhatsApp Official Status.\n\n📊 *Type:* ${mediaType === 'image' ? '🖼️ Image' : mediaType === 'video' ? '🎥 Video' : '📝 Text'}\n📝 *Caption:* ${statusCaption}`
        }, { quoted: message });

    } catch (error) {
        console.error('[GPSTATUS ERROR]', error);
        await sock.sendMessage(chatId, {
            text: `❌ *Error:* ${error.message || 'Failed to send status. Try again later.'}`
        }, { quoted: message });
    }
};

module.exports = gpstatusCommand;
