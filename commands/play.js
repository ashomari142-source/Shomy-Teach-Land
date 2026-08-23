const axios = require('axios');
const yts = require('yt-search');

const AUDIO_APIS = [
    { name: 'apiziaul-ytmp3', url: 'https://apiziaul.vercel.app/api/downloader/ytmp3', paramKey: 'url' },
    { name: 'apiziaul-playmp3', url: 'https://apiziaul.vercel.app/api/downloader/ytplaymp3', paramKey: 'query' },
    { name: 'nexray-savetube', url: 'https://api.nexray.eu.cc/downloader/savetube', paramKey: 'url', quality: 'mp3' },
    { name: 'nexray-ytmp3', url: 'https://api.nexray.eu.cc/downloader/ytmp3', paramKey: 'url' },
    { name: 'nexray-v1', url: 'https://api.nexray.eu.cc/downloader/v1/ytmp3', paramKey: 'url' }
];

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: '*/*'
    }
};

const DOWNLOAD_TIMEOUT_MS = 120000;
const audioCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

async function tryRequest(getter, attempts = 2) {
    let lastErr;
    for (let i = 1; i <= attempts; i++) {
        try {
            return await getter();
        } catch (err) {
            lastErr = err;
            if (i < attempts) await new Promise(r => setTimeout(r, 2000));
        }
    }
    throw lastErr;
}

function isYouTubeUrl(value = '') {
    return /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))/i.test(value);
}

function extractYoutubeVideoId(ytUrl) {
    try {
        const url = new URL(ytUrl);
        if (url.hostname === 'youtu.be') return url.pathname.slice(1);
        return url.searchParams.get('v') || url.pathname.split('/').filter(Boolean)[1] || '';
    } catch {
        return '';
    }
}

async function downloadAudioBuffer(downloadUrl) {
    const response = await axios.get(downloadUrl, {
        timeout: DOWNLOAD_TIMEOUT_MS,
        responseType: 'arraybuffer',
        maxRedirects: 15,
        headers: {
            ...AXIOS_DEFAULTS.headers,
            Accept: 'audio/mpeg,audio/mp4,audio/flac,*/*;q=0.8',
            Referer: 'https://www.youtube.com/'
        }
    });

    const buffer = Buffer.from(response.data);
    if (buffer.length < 1000) throw new Error('Downloaded audio is too small');
    return buffer;
}

async function fetchFromMultipleAPIs(youtubeUrl) {
    const results = await Promise.allSettled(AUDIO_APIS.map(async (apiConfig) => {
        const params = new URLSearchParams({ [apiConfig.paramKey]: youtubeUrl });
        if (apiConfig.quality) params.set('quality', apiConfig.quality);
        const response = await axios.get(`${apiConfig.url}?${params.toString()}`, {
            ...AXIOS_DEFAULTS,
            timeout: 15000
        });
        return { apiConfig, data: response.data };
    }));

    for (const result of results) {
        if (result.status === 'fulfilled' && result.value.data?.status !== false) {
            const data = result.value.data;
            if (data?.result?.url || data?.result?.downloadUrl || data?.result?.download_link) {
                return result.value;
            }
        }
    }
    return null;
}

async function getYoutubeAudio(ytUrl) {
    const videoId = extractYoutubeVideoId(ytUrl);
    if (!videoId) throw new Error('Invalid YouTube URL');

    const cached = audioCache.get(videoId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;

    const result = await fetchFromMultipleAPIs(ytUrl);
    if (!result) throw new Error('All API sources failed');

    const resultData = result.data.result;
    const downloadUrl = resultData.url || resultData.downloadUrl || resultData.download_link;
    if (!downloadUrl) throw new Error(`Could not extract download URL from ${result.apiConfig.name}`);

    const buffer = await downloadAudioBuffer(downloadUrl);
    const audioData = {
        buffer,
        title: String(resultData.title || resultData.name || 'Unknown Title').replace(/\s+/g, ' ').trim(),
        thumbnail: resultData.thumbnail || resultData.thumb || '',
        quality: resultData.quality || resultData.bitrate || '128kbps',
        duration: resultData.duration || resultData.dur || 'Unknown',
        source: result.apiConfig.name,
        videoUrl: ytUrl,
        videoId
    };

    audioCache.set(videoId, { data: audioData, timestamp: Date.now() });
    return audioData;
}

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = text.split(' ').slice(1).join(' ').trim();

        if (!query) {
            return sock.sendMessage(chatId, { 
                text: '🎵 *Play Music*\n\n📝 .play song name\n🔗 .play youtube_url' 
            });
        }

        await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });

        let videoUrl = query;
        let videoInfo = null;
        let thumbnailUrl = '';

        if (!query.includes('youtube.com') && !query.includes('youtu.be')) {
            const searchResults = await yts(query);
            const videos = searchResults?.videos;

            if (!videos || videos.length === 0) {
                await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
                return sock.sendMessage(chatId, { text: '❌ Song not found' });
            }

            videoInfo = videos[0];
            videoUrl = videoInfo.url;
            thumbnailUrl = videoInfo.thumbnail;

            const infoText = `🎵 *${videoInfo.title}*\n⏱️ ${videoInfo.timestamp} | 👤 ${videoInfo.author.name}\n👁️ ${(videoInfo.views || 0).toLocaleString()}\n\n⬇️ Downloading...`;

            if (thumbnailUrl) {
                await sock.sendMessage(chatId, {
                    image: { url: thumbnailUrl },
                    caption: infoText
                });
            } else {
                await sock.sendMessage(chatId, { text: infoText });
            }
        } else {
            await sock.sendMessage(chatId, { text: '⬇️ Processing...' });
        }

        const processMsg = await sock.sendMessage(chatId, { text: '⏳ Loading...' });

        const audioData = await getYoutubeAudio(videoUrl);

        await sock.sendMessage(chatId, { delete: processMsg.key });

        // Send thumbnail as normal image (if available and not sent yet)
        if (audioData.thumbnail && !thumbnailUrl) {
            await sock.sendMessage(chatId, {
                image: { url: audioData.thumbnail },
                caption: `🎵 *${audioData.title.substring(0, 50)}*\n📡 ${audioData.source}`
            });
        }

        // Send audio
        const audioMessage = {
            audio: audioData.buffer,
            mimetype: 'audio/mp4',
            ptt: false,
            fileName: `${audioData.title.substring(0, 40)}.mp4`
        };

        await sock.sendMessage(chatId, audioMessage);
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
        console.error('[PLAY] Error:', err.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        await sock.sendMessage(chatId, { text: `❌ Error: ${err.message}. Tafadhali jaribu tena baadaye.` });
    }
}

module.exports = playCommand;
