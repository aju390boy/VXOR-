const Order = require('../../model/order.js'); 
const User = require('../../model/user.js');
const Product = require('../../model/product.js');

exports.getDashboard = async (req, res) => {
    try {
        // Corrected: Use the correct enum value 'DELIVERED'
        const deliveredOrders = await Order.find({ status: 'DELIVERED' }).lean();
        
        // Corrected: Use 'total_amount' from the schema for calculations
        const totalSales = deliveredOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        
        const customerCount = await User.countDocuments();
        const orderCount = await Order.countDocuments();

        // Corrected: Populate user_id and product_id for recent orders
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(3)
            .populate('user_id', 'firstname lastname')
            .populate({
                path: 'products.product_id',
                select: 'title colorVariants'
            })
            .lean();

        // NOTE: Your product schema does not have a 'sold' field.
        // This logic is a placeholder. In a real app, you would
        // need to add a 'sold' field or run an aggregation to find best sellers.
        const bestSelling = await Product.find()
            .sort({ title: 1 }) // Placeholder sort since 'sold' is not in schema
            .limit(3)
            .lean();
        
        // Render the dashboard with the corrected data
        res.render('admin/dashboard', {
            totalSales: totalSales.toFixed(2), // Format the total
            customerCount,
            orderCount,
            recentOrders,
            bestSelling,
            layout: false
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Internal Server Error');
    }
};


