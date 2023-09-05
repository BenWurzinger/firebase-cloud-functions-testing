/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
// const logger = require("firebase-functions/logger");
const storeProducts = require("./src/store_products");
const searchProducts = require("./src/search_products");
const storeRanking = require("./src/store_ranking");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { getFirestore } = require("firebase-admin/firestore");

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());


app.get('/', (req, res) => {
    res.send({message: "Hello World!"});
});


app.get('/sampleProducts', async (req, res) => {
    try {
        const db = getFirestore();
        const productsRef = db.collection('mylist');
        // const querySnapshot = await productsRef.where('price', '<', 60).get();
        const querySnapshot = await productsRef.get();

        const products = [];
        querySnapshot.forEach((doc) => {
            products.push(doc.data());
        });

        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/fetchStoreProducts', storeProducts.storeProducts);
app.post('/searchProducts', searchProducts.searchProducts);
app.post('/storeRanking', storeRanking.storeRanking);


/* const port = 3000;

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});*/


exports.api = onRequest(app);