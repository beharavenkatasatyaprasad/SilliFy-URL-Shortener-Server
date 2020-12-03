const express = require('express');
const app = express(); //initialize express
const bodyParser = require('body-parser'); //body parsing middleware
var jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const uid = require('rand-token').uid; // random token generator
const bcrypt = require('bcryptjs'); //library to hash passwords
const saltRounds = 10; //cost factor (controls how much time is needed to calculate a single BCrypt hash)
const nodemailer = require("nodemailer"); //end e-mails
require('dotenv').config()
const mongodb = require('mongodb'); //MongoDB driver 
const cors = require('cors'); //middleware that can be used to enable CORS with various options
app.proxy = true
const mongoClient = mongodb.MongoClient;
const url = process.env.MONGODB_URL;

const allowedOrigins = ['https://sillyfy.netlify.app', 'https://sillyfy.netlify.app/index.html', 'https://sillyfy.netlify.app/auth/resetpassword.html', 'https://sillyfy.netlify.app/auth/newpassword.html', 'https://password-reset-flow-ui.netlify.app/signup.html', 'https://sillyfy.netlify.app/user/home.html', 'https://sillyfy.netlify.app/user/mylinks.html' , 'https://sillyfy.netlify.app/admin.html','https://sillyfy.netlify.app/user/dashboard.html']
app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
        if (allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            callback(null, true)
        }
    }
}))

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAILUSER,
        pass: process.env.GMAILPASS
    }
});

app.use(bodyParser.json());
app.use(cookieParser())


mongoClient.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, function (err, db) {
    if (err) throw err;
    console.log("Database Connected!");
    db.close();
});

app.get("/", (req, res) => {
    res.send('hello from server');
    console.log("hello!");
});

app.get("/getusers",async (req, res) => {
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db
    let db = client.db("SilliFy"); //db name
    let user = db.collection("users"); //collection name
    user.find({}).toArray((err, result) => {
        if (result) {
            return res.json({
                length: result.length
            })
        }
    });
});

app.get("/getlinks",async (req, res) => {
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db
    let db = client.db("SilliFy"); //db name
    let links = db.collection("links"); //collection name
    links.find({}).toArray((err, result) => {
        if (result) {
            return res.json({
                length: result.length
            })
        }
    });
});

app.post("/adminlogin",async (req, res) => {
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
                message: 'No registered user found with ' + email,
                type_: 'warning'
            });
        } else {
            if (User.confirmed == true) {
                bcrypt.compare(password, User.password, function (err, result) { //* check credentials
                    if (err) {
                        return res.json({
                            message: 'Something went wrong..',
                            type_: 'danger'
                        })
                    }
                    if (result == true) { //if matched 
                        let token = jwt.sign({
                            email: email
                        }, process.env.JWT_SECRET, {
                            expiresIn: '1h'
                        }); //*assign a token
                        res.cookie('jwt', token, {
                            maxAge: 100000000000,
                            httpOnly: true,
                            sameSite: 'none',
                            secure: true
                        }).json({
                            type_: "success",
                            message: 'Logging in..',
                            user: email
                        })
                    } 
                    else {
                        return res.json({
                            message: 'Invalid Credentials..',
                            type_: 'warning'
                        })
                    }
                })
            }
        }
    })
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
                if (err) {
                    return res.json({
                        message: 'something went wrong',
                        type_: 'danger'
                    });
                }
                user.insertOne({
                    email: email,
                    password: hash,
                    confirmed: false
                }, (err, result) => {

                    if (result) {
                        let emailToken = jwt.sign({
                            exp: Math.floor(Date.now() / 1000) + (60 * 60),
                            email: email
                        }, process.env.JWT_SECRET);

                        let url = `https://sillyfy.herokuapp.com/auth/${emailToken}`
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
                message: 'No registered user found with ' + email,
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
                        let token = jwt.sign({
                            email: email
                        }, process.env.JWT_SECRET, {
                            expiresIn: '1h'
                        }); //*assign a token
                        res.cookie('jwt', token, {
                            maxAge: 1000000,
                            httpOnly: true,
                            secure: true
                        }).json({
                            type_: "success",
                            message: 'Logging in..',
                            user: email
                        })
                    } 
                    else {
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

app.get('/checklogin', function (req, res) {
    const cooked = req.cookies
    console.log(cooked.jwt)
    jwt.verify(cooked.jwt, process.env.JWT_SECRET, function (err, decoded) {
        if (err) return res.json({
            type_: 'warning',
            message: 'session expired'
        });
        if (decoded) {
            return res.json({
                type_: 'success',
                message: 'Login Successful..'
            });
        } else {
            return res.json({
                type_: 'warning',
                message: 'Invalid Login..'
            });
        }
    });
});

app.get("/logout", (req, res) => {
    res.clearCookie('jwt').json({
        type_: 'success',
        message: 'Logging Out...'
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
            }, process.env.JWT_SECRET, {
                expiresIn: '10m'
            });
            user.findOneAndUpdate({
                email: email
            }, {
                $set: {
                    confirmed: false
                }
            });
            let url = `https://sillyfy.herokuapp.com/auth0/${emailToken}`
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
            } else {
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
    jwt.verify(token, process.env.JWT_SECRET, async function (err, decoded) {
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
                    res.redirect('https://sillyfy.netlify.app/Auth/newpassword.html');
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
    jwt.verify(token, process.env.JWT_SECRET, async function (err, decoded) {
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
                    res.redirect('https://sillyfy.netlify.app/Auth/confirmation.html');
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

app.post("/sillyFy", async (req, res) => {
    const {
        req_by,
        longLink
    } = req.body;
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db
    let db = client.db("SilliFy"); //db name
    let links = db.collection("links"); //collection name
    const token = uid(5);
    let d = new Date();
    let date = d.getDate() + '-' + d.getMonth() + '-' + d.getFullYear();
    links.insertOne({
        longLink: longLink,
        shortLink: token,
        requestedBy: req_by,
        issuedOn: date
    }, (err, result) => {
        if (err) {
            return res.json({
                type_: 'danger',
                message: err
            });
        }
        if (result) {
            let shortlink = `https://sillyfy.herokuapp.com/fy/${token}`
            return res.json({
                type_: 'success',
                message: 'Got SillyFyed..',
                shortLink: shortlink,
                date: date,
                longLink: longLink
            });
        }
    });
});

app.post("/MyLinks", async (req, res) => {
    const {
        user
    } = req.body
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db
    let db = client.db("SilliFy"); //db name
    let links = db.collection("links"); //collection name
    links.find({
        requestedBy: user
    }).toArray((err, result) => {
        if (result) {
            return res.json({
                result
            })
        }
    });
});

app.get("/fy/:token", async (req, res) => {
    const {
        token
    } = req.params
    let client = await mongoClient.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }); //connect to db
    let db = client.db("SilliFy"); //db name
    let links = db.collection("links"); //collection name
    links.findOne({
        shortLink: token
    }, (err, result) => {
        if (result != null) {
            res.redirect(result.longLink);
        }
    });
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Server is live.. 🔥')
})