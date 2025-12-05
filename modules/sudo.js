addCommand({
    pattern: "^sudo ?(.*)",
    access: "sudo",
    desc: "_*Sudo kullanıcı ekle, sil veya listele*_",
    usage: global.handlers[0] + "sudo <add | delete> <ülke kodlu numara>",
    warn: "_Sudo verilen kullanıcılar botun tüm izinlerine sahip olur!_"
}, async (msg, match, sock, rawMessage) => {
    const groupId = msg;
    const args = (match[1] || "").trim().split(/\s+/);
    const action = args[0]?.toLowerCase();

    // numarayı tüm argümanlardan birleştirip sadece rakamları bırak
    let number = args.length > 1 ? args.slice(1).join("").replace(/\D+/g, "") : null;

    // Listeleme
    if (!action || action === "list") {
        const list = global.database.sudo || [];
        if (!list.length) {
            return await sock.sendMessage(groupId, { text: "_Sudo listesi boş._" }, { quoted: rawMessage?.messages?.[0] });
        }
        const text = `*Sudo Listesi (${list.length} kişi)*\n\n${list.map((n, i) => `${i + 1}. ${n}`).join("\n")}`;
        return await sock.sendMessage(groupId, { text }, { quoted: rawMessage?.messages?.[0] });
    }

    if (!["add", "delete", "del"].includes(action)) {
        return await sock.sendMessage(groupId, {
            text: "_Geçerli kullanım:_\n```" + global.handlers[0] + "sudo <add | delete | list> <numara>```",
            edit: msg.key
        });
    }

    if (!number) {
        return await sock.sendMessage(groupId, {
            text: "_Lütfen bir numara belirtin._\n\n_Örnek:_ ```" + global.handlers[0] + "sudo add 905123456789```",
            edit: msg.key
        });
    }

    // Tekrarlamayı önle
    if (action === "add") {
        if (global.database.sudo.includes(number)) {
            return await sock.sendMessage(groupId, { text: `_❌ ${number} zaten sudo listesinde._` }, { quoted: rawMessage?.messages?.[0] });
        }
        global.database.sudo.push(number);
        return await sock.sendMessage(groupId, { text: `_✅ ${number} sudo listesine eklendi._` }, { quoted: rawMessage?.messages?.[0] });
    }

    // Silme
    if (["delete", "del"].includes(action)) {
        const oldLength = global.database.sudo.length;
        global.database.sudo = global.database.sudo.filter(x => x !== number);
        if (global.database.sudo.length === oldLength) {
            return await sock.sendMessage(groupId, { text: `_❌ ${number} sudo listesinde bulunamadı._` }, { quoted: rawMessage?.messages?.[0] });
        }
        return await sock.sendMessage(groupId, { text: `_✅ ${number} sudo listesinden silindi._` }, { quoted: rawMessage?.messages?.[0] });
    }
});
