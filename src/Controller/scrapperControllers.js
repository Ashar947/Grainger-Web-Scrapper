const cheerio = require('cheerio');
const axios = require('axios');
const puppeteer = require('puppeteer');
const Category = require('../Models/CategorySchema');
const Product = require('../Models/productsSchema')
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
};

let failed_urls = []

const axiosWithRetry = async (url, options, maxRetries = 3) => {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const response = await axios.get(url, options);
            return response;
        } catch (error) {
            if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
                retries++;
                console.log(`Retrying (${retries}/${maxRetries})...`);
            } else {
                throw error;
            }
        }
    }
    throw new Error('Max retries reached');
};


const getProductData = async (URL, prodCat) => {
    process.setMaxListeners(99999);
    const url = URL;
    const productsDetails = [];
    var templist = [];
    var newlist = [];
    // const response = await axios.get(url, { headers });
    const response = await axiosWithRetry(url, { headers });

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        defaultViewport: null,
        userDataDir: './tmp',
        timeout: 30000
    });
    const page = await browser.newPage();
    let navigationRetries = 0;
    const maxNavigationRetries = 3;

    while (navigationRetries < maxNavigationRetries) {
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            break; // Break the loop if successful
        } catch (error) {
            console.log('Navigation Timeout:', error);
            navigationRetries++;
            console.log(`Retrying navigation (${navigationRetries}/${maxNavigationRetries})...`);
        }
    }

    // await page.goto(url,{ waitUntil: 'networkidle2'});

    try {
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
                    try {
                        const response = await getTableData(firstNumber, secondNumber, browser, page)
                        if (response === false) {
                            if (!(failed_urls.includes(URL))) {
                                failed_urls.push(URL)
                            }
                            console.log(`Response is False !!!!`);
                            console.log(response)
                        }

                    } catch (error) {
                        console.log(error)
                    }
                    console.log("hree");
                    const type_name = $(type).find(`.SQoGqa`).text();
                    const type_image = $(".sBtbCN").attr('src');
                    const typeDetails = {
                        type_name,
                        type_image,
                        table_header: response.tableHeaders,
                        table_body: response.tablebody
                    };
                    console.log(typeDetails)
                    product_types.push(typeDetails);
                } else {
                    console.log("No numbers found in the string.");
                }
            }
            productsDetails.push({ productCategory: prodCat, mainTitle, description, product_types });
        }
        await browser.close();
        await Product.insertMany(productsDetails);
        return { sucess: true, failed_urls };
    } catch (error) {
        console.log(error);
        await browser.close()
        return false;
    }
};



const getTableData = async (tableID, index, browser, page) => {
    console.log(page)
    console.log(browser)
    let table_header_selector = `#stack-${tableID}-stack-${index} .WBaEey table thead tr th`
    let table_body_selector = `#stack-${tableID}-stack-${index} .WBaEey table tbody tr td.Ghghrv`
    try {
        // Wait for the table header to load
        await page.waitForSelector(table_header_selector);
        for (let i = 0; i < 20; i++) {
            console.log(i)
            await page.evaluate((table_header_selector, i) => {
                const element = document.querySelectorAll(table_header_selector)[i];
                if (element) {
                    element.scrollIntoView();
                    console.log("Element Found ..................")
                }
            }, table_header_selector, i);
        }
        const tableHeaders = await page.$$eval(`#stack-${tableID}-stack-${index} .WBaEey table thead tr th`, (buttons) => buttons.map(button => button.textContent));
        await page.waitForSelector(table_body_selector);
        const body = await page.$$eval(table_body_selector, (divs) => divs.map(div => div.getAttribute('title')));
        const tablebody = [];
        while (body.length > 0) {
            if (body.length >= tableHeaders.length) {
                const row = body.splice(0, tableHeaders.length);
                tablebody.push(row);
            } else {
                break;
            }
        };
        console.log(tableHeaders, tablebody)
        return { tableHeaders, tablebody }
    } catch (error) {
        console.log(error);
        await browser.close();
        console.log(error);
        return false
    }

};





module.exports = { getProductData, getTableData }