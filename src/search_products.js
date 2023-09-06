const {_, db} = require("../config/firebase.js");

const searchProducts = async (req, res) => {
    try {
        // Check if the 'store_id' key exists in the request body
        if (!req.body.hasOwnProperty('store_ids') && !req.body.hasOwnProperty('query')) {
            return res.status(400).json({error: "store_ids and query field is required."});
        }
        // Check if query is empty
        if (req.body.query.trim() === "") {
            return res.status(400).json({error: "query field should not be empty."});
        }

        // Check if 'store_ids' is an empty array
        if (!Array.isArray(req.body.store_ids) || req.body.store_ids.length === 0) {
            return res.status(400).json({error: "store_ids should be a non-empty array."});
        }


        // Get nearby stores
        let query = req.body.query.trim().toLowerCase();

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

                const product = createProductFromData(valueData, value.id);
                // console.log(`ADD PRODUCT DATA = ${JSON.stringify(product)}`);


                // todo this + push inside Search Result is not accurate.
                const hasGenericNameMatched = product.genericNames.some((genericName) => {
                    const words = query.toLowerCase().split(" ");
                    return words.some((word) => word === genericName.toLowerCase());
                });


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

        const productGroups = {};

        if (searchResults.length > 0) {
            for (let i = 0; i < searchResults.length; i++) {
                const product = searchResults[i];
                const key = `${product.measure}-${product.department}-${product.genericNames.join('-')}`;

                if (!productGroups[key]) {
                    productGroups[key] = [product];
                } else {
                    productGroups[key].push(product);
                }
            }
        }

        const filteredList = [];

        for (const key in productGroups) {
            if (productGroups.hasOwnProperty(key)) {
                const group = productGroups[key];

                let minPrice = parseFloat(group[0].price);
                let maxPrice = parseFloat(group[0].price);

                for (let i = 1; i < group.length; i++) {
                    const product = group[i];
                    const productMinPrice = parseFloat(product.price);

                    minPrice = Math.min(minPrice, productMinPrice);
                    maxPrice = Math.max(maxPrice, productMinPrice);
                }

                const filteredProduct = group[0]; // You can choose any product in the group as a base.
                filteredProduct.minPrice = minPrice;
                filteredProduct.maxPrice = maxPrice;

                filteredList.push(filteredProduct);
            }
        }

        res.json(filteredList);


    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({error: "An error occurred while fetching products."});
    }
};

function createProductFromData(data, docId) {
    const genericNames = data.genericNames || [];
    const product = {};

    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            product[key] = data[key];
        }
    }

    product.genericNames = genericNames;
    product.storeRef = data.storeRef.path.toString();
    product.departmentRef = data.departmentRef.path.toString();
    product.productRef = db.collection('products_mvp').doc(docId).id.toString();
    product.price = (data.price !== undefined) ? data.price : 0.0;
    // product.minPrice = (data.price !== undefined) ? data.price.toString() : '0';
    // product.maxPrice = `${(data.storeRef && data.storeRef.id) || ''} - ${genericNames.join(', ')}`;

    return product;
}


exports.searchProducts = searchProducts;
