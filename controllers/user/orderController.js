
const Product=require('../../model/product.js');
const Order=require('../../model/order.js');

exports.searchUserOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const { search } = req.query; 
        const query = { user_id: userId };
        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            const products = await Product.find({ title: searchRegex }).select('_id').lean();
            query.$or = [
                { order_id: searchRegex },
                { 'products.product_id': { $in: products.map(p => p._id) } }
            ];
        }
        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .populate({ path: 'products.product_id', select: 'title' })
            .lean();
        res.status(200).json({ orders });
    } catch (error) {
        console.error('Error searching user orders:', error);
        res.status(500).json({ message: 'Server error during search.' });
    }
};