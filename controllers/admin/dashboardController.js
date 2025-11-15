const Order = require('../../model/order.js'); 
const User = require('../../model/user.js');
const Product = require('../../model/product.js');

exports.getDashboard = async (req, res) => {
    try {
        const bestSellingType = req.query.bestSellingType || 'products';
        const totalSalesResult = await Order.aggregate([
            { $match: { payment_status: 'COMPLETED' } },
            { $group: { _id: null, totalSales: { $sum: '$total_amount' } } }
        ]);
        const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;
        const orderCount = await Order.countDocuments();
        const customerCount = await User.countDocuments({ role: 'user' });
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user_id', 'firstname lastname');
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        const dailySales = await Order.aggregate([
            {
                $match: {
                    payment_status: 'COMPLETED',
                    createdAt: { $gte: sevenDaysAgo },
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$createdAt",
                            timezone: "+05:30"
                        }
                    },
                    total: { $sum: '$total_amount' }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        const salesDataMap = new Map(dailySales.map(d => [d._id, d.total]));
        const salesDataForChart = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            const sales = salesDataMap.get(dateString) || 0;
            salesDataForChart.push({
                day: date.toLocaleString('en-US', { weekday: 'short' }),
                sales: sales
            });
        }
        const maxSales = Math.max(...salesDataForChart.map(d => d.sales), 1);
        let bestSelling;

  //////////////////////////////////////////////////////////////////////////////////////////////////////
        if (bestSellingType === 'products') {
    bestSelling = await Order.aggregate([
        { $match: { payment_status: 'COMPLETED' } },
        { $unwind: "$products" },
        {
            $lookup: {
                from: "products",
                let: { pid: "$products.product_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$_id", "$$pid"] },
                                    { $eq: ["$isDeleted", false] }
                                ]
                            }
                        }
                    }
                ],
                as: "productDetails"
            }
        },
        { $unwind: "$productDetails" },
        { $unwind: "$productDetails.colorVariants" },
        {
            $group: {
                _id: "$products.product_id",
                productTitle: { $first: "$productDetails.title" },
                totalSalesCount: { $sum: "$products.quantity" },
                productImages: { $addToSet: "$productDetails.colorVariants.images" }
            }
        },
        {
            $project: {
                productTitle: 1,
                totalSalesCount: 1,
                productImages: {
                    $reduce: {
                        input: "$productImages",
                        initialValue: [],
                        in: { $concatArrays: ["$$value", "$$this"] }
                    }
                }
            }
        },
        { $sort: { totalSalesCount: -1 } },
        { $limit: 5 }
    ]);
}else if (bestSellingType === 'category') {
  bestSelling = await Order.aggregate([
    { $match: { payment_status: 'COMPLETED' } },
    { $unwind: "$products" },
    {
      $lookup: {
        from: "products",
        let: { pid: "$products.product_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$pid"] },
                  { $eq: ["$isDeleted", false] }
                ]
              }
            }
          }
        ],
        as: "productDetails"
      }
    },
    { $unwind: "$productDetails" },
    { $unwind: "$productDetails.colorVariants" },  
    {
      $lookup: {
        from: "categories",
        localField: "productDetails.category_id",
        foreignField: "_id",
        as: "categoryDetails"
      }
    },
    { $unwind: "$categoryDetails" },
    {
      $group: {
        _id: "$productDetails.category_id",
        categoryName: { $first: "$categoryDetails.name" },
        totalSalesCount: { $sum: "$products.quantity" },
        productImages: { $addToSet: "$productDetails.colorVariants.images" },
        products: { $addToSet: "$productDetails.title" }
      }
    },
    {
      $project: {
        categoryName: 1,
        totalSalesCount: 1,
        products: 1,
        productImages: {
          $reduce: {
            input: "$productImages",
            initialValue: [],
            in: { $concatArrays: ["$$value", "$$this"] }
          }
        }
      }
    },
    { $sort: { totalSalesCount: -1 } },
    { $limit: 5 }
  ]);
} else if (bestSellingType === 'brand') {
  bestSelling = await Order.aggregate([
    { $match: { payment_status: 'COMPLETED' } },
    { $unwind: "$products" },
    {
      $lookup: {
        from: "products",
        let: { pid: "$products.product_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$pid"] },
                  { $eq: ["$isDeleted", false] }
                ]
              }
            }
          }
        ],
        as: "productDetails"
      }
    },
    { $unwind: "$productDetails" },
    { $unwind: "$productDetails.colorVariants" }, 
    {
      $lookup: {
        from: "brands",
        localField: "productDetails.brand_id",
        foreignField: "_id",
        as: "brandDetails"
      }
    },
    { $unwind: "$brandDetails" },
    {
      $group: {
        _id: "$productDetails.brand_id",
        brandName: { $first: "$brandDetails.name" },
        totalSalesCount: { $sum: "$products.quantity" },
        productImages: { $addToSet: "$productDetails.colorVariants.images" },
        products: { $addToSet: "$productDetails.title" }
      }
    },
    {
      $project: {
        brandName: 1,
        totalSalesCount: 1,
        products: 1,
        productImages: {
          $reduce: {
            input: "$productImages",
            initialValue: [],
            in: { $concatArrays: ["$$value", "$$this"] }
          }
        }
      }
    },
    { $sort: { totalSalesCount: -1 } },
    { $limit: 5 }
  ]);
}else{
          bestSelling = await Product.find({ isDeleted: false })
            .sort({ totalSalesCount: -1 })
            .limit(5);
        }
   
    ////////////new logic ////////////////
// Format best-selling items to handle Cloudinary URLs
// Unified formatting for all three types (same structure after aggregation)
if (bestSellingType === 'products' || bestSellingType === 'category' || bestSellingType === 'brand') {
    bestSelling = bestSelling.map(item => {
        let displayImage = 'https://via.placeholder.com/96';
        
        if (item.productImages && item.productImages.length > 0) {
            const firstImage = item.productImages[0];
            displayImage = firstImage.startsWith('http') 
                ? firstImage 
                : `/uploads/products/${firstImage}`;
        }
       
        return {
            ...item,
            displayImage
        };
    });
}
    ///////new logic end///////////
        res.render('admin/dashboard', {
            totalSales,
            orderCount,
            customerCount,
            recentOrders,
            bestSelling,
            bestSellingType,
            salesDataForChart,
            maxSales,
            layout: false
        });

    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).send('Server Error');
    }
};
