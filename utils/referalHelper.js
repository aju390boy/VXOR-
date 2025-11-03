const Referral = require('../model/referral.js');

async function createUniqueReferralCode(userId) {
  let code;
  let exists = true;

  while (exists) {
    const randomNum = Math.floor(100 + Math.random() * 900); 
    code = `VXOR${randomNum}`;
    exists = await Referral.exists({ code });
  }
  return code;
}

module.exports = { createUniqueReferralCode };