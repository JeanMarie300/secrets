require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const mongoose = require('mongoose');
const encrypt = require('mongoose-encryption');
const md5 = require('md5');
const bcrypt = require('bcrypt');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
var findOrCreate = require('mongoose-findorcreate')
var GoogleStrategy = require('passport-google-oauth20').Strategy;
const saltRound =parseInt(process.env.SALTROUND);
var username,password;
var secrets;

app.set('view engine', 'ejs');

app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
  }));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb://127.0.0.1:27017/userDB');
const userSchema =new mongoose.Schema({
    email:String,
    password:String,
    secret:String
}); 

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);


const User = mongoose.model('User', userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {

     cb(null, {
        id: user.id
      });
  });

passport.deserializeUser(function(user, cb) {
        cb(null, user);
  });


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


async function findUser(id) {
    userFound =   await  User.findById(id).exec();
}

async function fetchSecrets() {
    secrets =  await User.find({ secret: { $ne: null }});  
}


app.use(bodyParser.urlencoded({extended:true}));

app.use(express.static("public"));


app.get("/", function(request, response){
    response.render("home");
});

app.get("/login", function(request, response){
    response.render("login");
});

app.get("/register", function(request, response){
    response.render("register");

});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] })
);

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/secrets');
  });

app.get("/secrets", function(request, response) {
    console.log(request.isAuthenticated());
    if (request.isAuthenticated()) {
        fetchSecrets().catch(function(e) {
            console.log(e);
        }).then(function() {
            response.render("secrets",{UserList:secrets});
        })
    } else {
        response.redirect("/login");
    }
});

app.get("/logout", function(request, response){
    request.logout(function(err) {
        if (err) {  console.log(err); }
        response.redirect("/login");
    });
});

app.get("/submit", function(request, response) {
    if (request.isAuthenticated()) {
        response.render("submit");
    } else {
        response.redirect("/login");
    }
})


app.post("/submit", function(request, response) {
    if (request.isAuthenticated()) {
        console.log(request.user.id);
        findUser(request.user.id).catch(function() {
            console.log(e)
        }).then(function() {
            userFound.secret = request.body.secret;
            userFound.save().catch(function(e) {
                console.log(e);
            }).then(function() {
                response.redirect("/secrets");
            })
        })
    } else {
        response.redirect("/login");
    }
})


app.post("/register", function(request, response) {

    User.register({username:request.body.username},request.body.password,  function(err, user) {
        if (err) { 
            console.log(err);
            response.redirect("/register");
         } else {
            console.log(user);
            const authFunc = passport.authenticate('local', {
                successRedirect:'/secrets',
                failureRedirect: '/register',
                failureFlash: true,
              });
              authFunc(request, response);
        } 
    })
});


app.post('/login',
  passport.authenticate('local', { failureRedirect: '/login', failureMessage: true }),
  function(request, response) {
    response.redirect('/secrets');
});


app.listen(3000, function() {
    console.log("Server is listening on port 3000");
});