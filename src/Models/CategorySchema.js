const mongoose = require('mongoose');
require('dotenv').config();


const categorySchema = new mongoose.Schema({
    category_name: {
        type: String,
        required: true
    },
    category_image:{
        type:String,
        required:true
    },
    category_scrap_links: [
        {
            link:{
                type:String
            }
        }
    ],
    replacementPart_links: [
        {
            link:{
                type:String
            }
        }
    ],

    
})

module.exports = mongoose.model('Categories', categorySchema);
