const fs = require('fs');

addCommand({ pattern: "^show$", access: "all", desc: "_It allows you to view the view once messages._" }, async (msg, match, sock, rawMessage) => {
    const grupId = msg;
    if (!msg.quotedMessage) {
        return await sock.sendMessage(grupId, { translate: true, text: "_Please reply to a view once message!_", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }

    if (msg.quotedMessage?.viewOnceMessage || msg.quotedMessage?.viewOnceMessageV2 || msg.quotedMessage?.viewOnceMessageV2Extension || msg.quotedMessage?.imageMessage) {
        var viewOnceMessage = msg.quotedMessage?.viewOnceMessage?.message?.imageMessage || msg.quotedMessage?.viewOnceMessage?.message?.videoMessage || msg.quotedMessage?.viewOnceMessageV2?.message?.imageMessage || msg.quotedMessage?.viewOnceMessageV2?.message?.videoMessage || msg.quotedMessage?.viewOnceMessageV2Extension?.message || msg.quotedMessage?.viewOnceMessageV2Extension?.message?.imageMessage || msg.quotedMessage?.viewOnceMessageV2Extension?.message?.videoMessage || msg.quotedMessage?.imageMessage || msg.quotedMessage?.videoMessage;
        if ((msg.quotedMessage?.imageMessage && msg.quotedMessage?.imageMessage?.viewOnce !== true) || (msg.quotedMessage?.videoMessage && msg.quotedMessage?.videoMessage?.viewOnce !== true)) {

            return await sock.sendMessage(grupId, { translate: true, text: "_Please reply to a view once message!_", edit: msg.key }, { quoted: rawMessage.messages[0] });

        }
        const mediaPath = `./viewOnceMessage` + Math.floor(Math.random() * 1000) + (viewOnceMessage?.imageMessage ? ".png" : ".mp4");
        var configs = {
            _0: viewOnceMessage,
            _1: msg.quotedMessage?.imageMessage ? "image" : "video",
            _2: mediaPath
        };

        const send_key = await sock.sendMessage(grupId, { translate: true, text: "_⏳ Downloading.._", edit: msg.key }, { quoted: rawMessage.messages[0] });
        var publicMessage = msg.key.fromMe ? msg.key : send_key.key;
        await global.downloadMedia(configs._0, configs._1, configs._2);

        await sock.sendMessage(grupId, { translate: true, delete: publicMessage, [configs._1]: { url: configs._2 }, caption: `_⏳ Downloaded!_` }, { quoted: rawMessage.messages[0] });

        if (fs.existsSync(configs._2)) fs.unlinkSync(configs._2);
        return;
    } else {
        return await sock.sendMessage(grupId, { translate: true, text: "_Please reply to a view once message!_", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }
})