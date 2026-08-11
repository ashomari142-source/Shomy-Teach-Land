const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const moment = require('moment-timezone');
const { randomBytes } = require('crypto');

// Paths za kuhifadhi data
const STATE_PATH = path.join(__dirname, '..', 'data', 'chatbot.json');
const MEMORY_PATH = path.join(__dirname, '..', 'data', 'chatbot_memory.json');

// --- DATA HELPERS ---
function loadState() {
    try {
        if (!fs.existsSync(STATE_PATH)) return { perGroup: {}, private: false };
        const data = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
        return { perGroup: {}, private: false, ...data };
    } catch (e) { 
        return { perGroup: {}, private: false }; 
    }
}

function saveState(state) {
    try {
        const dir = path.dirname(STATE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
    } catch (e) { console.error('❌ State Save Err:', e); }
}

function loadMemory() {
    try {
        if (!fs.existsSync(MEMORY_PATH)) return {};
        const data = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
        const now = Date.now();
        let changed = false;
        
        // Futa conversation_id za zamani baada ya dakika 30 zisipotumika
        for (const id in data) {
            if (data[id].lastUpdate && (now - data[id].lastUpdate > 1800000)) {
                delete data[id];
                changed = true;
            }
        }
        if (changed) saveMemory(data);
        return data;
    } catch (e) { return {}; }
}

function saveMemory(memory) {
    try {
        const dir = path.dirname(MEMORY_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2));
    } catch (e) { console.error('❌ Memory Save Err:', e); }
}

function extractText(m) {
    try {
        if (!m || !m.message) return '';
        const msg = m.message;
        return (msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || '').trim();
    } catch (e) { return ''; }
}

function getSenderName(m) {
    const pushName = m?.pushName || m?.message?.pushName;
    if (pushName && pushName.trim()) return pushName.trim();
    const participant = m?.key?.participant || m?.key?.remoteJid;
    if (participant) {
        const namePart = participant.split('@')[0];
        if (namePart && namePart !== 'status' && namePart !== '0') return namePart;
    }
    return 'Mteja';
}

// --- MAIN CHATBOT HANDLER ---
async function handleChatbotMessage(sock, chatId, m) {
    try {
        if (!chatId || m.key?.fromMe) return;

        const userText = extractText(m);
        if (!userText || userText.startsWith('.')) return; 

        const state = loadState();
        const isGroup = chatId.endsWith('@g.us');
        const enabled = isGroup ? !!state.perGroup?.[chatId]?.enabled : !!state.private;

        if (!enabled) return;

        const botName = sock?.user?.name || '𝚂𝚑𝚘𝚖𝚢 𝚃𝚎𝚊𝚌𝚑 𝙻𝚊𝚗𝚍';
        const senderName = getSenderName(m);
        console.log(`\x1b[36m🤖 [${botName} AI]:\x1b[0m ${senderName}: ${userText.substring(0, 40)}...`);

        try { await sock.sendPresenceUpdate('composing', chatId); } catch (e) {}

        // Kuchukua memory ya conversation_id kama ipo
        let memory = loadMemory();
        let conversationId = memory[chatId]?.conversation_id || '';

        // Kuweka jina la sender kwenye ujumbe
        const fullPrompt = `[Mtumiaji anaitwa: ${senderName}]. ${userText}`;

        // Tumia Prexzy API mpya kuondoa EAI_AGAIN error
        let apiUrl = `https://prexzyapis.com/ai/chatbot?text=${encodeURIComponent(fullPrompt)}`;
        if (conversationId) {
            apiUrl += `&conversation_id=${encodeURIComponent(conversationId)}`;
        }

        const res = await fetch(apiUrl, { timeout: 15000 }).then(r => r.json()).catch(() => null);
        
        const reply = res?.data?.response;
        const newConversationId = res?.data?.conversation_id;

        if (!reply) return;

        // Hifadhi conversation_id mpya
        if (newConversationId) {
            memory[chatId] = {
                conversation_id: newConversationId,
                lastUpdate: Date.now()
            };
            saveMemory(memory);
        }

        // ─── MUUNDO MPYA WA AI RICH UTAMU (AI ICON INJECTOR) ───
        const aiMessage = {
            conversation: reply,
            messageContextInfo: {
                messageSecret: randomBytes(32),
                supportPayload: JSON.stringify({
                    version: 1,
                    is_ai_message: true,
                    should_show_system_message: true,
                    ticket_id: Date.now().toString()
                })
            }
        };

        await sock.relayMessage(chatId, aiMessage, {
            additionalNodes: [
                { "attrs": { "biz_bot": "1" }, "tag": "bot" },
                { "attrs": {}, "tag": "biz" }
            ],
            quoted: m
        });

    } catch (e) { 
        console.error('❌ Chatbot Error:', e); 
    }
}

// --- TOGGLE COMMAND (.chatbot on/off) ---
async function groupChatbotToggleCommand(sock, chatId, m, body) {
    try {
        const state = loadState();
        const args = (body || '').trim().split(/\s+/).slice(1);

        if (args.length === 0) {
            return await sock.sendMessage(chatId, { 
                text: '💡 *MATUMIZI:* \n.chatbot on/off\n.chatbot private on/off' 
            }, { quoted: m });
        }

        const firstArg = args[0].toLowerCase();

        if (firstArg === 'private') {
            const mode = args[1]?.toLowerCase();
            state.private = (mode === 'on');
            saveState(state);
            return await sock.sendMessage(chatId, { text: `✅ Chatbot Private Mode: *${state.private ? 'ON' : 'OFF'}*` }, { quoted: m });
        }

        if (['on', 'off'].includes(firstArg)) {
            const modeStatus = (firstArg === 'on');
            if (chatId.endsWith('@g.us')) {
                if (!state.perGroup) state.perGroup = {};
                state.perGroup[chatId] = { enabled: modeStatus };
                saveState(state);
                return await sock.sendMessage(chatId, { text: `✅ Chatbot Group: *${modeStatus ? 'ON' : 'OFF'}*` }, { quoted: m });
            } else {
                state.private = modeStatus;
                saveState(state);
                return await sock.sendMessage(chatId, { text: `✅ Chatbot Private: *${modeStatus ? 'ON' : 'OFF'}*` }, { quoted: m });
            }
        }

    } catch (e) { console.error('❌ Toggle Error:', e); }
}

module.exports = {
    handleChatbotMessage, 
    groupChatbotToggleCommand
};
