const cloudinary = require("cloudinary");
const  { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary.v2,
  params: {
    folder: "public/uploads/products",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

module.exports={storage};




