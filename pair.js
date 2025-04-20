import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser } from '@whiskeysockets/baileys';
import { upload } from './mega.js';

const router = express.Router();

// Ensure the session directory exists
function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error('Error removing file:', e);
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    let dirs = './' + (num || `session`);
    
    // Remove existing session if present
    await removeFile(dirs);
    
    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            let MalvinTechInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "20.0.04"],
            });

            if (!MalvinTechInc.authState.creds.registered) {
                await delay(2000);
                num = num.replace(/[^0-9]/g, '');
                const code = await MalvinTechInc.requestPairingCode(num);
                if (!res.headersSent) {
                    console.log({ num, code });
                    await res.send({ code });
                }
            }

            MalvinTechInc.ev.on('creds.update', saveCreds);
            MalvinTechInc.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    await delay(10000);
                    const sessionGlobal = fs.readFileSync(dirs + '/creds.json');

                    // Helper to generate a random Mega file ID
                    function generateRandomId(length = 6, numberLength = 4) {
                        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                        let result = '';
                        for (let i = 0; i < length; i++) {
                            result += characters.charAt(Math.floor(Math.random() * characters.length));
                        }
                        const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                        return `${result}${number}`;
                    }

                    // Upload session file to Mega
                    const megaUrl = await upload(fs.createReadStream(`${dirs}/creds.json`), `${generateRandomId()}.json`);
                    let stringSession = megaUrl.replace('https://mega.nz/file/', ''); // Extract session ID from URL
                    stringSession = 'MALVIN-XMD~' + stringSession;  // Prepend your name to the session ID

                    // Send the session ID to the target number
                    const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                    await MalvinTechInc.sendMessage(userJid, { text: stringSession });

                    // Send confirmation message
                    await MalvinTechInc.sendMessage(userJid, { text: `Hey there, 𝐒𝐡𝐞𝐥𝐥𝐚𝐡 User!* 👋🏻

Thanks for using *𝐬𝐡𝐞𝐥𝐥𝐚𝐡 𝐬𝐞𝐬𝐬𝐢𝐨𝐧* — your session has been successfully created!

🔐 *Session ID:* Sent above  
⚠️ *Keep it safe!* Do NOT share this ID with anyone.

——————

*❧Oᴡᴇʀ Oғ Tʜᴇ Gʀᴜᴘ✿➳↡↡*

`🐦-----Mʀ Sʜᴇʟʟᴀʜ Oғᴄ-----🐦`

*❧Oᴡɴᴇʀ Nᴜᴍʙᴇʀ✿➳↡↡*

----------+263771341158---------

*☆☆🌹Wᴏʀᴛʜʏ ғᴏʟʟᴏᴡɪɴɢ🌹☆☆*
1.           *YᴏᴜTᴜʙᴇ Aᴄᴄ*
                        `Hᴇʀᴇ` 

https://www.youtube.com/@Sh3llahCyber 

2.           *TɪᴋTᴏᴋ Aᴄᴄ*
                      `Hᴇʀᴇ` 

https://www.tiktok.com/@sh3llahcyber7 

3.          *Iɴsᴛᴀɢʀᴀᴍ Aᴄᴄ*
                        `Hᴇʀᴇ`
https://www.instagram.com/sh3llahcyber 

*🥀❧Cʜᴀɴɴᴇʟ✿➳↡↡🥀*

https://whatsapp.com/channel/0029Vb5SP7IDjiOfSjLKlB2Y 

🥀❧Gʀᴏᴜᴘ✿➳↡↡🥀

https://chat.whatsapp.com/HEcYRhVMKFI0392aP02ocB 

🥀❧Tᴇʟᴇɢʀᴀᴍ✿➳↡↡🥀

https://t.me/ZimCyber

`🌹Aʟʟ Rɪɢʜᴛs Rᴇsᴇʀᴠᴇᴅ Bʏ  Mʀ Sʜᴇʟʟᴀʜ🌹`
      ~Pʟᴇᴀsᴇ. Bʏ Mᴇ ᴄᴏғғᴇᴇ🐦~
——————

*© Powered by 𝐬𝐡𝐞𝐥𝐥𝐚𝐡*
Stay cool and hack smart. ✌🏻` });

                    // Clean up session after use
                    await delay(100);
                    removeFile(dirs);
                    process.exit(0);
                } else if (connection === 'close' && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    console.log('Connection closed unexpectedly:', lastDisconnect.error);
                    await delay(10000);
                    initiateSession(); // Retry session initiation if needed
                }
            });
        } catch (err) {
            console.error('Error initializing session:', err);
            if (!res.headersSent) {
                res.status(503).send({ code: 'Service Unavailable' });
            }
        }
    }

    await initiateSession();
});

// Global uncaught exception handler
process.on('uncaughtException', (err) => {
    console.log('Caught exception: ' + err);
});

export default router;
