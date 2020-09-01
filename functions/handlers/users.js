const firebase = require('firebase');
const firebaseConfig = require('../util/firebaseConfig');
const { db, admin } = require('../util/admin');
const { validateSignupUser, validateLoginUser } = require('../util/validators'); 
const { imageUrl_1 } = require('../util/DefaultImages');

firebase.initializeApp(firebaseConfig);

exports.getAllUsers = (req,res) => {
    let users = []
    db.collection('users').get()
        .then(data => {
            data.forEach( doc => {
                users.push(doc.data());
            })
            return res.json(users);
        })
        .catch(err => {
            console.log(err);
        })
    }


exports.signupUser = (req,res) => {
    let token, userId;
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle,
    }

    const { errors, valid } = validateSignupUser(newUser); 
    if(!valid) return res.status(400).json(errors);
        
    db.doc(`/users/${newUser.handle}`).get()
        .then( user => {
            if(user.exists){
                res.status(400).json({ handle: 'This handle is already taken, please try with differrent hanlde'});
            } else{
                return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password)
            }
        })
        .then( data => {
            userId = data.user.uid;
           return data.user.getIdToken();
        })
        .then(idToken => {
            token = idToken;
            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                imageUrl: imageUrl_1,
                createdAt: new Date().toISOString(),
                userId
            }
            return db.doc(`/users/${newUser.handle}`).set(userCredentials)
        })
        .then( ()  => {
            res.status(201).json({ token });
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({general: 'Something went wrong, Please try again'})
        });
}


exports.loginUser = (req,res) => {
    const credentials = {
        email: req.body.email,
        password: req.body.password
    }
    
    const { errors, valid } = validateLoginUser(credentials); 
    if(!valid) return res.status(400).json(errors);
    firebase.auth().signInWithEmailAndPassword(credentials.email, credentials.password)
        .then( data => {
            return data.user.getIdToken();
        })
        .then(token => {
            res.status(200).json({token})
        })
        .catch(err => {
            console.error(err);
            res.status(403).json({general: 'Invalid Credentials'});
        })
}


exports.imageUpload = (req,res) => {
    const Busboy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');
    let imageFileName; 
    let imageToBeUploaded = {};
    if(req.method === 'POST'){
        const busboy = new Busboy({ headers: req.headers });
        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
            if(mimetype !== 'image/png' && mimetype !== 'image/jpeg'){
                return res.status(400).json({error: 'Image format should be png or jpg'})
            }
            const imageExtension = filename.split('.')[filename.split('.').length-1];
            imageFileName = `${Math.round(Math.random() * 1000000007)}.${imageExtension}`;
            const filepath = path.join(os.tmpdir(), imageFileName);
            imageToBeUploaded = { filepath, mimetype };
            file.pipe(fs.createWriteStream(filepath));
 
        });

        busboy.on('finish', ( () => {
            admin.storage().bucket().upload(imageToBeUploaded.filepath, {
                resumable: false,
                metadata: {
                    metadata: {
                        contentType: imageToBeUploaded.mimetype
                    }
                }
            })
            .then( () => {
                const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${imageFileName}?alt=media`;
                db.doc(`/users/${req.user.handle}`).update({imageUrl})
                    .then( (doc) => {
                        console.log(doc);
                        res.status(201).json({message: 'image uploaded successfully'});
                    })
                    .catch(err => {
                        console.log("error occured while uploading image", err);
                        res.status(500).json(err);
                    })
            })
        }))
        busboy.end(req.rawBody); 
    }
}

exports.updateDetails = (req,res) => {
    let userDetails = {};

    if(req.body.bio.trim() !== ''){
        userDetails.bio = req.body.bio.trim();
    }
    if(req.body.location.trim() !== ''){
        userDetails.location = req.body.location.trim();
    }
    if(Object.keys(userDetails).length > 0){
        db.doc(`/users/${req.user.handle}`).update(userDetails)
        .then( () => {
            res.json({message: "your profile was updated"});
        })
        .catch( err => {
            console.log('error while updating profile ',err);
            res.status(500).json("something went wrong");
        })       
    } else{
        res.json({});
    }
}

exports.getUserDetails = (req,res) => {
    let userData = {}
    db.doc(`/users/${req.params.handle}`)
        .get()
        .then( user => {
            if(user.exists){
                userData.user = user.data()
                return db.collection('posts')
                        .where('userHandle', '==', req.params.handle)
                        .orderBy('createdAt', 'desc')
                        .get()
            }
            else{
                res.status(404).json({error: 'User Not Found'})
            }
        })
        .then( posts => {
            userData.posts = []
            posts.forEach( post => {
                userData.posts.push({
                    ...post.data(),
                    postId: post.id
                })
            })
            return res.status(200).json(userData)
        })
        .catch(err => {
            console.error(err)
            return res.status(500).json({error: 'Something went wrong'}) 
        })
}

exports.getAuthenticatedUser = (req,res) => {
    let authenticatedUser = {  };
    
    db.doc(`/users/${req.user.handle}`).get()
    .then( user => {
        authenticatedUser.credentials = user.data();
        return db.collection('likes').where('userHandle', '==', req.user.handle).get()
    })
    .then( likes => {
        authenticatedUser.likes = [];
        likes.forEach(like => {
            authenticatedUser.likes.push(like.data());
        })
        return db.collection('notifications').where('recipient', '==', req.user.handle)
        .orderBy('createdAt', 'desc').limit(10).get();
    })
    .then( (notifications) => {
        authenticatedUser.notifications = [];
        notifications.forEach( notification => {
            authenticatedUser.notifications.push({
                ...notification.data(),
                notificationId: notification.id      
            })
        })
        res.status(200).json(authenticatedUser);
    })      
    .catch(err => {
        console.error("error while fetching user data ", err);
        res.status(500).json( {error: "something went wrong"} );
    })
}

exports.markNotificationsRead = (req,res) => {
    let batch = db.batch();
    req.body.forEach( notificationId => {
        const notification = db.doc(`/notifications/${notificationId}`);
        batch.update(notification, {read: true});
    });
    batch.commit()
        .then( () => {
            return res.json({message: 'notifications marked read'})
        })
        .catch(err => {
            console.log({err: err.code});
        })
}