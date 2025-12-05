const Tiktok = require("@tobyg74/tiktok-api-dl")
const fs = require('fs');

addCommand({ pattern: "^tiktok ?(.*)", access: "all", desc: "Download video from tiktok.", usage: global.handlers[0] + "tiktok <url>" }, async (msg, match, sock, rawMessage) => {
    const query = match[1];
    if (!query) {
        return await sock.sendMessage(msg, { text: "_❌ Please provide a video link!_", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }

    if (query.match(/^(https?\:\/\/)?(www\.tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\/.+$/)) {


        const send_key = await sock.sendMessage(msg, { translate: true, text: "_⏳ Video Downloading.._", edit: msg.key }, { quoted: rawMessage.messages[0] });

        var publicMessage = msg.key.fromMe ? msg.key : send_key.key;


        var tk = await Tiktok.Downloader(query, { "version": "v1" })
        if (tk?.result?.type == "video") {
            var url = tk.result.video.downloadAddr[0] || tk.result.video.playAddr[0]
            return await sock.sendMessage(msg, { delete: publicMessage, video: { url: url }, caption: tk.result?.description || "*MadeBy* _NexusProto_" }, { quoted: rawMessage.messages[0] });
        } else {
            if (tk?.result?.type == "image") {
                for (let i = 0; i < tk.result.images.length; i++) {
                    var buffer = await global.downloadarraybuffer(tk.result.images[i]);
                    var mediaName = "src/tiktok" + i + ".jpg";
                    fs.writeFileSync(mediaName, buffer);
                    await sock.sendMessage(msg, { delete: publicMessage, image: { url: mediaName }, caption: tk.result?.description || "*MadeBy* _NexusProto_" }, { quoted: rawMessage.messages[0] });
                }
                return;
            } else {
                return await sock.sendMessage(msg, { translate: true, text: "_❌ No results found for this url!_", edit: msg.key }, { quoted: rawMessage.messages[0] });
            }
        }
    } else {
        return await sock.sendMessage(msg, { translate: true, text: "_❌ No results found for this url!_", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }
})

