const { _, db } = require("../config/firebase.js");

const storeRanking = async (req, res) => {
    if (!req.body.hasOwnProperty('store_ids') && !req.body.hasOwnProperty('list_id')) {
        return res.status(400).json({ error: "store_id and list_id field is required." });
    }

    if (req.body.store_ids.length <= 0) {
        return res.status(400).json({ error: "store_ids should not be empty." });
    }


    const missingProductMap = new Map();
    const similarProductMap = new Map();
    const productInListMap = new Map();


    try {
        const nearbyStoresIds = req.body.store_ids;
        const listId = req.body.list_id;
        const isPreloadedList = req.body.is_preloaded_list;

        const nearbyStoreRefs = nearbyStoresIds.map(id => db.collection('stores').doc(id));

        const [storeProductsSnapshot, productListSnapshot] = await Promise.all([
            db.collection('products_mvp')
                .where('is_exist', '==', true)
                .where('storeRef', 'in', nearbyStoreRefs)
                .get(),

            db.collection(isPreloadedList ? 'preloded_default' : 'mylist')
                .doc(listId)
                .collection(isPreloadedList ? 'preloaded_product_list' : 'user_product_list')
                .get()
        ]);

        const productRefs = productListSnapshot.docs.map(productSnapshot => productSnapshot.get('product_ref'));

        const [storeProducts, userProductsSnapshot] = await Promise.all([
            Promise.all(storeProductsSnapshot.docs.map(productSnapshot =>
                formatProductData(productSnapshot.data(), productSnapshot)
            )),

            Promise.all(productRefs.map(productRef => productRef.get()))
        ]);


        const userProducts = userProductsSnapshot.map(productSnapshot =>
            formatProductData(productSnapshot.data(), productSnapshot)
        );

        // console.log("userProducts", userProducts);

        // const storeTotal = new Map(nearbyStoreRefs.map(storeRef => [storeRef, 0]));
        // console.log("userProducts", storeTotal);

        const matchingProductCounts = new Map();
        const storeTotal = new Map();

        for (const storeRef of nearbyStoreRefs) {

            for (let i = 0; i < productListSnapshot.size; i++) {
                const productSnapshot = productListSnapshot.docs[i];
                const product = userProducts[i];
                const productSnapshotData = productSnapshot.data();

                // console.log("PRODUCT", productSnapshotData.quantity);

                const price = parseFloat(product.price);
                const quantity = parseFloat(productSnapshotData.quantity);
                const productId = product.productId;

                if (product.isExist && product.storeRef === storeRef.path) {
                    storeTotal.set(storeRef, (storeTotal.get(storeRef) || 0) + (quantity * price));

                    matchingProductCounts.set(storeRef, (matchingProductCounts.get(storeRef) || 0) + 1);


                    (productInListMap.get(storeRef) || []).push({ 'product': product, 'quantity': quantity });

                    continue;
                }

                const productInStore = await getSimilarProductFromList({
                    storeRef: storeRef.path,
                    product: product,
                    storeProducts: storeProducts,
                    matchingProductCounts: matchingProductCounts
                });


                if (productInStore === null) {
                    const existingMissingProducts = missingProductMap.get(storeRef) || [];
                    existingMissingProducts.push({ 'product': product, 'quantity': quantity });
                    missingProductMap.set(storeRef, existingMissingProducts);

                } else if (productInStore.productId === productId) {
                    const price = parseFloat(productInStore.price);

                    storeTotal.set(storeRef, (storeTotal.get(storeRef) || 0) + (quantity * price));

                    const existingProductsInList = productInListMap.get(storeRef) || [];
                    existingProductsInList.push({ 'product': productInStore, 'quantity': quantity });
                    productInListMap.set(storeRef, existingProductsInList);
                } else {
                    const price = parseFloat(productInStore.price);
                    storeTotal.set(storeRef, (storeTotal.get(storeRef) || 0) + (quantity * price));
                    const existingSimilarProducts = similarProductMap.get(storeRef) || [];
                    existingSimilarProducts.push({ 'product': productInStore, 'quantity': quantity });
                    similarProductMap.set(storeRef, existingSimilarProducts);
                }
            }
        }

        // console.log("storeTotal", storeTotal);

        const stores = [];
        for (const [storeRef, totalPrice] of storeTotal.entries()) {
            const matchingProductCount = matchingProductCounts.get(storeRef) || 0;
            const matchingPercentage = (matchingProductCount / productListSnapshot.size) * 100;

            // console.log("Percenatge", storeRef.path,matchingProductCount, productListSnapshot.size);


            const store = await getStoreFromPath({
                path: storeRef,
                totalPrice: totalPrice,
                matchingPercentage: matchingPercentage
            });
            stores.push(store);
        }


        stores.sort((a, b) => {
            return b.matchingPercentage - a.matchingPercentage;
        });

        res.json({
            "stores": stores,
            "matching": Array.from(productInListMap.entries()).map(([storeRef, products]) => ({
                storeRef: storeRef.path,
                products: products,
            })),
            "missing": Array.from(missingProductMap.entries()).map(([storeRef, products]) => ({
                storeRef: storeRef.path,
                products: products,
            })),
            "similar": Array.from(similarProductMap.entries()).map(([storeRef, products]) => ({
                storeRef: storeRef.path,
                products: products,
            })),
        });

    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "An error occurred while fetching products." });
    }
};

