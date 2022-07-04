import pkg from 'sqlite3';
const { Database, OPENREADWRITE } = pkg;
import { main } from './index.js';

const dbFile = 'db.sqlite';

const db = new Database(dbFile, OPENREADWRITE, (err) => {
    if (err) {
        console.log('Could not connect to database', err);
    } else {
        console.log('Connected to database');
    }
});

export function insertDataToDB(userid, loadid, direction, loadDate, trasportType, fromTown, whereTown, paymentInfo, paymentDetails, cargo) {
    let q = `INSERT INTO loads (userid, loadid, direction, loadDate, trasportType, fromTown, whereTown, paymentInfo, paymentDetails, cargo) ` +
        `VALUES (${userid}, ${loadid}, '${String(direction)}', '${String(loadDate)}', '${String(trasportType)}', '${String(fromTown)}', '${String(whereTown)}', '${String(paymentInfo)}', '${String(paymentDetails)}', '${String(cargo)}')`;
    db.run(q);
}

export function initialPrepareDB(userid, loadid, link) {
    let deleteQuery = `DELETE FROM currentloads`;
    db.run(deleteQuery);
    for (let i = 0; i < loadid.length; i++) {
        let q = `INSERT INTO currentloads (userid, loadid, link) VALUES (${userid}, ${loadid[i]}, '${String(link)}')`;
        db.run(q);
    }
}

export function updateMonitoring(userid, isMonitoring) {
    let q = `UPDATE usermonitoring SET isMonitoring=${isMonitoring} WHERE userid='${userid}'`;
    db.run(q);
}

export function getUrls(userid) {
    let q = `SELECT link FROM userlinks WHERE userid='${userid}'`;
    let urls = [];
    db.each(q, (err, row) => {  
        if (err) return console.error(err.message);
         //callback(?);
    });
    return urls;
}

export function monitoring() {
    let currentUserMonitoring = `SELECT userid FROM usermonitoring WHERE isMonitoring=1`;
    db.all(currentUserMonitoring, (err, rows) => {
        if (err) return console.error(err.message);
        rows.forEach(row => {
            let links = `SELECT link FROM userlinks WHERE userid=${row.userid}`;
            db.all(links, (err, rows) => {
                if (err) return console.error(err.message);
                rows.forEach(row => {
                    main(row.link);
                });
            });
        });
    });
  }