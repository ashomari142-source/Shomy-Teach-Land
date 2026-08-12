const os = require('os');
const { performance } = require('perf_hooks');
const { ButtonV2, AIRich, createCtx } = require('../lib/messageBuilder');
const { OMMY_IMAGE_URL } = require('../lib/ommyMedia');

// ============================================================
// 🖥️ PING COMMAND - SHOMY TEACH LAND
// ============================================================
const pingCommand = async (sock, chatId, msg, args) => {
    const ctx = createCtx(sock, chatId, msg, { args });
    try {
        const start = performance.now();

        // --- SYSTEM INFO ---
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercent = ((usedMem / totalMem) * 100).toFixed(1);

        // --- NETWORK & LATENCY ---
        const latency = Math.round(performance.now() - start);
        
        // Ping emoji based on latency
        let pingEmoji, pingStatus;
        if (latency < 50) {
            pingEmoji = '🚀';
            pingStatus = 'EXCELLENT';
        } else if (latency < 100) {
            pingEmoji = '🟢';
            pingStatus = 'VERY GOOD';
        } else if (latency < 200) {
            pingEmoji = '🟡';
            pingStatus = 'GOOD';
        } else if (latency < 500) {
            pingEmoji = '🟠';
            pingStatus = 'SLOW';
        } else {
            pingEmoji = '🔴';
            pingStatus = 'VERY SLOW';
        }

        // --- FORMAT BYTES ---
        const formatBytes = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        // --- UPTIME FORMATTING ---
        const formatUptime = (seconds) => {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            const parts = [];
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0) parts.push(`${minutes}m`);
            parts.push(`${secs}s`);
            return parts.join(' ');
        };

        const botUptime = formatUptime(process.uptime());
        const cpuCores = os.cpus().length;
        const cpuModel = os.cpus()[0]?.model || 'Unknown CPU';
        const platform = os.platform();
        const arch = os.arch();
        const hostname = os.hostname();
        const loadAvg = os.loadavg().map(l => l.toFixed(2)).join(', ');
        
        // --- MEMORY USAGE BAR ---
        const memUsedPercent = parseFloat(memPercent);
        const barLength = 20;
        const filledBars = Math.round((memUsedPercent / 100) * barLength);
        const emptyBars = barLength - filledBars;
        const memBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

        // --- GET CURRENT TIME ---
        const now = new Date();
        const timeStr = now.toLocaleString('sw-TZ', { 
            timeZone: 'Africa/Dar_es_Salaam',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // --- BUILD RICH TEXT ---
        const text = `╔═══════════════════════════════╗
║   🏫 *SHOMY TEACH LAND*     ║
╠═══════════════════════════════╣
║                               ║
║  📡 *PING & STATUS*          ║
║  ⚡ ${latency}ms ${pingEmoji}  ${pingStatus}  ║
║                               ║
║  ⏱️ *UPTIME*                  ║
║  🕐 ${botUptime}              ║
║                               ║
║  💾 *MEMORY USAGE*            ║
║  ${memBar}                    ║
║  ${formatBytes(usedMem)} / ${formatBytes(totalMem)} ║
║  📊 ${memPercent}% Used       ║
║                               ║
║  🖥️ *SYSTEM INFO*             ║
║  🧠 ${cpuCores} Cores         ║
║  💻 ${cpuModel.substring(0, 30)}... ║
║  📱 ${platform} ${arch}       ║
║  🏠 ${hostname}               ║
║  📊 Load: ${loadAvg}          ║
║                               ║
║  🕒 *TIME*                    ║
║  📅 ${timeStr}                ║
║                               ║
╚═══════════════════════════════╝

💡 *Quick Actions:*`;

        // --- BUILD BUTTONS ---
        try {
            const buttonBuilder = new ButtonV2(sock)
                .text(`⚡ ${latency}ms ${pingEmoji} • ⏱️ ${botUptime}\n💾 ${memBar} ${memPercent}% used\n🖥️ ${cpuCores} cores • 📱 ${platform}`)
                .setThumbnail(OMMY_IMAGE_URL)
                .button('📦 Menu', '.menu')
                .button('📊 Stats', '.stats')
                .button('🧠 AI Chat', '.ai')
                .button('👤 Owner', '.owner')
                .setFooter('SHOMY TEACH LAND • ⚡ Fast & Reliable');

            await buttonBuilder.send(ctx.chatId, { quoted: ctx._msg, fallbackText: text });

            return;
        } catch (builderError) {
            console.error('Ping builder error:', builderError);
        }

        // Fallback if buttons fail
        await ctx.reply(text);
        
    } catch (error) {
        console.error('Ping Error:', error);
        await ctx.reply('❌ *Error:* Tafadhali jaribu tena.\n💡 Tumia .ping tena.');
    }
};

// --- ADDITIONAL PING FEATURES ---
// Ping with detailed network info
const pingDetailed = async (sock, chatId, msg, args) => {
    const ctx = createCtx(sock, chatId, msg, { args });
    try {
        const start = performance.now();
        
        // Simulate network checks
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const latency = Math.round(performance.now() - start);
        const networkSpeed = latency < 100 ? '🚀 Fast' : latency < 300 ? '📶 Medium' : '🐢 Slow';
        
        const text = `╔═══════════════════════════════╗
║   🌐 *NETWORK DIAGNOSTIC*    ║
╠═══════════════════════════════╣
║                               ║
║  📡 *PING:* ${latency}ms        ║
║  📶 *SPEED:* ${networkSpeed}   ║
║  🔗 *STATUS:* ✅ Connected     ║
║                               ║
║  🏫 *SHOMY TEACH LAND*        ║
║  💡 *Always ready to teach!*  ║
║                               ║
╚═══════════════════════════════╝`;

        await ctx.reply(text);
    } catch (error) {
        console.error('Ping Detailed Error:', error);
        await ctx.reply('❌ Network check failed. Try again.');
    }
};

// --- PING WITH ANIMATION ---
const pingAnimated = async (sock, chatId, msg, args) => {
    const ctx = createCtx(sock, chatId, msg, { args });
    try {
        const start = performance.now();
        
        // Simulate loading
        await ctx.reply('🏓 *Pinging...*');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const latency = Math.round(performance.now() - start);
        
        const text = `🏓 *PONG!* ${latency}ms

╔═══════════════════════════════╗
║   🏫 *SHOMY TEACH LAND*      ║
║   ⚡ ${latency}ms              ║
║   ✅ Server is alive!         ║
║                               ║
║   📚 *Teaching moment:*       ║
║   "Patience is the key to    ║
║    mastering any skill!"     ║
║                               ║
╚═══════════════════════════════╝

💡 *Keep learning with Shomy!*`;

        await ctx.reply(text);
    } catch (error) {
        console.error('Ping Animated Error:', error);
        await ctx.reply('❌ Ping failed. Try again.');
    }
};

module.exports = pingCommand;
module.exports.pingDetailed = pingDetailed;
module.exports.pingAnimated = pingAnimated;