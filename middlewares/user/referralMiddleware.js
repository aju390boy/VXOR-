const Referral = require('../../model/referral.js');

async function referralCodeMiddleware(req, res, next) {
    console.log('req.user in referralCodeMiddleware:', req.user);
  try {
    if (req.user && req.user._id) {
      const referral = await Referral.findOne({ referrer_user_id: req.user._id });
      if (referral) {
        res.locals.referralCode = referral.code;
      } else {
        res.locals.referralCode = null;
      }
    } else {
      res.locals.referralCode = null;
    }
    next();
  } catch (err) {
    console.error('Error fetching referral code middleware:', err);
    res.locals.referralCode = null;
    next();
  }
}

module.exports = referralCodeMiddleware;