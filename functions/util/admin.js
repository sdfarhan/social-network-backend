const admin = require('firebase-admin');

var serviceAccount = require("../socialnetwork-5be42-firebase-adminsdk-ddvks-a6ea27b8cc.json");
admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://socialnetwork-5be42.firebaseio.com",
        storageBucket: "socialnetwork-5be42.appspot.com"
    });

const db = admin.firestore();

module.exports = { admin, db  };