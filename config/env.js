import { config } from "dotenv";

config({ path: `.env.${process.env.NODE_ENV || 'production'}.local` });

// console.log(process.env.PORT, process.env.NODE_ENV);

export const { 
	PORT, 
	BASE_URL1,
	BASE_URL2,
	STRIPE_SECRET_KEY,
	WEBHOOK_SECRET,
	HOST,
  	USER,
  	PASSWORD,
  	DATABASE 
} = process.env; 