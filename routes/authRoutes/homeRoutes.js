const express = require('express');
const router = express.Router();

router.get('/',(req,res)=>{
    res.redirect('/user/home')
})


module.exports = router;
