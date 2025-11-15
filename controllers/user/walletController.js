const Razorpay = require('razorpay');
const crypto = require('crypto');
const Wallet = require('../../model/wallet.js');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});
exports.createWalletOrder = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount < 10) {
            return res.status(400).json({ message: 'Amount must be at least ₹10.' });
        }
        const receiptId = `wallet_${crypto.randomBytes(10).toString('hex')}`;
        const options = {
            amount: Number(amount) * 100,
            currency: "INR",
            receipt: receiptId 
        };
        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            order,
            keyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        res.status(500).json({ success: false, message: "Could not create payment order." });
    }
};
exports.verifyWalletPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
        const userId = req.user._id;
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generated_signature = hmac.digest('hex');
        if (generated_signature === razorpay_signature) {
            let wallet = await Wallet.findOne({ user_id: userId });
            if (!wallet) {
                wallet = new Wallet({ user_id: userId, balance: 0, transactions: [] });
            }

            wallet.balance += Number(amount);
            wallet.transactions.push({
                amount: Number(amount),
                type: 'credit',
                description: 'Added money to wallet via Razorpay',
                orderId: razorpay_order_id
            });
            await wallet.save();
            res.json({ success: true, message: 'Payment successful! Wallet updated.' });
        } else {
            res.status(400).json({ success: false, message: 'Payment verification failed.' });
        }
    } catch (error) {
        console.error("Error verifying wallet payment:", error);
        res.status(500).json({ success: false, message: "Server error during verification." });
    }
};