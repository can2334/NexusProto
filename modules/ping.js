addCommand({ pattern: "^ping$", access: "all", desc: "_Meter the response time of the bot._" }, async (msg, match, sock, rawMessage) => {
    const startTime = Date.now();
    let publicMessage = await sock.sendMessage(msg, { text: "Pong", edit: msg.key }, { quoted: rawMessage.messages[0] });

    const responseTime = Date.now() - startTime;
    const emoji = responseTime < 200 ? "⚡" : (responseTime < 400 ? "⏳" : "⚠️");
    const editKey = msg.key.fromMe ? msg.key : publicMessage.key;
    await sock.sendMessage(msg, { text: `_${emoji} Pong!_\n\n_Response time: ${responseTime}ms_`, edit: editKey }, { quoted: rawMessage.messages[0] });
    return;
})