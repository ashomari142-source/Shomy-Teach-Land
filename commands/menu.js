/**
 * @project: 𝚂𝚑𝚘𝚖𝚢 𝚃𝚎𝚊𝚌𝚑 𝙻𝚊𝚗𝚍 V3.0.5
 * @author: Quantum Base Developer (TZ)
 * @version: 3.0.5
 */

const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const { ButtonV2 } = require('../lib/messageBuilder');
const os = require('os');
const chalk = require('chalk');

// ==============================================
// 📊 BOT STATS
// ==============================================
let botStats = {
    users: 0,
    groups: 0,
    commandsExecuted: 0,
    startTime: Date.now(),
    totalMessages: 0,
    activeChats: 0
};

try {
    if (global.botStats) botStats = { ...botStats, ...global.botStats };
    const settingsPath = path.join(process.cwd(), 'settings.js');
    if (fs.existsSync(settingsPath)) {
        const settings = require(settingsPath);
        if (settings.botStats) botStats = { ...botStats, ...settings.botStats };
    }
} catch (e) {}

// ==============================================
// 📊 SYSTEM STATS
// ==============================================
const getSystemStats = () => {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const cmdCount = global.commands ? Object.keys(global.commands).length : 0;

    return {
        uptime: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        memoryUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        memoryTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
        cmdCount,
        users: botStats.users || 0,
        groups: botStats.groups || 0,
        commandsExecuted: botStats.commandsExecuted || 0,
        startTime: moment(botStats.startTime || Date.now()).format('DD/MM/YYYY HH:mm')
    };
};

// ==============================================
// 🎨 MENU ICONS - IMEBORESHA
// ==============================================
const icons = {
    'GENERAL': '🏠', 'GROUP': '👥', 'MODERATION': '🛡️',
    'MEDIA': '🎨', 'AUDIO/VIDEO': '🎵', 'DOWNLOAD': '📥',
    'FUN': '🎮', 'AUTOMATION': '🤖', 'AI/BOT': '🧠',
    'EFFECTS': '✨', 'OWNER/ADMIN': '👑', 'OTHER': '📂',
    'UTILITY': '🔧', 'GAMES': '🎯', 'SOCIAL': '💬',
    'TOOLS': '🛠️', 'ANIME': '🎭', 'DATABASE': '💾',
    'CONVERTER': '🔄', 'SEARCH': '🔍', 'EDUCATION': '📚'
};

// ==============================================
// 📂 LOAD DYNAMIC MENU
// ==============================================
const loadDynamicMenu = (showAll = true) => {
    const commandsDir = path.join(process.cwd(), 'commands');
    const dynamicMenu = {};
    const userCategories = ['GENERAL', 'GROUP', 'MODERATION', 'MEDIA', 'AUDIO/VIDEO', 
                           'DOWNLOAD', 'FUN', 'AUTOMATION', 'AI/BOT', 'EFFECTS', 
                           'UTILITY', 'GAMES', 'SOCIAL', 'TOOLS', 'ANIME', 
                           'DATABASE', 'CONVERTER', 'SEARCH', 'EDUCATION'];

    const addItem = (cat, item) => {
        const category = (cat || 'OTHER').toUpperCase();
        if (!dynamicMenu[category]) dynamicMenu[category] = [];
        if (!dynamicMenu[category].find(i => i.cmd === item.cmd)) {
            dynamicMenu[category].push({ ...item, category });
        }
    };

    const fileMapping = {
        'alive': 'GENERAL', 'ping': 'GENERAL', 'stats': 'GENERAL', 'owner': 'GENERAL', 
        'sticker': 'MEDIA', 'facebook': 'DOWNLOAD', 'tiktok': 'DOWNLOAD',
        'play': 'AUDIO/VIDEO', 'ai': 'AI/BOT', 'gpt': 'AI/BOT',
        'yt': 'DOWNLOAD', 'ig': 'DOWNLOAD', 'twitter': 'DOWNLOAD'
    };

    if (fs.existsSync(commandsDir)) {
        const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
        files.forEach(file => {
            const baseName = file.replace('.js', '');
            try {
                const cmdModule = require(path.join(commandsDir, file));
                const category = cmdModule.category || fileMapping[baseName] || 'OTHER';
                addItem(category, {
                    cmd: `.${baseName}`,
                    desc: cmdModule.description || `Cmd: ${baseName}`
                });
            } catch (e) {
                addItem(fileMapping[baseName] || 'OTHER', {
                    cmd: `.${baseName}`,
                    desc: `Cmd: ${baseName}`
                });
            }
        });
    }

    if (global.commands && typeof global.commands === 'object') {
        Object.values(global.commands).forEach(cmd => {
            if (cmd.name) {
                const category = cmd.category || fileMapping[cmd.name] || 'OTHER';
                addItem(category, {
                    cmd: `.${cmd.name}`,
                    desc: cmd.description || `Cmd: ${cmd.name}`
                });
            }
        });
    }

    return Object.keys(dynamicMenu)
        .filter(cat => showAll ? true : userCategories.includes(cat))
        .sort((a, b) => userCategories.indexOf(a) - userCategories.indexOf(b))
        .map(title => ({
            title,
            icon: icons[title] || '📌',
            items: dynamicMenu[title].sort((a, b) => a.cmd.localeCompare(b.cmd))
        }));
};

