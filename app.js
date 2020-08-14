const express = require("express");
const app = express();
const request = require("request"); // Import request package
const conn = require("./dbPool.js"); // Import the DB File
const session = require("express-session");
const bcrypt = require("bcrypt");

app.set("view engine", "ejs");
app.use(express.static("public")); // Use public folder for all static files
app.use(express.urlencoded({extended:true})); // Middleware to be able to parse POST parameters

// Set required parameters to use sessions
app.use(session({
    secret: "top secret!",
    resave: true,
    saveUninitialized: true
}));

// Global objects
let productObject; // Object that stores the values from the Walmart API
let cartObj = []; // Object that stores the items in the user cart
let overviewData = []; // Object that will be passed to adminPortal
let total = 0;

// Landing Page Route
app.get("/", function(req, res){

    res.render("index");
});

// About Page Route
app.get("/about", function(req, res){

    res.render("about");
});

// Dynamic Sports Route
app.get("/sport", async function(req, res){

    let sportSelection = req.query.sportSelection; // Obtain user's selection from Navbar
    let filterSelection = req.query.filterSelection; // Obtain user's filter selection

    productObject = await getProducts(sportSelection); // Create and store object with API info
    productObject = await getProducts(sportSelection); // Create and store object with API info
    // Sort by user's filter selection
    if(filterSelection == "az") {
        productObject.sort((a, b) => (a.productName > b.productName) ? 1 : -1);
    }

    if(filterSelection == "price") {
        productObject.sort((a, b) => (a.productPrice > b.productPrice) ? 1 : -1);
    }

    res.render("sports", {"productObject": productObject, "sportSelection": sportSelection});

});

// Search Route
app.get("/search", async function(req, res){

    let itemSearch = req.query.itemSearch; // Obtain user's search string
    let filterSelection = req.query.filterSelection; // Obtain user's filter selection

    let productObject = await getProducts(itemSearch); // Create and store object with API info

    if(productObject == undefined){
        res.render("itemNotFound");
    }
    //Sort by user's filter selection
    if(filterSelection == "az") {
        productObject.sort((a, b) => (a.productName > b.productName) ? 1 : -1);
    }

    if(filterSelection == "price") {
        productObject.sort((a, b) => (a.productPrice > b.productPrice) ? 1 : -1);
    }

    res.render("sports", {"productObject": productObject, "itemSearch": itemSearch});
});

// Shopping Cart Route
app.get("/cart", function(req, res){

    let index = req.query.index; // Stores index of cart item selected
    let indexDel = req.query.indexDel;
    let qty = req.query.qty;
    total = 0;

    // If 'add to cart' btn triggered this route
    if(index){
        cartObj.push(
            {
                "productAmount": 1,
                "productName": productObject[index].productName,
                "productImagePath": productObject[index].productImagePath,
                "productPrice": productObject[index].productPrice
            }
        );
    }
    else if(indexDel) {
        cartObj.splice(indexDel,1);
    }

    else if(qty){
        cartObj[req.query.qtyIndex].productAmount = qty;
    }

    // Else, The user pressed the 'cart' btn in the header.ejs file
    else{
        for(let i = 0; i < cartObj.length; i++) {
            total += (cartObj[i].productPrice * cartObj[i].productAmount);
        }
        res.render("cart", {"cartObj": cartObj, "total": total});
    }

});

app.get("/cart/checkout", async function(req, res) {
   // let username = req.query.username;
    //let user_id = await createUser(username);
    placeOrder(total, new Date().toISOString().slice(0, 10), 3);
    res.render("confirmation", {"cartObj": cartObj, "total": total});
    total = 0;
    cartObj = [];
});

// Admin Login Page
app.get("/login", function(req, res){
    let loginError = req.query.loginError;
    if(loginError){
        res.render("adminLogin", {"loginError": loginError});
    }
    else {
        res.render("adminLogin", {"loginError": false});
    }
});

