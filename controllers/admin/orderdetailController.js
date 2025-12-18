const Order = require("../../model/order.js");
const User = require("../../model/user.js");
const Product = require("../../model/product.js");
const Wallet = require("../../model/wallet.js");
const mongoose = require("mongoose");

exports.getSingleOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const TAX_RATE = 0.05; 

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is missing." });
    }

    const order = await Order.findOne({ _id: orderId })
      .populate("user_id", "firstname lastname email")
      .populate("address_id")
      .populate({
        path: "products.product_id",
        select: "title colorVariants isDeleted",
      })
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    
    let subtotal = 0;
    const items = order.products.map((productItem) => {
      const product = productItem.product_id;
      let imageUrl = "https://via.placeholder.com/96";

      const colorVariant = product?.colorVariants?.find((c) => c.colorName === productItem.colorName);
      if (colorVariant && colorVariant.images.length > 0) {
        const firstImage = colorVariant.images[0];
        imageUrl = firstImage.startsWith("http")
          ? firstImage
          : `/uploads/products/${firstImage}`;
      }

      const itemPrice = productItem.price * productItem.quantity;
      subtotal += itemPrice;

      return {
        ...productItem,
        title: product?.title || "Product Not Found",
        image: imageUrl,
        color: productItem.colorName,
        size: productItem.size,
      };
    });

    const tax = subtotal * TAX_RATE;
    const shippingCost = 0; // Assuming free shipping for now
    const total = subtotal + tax + shippingCost;

    const orderDataForEJS = {
      ...order,
      products: items,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      shippingCost: shippingCost.toFixed(2),
      total: total.toFixed(2),
      payment_status: order.payment_status,
    };

    console.log(`overall status : ${order.overallStatus}`);
    console.log(`payment status : ${order.payment_status}`);
    res.render("admin/orderDetail", { order: orderDataForEJS, layout: false });
  } catch (err) {
    console.error("Error fetching single order:", err);
    res.status(500).json({ message: "Failed to fetch order details." });
  }
};

