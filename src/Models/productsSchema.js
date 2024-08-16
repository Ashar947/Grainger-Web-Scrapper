const mongoose = require('mongoose');
require('dotenv').config();


const productTypeSchema = new mongoose.Schema({
    type_name: { type: String ,default:"" },
    type_image: String,
    table_header: [String],
    table_body: [[String]],
});

const productSchema = new mongoose.Schema({
    productCategory: {
        type: String,
        required: true
    },
    mainTitle: {
        type: String,
    },
    description: {
        type: String,
    },
    product_types: [productTypeSchema],
});

module.exports = mongoose.model('Product', productSchema);
