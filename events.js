var database = require("./database.json");
var PREFIX = database.handlers;
var fs = require("fs");
var commands = [];
const axios = require("axios");

function proxify(obj, onChange, seen = new WeakSet()) {
  if (obj && typeof obj === "object") {
    if (seen.has(obj)) return obj;
    seen.add(obj);

    for (let key in obj) {
      obj[key] = proxify(obj[key], onChange, seen);
    }

    return new Proxy(obj, {
      set(target, prop, value) {
        target[prop] = proxify(value, onChange, seen);
        onChange(target, prop, value);
        return true;
      },
      deleteProperty(target, prop) {
        delete target[prop];
        onChange(target, prop, undefined);
        return true;
      }
    });
  }
  return obj;
}


/**
 * Watches the database.json file for changes and updates the global state accordingly.
 * This function is responsible for monitoring the database.json file for any changes,
 * and then updating the global state variables like `handlers`, `commands`, and `database`
 * to reflect the changes. It also attempts to reload the modules in the `./modules` directory.
 */
function watchDatabase() {
  try {
    fs.watch("./database.json", async function () {
      try { delete require.cache[require.resolve("./database.json")]; } catch { }
      try { database = require("./database.json"); } catch { }
      try { PREFIX = database.handlers; } catch { }
      try { global.handlers = PREFIX; } catch { }
      try { global.commands = commands; } catch { }
      try { global.database = proxify(database, () => { global.updatedDB = true; }); } catch { }
      commands = [];
      try { global.loadModules(__dirname + "/modules", false, true); } catch { }
    });
  } catch {
    return watchDatabase()
  }
}
watchDatabase()

/**  
 * Adds a new command to the list of commands.  
 *  
 * @param {Object} commandInfo - The information about the command to add.  
 * @param {Function} callback - The callback function to execute when the command is invoked.  
*/
function addCommand(commandInfo, callback) {
  commands.push({ commandInfo, callback });
}

function match_from_regex(pattern, text) {
  return text?.match(new RegExp(pattern, "im"));
}

function permission_check(sudo_list, userId, msg) {
  for (let sudo_user of sudo_list) {
    if (sudo_user + "@s.whatsapp.net" === msg.key.senderJid) {
      return true
    }
  }
  return false
}

function prefix_check(prefix_list, text) {
  for (let prefix of prefix_list) {
    if (text?.trimStart().startsWith(prefix)) {
      return text.slice(prefix.length).trim();
    }
  }
  return false
}

function commad_check(sortedCommands, text) {
  for (const { commandInfo } of sortedCommands) {
    if (match_from_regex(commandInfo.pattern, text)) {
      return true;
    }
  }
}

function command_callable_check(sock, msg, commandInfo, ownerId) {
  const groupCheck = msg.key.remoteJid.endsWith('@g.us');
  let userId = msg.key.participant;
  let permission = msg.key.fromMe ? true : permission_check(database.sudo, msg.key.remoteJid, msg);
  // let permission = true


  if (!commandInfo.access && commandInfo.fromMe !== msg.key.fromMe) return false;
  if (!permission && database.worktype === "private") return false;
  if (commandInfo.access === "sudo" && !permission) return false;
  if (commandInfo.notAvaliablePersonelChat && msg.key.remoteJid === ownerId) return false;
  if (commandInfo.onlyInGroups && !groupCheck) return false;

  return true
}

async function call_onMessage(commands, text, msg, sock, rawMessage) {
  for (const { commandInfo, callback } of commands) {
    if (commandInfo.pattern === "onMessage" && commandInfo.fromMe !== msg.key.fromMe) {
      msg.text = text ? text : "";
      await callback(msg, null, sock, rawMessage);
    }
  }
  return;
}

