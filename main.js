const Module = require('module');
const originalRequire = Module.prototype.require;
const execSync = require('child_process').execSync;
const fs = require('fs');
const installedPackages = new Set();
Module.prototype.require = function (packageName) {
  try {
    return originalRequire.apply(this, arguments);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && !packageName.startsWith('.')) {
      if (!installedPackages.has(packageName)) {
        console.log(`Package ${packageName} not found. Installing...`);

        const isTermux = process?.env?.PREFIX === '/data/data/com.termux/files/usr';

        try {
          execSync(`npm install ${packageName}`, { stdio: 'ignore' });
          installedPackages.add(packageName);

          return originalRequire.apply(this, arguments);
        } catch (installError) {
          if (isTermux) {
            console.log('⚠️ Termux detected. Skipping installation of unsupported ' + packageName + ' module. Some features may not work.');
          } else {
            console.error(`Package installation error: ${installError.message}`);
          }
        }
      }
    }
    throw err;
  }
};

function patchLibsignal() {
  const patches = [
    {
      file: './node_modules/libsignal/src/crypto.js',
      replacements: [
        ['throw new Error("Bad MAC length");', 'true;'],
        ['throw new Error("Bad MAC");', 'true;']
      ],
      name: 'crypto.js'
    },
    {
      file: './node_modules/libsignal/src/session_builder.js',
      replacements: [
        ['console.warn("Closing stale open session for new outgoing prekey bundle");', 'true;'],
        ['record.closeSession(openSession);', 'true;'],
        ['console.warn("Closing open session in favor of incoming prekey bundle");', 'true;'],
        ['record.closeSession(existingOpenSession);', 'true;']
      ],
      name: 'session_builder.js'
    },
    {
      file: './node_modules/libsignal/src/session_cipher.js',
      replacements: [
        ['console.error("Failed to decrypt message with any known session...");', 'true;'],
        ['console.error("Session error:" + e, e.stack);', 'true;']
      ],
      name: 'session_cipher.js'
    }
  ];

  for (const patch of patches) {
    try {
      let content = fs.readFileSync(patch.file, 'utf-8');
      for (const [find, replace] of patch.replacements) {
        content = content.replace(find, replace);
      }
      fs.writeFileSync(patch.file, content, 'utf-8');
      console.log(`✅ Patched libsignal ${patch.name} successfully.`);
    } catch {
      continue;
    }
  }
}

patchLibsignal();

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const pino = require('pino');
require('./events');
var currentVersion = "", versionCheckInterval = 180
var sock;
// ilk başlangıç olarak bir kez yüklemesi amacıyla true
global.updatedDB = true;

setInterval(async () => {
  if (!global.updatedDB) return;
  fs.writeFileSync("./database.json", JSON.stringify(global.database, null, 2));
  global.updatedDB = false;
  versionCheckInterval--;

  if (versionCheckInterval <= 0) {
    var getLatestCommit = await axios.get("https://api.github.com/repos/can2334/nexusproto/commits")

    if (currentVersion == "") {
      currentVersion = getLatestCommit.data[0].sha
    } else {
      if (getLatestCommit.data[0].sha != currentVersion) {
        currentVersion = getLatestCommit.data[0].sha
        await sock.sendMessage(sock.user.id, { image: { url: "./src/new_version.png" }, caption: "*🆕 New Version Available!*\n\n_Please update your bot via_ ```.update```" });
      }
    }
    versionCheckInterval = 180;
  }
}, 5000);

/**
 * Configures the logger with the specified options.
 */
const logger = pino({
  level: "silent",
  customLevels: {
    trace: 10000,
    debug: 10000,
    info: 10000,
    warn: 10000,
    error: 10000,
    fatal: 10000,
  },
});

function dict_length(dict) {
  let count = 0;
  for (let key in dict) {
    count++;
  }
  return count;
}

function safeEncode(text) {
  return text
    .replace(/```/g, "||BYGBgYAB||")
    .replace(/`/g, "||BYGAB||")
    .replace(/\n/g, "||BfCgB||")
    .replace(/_/g, "||BaXwB||")
    .replace(/\*/g, "||BsKgB||")
    .replace(/</g, "||BcPAB||")
    .replace(/>/g, "||BtPgB||");
}


