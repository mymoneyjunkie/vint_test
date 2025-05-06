import stripe from "stripe";

import { PORT, STRIPE_SECRET_KEY, BASE_URL1, BASE_URL2 } from "../config/env.js";

import dbConnectionPromise from "../config/db.js";

import { validationResult } from "express-validator";

import io, {deviceToSocketMap} from "../config/socket.js";

const Stripe = new stripe(STRIPE_SECRET_KEY);

export const seller_login = async (req, res, next) => {
  try {
    const { email, name } = req.body;

    const error = validationResult(req);

    if (!error.isEmpty()) {
      const messages = error.array().map(err => err.msg).join(', '); // Join all error messages
      const validationError = new Error(messages);
      validationError.name = "ValidationError";
      validationError.statusCode = 400;
      validationError.oldInput = { email: email, name: name }; // Attach oldInput to the error
      throw validationError;
    }

    else {
      const db = await dbConnectionPromise;

      const [rows] = await db.query(
        'SELECT * FROM admin WHERE email = ? AND name = ?',
        [email.toLowerCase(), name.toLowerCase()]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Seller not found. Invalid name or email.' });
      }

      const seller = rows[0];

      res.status(200).json({
        message: 'Login successful',
        seller: {
          id: seller.id,
          email: seller.email,
          name: seller.name,
          paymentLink: seller.paymentLink,
        },
      });
    }
  } 

  catch (error) {
    console.log("Login failed error: ", error);

    next(error);
  }
};

