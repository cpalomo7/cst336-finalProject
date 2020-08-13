const express = require("express");
const app = express();
const request = require("request"); // Import request package
const conn = require("./dbPool.js"); // Import the DB File
const session = require("express-session");
const bcrypt = require("bcrypt");

app.set("view engine", "ejs");
app.use(express.static("public")); // Use public folder for all static files
app.use(express.urlencoded({extended:true})); // Middleware to be able to parse POST parameters

// Global objects
let productObject; // Object that stores the values from the Walmart API
let cartObj = []; // Object that stores the items in the user cart
let overviewData = []; // Object that will be passed to adminPortal

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

    productObject = await getProducts(sportSelection); // Create and store object with API info

    res.render("sports", {"productObject": productObject});

});

// Search Route
app.get("/search", async function(req, res){

    let itemSearch = req.query.itemSearch; // Obtain user's search string

    productObject = await getProducts(itemSearch); // Create and store object with API info

    if(productObject == undefined){
        res.render("itemNotFound");
    }

    else {
        res.render("sports", {"productObject": productObject});
    }
});

// Shopping Cart Route
app.get("/cart", function(req, res){

    let index = req.query.index; // Stores index of cart item selected

    // If 'add to cart' btn triggered this route
    if(index){
        cartObj.push(
            {
                "productName": productObject[index].productName,
                "productImagePath": productObject[index].productImagePath,
                "productPrice": productObject[index].productPrice
            }
        );
    }

    // Else, The user pressed the 'cart' btn in the header.ejs file
    else{
        res.render("cart", {"cartObj": cartObj});
    }

});

// Admin Login Page
app.get("/login", function(req, res){
    res.render("adminLogin");
});

// Admin POST route, calls verifyAdmin()
app.post("/login", async function(req, res){
    let username = req.body.username;
    let password = req.body.password;

    let authenticateUser = await verifyAdmin(username, password);

    if(authenticateUser){
        let numOrders = await getNumOrders();
        let totalRev = await getTotalRevenue();

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
        res.send("Username or password is incorrect");
    }
});

// Admin Overview Page, same view as successful admin login
app.get("/adminOverview", function(req, res){

    res.render("adminPortal", {"overviewData": overviewData});
});

// Admin Orders Page
app.get("/adminOrders", function(req, res){

    res.render("adminOrders");
});

// Admin View Users
app.get("/adminViewUsers", function(req, res){
    res.render("adminUsers");
});

// Admin View Admins
app.get("/adminViewAdmins", function(req, res){
    res.render("adminViewAdmins");
});

// Helper route for ajax call on adminOrders.ejs page
app.get("/populateOrders", async function(req, res){
    
    let orders = await getAllOrders();

    console.log("\nCLICKED!!!\NAdminOrders: " + orders);

    res.send(orders);
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
            console.log("\nRows[0]: " + rows[0]);

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
            console.log("\nNumber of Orders: " + numOrders + "\nTypeOf: " + typeof(numOrders));

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
            console.log("Total Rev: " + totalRev + "\nTypeOf: " + typeof(totalRev));

            resolve(totalRev);
        });//Revenue query

    });//Promise
}

// Starting Server on local machine (For Dev)
app.listen("8080", "127.0.0.1", function(){
    console.log("Express server is running...");
});

// Starting Server for Web Hosting Environment 
// app.listen(process.env.PORT, process.env.IP, function(){
//     console.log("Express server is running...");
// });