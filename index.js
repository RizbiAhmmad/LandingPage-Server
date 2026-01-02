const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const {
  createPayment,
  executePayment,
  queryPayment,
  searchTransaction,
  refundTransaction,
} = require("bkash-payment");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

app.use(cors());
app.use(express.json());

const bkashConfig = {
  base_url: "https://tokenized.sandbox.bka.sh/v1.2.0-beta",
  username: "01770618567",
  password: "D7DaC<*E*eG",
  app_key: "0vWQuCRGiUX7EPVjQDr0EUAYtc",
  app_secret: "jcUNPBgbcqEDedNKdvE4G1cAK7D3hCjmJccNPZZBq96QIxxwAMEx",
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jwqfj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

    const database = client.db("Landing-Page");
    const usersCollection = database.collection("users");
    const productsCollection = database.collection("products");
    const ordersCollection = database.collection("orders");

    app.post("/bkash-checkout", async (req, res) => {
      try {
        const { amount, callbackURL, orderID, reference } = req.body;
        const paymentDetails = {
          amount: amount || 10, // your product price
          callbackURL: callbackURL || "http://localhost:5000/bkash-callback", // your callback route
          orderID: orderID || "Order_101", // your orderID
          reference: reference || "1", // your reference
        };
        const result = await createPayment(bkashConfig, paymentDetails);
        res.send(result);
      } catch (e) {
        console.log(e);
      }
    });

    app.get("/bkash-callback", async (req, res) => {
      try {
        const { status, paymentID } = req.query;
        let result;
        let response = {
          statusCode: "4000",
          statusMessage: "Payment Failed",
        };
        if (status === "success")
          result = await executePayment(bkashConfig, paymentID);

        if (result?.transactionStatus === "Completed") {
          // payment success
          // insert result in your db
          console.log(result);
        }
        if (result)
          response = {
            statusCode: result?.statusCode,
            statusMessage: result?.statusMessage,
          };
        // You may use here WebSocket, server-sent events, or other methods to notify your client
        res.send(response);
      } catch (e) {
        console.log(e);
      }
    });

    // Add this route under admin middleware
    app.post("/bkash-refund", async (req, res) => {
      try {
        const { paymentID, trxID, amount } = req.body;
        const refundDetails = {
          paymentID,
          trxID,
          amount,
        };
        const result = await refundTransaction(bkashConfig, refundDetails);
        res.send(result);
      } catch (e) {
        console.log(e);
      }
    });

    app.get("/bkash-search", async (req, res) => {
      try {
        const { trxID } = req.query;
        const result = await searchTransaction(bkashConfig, trxID);
        res.send(result);
      } catch (e) {
        console.log(e);
      }
    });

    app.get("/bkash-query", async (req, res) => {
      try {
        const { paymentID } = req.query;
        const result = await queryPayment(bkashConfig, paymentID);
        res.send(result);
      } catch (e) {
        console.log(e);
      }
    });

    // POST endpoint to save user data (with role)
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      // console.log(req.headers);
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Get role by email
    app.get("/users/role", async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (!user) {
        return res.status(404).send({ role: null, message: "User not found" });
      }
      res.send({ role: user.role });
    });

    // PATCH endpoint to make a user an admin by ID
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: { role: "admin" } };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // DELETE endpoint to remove a user
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // Add product
    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });

    // Get all products
    app.get("/products", async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    });

    // Get single product by id
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    // Delete product
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    // Get all orders
    app.get("/orders", async (req, res) => {
      const result = await ordersCollection.find().toArray();
      res.send(result);
    });

    // Delete product
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Welcome to you in Landing page");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
