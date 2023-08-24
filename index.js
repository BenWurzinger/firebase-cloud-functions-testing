/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const serviceAccount = require('./service-account.json');

// The Firebase Admin SDK to access firestore.
const admin = require("firebase-admin");

const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

const { setGlobalOptions } = require("firebase-functions/v2");
setGlobalOptions({ maxInstances: 10 });

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = getFirestore();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());


app.get('/', (req, res) => {
    res.send({ message: "Hello World!" });
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

app.post('/fetchStoreProducts', async (req, res) => {
    try {
        // Check if the 'store_id' key exists in the request body
        if (!req.body.hasOwnProperty('store_id')) {
            return res.status(400).json({ error: "store_id field is required." });
        }

        // Extract the store_id from the request body
        const storeReference = db.collection("stores").doc(req.body.store_id);

        // Create a reference to the 'products_mvp' collection for the specific store.
        const productsRef = db.collection("products_mvp").where("storeRef", "==", storeReference);

        // Fetch the products using the query.
        const querySnapshot = await productsRef.get();

        // Use asynchronous iteration and map for optimized performance
        const products = await Promise.all(querySnapshot.docs.map(async (doc) => {
            const docData = doc.data();
            return docData;
        }));

        // Send the products as JSON response.
        res.json(products);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "An error occurred while fetching products." });
    }
});

app.post('/nearbyStoreProducts', async (req, res) => {
    try {
        // Check if the 'store_id' key exists in the request body
        if (!req.body.hasOwnProperty('store_id')) {
            return res.status(400).json({ error: "store_id field is required." });
        }

        // Extract the store_id from the request body
        const storeReference = db.collection("stores").doc(req.body.store_id);

        // Create a reference to the 'products_mvp' collection for the specific store.
        const productsRef = db.collection("products_mvp").where("storeRef", "==", storeReference);

        // Fetch the products using the query.
        const querySnapshot = await productsRef.get();

        // Use asynchronous iteration and map for optimized performance
        const products = await Promise.all(querySnapshot.docs.map(async (doc) => {
            const docData = doc.data();
            return docData;
        }));

        // Send the products as JSON response.
        res.json(products);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "An error occurred while fetching products." });
    }
});


// const port = 3000;

// app.listen(port, () => {
//     console.log(`Example app listening on port ${port}`);
// });


exports.api = onRequest(app)