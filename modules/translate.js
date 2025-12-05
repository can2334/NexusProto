addCommand({ pattern: "^translate ?(.*)", access: "sudo", desc: "_Adjust the bot’s language._", usage: global.handlers[0] + "translate <open> || <close> || <clear> || <language string>" }, async (msg, match, sock, rawMessage) => {
    const query = match[1].split(" ")[0];
    if (!query) {
        return await sock.sendMessage(msg, { translate: true, text: "_Please specify a language to translate to!_", edit: msg.key }, { quoted: rawMessage.messages[0] });
    };

    if (query == "open") {
        global.database.translate = true;
        return await sock.sendMessage(msg, { translate: true, text: "_Translation has been enabled!_", edit: msg.key }, { quoted: rawMessage.messages[0] });
    } else if (query == "close") {
        global.database.translate = false;
        return await sock.sendMessage(msg, { translate: true, text: "_Translation has been disabled!_", edit: msg.key }, { quoted: rawMessage.messages[0] });
    } else if (query == "clear") {
        global.database.translateDb = {};
        return await sock.sendMessage(msg, { translate: true, text: "_Translation database has been cleared!_", edit: msg.key }, { quoted: rawMessage.messages[0] });
    } else {
        global.database.translateTo = match[1].split(" ")[0];
        global.database.translateDb = {};

        console.log(match[1].split(" ")[0])
        return await sock.sendMessage(msg, { translate: true, text: "_Translation has been set to_ " + query + " _!_", edit: msg.key }, { quoted: rawMessage.messages[0] });
    }
})