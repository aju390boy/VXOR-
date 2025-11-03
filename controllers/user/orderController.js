
const Product=require('../../model/product.js');
const Order=require('../../model/order.js');


exports.searchUserOrders = async (req, res, next) => {
    try {
        const { q } = req.query;
        const user = req.user;
        const searchQuery = new RegExp(q, 'i');
        const matchingProducts = await Product.find({ title: searchQuery }).select('_id').lean();
        const productIds = matchingProducts.map(p => p._id);
        const orderQuery = {
            user_id: user._id,
            $or: [
                { order_id: searchQuery },
                { 'products.product_id': { $in: productIds } }
            ]
        };
        const orders = await Order.find(orderQuery).sort({ createdAt: -1 }).populate({ path: "products.product_id", select: "title colorVariants" }).lean();
        res.render("user/profile/partials/_orderList", { 
            orders, 
            isSearchResult: true, 
            layout: false 
        });

    } catch (error) {
        console.error('Error searching orders:', error);
        next(error); 
    }
};