exports.updateProductStatus = async (req, res) => {
    // We'll use Mongoose transactions to ensure atomicity for complex operations
    const session = await Order.startSession();
    try {
        session.startTransaction();

        const { orderId, productId } = req.params;
        const { status: newStatus } = req.body; // Use alias for clarity

        const order = await Order.findById(orderId).session(session);
        if (!order) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Order not found" });
        }
        

        const item = order.products.id(productId);
        if (!item) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Product item not found" });
        }
        
        const currentStatus = item.status;
        const userId = order.user_id;
        const totalItems = order.products.length;

        // --- 4. Check for Same Status Update ---
        if (currentStatus === newStatus) {
            await session.abortTransaction();
            return res.status(400).json({ message: `Product is already in status: ${currentStatus}` });
        }

        // --- 1. & 6. Validation for Final/Restricted States ---
        const finalStates = ["CANCELLED", "RETURNED"];
        if (finalStates.includes(currentStatus)) {
            // Check if the item is already CANCELLED or RETURNED (Requirement 1)
            // Or if it's already RETURN REQUESTED and trying to update to RETURNED (Requirement 6)
            if (currentStatus === "CANCELLED" || currentStatus === "RETURNED") {
                await session.abortTransaction();
                return res.status(400).json({ 
                    message: `The product is already ${currentStatus}.` 
                });
            }
        }
        
        // Specific restriction for RETURNED (Requirement 6)
        const invalidReturnFrom = ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "CANCELLED", "CANCELLATION REQUESTED"];
        if (newStatus === "RETURNED" && invalidReturnFrom.includes(currentStatus)) {
            await session.abortTransaction();
            return res.status(400).json({ 
                message: `Cannot update to RETURNED from current status: ${currentStatus}.` 
            });
        }
        
        // Specific restriction for CANCELLED (Requirement 5)
        const invalidCancelFrom = ["RETURN REQUESTED", "RETURNED","DELIVERED"];
        if (newStatus === "CANCELLED" && invalidCancelFrom.includes(currentStatus)) {
            await session.abortTransaction();
            return res.status(400).json({ 
                message: `Cannot update to CANCELLED from current status: ${currentStatus}.` 
            });
        }

        // --- 2. Enforcing One-Way Progression (Forward Flow) ---
        const invalidTransitions = {
            'CONFIRMED': ['PENDING'], 
            'PROCESSING': ['PENDING', 'CONFIRMED'],
            'PACKED': ['PENDING', 'CONFIRMED', 'PROCESSING'], 
            'SHIPPED': ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED'],
            'DELIVERED': ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED'],
        };
        const isInvalidBackward = invalidTransitions[currentStatus] && invalidTransitions[currentStatus].includes(newStatus);
        if (isInvalidBackward) {
            await session.abortTransaction();
            return res.status(400).json({ 
                message: `Cannot go from ${currentStatus} back to ${newStatus}.` 
            });
        }


       const forwardStatuses = ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"];
        // FIX 1: Correct the logical OR operator usage
        if (forwardStatuses.includes(newStatus) && currentStatus === "PENDING") {
            // Assuming order.payment_status field exists and indicates overall payment status.
            if (order.payment_status !== "COMPLETED") {
                await session.abortTransaction();
                return res.status(400).json({ 
                    message: `Payment status is ${order.payment_status}, not yet COMPLETED. Cannot move to ${newStatus}.` 
                });
            }
        }
        



        let refundAmount = 0; // Initialize refund amount
        let needsRefund = false;
        let needsStockIncrement = false;

        // --- 5. Handling CANCELLED Status (Refund & Stock Increment) ---
        const cancellableStatuses = ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED"];
        if (newStatus === "CANCELLED" && cancellableStatuses.includes(currentStatus)) {
            needsRefund = true;
            needsStockIncrement = true;
        }

        // --- 6. Handling RETURNED Status (Refund & Stock Increment) ---
        const returnableStatuses = ["DELIVERED", "RETURN REQUESTED"];
        if (newStatus === "RETURNED" && returnableStatuses.includes(currentStatus)) {
            needsRefund = true;
            needsStockIncrement = true;
        }
        
        if (needsRefund) {
             // Calculate the refund amount for this product item
             const itemTax = (order.tax || 0) / totalItems;
             const itemCoupon = (order.coupon_discount || 0) / totalItems;
             const itemOffer = (order.offer_discount || 0) / totalItems;
             
             // The refund formula: (Item Price) + (Prorated Tax) - (Prorated Coupon) - (Prorated Offer)
             refundAmount = (item.price * item.quantity) + (itemTax * item.quantity) - (itemCoupon * item.quantity) - (itemOffer * item.quantity);

             // Perform the refund
             await refundToWallet(
                 userId, 
                 refundAmount, 
                 order.order_id, 
                 `Refund for ${newStatus} product`
             );
        }
        
        if (needsStockIncrement) {
             // Increase product stock quantity
             await incrementProductQuantity(
                 item.product_id,
                 item.colorName,
                 item.size,
                 item.quantity
             );
        }

        // --- Final Update and Save ---
        item.status = newStatus;

        // *** NEW LOGIC: Check if all items are finalized (CANCELLED or RETURNED) ***
        const allItemsFinalized = order.products.every(p => {
            // Check the current item's new status if it's the one we're updating
            const statusToCheck = (p._id.toString() === productId) ? newStatus : p.status;
            return finalStates.includes(statusToCheck);
        });
        
        if (allItemsFinalized && order.payment_status !== "REFUNDED") {
            order.payment_status = "REFUNDED";
        }
        await order.save({ session }); // Pass the session to the save method

        await session.commitTransaction(); // Commit all changes if successful

        res.json({ message: "Product status updated successfully" });

    } catch (err) {
        await session.abortTransaction(); // Rollback all changes if an error occurred
        console.error(err);
        res.status(500).json({ 
            message: err.message || "Failed to update status due to an internal error." 
        });
    } finally {
        session.endSession();
    }
};

// Update product item expected delivery
exports.updateProductExpectedDelivery = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const { expectedDelivery } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    const item = order.products.id(productId);
    if (!item)
      return res.status(404).json({ message: "Product item not found" });
    item.expected_delivery = expectedDelivery
      ? new Date(expectedDelivery)
      : null;
    await order.save();
    res.json({ message: "Expected delivery updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update expected delivery" });
  }
};

