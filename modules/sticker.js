const fs = require('fs');
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { Image } = require('node-webpmux');
const stream = require("stream");
const path = require('path');
const os = require('os');
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const sharp = require('sharp');
ffmpeg.setFfmpegPath(ffmpegPath);

const downloadBuffer = async (message, type) => {
    let chunks = [];
    const stream = await downloadContentFromMessage(message, type);

    for await (const chunk of stream) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
};

const get_metadata = async (buffer) => {
    let meta = await sharp(buffer).metadata();
    return meta;
};

const get_one_frame = async (buffer, index) => {
    const frame = await sharp(buffer, { page: index })
        .flatten({ background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .png()
        .toBuffer();
    return frame;
}

const get_frames_spliced = async (buffer, meta) => {
    let promises_frame = []
    for (let i = 0; i < meta.pages; i++) {
        promises_frame.push(get_one_frame(buffer, i))
    }
    const frames = await Promise.all(promises_frame);
    return frames;
}

const no_animated_webp_to_png = async (buffer) => {
    const png = await sharp(buffer, { page: 0 })
        .flatten({ background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .png()
        .toBuffer();
    return png;
}

const image_to_webp = async (imageBuffer, save_path) => {
    return new Promise((resolve, reject) => {
        const input = new stream.PassThrough();
        input.end(imageBuffer);
        ffmpeg(input)
            .inputFormat("image2pipe")
            .videoFilters(
                "scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease," +
                "format=rgba," +
                "pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000," +
                "setsar=1"
            )
            .outputOptions([
                "-vcodec", "libwebp",
                "-lossless", "1",
                "-preset", "picture"
            ])
            .format("webp")
            .on("stderr", () => { })
            .on("error", reject)
            .on("end", () => resolve())
            .save(save_path)
    })
};

const video_to_webp = async (videoBuffer, save_path) => {
    return new Promise((resolve, reject) => {
        const input = new stream.PassThrough();
        input.end(videoBuffer);

        ffmpeg(input)
            .inputFormat("mp4")
            .videoFilters(
                "scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease," +
                "format=rgba," +
                "pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000," +
                "setsar=1"
            )
            .outputOptions([
                "-vcodec", "libwebp",
                "-lossless", "1",
                "-preset", "picture",
                "-loop", "0",
                "-an",
                "-vsync", "0",
                "-q:v", "80",
                "-f", "webp"
            ])
            .format("webp")
            .on("error", reject)
            .on("end", resolve)
            .save(save_path);
    });
};

const get_fps_from_meta = async (meta) => {
    let fps
    if (meta.delay && meta.delay.length > 0) {
        const avgDelay = meta.delay.reduce((a, b) => a + b, 0) / meta.delay.length;
        fps = 1000 / avgDelay;
    }
    return fps || 1

}

const frames_to_mp4 = async (webpBuffer_chunks, save_dir, fps) => {
    return new Promise((resolve, reject) => {
        const save_path = path.join(save_dir, `temp_${Date.now()}_${Math.floor(Math.random() * 10)}.mp4`);
        console.log("save path", save_path)

        const input = new stream.PassThrough();
        const chunks = [];

        const cmd = ffmpeg(input)
            .inputFormat("image2pipe")
            .inputOptions(["-framerate", String(fps)])
            .videoCodec("libx264")
            .outputOptions(["-pix_fmt", "yuv420p", "-movflags", "faststart"])
            .format("mp4")
            .on("error", reject)
            .on("end", () => resolve(save_path))
            .save(save_path)

        cmd.on("data", d => chunks.push(d));

        (async () => {
            for (const frame of webpBuffer_chunks) input.write(frame);
            input.end();
        })();
    });
}

const addMetadataFromBuffer = async (webpBuffer) => {
    const metadata = {
        "sticker-pack-id": "1",
        "sticker-pack-name": "NexusProto Stickers",
        "sticker-pack-publisher": "Proto",
        "android-app-store-link": "https://phaticusthiccy.github.io/PrimonMarket",
        "ios-app-store-link": "https://phaticusthiccy.github.io/PrimonMarket"
    };
    const json = JSON.stringify(metadata);

    const header = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);

    // exif uzunluk kaydı
    const exif = Buffer.concat([header, Buffer.from(json, "utf-8")]);
    exif.writeUIntLE(Buffer.byteLength(json), 14, 4);

    const img = new Image();
    await img.load(webpBuffer);

    img.exif = exif;
    return await img.save(null);
}


const handle_image_message = async (msg, m, sock, rawMessage, quoted, publicMessage) => {
    try {
        const tmpPath = path.join(os.tmpdir(), `temp_${Date.now()}_${Math.floor(Math.random() * 10)}.webp`);

        const media = await downloadBuffer(quoted, "image");
        await image_to_webp(media, tmpPath);
        const webpBuffer = fs.readFileSync(tmpPath);
        const finaly_buffer = await addMetadataFromBuffer(webpBuffer);
        await sock.sendMessage(msg, { delete: publicMessage, sticker: finaly_buffer }, { quotedMessage: quoted });
        fs.unlinkSync(tmpPath);
        return
    } catch (e) {
        console.log("error", e)
        return await sock.sendMessage(msg, { translate: true, text: "_❌ An error occurred while downloading the media._" /*+ e*/, edit: publicMessage }, { quoted: rawMessage.messages[0] });
    }
};

const handle_video_message = async (msg, m, sock, rawMessage, quoted, publicMessage) => {
    const tmpPath = path.join(os.tmpdir(), `video2webp_${Date.now()}`);

    try {
        const media = await downloadBuffer(quoted, "video");
        await video_to_webp(media, tmpPath);
        let webpBuffer = await fs.readFileSync(tmpPath);
        const finaly_buffer = await addMetadataFromBuffer(webpBuffer);
        await sock.sendMessage(msg, { delete: publicMessage, sticker: finaly_buffer }, { quotedMessage: quoted });
    } catch (e) {
        console.log("error", e)
        return await sock.sendMessage(msg, { translate: true, text: "_❌ An error occurred while downloading the media._" /*+ e*/, edit: publicMessage }, { quoted: rawMessage.messages[0] });
    }
    fs.unlinkSync(tmpPath);
};

const handle_sticker_message = async (msg, m, sock, rawMessage, quoted, publicMessage) => {
    try {
        // console.log(msg)
        const tmpPath = path.join(os.tmpdir(), `temp_${Date.now()}_${Math.floor(Math.random() * 10)}`);
        if (!fs.existsSync(tmpPath)) {
            fs.mkdirSync(tmpPath);
        }
        const media = await downloadBuffer(quoted, "sticker");

        const meta = await get_metadata(media);
        if (!quoted?.isAnimated) {
            const image = await no_animated_webp_to_png(media);
            await sock.sendMessage(msg, { delete: publicMessage, image }, { quotedMessage: quoted });
            return
        } else {
            const frames = await get_frames_spliced(media, meta);
            const fps = await get_fps_from_meta(meta);
            const save_path = await frames_to_mp4(frames, tmpPath, fps);

            await sock.sendMessage(msg, { delete: publicMessage, video: { url: save_path } }, { quotedMessage: quoted });
            fs.rmSync(tmpPath, { recursive: true, force: true });
            return
        }
    } catch (e) {
        console.log("error", e)
        return await sock.sendMessage(msg, { translate: true, text: "_❌ An error occurred while downloading the media._" /*+ e*/, edit: publicMessage }, { quoted: rawMessage.messages[0] });
    }
}

addCommand({ pattern: '^sticker$|^vsticker$', access: 'all', desc: 'Make sticker from image or video' }, async (msg, match, sock, rawMessage) => {
    const quoted = msg?.quotedMessage
    const quoted_media = quoted ? Object.values(quoted)[0] : null;
    const mimetype = quoted_media?.mimetype
    if (!quoted || quoted_media?.viewOnce || quoted?.viewOnceMessageV2 || quoted?.viewOnceMessageV2Extension)
        return await sock.sendMessage(msg, { translate: true, text: "_Please reply to an image or video!_", edit: msg.key }, { quoted: rawMessage.messages[0] });

    const send_key = await sock.sendMessage(msg, { translate: true, text: "_⏳ Converting.._", edit: msg.key }, { quoted: rawMessage.messages[0] });
    var publicMessage = msg.key.fromMe ? msg.key : send_key.key;
    switch (mimetype) {
        case 'video/mp4':
            return await handle_video_message(msg, match, sock, rawMessage, quoted_media, publicMessage);
        case 'image/jpeg':
        case 'image/png':
            return await handle_image_message(msg, match, sock, rawMessage, quoted_media, publicMessage);
        case 'image/webp':
            return await handle_sticker_message(msg, match, sock, rawMessage, quoted_media, publicMessage);
        default:
            return await sock.sendMessage(msg, { translate: true, text: "_❌ Please reply to an image or video!_", edit: msg.key }, { quoted: rawMessage.messages[0] });
    }
})