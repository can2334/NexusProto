const youtubesearchapi = require("youtube-search-api");
const axios = require('axios');
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const stream = require("stream");
const fs = require('fs');
ffmpeg.setFfmpegPath(ffmpegPath);

async function fixVideoBuffer(buffer) {
    const out_path = "./src/youtube_mp3" + Date.now().toString() + ".mp4";
    const input = new stream.PassThrough();
    input.end(buffer);

    await new Promise((resolve, reject) => {
        ffmpeg(input)
            .outputOptions([
                "-map 0",
                "-c:v copy",
                "-c:a copy",
                "-movflags +faststart"
            ])
            .on("stderr", l => console.log("ffmpeg:", l))
            .on("end", resolve)
            .on("error", reject)
            .save(out_path);
    });

    const fixed = fs.readFileSync(out_path);

    fs.unlinkSync(out_path);

    return fixed;
}



const BASE_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Origin": "https://iframe.y2meta-uk.com",
    "Referer": "https://iframe.y2meta-uk.com/"
};

const TUNNEL_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Referer": "https://iframe.y2meta-uk.com/",
    "Accept-Language": "tr,en-US;q=0.9,en;q=0.8",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
};

async function downloadTunnel(url, filename) {
    const MAX_RETRY = 8;

    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
        try {
            const response = await axios.get(url, {
                responseType: "arraybuffer",
                timeout: 20000,
                maxRedirects: 5,
                headers: TUNNEL_HEADERS,
                validateStatus: () => true
            });

            if (response.status !== 200) continue;

            const buffer = Buffer.from(response.data);
            if (buffer.length < 1500) continue;

            if (filename) fs.writeFileSync(filename, buffer);
            return buffer;
        } catch { }
        await new Promise(r => setTimeout(r, attempt * 700));
    }

    return false;
}

async function getSanityKey() {
    const res = await axios.get("https://cnv.cx/v2/sanity/key", {
        headers: BASE_HEADERS
    });

    return {
        key: res.data.key,
        cookie: res.headers["set-cookie"]?.[0] || ""
    };
}

async function convert(videoUrl, format = "mp3") {
    const { key, cookie } = await getSanityKey();

    const params = new URLSearchParams({
        link: videoUrl,
        format,
        audioBitrate: "128",
        videoQuality: "720",
        filenameStyle: "pretty",
        vCodec: "h264"
    }).toString();

    const res = await axios.post("https://cnv.cx/v2/converter", params, {
        headers: {
            ...BASE_HEADERS,
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookie,
            "key": key
        }
    });

    return res.data;
}

async function download_yt(videoUrl, format = "mp3") {
    const result = await convert(videoUrl, format);

    return downloadTunnel(result.url, null);
}

async function parseFormattedResults(formattedText) {
    if (!formattedText) return;

    const formattedEntries = formattedText.split("\n\n");
    const parsedEntries = [];

    for (const entry of formattedEntries) {
        if (!entry) continue;

        try {
            const lines = entry.split("\n");

            const resultData = {
                title: lines[0].replace("🎵 ", ""),
                index: lines[1].replace("🎧 index: ", ""),
                channelTitle: lines[2].replace("👤 ", ""),
                length: lines[3].replace("⏱️ ", ""),
                id: lines[4].replace("🔗 ", "")
            };

            parsedEntries.push(resultData);

        } catch (err) {
            console.log(err);
        }
    }

    return parsedEntries;
}


async function formatSearchResults(searchResults) {
    let output = "";

    for (const [idx, item] of searchResults.items.entries()) {
        output += "🎵 " + item.title.replace(/\([^()]*\)/g, "").trim() + "\n";
        output += "🎧 index: " + (idx + 1) + "\n";
        output += "👤 " + item.channelTitle + "\n";
        output += "⏱️ " + item.length.simpleText.toString() + "\n";
        output += "🔗 " + item.id;
        output += "\n\n";
    }

    return output;
}


async function getResultByIndex(entries, idx) {
    if (!entries) return;

    for (const entry of entries) {
        if (entry.index == idx.toString()) {
            return entry;
        }
    }
}

async function searchYt(query) {
    const searchResults = await youtubesearchapi.GetListByKeyword(query, false, 5, {});
    console.log("searchResults", query)
    const formattedText = await formatSearchResults(searchResults);

    return formattedText
}

async function handleSearchDownload(msg, m, sock, r,) {
    const quoted = msg?.quotedMessage
    if (!quoted) return await sock.sendMessage(msg, { text: "_Please reply to a search result!_", edit: msg.key }, { quoted: r.messages[0] });
    const type = m[2];
    const parsedText = await parseFormattedResults(quoted.conversation);
    const result = await getResultByIndex(parsedText, m[3]);
    if (result) {
        const send_key = await sock.sendMessage(msg, { translate: true, text: "_⏳ Downloading..._", edit: msg.key }, { quoted: r.messages[0] });
        let buffer = await download_yt("https://www.youtube.com/watch?v=" + result.id, "mp3");
        var publicMessage = msg.key.fromMe ? msg.key : send_key.key;
        if (type == "-audio") {
            await sock.sendMessage(msg, {
                delete: publicMessage,
                audio: buffer,
                mimetype: 'audio/mpeg',
                ptt: false
            }, { quoted: r.messages[0] });

        } else if (type == "-video") {
            let buffer = await download_yt("https://www.youtube.com/watch?v=" + result.id, "mp4");
            buffer = await fixVideoBuffer(buffer)
            await sock.sendMessage(msg, {
                delete: publicMessage,
                video: buffer,
                mimetype: 'video/mp4',
            }, { quoted: r.messages[0] });
        } else
            return sock.sendMessage(msg, { translate: true, text: "_❌ Please provide a valid type!_", edit: msg.key }, { quoted: r.messages[0] });
    } else {
        return sock.sendMessage(msg, { translate: true, text: "_❌ Please reply to a search result!_", edit: msg.key }, { quoted: r.messages[0] });
    }
};
async function handleSearch(msg, match, sock, rawMessage) {
    try {
        const query = match.slice(2).join("");
        if (query) {
            const send_key = await sock.sendMessage(msg, { translate: true, text: "_⏳ Searching..._", edit: msg.key }, { quoted: rawMessage.messages[0] });
            var publicMessage = msg.key.fromMe ? msg.key : send_key.key;

            const text = await searchYt(query);
            if (text) {
                await sock.sendMessage(msg, { text, edit: publicMessage }, { quoted: rawMessage.messages[0] });
            } else {
                await sock.sendMessage(msg, { translate: true, text: "_❌ Something went wrong!_", edit: publicMessage }, { quoted: rawMessage.messages[0] });
            }
        } else
            return sock.sendMessage(msg, { translate: true, text: "_❌ Please provide a query to search for._", edit: msg.key }, { quoted: rawMessage.messages[0] });
    } catch (err) {
        console.log(err);
    }
};