// Handle approval/rejection of entire order cancellation/return
exports.handleOrderRequestAction = async (req, res) => {
  console.log('starting..................');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId } = req.params;
    const { action } = req.body;
    console.log(`order id : ${orderId}`);
    console.log(`action : ${action}`);
    const order = await Order.findById(orderId)
      .populate("user_id")
      .session(session);

    if (!order) {
      console.log('no order')
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Order not found" });
    }

    const userId = order.user_id._id;

    async function refundToWallet(userId, amount, orderId, description) {
      let wallet = await Wallet.findOne({ user_id: userId }).session(session);
      if (!wallet)
        wallet = new Wallet({ user_id: userId, balance: 0, transactions: [] });
      wallet.balance += amount;
      wallet.transactions.push({
        amount,
        type: "credit",
        description,
        orderId,
      });
      await wallet.save({ session });
    }

    if (action === "approve") {
      console.log('cheruthayit und.................')
      if (
        order.order_cancellation_reason?.reason &&
        !order.order_return_reason?.reason
      ) {
        console.log('uns.........................')
        // Cancellation logic
        const allDelivered = order.products.every(
          (p) => p.status === "DELIVERED"
        );
        const refundAmountForCancellation = order.total_amount;
        console.log(`total amount :${order.total_amount}`);

        if (order.payment_method === "COD") {
          for (const p of order.products) {
            if (p.status === "CANCELLATION REQUESTED") {
              p.status = "CANCELLED";
              await incrementProductQuantity(
                p.product_id,
                p.colorName,
                p.size,
                p.quantity
              );
            }
          }
          order.markModified("products");
          if (allDelivered && order.payment_status === "COMPLETED") {
            await refundToWallet(
              userId,
              refundAmountForCancellation,
              orderId,
              "Refund for cancelled order"
            );
            order.payment_status = "REFUNDED";
          }
          order.order_cancellation_reason = null;
        } else if (["WALLET", "razorpay"].includes(order.payment_method)) {
          console.log("wallet or online........................")
          if (order.payment_status === "COMPLETED") {
            await refundToWallet(
              userId,
              refundAmountForCancellation,
              orderId,
              "Refund for cancelled order"
            );
            order.payment_status = "REFUNDED";
          }
          for (const p of order.products) {
            if (p.status === "CANCELLATION REQUESTED") {
              p.status = "CANCELLED";
              await incrementProductQuantity(
                p.product_id,
                p.colorName,
                p.size,
                p.quantity
              );
            }
          }
          order.markModified("products");
          order.order_cancellation_reason = null;
        }
      } else if (
        order.order_return_reason?.reason &&
        !order.order_cancellation_reason?.reason
      ) {
        console.log('sherikkum und')
        // Return logic
        const allDelivered = order.products.every(
          (p) => p.status === "DELIVERED"
        );
        const refundAmountForReturn = order.total_amount;
        console.log(`total amount :${order.total_amount}`);
        if (order.payment_method === "COD") {
          for (const p of order.products) {
            if (p.status === "RETURN REQUESTED") {
              p.status = "RETURNED";
              await incrementProductQuantity(
                p.product_id,
                p.colorName,
                p.size,
                p.quantity
              );
            }
          }
          order.markModified("products");
          if (allDelivered && order.payment_status === "COMPLETED") {
            await refundToWallet(
              userId,
              refundAmountForReturn,
              orderId,
              "Refund for returned order"
            );
            order.payment_status = "REFUNDED";
          }
          order.order_return_reason = null;
        } else if (["WALLET", "razorpay"].includes(order.payment_method)) {
          if (order.payment_status === "COMPLETED") {
            await refundToWallet(
              userId,
              refundAmountForReturn,
              orderId,
              "Refund for returned order"
            );
            order.payment_status = "REFUNDED";
          }
          for (const p of order.products) {
            if (p.status === "RETURN REQUESTED") {
              p.status = "RETURNED";
              await incrementProductQuantity(
                p.product_id,
                p.colorName,
                p.size,
                p.quantity
              );
            }
          }
          order.markModified("products");
          order.order_return_reason = null;
        }
      } else {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ message: "No valid cancellation or return request found" });
      }
    } else if (action === "reject") {
      order.order_cancellation_reason = null;
      order.order_return_reason = null;
      for (const p of order.products) {
        if (p.status === "CANCELLATION REQUESTED") {
          p.status = p.prev_status || "CONFIRMED";
          p.cancellation_reason = null;
        }
        if (p.status === "RETURN REQUESTED") {
          p.status = p.prev_status || "DELIVERED";
          p.return_reason = null;
        }
      }
      order.markModified("products");
    } else {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid action" });
    }
    order.concern = "NONE";
    await order.save({ session });
    await session.commitTransaction();
    session.endSession();
    res.json({ message: `Order request ${action}ed successfully` });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error in handleOrderRequestAction:", err);
    res.status(500).json({ message: "Failed to process order request" });
  }
};
// Handle approval/rejection of product item cancellation/return
exports.handleProductRequestAction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId, productId } = req.params;
    const { action } = req.body;
    const order = await Order.findById(orderId)
      .populate("user_id")
      .session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Order not found" });
    }
    const userId = order.user_id?._id;
    const item = order.products.id(productId);
    if (!item) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Product item not found" });
    }
    const totalItems = order.products.length;

