const Order = require('../../model/order.js'); 
const User = require('../../model/user.js');
const Product = require('../../model/product.js');

exports.getDashboard = async (req, res) => {
    try {
        const totalSalesResult = await Order.aggregate([
            { $match: { payment_status: 'COMPLETED' } },
            { $group: { _id: null, totalSales: { $sum: '$total_amount' } } }
        ]);
        const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;
        const orderCount = await Order.countDocuments();
        const customerCount = await User.countDocuments({ role: 'user' });
        const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5).populate('user_id', 'firstname lastname');
        const bestSelling = await Product.find({ isDeleted: false }).limit(5);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        const dailySales = await Order.aggregate([
            { $match: { 
                payment_status: 'COMPLETED',
                createdAt: { $gte: sevenDaysAgo } 
            }},
            { $group: {
                _id: { $dateToString: { 
                    format: "%Y-%m-%d", 
                    date: "$createdAt",
                    timezone: "+05:30" 
                }},
                total: { $sum: '$total_amount' }
            }},
            { $sort: { _id: 1 } }
        ]);
        const salesDataMap = new Map(dailySales.map(d => [d._id, d.total]));
        const salesDataForChart = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            
            const sales = salesDataMap.get(dateString) || 0;
            salesDataForChart.push({
                day: date.toLocaleString('en-US', { weekday: 'short' }),
                sales: sales
            });
        }
        const maxSales = Math.max(...salesDataForChart.map(d => d.sales), 1);
        res.render('admin/dashboard', {
            totalSales,
            orderCount,
            customerCount,
            recentOrders,
            bestSelling,
            salesDataForChart,
            maxSales,
            layout: false
        });

    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).send('Server Error');
    }
};