async function handleFastDownload(msg, match, sock, rawMessage) {
    const type = match[2];
    console.log("type", type)
    const query = match.slice(3).join("");
    if (query) {
        let url;
        const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;
        const send_key = await sock.sendMessage(msg, { translate: true, text: "_⏳ Downloading..._", edit: msg.key }, { quoted: rawMessage.messages[0] });
        console.log("send_key", send_key)
        var publicMessage = msg.key.fromMe ? msg.key : send_key.key;
        if (query.match(ytRegex))
            url = query;
        else {
            const searchResults = await youtubesearchapi.GetListByKeyword(query.replace(' ', '-'), false, 1, {});
            const videoId = searchResults?.items?.[0]?.id
            if (!videoId)
                return sock.sendMessage(msg, { translate: true, text: "_❌ No results found!_", edit: publicMessage }, { quoted: rawMessage.messages[0] });
            url = "https://www.youtube.com/watch?v=" + videoId;
        }
        console.log(url)

        if (!url)
            return sock.sendMessage(msg, { translate: true, text: "_❌ No results found!_", edit: publicMessage }, { quoted: rawMessage.messages[0] });

        if (type == "-audio") {
            const buffer = await download_yt(url, "mp3");
            console.log("BUFFER ARGS: ", buffer.slice(0, 10));
            await sock.sendMessage(msg, {
                delete: publicMessage,
                audio: buffer,
                mimetype: 'audio/mpeg',
                ptt: false
            }, { quoted: rawMessage.messages[0] });

        } else if (type == "-video") {
            let buffer = await download_yt(url, "mp4");
            buffer = await fixVideoBuffer(buffer)
            console.log(buffer);
            await sock.sendMessage(msg, {
                delete: publicMessage,
                video: buffer,
            }, { quoted: rawMessage.messages[0] });
        } else
            return sock.sendMessage(msg, { translate: true, text: "_❌ Please provide a valid type!_", edit: msg.key }, { quoted: rawMessage.messages[0] });

    }
};

async function handleHelp(msg, match, sock, rawMessage) {
    let helpText = [
        global.translateText(`*📌 YouTube Help Menu*\n`),
        global.translateText(`\n*🔍 Search*\n`),
        `\`yt -search <keywords>\`\n`,
        global.translateText(`Searches YouTube and returns a formatted list of results.\n`),

        global.translateText(`\n*⬇️ Download From Search*\n`),
        `\`yt -ds -audio <index>\`\n`,
        `\`yt -ds -video <index>\`\n`,
        global.translateText(`<index> refers to the number shown in the search results.\n`),

        global.translateText(`\n*⚡ Fast Download (No Listing)*\n`),
        `\`yt -fast -audio <keywords>\`\n`,
        `\`yt -fast -video <keywords>\`\n`,
        global.translateText(`Downloads the first YouTube result directly without displaying the list.\n`),

        global.translateText(`\n*🎧 Audio Format*\n`),
        global.translateText(`Default audio: Opus (ogg) — high quality, small size.\n`),

        global.translateText(`\n*💡 Tips*\n`),
        global.translateText(`• When using \`-ds\`, you *must reply* to a search result.\n`),
        global.translateText(`• Video downloads may take longer depending on size.\n`),

        global.translateText(`\n*🆘 Help*\n`),
        `\`yt -help\`\n`,
        global.translateText(`Shows this help menu.`)
    ];
    helpText = await Promise.all(helpText)
    await sock.sendMessage(msg, { text: helpText.join(""), edit: msg.key }, { quoted: rawMessage.messages[0] });
}

const args = {
    "-search": handleSearch,
    "-ds": handleSearchDownload,
    "-fast": handleFastDownload,
    "-help": handleHelp
}
addCommand({ pattern: "^yt ?(.*)", access: "all" }, async (msg, match, sock, rawMessage) => {
    try {
        match = match[0].split(" ");
        const req = match[1];
        if (!req) {
            return await sock.sendMessage(msg, { translate: true, text: "_❌ Please provide a command!_", edit: msg.key }, { quoted: rawMessage.messages[0] });
        }
        const functions = args[req];

        if (functions) {
            await functions(msg, match, sock, rawMessage);
        } else {
            await sock.sendMessage(msg, { translate: true, text: "_❌ Unknown command. Use `yt - help`_", edit: msg.key }, { quoted: rawMessage.messages[0] });
        }

    } catch (e) {
        console.error(e);
        await sock.sendMessage(msg, {
            translate: true,
            text: "_❌ An unexpected error occurred. Try again later!_",
            edit: msg.key
        }, { quoted: rawMessage.messages[0] });
    }
});