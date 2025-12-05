const simpleGit = require('simple-git');
const git = simpleGit();

addCommand({ pattern: "^update$", access: "sudo", desc: "_Update the bot._" }, async (msg, match, sock, rawMessage) => {
    const groupId = msg.key.remoteJid;


    const send_key = await sock.sendMessage(groupId, { translate: true, text: `_🔄 Updating..._`, edit: msg.key }, { quoted: rawMessage.messages[0] });

    var publicMessage = msg.key.fromMe ? msg.key : send_key.key;


    await git.fetch();
    var commits = await git.log(["main" + '..origin/' + "main"]);

    if (commits.total === 0) {
        await sock.sendMessage(groupId, { translate: true, text: `_🔄 No updates available._`, edit: publicMessage });

        return;
    } else {
        var news = await global.translateText("*🆕 New Changes:*\n");
        commits['all'].map(
            (commit) => {
                news += '▫️ [' + commit.date.substring(0, 10) + ']: ' + commit.message + ' <' + commit.author_name + '>\n';
            }
        );

        news = news + await global.translateText("\n_Please type ```") + global.handlers[0] + "update now```" + await global.translateText("_to update the bot._");
        await sock.sendMessage(groupId, { text: news, edit: publicMessage });

    }

    return;
});

addCommand(({ pattern: "^update now$", access: "sudo", dontAddCommandList: true }), async (msg, match, sock, rawMessage) => {
    const groupId = msg;

    const send_key = await sock.sendMessage(groupId, { translate: true, text: `_🔄 Updating..._`, edit: msg.key }, { quoted: rawMessage.messages[0] });

    var publicMessage = msg.key.fromMe ? msg.key : send_key.key;

    await git.stash();
    try {
        await git.pull();
        await sock.sendMessage(groupId, { translate: true, text: `_✅ Update successful._`, edit: publicMessage });

    } catch (err) {
        if (msg.key.fromMe) {
            await sock.sendMessage(groupId, { translate: true, text: `_❌ Update failed._\n\n_If you changed the local files that means you cant update automatically. Please rebuild the bot._`, edit: publicMessage });

        }
        await git.stash(['pop']);
        process.exit(0);
    }
});