/**
 * Processes a message to determine if it matches any registered command patterns,
 * and executes the corresponding callback if a match is found. The function first
 * checks whether the message starts with a valid prefix and then verifies if it 
 * matches any command patterns. It handles permission checks for commands based 
 * on the user's access level and the bot's operational mode (e.g., private, group).
 * If the command is associated with a plugin, it ensures the plugin is installed
 * and up-to-date before executing the callback.
 *
 * @param {object} msg - The message object received from the WhatsApp socket.
 * @param {object} sock - The WhatsApp socket connection.
 * @param {object} rawMessage - The raw message object.
 * @returns {Promise<void>} - A promise that resolves when the command has been processed.
 */

async function start_command(msg, sock, rawMessage) {
  const text =
    msg?.message?.conversation || msg?.message?.extendedTextMessage?.text;
  let matchedPrefix = false;
  let validText = text;

  let check_prefix = prefix_check(PREFIX, text);

  if (check_prefix) {
    matchedPrefix = true;
    validText = check_prefix;
  }

  var sortedCommands = commands.sort((a, b) => b.commandInfo.pattern.length - a.commandInfo.pattern.length);
  let isCommand = commad_check(sortedCommands, validText);
  if (!isCommand) {
    return call_onMessage(commands, text, msg, sock, rawMessage);
  }

  for (const { commandInfo, callback } of sortedCommands) {
    const match = match_from_regex(commandInfo.pattern, validText);
    if (match && matchedPrefix) {

      if (!command_callable_check(sock, msg, commandInfo, sock.user.fixedId)) {
        return;
      }

      if (commandInfo.pluginId && (global.database.plugins.findIndex(plugin => plugin.id === commandInfo.pluginId) === -1)) {
        global.loadModules(__dirname + "/modules", false, true);
        var getExitingPluginData = await axios.get("https://create.thena.workers.dev/pluginMarket?id=" + commandInfo.pluginId);
        getExitingPluginData = getExitingPluginData.data;
        global.database.plugins.push({
          name: getExitingPluginData.pluginName,
          version: commandInfo.pluginVersion,
          description: getExitingPluginData.description,
          author: getExitingPluginData.author,
          id: getExitingPluginData.pluginId,
          path: "./modules/" + getExitingPluginData.pluginFileName
        });
      }

      if (commandInfo.pluginVersion && commandInfo.pluginId) {
        var getPluginUpdate = await axios.get("https://create.thena.workers.dev/pluginMarket");
        getPluginUpdate = getPluginUpdate.data;
        getPluginUpdate = getPluginUpdate.find(plugin => plugin.pluginId === commandInfo.pluginId);
        if (!getPluginUpdate) {
          return; // Don't run if plugin not found.
        }
        getPluginUpdate = { data: getPluginUpdate };
        if (getPluginUpdate.data.pluginVersion !== commandInfo.pluginVersion) {
          const editedPl = {
            name: getPluginUpdate.data.pluginName,
            version: getPluginUpdate.data.pluginVersion,
            description: getPluginUpdate.data.description,
            author: getPluginUpdate.data.author,
            id: getPluginUpdate.data.pluginId,
            path: "./modules/" + getPluginUpdate.data.pluginFileName
          }
          global.database.plugins[global.database.plugins.findIndex(plugin => plugin.id === commandInfo.pluginId)] = editedPl;
          fs.writeFileSync("./modules/" + getPluginUpdate.data.pluginFileName, getPluginUpdate.data.context);
          global.loadModules(__dirname + "/modules", false, true);
          if (msg.key.fromMe) {
            await sock.sendMessage(msg.key.remoteJid, { text: "_🆕 " + getPluginUpdate.data.pluginName + " Plugin Updated To " + getPluginUpdate.data.pluginVersion + "._\n\n_Please try again._", edit: msg.key });
          } else {
            await sock.sendMessage(msg.key.remoteJid, { text: "_🆕 " + getPluginUpdate.data.pluginName + " Plugin Updated To " + getPluginUpdate.data.pluginVersion + "._\n\n_Please try again._" }, { quoted: rawMessage.messages[0] });
          }
          return;
        }
      }
      await callback(msg, match, sock, rawMessage);
      return;
    }
  }
}

global.addCommand = addCommand;
global.start_command = start_command;
global.commands = commands;
global.handlers = PREFIX;
global.database = proxify(database, () => { global.updatedDB = true; });