export const create_account_link = async (req, res, next) => {
  try {
    const { accountId } = req.body;

    const error = validationResult(req);

    if (!error.isEmpty()) {
      const messages = error.array().map(err => err.msg).join(', '); // Join all error messages
      const validationError = new Error(messages);
      validationError.name = "ValidationError";
      validationError.statusCode = 400;
      validationError.oldInput = {}; // Attach oldInput to the error
      throw validationError;
    }

    else {      
      const accountLink = await Stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${BASE_URL1}reauth?accountId=${accountId}`, // after successful onboarding
        return_url: `${BASE_URL1}onboard-success?accountId=${accountId}`, // after successful onboarding
        type: "account_onboarding",
      });

      if (!accountLink) {
        let error1 = new Error("Failed to add account. Try again...");
        error1.statusCode = 400;
        throw error1;
      }

      res.status(200).json({ url: accountLink.url });
    }
  } 

  catch (error) {
    console.log("Failed to create account link:", error);
    // res.status(500).send({ error: error.message });
    next(error);
  }
}

export const update_account = async (req, res, next) => {
  try {
    const connectedAccountId = req.params.account;
    const { payLink } = req.body;

    // Validate request data
    const error = validationResult(req);

    if (!error.isEmpty()) {
      const messages = error.array().map(err => err.msg).join(', ');
      const validationError = new Error(messages);
      validationError.name = "ValidationError";
      validationError.statusCode = 400;
      validationError.oldInput = { connectedAccountId, payLink }; // optional: include req.body if needed
      throw validationError;
    }

    // Update Stripe account with additional info
    // const account = await Stripe.accounts.retrieve(connectedAccountId);
    const account = await Stripe.accounts.retrieve(connectedAccountId);
    // console.log("Account found:", account.id);

    if (!account || !account.id) {
      throw new Error("Failed to update Stripe account.");
    }

    const dbConnection = await dbConnectionPromise;

    // Mark as onboarded in your DB
    const [result] = await dbConnection.query(
      "UPDATE admin SET isOnboarded = ?, paymentLink = ? WHERE id = ?",
      [true, payLink, account.id]
    );

    if (!result.affectedRows) {
      throw new Error("Failed to update onboarded status in DB.");
    }

    // Success response
    res.status(200).json({
      account: account.id,
    });
  } 

  catch (error) {
    console.log(
      "An error occurred when calling the Stripe API to update an account",
      error
    );
    next(error);
  }
}

export const create_new_account = async (req, res, next) => {
  try {
    let { email, name } = req.body;

    email = email ? email.toLowerCase() : email;
    name = name ? name.toLowerCase() : name;

    const error = validationResult(req);

    if (!error.isEmpty()) {
      const messages = error.array().map(err => err.msg).join(', '); // Join all error messages
      const validationError = new Error(messages);
      validationError.name = "ValidationError";
      validationError.statusCode = 400;
      validationError.oldInput = { email: email, name: name }; // Attach oldInput to the error
      throw validationError;
    }

    else {
      const account = await Stripe.accounts.create({
        type: "express",
        email,
        country: "RO",
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true }, // <--- REQUIRED for payment links
        },
        business_profile: {
          url: "https://h4kig.us/", // <--- REQUIRED
        },
        tos_acceptance: {
          service_agreement: 'full',
        },
      });

      // console.log(account);

      if (!account || !account.id) {
        const error1 = new Error("Failed to create Stripe account.");
        error1.statusCode = 500;
        throw error1;
      }

      // 2. Insert into DB
      const dbConnection = await dbConnectionPromise;

      // Check if already exists
      const [existing] = await dbConnection.query(
        "SELECT id FROM admin WHERE id = ? OR email = ?",
        [account.id, email]
      );

      if (existing.length > 0) {
        const error1 = new Error("Account or email already exists.");
        error1.statusCode = 409;
        throw error1;
      }

      // Insert new record
      const [result] = await dbConnection.query(
        "INSERT INTO admin (id, name, email) VALUES (?, ?, ?)",
        [account.id, name, email]
      );

      if (!result.affectedRows) {
        const error1 = new Error("Failed to insert seller into DB.");
        error1.statusCode = 500;
        throw error1;
      }

      res.status(200).json({ account: account.id });
    }
  } 

  catch (error) {
    console.log(
      "An error occurred when calling the Stripe API to create an account",
      error
    );
    next(error);
  }
}

export const create_payment_link = async (req, res, next) => {
  try {
    const { accountId, productName, productPrice, deviceID } = req.body;

    // console.log(accountId, productName, productPrice, deviceID);

    const error = validationResult(req);

    if (!error.isEmpty()) {
      const messages = error.array().map(err => err.msg).join(', '); // Join all error messages
      const validationError = new Error(messages);
      validationError.name = "ValidationError";
      validationError.statusCode = 400;
      validationError.oldInput = { productName, productPrice }; // Attach oldInput to the error
      throw validationError;
    }

    else {
      // 1. Create Product
      const product = await Stripe.products.create(
        {
          name: productName,
        },
        {
          stripeAccount: accountId, // Important! Create product for connected seller
        }
      );

      // console.log(product);

      // 2. Create Price
      const price = await Stripe.prices.create(
        {
          unit_amount: productPrice * 100, // e.g., $10 → 1000 cents
          currency: "ron",
          product: product.id,
        },
        {
          stripeAccount: accountId, // Again, for seller's account
        }
      );

      // console.log(price);

      // 3. Create Payment Link
      const paymentLink = await Stripe.paymentLinks.create(
        {
          line_items: [
            {
              price: price.id,
              quantity: 1,
            },
          ],
          after_completion: {
            type: 'redirect',
            redirect: {
              url: `${BASE_URL1}user?customer={CHECKOUT_SESSION_ID}&account=${accountId}`,  // your frontend success page
            },
          },
          customer_creation: 'always',
          metadata: {
            buyer_name: "John Doe", // saved with the session but not shown to buyer
          },
        },
        {
          stripeAccount: accountId,
        }
      );

      // console.log(paymentLink);

      res.status(200).json({ url: `${paymentLink.url}?client_reference_id=${deviceID}` });
    }
  } 

  catch (error) {
    console.log("Failed to create payment link:", error);
    // res.status(500).send({ error: error.message });
    next(error);
  }
}

export const check_user_session = async (req, res, next) => {
  try {
    const sessionId = req.query?.customer || '';
    const connectedAccountId = req.query.account;

    if (!sessionId || !connectedAccountId) {
      return res.status(400).send('Missing session_id or account');
    }
    
    else {
      // const session = await Stripe.checkout.sessions.retrieve(sessionId);
      const session = await Stripe.checkout.sessions.retrieve(sessionId, {
        stripeAccount: connectedAccountId,
      });
      const clientId = session?.client_reference_id;
      const socketId = deviceToSocketMap.get(clientId);
      const amountPaid = +session?.amount_total || 0;

      // console.log(deviceToSocketMap);

      const dbConnection = await dbConnectionPromise;

      // console.log("socketId: ", socketId);
      // console.log("clientId: ", clientId);
      // console.log("Session: ", sessionId, session.payment_status);
      // console.log(session.payment_status === 'paid' && socketId, session);

      if (session.payment_status === 'paid') {
        const selectQuery = `SELECT amount FROM users WHERE device_id = ?`;
        // console.log(selectQuery, [clientId]);
        const response1 = await dbConnection.query(selectQuery, [clientId]);

        const currentAmount = response1[0][0]?.amount || 0;
        
        // console.log(response1, currentAmount);

        // Calculate new amount
        const newAmount = parseFloat(currentAmount) + parseFloat(amountPaid)/100;
        
        // console.log(newAmount);

        // Update query to update the session_id and amount
        const updateQuery = `
          UPDATE users
          SET session_id = ?, amount = ?
          WHERE device_id = ?
        `;
        
        // Perform the update
        const response2 = await dbConnection.query(updateQuery, [sessionId, newAmount, clientId]);

        io.getIO().to(clientId).emit("success", { action: "create", data: { value: true, session_id: sessionId } });

        return res.redirect("/success");
      } 

      else {
        io.getIO().to(clientId).emit("success", { action: "create", data: { value: false, session_id: sessionId } });
        return res.redirect('/cancel'); // Redirect to the cancel page if the payment failed or is incomplete
      }
    }
  }

  catch (error) {
    console.log("check user session id: ", error);

    next(error);
  }
}

export const show_success = async (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'text/html');
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Payment Success</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f0fff4;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            max-width: 600px;
          }
          h1 {
            color: #28a745;
            margin-bottom: 20px;
          }
          p {
            font-size: 18px;
            color: #333;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Payment Successful!</h1>
          <p>Your transaction was successful. Thank you for your payment!</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    next(error);
  }
};

export const show_cancel = async (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'text/html');
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Payment Canceled</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #fff5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            max-width: 600px;
          }
          h1 {
            color: #dc3545;
            margin-bottom: 20px;
          }
          p {
            font-size: 18px;
            color: #555;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Payment Canceled</h1>
          <p>Payment was canceled. Please try again or contact support if you need help.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    next(error);
  }
};

export const check_balance = async (req, res, next) => {
  try {
    const { accountId } = req.body;

    // console.log(accountId);

    const error = validationResult(req);

    if (!error.isEmpty()) {
      const messages = error.array().map(err => err.msg).join(', '); // Join all error messages
      const validationError = new Error(messages);
      validationError.name = "ValidationError";
      validationError.statusCode = 400;
      validationError.oldInput = { accountId }; // Attach oldInput to the error
      throw validationError;
    }

    else {
      const balance = await Stripe.balance.retrieve({
        stripeAccount: accountId,
      });

      if (!balance) {
        throw new Error("Failed to fetch balance. Try again after some time...");
      }

      res.status(200).json({
        available: balance?.available,
        pending: balance?.pending
      })
    }
  }

  catch (error) {
    console.log("Get seller balance error: ", error);

    next(error);
  }
}

export const check_device_balance = async (req, res, next) => {
  try {
    const { deviceID } = req.body;

    // console.log(deviceID);

    const error = validationResult(req);

    if (!error.isEmpty()) {
      const messages = error.array().map(err => err.msg).join(', '); // Join all error messages
      const validationError = new Error(messages);
      validationError.name = "ValidationError";
      validationError.statusCode = 400;
      validationError.oldInput = { deviceID }; // Attach oldInput to the error
      throw validationError;
    }

    else {
      const dbConnection = await dbConnectionPromise;

      const selectQuery = `SELECT amount FROM users WHERE device_id = ?`;
      const response1 = await dbConnection.query(selectQuery, [deviceID]);

      if (!response1) {
        const error1 = new Error("operation failed.");
        error1.statusCode = 400;
        throw error1;
      }

      else {
        res.status(200).json({
          available: response1[0][0]?.amount,
          pending: 0
        })
      }
    }
  }

  catch (error) {
    console.log("Get device balance error: ", error);

    next(error);
  }
}

export const check_payouts = async (req, res, next) => {
  try {
    const { accountId } = req.body;

    const error = validationResult(req);

    if (!error.isEmpty()) {
      const messages = error.array().map(err => err.msg).join(', '); // Join all error messages
      const validationError = new Error(messages);
      validationError.name = "ValidationError";
      validationError.statusCode = 400;
      validationError.oldInput = { accountId }; // Attach oldInput to the error
      throw validationError;
    }

    else {
      const payouts = await Stripe.payouts.list({
        stripeAccount: accountId, // from your DB
      });

      // console.log(payouts, !payouts);

      if (!payouts) {
        throw new Error("Failed to fetch payouts. Try again after some time...");
      }

      res.status(200).json({
        payouts: payouts?.data
      })
    }
  }

  catch (error) {
    console.log("Get Payouts error: ", error);

    next(error);
  }
}

export const get_seller_details = async (req, res, next) => {
    try {
    const { accountId } = req.body;

    const error = validationResult(req);

    if (!error.isEmpty()) {
      const messages = error.array().map(err => err.msg).join(', '); // Join all error messages
      const validationError = new Error(messages);
      validationError.name = "ValidationError";
      validationError.statusCode = 400;
      validationError.oldInput = { accountId }; // Attach oldInput to the error
      throw validationError;
    }

    else {
      const account = await Stripe.accounts.retrieve(accountId);
      // console.log(account.requirements);

      if (!account) {
        throw new Error("Failed to get account details. Please try again...");
      }
      
      else {
        const loginLink = await Stripe.accounts.createLoginLink(accountId);
        // console.log(loginLink);

        if (!loginLink) {
          throw new Error("Failed to generate login link. Please try again...");
        }

        if (account.requirements?.eventually_due.length >= 1) {
          return res.json({ isVerificationCompleted: false, url: loginLink.url });
        }

        else {
          return res.json({ isVerificationCompleted: true, url: loginLink.url });
        }
      }

      // return res.json({ 
      //   id: account.individual?.id, 
      //   account_id: account.individual?.account, 
      //   email: account.individual?.email,
      //   country: account?.country,
      //   default_currency: account?.default_currency,
      //   business_type: account?.business_type,
      //   created: account.individual?.created,
      //   payouts_enabled: account?.payouts_enabled,
      //   capabilities: account?.capabilities,
      //   requirements: account.requirements?.eventually_due
      // })
    }
  }

  catch (error) {
    console.log("Get Login Link error: ", error);

    next(error);
  }
}

// for ID verification -> go to Profile -> Edit personal details -> ID verification
export const get_login_link = async (req, res, next) => {
  try {
    const { accountId } = req.body;
    
    // console.log(req.body);

    const error = validationResult(req);

    if (!error.isEmpty()) {
      const messages = error.array().map(err => err.msg).join(', '); // Join all error messages
      const validationError = new Error(messages);
      validationError.name = "ValidationError";
      validationError.statusCode = 400;
      validationError.oldInput = { accountId }; // Attach oldInput to the error
      throw validationError;
    }

    else {
      const loginLink = await Stripe.accounts.createLoginLink(accountId);
      // console.log(loginLink);

      if (!loginLink) {
        throw new Error("Failed to generate login link. Please try again...");
      }

      res.status(200).json({ url: loginLink.url });
    }
  }

  catch (error) {
    console.log("Get Login Link error: ", error);

    next(error);
  }
}

export const get_account_success = async (req, res, next) => {
  try {
    const {accountId} = req.query;
    
    // console.log("get_account_success: ", accountId);
    
    const error = validationResult(req);

    if (!error.isEmpty()) {
      const messages = error.array().map(err => err.msg).join(', '); // Join all error messages
      const validationError = new Error(messages);
      validationError.name = "ValidationError";
      validationError.statusCode = 400;
      validationError.oldInput = { accountId }; // Attach oldInput to the error
      throw validationError;
    }
    
    else {
      const loginLink = await Stripe.accounts.createLoginLink(accountId);
      // console.log(loginLink);

      if (!loginLink) {
        throw new Error("Failed to generate login link. Please try again...");
      }
      
      // return res.redirect(loginLink.url);
      res.setHeader('Content-Type', 'text/html');
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Stripe Onboarding Success</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f5f7fa;
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
              max-width: 600px;
            }
            h1 {
              color: #28a745;
              margin-bottom: 20px;
            }
            p {
              font-size: 18px;
              color: #333;
              margin-bottom: 20px;
            }
            a.button {
              display: inline-block;
              padding: 12px 25px;
              font-size: 16px;
              background-color: #007bff;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              transition: background-color 0.3s ease;
              margin-bottom: 30px;
            }
            a.button:hover {
              background-color: #0056b3;
            }
            .instructions {
              text-align: left;
              font-size: 16px;
              color: #444;
              margin-top: 20px;
              line-height: 1.6;
            }
            .instructions strong {
              color: #000;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Onboarding Successful!</h1>
            <p>You can now access your Stripe Dashboard using the link below:</p>
            <a class="button" href="${loginLink?.url}" target="_blank" rel="noopener noreferrer">Open Stripe Dashboard</a>

            <div class="instructions">
              <p><strong>Next steps:</strong></p>
              <ul>
                <li>Log in to your <strong>Stripe Dashboard</strong>.</li>
                <li>To verify your ID, go to <strong>Profile → Edit personal details → ID verification</strong>.</li>
                <li>You can also update your personal and business information from the profile section.</li>
              </ul>
              <p>This is your dashboard — feel free to explore and manage your account settings.</p>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    next(error);
  }
};

export const get_account_reauth = async (req, res, next) => {
  try {
    const {accountId} = req.query;
    
    // console.log("get_account_reauth: ", accountId);
    
    const error = validationResult(req);

    if (!error.isEmpty()) {
      const messages = error.array().map(err => err.msg).join(', '); // Join all error messages
      const validationError = new Error(messages);
      validationError.name = "ValidationError";
      validationError.statusCode = 400;
      validationError.oldInput = { accountId }; // Attach oldInput to the error
      throw validationError;
    }
    
    else {
      const accountLink = await Stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${BASE_URL1}reauth?accountId=${accountId}`, // after successful onboarding
        return_url: `${BASE_URL1}onboard-success?accountId=${accountId}`, // after successful onboarding
        type: "account_onboarding",
      });

      if (!accountLink) {
        let error1 = new Error("Failed to add account. Try again...");
        error1.statusCode = 400;
        throw error1;
      }
      
      // console.log(accountLink.url);
      
      res.setHeader('Content-Type', 'text/html');
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Reauthentication Required</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #fff0f0;
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
              max-width: 600px;
            }
            h1 {
              color: #dc3545;
              margin-bottom: 20px;
            }
            p {
              font-size: 18px;
              color: #555;
              margin-bottom: 30px;
            }
            a.button {
              display: inline-block;
              padding: 12px 25px;
              font-size: 16px;
              background-color: #007bff;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              transition: background-color 0.3s ease;
            }
            a.button:hover {
              background-color: #0056b3;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Onboarding Incomplete</h1>
            <p>It looks like your onboarding process wasn't completed. Please click the button below to try again.</p>
            <a class="button" href="${accountLink.url}" target="_blank" rel="noopener noreferrer">Retry Onboarding</a>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    next(error);
  }
};

export const get_payment_link = async (req, res, next) => {
  try {
    const { accountId } = req.body;

    const error = validationResult(req);

    if (!error.isEmpty()) {
      const messages = error.array().map(err => err.msg).join(', '); // Join all error messages
      const validationError = new Error(messages);
      validationError.name = "ValidationError";
      validationError.statusCode = 400;
      validationError.oldInput = { accountId }; // Attach oldInput to the error
      throw validationError;
    }

    else {
      const dbConnection = await dbConnectionPromise;

      const response = await dbConnection.query(
        "SELECT paymentLink FROM admin WHERE id = ?", [accountId]
      );

      // console.log(response);

      if (!response) {
        let error1 = new Error("Failed to get payment link. Try again...");
        error1.statusCode = 400;
        throw error1;
      }

      return res.status(200).json({ url: response[0][0].paymentLink });
    }
  }

  catch (error) {
    console.log("Get Payment Link error: ", error);

    next(error);
  }
}