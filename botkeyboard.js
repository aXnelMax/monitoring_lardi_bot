import Telegraf from 'telegraf';

const { Markup } = Telegraf;

export function getMainMenu() {
    return Markup.keyboard([
        ['Начать мониторинг', 'Остановить мониторинг'],
        ['Удалить направления']
    ]).resize();
}