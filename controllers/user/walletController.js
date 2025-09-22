const Razorpay = require('razorpay');
const crypto = require('crypto');
const Wallet = require('../../model/wallet.js');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1. CREATE THE RAZORPAY ORDER
exports.createWalletOrder = async (req, res) => {
   
    try {
        const { amount } = req.body;

        if (!amount || amount < 10) {
            return res.status(400).json({ message: 'Amount must be at least ₹10.' });
        }
        
        // --- FIX: Generate a shorter, unique receipt ID ---
        const receiptId = `wallet_${crypto.randomBytes(10).toString('hex')}`;

        const options = {
            amount: Number(amount) * 100,
            currency: "INR",
            receipt: receiptId // Use the new, shorter ID
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
// 2. VERIFY THE PAYMENT AND CREDIT THE WALLET
exports.verifyWalletPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
        const userId = req.user._id;
        
        // Create a signature using your secret key
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generated_signature = hmac.digest('hex');

        // Compare the generated signature with the one from the client
        if (generated_signature === razorpay_signature) {
            // Payment is authentic, now update the wallet
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