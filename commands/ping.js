const os = require('os');
const { performance } = require('perf_hooks');
const { ButtonV2, AIRich, createCtx } = require('../lib/messageBuilder');

// ============================================================
// 🖥️ PING COMMAND
// ============================================================
const pingCommand = async (sock, chatId, msg, args) => {
    const ctx = createCtx(sock, chatId, msg, { args });
    try {
        const start = performance.now();
        
        // Kupata info ya system
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
        
        const latency = Math.round(performance.now() - start);
        const pingEmoji = latency < 100 ? '🟢' : latency < 200 ? '🟡' : '🔴';
        
        // Kupunguza bytes
        const formatBytes = (bytes) => {
            if (bytes === 0) return '0B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
        };
        
        // Uptime formatting
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
        
        const text = `📡 *𝚂𝚑𝚘𝚖𝚢 𝚃𝚎𝚊𝚌𝚑 𝙻𝚊𝚗𝚍*
⚡ ${latency}ms ${pingEmoji}
⏱️ ${botUptime}
🖥️ ${cpuCores} cores
💾 ${formatBytes(usedMem)}/${formatBytes(totalMem)} (${memPercent}%)`;

        try {
            const buttonBuilder = new ButtonV2(sock)
                .text(`⚡ ${latency}ms ${pingEmoji} • ${botUptime}\n🖥️ ${cpuCores} cores • 💾 ${formatBytes(usedMem)}/${formatBytes(totalMem)} (${memPercent}%)`)
                .setThumbnail('https://github.com/Mickeymozy/Shomy-Teach-Land-/blob/main/OMMY.jpg')
                .button('📦 Menu', '.menu')
                .button('📊 Stats', '.stats')
                .button('🧠 AI', '.ai')
                .setFooter('Quick actions');

            await buttonBuilder.send(ctx.chatId, { quoted: ctx._msg, fallbackText: text });

            return;
        } catch (builderError) {
            console.error('Ping builder error:', builderError);
        }

        await ctx.reply(text);
    } catch (error) {
        console.error('Ping Error:', error);
        await ctx.reply('❌ *Error:* Tafadhali jaribu tena.');
    }
};



module.exports = pingCommand;
