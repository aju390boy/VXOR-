const express = require('express');
const path = require('path');
const app = express();
const nocache = require('nocache')
const session = require('express-session'); 
const connect = require('./database/connect.js')
const adminRoutes = require('./routes/adminRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const authRoutes = require('./routes/authRoutes.js')
const passport = require('passport');
const expressLayouts = require('express-ejs-layouts');
require('./config/passport');
require('dotenv').config();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('view cache', false);
app.use(expressLayouts)

app.set('layout', 'layout/userMain'); 

app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(nocache());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24, 
    }
}));
app.use(passport.initialize());
app.use(passport.session());

app.use('/', authRoutes);
app.use('/user', userRoutes)
app.use('/admin', adminRoutes);
app.use('/*splat',(req,res)=>{
    res.render('user/error',{layout:false})
})
app.listen(3000, () => {
    console.log('server is running on http://localhost:3000/admin/login')
    connect();
})