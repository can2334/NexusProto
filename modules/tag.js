addCommand({ pattern: "^tagall ?([\\s\\S]*)", desc: "_It allows you to tag all users in the group._", access: "sudo", onlyInGroups: true }, async (msg, match, sock, rawMessage) => {

    const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
    const participants = groupMetadata.participants.map(p => p.id);
    if (match[1]) {
        var mentionText = match[1];
    }
    else {
        var mentionText = participants.map(id => `• @${id.split("@")[0]}\n`).join("");
    }

    return sock.sendMessage(msg, { text: mentionText, mentions: participants, edit: msg.key }), { quoted: rawMessage.messages[0] };


});

addCommand({ pattern: "^tagadmin ?([\\s\\S]*)", desc: "_It allows you to tag the admins in the group._", access: "all", onlyInGroups: true }, async (msg, match, sock, rawMessage) => {
    const groupId = msg.key.remoteJid;

    const groupMetadata = await sock.groupMetadata(groupId);
    const admins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
    if (match[1]) {
        var mentionText = match[1];
    } else {
        var mentionText = admins.map(id => `• @${id.split("@")[0]}\n`).join("");
    }
    return sock.sendMessage(msg, { text: mentionText, mentions: admins, edit: msg.key }, { quoted: rawMessage.messages[0] });

});
