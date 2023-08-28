const admin = require("firebase-admin");
const serviceAccount = require("./service-account.json");

const {setGlobalOptions} = require("firebase-functions/v2");
setGlobalOptions({maxInstances: 10});

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});


const db = admin.firestore();
module.exports = {admin, db};