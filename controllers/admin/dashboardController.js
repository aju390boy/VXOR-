const Order = require('../../model/order.js'); 
const User = require('../../model/user.js');
const Product = require('../../model/product.js');

exports.getDashboard = async (req, res) => {
  try {
    // Total Sales
    const orders = await Order.find({ status: 'Delivered' });
    const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Customers Count
    const customerCount = await User.countDocuments();

    // Orders Count
    const orderCount = await Order.countDocuments();

    // Recent Orders (limit 3)
    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(3);

    // Best Selling Products
    const bestSelling = await Product.find().sort({ sold: -1 }).limit(3); // assuming 'sold' field is there

    

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

exports.logoutUser = (req, res) => {
  req.logout(err => {
    if (err) {
      console.error('Logout Error:', err);
      return res.status(500).send('Logout Failed');
    }

    req.session.destroy(err => {
      if (err) {
        console.error('Session Destroy Error:', err);
        return res.status(500).send('Could not end session');
      }

      res.clearCookie('connect.sid'); // Optional: clear session cookie
      res.redirect('/login'); // Back to login page
    });
  });
};
