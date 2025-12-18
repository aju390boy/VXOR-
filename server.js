const express = require('express');
const passport = require('passport');
const connect = require('./database/connect.js')
require('./config/passport');
require('dotenv').config();
const adminRoutes = require('./routes/adminRoutes/index.js');
const userRoutes = require('./routes/userRoutes/index.js');
const authRoutes = require('./routes/authRoutes/index.js')
const { getCartCount } = require('./middlewares/user/cartMiddleware.js');
const {navbarData} = require('./middlewares/user/navbarData.js');
const  referralCodeMiddleware = require('./middlewares/user/referralMiddleware.js');
const app = express();
require('./config/middlewareConfig.js')(app);

app.use(passport.initialize());
app.use(passport.session());
app.use(getCartCount); 
app.use(navbarData);
app.use(referralCodeMiddleware);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});
app.use('/', authRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/*splat',(req,res)=>{
    res.status(404).render('user/error',{layout:false})
});
const PORT = process.env.PORT_NUMBER || 3000;
app.listen(PORT, () => {
    console.log('server is running on http://localhost:3000')
    connect();
});
