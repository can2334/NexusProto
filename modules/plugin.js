const axios = require("axios");
const fs = require("fs");

addCommand({ pattern: "^plugin ?(.*)", access: "sudo", desc: "_Seacrh for a plugin in the store. https://github.com/can2334/NexusPluginMarket_" }, async (msg, match, sock, rawMessage) => {
    const groupId = msg.key.remoteJid;
    const query = match[1];
    let text;
    if (!query) {
        var getLocalPlugins = global.database.plugins;
        if (getLocalPlugins == undefined || getLocalPlugins.length == 0) {
            return await sock.sendMessage(msg, { translate: true, text: "_❌ No plugins found._\n\n_⌨️ To search for plugins, use_ ```" + global.handlers[0] + "plugin <plugin-name>```\n_⌨️ To get top downloaded plugins, use_ ```" + global.handlers[0] + "plugin top```", edit: msg.key }, { quoted: rawMessage.messages[0] });

        } else {

            text = "📜 _Plugins_\n-------------------------";
            for (var i = 0; i < getLocalPlugins.length; i++) {
                if (!fs.existsSync(getLocalPlugins[i].path)) {
                    global.database.plugins = global.database.plugins.filter(plugin => plugin.id != getLocalPlugins[i].id);
                    continue;
                }
                text += "\n_Plugin :: " + getLocalPlugins[i].name + "_\n_Version :: " + getLocalPlugins[i].version + "_\n_Author :: " + getLocalPlugins[i].author + "_\n_Description :: " + getLocalPlugins[i].description + "_\n_ID :: " + getLocalPlugins[i].id + "_\n-------------------------";
            }
            text += await global.translateText("\n\n_⌨️ To delete a plugin, use_ ```") + global.handlers[0] + "pldelete <plugin-id>```"
            text += await global.translateText("\n_⌨️ To search for plugins, use_ ```") + global.handlers[0] + "plugin <plugin-name>```"
            text += await global.translateText("\n_⌨️ To get top downloaded plugins, use_ ```") + global.handlers[0] + "plugin top```"

            if (global.database.plugins.length == 0) {
                return await sock.sendMessage(msg, { translate: true, text: "_❌ No plugins found._", edit: msg.key }, { quoted: rawMessage.messages[0] });

            }
            return await sock.sendMessage(msg, { text, edit: msg.key }, { quoted: rawMessage.messages[0] });

        }
    }

    if (query == "top") {
        await sock.sendMessage(msg, { translate: true, text: "_🔍 Searching for plugins..._", edit: msg.key }, { quoted: rawMessage.messages[0] });


        var getPlugin = await axios.get("https://create.thena.workers.dev/pluginMarket");

        var plugins = getPlugin.data;

        plugins.sort(function (a, b) {
            return b.downloads - a.downloads;
        })

        text = "📜 _Top 5 Plugins_\n-------------------------";
        var addedPlugins = [];

        for (var i = 0; i < 5; i++) {
            try {
                if (addedPlugins.includes(plugins[i].pluginId)) {
                    continue;
                }
                addedPlugins.push(plugins[i].pluginId);
                text += "\n_Plugin :: " + plugins[i].pluginName + "_\n_Version :: " + plugins[i].pluginVersion + "_\n_Author :: " + plugins[i].author + "_\n_Description :: " + plugins[i].description + "_\n_ID :: " + plugins[i].pluginId + "_\n_Downloads :: " + plugins[i].downloads + "_\n-------------------------";
            } catch {
                continue;
            }
        }

        text += await global.translateText("\n\n_⌨️ To install a plugin, use_ ```") + global.handlers[0] + "plinstall <plugin-id>```"
        text += await global.translateText("\n_⌨️ To delete a plugin, use_ ```") + global.handlers[0] + "pldelete <plugin-id>```"
        text += await global.translateText("\n_⌨️ To get top downloaded plugins, use_ ```") + global.handlers[0] + "plugin top```"

        return await sock.sendMessage(msg, { text, edit: msg.key }, { quoted: rawMessage.messages[0] });

    }

    await sock.sendMessage(msg, { text: "_🔍 Searching for plugins..._", edit: msg.key }, { quoted: rawMessage.messages[0] });


    var getPlugin = await axios.get("https://create.thena.workers.dev/pluginMarket?search=" + query);
    var plugins = getPlugin.data;

    if (plugins.length == 0) {
        return await sock.sendMessage(msg, { translate: true, text: "_❌ No plugins found._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }

    plugins.sort(function (a, b) {
        return b.downloads - a.downloads;
    })

    text = "📜 _Plugins_\n-------------------------";
    var addedPlugins = [];

    for (var i = 0; i < 5; i++) {
        try {
            if (addedPlugins.includes(plugins[i]?.pluginId)) {
                continue;
            }
            addedPlugins.push(plugins[i].pluginId);
            text += "\n_Plugin :: " + plugins[i].pluginName + "_\n_Version :: " + plugins[i].pluginVersion + "_\n_Author :: " + plugins[i].author + "_\n_Description :: " + plugins[i].description + "_\n_ID :: " + plugins[i].pluginId + "_\n_Downloads :: " + plugins[i].downloads + "_\n-------------------------";
        } catch {
            continue;
        }
    }

    text += await global.translateText("\n\n_⌨️ To install a plugin, use_ ```") + global.handlers[0] + "plinstall <plugin-id>```"
    text += await global.translateText("\n_⌨️ To delete a plugin, use_ ```") + global.handlers[0] + "pldelete <plugin-id>```"
    text += await global.translateText("\n_⌨️ To get top downloaded plugins, use_ ```") + global.handlers[0] + "plugin top```"

    return await sock.sendMessage(msg, { translate: true, text, edit: msg.key }, { quoted: rawMessage.messages[0] });


})

addCommand({ pattern: "^plinstall ?(.*)", access: "sudo", dontAddCommandList: true }, async (msg, match, sock, rawMessage) => {
    const groupId = msg.key.remoteJid;
    const pluginId = match[1];

    if (!pluginId) {
        return await sock.sendMessage(msg, { translate: true, text: "_❌ Please enter the id of the plugin you want to install._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }

    await sock.sendMessage(msg, { translate: true, text: "_🔄 Installing plugin..._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    var getPlugin = await axios.get("https://create.thena.workers.dev/pluginMarket?id=" + pluginId);
    if (getPlugin.data.author == "Unknown") {
        return await sock.sendMessage(msg, { translate: true, text: "_❌ Plugin not found._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }

    var plugin = getPlugin.data;

    if (global.database.plugins && global.database.plugins.find(plugin2 => plugin2.id == plugin.pluginId)) {
        return await sock.sendMessage(msg, { translate: true, text: "_❌ Plugin already installed._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }

    await sock.sendMessage(msg, { text: await global.translateText("_✅ Plugin installed successfully._\n\n_Please type_ ```") + global.handlers[0] + plugin.usage + "``` _to use the plugin!_", edit: msg.key }, { quoted: rawMessage.messages[0] });


    global.database.plugins.push({
        name: plugin.pluginName,
        version: plugin.pluginVersion,
        description: plugin.description,
        author: plugin.author,
        id: plugin.pluginId,
        path: "./modules/" + plugin.pluginFileName
    });

    fs.writeFileSync("./modules/" + plugin.pluginFileName, plugin.context);
    return;
})

addCommand({ pattern: "^pldelete ?(.*)", access: "sudo", dontAddCommandList: true }, async (msg, match, sock, rawMessage) => {
    const pluginName = match[1];

    if (!pluginName) {
        return await sock.sendMessage(msg, { translate: true, text: "_❌ Please enter the name of the plugin you want to delete._", edit: msg.key }, { quoted: rawMessage.messages[0] });
    }

    await sock.sendMessage(msg, { translate: true, text: "_🔄 Deleting plugin..._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    if (global.database.plugins && global.database.plugins.find(plugin => plugin.id == pluginName)) {
        var pluginPath = global.database.plugins.find(plugin => plugin.id == pluginName).path;
        global.database.plugins = global.database.plugins.filter(plugin => plugin.id != pluginName);
        try { fs.unlinkSync(pluginPath); } catch (e) { }
        return await sock.sendMessage(msg, { translate: true, text: "_✅ Plugin deleted successfully._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    } else {
        return await sock.sendMessage(msg, { translate: true, text: "_❌ Plugin not found._", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }
})