import 'dotenv/config';
import * as puppeteer from 'puppeteer';
import { Telegraf } from 'telegraf';
import { insertDataToDB, updateMonitoring, db } from './db.js';
import { getMainMenu, keyboardConfirm } from './botkeyboard.js';

const bot = new Telegraf(process.env.botKEY);

let cookies = {};

//Selectors
const directionSelector = '.ps_data_direction';
const loadDateSelector = '.ps_data_load_date__mobile-info > span';
const trasportTypeSelector = '.ps_data_transport__mobile > span';
const fromTownSelector = '.ps_data-from > ul';
const whereTownSelector = '.ps_data-where > ul';
const cargoSelector = '.ps_data-cargo > div'; // e.textContent instead of e.innerHTML 
const paymentInfoSelector = '.ps_data-payment > .ps_data_payment_info';
const paymentDetailsSelector = '.ps_data-payment > .ps_data_payment_details';
const dataId = '.ps_data_wrapper';
const contactsSelector = '.ps_search-result_data-contacts > .ps_data_contacts > .ps_proposal_user';
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
        return e.textContent.trim().replace(/\r?\n/g, " ").replace(/\"/g, " ");
      }
    });
    return data;
  }, selector);
  return data;
}

async function getNewLoads(page, loadid) {
  let data = page.evaluate((loadid) => {
    return document.querySelector(`div[data-ps-id="${loadid}"] > .ps_data_wrapper > .ps_data > div > .ps_direction_statuses > .ps_data_statuses > .ps_data_status__new`);
  }, loadid);
  return data;
}

function clearLoadDate(data) {
  for (let i = 0; i < data.length; i++) {
    data[i] = data[i].replace(/&nbsp;/g, "").replace(/\r?\n/g, "");
  }
  return data;
}