function safeDecode(text) {
  return text
    .replace(/\|\|BYGBgYAB\|\|/g, "```")
    .replace(/\|\|BYGAB\|\|/g, "`")
    .replace(/\|\|BfCgB\|\|/g, "\n")
    .replace(/\|\|BaXwB\|\|/g, "_")
    .replace(/\|\|BsKgB\|\|/g, "*")
    .replace(/\|\|BcPAB\|\|/g, "<")
    .replace(/\|\|BtPgB\|\|/g, ">");
}



async function translateText(text) {
  try {
    if (!text) return text;
    if (!global?.database?.translate) return text;

    const targetLang = global?.database?.translateTo;
    if (!targetLang) {
      await global?.sock._original_sendMessage?.(global.sock.user.fixedId, { translate: true, text: "⚠️ _Please specify a language to translate to!_", })
      return text;
    };

    const cacheKey = Buffer.from(text).toString("base64");

    if (global?.database?.translateDb[cacheKey]) {
      return global.database.translateDb[cacheKey];
    }

    const encoded = safeEncode(text);
    let res = await axios.get(
      `https://ftapi.pythonanywhere.com/translate?sl=en&dl=${targetLang}&text=${encodeURIComponent(encoded)}`
    );

    let translated = res.data["destination-text"];
    translated = safeDecode(translated);
    global.database.translateDb[cacheKey] = translated;

    return translated;

  } catch (e) {
    console.log(e)
    return text;
  }
}




global.translateText = translateText
async function customSendMessage(number, message, quotedMsg = false) {
  let args = []
  try {
    if (typeof number === 'string') {

      if (number === 'owner') {
        args.push(sock.user.fixedId);

      } else if (number.includes("@")) {
        args.push(number);

      } else {
        return false;
      }
    } else if (typeof number === 'object') {
      if (number?.key?.remoteJid.includes("@lid")) {
        args.push(number?.key?.participantPn || number?.key?.senderPn || number?.key?.senderJid)
      }
      else
        args.push(number?.key?.remoteJid)

      if (message?.edit && !message?.edit?.fromMe) {
        delete message.edit
      }

      if (message.delete && message.delete.fromMe) {
        sock._original_sendMessage(args[0], { delete: message.delete });
        if (dict_length(message) === 1) return
        delete message.delete
      }
      args.push(message)
      if (quotedMsg && !number.key.fromMe) {
        args.push(quotedMsg)
      }
    }

  }
  catch (error) {
    console.log("local error:", error)
  }
  try {
    if (typeof number === 'object' && !args[1]?.text && !args[1]?.video && !args[1]?.audio && !args[1]?.image && !args[1]?.document && !args[1]?.sticker && !args[1]?.buttons && !args[1]?.templateMessage && !args[1]?.location && !args[1]?.contactMessage && !args[1]?.productMessage && !args[1]?.listMessage && !args[1]?.liveLocationMessage && !args[1]?.imageMessage && !args[1]?.videoMessage && !args[1]?.documentMessage && !args[1]?.audioMessage && !args[1]?.contactMessage && !args[1]?.locationMessage && !args[1]?.liveLocationMessage && !args[1]?.templateButtonReplyMessage && !args[1]?.listReplyMessage && !args[1]?.buttonsReplyMessage) {
      return
    }
    var findTranslate = args[1]?.translate
    if (args[1]?.text) {
      args[1].text = findTranslate == undefined ? args[1]?.text : await translateText(args[1]?.text, "tr")
    } else if (args[1]?.caption) {
      args[1].caption = findTranslate == undefined ? args[1]?.caption : await translateText(args[1]?.caption, "tr")
    }
    return await sock._original_sendMessage(...args);
  } catch (e) {
    console.log("baileys error", e)
  }
}

function test_lid(lid) {
  if (lid && lid.includes("@lid")) {
    return true
  } else if (lid && lid.includes("@s.whatsapp.net")) {
    return false
  }

}

