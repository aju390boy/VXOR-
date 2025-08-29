const Order = require('../../model/order.js'); 
const User = require('../../model/user.js');
const Product = require('../../model/product.js');

exports.getDashboard = async (req, res) => {
    try {
        // --- Existing Calculations ---
        const totalSalesResult = await Order.aggregate([
            { $match: { payment_status: 'COMPLETED' } },
            { $group: { _id: null, totalSales: { $sum: '$total_amount' } } }
        ]);
        const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;

        const orderCount = await Order.countDocuments();
        const customerCount = await User.countDocuments({ role: 'user' });

        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user_id', 'firstname lastname');
        
        // This is a simplified query. A real-world scenario would be more complex.
        const bestSelling = await Product.find({ isDeleted: false })
             .sort({ /* Logic to determine best-selling needed here */ })
             .limit(5);

        // --- NEW: Data for Sales Chart ---
        const salesDataForChart = [];
        let maxSales = 0; // To calculate bar height percentage

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            
            const startOfDay = new Date(date.setHours(0, 0, 0, 0));
            const endOfDay = new Date(date.setHours(23, 59, 59, 999));

            const dailySale = await Order.aggregate([
                { $match: { 
                    payment_status: 'COMPLETED',
                    createdAt: { $gte: startOfDay, $lte: endOfDay } 
                }},
                { $group: { _id: null, total: { $sum: '$total_amount' } } }
            ]);
            
            const total = dailySale.length > 0 ? dailySale[0].total : 0;
            if (total > maxSales) maxSales = total;

            salesDataForChart.push({
                day: startOfDay.toLocaleString('en-US', { weekday: 'short' }),
                sales: total
            });
        }
        
        // Ensure maxSales is not zero to avoid division by zero
        if (maxSales === 0) maxSales = 1;

        // --- Render Page with All Data ---
        res.render('admin/dashboard', {
            totalSales,
            orderCount,
            customerCount,
            recentOrders,
            bestSelling,
            salesDataForChart,
            maxSales,
            layout:false
        });

    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).send('Server Error');
    }
};


