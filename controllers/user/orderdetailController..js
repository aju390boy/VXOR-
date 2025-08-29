const Order = require('../../model/order');
const PDFDocument = require('pdfkit');


exports.getOrderDetail = async (req, res) => {
    try {
        const orderId = req.query.order_id;
        const userId = req.user._id;

        if (!orderId) {
            return res.status(400).render('user/400', { message: 'Order ID is missing.' });
        }

        // Updated for efficiency: query by both _id and user_id
        const order = await Order.findOne({ _id: orderId, user_id: userId })
            .select('order_id total_amount payment_status address_id products createdAt') // Explicitly select all required fields
            .populate({
                path: 'products.product_id',
                select: 'title colorVariants'
            })
            .populate('address_id');

        // The check is now much simpler and cleaner
        if (!order) {
            return res.status(404).render('user/404', { message: 'Order not found or does not belong to this user.' });
        }
        
        res.render('user/orderDetail', { order });
        
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('user/error', { message: 'Failed to retrieve order details.' });
    }
};


exports.cancelItem = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;
        const userId = req.user._id;

        const order = await Order.findOne({ _id: orderId, user_id: userId });

        if (!order) {
            return res.status(404).json({ message: 'Order not found or does not belong to this user.' });
        }

        const itemToUpdate = order.products.id(itemId);
        if (!itemToUpdate) {
            return res.status(404).json({ message: 'Item not found in this order.' });
        }

        // Corrected logic: Check if the status is one of the allowed statuses for cancellation
        if (['PROCESSING', 'PACKED', 'SHIPPED'].includes(itemToUpdate.status)) {
            // Update the item's status and reason
            itemToUpdate.status = 'CANCELLATION REQUESTED';
            itemToUpdate.cancellation_reason = reason;
            
            // Do not recalculate total amount here, as the cancellation is pending admin approval
            
            await order.save();
            return res.status(200).json({ message: 'Cancellation request submitted successfully.' });
        } else {
            return res.status(400).json({ message: `Item cannot be cancelled in status: ${itemToUpdate.status}` });
        }

    } catch (error) {
        console.error('Error canceling item:', error);
        res.status(500).json({ message: 'Server error occurred during cancellation.' });
    }
};
// Function to handle return requests
exports.returnItem = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;
        const userId = req.user._id;

        const order = await Order.findOne({ _id: orderId, user_id: userId });

        if (!order) {
            return res.status(404).json({ message: 'Order not found or does not belong to this user.' });
        }

        const itemToUpdate = order.products.id(itemId);
        if (!itemToUpdate) {
            return res.status(404).json({ message: 'Item not found in this order.' });
        }

        // Corrected logic: Check if the status is 'DELIVERED'
        if (itemToUpdate.status === 'DELIVERED') {
            // Update the item's status and reason
            itemToUpdate.status = 'RETURN REQUESTED';
            itemToUpdate.return_reason = reason;
            
            // Update the main order's payment status to 'PROCESSING' for admin review
            order.payment_status = 'PROCESSING';

            await order.save();
            return res.status(200).json({ message: 'Return request submitted successfully.' });
        } else {
            return res.status(400).json({ message: `Item cannot be returned in status: ${itemToUpdate.status}` });
        }
    } catch (error) {
        console.error('Error submitting return request:', error);
        res.status(500).json({ message: 'Server error occurred during return request.' });
    }
};


// Function for downloading invoice (simple example)
exports.downloadInvoice = async (req, res) => {
    try {
        const orderId = req.query.orderId;
        const userId = req.user._id;
        const TAX_RATE = 0.05;

        if (!orderId) {
            return res.status(400).send('Order ID is missing.');
        }

        const order = await Order.findOne({ order_id: orderId, user_id: userId })
            .populate('products.product_id')
            .populate('address_id')
            .lean();

        if (!order) {
            return res.status(404).send('Order not found or does not belong to this user.');
        }

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        doc.pipe(res);

        // Header
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice_${order.order_id}.pdf"`);

        doc.fontSize(20).text('Order Invoice', { align: 'center' });
        doc.moveDown();

        // Order Details & Invoice Info
        doc.fontSize(12).text(`Order Number: ${order.order_id}`);
        doc.text(`Invoice Date: ${new Date().toLocaleDateString()}`);
        doc.text(`Payment Status: ${order.payment_status}`);
        doc.text(`Payment Method: COD`); // Assuming a default for now
        doc.moveDown();

        // Shipping Address
        doc.fontSize(14).text('Shipping Address', { underline: true });
        const address = order.address_id;
        if (address) {
            doc.text(`${address.name}`);
            doc.text(`${address.address1}, ${address.address2}`);
            doc.text(`${address.city}, ${address.state}`);
            doc.text(`${address.pincode}`);
            doc.text(`Mobile: ${address.mobile}`); // Corrected: Using 'mobile' from the schema
        }
        doc.moveDown();

        // Items Table Header
        const tableTop = doc.y;
        const itemX = 50;
        const qtyX = 300;
        const priceX = 370;
        const totalX = 450;
        const totalWidth = 500;

        doc.fontSize(12).text('Items', itemX, tableTop);
        doc.text('Qty', qtyX, tableTop);
        doc.text('Price', priceX, tableTop);
        doc.text('Total', totalX, tableTop);
        doc.moveTo(itemX, tableTop + 20).lineTo(totalWidth + 50, tableTop + 20).stroke();

        // Items Table Content
        let y = tableTop + 30;
        let subtotal = 0;
        order.products.forEach(productItem => {
            const product = productItem.product_id;
            const itemTotal = productItem.quantity * productItem.price;

            if (product) {
                doc.text(product.title, itemX, y);
                doc.text(productItem.quantity, qtyX, y);
                doc.text(`₹${productItem.price.toFixed(2)}`, priceX, y);
                doc.text(`₹${itemTotal.toFixed(2)}`, totalX, y);
                subtotal += itemTotal;
                y += 20;
            }
        });
        doc.moveDown();

        // Summary
        doc.fontSize(12);
        doc.text(`Subtotal: ₹${subtotal.toFixed(2)}`, totalX);

        // Recalculate tax and total on the server for security
        const tax = subtotal * TAX_RATE;
        const total = subtotal + tax - (order.coupon_id ? order.coupon_id.discount : 0);
        
        doc.text(`Tax: ₹${tax.toFixed(2)}`, totalX);
        doc.text(`Shipping: ₹0.00`, totalX);
        
        if (order.coupon_id) {
            doc.text(`Discount: -₹${order.coupon_id.discount.toFixed(2)}`, totalX);
        }

        doc.moveDown();
        doc.fontSize(15).text(`Total Amount: ₹${total.toFixed(2)}`, totalX);

        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).send('Server error occurred while generating invoice.');
    }
};