global.getParticipantJid = async (sock, msg) => {
  if (msg.key.fromMe)
    return sock.user.fixedId

  else if (msg.key.senderPn && msg?.key?.senderPn?.includes("@s.whatsapp.net")) {
    return msg.key.senderPn
  }
  else if (msg?.key.remoteJid.includes("@s.whatsapp.net")) {
    return msg.key.remoteJid
  }

  else if (!test_lid(msg.key.participant)) {
    return msg.key.participant
  }
  else if (!test_lid(msg.key.participantPn)) {
    return msg.key.participantPn
  }
  return null
}

async function lidToJid(sock, lid, groupJid) {
  if (!lid) return null;
  if (!groupJid) return null;
  const groupMeta = await sock.groupMetadata(groupJid);
  for (const participant of groupMeta.participants) {
    if (participant.lid === lid) {
      return participant.jid;
    }
  }
  return null;
}

async function customFromMeCheck(sock, msg) {
  if (test_lid(msg.key.participant) && sock.user.fixedLid === msg.key.participant) {
    return true
  } else if (sock.user.fixedId === msg.key.participant) {
    return true
  }
  return false

}

async function customizeMsg(sock, msg) {
  msg.key.fromMe = msg?.key?.fromMe || await customFromMeCheck(sock, msg)
  const quotedMessage = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  msg.quotedMessage = quotedMessage;
  msg.key.senderJid = await global.getParticipantJid(sock, msg);
  if (msg.key.senderJid == null && msg.key.remoteJid.includes("@g.us")) {
    msg.key.senderJid = await lidToJid(sock, msg.participant, msg.key.remoteJid)
  }
  return msg
}

