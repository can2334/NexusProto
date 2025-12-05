addCommand({ pattern: "^sudo ?(.*)", access: "sudo", desc: "_Add or remove sudo users to the bot_", usage: global.handlers[0] + "sudo <add || delete> <number with country code>", warn: "_Users given sudo will have all bot permissions!_" }, async (msg, match, sock, rawMessage) => {

    var action = match[1];
    var number = action.split(" ")[1];
    if (!number) {
        return await sock.sendMessage(msg, { text: await global.translateText("_Please specify the action to be performed._\n\n_Usage:_ ```") + global.handlers[0] + "sudo <add || delete> <number with country code>```", edit: msg.key });
    }
    if (action.includes("add")) {
        global.database.sudo.push(number);
        return await sock.sendMessage(msg, { translate: true, text: "_The number has been added to the sudoers list._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    } else if (action.includes("delete") || action.includes("del")) {
        global.database.sudo = global.database.sudo.filter(x => x !== number);
        return await sock.sendMessage(msg, { translate: true, text: "_The number has been removed from the sudoers list._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    } else {
        return await sock.sendMessage(msg, { text: await global.translateText("_Please specify the action to be performed._\n\n_Usage:_ ```") + global.handlers[0] + "sudo <add || delete> <number with country code>```", edit: msg.key }, { quoted: rawMessage.messages[0] });
    }
})