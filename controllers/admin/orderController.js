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
                user: { 
                    name: `${order.user_id.firstname} ${order.user_id.lastname}`,
                    email: order.user_id.email
                },
            
                orderId: order._id ,
                
            })),
            layout:false
        });
    } catch (err) {
        console.error('Error rendering admin orders page:', err);
        res.status(500).send('Server Error');
    }
};


exports.getOrders = async (req, res) => {
     const { page = 1, limit = 10, search, status, sort } = req.query;

     const query = {};
     if (status) {
       
        query.status = status;
     }


        if (search) {
    
    if (mongoose.isValidObjectId(search)) {
        query._id = search;
    } else {
      

        const searchRegex = { $regex: search, $options: 'i' };

        
        const userSearch = await User.find({
            $or: [
                { firstname: searchRegex },
                { lastname: searchRegex },
                { email: searchRegex }
            ]
        }).select('_id').lean();
        
      
        const productSearch = await Product.find({
            title: searchRegex
        }).select('_id').lean();

       
        const orConditions = [];
        
        if (userSearch.length > 0) {
            orConditions.push({ user_id: { $in: userSearch.map(user => user._id) } });
        }
        if (productSearch.length > 0) {
            orConditions.push({ 'products.product_id': { $in: productSearch.map(product => product._id) } });
        }
        
       
        if (orConditions.length > 0) {
            query.$or = orConditions;
        } else {
            
            query._id = null;
        }
    }
}

    
    const sortOptions = {};
   
    if (sort === 'date-asc') {
        sortOptions.createdAt = 1;
    } else {
        sortOptions.createdAt = -1; 
    }

    try {
        const orders = await Order.find(query)
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('user_id', 'firstname lastname email')
            .lean();
            
        const totalOrders = await Order.countDocuments(query);

        res.status(200).json({
            orders: orders.map(order => ({
                ...order,
                user: {
                    name: `${order.user_id.firstname} ${order.user_id.lastname}`,
                    email: order.user_id.email
                },
              
                orderId: order._id 
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
