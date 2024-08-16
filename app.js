const express = require('express');
require('dotenv').config();
const cheerio = require('cheerio');
require('./src/DataBase/connection');
const axios = require('axios');
const app = express();
app.use(express.json());
PORT = 5000;
const puppeteer = require('puppeteer');
const { getProductData, getTableData } = require('./src/Controller/scrapperControllers')
const Category = require('./src/Models/CategorySchema');
const Product = require('./src/Models/productsSchema')
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
};
const { abbrasiveUrls, adhesiveUrls, fastenersUrls, electronics_batteriesUrls, fleet_vehicle_maintenanceUrls, furnishingsAppliancesUrls, hvac_and_refrigerationUrls, hardwareUrls, lightingUrls, lubricationUrls, machiningUrls, material_handlingUrls, motorsUrls, officeSupplies, outdoorEquipmentUrls, packagingShippingUrls, paints_equipment_and_suppliesUrls, pipe_hose_fitting_tubesUrls, plumbingUrls, pneumaticsUrls, pumpsUrls, rawMaterialUrls, reference_and_learning_supplies, safetyUrls, securityUrls, hydraulicsUrls, labSuppliesUrls, weldingUrls, electricalUrls, test_instrumentsUrls } = require('./src/jsonData')

let fail_urls = [];

app.get('/', (req, res) => {
    res.send("Working")
});

app.get('/scrapCategories', async (req, res) => {
    console.log('/scrapData Working')
    var newCatAdded = 0;
    url = "https://www.grainger.com/category";
    const productsCategories = [];
    try {
        const response = await axios.get(url, { headers });
        console.log(response)
        const $ = cheerio.load(response.data);
        const cat = $("._3dXDpA");
        cat.each(async function () {
            const category = $(this).find(".ybO87M").text();
            const image = $(this).find(".sBtbCN").attr("src");
            productsCategories.push({ category, image });
            const checkCategory = await Category.findOne({ category_name: category })
            if (!checkCategory) {
                console.log(`New Category Added ${category}`);
                newCatAdded = newCatAdded + 1;
                await Category.create({ category_name: category, category_image: image });
            } else if (checkCategory) {
                const updateCategory = await Category.updateOne({ category_name: category },
                    {
                        $set: {
                            category_image: image
                        }
                    });
            };
        });
        console.log(productsCategories);
        res.status(200).json({ New_Category_Added: newCatAdded, Categories: productsCategories })
    } catch (error) {
        console.log(error);
        res.send(error);
    }
})

// app.get("/single", async (req, res) => {
//     try {
//         const dispatchUrl = "https://www.grainger.com/category/abrasives/abrasive-accessories/expanding-drums-wheels?categoryIndex=3"
//         const nameCategory = "TESTF"
//         const callFunction = await getProductData(dispatchUrl, nameCategory)
//         res.send(callFunction)
//     } catch (error) {
//         console.log(error)
//     }
// })



app.post('/productsData', async (req, res) => {
    console.log('POST Product Data')
    try {
        const { url, productCategory } = req.body
        const productsDetails = [];
        var templist = [];
        var newlist = [];
        const response = await axios.get(url, { headers });
        const browser = await puppeteer.launch({
            headless: false,
            executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            defaultViewport: null,
            userDataDir: './tmp'
        });
        const page = await browser.newPage();
        await page.goto(url);

        const $ = await cheerio.load(response.data);
        const product_section = $(".MAcbb-");
        let newSecondNumber;
        for (const product of product_section) {
            const id = $(product).attr("id");
            const mainTitle = $(product).find(".sC0Aof").text();
            const description = $(product).find("._1Pvnsk").text();
            const product_types = [];
            const types = $(`#${id} .T8G8vu`);
            for (const type of types) {
                const type_id = $(type).attr("id");
                const regex = /\d+/g;
                const numbers = type_id.match(regex);
                var firstNumber = 0;
                var secondNumber = 0;
                if (numbers) {
                    // Extract the first and second numbers
                    firstNumber = numbers[0];
                    secondNumber = numbers[1];
                    console.log("First Number:", firstNumber);
                    console.log("Second Number:", secondNumber);
                    const jsonData = {
                        url: url,
                        tableID: firstNumber,
                        index: secondNumber
                    };
                    console.log(jsonData)
                    const response = await getTableData(firstNumber, secondNumber, browser, page)
                    if (response === false) {
                        if (!(fail_urls.includes(url))) {
                            fail_urls.push(url)
                        }
                        console.log(`Response is False !!!!`);
                        console.log(response)
                    }
                    console.log("hree");
                    const type_name = $(type).find(`.SQoGqa`).text() || "null";
                    const type_image = $(".sBtbCN").attr('src');
                    const typeDetails = {
                        type_name,
                        type_image,
                        table_header: response.tableHeaders,
                        table_body: response.tablebody
                    };
                    product_types.push(typeDetails);

                } else {
                    console.log("No numbers found in the string.");
                }
            }
            productsDetails.push({ productCategory: productCategory, mainTitle, description, product_types });
        }
        await browser.close();
        await Product.insertMany(productsDetails);
        res.status(200).json({ productsDetails: productsDetails });
    } catch (error) {
        console.log(error);
        res.send(error);
    }
});

