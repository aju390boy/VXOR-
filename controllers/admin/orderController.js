const Order  = require('../../model/order.js')
const User = require('../../model/user.js')
const Product = require('../../model/product.js')
const mongoose = require('mongoose')


exports.renderOrdersPage = async (req, res) => {
    try {
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('user_id', 'firstname lastname email')
            .lean();

        res.render('admin/orders', {
            orders: orders.map(order => ({
                ...order,
                // Check if user_id exists after populate. If not, provide fallback data.
                user: order.user_id ? { 
                    name: `${order.user_id.firstname} ${order.user_id.lastname}`,
                    email: order.user_id.email
                } : {
                    name: 'Deleted User',
                    email: 'N/A'
                },
                
                // Use the custom order_id for display
                orderId: order.order_id,
                
                // For backward compatibility if you still use ._id somewhere
                _id: order._id 
            })),
            layout: false
        });
    } catch (err) {
        console.error('Error rendering admin orders page:', err);
        res.status(500).send('Server Error');
    }
};


exports.getOrders = async (req, res) => {
    const { page = 1, limit = 10, search, status, sort } = req.query;

    let query = {};
    const conditions = []; // We will build our query conditions here

    // 1. Handle the status filter correctly
    if (status) {
        conditions.push({ products: { $elemMatch: { status: status } } });
    }

    // 2. Handle the search filter correctly and efficiently
    if (search) {
        const searchRegex = { $regex: search, $options: 'i' };
        const orConditions = [];

        // Search by custom order_id
        orConditions.push({ order_id: searchRegex });

        // Search by internal MongoDB _id if the search term is a valid ObjectId
        if (mongoose.isValidObjectId(search)) {
            orConditions.push({ _id: search });
        }

        // Find users that match the search term
        const matchingUsers = await User.find({
            $or: [{ firstname: searchRegex }, { lastname: searchRegex }, { email: searchRegex }]
        }).select('_id').lean();

        if (matchingUsers.length > 0) {
            const userIds = matchingUsers.map(u => u._id);
            orConditions.push({ user_id: { $in: userIds } });
        }
        
        // If 'orConditions' has any criteria, add it to the main conditions array
        if (orConditions.length > 0) {
            conditions.push({ $or: orConditions });
        } else {
            // If the search term found no potential users or valid IDs, return no results immediately.
             return res.status(200).json({ orders: [], total: 0 });
        }
    }

    // 3. Combine all conditions into the final query object
    if (conditions.length > 0) {
        query = { $and: conditions };
    }

    const sortOptions = { createdAt: sort === 'date-asc' ? 1 : -1 };

    try {
        const orders = await Order.find(query)
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('user_id', 'firstname lastname email')
            .lean();
            
        const totalOrders = await Order.countDocuments(query);

        // 4. Map the response correctly, with safety checks and required fields
        res.status(200).json({
            orders: orders.map(order => ({
                ...order,
                displayStatus: order.products.length > 0 ? order.products[0].status : 'N/A',
                user: order.user_id 
                    ? { name: `${order.user_id.firstname} ${order.user_id.lastname}`, email: order.user_id.email } 
                    : { name: 'Deleted User', email: 'N/A' },
                orderId: order.order_id, // Send the correct custom ID
                _id: order._id // Keep the internal ID for actions like updates
            })),
            total: totalOrders
        });
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ message: 'Failed to fetch orders.' });
    }
};

exports.updateOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

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
            break;
    }

    // This object holds all the fields to be updated.
    const updateObject = {
        // CORRECT: Target the status field in all elements of the products array.
        'products.$[].status': status
    };

    if (newPaymentStatus) {
        updateObject.payment_status = newPaymentStatus;
    }

    try {
        const order = await Order.findOneAndUpdate(
            { _id: orderId },
            { $set: updateObject },
            { new: true, runValidators: true } // 'new: true' returns the updated document
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
