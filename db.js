import pkg from 'sqlite3';
const { Database, OPENREADWRITE } = pkg;

const dbFile = 'db.sqlite';

export const db = new Database(dbFile, OPENREADWRITE, (err) => {
    if (err) {
        console.log('Could not connect to database', err);
    } else {
        console.log('Connected to database');
    }
});

export async function insertDataToDB(tablename, userid, loadid, userlink, directLink, direction, loadDate, trasportType, fromTown, whereTown, paymentInfo, paymentDetails, cargo, contacts, isNew) {
    let q = `INSERT INTO ${tablename} (userid, loadid, userlink, directLink, direction, loadDate, trasportType, fromTown, whereTown, paymentInfo, paymentDetails, cargo, contacts, isNew) ` +
        `VALUES (${userid}, ${loadid}, "${userlink}", "${directLink}", "${String(direction)}", "${String(loadDate)}", "${String(trasportType)}", "${String(fromTown)}", "${String(whereTown)}", "${String(paymentInfo)}", "${String(paymentDetails)}", "${String(cargo)}", "${String(contacts)}", ${isNew})`;
    db.run(q);
}

export function updateMonitoring(userid, isMonitoring) {
    let q = `UPDATE usermonitoring SET isMonitoring=${isMonitoring} WHERE userid='${userid}'`;
    db.run(q);
}