const getGreeting = (hour) => {
    if (hour >= 0 && hour <= 4) return { text: 'Usiku sana', emoji: '🌙', color: 'dark' };
    if (hour >= 5 && hour <= 11) return { text: 'Asubuhi', emoji: '🌅', color: 'morning' };
    if (hour >= 12 && hour <= 16) return { text: 'Mchana', emoji: '☀️', color: 'day' };
    if (hour >= 17 && hour <= 18) return { text: 'Jioni', emoji: '🌤️', color: 'evening' };
    return { text: 'Usiku', emoji: '🌙', color: 'night' };
};

// ==============================================
// 🎨 BUILD SECTIONS - IMEBORESHA
// ==============================================
const buildSections = (menuData) => {
    return menuData.map(cat => ({
        title: `${cat.icon} ${cat.title} (${cat.items.length})`,
        highlight_label: `${cat.items.length} commands`,
        rows: cat.items.slice(0, 20).map(item => ({
            title: item.cmd,
            description: item.desc ? item.desc.substring(0, 25) : '📌 Available command',
            id: item.cmd 
        }))
    }));
};

// ==============================================
// 🎨 BUILD FOOTER WITH STATS
// ==============================================
const buildFooter = () => {
    const stats = getSystemStats();
    return `⚡ ${stats.cmdCount} Commands • 👥 ${stats.users} Users • 🏠 ${stats.groups} Groups • 💾 ${stats.memoryUsed}MB RAM`;
};

