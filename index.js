// * require
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

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
    const AppointmentOptions = client
      .db('doctorsportal')
      .collection('appointmentoptions');
    const BookingAppointment = client
      .db('doctorsportal')
      .collection('bookingappointment');

    // * end points
    // ! use aggregate to query multiple collection and then merge data!
    app.get('/appointmentoptions', async (req, res) => {
      const date = req.query.date;
      // console.log('🚀 ~ file: index.js ~ line 47 ~ app.get ~ date', date);
      const query = {};
      const cursor = AppointmentOptions.find(query);
      const result = await cursor.toArray();
      // ! steps
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
    app.post('/bookingappointment', async (req, res) => {
      const booking = req.body;
      console.log(
        '🚀 ~ file: index.js ~ line 55 ~ app.post ~ booking',
        booking
      );
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
  } finally {
  }
}
run().catch(console.dir);

// * listen
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
