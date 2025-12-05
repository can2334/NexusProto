const fs = require('fs');
const { igdl } = require('btch-downloader');

addCommand({ pattern: "^insta ?(.*)", desc: "Allows you to download videos/images from Instagram.", access: "all" }, async (msg, match, sock, rawMessage) => {
    console.log("match", match)
    if (!match[1]) {
        return await sock.sendMessage(msg, { translate: true, text: "_Please provide a URL to download from Instagram._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }

    const send_key = await sock.sendMessage(msg, { translate: true, text: "_📥 Downloading..._", edit: msg.key }, { quoted: rawMessage.messages[0] });
    let publicMessage = msg.key.fromMe ? msg.key : send_key.key;

    try {
        var data = await igdl(match[1]);
        console.log("data:", data)
    } catch (e) {
        console.log("error", e)
        return await sock.sendMessage(msg, { translate: true, text: "_❌ An error occurred while downloading the media._" + e, edit: publicMessage }, { quoted: rawMessage.messages[0] });

    }

    await sock.sendMessage(msg, { delete: publicMessage, video: { url: data.result[0].url }, caption: "*MadeBy* _NexusProto_" });


    try { fs.unlinkSync(data.path) } catch { }
    return;
});