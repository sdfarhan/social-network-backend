const functions = require('firebase-functions');
const app = require('express')();
const corsHandler = require('cors')({origin: true})
const FBAuth = require('./util/FBAuth');
const { db } = require('./util/admin');
const { createOnePost,
        getAllPosts,
        getPost,
        deletePost,
        commentOnPost,
        likeUnlikePost,
    } = require('./handlers/posts')
const { getAllUsers, 
        signupUser,
        loginUser,
        imageUpload,
        updateDetails,
        getUserDetails,
        getAuthenticatedUser,
        markNotificationsRead 
    } = require('./handlers/users')

app.use(corsHandler);
app.get('/', (request, response) => {
    response.send("server is up and running");
});

//post routes
// @getting all posts from database
app.get('/post', getAllPosts);
// @creating one post 
app.post('/post', FBAuth, createOnePost);
// @get an individual post 
app.get('/post/:postId', FBAuth, getPost);
// @comment on post
app.post('/post/:postId/comment', FBAuth, commentOnPost);
// @delete a comment
app.delete('/post/:postId', FBAuth, deletePost);

// @like/unlike a post
app.get('/post/:postId/like', FBAuth, likeUnlikePost);





// users routes
// @get all users in the database
app.get('/users', getAllUsers);
// @signup user 
app.post('/signup', signupUser);
// @login user
app.post('/login', loginUser);
// @get current loggedin user info
app.get('/user', FBAuth, getAuthenticatedUser);
// @get user details
app.get('/user/:handle', getUserDetails);
// @update userdetails
app.post('/user', FBAuth, updateDetails)
// @imageupload
app.post('/user/image', FBAuth, imageUpload);
// @mark notifications read
app.post('/notifications', FBAuth, markNotificationsRead);

exports.api = functions.region('asia-south1').https.onRequest(app);

exports.createNotificationOnLike = functions.region('asia-south1').firestore.document('likes/{id}')
    .onCreate( like => {
       return db.doc(`/posts/${like.data().postId}`).get()
            .then( post => {
                if(post.exists && post.data().userHandle !== like.data().userHandle){
                    return db.doc(`/notifications/${like.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: post.data().userHandle,
                        sender: like.data().userHandle,
                        type: 'like',
                        read: false,
                        postId: post.id  
                    })
                }
            })
            .catch(err => console.error('error while creating notification ', err))
    })

exports.createNotificationOnUnlike = functions.region('asia-south1').firestore.document('likes/{id}')
    .onDelete( like => {
        return db.doc(`/notifications/${like.id}`).delete()
            .then( () => {
                return;
            })
            .catch(err => console.error('error while creating notification ', err))
    })

exports.createNotificationOnComment = functions.region('asia-south1').firestore.document('comments/{id}')
    .onCreate( comment => {
        return db.doc(`/posts/${comment.data().postId}`).get()
            .then( post => {
                if(post.exists && post.data().userHandle !== comment.data().userHandle){
                    return db.doc(`/notifications/${comment.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: post.data().userHandle,
                        sender: comment.data().userHandle,
                        type: 'comment',
                        read: false,
                        postId: post.id  
                    })
                }
            })
            .catch(err => console.error('error while creating notification ', err));
    });

exports.onUserImageChange = functions.region('asia-south1').firestore.document('users/{userId}')
    .onUpdate( (change) => {
        if(change.before.data().imageUrl !== change.after.data().imageUrl){
            const batch = db.batch();
            return db.collection('posts').where('userHandle', '==', change.before.data().handle).get()
            .then( (posts) => {
                posts.forEach( (post) => {
                    batch.update(db.doc(`/posts/${post.id}`), {userImage: change.after.data().imageUrl})
                })
                return db.collection('comments').where('userHandle', '==', change.before.data().handle).get()
            })
            .then( comments => {
                comments.forEach( comment => {
                    batch.update(db.doc(`/comments/${comment.id}`), {userImage: change.after.data().imageUrl})
                })
                return batch.commit()                
            })
        } else{
            return true;
        }
    })

exports.onPostDelete = functions.region('asia-south1').firestore.document('/posts/{postId}')
    .onDelete( (deletedPost, context) => {
        postId = context.params.postId;
        const batch = db.batch();
        return db.collection('comments').where('postId', '==', postId).get()
            .then( comments => {
                comments.forEach( comment => {
                    batch.delete(db.doc(`/comments/${comment.id}`));
                })
                return db.collection('likes').where('postId', '==', postId).get()
            })
            .then( likes => {
                likes.forEach( like => {
                    batch.delete(db.doc(`/likes/${like.id}`));
                })
                return db.collection('notifications').where('postId', '==', postId).get()
            })
            .then( notifiations => {
                notifiations.forEach( notifiation => {
                    batch.delete(db.doc(`/notifiations/${notifiation.id}`));
                })
                batch.commit();
            })
            .catch( err => console.err(err));
    })