async function S3nnzy() {
  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(__dirname + "/session/");

  sock = makeWASocket({
    logger,
    markOnlineOnConnect: true,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    auth: state,
    version: version,
  });
  sock.user.fixedId = sock.user.id.split(':')[0] + '@s.whatsapp.net'; // burası
  sock.user.fixedLid = sock.user.lid.split(':')[0] + '@lid';
  sock._original_sendMessage = sock.sendMessage;
  sock.sendMessage = customSendMessage;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error.output.statusCode !== 401);
      if (shouldReconnect) {
        console.log('Disconnected, reconnecting...');
        S3nnzy();
      } else {
        console.log('QR code was not scanned.');
      }
    } else if (connection === 'open') {
      console.log('The connection is opened.');
      const usrId = sock.user.id;
      const mappedId = usrId.split(':')[0] + `@s.whatsapp.net`;
      if (!global.similarity) global.similarity = await import('string-similarity-js');
      await sock._original_sendMessage(mappedId, { text: "_NexusProto Online!_\n\n_Use_ ```" + global.handlers[0] + "menu``` _to see the list of commands._" });;
    }
  });

  sock.ev.on("messages.upsert", async (msg) => {
    if (msg?.type !== "notify")
      return;
    try {
      if (!msg.hasOwnProperty("messages") || msg.messages.length === 0) return;

      for (let { pushName, key } of msg.messages) {
        const sender = key.participant || (key.fromMe ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : key.remoteJid);
        if (pushName && !global.database.users?.[sender]) {
          global.database.users[sender] = pushName;
        }
      }

      const rawMessage = structuredClone(msg, sock);
      msg = msg.messages[0];
      const text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text
      if (!text) return;
      msg = await customizeMsg(sock, msg);
      if ((msg.key && msg.key.remoteJid === "status@broadcast")) return;
      if (global.database.blacklist.includes(msg.key.remoteJid) && !msg.key.fromMe) return;

      if (msg.key.participant == undefined) {
        if (msg.key.fromMe == false) {
          msg.key.participant = msg.key.remoteJid
        } else {
          msg.key.participant = sock.user.id.split(':')[0] + `@s.whatsapp.net`
        }
      }
      if (global.database.afkMessage.active && (!msg.key.fromMe && !global.database.sudo.includes(msg.key.participant.split('@')[0]))) {
        console.log("AFK")
        if (msg.key.remoteJid.includes("@s.whatsapp.net") || msg.key.remoteJid.includes("@lid")) {
          console.log("AFK 2")
          if (global.database.afkMessage.type == "text") {
            console.log("AFK 3")
            await sock.sendMessage(msg, { text: global.database.afkMessage.content });
          } else {
            console.log("AFK 4")
            var mediaPath = `./src/afk.${global.database.afkMessage.type}`;
            fs.writeFileSync(mediaPath, global.database.afkMessage.media, "base64");
            if (global.database.afkMessage.type == "video") {
              await sock.sendMessage(msg, { video: { url: mediaPath }, caption: global.database.afkMessage.content == "" ? undefined : global.database.afkMessage.content }, { quoted: rawMessage.messages[0] });
            } else {
              await sock.sendMessage(msg, { image: { url: mediaPath }, caption: global.database.afkMessage.content == "" ? undefined : global.database.afkMessage.content }, { quoted: rawMessage.messages[0] });
            }
            try { fs.unlinkSync(mediaPath) } catch { }
            return;
          }
        } else {
          console.log(rawMessage.messages[0]?.message?.extendedTextMessage?.contextInfo?.mentionedJid)
          if (rawMessage.messages[0]?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(sock.user.id.split(':')[0] + `@s.whatsapp.net`)) {
            if (global.database.afkMessage.type == "text") {
              await sock.sendMessage(msg, { text: global.database.afkMessage.content }, { quoted: rawMessage.messages[0] });
            } else {
              var mediaPath = `./src/afk.${global.database.afkMessage.type}`;
              fs.writeFileSync(mediaPath, global.database.afkMessage.media, "base64");
              if (global.database.afkMessage.type == "video") {
                await sock.sendMessage(msg, { video: { url: mediaPath }, caption: global.database.afkMessage.content == "" ? undefined : global.database.afkMessage.content }, { quoted: rawMessage.messages[0] });
              } else {
                await sock.sendMessage(msg, { image: { url: mediaPath }, caption: global.database.afkMessage.content == "" ? undefined : global.database.afkMessage.content }, { quoted: rawMessage.messages[0] });
              }
              try { fs.unlinkSync(mediaPath) } catch { }
              return;
            }
          }
          if (rawMessage.messages[0]?.message?.extendedTextMessage?.contextInfo?.participant == sock.user.id.split(':')[0] + `@s.whatsapp.net`) {
            if (global.database.afkMessage.type == "text") {
              await sock.sendMessage(msg, { text: global.database.afkMessage.content });
            } else {
              var mediaPath = `./src/afk.${global.database.afkMessage.type}`;
              fs.writeFileSync(mediaPath, global.database.afkMessage.media, "base64");
              if (global.database.afkMessage.type == "video") {
                await sock.sendMessage(msg, { video: { url: mediaPath }, caption: global.database.afkMessage.content == "" ? undefined : global.database.afkMessage.content });
              } else {
                await sock.sendMessage(msg, { image: { url: mediaPath }, caption: global.database.afkMessage.content == "" ? undefined : global.database.afkMessage.content });
              }
              try { fs.unlinkSync(mediaPath) } catch { }
              return;
            }
          }
        }
        return;
      }
      // no wait 

      start_command(msg, sock, rawMessage);

    } catch (error) {
      console.log(error);
      await sock.sendMessage(sock.user.id, { text: `*⚠️ NexusProto Error:*\n${error}` });
    }
  });

  sock.ev.on("group-participants.update", async (participant) => {
    if (global.database.blacklist.includes(participant.id)) return;
    if (participant.action === 'add') {
      const welcomeMessage = global.database.welcomeMessage.find(welcome => welcome.chat === participant.id);
      if (welcomeMessage) {
        const mediaPath = `./welcome.${welcomeMessage.type}`;
        if (['image', 'video'].includes(welcomeMessage.type)) {
          fs.writeFileSync(mediaPath, welcomeMessage.media, "base64");
          const messageOptions = {
            [welcomeMessage.type]: { url: mediaPath },
            caption: welcomeMessage.content || undefined,
            mentions: participant.participants
          };
          await sock.sendMessage(participant.id, messageOptions);
        } else {
          await sock.sendMessage(participant.id, { text: welcomeMessage.content, mentions: participant.participants });
        }
      }
    } else if (participant.action === 'remove') {
      const goodbyeMessage = global.database.goodbyeMessage.find(goodbye => goodbye.chat === participant.id);
      if (goodbyeMessage) {
        const mediaPath = `./goodbye.${goodbyeMessage.type}`;
        if (['image', 'video'].includes(goodbyeMessage.type)) {
          fs.writeFileSync(mediaPath, goodbyeMessage.media, "base64");
          const messageOptions = {
            [goodbyeMessage.type]: { url: mediaPath },
            caption: goodbyeMessage.content || undefined,
            mentions: participant.participants
          };
          await sock.sendMessage(participant.id, messageOptions);
        } else {
          await sock.sendMessage(participant.id, { text: goodbyeMessage.content, mentions: participant.participants });
        }
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)

  loadModules(__dirname + "/modules");
}

/**
 * Loads and requires all JavaScript modules from the specified directory path.
 *
 * @param {string} modulePath - The directory path where the modules are located.
 */

function loadModules(modulePath, logger = true, refresh = false) {
  fs.readdirSync(modulePath).forEach((file) => {
    if (file.endsWith(".js")) {
      if (refresh) {
        delete require.cache[require.resolve(`${modulePath}/${file}`)];
        logger ? console.log(`Reloading plugin: ${file}`) : null;
        try {
          require(`${modulePath}/${file}`);
        }
        catch (e) {
          console.log("load module error:", e)
        }
      } else {
        logger ? console.log(`Loading plugin: ${file}`) : null;
      }
    }
  });
}
global.loadModules = loadModules;
S3nnzy();

/**
 * Downloads media from a WhatsApp message and saves it to the specified file path.
 *
 * @param {Object} message - The WhatsApp message object containing the media.
 * @param {string} type - The type of the media (e.g. "image", "video", "document").
 * @param {string} filepath - The file path to save the downloaded media.
 * @returns {Promise<void>} - A Promise that resolves when the media has been downloaded and saved.
 */
global.downloadMedia = async (message, type, filepath) => {
  const stream = await downloadContentFromMessage(
    {
      url: message.url,
      directPath: message.directPath,
      mediaKey: message.mediaKey,
    },
    type
  );

  const writeStream = fs.createWriteStream(filepath);
  const { pipeline } = require("stream/promises");
  await pipeline(stream, writeStream);
};/**
 * Checks if the number is an admin in the group.
 *
 * @param {Object} msg - The message object.
 * @param {Object} sock - The WhatsApp socket object.
 * @param {string} groupId - The ID of the group to check.
 * @param {string|boolean} number - Optional number. If false, the bot's own number is used.
 * @returns {Promise<boolean>} - Returns true if the bot is an admin, otherwise false.
 */

global.checkAdmin = async function (msg, sock, groupId, number = false) {
  try {
    const groupMetadata = await sock.groupMetadata(groupId);
    let Number = number ? number : sock.user.id.split(":")[0] + "@s.whatsapp.net";
    return groupMetadata.participants.some(participant =>
      participant.id === Number && participant.admin
    );
  } catch (error) {
    console.error("An error occurred while checking admin status: ", error);
    return false;
  }
};

global.getAdmins = async function (groupId) {
  try {
    const groupMetadata = await sock.groupMetadata(groupId);
    const admins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
    return admins
  } catch (error) {
    console.error("An error occurred while getting admin list: ", error);
    return [];
  }
};
/**
 * Downloads the contents of the given URL as an arraybuffer.
 *
 * @param {string} url - The URL to download.
 * @returns {Promise<ArrayBuffer>} - A Promise that resolves to the arraybuffer, or an empty string if the download fails.
 */
global.downloadarraybuffer = async function (url) {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return response.data;
  } catch (error) {
    return null
  }
}

Object.defineProperty(global, "sock", {
  get: function () {
    return sock;
  },
  set: function (newSock) {
    sock = newSock;
  },
  configurable: true
});