// Admin POST route, calls verifyAdmin()
app.post("/login", async function(req, res){
    let username = req.body.username;
    let password = req.body.password;
    overviewData = [];

    let authenticateUser = await verifyAdmin(username, password);

    if(authenticateUser){
        req.session.authenticated = true;
        let numOrders = await getNumOrders();
        let totalRev = await getTotalRevenue();
        console.log(req.session.authenticated);
        // Add data to overviewData object
        overviewData.push(
            {
                username: username,
                numOrders: numOrders,
                totalRev: totalRev
            }
        );

        res.render("adminPortal", {"overviewData": overviewData});
    }
    else{
        console.log(req.session.authenticated);
        res.redirect("/login?loginError=true");
    }
});

// Admin Overview Page, same view as successful admin login
app.get("/adminOverview", function(req, res){
    if(req.session.authenticated == true){
        res.render("adminPortal", {"overviewData": overviewData});
    }
    else{
        res.redirect("/login");
    }

});

// Admin Orders Page
app.get("/adminOrders", function(req, res){
    if(req.session.authenticated == true) {
        res.render("adminOrders");
    }
    else{
        res.redirect("/login");
    }
});

// Admin View Users
app.get("/adminViewUsers", function(req, res){
    if(req.session.authenticated == true) {
        res.render("adminUsers");
    }
    else{
        res.redirect("/login");
    }
});

// Admin View Admins
app.get("/adminViewAdmins", function(req, res){
    if(req.session.authenticated == true) {
        res.render("adminViewAdmins");
    }
    else{
        res.redirect("/login");
    }
});

// Helper route for ajax call on adminOrders.ejs page
app.get("/populateOrders", async function(req, res){

    let orders = await getAllOrders();

    res.send(orders);
});

// Helper route for ajax call on adminOrders.ejs page
app.get("/populateRevenue", async function(req, res){

    let revenue = await getTotalRevenue();
    let revObject = [{totalRev: revenue}]; // Send as object

    res.send(revObject);
});

// Helper route for ajax call on adminOrders.ejs page
app.get("/populateSearchOrders", async function(req, res){

    let searchVal = req.query.searchVal;

    let resultObject = await getOrderById(searchVal);

    res.send(resultObject);
});

// Helper route for ajax call on adminUsers.ejs page
app.get("/populateUsers", async function(req, res){

    let users = await getAllUsers(); // Store user object

    res.send(users);
});

// Helper route for ajax call on adminUsers.ejs page
app.get("/populateSearchUsers", async function(req, res){

    let username = req.query.searchVal;

    let resultObject = await getUserByUsername(username);

    res.send(resultObject);
});

// Helper route for ajax call on adminViewAdmins.ejs page
app.get("/populateAdmins", async function(req, res){

    let admins = await getAllAdmins(); // Store user object

    res.send(admins);
});

// Helper route for ajax call on adminViewAdmins.ejs page
app.get("/populateSearchAdmins", async function(req, res){

    let username = req.query.searchVal;

    let resultObject = await getAdminByUsername(username);

    res.send(resultObject);
});

// Helper route for ajax call on adminUsers.ejs page
app.get("/deleteUser", async function(req, res){

    let username = req.query.searchVal;

    let result = deleteUserByUsername(username);

    let resultObj = [{result: result}];

    res.send(resultObj);
});

// Helper route for ajax call on adminViewAdmins.ejs page
app.get("/addAdmin", async function(req, res){

    let username = req.query.username;
    let password = req.query.password;

    let result = addAdminToDB(username, password);

    res.send(result);
});

// Logout route. Destroys current session
app.get("/logout", function(req, res){
    req.session.destroy();
    res.redirect("/");
});