function clearContactsData(data) {
  for (let i = 0; i < data.length; i++) {
    data[i] = data[i].replace(/\s\s+/g, ' ').replace(/Паспорт надежности/g, '').replace(/Положительные отзывы \d+/g, '').replace(/Отрицательные отзывы \d+/g, '').replace(/\s\s+/g, ' ').replace(/"/g, "");
    let phones = data[i].match(/\+380 \(\d+\) \d+-\d+-\d+/g);
    if (phones) {
      for (let j = 0; j < phones.length; j++) {
        phones[j] = phones[j].replace(/ /g, "").replace(/\-/g, "").replace(/\(/g, "").replace(/\)/g, "");
        data[i] = data[i].replace(/\+380 \(\d+\) \d+-\d+-\d+/g, "");
        data[i] = data[i] + " " + phones[j];
      }
    }

  }
  return data;
}

async function getCookies() {
  try {
    const browser = await puppeteer.launch();
    const [page] = await browser.pages();
    await page.goto('https://lardi-trans.com/ru/accounts/login/');
    await page.waitForSelector('input[autocomplete="new-password"]');
    await page.focus('input[autocomplete="new-password"]');
    await page.keyboard.type(process.env.login);
    await page.focus('input[autocomplete="on"]');
    await page.keyboard.type(process.env.password);
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 5000));
    await page.goto('https://lardi-trans.com/');
    cookies = await page.cookies();
    await browser.close();

    return cookies;

  } catch (err) {
    console.error(err);
  }
}
export async function parseLinks(url, tablename, userid) {
  try {
    let data = [];

    const browser = await puppeteer.launch();
    const [page] = await browser.pages();

    for (let key in cookies) {
      await page.setCookie(cookies[key]);
    }

    await page.goto(url, { waitUntil: 'networkidle2' });

    const direction = await getData(page, directionSelector);
    let loadDate = await getData(page, loadDateSelector);
    loadDate = clearLoadDate(loadDate);
    const trasportType = await getData(page, trasportTypeSelector);
    const fromTown = await getCargoData(page, fromTownSelector);
    const whereTown = await getCargoData(page, whereTownSelector);
    const paymentInfo = await getData(page, paymentInfoSelector);
    const paymentDetails = await getData(page, paymentDetailsSelector);
    const cargo = await getCargoData(page, cargoSelector);
    const loadid = await getAttributeData(page, dataId);
    let contacts = await getCargoData(page, contactsSelector);
    contacts = clearContactsData(contacts);
    let isNew = [];

    for (let i = 0; i < loadid.length; i++) {
      let isItNew = await getNewLoads(page, loadid[i]);
      if (isItNew == null) {
        isNew[i] = 0;
      } else {
        isNew[i] = 1;
      }
    }

    for (let i = 0; i < loadid.length; i++) {

      let linkType = url.match(/\/gruz\//g);
      let directLink = '';

      if (linkType == '/gruz/') {
        directLink = 'https://lardi-trans.com/gruz/view/' + loadid[i];
      } else {
        directLink = 'https://lardi-trans.com/trans/view/' + loadid[i];
      }

      let obj = {
        'tablename': tablename,
        'userid': userid,
        'loadid': loadid[i],
        'directLink': directLink,
        'direction': direction[i],
        'loadDate': loadDate[i],
        'trasportType': trasportType[i],
        'fromTown': fromTown[i],
        'whereTown': whereTown[i],
        'paymentInfo': paymentInfo[i],
        'paymentDetails': paymentDetails[i],
        'cargo': cargo[i],
        'contacts': contacts[i],
        'isNew': isNew[i],
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
      if (data) {
        for (let k = 0; k < data.length; k++) {
          insertDataToDB(tablename, data[k].userid, data[k].loadid, data[k].directLink, data[k].direction, data[k].loadDate, data[k].trasportType, data[k].fromTown, data[k].whereTown, data[k].paymentInfo, data[k].paymentDetails, data[k].cargo, data[k].contacts, data[k].isNew);
        }
      }
    }
  }

  let diffLoads = await compareLoads();
  for (let i = 0; i < diffLoads.length; i++) {
    if (diffLoads[i].isNew == 1) {

      let linkType = diffLoads[i].directLink.match(/\/gruz\//g);
      let reqType = '';

      if (linkType == "/gruz/") {
        reqType = "ГРУЗ";
      } else {
        reqType = "ТРАНСПОРТ";
      }

      setTimeout(() => bot.telegram.sendMessage(diffLoads[i].userid, reqType + " " + "<a href=\"" + diffLoads[i].directLink + "\">Cсылка на Lardi</a>" + "\n" + diffLoads[i].direction + "\n" + diffLoads[i].fromTown + " - " + diffLoads[i].whereTown + "\n" + "Дата загрузки: " + diffLoads[i].loadDate + "\n" + diffLoads[i].trasportType + " " + diffLoads[i].cargo + "\n" + diffLoads[i].paymentInfo + " " + diffLoads[i].paymentDetails + "\n" + diffLoads[i].contacts, { parse_mode: 'HTML', disable_web_page_preview: true }), 3050);
    }
  }

  copyLoadsToInitialloads();

}

async function compareLoads() {
  const compareQuery = `SELECT * FROM loads EXCEPT SELECT * FROM initialloads`;
  let data = await query(compareQuery);
  return data;
}

async function getInitalLoads(userid) {
  const tablename = 'initialloads';

  const clearQuery = `DELETE FROM initialloads WHERE userid='${userid}'`;
  db.run(clearQuery);

  const initialQuery = `SELECT link FROM userlinks WHERE userid='${userid}'`;
 
  let links = await query(initialQuery);

  for (let i = 0; i < links.length; i++) {
    let data = await parseLinks(links[i].link, tablename, userid);
    if (data) {
      for (let j = 0; j < data.length; j++) {
        insertDataToDB(tablename, userid, data[j].loadid, data[j].directLink, data[j].direction, data[j].loadDate, data[j].trasportType, data[j].fromTown, data[j].whereTown, data[j].paymentInfo, data[j].paymentDetails, data[j].cargo, data[j].contacts, data[j].isNew);
      }
    }
  }
}

function copyLoadsToInitialloads() {
  db.serialize(() => {
    db.run(`DELETE FROM initialloads`);
    db.run(`INSERT INTO initialloads SELECT * FROM loads`);
});
}

async function timeToGetCookies() {
  let date = new Date();

  if (date.getHours() > 6 &&  date.getHours() < 18 && date.getMinutes() == 0) {
    cookies = await getCookies();
    console.log('Cookies was updated. Current time is: ' + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds() + " " + date.getDate() + "/" + (date.getMonth() + 1) + "/" + date.getFullYear());
  }
}

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
}
);


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

bot.launch();

setInterval(monitoring, 100000);
setInterval(timeToGetCookies, 35000);
cookies = await getCookies();