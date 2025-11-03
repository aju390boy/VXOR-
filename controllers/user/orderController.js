
const Product=require('../../model/product.js');
const Order=require('../../model/order.js');



// In controllers/user/orderController.js

exports.searchUserOrders = async (req, res, next) => {
    try {
        const { q } = req.query;
        const user = req.user;
        
        const searchQuery = new RegExp(q, 'i');

        // Your logic to find the orders remains the same...
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
        
        // --- THIS IS THE KEY CHANGE ---
        // Render the main partial, but with a special flag to indicate it's a search result.
        res.render("user/profile/partials/_orderList", { 
            orders, 
            isSearchResult: true, // This is the new flag
            layout: false 
        });

    } catch (error) {
        console.error('Error searching orders:', error);
        next(error); 
    }
};