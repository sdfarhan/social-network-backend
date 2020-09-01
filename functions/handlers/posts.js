const { db } = require('../util/admin')

exports.createOnePost = (req,res) => {
    const resPost = {
        body: req.body.body,
        userHandle: req.user.handle,
        createdAt: new Date().toISOString(),
        userImage: req.user.imageUrl,
        commentCount: 0,
        likeCount: 0
    }
    
    db.collection('posts').add(resPost)
    .then( (post) => {
        resPost.postId = post.id;
        res.status(201).json(resPost);
    })
    .catch(err => {
        console.error(err);
        res.status(500).json({err});
    })
}

exports.getAllPosts = (req,res) => {
    db.collection('posts')
    .orderBy('createdAt', 'desc')
    .get()
    .then( posts => {
        let allPosts = [];
        posts.forEach( post => {
            console.log({...post.data(), postId: post.id}); 
            allPosts.push({
                ...post.data(),
                postId: post.id
            });
        });
        res.json(allPosts);
    })
    .catch( err => {
        console.log('error while retrieving posts', err);
        res.status(500).json(err);
    })
}

exports.getPost = (req,res) => {
    let postId = req.params.postId;
    let resPost = {};
    db.doc(`/posts/${postId}`).get()
    .then( post => {
        if(!post.exists)  res.status(404).json({ error: "post not found" });
        resPost = post.data();
        resPost.postId = post.id;
        return db.collection('comments').orderBy('createdAt', 'desc').where('postId', '==', postId).get()
    })
    .then( comments => {
        resPost.comments = [];
        comments.forEach( comment => {
            resPost.comments.push(comment.data())
        })
        res.json(resPost);
    })
    .catch(err => {
        console.log("error while fetching post ",err);
        res.status(500).json({error: "something went wrong"})
    })
}

exports.commentOnPost = (req,res) => {
    if(req.body.comment.trim() === '') res.status(400).json({error: 'Comment Must not be empty'});
    let resComment = {
        postId: req.params.postId,
        comment: req.body.comment,
        createdAt: new Date().toISOString(),
        userHandle: req.user.handle,
        userImage: req.user.imageUrl
    }
    let commentCount;
    db.doc(`/posts/${req.params.postId}`).get()
    .then( doc => {
        if(!doc.exists)
            res.status(404).json({error: "Post Not found"})
        commentCount = doc.data().commentCount; 
        return db.doc(`/posts/${req.params.postId}`).update({commentCount: commentCount+1})
    })
    .then( ()  => {
        return db.collection('comments').add(resComment)
    })
    .then( comment => {
        resComment.id = comment.id
        return res.status(201).json(resComment)
    })
    .catch(err => {
        console.log("error while adding coment ",err);
        res.status(500).json({errro: 'something went wrong'});
    })
}

exports.likeUnlikePost = (req,res) => { 
    let likesDocument = db.collection('likes')
                        .where('postId', '==', req.params.postId)
                        .where('userHandle', '==', req.user.handle)
                        .limit(1)
    let postDocument = db.doc(`/posts/${req.params.postId}`);
    let postData;
    postDocument.get()
        .then( _postData => {
            if(_postData.exists){
                postData = _postData.data();
                postData.postId = _postData.id;
                return likesDocument.get();
            }
            else    
                return res.status(404).json({error: 'No post found'});
        })
        .then( likeData => {
            if(likeData.empty){
                db.collection('likes').add({
                    postId: req.params.postId,
                    userHandle: req.user.handle
                })
                .then( () => {
                    postData.likeCount++;
                    return postDocument.update({likeCount: postData.likeCount})
                })
                .then( () => {
                    postData.like = true;
                    return res.status(200).json(postData);
                })
                .catch(err => {
                    console.log('error while liking the post', err);
                    res.status(500).json(err);
                })    
            } else{
                console.log(likeData.docs[0].id);
                db.doc(`/likes/${likeData.docs[0].id}`).delete()
                .then( () => {
                    postData.likeCount--;
                    return postDocument.update({likeCount: postData.likeCount})
                })
                .then( () => {
                    postData.like = false;  
                    return res.status(200).json(postData);
                })
                .catch(err => {
                    console.log('error while liking the post', err);
                    res.status(500).json(err);
                })
            }
        })

}

exports.deletePost = (req,res) => {
    
    const refPost = db.doc(`/posts/${req.params.postId}`);
    refPost.get()
        .then( post => {
            if(!post.exists)
                return res.status(404).json({error: 'post not found'});
            if(post.data().userHandle !== req.user.handle)
                return res.status(403).json({error: 'Unauthorized'});
            return refPost.delete()
        })
        .then( () => {
            res.json({message: 'post got deleted'});
        })
        .catch(err => {
            console.error('error while deleting post', err);
            res.status(500).json({error: 'Something went wrong'});
        })
}
