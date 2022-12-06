// * require
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_KEY);

const app = express();

// * middlewares
app.use(cors());
app.use(express.json());

// * port
const port = process.env.PORT || 5000;

// * end points
app.get('/', (req, res) => {
  res.send('Hello World!');
});

//verify jwt
function verifyjwt(req, res, next) {
  const authHead = req.headers.authorization;
  if (!authHead) {
    return res.status(401).send('Unauthorized');
  }
  const token = authHead.split(' ')[1];
  jwt.verify(token, process.env.TOKEN, function (err, decoded) {
    if (err) {
      return res.status(401).send('Unauthorized');
    }
    req.decoded = decoded;
    next();
  });
}

// * mongodb
const uri = process.env.DB_URI;
// console.log('🚀 ~ file: index.js ~ line 24 ~ uri', uri);
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// client.connect(err => {
//   const collection = client.db("test").collection("devices");
//   // perform actions on the collection object
//   client.close();
// });
async function run() {
  try {
    const Usersdata = client.db('doctorsportal').collection('usersdata');
    const DoctorsData = client.db('doctorsportal').collection('doctorsdata');
    const AppointmentOptions = client
      .db('doctorsportal')
      .collection('appointmentoptions');
    const BookingAppointment = client
      .db('doctorsportal')
      .collection('bookingappointment');

    // * make sure you use verify admin after verify jwt
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await Usersdata.findOne(query);
      if (user?.role !== 'Admin') {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };

    // * end points
    // ! use aggregate to query multiple collection and then merge data!
    app.get('/appointmentoptions', async (req, res) => {
      const date = req.query.date;
      // console.log('🚀 ~ file: index.js ~ line 47 ~ app.get ~ date', date);
      const query = {};
      const cursor = AppointmentOptions.find(query);
      const result = await cursor.toArray();
      // ! steps

      // ! get the bookings of the provided date
      const bookingQuery = { appointment_date: date };
      // console.log(
      //   '🚀 ~ file: index.js ~ line 55 ~ app.get ~ bookingQuery',
      //   bookingQuery
      // );
      const booked = await BookingAppointment.find(bookingQuery).toArray();
      // console.log('🚀 ~ file: index.js ~ line 55 ~ app.get ~ booked', booked);
      result.forEach((option) => {
        const bookedOption = booked.filter((b) => b.treatment === option.name);
        // console.log(
        //   '🚀 ~ file: index.js ~ line 58 ~ result.forEach ~ bookedOption',
        //   bookedOption
        // );
        const bookedSlot = bookedOption.map((b) => b.slot);
        const remaining = option.slots.filter(
          (slot) => !bookedSlot.includes(slot)
        );
        // console.log(
        //   '🚀 ~ file: index.js ~ line 63 ~ result.forEach ~ bookedSlot',
        //   date,
        //   option.name,
        //   remaining.length
        // );
        option.slots = remaining;
      });
      res.send(result);
    });

    // * end points
    app.get('/bookingappointment', verifyjwt, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(401).send('Unauthorized');
      }
      // console.log('🚀 ~ file: index.js ~ line 86 ~ app.get ~ email', email);
      const query = { email: email };
      const bookings = await BookingAppointment.find(query).toArray();
      res.send(bookings);
    });

    // * end points
    app.get('/bookingappointment/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await BookingAppointment.findOne(query);
      res.send(result);
    });

    // * end points
    app.post('/bookingappointment', async (req, res) => {
      const booking = req.body;
      // console.log(
      //   '🚀 ~ file: index.js ~ line 55 ~ app.post ~ booking',
      //   booking
      // );
      const query = {
        appointment_date: booking.appointment_date,
        email: booking.email,
        treatment: booking.treatment,
      };
      const alreadybooked = await BookingAppointment.find(query).toArray();
      if (alreadybooked.length) {
        return res.send({
          acknowledged: false,
          message: `You already have a booking on ${booking.appointment_date}`,
        });
      }
      const result = await BookingAppointment.insertOne(booking);
      res.send(result);
    });

    // * end points
    app.get('/jwt', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await Usersdata.findOne(query);
      // console.log('🚀 ~ file: index.js ~ line 122 ~ app.get ~ result', result);
      if (result) {
        const token = jwt.sign({ email }, process.env.TOKEN, {
          expiresIn: '1d',
        });
        return res.send({
          success: true,
          token: token,
        });
      }
      res.status(401).send({
        success: false,
        message: 'Unauthorized',
        token: '',
      });
    });

    // * end points
    app.get('/users', async (req, res) => {
      const query = {};
      const users = await Usersdata.find(query).toArray();
      res.send(users);
    });

    // * end points
    app.post('/users', async (req, res) => {
      const user = req.body;
      // console.log('🚀 ~ file: index.js ~ line 119 ~ app.post ~ user', user);
      const result = await Usersdata.insertOne(user);
      res.send(result);
    });

    // * end points
    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await Usersdata.findOne(query);
      res.send({ isAdmin: user?.role === 'Admin' });
    });

    // * end points
    app.put('/users/admin/:id', verifyjwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: 'Admin',
        },
      };
      const result = await Usersdata.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    // * end points
    app.delete('/users/:id', verifyjwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await Usersdata.deleteOne(filter);
      res.send(result);
    });

    // * end points
    app.get('/addprice', async (req, res) => {
      const filter = {};
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          price: 99,
        },
      };
      const result = await AppointmentOptions.updateMany(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // * end points
    app.get('/specialty', async (req, res) => {
      const query = {};
      const result = await AppointmentOptions.find(query)
        .project({ name: 1 })
        .toArray();
      res.send(result);
    });

    // * end points
    app.get('/doctors', verifyjwt, verifyAdmin, async (req, res) => {
      const query = {};
      // const result = await DoctorsData.find().toArray();
      const result = await DoctorsData.find(query).toArray();
      res.send(result);
    });

    // * end points
    app.post('/doctors', verifyjwt, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await DoctorsData.insertOne(doctor);
      res.send(result);
    });

    // * end points
    app.delete('/doctors/:id', verifyjwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await DoctorsData.deleteOne(filter);
      res.send(result);
    });

    // ! stripe payment
    app.post('/create-payment-intent', async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = parseFloat(price * 100);
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
  } finally {
  }
}
run().catch(console.dir);

// * listen
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