/*
 * Get sport products from Walmart API.
 * @param {string} sport
 * @return {object} sport-object 
*/
function getProducts(sport){

    // Await expression waits for a promise, so a promise must be returned here
    return new Promise(function(resolve, reject){
        let requestUrl = `http://api.walmartlabs.com/v1/search?query=${sport}&format=json&apiKey=7eksjp57nqzw9hnb9hsudh93`;

        request(requestUrl, function(error, response, body){
            if(!error && response.statusCode == 200 && JSON.parse(body).items != undefined){
                let parsedData = JSON.parse(body);
                let productObject = []; // Declare Product Object

                // Current API call only retrieves 10 items
                let count = parsedData.items.length; // Constrain count if need +/- than 10

                // Fill object with Name, Price, and ImageUrl for first <= 10 results
                for(let i = 0; i < count; i++){
                    try {
                        productObject.push(
                            {
                                productName: parsedData.items[i].name,
                                productPrice: parsedData.items[i].salePrice,
                                productImagePath: parsedData.items[i].imageEntities[0].mediumImage
                            }
                        );
                    } catch(error){}
                }

                resolve(productObject); // Use resolve to return the productObject
            }
            else{
                console.log('error:', error);
                console.log('statusCode:', response && response.statusCode);
                reject(error); // Use reject to pass error value
            }
        });
    }).catch(function(error){});
}

/*
 * Checks if username and password match database entry.
 * @param {string} username
 * @param {string} password
 * @return {boolean} true if found, false otherwise
*/
function verifyAdmin(username, password){
    let sqlUsername = "SELECT * FROM admin WHERE username =?";
    let authenticated;

    return new Promise(function(resolve, reject){
        conn.query(sqlUsername, [username], async function(err, rows, fields){
            if(err) throw err;

            // If username exists in database, call verifyPassword()
            if(rows.length > 0){
                // console.log(rows[0].username + ", " + rows[0].password);
                if(rows[0].username == username){
                    let passwordCheck = await verifyPassword(password, rows[0].password);
                    passwordCheck ? resolve(true) : resolve(false); // if match return true, false otherwise
                    // console.log("password check = " + passwordCheck);
                }
                else{
                    authenticated = false;
                }
            }

            resolve(authenticated);
        });//query
    });//promise
}

/*
 * Checks if user password matches the hashed password in the database.
 * Will only execute if the username is found.
 * @param {string} password
 * @param {string} hashedPassword
 * @return {boolean} true if found, false otherwise
*/
function verifyPassword(password, hashedPassword){
    return new Promise(function(resolve, reject){

        // Compare hashed password with users password
        bcrypt.compare(password, hashedPassword, function(err, result){
            // console.log("Result: " + result);
            if(err) throw err;
            resolve(result);
        });//bcrypt
    });//promise
}

/*
 * Returns the number of orders in the database
 * @return {int} numOrders
*/
function getAllOrders(){
    let getOrders = ("SELECT * FROM orders");

    return new Promise(function(resolve, reject){

        // Gets number of orders
        conn.query(getOrders, async function(err, rows, fields){
            if(err) throw err;

            resolve(rows);
        });//Orders query

    });//Promise
}

/*
 * Returns the number of orders in the database
 * @return {int} numOrders
*/
function getNumOrders(){
    let getOrders = ("SELECT * FROM orders");

    return new Promise(function(resolve, reject){

        // Gets number of orders
        conn.query(getOrders, async function(err, rows, fields){
            if(err) throw err;
            numOrders = rows.length;

            resolve(numOrders);
        });//Orders query

    });//Promise
}

/*
 * Returns the sum of all orders in the database
 * @return {int} totalRev
*/
function getTotalRevenue(){
    let getRev = ("SELECT SUM(order_amount) AS totalRev FROM orders");

    return new Promise(function(resolve, reject){

        // Gets total revenue in database
        conn.query(getRev, async function(err, rows, fields){
            if(err) throw err;
            totalRev = rows[0].totalRev;

            resolve(totalRev);
        });//Revenue query

    });//Promise
}

/*
 * Returns orders based off order_id
 * @return {object} ordersById
*/
function getOrderById(orderId){
    let getOrders = ("SELECT * FROM orders WHERE order_id =?");

    return new Promise(function(resolve, reject){

        // Gets number of orders
        conn.query(getOrders, [orderId], async function(err, rows, fields){
            if(err) throw err;

            resolve(rows);
        });//Orders query

    });//Promise
}

