const express = require('express');
const path = require('path');
const morgan=require('morgan')
const nocache = require('nocache')
const MongoStore = require('connect-mongo');
const session = require('express-session'); 
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');

module.exports = (app) => {
    app.use(express.static('public'));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(nocache());
   app.use(methodOverride(function (req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    var method = req.body._method;
    delete req.body._method;
    return method;
  }
  if (req.query && '_method' in req.query) {
    return req.query._method;
  }
}));
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, 
            maxAge: 1000 * 60 * 60 * 24, 
        },
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            collectionName: 'sessions',
            ttl: 14 * 24 * 60 * 60 
        })
    }));
    app.use(morgan('dev'));
    app.use(expressLayouts);
    app.set('view engine', 'ejs');
    app.set('views', path.resolve('./views')); 
    app.set('layout', 'layout/userMain');
};