const Order = require('../../model/order.js'); 
const User = require('../../model/user.js');
const Product = require('../../model/product.js');

exports.getDashboard = async (req, res) => {
  try {
    const orders = await Order.find({ status: 'Delivered' });
    const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const customerCount = await User.countDocuments();
    const orderCount = await Order.countDocuments();
    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(3);
    const bestSelling = await Product.find().sort({ sold: -1 }).limit(3); 
    
    res.render('admin/dashboard', {
      totalSales,
      customerCount,
      orderCount,
      recentOrders,
      bestSelling,
      layout:false
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Internal Server Error');
  }
};


