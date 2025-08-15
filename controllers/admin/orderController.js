const Order  = require('../../model/order.js')
const User = require('../../model/user.js')
const Product = require('../../model/product.js')
const mongoose = require('mongoose')


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
        query.status = status;
     }


        if (search) {
    // If the search term is a valid ObjectId, search for that exact order.
    // This is the fastest and safest way to search by ID.
    if (mongoose.isValidObjectId(search)) {
        query._id = search;
    } else {
        // If the search term is not a valid ObjectId, perform a broad search
        // on the user and product fields using a regular expression.

        const searchRegex = { $regex: search, $options: 'i' };

        // Find matching users based on name or email
        const userSearch = await User.find({
            $or: [
                { firstname: searchRegex },
                { lastname: searchRegex },
                { email: searchRegex }
            ]
        }).select('_id').lean();
        
        // Find matching products based on title
        const productSearch = await Product.find({
            title: searchRegex
        }).select('_id').lean();

        // Create an array of conditions for the combined $or query
        const orConditions = [];
        
        if (userSearch.length > 0) {
            orConditions.push({ user_id: { $in: userSearch.map(user => user._id) } });
        }
        if (productSearch.length > 0) {
            orConditions.push({ 'products.product_id': { $in: productSearch.map(product => product._id) } });
        }
        
        // If any string matches were found, apply the combined query.
        if (orConditions.length > 0) {
            query.$or = orConditions;
        } else {
            // If no users or products matched, don't return any orders.
            query._id = null;
        }
    }
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
    // The new status from the request body
    const { status } = req.body;
    
    // Determine the new payment_status based on the order's status
    let newPaymentStatus = null;
    switch (status) {
        case 'DELIVERED':
            newPaymentStatus = 'COMPLETED';
            break;
        case 'RETURNED':
            newPaymentStatus = 'REFUNDED';
            break;
        case 'CANCELLED':
            newPaymentStatus = 'FAILED';
            break;
        case 'RETURN REQUESTED':
            newPaymentStatus = 'PROCESSING';
            break;
        default:
            // For other statuses like PACKED, SHIPPED, etc., no payment status change is needed.
            break;
    }

    // Create the update object. It will always update the status, and
    // will conditionally update payment_status if it's been set.
    const updateObject = { status: status };
    if (newPaymentStatus) {
        updateObject.payment_status = newPaymentStatus;
    }
    
    try {
        const order = await Order.findOneAndUpdate(
            { _id: orderId },
            { $set: updateObject },
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
