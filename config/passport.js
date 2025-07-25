const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport = require('passport');
const User=require('../model/user.js')
require('dotenv').config();

// Replace with your Google credentials
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
},
async function (accessToken, refreshToken, profile, done) {
  try {
    // Find or Create user in DB
    let user = await User.findOne({ email: profile.emails[0].value });

    if (!user) {
      user = await User.create({
        firstname: profile.name.givenName,
        lastname: profile.name.familyName,
        email: profile.emails[0].value,
        password: '', // or some default
      });
    }

    return done(null, user); 
  } catch (err) {
    return done(err, null);
  }
}));


passport.serializeUser((user, done) => {
  done(null, user._id); // only store user._id in session
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

