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

export function insertDataToDB(tablename, userid, loadid, direction, loadDate, trasportType, fromTown, whereTown, paymentInfo, paymentDetails, cargo) {

    let q = `INSERT INTO ${tablename} (userid, loadid, direction, loadDate, trasportType, fromTown, whereTown, paymentInfo, paymentDetails, cargo) ` +
        `VALUES (${userid}, ${loadid}, "${String(direction)}", "${String(loadDate)}", "${String(trasportType)}", "${String(fromTown)}", "${String(whereTown)}", "${String(paymentInfo)}", "${String(paymentDetails)}", "${String(cargo)}")`;
    db.run(q);
    resolve('Data inserted...');

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

export function monitoring(tablename) {
    return new Promise(() => {
        clearingLoadsTable(tablename);

        let currentUserMonitoring = `SELECT userid FROM usermonitoring WHERE isMonitoring=1`;

        db.all(currentUserMonitoring, (err, rows) => {
            if (err) return console.error(err.message);
            rows.forEach(row => {
                let links = `SELECT * FROM userlinks WHERE userid=${row.userid}`;
                db.all(links, [], (err, rows) => {
                    if (err) return console.error(err.message);
                    rows.forEach(row => {
                        //main( row.link).then(() => compareLoads()).then(result => console.log('Database is updated...')).catch(() => console.log('failed'));
                        main(row.link, tablename, row.userid);
                    });
                });
            });
        });
    });
}

function clearingLoadsTable(tablename) {
    let query = `DELETE FROM ${tablename}`;
    db.run(query);
    console.log('Clearing database...');
}