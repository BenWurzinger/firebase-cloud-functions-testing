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
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

// The Firebase Admin SDK to access Firestore.
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

// const port = 9000;

app.get('/', (req, res) => {
    res.send({ message: 'Hello World!' });
});

app.get('/users', (req, res) => {
    res.send({ users: [] });
});

app.get('/insertProducts', async (req, res) => {
    try {
        // Get the Firestore client.
        const firestore = getFirestore();

        // Create a reference to the `products` collection.
        const productsRef = firestore.collection("products");

        // Create an array of documents to insert.
        const products = [
            { price: 60, name: "tomato", category: "vegetable" },
            { price: 60, name: "chilli", category: "vegetable" },
            { price: 90, name: "Star fruit", category: "fruits" },
        ];

        // Generate 10,000 sample products
        for (let i = 1; i <= 4000; i++) {
            products.push({
                price: Math.floor(Math.random() * 100) + 1,
                name: `Product ${i}`,
                category: i % 2 === 0 ? "vegetable" : "fruits",
            });
        }

        // Split products into chunks of 500 each
        const chunkSize = 500;
        const productChunks = [];
        for (let i = 0; i < products.length; i += chunkSize) {
            productChunks.push(products.slice(i, i + chunkSize));
        }

        // Initialize a batch write for each chunk
        const batchPromises = productChunks.map(async (chunk) => {
            const batch = firestore.batch();
            chunk.forEach((docData) => {
                const newDocRef = productsRef.doc(); // Automatically generate a unique document ID
                batch.set(newDocRef, docData);
            });
            return batch.commit();
        });

        // Commit all batch writes
        await Promise.all(batchPromises);

        // Send a response to the client.
        res.json({ result: `Products inserted successfully.` });
    } catch (error) {
        console.error("Error inserting products:", error);
        res.status(500).json({ error: "An error occurred while inserting products." });
    }
});

app.get('/sampleProducts', async (req, res) => {
    try {
        const db = getFirestore();
        const productsRef = db.collection('products');
        const querySnapshot = await productsRef.where('price', '>', 90).get();

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

// app.post("/user", Usercontroller.registeruser);
// app.get("/user/:id", Usercontroller.getUser);

// app.listen(port, () => {
//     console.log(`Example app listening on port ${port}`);
// });

exports.api = onRequest(app)

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

/* exports.helloWorld = onRequest((request, response) => {

    logger.info("Hello logs!", { structuredData: true });
    response.send({ message: "Hello from Firebase!" });
    db.collection('functions').get();
}); */
