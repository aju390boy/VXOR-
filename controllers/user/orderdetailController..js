const Order = require('../../model/order');


exports.getOrderDetail = async (req, res) => {
    try {
        // Get the orderId from the query object instead of params
        const orderId = req.query.order_id;

        // Check if the orderId was provided in the query string
        if (!orderId) {
            return res.status(400).render('user/400', { message: 'Order ID is missing.' });
        }

        // Find the order by its ID and populate the related data
        const order = await Order.findById(orderId)
            .populate({
                path: 'products.product_id',
                select: 'title colorVariants'
            })
            .populate('address_id');

        // Check if the order exists
        if (!order) {
            return res.status(404).render('user/404', { message: 'Order not found.' });
        }

        // Render the order detail page, passing the full order object
        res.render('user/sample', { order });
        
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('user/error', { message: 'Failed to retrieve order details.' });
    }
};
