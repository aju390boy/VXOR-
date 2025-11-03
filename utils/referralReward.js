const Wallet = require('../model/wallet.js');
const Referral = require('../model/referral.js');

async function rewardReferralUsers(referredUserId) {
  const referral = await Referral.findOne({ referred_user_id: referredUserId });

  if (!referral || referral.reward_given) {
    // No referral or already rewarded
    return;
  }

  const referrerId = referral.referrer_user_id;
  const rewardForReferrer = 100;
  const rewardForReferred = 50;

  // Increase referrer wallet balance
  await Wallet.findOneAndUpdate(
    { user_id: referrerId },
    { $inc: { balance: rewardForReferrer } },
    { upsert: true }
  );

  // Increase referred user wallet balance
  await Wallet.findOneAndUpdate(
    { user_id: referredUserId },
    { $inc: { balance: rewardForReferred } },
    { upsert: true }
  );

  // Mark referral as rewarded to prevent duplicate rewards
  referral.reward_given = true;
  referral.reward_amount = rewardForReferrer + rewardForReferred;
  referral.status = 'REWARDED';
  await referral.save();
}

module.exports = {rewardReferralUsers};