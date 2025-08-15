const Order  = require('../../model/order.js')
const User = require('../../model/user.js')


exports.renderOrdersPage = async (req, res) => {
    try {
        const orders = await Order.find()
            .sort({ createdAt: -1 }) // Use 'createdAt' from timestamps for sorting
            .limit(10)
            .populate('user_id', 'firstname lastname email') // Correct field name to 'user_id'
            .lean();

        res.render('admin/orders', {
            orders: orders.map(order => ({
                ...order,
                user: { // Flatten the user object for easier EJS access
                    name: `${order.user_id.firstname} ${order.user_id.lastname}`,
                    email: order.user_id.email
                },
                // Use the order's ID as the orderId for the EJS template
                orderId: order._id ,
                
            })),
            layout:false
        });
    } catch (err) {
        console.error('Error rendering admin orders page:', err);
        res.status(500).send('Server Error');
    }
};

/**
 * @desc Fetches a paginated, sorted, and filtered list of orders for the API.
 * @route GET /admin/api/orders
 * @access Private (Admin only)
 */
exports.getOrders = async (req, res) => {
    const { page = 1, limit = 10, search, status, sort } = req.query;

    const query = {};
    if (status) {
        // Use 'payment_status' to filter
        query.payment_status = status;
    }
    if (search) {
        // Search by User name/email
        const userSearch = await User.find({
            $or: [
                { firstname: { $regex: search, $options: 'i' } },
                { lastname: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ]
        }).select('_id');
        
        // Search by Order ID (_id) or User ID
        query.$or = [
            { _id: { $regex: search, $options: 'i' } },
            { user_id: { $in: userSearch.map(user => user._id) } }
        ];
    }
    
    const sortOptions = {};
    // Use 'createdAt' for sorting by date
    if (sort === 'date-asc') {
        sortOptions.createdAt = 1;
    } else {
        sortOptions.createdAt = -1; // Default to newest first
    }

    try {
        const orders = await Order.find(query)
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('user_id', 'firstname lastname email') // Correct field name to 'user_id'
            .lean();
            
        const totalOrders = await Order.countDocuments(query);

        res.status(200).json({
            orders: orders.map(order => ({
                ...order,
                user: {
                    name: `${order.user_id.firstname} ${order.user_id.lastname}`,
                    email: order.user_id.email
                },
                // Use the order's ID as the orderId for the EJS template
                orderId: order._id 
            })),
            total: totalOrders
        });

    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ message: 'Failed to fetch orders.' });
    }
};

/**
 * @desc Updates the status of a single order.
 * @route PATCH /admin/api/orders/:orderId/status
 * @access Private (Admin only)
 */
exports.updateOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    // Use 'payment_status' to update the correct field
    const { payment_status } = req.body;
    
    try {
        const order = await Order.findOneAndUpdate(
            // Use _id for the query
            { _id: orderId },
            { $set: { payment_status: payment_status } },
            { new: true, runValidators: true }
        );

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        res.status(200).json({ message: 'Order status updated successfully.', order });
    } catch (err) {
        console.error('Error updating order status:', err);
        res.status(500).json({ message: 'Failed to update order status.' });
    }
};

/**
 * @desc Get details of a single order.
 * @route GET /admin/api/orders/:orderId
 * @access Private (Admin only)
 */
exports.getSingleOrder = async (req, res) => {
    const { orderId } = req.params;

    try {
        const order = await Order.findById(orderId)
            .populate('user_id', 'firstname lastname email')
            .populate({
                path: 'products.product_id',
                select: 'title colorVariants'
            })
            .lean();

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        res.status(200).json(order);
    } catch (err) {
        console.error('Error fetching single order:', err);
        res.status(500).json({ message: 'Failed to fetch order details.' });
    }
};
