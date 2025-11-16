const Wallet = require('../model/wallet.js');
const Referral = require('../model/referral.js');
const User = require('../model/user.js');

async function rewardReferralUsers(referredUserId, orderId = null) {
  try {
    const referral = await Referral.findOne({
      'referred_users.user_id': referredUserId,
      'referred_users.reward_given': false
    });
    if (!referral) {
      console.log(`No pending referral found for user ${referredUserId}`);
      return;
    }
    const referredUserSubdoc = referral.referred_users.find(
      u => u.user_id.toString() === referredUserId.toString() && !u.reward_given
    );
    if (!referredUserSubdoc) {
      console.log(`No unrewarded referred user entry found for ${referredUserId}`);
      return;
    }
    const referrerId = referral.referrer_user_id;
    if (!referrerId) {
      console.log(`Referral record missing referrer_user_id for user ${referredUserId}`);
      return;
    }
    const rewardForReferrer = 100;
    const rewardForReferred = 50;
    async function creditWallet(userId, amount, description) {
      let wallet = await Wallet.findOne({ user_id: userId });
      const newUser = await User.findById(userId);
       const fullName = newUser ? `${newUser.firstname} ${newUser.lastname}`.trim() : 'Unknown User';
      if (!wallet) {
        wallet = new Wallet({ user_id: userId, balance: 0, transactions: [] });
      }
      wallet.balance += amount;
      wallet.transactions.push({
        amount,
        type: 'credit',
        description,
        orderId,
        fullName,
      });
      await wallet.save();
      console.log(`Credited wallet of user ${fullName} by ₹${amount}`);
    }
    // Credit referrer
    const referreredUser = await User.findById(referredUserId);
    const referreredFullName = referreredUser ? `${referreredUser.firstname} ${referreredUser.lastname}`.trim() : 'Referrer';
    console.log(`referred user : ${referreredFullName}`);
    await creditWallet(
      referrerId,
      rewardForReferrer,
      `Referral bonus from Mr.${referreredFullName}`
    );
    const referrerUser = await User.findById(referrerId);
    const referrerFullName = referrerUser ? `${referrerUser.firstname} ${referrerUser.lastname}`.trim() : 'Referrer';
    await creditWallet(
      referredUserId,
      rewardForReferred,
      `Welcome referral bonus from Mr.${referrerFullName}`,
    );
    referredUserSubdoc.reward_given = true;
    referredUserSubdoc.reward_amount = rewardForReferrer + rewardForReferred;
    referredUserSubdoc.status = 'REWARDED';
    referredUserSubdoc.usedAt = new Date();
    const allRewarded = referral.referred_users.every(u => u.reward_given);
    if (allRewarded) {
      referral.status = 'REWARDED';
    }
    await referral.save();
    console.log(`Referral reward process completed for referred user ${referredUserId}`);
  } catch (error) {
    console.error('Error in rewardReferralUsers:', error);
  }
}
module.exports = {rewardReferralUsers};