// Split and distribute common charges
const itemTax = (order.tax || 0) / totalItems;
const itemCoupon = (order.coupon_discount || 0) / totalItems;
const itemOffer = (order.offer_discount || 0) / totalItems;
// Per-unit refund
const perUnitRefund = (item.price || 0) + itemTax - itemCoupon - itemOffer;
console.log(`per item refund : ${perUnitRefund}`)

// Final refund for this line item (respect quantity)
const refundAmount = perUnitRefund * (item.quantity || 1);
console.log(`refund : ${refundAmount}`)
    const prevStatus = item.prev_status || "CONFIRMED";
    //////approve/////////
    if (action === "approve") {
      if (item.status === "CANCELLATION REQUESTED") {
        await incrementProductQuantity(
          item.product_id,
          item.colorName,
          item.size,
          item.quantity
        );
        // if(order.products.length===1){
        //   order.payment_status='REFUNDED';
        // }
        item.status = "CANCELLED";
        item.cancellation_reason = null;
        item.prev_status = null;

         const allStats=order.products.every((p)=>p.status==='CANCELLED');
         if(allStats){
          order.payment_status='REFUNDED';
         }

        if (["WALLET", "razorpay"].includes(order.payment_method)) {
          if (refundAmount > 0) {
            await refundToWallet(
              userId,
              refundAmount,
              orderId,
              "Refund for cancelled product"
            );
          }
        //    if(order.products.length===1){
        //   order.payment_status='REFUNDED';
        // }
        }
        if(item.status==='COMPLETED'){
           if (refundAmount > 0) {
            await refundToWallet(
              userId,
              refundAmount,
              orderId,
              "Refund for cancelled product"
            );
          }
        }
      } else if (item.status === "RETURN REQUESTED") {
        await incrementProductQuantity(
          item.product_id,
          item.colorName,
          item.size,
          item.quantity
        );
        //  if(order.products.length===1){
        //   order.payment_status='REFUNDED';
        // }
        item.status = "RETURNED";
        item.return_reason = null;
        item.prev_status = null;

        const allStats=order.products.every((p)=>p.status==='RETURNED');
         if(allStats){
          order.payment_status='REFUNDED';
         }
        if (["WALLET", "razorpay", "COD"].includes(order.payment_method)) {
          if (refundAmount > 0) {
            await refundToWallet(
              userId,
              refundAmount,
              orderId,
              "Refund for returned product"
            );
          }
        }
        if(item.status==='COMPLETED'){
           if (refundAmount > 0) {
            await refundToWallet(
              userId,
              refundAmount,
              orderId,
              "Refund for returned product"
            );
          }
        }
      } else {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ message: "No valid cancellation or return request found" });
      }
    } else if (action === "reject") {
      if (item.status === "CANCELLATION REQUESTED") {
        item.cancellation_reason = null;
        item.status = prevStatus;
        item.prev_status = null;
      } else if (item.status === "RETURN REQUESTED") {
        item.return_reason = null;
        item.status = prevStatus;
        item.prev_status = null;
      } else {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: "No valid cancellation or return request found to reject",
        });
      }
    } else {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid action" });
    }
    order.concern = "NONE";
    await order.save({ session });
    await session.commitTransaction();
    session.endSession();
    res.json({ message: `Product request ${action}ed successfully` });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error in handleProductRequestAction:", err);
    res.status(500).json({ message: "Failed to process product request" });
  }
};

////increment quantity/////////
async function incrementProductQuantity(
  productId,
  colorName,
  size,
  quantityToAdd
) {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }
    const colorVariant = product.colorVariants.find(
      (cv) => cv.colorName === colorName
    );
    if (!colorVariant) {
      throw new Error("Color variant not found");
    }
    const sizeVariant = colorVariant.variants.find(
      (variant) => variant.size === size
    );
    if (!sizeVariant) {
      throw new Error("Size variant not found");
    }
    sizeVariant.stock += quantityToAdd;
    await product.save();
  } catch (err) {
    console.error("Error incrementing product quantity:", err);
    throw err;
  }
}

/////refund wallet///////
async function refundToWallet(userId, amount, orderId, description) {
  console.log('refund hitted................')
  let wallet = await Wallet.findOne({ user_id: userId });
  if (!wallet)
    wallet = new Wallet({ user_id: userId, balance: 0, transactions: [] });
  wallet.balance += amount;
  wallet.transactions.push({ amount, type: "credit", description, orderId });
  await wallet.save();
}
