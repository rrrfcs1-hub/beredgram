const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const BOT_TOKEN =AAGYUHqXYvum71_-z0blahlSa8OibygjOlg;
const TG_API = `https://telegram.org{BOT_TOKEN}`;

const phoneToChatId = {};
const activeCodes = {};
let lastUpdateId = 0;

async function sendTelegram(chatId, text, keyboard = null) {
    const body = { chat_id: chatId, text: text, parse_mode: 'HTML' };
    if (keyboard) body.reply_markup = keyboard;
    await fetch(`${TG_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

async function pollBot() {
    try {
        const res = await fetch(`${TG_API}/getUpdates?offset=${lastUpdateId + 1}&timeout=20`);
        const data = await res.json();
        if (data.ok && data.result.length > 0) {
            for (const update of data.result) {
                lastUpdateId = update.update_id;
                const msg = update.message;
                if (!msg) continue;
                const chatId = msg.chat.id;

                if (msg.text === '/start') {
                    await sendTelegram(
                        chatId,
                        '👋 Добро пожаловать в <b>Beredgram</b>!\n\nНажмите кнопку ниже, чтобы привязать номер телефона и получать коды входа.',
                        {
                            keyboard: [[{ text: '📱 Поделиться номером телефона', request_contact: true }]],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    );
                }

                if (msg.contact) {
                    let phone = msg.contact.phone_number.replace(/\D/g, '');
                    if (phone.length === 11 && phone.startsWith('8')) phone = '7' + phone.slice(1);
                    phone = '+' + phone;

                    phoneToChatId[phone] = chatId;
                    await sendTelegram(
                        chatId,
                        `✅ Номер <b>${phone}</b> привязан!\nТеперь запрашивайте код на сайте Beredgram.`,
                        { remove_keyboard: true }
                    );
                }
            }
        }
    } catch (e) {}
    setTimeout(pollBot, 1000);
}
pollBot();

app.post('/api/send-code', async (req, res) => {
    const phone = req.body.phone;
    const chatId = phoneToChatId[phone];
    if (!chatId) {
        return res.status(404).json({
            success: false,
            error: 'Сначала откройте бота в Telegram и нажмите «Поделиться номером телефона»!'
        });
    }
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    activeCodes[phone] = code;
    await sendTelegram(chatId, `🔐 Код для входа в <b>Beredgram</b>: <code>${code}</code>`);
    res.json({ success: true });
});

app.post('/api/verify-code', (req, res) => {
    const { phone, code } = req.body;
    if (activeCodes[phone] && activeCodes[phone] === code) {
        delete activeCodes[phone];
        return res.json({ success: true });
    }
    res.status(400).json({ success: false, error: 'Неверный код из Telegram!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Beredgram запущен на порту ' + PORT));
