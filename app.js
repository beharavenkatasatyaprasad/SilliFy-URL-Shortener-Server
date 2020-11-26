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

// const port = ;

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
                type_: 'danger'
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
                            type_: 'danger'
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
                            html: `Hello ${name} , Here's your Account verification link: <br> <a style="color:green" href="${url}">Click Here To Confirm</a> <br> Link expires in an hour...`
                        };
                        transporter.sendMail(mailOptions, function (error, info) {
                            if (error) {
                                console.log(error)
                            } else {
                                return res.json({
                                    message: 'Check your mail and Confirm Identity...',
                                    type_: 'success'
                                }); //* if mail sent send this msg
                            }
                        });
                    }
                });
            });
        } else {
            return res.json({
                message: 'email already exists!!',
                type_: 'warning'
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
                type_: 'danger'
            });
        }
        if (User == null) {
            return res.json({
                message: 'No registered user found with '+ email,
                type_: 'warning'
            });
        } else {
            if (User.confirmed == true) {
                bcrypt.compare(password, User.password, function (err, result) { //* if found compare the & check passworded match or not
                    if (err) {
                        return res.json({
                            message: 'Something went wrong..',
                            type_: 'danger'
                        })
                    }
                    if (result == true) { //if matched 
                        let token = uid(16) //*assign a random token
                        return res.json({
                            token: token,
                            message: 'Logging in..',
                            type_: 'success'
                        })
                    } else {
                        return res.json({
                            message: 'Invalid Credentials..',
                            type_: 'warning'
                        })
                    }
                })
            } else {
                return res.json({
                    message: 'User Identity not Confirmed..',
                    type_: 'warning'
                })
            }
        }
    })

});


//Endpoint for resetting password
app.post("/resetpassword", cors(), async (req, res) => {
    const {
        email
    } = req.body //email from client
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db
    let db = client.db("SilliFy"); //db name
    let user = db.collection("users"); //collection name
    user.findOne({ //find if the email exist in the collection
        email: email
    }, (err, users) => {
        if (users == null) {
            return res.json({
                message: 'No registered user found with ' + email,
                type_: 'warning'
            }); //! if not found send this status
        } else { //if found 
            // let token = uid(5);
            let emailToken = jwt.sign({
                email: email
            }, 'secret', {
                expiresIn: '10m'
            });

            user.findOneAndUpdate({
                email: email
            }, {
                $set: {
                    confirmed: false
                }
            });
            let url = `http://localhost:3000/auth0/${emailToken}`
            let name = `${email.split('@')[0]}`
            //email template for sending token
            var mailOptions = {
                from: '"Lets SillyFy 👻" <noreply@SillyFy.com>',
                to: `${email}`,
                subject: 'Password Reset Link',
                html: `Hello ${name} ,<br> Here's your password reset link: <a style="color:green" href="${url}">Click Here To Reset</a> Link expires in 10 minutes...`
            };

            //Send the mail
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    return res.json({
                        message: error,
                        type_: 'danger'
                    });
                } else {
                    return res.json({
                        message: 'Check your mail and Confirm Identity...',
                        type_: 'success'
                    }); //* if mail sent send this msg
                }
            });
        }
        if (err) {
            return res.json({
                message: err,
                type_: 'danger'
            }); //! if found any error send this status
        }
    })
});

app.post('/newpassword', cors(), async (req, res) => {
    const {
        password,
        email
    } = req.body; //email & newpassword from client
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
                message: 'Something Went Wrong',
                type_: 'warning'
            });
        }
        if (User == null) {
            return res.json({
                message: 'No registered user found with ' + email,
                type_: 'warning'
            }); //! if not found send this status
        } else {
            //find if the token exists in the collection
            if (User.confirmed == true) {
                bcrypt.hash(password, saltRounds, function (err, hash) { //hash the new password
                    if (err) {
                        return res.json({
                            message: err,
                            type_: 'danger'
                        });
                    } else {
                        user.findOneAndUpdate({
                            email: email
                        }, {
                            $set: {
                                password: hash //and set the new hashed password in the db
                            }
                        }, (err, result) => {
                            if (err) {
                                return res.json({
                                    message: err,
                                    type_: 'danger'
                                });
                            }
                            if (result) {
                                return res.json({
                                    message: 'Password Reset Successfull',
                                    type_: 'success'
                                });
                            }
                        });
                    }

                })
            } 
            else {
                return res.json({
                    message: 'Unauthorized Request',
                    type_: 'danger'
                });
            }
        }
    })

})

//for password reset auth
app.get("/auth0/:token", (req, res) => {
    const token = req.params.token
    jwt.verify(token, 'secret', async function (err, decoded) {
        if (decoded) {
            let client = await mongoClient.connect(url, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            let db = client.db("SilliFy"); //db name
            let user = db.collection("users"); //collection name
            user.findOneAndUpdate({
                email: decoded.email
            }, {
                $set: {
                    confirmed: true
                }
            }, (err, result) => {
                if (err) {
                    return res.json({
                        message: err,
                        type_: 'danger'
                    });
                }
                if (result) {
                    res.redirect('https://sillyfy.netlify.app/newpassword.html');
                }
            });
        }
        if (err) {
            return res.json({
                message: err,
                type_: 'danger'
            }); //if the token expired send this status
        }
    });
});

//for account auth
app.get("/auth/:token", (req, res) => {
    const token = req.params.token
    jwt.verify(token, 'secret', async function (err, decoded) {
        if (decoded) {
            let client = await mongoClient.connect(url, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            let db = client.db("SilliFy"); //db name
            let user = db.collection("users"); //collection name
            user.findOneAndUpdate({
                email: decoded.email
            }, {
                $set: {
                    confirmed: true //and set the new hashed password in the db
                }
            }, (err, result) => {
                if (err) {
                    return res.json({
                        message: err,
                        type_: 'danger'
                    });
                }
                if (result) {
                    res.redirect('https://sillyfy.netlify.app/confirmation.html');
                }
            });
        }
        if (err) {
            return res.json({
                message: err,
                type_: 'danger'
            }); //if the token expired send this status
        }
    });
});


app.listen(process.env.port || 3000, () => `Server running on port `);