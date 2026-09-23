const fs = require('fs');
const path = require('path');

function loadState() {
    return { enabled: false, assetPath: '', type: 'text', perGroup: {} };
}

function saveState() {
    return true;
}

async function handleMentionDetection() {
    return;
}

async function mentionToggleCommand(sock, chatId, message) {
    return sock.sendMessage(chatId, { text: 'Mention auto-reply is disabled.' }, { quoted: message });
}

async function groupMentionToggleCommand(sock, chatId, message) {
    return sock.sendMessage(chatId, { text: 'Mention auto-reply is disabled.' }, { quoted: message });
}

async function setMentionCommand(sock, chatId, message) {
    return sock.sendMessage(chatId, { text: 'Mention auto-reply is disabled.' }, { quoted: message });
}

module.exports = {
    handleMentionDetection,
    mentionToggleCommand,
    setMentionCommand,
    groupMentionToggleCommand
};


