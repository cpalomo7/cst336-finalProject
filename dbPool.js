const mysql = require('mysql');

const pool = mysql.createPool({
    connectionLimit: 10,
    host: "qzkp8ry756433yd4.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "v7pczzk0eqtrq7zl",
    password: "sa2fs8g9gxfdpvnx",
    database: "ofnnwyo6iqci6okx"
});

module.exports = pool;