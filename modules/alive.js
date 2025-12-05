/**
 * Adds a command to check if the bot is alive.
 *
 * @param {Object} command - The command object.
 * @param {string} command.pattern - The regex pattern to match the command.
 * @param {boolean} command.fromMe - Whether the command should be from the bot owner.
 * @param {string} command.desc - The description of the command.
 * @param {Function} callback - The callback function to execute when the command is matched.
 * @param {Object} msg - The message object.
 * @param {Object} msg.key - The key object of the message.
 * @param {string} msg.key.remoteJid - The remote JID of the group or user.
 * @param {Object} match - The match object.
 * @param {Object} sock - The socket object for sending messages.
 * @returns {Promise<void>} - A promise that resolves when the message is sent.
*/

const fs = require('fs');

addCommand({
    pattern: "^alive$",
    access: "all",
    desc: "_*Botun çalışıp çalışmadığını test eder*_"
}, async (msg, match, sock, rawMessage) => {
    const grupId = msg;
    const aliveMessage = global.database.aliveMessage;

    // Dinamik içerik (Aynı kalacak sadece fotografsız atabilecek)
    const ownerName = "Can";
    const userName = msg.pushName || "User";
    const version = "4.0.0";
    const rssMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
    const diskSpace = "1 TB";
    const instagram = "@nebakiyonumut";
    const mode = global.database.worktype || "public";

    const dynamicContent = `
╭═══〘 Bot Durumu 〙═══⊷❍
┃✩╭──────────────
┃✩│ 👑 Owner : ${ownerName}
┃✩│ 🧍 User : ${userName}
┃✩│ ⚙️ Mode : ${mode}
┃✩│ 🧩 Version : ${version}
┃✩│ 💾 RAM : ${rssMB} MB (RSS)
┃✩│ 💽 Disk : ${diskSpace}
┃✩│ 📸 Insta : ${instagram}
┃✩╰───────────────
┃✩Geliştirici hakkında bilgi için: .about
╰═════════════════⊷❍
`;

    const fs = require('fs');

    // Metin mesajı gönderme mantığı
    if (aliveMessage.type === "text") {
        if (msg.key.fromMe) {
            return await sock.sendMessage(grupId, { edit: msg.key, text: dynamicContent });
        } else {
            return await sock.sendMessage(grupId, { text: dynamicContent }, { quoted: rawMessage.messages[0] });
        }

        // GÖRSEL KISMI: İyileştirilmiş Hata Yönetimi
    } else if (aliveMessage.type === "image") {
        const mediaPath = aliveMessage.media.startsWith("./") ? aliveMessage.media : `./media/${aliveMessage.media}`;

        if (!fs.existsSync(mediaPath)) {
            //  İYİLEŞTİRME: Dosya yoksa hata vermek yerine sadece metin gönder.
            console.log(`Uyarı: Alive medyası bulunamadı: ${mediaPath}. Sadece metin gönderiliyor.`);
            if (msg.key.fromMe) {
                return await sock.sendMessage(grupId, { edit: msg.key, text: dynamicContent });
            } else {
                return await sock.sendMessage(grupId, { text: dynamicContent }, { quoted: rawMessage.messages[0] });
            }
        }

        // Medya varsa, görseli gönder
        const messageOptions = {
            image: { url: mediaPath },
            caption: dynamicContent
        };

        return await sock.sendMessage(grupId, messageOptions, { quoted: rawMessage.messages[0] });
    }
});
addCommand({
    // Komut: .update alivepng (Bu komut pattern'iyle eşleşir)
    pattern: "^update alivepng$",
    access: "sudo", // Sadece Sudo/Sahip kullanabilir
    desc: "_*Alive komutu için görseli, yanıtlanan fotoğrafla günceller.*_"
}, async (msg, match, sock, rawMessage) => {
    const grupId = msg;

    // Yanıtlanan mesaj bilgisini al
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    // 1. Yanıt kontrolü
    if (!quotedMsg) {
        return await sock.sendMessage(grupId, { text: "_Lütfen Alive görseli yapmak istediğiniz bir fotoğrafa yanıt vererek komutu kullanın._" }, { quoted: rawMessage.messages[0] });
    }

    // 2. Yanıtın görsel olup olmadığını kontrol et
    // Medya içeriğini doğrudan alabilmek için bu nesneyi kullanacağız.
    const imageMessage = quotedMsg.imageMessage || quotedMsg.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

    if (!imageMessage) {
        return await sock.sendMessage(grupId, { text: "_Yanıtladığınız mesaj bir fotoğraf içermiyor._" }, { quoted: rawMessage.messages[0] });
    }

    // 3. Medyayı İndir ve Kaydet
    const mediaType = 'image';
    const filePath = './media/alive.png'; // Sabit dosya yolu

    // Hata Yönetimi ile indirme işlemi
    try {
        // ⭐ KESİN DÜZELTME: global.downloadMedia fonksiyonuna sadece 
        // medya mesaj nesnesini (imageMessage) gönderiyoruz. 

        // Bu, global.downloadMedia'nın içindeki downloadContentFromMessage'ın 
        // doğrudan gerekli anahtarlara sahip nesneye ulaşmasını sağlar.
        await global.downloadMedia(imageMessage, mediaType, filePath);

    } catch (e) {
        console.error("Medya indirme hatası:", e);
        return await sock.sendMessage(grupId, { text: "_Medya indirilirken bir hata oluştu. `global.downloadMedia` fonksiyonunu kontrol edin. (Hata: Boş medya anahtarı)_" }, { quoted: rawMessage.messages[0] });
    }

    // 4. Global Database'i Güncelle
    global.database.aliveMessage = {
        type: "image",
        media: "alive.png" // Kaydedilen dosya adını database'e yaz
    };

    // 5. database.json dosyasını diske kaydet
    try {
        const fs = require('fs');
        const dbPath = './database.json';
        fs.writeFileSync(dbPath, JSON.stringify(global.database, null, 4));

        await sock.sendMessage(grupId, {
            text: `_✅ Yeni Alive görseli başarıyla ayarlandı ve "${filePath}" konumuna kaydedildi._\n\n_Botun yeniden başlatılması gerekebilir._`
        }, { quoted: rawMessage.messages[0] });
    } catch (e) {
        console.error("Database yazma hatası:", e);
        return await sock.sendMessage(grupId, { text: "_Database'e yazılırken kritik hata oluştu._" }, { quoted: rawMessage.messages[0] });
    }
});
addCommand({
    // Komut: .delete alivepng
    pattern: "^delete alivepng$",
    access: "sudo", // Sadece Sudo/Sahip kullanabilir
    desc: "_*Alive komutu için ayarlanmış görseli siler ve metin moduna döner.*_"
}, async (msg, match, sock, rawMessage) => {
    const grupId = msg;
    const fs = require('fs');
    const dbPath = './database.json';
    const filePath = './media/alive.png'; // Hedef dosya yolu

    try {
        // 1. Dosya Silme İşlemi
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`'${filePath}' başarıyla silindi.`);
        } else {
            // Dosya zaten yoksa bile başarılı sayılır
            console.log(`Uyarı: '${filePath}' zaten mevcut değil.`);
        }

        // 2. Global Database'i Metin Moduna Güncelle
        global.database.aliveMessage = {
            type: "text", // Modu metin olarak ayarla
            media: "" // Medya alanını temizle
        };

        // 3. database.json dosyasını diske kaydet
        fs.writeFileSync(dbPath, JSON.stringify(global.database, null, 4));

        await sock.sendMessage(grupId, {
            text: `_✅ Alive görseli başarıyla silindi ve botun yanıt modu metin (\`text\`) olarak ayarlandı._\n\n_Bot artık *metin* mesajı ile cevap verecektir._`
        }, { quoted: rawMessage.messages[0] });

    } catch (e) {
        console.error("Alive görseli silinirken hata:", e);
        return await sock.sendMessage(grupId, { text: "_Kritik hata: Dosya silinirken veya Database'e yazılırken bir sorun oluştu._" }, { quoted: rawMessage.messages[0] });
    }
});
// ==================== YENİ DETAYLI ABOUT KOMUTU ====================
addCommand({
    pattern: "^about$",
    access: "all",
    desc: "_*Botun vizyonu, teknolojisi ve geliştiricisi hakkında bilgi verir*_"
}, async (msg, match, sock, rawMessage) => {
    const grupId = msg;

    // Geliştirici Bilgileri
    const ownerName = "Can";
    const instagram = "@nebakiyonumut";
    const github = "https://github.com/can2334/NexusProto.git";

    // Botun Amacına Dair Kişiselleştirilmiş Mesaj
    const aboutMessage = `
╭━━「 👑 NexusProto  」━━━
┃
┃ 👨‍💻 Geliştirici: *${ownerName}*
┃ 🐙 GitHub : ${github}
┃ 📸 İletişim : ${instagram}
┃ 
╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
> 🤖 **BOT MİSYONU**
> NexusProto,  WhatsApp platformu için özel olarak tasarlanmış, *yüksek hızlı medya işleme* ve *anlık bilgi akışı* sağlamayı hedefleyen, özel yapım bir yapay zeka asistanıdır.

> ✨ **TEKNOLOJİ**
> Botun kalbinde, eş zamanlı işlemleri hızlandıran *Asenkron JavaScript* ve kararlılık sağlayan *Node.js* mimarisi yatmaktadır. YouTube indirme ve medya optimizasyon süreçleri için **yt-dlp** ve **FFmpeg**'in gücünden faydalanılmaktadır.
> 
> ⚙️ **DURUM**
> Sistemler tam kapasiteyle, kesintisiz ve hatasız çalışmaktadır. Her türlü komutunuza anında yanıt vermeye hazırdır.
> 
╰━━━━━━━━━━━━━━━━━━━

_Sistem performansı ile ilgili detaylı bilgi için: !alive_
`;

    // Mesaj gönderme
    if (msg.key.fromMe) {
        return await sock.sendMessage(grupId, { edit: msg.key, text: aboutMessage });
    } else {
        return await sock.sendMessage(grupId, { text: aboutMessage }, { quoted: rawMessage.messages[0] });
    }
});
// ======================================================