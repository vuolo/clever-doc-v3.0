import { plaidClient } from "@/utils/plaid";
import { CountryCode, Products } from "plaid";

import { env } from "../../../env/server.mjs";

// TODO: change from any type to Request and Response (probably from axios)
export default async function handler(req: any, res: any) {
  const tokenResponse = await plaidClient.linkTokenCreate({
    user: { client_user_id: env.PLAID_CLIENT_ID },
    client_name: "Clever Doc",
    language: "en",
    products: [Products.Auth],
    country_codes: [CountryCode.Us],
    redirect_uri: process.env.PLAID_SANDBOX_REDIRECT_URI,
  });

  return res.json(tokenResponse.data);
}
