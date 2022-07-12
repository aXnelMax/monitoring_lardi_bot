import 'dotenv/config';
import * as puppeteer from 'puppeteer';
import { Telegraf } from 'telegraf';
import { insertDataToDB, updateMonitoring, db } from './db.js';
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

export async function parseLinks(url, tablename, userid) {
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
    }

    await browser.close();

    return data;

  } catch (err) {
    console.error(err);
  }
};


export const query = (command, method = 'all') => {
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

async function monitoring() {
  const tablename = `loads`;
  const clearDBQuery = `DELETE FROM loads`;
  const queryUsers = `SELECT * FROM usermonitoring WHERE isMonitoring=1`;

  db.run(clearDBQuery);

  let users = await query(queryUsers);
  for (let i = 0; i < users.length; i++) {
    const queryLinks = `SELECT * FROM userlinks WHERE userid=${users[i].userid}`;
    let links = await query(queryLinks);
    for (let j = 0; j < links.length; j++) {
      let data = await parseLinks(links[j].link, tablename, users[i].userid);
      for (let k = 0; k < data.length; k++) {
        insertDataToDB(tablename, data[k].userid, data[k].loadid, data[k].direction, data[k].loadDate, data[k].trasportType, data[k].fromTown, data[k].whereTown, data[k].paymentInfo, data[k].paymentDetails, data[k].cargo);
      }
    }
  }

  let diffLoads = await compareLoads();
  for (let i = 0; i < diffLoads.length; i++) {
    setTimeout(() => bot.telegram.sendMessage(diffLoads[i].userid, diffLoads[i].loadid + " " + diffLoads[i].direction + " " + diffLoads[i].loadDate + " " + diffLoads[i].trasportType + " " + diffLoads[i].fromTown + "-" + diffLoads[i].whereTown + " " + diffLoads[i].paymentInfo + " " + diffLoads[i].paymentDetails + " " + diffLoads[i].cargo), 3050);
  }
  
}

async function compareLoads() {
  const compareQuery = `SELECT * FROM loads EXCEPT SELECT * FROM initialloads`;
  let data = await query(compareQuery);
  return data;
}

async function getInitalLoads(userid) {
  const initialQuery = `SELECT link FROM userlinks WHERE userid='${userid}'`;
  const tablename = 'initialloads';
  let links = await query(initialQuery);

  for (let i = 0; i < links.length; i++) {
    let data = await parseLinks(links[i].link, tablename, userid);
    for (let j = 0; j < data.length; j++) {
      insertDataToDB(tablename, userid, data[j].loadid, data[j].direction, data[j].loadDate, data[j].trasportType, data[j].fromTown, data[j].whereTown, data[j].paymentInfo, data[j].paymentDetails, data[j].cargo);
    }
  }
}

bot.start(ctx => {
  ctx.reply('Привет. Стартовый запуск', getMainMenu());
});

bot.hears('Начать мониторинг', (ctx) => {
  updateMonitoring(ctx.chat.id, 1);
  getInitalLoads(ctx.chat.id);
  ctx.reply('Мониторинг начат');
});

bot.hears('Остановить мониторинг', (ctx) => {
  updateMonitoring(ctx.chat.id, 0);
  ctx.reply('Мониторинг остановлен')
});

bot.on('text', (ctx) => ctx.reply('Неизвестная команда'));
bot.launch();

monitoring();