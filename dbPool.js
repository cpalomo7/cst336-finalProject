const mysql = require('mysql');

const pool = mysql.createPool({
    connectionLimit: 10,
    host: "e11wl4mksauxgu1w.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "ulntjmg4s0ls8gih",
    password: "i2s2r0s41hkgixiq",
    database: "rz4jr3j5uk6xfi7e"
});

module.exports = pool;