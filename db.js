import pkg from 'sqlite3';
const { Database, OPENREADWRITE } = pkg;
import { main, getInitialLoadsIds, compareLoads } from './index.js';

const dbFile = 'db.sqlite';

export const db = new Database(dbFile, OPENREADWRITE, (err) => {
    if (err) {
        console.log('Could not connect to database', err);
    } else {
        console.log('Connected to database');
    }
});

export async function insertDataToDB(userid, loadid, direction, loadDate, trasportType, fromTown, whereTown, paymentInfo, paymentDetails, cargo) {
    let q = `INSERT INTO loads (userid, loadid, direction, loadDate, trasportType, fromTown, whereTown, paymentInfo, paymentDetails, cargo) ` +
        `VALUES (${userid}, ${loadid}, "${String(direction)}", "${String(loadDate)}", "${String(trasportType)}", "${String(fromTown)}", "${String(whereTown)}", "${String(paymentInfo)}", "${String(paymentDetails)}", "${String(cargo)}")`;
    db.run(q);
}

export async function initialLoads(userid) {
    let deleteQuery = `DELETE FROM initialloads WHERE userid='${userid}'`;
    db.run(deleteQuery);
    let q = `SELECT link FROM userlinks WHERE userid='${userid}'`;
    db.all(q, [], (err, rows) => {
        if (err) return console.error(err.message);
        rows.forEach(row => {
            getInitialLoadsIds(userid, row.link);
        });
    });
}

export function insertInitialDataToDB(userid, loadid, link) { // rewrite needed
    for (let i = 0; i < loadid.length; i++) {
        let q = `INSERT INTO initialloads (userid, loadid, link) VALUES (${userid}, ${loadid[i]}, '${String(link)}')`;
        db.run(q);
    }
}

export function updateMonitoring(userid, isMonitoring) {
    let q = `UPDATE usermonitoring SET isMonitoring=${isMonitoring} WHERE userid='${userid}'`;
    db.run(q);
}

export const monitoring = function () {
    return new Promise((resolve, reject) => {
        let currentUserMonitoring = `SELECT userid FROM usermonitoring WHERE isMonitoring=1`;
        let deleteQuery = `DELETE FROM loads`;
        db.run(deleteQuery);
        console.log('Clearing database...');
        db.all(currentUserMonitoring, (err, rows) => {
            if (err) return console.error(err.message);
            rows.forEach(row => {
                let links = `SELECT * FROM userlinks WHERE userid=${row.userid}`;
                db.all(links, [], (err, rows) => {
                    if (err) return console.error(err.message);
                    rows.forEach(row => {
                        main(row.link).then(() => compareLoads()).then(result => console.log('Database is updated...')).catch(() => console.log('failed'));
                        //main(row.link);
                    });
                });
            });
        });
    });
}

