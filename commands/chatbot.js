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

// --- HUMANIZE RESPONSE ---
function humanizeResponse(text) {
    if (!text) return text;
    
    // Fupisha majibu marefu sana
    if (text.length > 800) {
        text = text.substring(0, 800) + '...';
    }
    
    // Ongeza misemo ya mtaani mara kwa mara
    const shengPhrases = [
        'bana', 'mzee', 'kipo', 'mambo', 'vipi', 'sawa', 
        'poa', 'freshi', 'shwari', 'mzuka', 'boss', 'dah',
        'eish', 'walahi', 'acha', 'kabisa', 'japo', 'hata',
        'kumbe', 'vilevile', 'hiyo', 'ndiyo', 'sio', 'basi'
    ];
    
    // Ongeza emoji mara kwa mara
    const emojis = ['😄', '😂', '🔥', '💯', '🙌', '👊', '🤝', '✨', '💪', '😎'];
    
    // Kama jibu ni fupi, ongeza emoji
    if (text.length < 100 && Math.random() > 0.6) {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        text = text + ' ' + randomEmoji;
    }
    
    return text;
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

        const botName = 'Shomy Teach Land';
        const senderName = getSenderName(m);
        console.log(`\x1b[36m👤 [${botName}]:\x1b[0m ${senderName}: ${userText.substring(0, 40)}...`);

        try { await sock.sendPresenceUpdate('composing', chatId); } catch (e) {}

        // Kuchukua memory ya conversation_id kama ipo
        let memory = loadMemory();
        let conversationId = memory[chatId]?.conversation_id || '';

        // ─── PROMPT KALI KAMA MWANADAMU WA SHOMY TEACH LAND ───
        const fullPrompt = `Unajifanya kuwa Shomy Teach Land, mwanadamu halisi mwenye tabia za kipekee.

TAARIFA ZAKO:
• Jina: Shomy Teach Land
• Umri: 26
• Mji: Dar es Salaam, Tanzania
• Kazi: Mwalimu na mjasiriamali
• Tabia: Mcheshi sana, mkarimu, anapenda kucheka, ana staili ya mtaani
• Anajulikana kwa: Kufundisha watu mambo mengi (Teach Land)

STAYILI YA KUJIBU:
• Anatumia lugha ya Kiswahili na Kiingereza iliyochanganywa (Sheng)
• Anatumia misemo ya mtaani: "bana", "mzee", "kipo", "mambo", "vipi", "sawa", "poa", "freshi", "shwari", "mzuka"
• Anajibu kama rafiki wa karibu, sio kama AI au roboti
• Anapenda kutoa ushauri na kufundisha watu
• Majibu yake ni mafupi, ya moja kwa moja, na ya kufurahisha
• Anatumia vitenzi vya mtaani na misemo ya kawaida

Sasa wewe ni Shomy Teach Land, mwanadamu halisi. Mteja aliyezungumza nawe ni ${senderName}. Ujumbe wake ni: "${userText}"

Jibu kwa staili yako ya kawaida kama binadamu wa mtaani - fupi, rahisi, na kwa tabia yako ya kufundisha na kuchekesha.`;

        // Tumia Prexzy API
        let apiUrl = `https://prexzyapis.com/ai/chatbot?text=${encodeURIComponent(fullPrompt)}`;
        if (conversationId) {
            apiUrl += `&conversation_id=${encodeURIComponent(conversationId)}`;
        }

        const res = await fetch(apiUrl, { timeout: 15000 }).then(r => r.json()).catch(() => null);

        let reply = res?.data?.response;
        const newConversationId = res?.data?.conversation_id;

        // Kama hakuna jibu, tumia default reply
        if (!reply) {
            const defaultReplies = [
                "Mambo vipi bana! Samahani nimekosa kidogo, unaweza kurudia? 😄",
                "Eish mzee, sikusikia vizuri. Rudia tena tafadhali! 💪",
                "Poa sana! Lakini sijaelewa vizuri, unaweza kueleza zaidi? 🙌",
                "Shwari mzee! Niko hapa, sema tena nikusikie vizuri. 👊"
            ];
            reply = defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
        }

        // Humanize reply
        reply = humanizeResponse(reply);

        // Hifadhi conversation_id mpya
        if (newConversationId) {
            memory[chatId] = {
                conversation_id: newConversationId,
                lastUpdate: Date.now(),
                lastMessage: userText,
                lastReply: reply
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
                text: `💡 *MATUMIZI:* 
.chatbot on/off
.chatbot private on/off
.chatbot status

👤 *Shomy Teach Land Chatbot* - Anajibu kama binadamu!` 
            }, { quoted: m });
        }

        const firstArg = args[0].toLowerCase();

        // Status command
        if (firstArg === 'status') {
            const statusText = `📊 *Hali ya Shomy Teach Land*

👥 *Group Mode:* ${state.perGroup?.[chatId]?.enabled ? '✅ IMEWASHA' : '❌ IMEZIMA'}
👤 *Private Mode:* ${state.private ? '✅ IMEWASHA' : '❌ IMEZIMA'}
💬 *Hali:* ${state.perGroup?.[chatId]?.enabled || state.private ? '🟢 Inafanya kazi' : '🔴 Imezimwa'}

👤 *Jina:* Shomy Teach Land
📍 *Mji:* Dar es Salaam
💡 *Tabia:* Mcheshi, mkarimu, mwalimu`;

            return await sock.sendMessage(chatId, { text: statusText }, { quoted: m });
        }

        if (firstArg === 'private') {
            const mode = args[1]?.toLowerCase();
            if (!['on', 'off'].includes(mode)) {
                return await sock.sendMessage(chatId, { 
                    text: '❌ Tafadhali tumia: .chatbot private on/off' 
                }, { quoted: m });
            }
            state.private = (mode === 'on');
            saveState(state);
            return await sock.sendMessage(chatId, { 
                text: `✅ *Private Chatbot:* ${state.private ? 'IMEZINDWA 🟢' : 'IMEZIMWA 🔴'}` 
            }, { quoted: m });
        }

        if (['on', 'off'].includes(firstArg)) {
            const modeStatus = (firstArg === 'on');
            if (chatId.endsWith('@g.us')) {
                if (!state.perGroup) state.perGroup = {};
                state.perGroup[chatId] = { enabled: modeStatus };
                saveState(state);
                return await sock.sendMessage(chatId, { 
                    text: `✅ *Group Chatbot:* ${modeStatus ? 'IMEZINDWA 🟢' : 'IMEZIMWA 🔴'}` 
                }, { quoted: m });
            } else {
                state.private = modeStatus;
                saveState(state);
                return await sock.sendMessage(chatId, { 
                    text: `✅ *Private Chatbot:* ${modeStatus ? 'IMEZINDWA 🟢' : 'IMEZIMWA 🔴'}` 
                }, { quoted: m });
            }
        }

        // Help
        if (firstArg === 'help') {
            return await sock.sendMessage(chatId, {
                text: `👤 *Shomy Teach Land Chatbot*

📌 *Amri:*
• .chatbot on - Washa chatbot
• .chatbot off - Zima chatbot
• .chatbot private on - Washa private mode
• .chatbot private off - Zima private mode
• .chatbot status - Angalia hali
• .chatbot help - Msaada huu

🔧 *Tabia za Shomy:*
• Mcheshi na mkarimu
• Anafundisha kwa mbinu za mtaani
• Anatumia Sheng na misemo ya kawaida
• Anajibu kama rafiki wa karibu
• Sio AI - ni mwanadamu halisi!

💬 *Tuma ujumbe wowote kuanza mazungumzo!*`
            }, { quoted: m });
        }

    } catch (e) { console.error('❌ Toggle Error:', e); }
}

// --- HELP FUNCTION ---
function getHelp() {
    return `👤 *Shomy Teach Land Chatbot*

📌 *Amri:*
• .chatbot on - Washa chatbot
• .chatbot off - Zima chatbot
• .chatbot private on - Washa private mode
• .chatbot private off - Zima private mode
• .chatbot status - Angalia hali

🔧 *Tabia za Shomy:*
• Mcheshi na mkarimu
• Anafundisha kwa mbinu za mtaani
• Anatumia Sheng na misemo ya kawaida
• Anajibu kama rafiki wa karibu
• Sio AI - ni mwanadamu halisi!

💬 *Tuma ujumbe wowote kuanza mazungumzo na Shomy!*`;
}

module.exports = {
    handleChatbotMessage, 
    groupChatbotToggleCommand,
    getHelp
};