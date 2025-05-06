import express from "express";
import cors from "cors";
import stripe from "stripe";
import { PORT, STRIPE_SECRET_KEY, WEBHOOK_SECRET } from "./config/env.js";
import adminRouter from "./routes/admin.js";
import errorMiddleware from "./middleware/error.middleware.js";

import io, { deviceToSocketMap } from "./config/socket.js";

import http from "http";

const app = express();

const server = http.createServer(app);

// Initialize socket.io
const socketIO = io.init(server);

const Stripe = new stripe(STRIPE_SECRET_KEY);

app.set('trust proxy', 1);

app.use(cors({
    origin: "*", // Your frontend URL
    methods: ["GET", "POST"],
    credentials: true
}));

let processedSessions = new Set();

// Match the raw body to content type application/json
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
    // const endpointSecret = WEBHOOK_SECRET;

    const sig = req.headers['stripe-signature'];

    let event;
  
  // console.log(endpointSecret, sig);
  // console.log(req.body);

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    }
    catch (err) {
        console.log("first", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  
    // console.log(event.type);
  
    if (processedSessions.has(event.id)) {
      console.log(`Duplicate event received: ${event.id}`);
      return res.json({ received: true });
    }
    processedSessions.add(event.id);
  
  
    try {
        const { type, data } = event;
        let session = data.object;
        let customerId = session.id || null;
        const clientId = session?.client_reference_id || null;
        // const socketId = clientId ? deviceToSocketMap[clientId] : null;
        const socketId = clientId ? deviceToSocketMap.get(clientId) : null;
    
        // console.log(event.type, customerId);
      
        if (socketId) {
          // Handle the event
          switch (event.type) {  
            case 'checkout.session.completed':
                // session = event.data.object;
                // console.log(`completed ${customerId}`);
              const customerEmail = session.customer_details.email;
              const amountPaid = session.amount_total;
              const connectedAccount = session.account; // If you passed this
              console.log("Payment success!", customerEmail, amountPaid);
              
              io.getIO().to(clientId).emit("success", { action: "create", data: {value: true, session_id: customerId} });
                break;
            case 'checkout.session.expired':
                // session = event.data.object;
                // console.log('expired');
              io.getIO().to(clientId).emit("success", { action: "create", data: {value: false, session_id: customerId} });
                break;
            case 'payment_intent.payment_failed':
                // session = event.data.object;
                // console.log('PaymentIntent was successful!');
                // console.log('Customer payment_intent payment_failed...');
              io.getIO().to(clientId).emit("success", { action: "create", data: {value: false, session_id: customerId} });
                break;
            case 'payment_intent.succeeded':
                // session = event.data.object;
                // console.log('PaymentIntent was successful!');
                // console.log('Customer payment_intent succeeded...');
              io.getIO().to(clientId).emit("success", { action: "create", data: {value: true, session_id: customerId} });
                break;
            default:
              console.log(`Unhandled event type ${event.type}`);
          }

          // Return a response to acknowledge receipt of the event
          return res.json({ success: true });
        }
      
        else {
          io.getIO().to(clientId).emit("success", { action: "create", data: { value: false, session_id: '' } });
          return res.json({ success: false });
        }
    }

    catch (error) {
      next(error);
    }
});

app.use(express.json());

app.use(express.urlencoded());

app.use(adminRouter);

// Add the catch-all route for handling invalid routes (404 Not Found)
app.use((req, res, next) => {
    const error = new Error("Page Not Found");
    error.statusCode = 404;
    next(error);
});

app.use(errorMiddleware);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening to localhost PORT ${PORT}!`);
})