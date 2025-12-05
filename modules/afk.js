addCommand({ pattern: "^afk$", access: "sudo", desc: "_Turn on or off AFK mode._" }, async (msg, match, sock, rawMessage) => {
    const grupId = msg;
    const afkMessage = global.database.afkMessage;

    if (afkMessage.active) {
        global.database.afkMessage.active = false;
        return await sock.sendMessage(grupId, { translate: true, text: "_✅ AFK mode disabled successfully._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    } else {
        global.database.afkMessage.active = true;
        if (afkMessage.type == "text" && afkMessage.content == "") {
            global.database.afkMessage.content = "_I'm currently AFK! Please contact me later._";
        }
        return await sock.sendMessage(grupId, { translate: true, text: "_✅ AFK mode enabled successfully._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }
});