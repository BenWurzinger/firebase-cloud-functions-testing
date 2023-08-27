const {_, db} = require("../config/firebase.js");

const storeProducts = async (req, res) => {
    try {
        // Check if the 'store_id' key exists in the request body
        if (!req.body.hasOwnProperty('store_id')) {
            return res.status(400).json({error: "store_id field is required."});
        }

        // Extract the store_id from the request body
        const storeReference = db.collection("stores").doc(req.body.store_id);

        // Create a reference to the 'products_mvp' collection for the specific store.
        const productsRef = db.collection("products_mvp").where("storeRef", "==", storeReference);

        // Fetch the products using the query.
        const querySnapshot = await productsRef.get();

        // Use asynchronous iteration and map for optimized performance
        const products = await Promise.all(querySnapshot.docs.map(async (doc) => {
            return doc.data();
        }));

        res.json(products);
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({error: "An error occurred while fetching products."});
    }
};

exports.storeProducts = storeProducts;
