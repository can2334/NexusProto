const axios = require("axios");
const cheerio = require("cheerio");

// thanks for antoloji.com
const base_url = "https://www.antoloji.com"

async function countNewlines(str = "") {
    const real = str.match(/^\n+/);
    if (real) return real[0].length;

    const lit = str.match(/^(\\n)+/);
    if (lit) return lit[0].length / 2;

    return 0;
};

async function clean(str) {
    const new_line_count = await countNewlines(str)
    if (new_line_count > 0) {
        str = str.substring(new_line_count)
    }
    return str
}
async function get_url($) {
    let urls = [];
    $(".poem-list").each((index, element) => {
        const h5 = $(element).find("h5");

        const hasSpan = h5.find("span").length > 0;

        if (!hasSpan) {
            const href = $(element).find("a").attr("href");
            if (href) urls.push(href);
        }
    });
    return urls
}

async function search(query) {
    const response = await axios.get(base_url + `/arama/?yer=5&arama=${query}`);
    const $ = cheerio.load(response.data);
    return await get_url($);
}

async function get_text(urls) {
    if (urls.length > 0) {
        let text = ""
        const response = await axios.get(base_url + urls[Math.floor(Math.random() * urls.length)]);
        const $ = cheerio.load(response.data);

        text += $(".pd-title-a").find("h3").text() + "\n\n";
        text += await clean($(".pd-text").find("p").text());
        text += "\n\n*Şair:*" + $(".pd-text").find("a").text();
        return clean(text)
    } else return null
}

async function get_poem(search_text) {
    const urls = await search(search_text);
    if (urls.length == 0) return null
    const text = await get_text(urls);
    return text
}


addCommand({ pattern: "^poem ?(.*)", access: "all", desc: "Poem search." }, async (msg, match, sock, rawMessage) => {
    const search_text = match[1];
    if (search_text) {
        const send_key = await sock.sendMessage(msg, { translate: true, text: "_⏳ Searching..._", edit: msg.key }, { quoted: rawMessage.messages[0] });
        var publicMessage = msg.key.fromMe ? msg.key : send_key.key;

        const text = await get_poem(search_text);

        if (text) await sock.sendMessage(msg, { text: text, edit: publicMessage }, { quoted: rawMessage.messages[0] });
        else await sock.sendMessage(msg, { translate: true, text: "_❌ Poem not found!_", edit: publicMessage }, { quoted: rawMessage.messages[0] });

    } else return await sock.sendMessage(msg, { translate: true, text: "_❌ Please provide a poem to search for._", edit: msg.key }, { quoted: rawMessage.messages[0] });
})