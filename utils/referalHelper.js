const Referral = require('../model/referral.js');

async function createUniqueReferralCode(userId, maxAttempts = 10) {
  let code;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < maxAttempts) {
    const randomNum = Math.floor(100 + Math.random() * 900); 
    code = `VXOR${randomNum}`;

    exists = await Referral.exists({ code });
    attempts++;
  }

  if (exists) {
    throw new Error('Could not generate unique referral code. Please try again.');
  }

  return code;
}


module.exports = { createUniqueReferralCode };