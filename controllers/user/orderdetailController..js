const Order = require('../../model/order');


exports.getOrderDetail = async (req, res) => {
    try {
        
        const orderId = req.query.order_id;

       
        if (!orderId) {
            return res.status(400).render('user/400', { message: 'Order ID is missing.' });
        }

       
        const order = await Order.findById(orderId)
            .populate({
                path: 'products.product_id',
                select: 'title colorVariants'
            })
            .populate('address_id');

     
        if (!order) {
            return res.status(404).render('user/404', { message: 'Order not found.' });
        }

        
        res.render('user/sample', { order });
        
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('user/error', { message: 'Failed to retrieve order details.' });
    }
};
