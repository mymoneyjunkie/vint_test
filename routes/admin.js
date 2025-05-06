import { Router } from "express";

import { body, param, query } from "express-validator";

import { 
	seller_login,
	create_account_link, 
	update_account, 
	create_new_account, 
	create_payment_link, 
	check_user_session, 
	show_success, 
	show_cancel,
	check_balance,
  check_device_balance,
	check_payouts,
	get_seller_details,
	get_login_link,
  get_account_success,
	get_account_reauth,
  get_payment_link
} from "../controllers/admin.controller.js";

const adminRouter = Router();

adminRouter.get("/", (req, res) => {
  return res.send("hello world...");
})

adminRouter.post("/login",
	[
		body("name")
		    .trim()
		    .notEmpty().withMessage("Name is required.")
		    .isLength({ min: 2 }).withMessage("Name must be at least 2 characters long.")
		    .matches(/^[a-zA-Z\s]+$/).withMessage("Name must contain only letters and spaces."),
		body("email")
		    .trim()
		    .notEmpty().withMessage("Email is required.")
		    .isEmail().withMessage("Invalid email address.")
		    .normalizeEmail()
	], 
	seller_login
);

adminRouter.post("/create-account-link", 
	[
	    body("accountId")
	      .trim()
	      .notEmpty()
	      .withMessage("accountId is required.")
	      .matches(/^[A-Za-z0-9_]+$/)
	      .withMessage("Invalid Account ID...")
	],
	create_account_link
);

adminRouter.post("/account/:account", 
	[
	    param("account")
	      .trim()
	      .notEmpty()
	      .withMessage("account is required.")
	      .matches(/^[A-Za-z0-9_]+$/)
	      .withMessage("Invalid Account ID..."),
	    body("payLink")
	    	.trim()
	    	.notEmpty()
	    	.withMessage("Payment Link required.")
	    	.isURL()
	    	.withMessage("Invalid payment Link...")
	],
	update_account
);

adminRouter.post("/account",
	[
		body("name")
		    .trim()
		    .notEmpty().withMessage("Name is required.")
		    .isLength({ min: 2 }).withMessage("Name must be at least 2 characters long.")
		    .matches(/^[a-zA-Z\s]+$/).withMessage("Name must contain only letters and spaces."),

		body("email")
		    .trim()
		    .notEmpty().withMessage("Email is required.")
		    .isEmail().withMessage("Invalid email address.")
		    .normalizeEmail()
	], 
	create_new_account
);

adminRouter.post("/create-payment-link", 
	[
		body("productName")
		    .trim()
		    .notEmpty().withMessage("Product Name required")
		    .matches(/^[a-zA-Z0-9-_\s]+$/).withMessage("Invalid Product Name."),
		body("productPrice")
		    .trim()
		    .notEmpty().withMessage("Product Price required")
		    .isFloat({ gt: 0 }).withMessage("Invalid Product Price. Must be a positive number."),
		body("deviceID")
			.trim()
	        .notEmpty()
	        .withMessage("Device ID is required.")
	        .matches(/^[A-Za-z0-9-]+$/)
	        .withMessage("Invalid Device ID...")
	],
	create_payment_link
);

adminRouter.get("/user",
	[
		query("customer")
			.trim()
			.notEmpty()
			.withMessage("customer is required.")
	      	.matches(/^[A-Za-z0-9_]+$/)
	      	.withMessage("Invalid customer value..."),
	],
 	check_user_session
);

adminRouter.get("/success", show_success);

adminRouter.get("/cancel", show_cancel);

adminRouter.post("/balance",
  [
	    body("accountId")
	      .trim()
	      .notEmpty()
	      .withMessage("accountId is required.")
	      .matches(/^[A-Za-z0-9_]+$/)
	      .withMessage("Invalid Account ID...")
	],
  check_balance
);

adminRouter.post("/device-balance", 
  [
    body("deviceID")
			.trim()
	    .notEmpty()
	    .withMessage("Device ID is required.")
	    .matches(/^[A-Za-z0-9-]+$/)
	    .withMessage("Invalid Device ID...")
  ],
  check_device_balance
);

adminRouter.post("/payouts", 
  [
	    body("accountId")
	      .trim()
	      .notEmpty()
	      .withMessage("accountId is required.")
	      .matches(/^[A-Za-z0-9_]+$/)
	      .withMessage("Invalid Account ID...")
	],
  check_payouts
);

adminRouter.post("/details", 
	[
	    body("accountId")
	      .trim()
	      .notEmpty()
	      .withMessage("accountId is required.")
	      .matches(/^[A-Za-z0-9_]+$/)
	      .withMessage("Invalid Account ID...")
	],
	get_seller_details
);

adminRouter.post("/login-link",
	[
	    body("accountId")
	      .trim()
	      .notEmpty()
	      .withMessage("accountId is required.")
	      .matches(/^[A-Za-z0-9_]+$/)
	      .withMessage("Invalid Account ID...")
	], 
	get_login_link
);

adminRouter.get("/onboard-success", 
  [
	    query("accountId")
	      .trim()
	      .notEmpty()
	      .withMessage("accountId is required.")
	      .matches(/^[A-Za-z0-9_]+$/)
	      .withMessage("Invalid Account ID...")
	],
  get_account_success
);

adminRouter.get("/reauth", 
  [
	    query("accountId")
	      .trim()
	      .notEmpty()
	      .withMessage("accountId is required.")
	      .matches(/^[A-Za-z0-9_]+$/)
	      .withMessage("Invalid Account ID...")
	],
  get_account_reauth
);

adminRouter.post("/payment-link",
	[
	    body("accountId")
	      .trim()
	      .notEmpty()
	      .withMessage("accountId is required.")
	      .matches(/^[A-Za-z0-9_]+$/)
	      .withMessage("Invalid Account ID...")
	], 
	get_payment_link
);

export default adminRouter;
