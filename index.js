import 'dotenv/config';
import * as puppeteer from 'puppeteer';
import { Telegraf } from 'telegraf';
import { insertDataToDB, insertInitialDataToDB, updateMonitoring, monitoring, initialLoads, db } from './db.js';
import { getMainMenu } from './botkeyboard.js';

const bot = new Telegraf(process.env.botKEY);

//Selectors
const directionSelector = '.ps_data_direction';
const loadDateSelector = '.ps_data_load_date__mobile-info > span';
const trasportTypeSelector = '.ps_data_transport__mobile > span';
const fromTownSelector = '.ps_data-from > ul > li > .ps_data_town';
const whereTownSelector = '.ps_data-where > ul > li > .ps_data_town';
const cargoSelector = '.ps_data-cargo > div'; // e.textContent instead of e.innerHTML 
const paymentInfoSelector = '.ps_data-payment > .ps_data_payment_info';
const paymentDetailsSelector = '.ps_data-payment > .ps_data_payment_details';
const dataId = '.ps_data_wrapper';

//Selectors

async function getData(page, selector) {
  let data = page.evaluate((selector) => {
    let elements = Array.from(document.querySelectorAll(selector));
    let data = elements.map((e) => {
      if (e !== null) {
        return e.innerHTML.trim();
      }
    });
    return data;
  }, selector);
  return data;
}

async function getAttributeData(page, selector) {
  let data = page.evaluate((selector) => {
    let elements = Array.from(document.querySelectorAll(selector));
    let data = elements.map((e) => {
      if (e !== null) {
        return e.getAttribute('data-ps-id').trim();
      }
    });
    return data;
  }, selector);
  return data;
}

async function getCargoData(page, selector) {
  let data = page.evaluate((selector) => {
    let elements = Array.from(document.querySelectorAll(selector));
    let data = elements.map((e) => {
      if (e !== null) {
        return e.textContent.trim().replace(/\r?\n/g, " ");
      }
    });
    return data;
  }, selector);
  return data;
}

function clearLoadDate(data) {
  for (let i = 0; i < data.length; i++) {
    data[i] = data[i].replace(/&nbsp;/g, "").replace(/\r?\n/g, "");
  }
  return data;
}

export async function main(url, tablename, userid) {
  try {
    const browser = await puppeteer.launch();
    const [page] = await browser.pages();
    let data = [];
    await page.goto(url, { waitUntil: 'networkidle2' });

    const direction = await getData(page, directionSelector);
    let loadDate = await getData(page, loadDateSelector);
    loadDate = clearLoadDate(loadDate);
    const trasportType = await getData(page, trasportTypeSelector);
    const fromTown = await getData(page, fromTownSelector);
    const whereTown = await getData(page, whereTownSelector);
    const paymentInfo = await getData(page, paymentInfoSelector);
    const paymentDetails = await getData(page, paymentDetailsSelector);
    const cargo = await getCargoData(page, cargoSelector);
    const loadid = await getAttributeData(page, dataId);

    for (let i = 0; i < loadid.length; i++) {
      let obj = {
        'tablename': tablename,
        'userid': userid,
        'loadid': loadid[i],
        'direction': direction[i],
        'loadDate': loadDate[i],
        'trasportType': trasportType[i],
        'fromTown': fromTown[i],
        'whereTown': whereTown[i],
        'paymentInfo': paymentInfo[i],
        'paymentDetails': paymentDetails[i],
        'cargo': cargo[i],
      };

      data.push(obj);
      //insertDataToDB(tablename, userid, loadid[i], direction[i], loadDate[i], trasportType[i], fromTown[i], whereTown[i], paymentInfo[i], paymentDetails[i], cargo[i]);
      //console.log("id: " + loadid[i] + " dir: " + direction[i] + " loadDate: " + loadDate[i] + " from town: " + fromTown[i] + " to town: " + whereTown[i] + " trasport type: " + trasportType[i] + " cargo: " + cargo[i] + " payment: " + paymentInfo[i] + " " + paymentDetails[i]);
    }

    await browser.close();

    return data;

  } catch (err) {
    console.error(err);
  }
};


export async function getInitialLoadsIds(userid, url) {
  try {
    const browser = await puppeteer.launch();
    const [page] = await browser.pages();

    await page.goto(url, { waitUntil: 'networkidle2' });

    const loadid = await getAttributeData(page, dataId);
    insertInitialDataToDB(userid, loadid, url);
    await browser.close();

  } catch (err) {
    console.error(err);
  }
};

//export function compareLoads() {
// let loads = `SELECT * FROM loads EXCEPT SELECT * FROM initialloads`;
// db.all(loads, [], (err, rows) => {

//   if (err) return console.error(err.message);

//   rows.forEach(row => {
//     bot.telegram.sendMessage(row.userid, '' + row.fromTown + "-" + row.whereTown);
//   });
// });

export const compareLoads = (command, method = 'all') => {
  return new Promise((resolve, reject) => {
    db[method](command, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};
//}

async function get() {
  let loads = `SELECT * FROM loads EXCEPT SELECT * FROM initialloads`;
  await monitoring('loads');
  let data = await compareLoads(loads);
  console.log(data);
  bot.telegram.sendMessage(478243252, data[0].fromTown + "-" + data[0].whereTown);
  return data;
}

bot.start(ctx => {
  ctx.reply('Привет. Стартовый запуск', getMainMenu());
});

bot.hears('Начать мониторинг', (ctx) => {
  updateMonitoring(ctx.chat.id, 1);
  get();
  ctx.reply('Мониторинг начат');
});

bot.hears('Остановить мониторинг', (ctx) => {
  updateMonitoring(ctx.chat.id, 0);
  ctx.reply('Мониторинг остановлен')
});

bot.on('text', (ctx) => ctx.reply('Неизвестная команда'));
bot.launch();

//setInterval(() => monitoring('loads').then((res) => compareLoads()), 60000);

setInterval(() => monitoring('loads'), 10000);
