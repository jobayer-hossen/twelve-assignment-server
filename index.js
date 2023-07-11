const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_PAYMENT_SECRETE_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req,res,next)=>{
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error: true , message : 'unAuthorize token'})
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token , process.env.VALID_TOKEN,(err, decoded)=>{
    if(err){
      return res.status(401).send({error: true , message : 'unAuthorize token'})
    }
    req.decoded =  decoded;
    next();
  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hxrsyqo.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// collection---
const userCollection = client.db('lensCraftDB').collection('user');
const classCollection = client.db('lensCraftDB').collection('addClass');
const allClassCollection = client.db('lensCraftDB').collection('allClass');
const enrollCollection = client.db('lensCraftDB').collection('enroll');
const selectedClassCollection = client.db('lensCraftDB').collection('selectedClass');
const instructorCollection = client.db('lensCraftDB').collection('instructorCollection');

  //  jwt ----
app.post('/validJWT', (req,res)=>{
  const email = req.body;
    const token = jwt.sign({email}, process.env.VALID_TOKEN, { expiresIn: '7d' });
    res.send({token});
  })
  // admin verify--
  const adminVerify = async (req, res, next) => {
    const email = req.decoded.email;
    const filter = { email: email };
    const user = await userCollection.findOne(filter);
    if (user?.role === 'admin') {
      return res.status(403).send({ error: true, message: 'forbidden message' });
    }
    next();
  }
  // instructor route ---
  const instructorVerify = async (req, res, next) => {
    const email = req.decoded.email;
    const filter = { email: email };
    const user = await userCollection.findOne(filter);
    if (user?.role === 'instructor') {
      return res.status(403).send({ error: true, message: 'forbidden message' });
    }
    next();
  }
// admin verify email ---
  app.get('/allUser/admin/:email', verifyJWT,adminVerify, async (req, res) => {
    const email = req.params.email;
    const query = { email: email }
    const user = await userCollection.findOne(query);
    const result = { admin: user?.role === 'admin' }
    res.send(result);
  })
  //  instructor verify email ---
  app.get('/allUser/instructor/:email', verifyJWT, instructorVerify, async (req, res) => {
    const email = req.params.email;
    const query = { email: email }
    const user = await userCollection.findOne(query);
    const result = { instructor: user?.role === 'instructor' }
    res.send(result);
  })

app.post('/addUser' , async(req,res)=>{
    const allUser = req.body;
    const query = {email: allUser.email};
    const existUser = await userCollection.findOne(query);
    if ( existUser ) {
      return res.send({message:'user already existing right now !'})
    }
    const result = await userCollection.insertOne(allUser);
    res.send(result);
  })
  app.get('/allUser' ,verifyJWT , adminVerify, async(req,res)=>{
    const result = await userCollection.find().toArray();
    res.send(result);
  })

  app.patch('/allUser/admin/:id' , async(req,res)=>{
    const userId = req.params.id;
    const filter = {_id : new ObjectId(userId)};
    const updateRole = {
      $set :{
        role: 'admin'
      }
    }
    const result = await userCollection.updateOne(filter,updateRole) 
    res.send(result);
  });
  app.patch('/allUser/instructor/:id' , async(req,res)=>{
    const userId = req.params.id;
    const filter = {_id : new ObjectId(userId)};
    const updateRole = {
      $set :{
        role: 'instructor'
      }
    }
    const result = await userCollection.updateOne(filter,updateRole) 
    res.send(result);
  });

  app.post('/addClass',verifyJWT,instructorVerify, async(req,res)=>{
    const addNewClass = req.body;
    const result  = await classCollection.insertOne(addNewClass);
    res.send(result);
  });

  app.get('/addClass/:email' , async(req,res)=>{
    const email = req.params.email;
    const filter = {instructorEmail : email}
    const result = await classCollection.find(filter).toArray();
    res.send(result);
  });
  app.get('/manageClass' ,verifyJWT,adminVerify, async(req,res)=>{
    const result = await classCollection.find().toArray();
    res.send(result);
  });
  app.get('/addClass/:id' , async(req,res)=>{
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await classCollection.findOne(query);
    res.send(result);
  });

  app.patch('/updateClass/:id' , async(req,res)=>{
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const updateClass = {
      $set: {
        className: req.body.className,
        price: req.body.price,
      },
    };
    const result = await classCollection.updateOne(query,updateClass);
    res.send(result);
  })

  app.patch('/addClass/feedback/:id' , async(req,res)=>{
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const sendFeedback = {
      $set: {
        feedback: req.body.feedback,
      },
    };
    const result = await classCollection.updateOne(query,sendFeedback);
    res.send(result);
  })

  app.patch('/addClass/approved/:id' , async(req,res)=>{
    const classId = req.params.id;
    const addClass = req.body.addClass;
    const filter = {_id : new ObjectId(classId)};
    const updateStatus = {
      $set :{
        status: 'approved'
      }
    }
    const updateResult = await classCollection.updateOne(filter,updateStatus)
    const result = await allClassCollection.insertOne(addClass);
    res.send({result,updateResult});
  });
  app.patch('/addClass/denied/:id' , async(req,res)=>{
    const classId = req.params.id;
    const filter = {_id : new ObjectId(classId)};
    const updateStatus = {
      $set :{
        status: 'denied'
      }
    }
    const result = await classCollection.updateOne(filter,updateStatus) 
    res.send(result);
  });

  app.get('/allClass', async (req,res)=>{
    const result = await allClassCollection.find().toArray();
    res.send(result);
  })

  app.post('/selectedClass', async(req,res)=>{
    const selectedClass = req.body;
    const result  = await selectedClassCollection.insertOne(selectedClass);
    res.send(result);
  });

  app.get('/getSelectedClass/:email', verifyJWT, async(req,res)=>{
    const email = req.params.email;
    const filter = {email : email}
    const result  = await selectedClassCollection.find(filter).toArray();
    res.send(result);
  });

   app.delete('/getSelectedClass/:id', async (req, res) => {
    const id = req.params.id;
    const query = {_id: new ObjectId(id) }
    const result = await selectedClassCollection.deleteOne(query);
    res.send(result);
    })

  app.get('/goPayment/:id', async(req,res)=>{
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await selectedClassCollection.findOne(query);
    res.send(result);
    });
  // stripe --------
  app.post('/createPayment',  async (req, res) => {
    const { price } = req.body;
    const totalPrice = parseInt ( price * 100 );
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalPrice,
      currency: 'usd',
      payment_method_types: ['card']
    });

    res.send({
      clientSecret: paymentIntent.client_secret
    })
  })
     // payment related api
     app.post('/enroll/:id', verifyJWT, async (req, res) => {
      const payment = req.body;
      const id = req.params.id;
      const insertResult = await enrollCollection.insertOne(payment);
      const query = {_id: new ObjectId(id)}
      const removeClass = await selectedClassCollection.deleteOne(query);
      const result = await classCollection.findOneAndUpdate(
        { _id: new ObjectId(payment.classId) },
        { $inc: {availableSeats: -1, enrolled: 1 } },
        { returnOriginal: false }
      )
      res.send({ result ,insertResult,removeClass});
    });

    app.get('/enroll/:email', async (req,res)=>{
      const email = req.params.email;
    const filter = {email : email}
      const result = await enrollCollection.find(filter).sort({date: -1}).toArray();
      res.send(result);
    }) 
    app.get('/successfullyPay/:email', verifyJWT, async (req,res)=>{
      const email = req.params.email;
    const filter = {email : email}
      const result = await enrollCollection.find(filter).toArray();
      res.send(result);
    }) 

    // instructor ---

    app.get('/allInstructor', async (req,res)=>{
      const result = await instructorCollection.find().toArray();
      res.send(result);
    })

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/' , (req,res)=>{
    res.send('LensCraft is Running')
})
app.listen(port,()=>{
    console.log(`Photographer is coming ${port}`)
})
