const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstname: { type: String },
  lastname: { type: String },
  email: { type: String, unique: true, required: true },
  password: { type: String },
  mobile: { type: Number },
  isVerified: {         
        type: Boolean,
        default: false, 
    },
  status: { type: String, enum: ['active', 'blocked'], default: 'active' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
},{timestamps:true});

const User = mongoose.model('User', userSchema);

module.exports = User;