async function getStoreFromPath({ path, totalPrice, matchingPercentage }) {
    const storeSnapshot = await path.get();
    const location = storeSnapshot['location']; // Assuming location is a GeoPoint object in Firestore

    /* const distance = await getDistanceFromLocation({
        userLocation: { latitude: 20.68016662, longitude: -103.3822084 }, // Replace with actual user location
        destinationLocation: location
    }); */

    // console.log("storeSnapshot",storeSnapshot.data()['name']);
    const data = storeSnapshot.data();
    // const lat = location._latitude;
    // const lon = location._longitude;

    // console.log("The latitude is: " + lat);
    // console.log("The longitude is: " + lon);
    // console.log("storeSnapshot", data.location);

    // const latitude = location["_latitude"];
    // const longitude = location["_longitude"];
    // console.log("Latitude:", latitude);
    // console.log("Longitude:", longitude);


    return {
        // storeRef: path,
        logo: data['logo'],
        name: data['name'],
        totalPrice: totalPrice,
        matchingPercentage: Math.floor(matchingPercentage),
        distance: 5,
        address: data['adress'] // Fix typo to 'address' if it's changed in the database
    };
}

async function getSimilarProductFromList({
    product,
    storeProducts,
    storeRef,
    matchingProductCounts
}) {
    const productId = product.productId;
    const genericNames = [...product.genericNames];
    const measure = product.measure;
    const department = product.department;
    const actualStoreRef = db.doc(storeRef);

    const exactProduct = storeProducts.find(
        element =>
            element.storeRef === storeRef &&
            element.productId === productId &&
            element.isExist
    );

    if (exactProduct !== undefined) {
        console.log('Found exact product match:');
        console.log('Product ID:', productId);
        matchingProductCounts[actualStoreRef] =
            (matchingProductCounts[actualStoreRef] || 0) + 1;
        return exactProduct;
    }

    let bestMatch = null;
    let bestMatchPrice = null;
    let bestMatchPercentage = 0;

    for (const similarProduct of storeProducts) {
        const similarGenericNames = similarProduct.genericNames;
        const similarMeasure = similarProduct.measure;
        const similarDepartment = similarProduct.department;

        if (
            similarProduct.storeRef === storeRef &&
            similarMeasure === measure &&
            similarDepartment === department
        ) {
            const similarPrice = parseFloat(similarProduct.minPrice);
            const relationPercentage = calculateRelation(
                genericNames,
                similarGenericNames
            );

            if (
                !isNaN(similarPrice) &&
                (bestMatch === null ||
                    bestMatchPrice === null ||
                    relationPercentage > bestMatchPercentage ||
                    (relationPercentage === bestMatchPercentage &&
                        similarPrice < bestMatchPrice))
            ) {
                bestMatch = similarProduct;
                bestMatchPrice = similarPrice;
                bestMatchPercentage = relationPercentage;
            }
        }
    }

    if (bestMatchPercentage <= 0.65) {
        // console.log(`Similar product found BUT with ${bestMatchPercentage * 100}%:`);
        return null;
    }

    // console.log('bestMatchPercentage == ',bestMatchPercentage);
    matchingProductCounts[actualStoreRef] =
        (matchingProductCounts[actualStoreRef] || 0) + bestMatchPercentage;

    /* if (bestMatch !== null) {
        console.log('Found similar product:');
        console.log('Product ID:', bestMatch.productId);
        console.log('Generic Names:', bestMatch.genericNames);
        console.log('Price:', bestMatch.minPrice);
    } else {
        console.log('No similar product found.');
    } */

    return bestMatch;
}

function calculateRelation(mainGenericNames, otherGenericNames) {
    const otherGenericNamesSet = new Set(otherGenericNames);

    const matches = mainGenericNames.filter(item =>
        otherGenericNamesSet.has(item)
    ).length;
    const mainLength = mainGenericNames.length;
    const otherLength = otherGenericNames.length;

    const relationPercentage = matches / Math.max(mainLength, otherLength);

    return Number(relationPercentage.toFixed(2));
}

const formatProductData = (data, productSnapshot) => {
    return {
        productId: data.product_id.toString(),
        productRef: productSnapshot.ref.id.toString(),
        isExist: data.is_exist,
        department: data.department_name.toString(),
        measure: data.measure.toString(),
        name: data.name.toString(),
        pImage: data.pImage.toString(),
        storeRef: data.storeRef.path.toString(),
        genericNames: data.genericNames,
        price: data.price,
    };
};

exports.storeRanking = storeRanking;
