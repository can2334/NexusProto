addCommand({ pattern: "^blacklist$", desc: "Allows you to add and remove a user or group to the blacklist.", access: "sudo" }, (async (msg, match, sock, rawMessage) => {
    const groupId = msg.key.remoteJid;
    if (global.database.blacklist.includes(groupId)) {
        global.database.blacklist.splice(global.database.blacklist.indexOf(groupId), 1);

        return sock.sendMessage(msg, { translate: true, text: "_✅ This group has been removed from the blacklist._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    } else {
        global.database.blacklist.push(groupId);
        return sock.sendMessage(msg, { translate: true, text: "_✅ This group has been added to the blacklist._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }
}))