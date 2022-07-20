import Telegraf from 'telegraf';

const { Markup } = Telegraf;

export function getMainMenu() {
    return Markup.keyboard([
        ['Начать мониторинг', 'Остановить мониторинг'],
        ['Удалить направления']
    ]).resize();
}

export function keyboardConfirm() {
    return Markup.inlineKeyboard([
        Markup.button.callback('Удалить', 'delete'),
    ]);
}

export function adminMenu() {
    return Markup.keyboard([
        ['Список пользователей', 'Удалить пользователя']
    ]).resize();
}