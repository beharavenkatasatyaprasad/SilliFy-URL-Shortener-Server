const express = require('express');
const app = express(); //initialize express
const bodyParser = require('body-parser'); //body parsing middleware
var jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); //library to hash passwords
const saltRounds = 10; //cost factor (controls how much time is needed to calculate a single BCrypt hash)
const uid = require('rand-token').uid; // random token generator
const nodemailer = require("nodemailer"); //end e-mails
const mongodb = require('mongodb'); //MongoDB driver 
const cors = require('cors'); //middleware that can be used to enable CORS with various options
app.options('*', cors())

const port = process.env.PORT || 3000;
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'mockmail4me@gmail.com',
        pass: 'luyytrvzrzuuzhsq'
    }
});

app.use(bodyParser.json());
app.use(cors());

const mongoClient = mongodb.MongoClient;
const url = "mongodb+srv://satyabehara:ftjrbtc9S1@cluster0.u3j3r.mongodb.net/SilliFy?retryWrites=true&w=majority";

mongoClient.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, function (err, db) {
    if (err) throw err;
    console.log("Database Connected!");
    db.close();
});

app.get("/", (req, res) => {
    res.send('hello from server')
});

app.post("/register", async (req, res) => {
    const {
        email,
        password
    } = req.body;
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db
    let db = client.db("SilliFy"); //db name
    let user = db.collection("users"); //collection name
    user.findOne({
        email: email
    }, (err, result) => { //find if the email is already exist in the collection
        if (err) {
            return res.json({
                message: 'something went wrong',
                type: 'danger'
            });
        }
        if (result == null) {
            bcrypt.hash(password, saltRounds, function (err, hash) { //hash the client password
                user.insertOne({
                    email: email,
                    password: hash,
                    confirmed: false
                }, (err, result) => {
                    if (err) {
                        return res.json({
                            message: 'something went wrong',
                            type: 'danger'
                        });
                    }
                    if (result) {
                        let emailToken = jwt.sign({
                            exp: Math.floor(Date.now() / 1000) + (60 * 60),
                            email: email
                        }, 'secret');
                        let url = `http://localhost:3000/auth/${emailToken}`
                        let name = `${email.split('@')[0]}`
                        //email template for sending token
                        var mailOptions = {
                            from: '"Lets SillyFy 👻" <noreply@SillyFy.com>',
                            to: `${email}`,
                            subject: 'Account Confirmation Link',
                            html: `Hello ${name} , Here's your password reset link: <br> <a style="color:green" href="${url}">Click Here To Reset</a> <br> Link expires in an hour...`
                        };
                        transporter.sendMail(mailOptions, function (error, info) {
                            if (error) {
                                console.log(error)
                            } else {
                                return res.json({
                                    message: 'Check your mail and Confirm Identity...',
                                    type: 'success'
                                }); //* if mail sent send this msg
                            }
                        });
                    }
                }); 
            });
        } else {
            return res.json({
                message: 'email already exists!!',
                type: 'warning'
            });
        }
    })

});

app.post("/login", async (req, res) => {
    const {
        email,
        password
    } = req.body;
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db
    let db = client.db("SilliFy"); //db name
    let user = db.collection("users"); //collection name
    user.findOne({
        email: email
    }, (err, User) => {
        if (err) {
            return res.json({
                message: 'something went wrong',
                type: 'danger'
            });
        }
        if (User == null) {
            return res.json({
                message: 'No user found !!',
                type: 'warning'
            });
        } else {
            if (User.confirmed == true) {
                bcrypt.compare(password, users.password, function (err, result) { //* if found compare the & check passworded match or not
                    if (err) {
                        return res.json({
                            message: 'Something went wrong..',
                            type: 'danger'
                        })
                    }
                    if (result == true) { //if matched 
                        let token = uid(16) //*assign a random token
                        return res.json({
                            token: token,
                            message: 'Loging in..',
                            type: 'success'
                        })
                    } else {
                        return res.json({
                            message: 'Invalid Credentials..',
                            type: 'warning'
                        })
                    }
                })
            } else {
                return res.json({
                    message: 'Invalid Credentials..',
                    type: 'warning'
                })
            }

        }

    })

});






app.listen(port, () => `Server running on port ${port} 🔥`);