const Order=require('../../model/order.js');
const User=require('../../model/user.js');




exports.getSingleOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({ message: 'Order ID is missing.' });
        }

     
        const order = await Order.findById(orderId)
            
            .populate('user_id', 'firstname lastname email')
          
            .populate('address_id')
          
            .populate({
                path: 'products.product_id',
                select: 'title colorVariants' 
            })
            .lean();

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

       
        const items = order.products.map(productItem => {
            const product = productItem.product_id;
            let imageUrl = 'https://via.placeholder.com/96';
            
         
            const colorVariant = product?.colorVariants?.find(c => c.colorName === productItem.colorName);
            if (colorVariant && colorVariant.images.length > 0) {
                imageUrl = `/uploads/products/${colorVariant.images[0]}`;
            }

           
            return {
                ...productItem,
                title: product?.title || 'Product Not Found',
                image: imageUrl,
                color: productItem.colorName,
                size: productItem.size
            };
        });

       
        const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const taxRate = 0.1;
        const tax = subtotal * taxRate;
        const shippingCost = 0;
        const total = subtotal + tax + shippingCost;
        
       
        const orderDataForEJS = {
            ...order,
            products: items, 
            subtotal: subtotal.toFixed(2),
            tax: tax.toFixed(2),
            shippingCost: shippingCost.toFixed(2),
            total: total.toFixed(2)
        };

      
        res.render('admin/orderDetail', { order: orderDataForEJS ,layout:false});

    } catch (err) {
        console.error('Error fetching single order:', err);
        res.status(500).json({ message: 'Failed to fetch order details.' });
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        const updatedOrder = await Order.findOneAndUpdate(
            { _id: orderId },
            {
                $set: {
                    status: 'CANCELLED',
                    payment_status: 'FAILED',
                    request_reason: reason,
                    request_date: new Date()
                }
            },
            { new: true, runValidators: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        res.status(200).json({ message: 'Order cancelled successfully.', order: updatedOrder });
    } catch (err) {
        console.error('Error cancelling order:', err);
        res.status(500).json({ message: 'Failed to cancel order.' });
    }
};



exports.processReturnRequest = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { action } = req.body;

        let statusUpdate = {};
        if (action === 'approve') {
            statusUpdate = { status: 'RETURNED', payment_status: 'REFUNDED' };
        } else if (action === 'reject') {
            statusUpdate = { status: 'DELIVERED', payment_status: 'PAID' };
        } else {
            return res.status(400).json({ message: 'Invalid action.' });
        }

        const updatedOrder = await Order.findOneAndUpdate(
            { _id: orderId },
            { $set: statusUpdate },
            { new: true, runValidators: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        res.status(200).json({ message: `Return request ${action}d successfully.`, order: updatedOrder });
    } catch (err) {
        console.error('Error processing return request:', err);
        res.status(500).json({ message: 'Failed to process return request.' });
    }
};
