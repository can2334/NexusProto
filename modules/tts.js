const gTTS = require('gtts');

function ttsBuffer(text, lang = "tr") {
    return new Promise((resolve, reject) => {
        const tts = new gTTS(text, lang);

        const chunks = [];

        tts.stream()
            .on("data", chunk => chunks.push(chunk))
            .on("end", () => resolve(Buffer.concat(chunks)))
            .on("error", reject);
    });
}

addCommand({ pattern: "^tts ?(.*)", access: "all", desc: "Text to speech." }, async (msg, match, sock, rawMessage) => {
    const text = match[1];
    if (!text) {
        return await sock.sendMessage(msg, { text: "_❌ Please provide text!_", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }
    try {
        const send_key = await sock.sendMessage(msg, { translate: true, text: "_⏳ Converting..._", edit: msg.key }, { quoted: rawMessage.messages[0] });
        const publicMessage = msg.key.fromMe ? msg.key : send_key.key;
        const buffer = await ttsBuffer(text);

        await sock.sendMessage(msg, { delete: publicMessage, audio: buffer, mimetype: "audio/mpeg" }, { quoted: rawMessage.messages[0] });
    } catch {
        return await sock.sendMessage(msg, { translate: true, text: "_❌ Something went wrong!_", edit: msg.key }, { quoted: rawMessage.messages[0] });
    }
})