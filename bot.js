import { updateMonitoring, db } from './db.js';
import { getMainMenu, keyboardConfirm } from './botkeyboard.js';
import { getInitalLoads } from './index.js';
import { Telegraf } from 'telegraf';

export const bot = new Telegraf(process.env.botKEY);

bot.start(ctx => {
    ctx.reply('Привет. Стартовый запуск', getMainMenu());
});

bot.hears('Начать мониторинг', (ctx) => {
    updateMonitoring(ctx.chat.id, 1);
    getInitalLoads(ctx.chat.id);
    ctx.reply('Мониторинг начат', getMainMenu());
});

bot.hears('Остановить мониторинг', (ctx) => {
    updateMonitoring(ctx.chat.id, 0);
    ctx.reply('Мониторинг остановлен', getMainMenu());
});

bot.hears('Удалить направления', ctx => {
    let sqlstr = `SELECT * FROM userlinks WHERE userid=${ctx.chat.id}`;

    db.all(sqlstr, [], (err, rows) => {
        if (err) return console.error(err.message);
        rows.forEach(row => {
            ctx.reply(row.link, keyboardConfirm());
        });
    });
});

bot.action('delete', ctx => {
    const deleteLinkQuery = `DELETE FROM userlinks WHERE userid=${ctx.chat.id} AND link='${ctx.callbackQuery.message.text}'`;
    db.run(deleteLinkQuery);
    ctx.editMessageText('Направление удалено');
});

bot.hears(/https?:\/\/lardi-trans\.[cru][oua]m?\/gruz\/\S+/g, (ctx) => {
    let addQuery = `INSERT INTO userlinks (userid, link) VALUES (${ctx.chat.id}, '${ctx.message.text}')`;
    db.run(addQuery);
    ctx.reply('Ссылка добавлена', getMainMenu());
});

bot.hears(/https?:\/\/lardi-trans\.[cru][oua]m?\/trans\/\S+/g, (ctx) => {
    let addQuery = `INSERT INTO userlinks (userid, link) VALUES (${ctx.chat.id}, '${ctx.message.text}')`;
    db.run(addQuery);
    ctx.reply('Ссылка добавлена', getMainMenu());
});

bot.on('text', (ctx) => ctx.reply('Не могу распознать ссылку', getMainMenu()));