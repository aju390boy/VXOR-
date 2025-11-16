const Referral = require('../../model/referral.js');

async function referralCodeMiddleware(req, res, next) {
  try {
    if (req.user && req.user._id) {
      const referral = await Referral.findOne({ referrer_user_id: req.user._id });
      res.locals.referralCode = referral && referral.code ? referral.code : null;
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