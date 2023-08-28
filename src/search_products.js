const {_, db} = require("../config/firebase.js");

const searchProducts = async (req, res) => {
    try {
        // Check if the 'store_id' key exists in the request body
        if (!req.body.hasOwnProperty('store_ids') && !req.body.hasOwnProperty('query')) {
            return res.status(400).json({error: "store_id and query field is required."});
        }

        if (req.body.store_ids.length <= 0) {
            return res.status(400).json({error: "store_ids should not be empty."});
        }

        // Get nearby stores
        let query = req.body.query ? "tomate" : req.body.query.toLowerCase();

        const nearbyStoresIds = req.body.store_ids;
        const searchResults = [];
        // console.log(nearbyStoresIds);
        const nearbyStoreRefs = nearbyStoresIds.map(id => db.collection('stores').doc(id));

        // console.log(nearbyStoresIds, 'nearbyStoreRefs', nearbyStoreRefs);

        const nearbyStoreRefsSnapshots = await db
            .collection('products_mvp')
            .where('storeRef', 'in', nearbyStoreRefs)   // todo put check of storeRefs not more than 30
            .where('is_exist', '==', true)
            .get();

        for (const value of nearbyStoreRefsSnapshots.docs) {
            const valueData = value.data();

            try {
                // console.log(`ADD PRODUCT DATA = ${JSON.stringify(valueData)}`);

                const product = createProductFromData(valueData);
                // console.log(`ADD PRODUCT DATA = ${JSON.stringify(product)}`);


                // todo this + push inside Search Result is not accurate.
                const hasGenericNameMatched = product.genericNames.some(genericName =>
                    genericName.toLowerCase().includes(query)
                );

                if (
                    hasGenericNameMatched ||
                    product.name.toLowerCase().includes(query)
                ) {
                    searchResults.push(product);
                }
            } catch (e) {
                console.log(`Error processing value: ${JSON.stringify(valueData)}`);
                console.log(`Error details: ${e}`);
            }
        }

        const filteredList = [];

        // todo Sort it on the basis of generic names.
        if (searchResults.length > 0) {
            let selectedProduct = searchResults[0];
            // console.log(`SELECTED PRODUCT DATA = ${JSON.stringify(selectedProduct)}`);

            let minPrice = parseFloat(selectedProduct.price);
            let maxPrice = parseFloat(selectedProduct.price);

            for (let i = 1; i < searchResults.length; i++) {
                const product = searchResults[i];

                const isSimilarProduct = selectedProduct.measure === product.measure
                    && selectedProduct.department === product.department
                    && product.genericNames.every(name =>
                        selectedProduct.genericNames.includes(name)
                    );

                if (isSimilarProduct) {
                    const productMinPrice = parseFloat(product.price);
                    minPrice = Math.min(minPrice, productMinPrice);
                    maxPrice = Math.max(maxPrice, productMinPrice);

                    console.log(`SELECTED PRODUCT IF = ${minPrice} and ${maxPrice}`);

                } else {
                    const filteredProduct = {
                        ...selectedProduct,
                        minPrice: minPrice,
                        maxPrice: maxPrice
                    };
                    filteredList.push(filteredProduct);

                    selectedProduct = product;
                    minPrice = parseFloat(product.price);
                    maxPrice = parseFloat(product.price);

                    console.log(`SELECTED PRODUCT ELSE = ${minPrice} and ${maxPrice}`);

                }
            }

            const filteredProduct = {
                ...selectedProduct,
                minPrice: minPrice,
                maxPrice: maxPrice
            };
            filteredList.push(filteredProduct);
        }

        // console.log('Filter List:', JSON.stringify(filteredList));
        res.json(filteredList);


    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({error: "An error occurred while fetching products."});
    }
};

function createProductFromData(data) {
    const genericNames = data.genericNames || [];
    const product = {};

    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            product[key] = data[key];
        }
    }

    product.genericNames = genericNames;
    product.price = (data.price !== undefined) ? data.price : 0.0;
    // product.minPrice = (data.price !== undefined) ? data.price.toString() : '0';
    // product.maxPrice = `${(data.storeRef && data.storeRef.id) || ''} - ${genericNames.join(', ')}`;

    return product;
}


exports.searchProducts = searchProducts;