/*
 * Returns All Users in DB
 * @return {object} userObject
*/
function getAllUsers(){
    let getUsers = ("SELECT * FROM user");

    return new Promise(function(resolve, reject){

        // Gets number of orders
        conn.query(getUsers, async function(err, rows, fields){
            if(err) throw err;

            resolve(rows);
        });//Orders query

    });//Promise
}

/*
 * Returns users based off user_id
 * @return {object} ordersById
*/
function getUserByUsername(username){
    let getOrders = ("SELECT * FROM user WHERE username =?");

    return new Promise(function(resolve, reject){

        // Gets number of orders
        conn.query(getOrders, [username], async function(err, rows, fields){
            if(err) throw err;

            resolve(rows);
        });//Orders query

    });//Promise
}

/*
 * Returns All Admins in DB
 * @return {object} adminsObject
*/
function getAllAdmins(){
    let getAdmins = ("SELECT * FROM admin");

    return new Promise(function(resolve, reject){

        // Gets number of orders
        conn.query(getAdmins, async function(err, rows, fields){
            if(err) throw err;

            resolve(rows);
        });//Orders query

    });//Promise
}

/*
 * Returns users based off user_id
 * @return {object} ordersById
*/
function getAdminByUsername(username){
    let getOrders = ("SELECT * FROM admin WHERE username =?");

    return new Promise(function(resolve, reject){

        // Gets number of orders
        conn.query(getOrders, [username], async function(err, rows, fields){
            if(err) throw err;

            resolve(rows);
        });//Orders query

    });//Promise
}

/*
 * Deletes user based off user_id
*/
function deleteUserByUsername(username){
            let deleteUser = ("DELETE FROM user WHERE username =?");

            // Deletes Username in DB
            conn.query(deleteUser, [username], async function(err, rows, fields){
                if(err) throw err;
            });//Orders query

}

/*
 * Deletes user based off user_id
*/
function addAdminToDB(username, password){
    let addAdmin = ("INSERT INTO admin (username, password) VALUES(?, ?)");

    return new Promise(function(resolve, reject){
        let saltRounds = 10;
        let hashedPwd = "";

        bcrypt.hash(password, saltRounds).then(function(hash) {
            hashedPwd = hash;

            // Add admins to DB
            conn.query(addAdmin, [username, hashedPwd], async function(err, rows, fields){
                if(err) throw err;
                resolve(true);
            });//Orders query
        });//bcrypt

    });//Promise
}

function placeOrder(orderAmount, date, userID) {
    let sql = "INSERT INTO orders (order_amount, date, user_id) VALUES (?, ?, ?)";

    conn.query(sql, [orderAmount, date, userID], function(err, rows, fields){
        if(err) throw err;
    });
}

function createItem (id, name) {
    let sql = "INSERT INTO items (item_id, item_name) VALUES (?, ?)";

    conn.query(sql, [id, name], function(err, rows, fields) {
        if(err) throw err;
    });
}

/*function createUser(username) {
    let sqlUsername = "SELECT * FROM user WHERE username =?";
    let sqlNewUser = "INSERT INTO user (username) VALUES (?)";
    return new Promise(function(resolve, reject){
        conn.query(sqlNewUser, [username], async function (err, rows, fields) {
            if(err) throw err;
        });
        conn.query(sqlUsername, [username], async function (err, rows, fields){
            if(err) throw err;
            console.log(rows[0].user_id);
            resolve(rows[0].user_id);
        });

    });
}*/

// Starting Server on local machine (For Dev)
// app.listen("8080", "127.0.0.1", function(){
//     console.log("Express server is running...");
// });

//Starting Server for Web Hosting Environment 
app.listen(process.env.PORT, process.env.IP, function(){
    console.log("Express server is running...");
});