// ==============================================
// 🚀 MAIN MENU COMMAND - IMEBORESHA
// ==============================================
const menuCommand = async (sock, chatId, m, userDb = null) => {
    try {
        const now = moment().tz('Africa/Dar_es_Salaam');
        const hour = now.hour();
        const userName = m.pushName || 'User';
        const greeting = getGreeting(hour);
        const stats = getSystemStats();
        const menuData = loadDynamicMenu();

        const date = now.format('DD MMMM YYYY'); 
        const time = now.format('HH:mm:ss');
        const uptime = stats.uptime;

        // ==============================================
        // ✨ HEADER ILIYOBORESHA - DESIGN NZURI
        // ==============================================
        const menuText = `
╔═══════════════════════════╗
║  ✨ *𝚂𝚑𝚘𝚖𝚢 𝚃𝚎𝚊𝚌𝚑 𝙻𝚊𝚗𝚍* ✨  ║
╚═══════════════════════════╝

${greeting.emoji} *Habari za ${greeting.text}* ${userName}!

📅 *Tarehe:* ${date}
⏰ *Saa:* ${time}
🕐 *Uptime:* ${uptime}

╔═══════════════════════════╗
║     📂 *MENU OPTIONS*      ║
╚═══════════════════════════╝

👇 *Bonyeza vitufe vilivyo hapa chini:*

❤️ *All* | 🚀 *Powered by 𝚂𝚑𝚘𝚖𝚢 𝚃𝚎𝚊𝚌𝚑 𝙻𝚊𝚗𝚍*`;

        // ==============================================
        // 📤 SEND INTERACTIVE MENU - BUTTON ZIMEBORESHA
        // ==============================================
        const buttonV2 = new ButtonV2(sock)
            .setBody(menuText)
            .setFooter(buildFooter())
            .setThumbnail('https://github.com/Mickeymozy/Shomy-Teach-Land-/blob/main/OMMY.jpg');

        // 🔘 BUTTON 1: Menu List - IMEBORESHA
        buttonV2.addRawButton({
            buttonText: { displayText: '📂 Orodha ya Commands' },
            buttonId: 'mickey_list_menu',
            type: 1,
            nativeFlowInfo: {
                name: 'single_select',
                paramsJson: JSON.stringify({
                    title: '📂 Select Command Category',
                    sections: buildSections(menuData)
                })
            }
        });

        // 🔘 BUTTON 2: Command ya Quick Reply
        buttonV2.addRawButton({
            buttonText: { displayText: '👑 Owner Info' },
            buttonId: '.owner',
            type: 1,
            nativeFlowInfo: {
                name: 'quick_reply',
                paramsJson: JSON.stringify({
                    display_text: '👑 Owner Info',
                    id: '.owner'
                })
            }
        });

        // 🔘 BUTTON 3: Stats (New)
        buttonV2.addRawButton({
            buttonText: { displayText: '📊 Bot Stats' },
            buttonId: '.stats',
            type: 1,
            nativeFlowInfo: {
                name: 'quick_reply',
                paramsJson: JSON.stringify({
                    display_text: '📊 Bot Stats',
                    id: '.stats'
                })
            }
        });

        // 🔘 BUTTON 4: Ping (New)
        buttonV2.addRawButton({
            buttonText: { displayText: '🏓 Ping' },
            buttonId: '.ping',
            type: 1,
            nativeFlowInfo: {
                name: 'quick_reply',
                paramsJson: JSON.stringify({
                    display_text: '🏓 Ping',
                    id: '.ping'
                })
            }
        });

        await buttonV2.send(chatId, { quoted: m });

    } catch (e) {
        console.error('Menu Error:', e);
        try {
            // Fallback message kama buttons zinashindwa
            const stats = getSystemStats();
            const fallbackText = `
╔═══════════════════════════╗
║  ✨ *𝚂𝚑𝚘𝚖𝚢 𝚃𝚎𝚊𝚌𝚑 𝙻𝚊𝚗𝚍* ✨  ║
╚═══════════════════════════╝

📊 *System Stats:*
├─ 👥 Users: ${stats.users}
├─ 🏠 Groups: ${stats.groups}
├─ ⚡ Commands: ${stats.cmdCount}
└─ 💾 RAM: ${stats.memoryUsed}MB

📂 *Commands:*
${loadDynamicMenu().map(cat => 
    `\n${cat.icon} *${cat.title}*\n${cat.items.map(i => `└─ ${i.cmd}`).join('\n')}`
).join('\n')}

❤️ *I love mom* | 🚀 *Quantum Base*`;

            await sock.sendMessage(chatId, { text: fallbackText }, { quoted: m });
        } catch (err) {
            console.error('Fallback error:', err);
        }
    }
};

// ==============================================
// 🛠️ UTILITY FUNCTIONS
// ==============================================
const getAllCommands = () => {
    const menuData = loadDynamicMenu();
    return menuData.flatMap(cat => cat.items.map(item => item.cmd.replace(/^[.]/, '').trim()));
};

const getCategories = () => {
    const menuData = loadDynamicMenu();
    return menuData.map(cat => ({
        title: cat.title,
        icon: cat.icon,
        count: cat.items.length,
        commands: cat.items.map(item => item.cmd.replace(/^[.]/, '').trim())
    }));
};

const getCommandInfo = (cmdName) => {
    const menuData = loadDynamicMenu();
    for (const cat of menuData) {
        const found = cat.items.find(item => item.cmd === `.${cmdName}` || item.cmd === cmdName);
        if (found) return { ...found, category: cat.title, icon: cat.icon };
    }
    return null;
};

// ==============================================
// 🔄 EXPORT MODULE
// ==============================================
module.exports = menuCommand;
module.exports.loadDynamicMenu = loadDynamicMenu;
module.exports.getSystemStats = getSystemStats;
module.exports.getAllCommands = getAllCommands;
module.exports.getCategories = getCategories;
module.exports.getCommandInfo = getCommandInfo;

// ==============================================
// 🔄 UPDATE STATS DAILY
// ==============================================
if (typeof global !== 'undefined') {
    setInterval(() => {
        try { 
            if (global.botStats) botStats = { ...botStats, ...global.botStats }; 
        } catch (e) {}
    }, 60000);
}

console.log(chalk.green('✓ Menu System Loaded Successfully'));
console.log(chalk.blue(`📊 ${getSystemStats().cmdCount} commands loaded`));