app.get('/insertUrls', async (req, res) => {
    try {
        let name = 'Test Instruments';
        const cat = await Category.findOne({ category_name: name });
        if (!cat) {
            return res.status(404).json({ message: "cat not found" })
        }
        test_instrumentsUrls.map(obj => {
            let link = obj[Object.keys(obj)[0]]
            cat.category_scrap_links.push({ link: link });
        });
        await cat.save();
        const check = await Category.findOne({ category_name: name })
        return res.status(200).json({ message: "Urls Inserted ", check: check })
    } catch (error) {
        res.status(404).json({ message: error.message })
    }
})


app.post('/insertUrl/:id', async (req, res) => {
    try {
        const { url } = req.body
        const category = await Category.findOne({ _id: req.params.id })
        if (!category) {
            return res.status(404).json({ message: "Category Not Found" })
        }
        category.category_scrap_links.push({ link: url });
        await category.save();
        return res.status(200).json({ message: "Url Entered" })
    } catch (error) {
        return res.status(404).json({ message: error.message })
    }
})


app.get('/scrapFinal/:id', async (req, res) => {
    let returnCallFunction;
    try {
        const catID = req.params.id
        const category = await Category.findOne({ _id: catID })
        if (!category) {
            return res.status(404).json({ message: "category not found" })
        }
        fail_urls = [];
        process.setMaxListeners(999999999999);
        const nameCategory = category.category_name
        // const category = await Category.findOne({ category_name: nameCategory });
        let links = category.category_scrap_links;
        for (const x of links) {
            let dispatchUrl = x.link
            let sendJsonData = {
                URL: dispatchUrl,
                prodCat: nameCategory
            }
            const callFunction = await getProductData(dispatchUrl, nameCategory)
            returnCallFunction = callFunction.failed_urls
        }
        console.log(returnCallFunction)

        // if (returnCallFunction && returnCallFunction.length>0){
        //     for (const y of returnCallFunction){
        //         const fail_response = await axios.post('http://127.0.0.1:5000/productsData',{url:y,productCategory:nameCategory})
        //         console.log(fail_response)
        //     }
        // }
        return res.status(200).json({ message: "Success", failedUrls: returnCallFunction })
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
})


app.get('/allCategories', async (req, res) => {
    try {
        const category = await Category.find({}, '_id category_name')
        if (!category) {
            return res.status(404).json({ message: "Cannot Find Categories" })
        }
        return res.status(200).json({ message: "Categories Found", data: category })
    } catch (error) {
        return res.status(404).json({ message: error.message });
    }
})


app.get('/categoryUrls/:id', async (req, res) => {
    try {
        const cat_id = req.params.id;
        const category = await Category.findOne({ _id: cat_id });
        if (!category) {
            return res.status(404).json({ message: "Unable to Find Category" })
        }
        return res.status(200).json({ message: "Category Found", data: category.category_scrap_links })
    } catch (error) {
        return res.status(404).json({ message: error.message });
    }
})


app.delete('/deleteUrl/:id/:url_id', async (req, res) => {
    try {
        const id = req.params.id; // category id
        const url_id = req.params.url_id
        const category = await Category.findOneAndUpdate(
            { _id: id },
            { $pull: { category_scrap_links: { _id: url_id } } },
            { new: true }
        );
        if (!category) {
            return res.status(404).json({ message: "Error Deleting Url" })
        }
        return res.status(200).json({ message: "Url Deleted" })
    } catch (error) {
        return res.status(404).json({ message: error.message });
    }
})


app.patch('/moveUrl/:id/:url_id', async (req, res) => {
    try {
        const { url } = req.body;
        const id = req.params.id; // category id
        const url_id = req.params.url_id
        const category = await Category.findOneAndUpdate(
            { _id: id },
            { $pull: { category_scrap_links: { _id: url_id } } },
            { new: true }
        );
        if (!category) {
            return res.status(404).json({ message: "Error Deleting Url" })
        }
        const cat = await Category.findOne({ _id: id });
        cat.replacementPart_links.push({ link: url });
        await cat.save();
        return res.status(200).json({ message: "Url Deleted" })
    } catch (error) {
        return res.status(404).json({ message: error.message });
    }
})


app.listen(PORT, () => {
    console.log(`Server Running at port ${PORT} .`)
})
