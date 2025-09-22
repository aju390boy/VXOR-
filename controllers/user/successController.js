const Order = require('../../model/order.js');

exports.getSuccess = (req, res) => {
    try {
        const { orderId,customId,id } = req.query;
        console.log(orderId,customId);
        if (!orderId) {
            return res.redirect('/user/profile?section=orders');
        }
        let paymentMethod=true;
        res.render('user/success', {
            orderId,
            customId,
            id,
            paymentMethod,
            title: 'Order Successful'
        });
    } catch (error) {
        console.error("Error on success page:", error);
        res.redirect('/');
    }
};
exports.getFailure = (req,res) =>{
   try{
      const {orderId,customId} = req.query;
      console.log(`failure page custom  id : ${customId}`);
      if(!orderId){
         return res.redirect('/user/profile?section=orders');
      }
      res.render('user/failure',{
         orderId,
         customId,
         title:'Order Failure'
      })

   }catch(err){
      console.log(err)
   }
}

exports.handleFailedOrder = async (req, res) => {
    try {
        const { dbOrderId } = req.body;
        await Order.updateOne(  { _id: dbOrderId }, {$set: {  payment_status: 'FAILED','products.$[].status': 'PENDING'}});
        res.json({ success: true });
    } catch (error) {
        console.error("Error handling failed order:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};