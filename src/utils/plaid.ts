import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { env } from "../env/server.mjs";

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[env.PLAID_ENV],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
        "PLAID-SECRET": env.PLAID_SECRET,
        "Plaid-Version": "2020-09-14",
      },
    },
  })
);

const sessionOptions = {
  cookieName: "cleverdoc_plaid_session",
  password: "WuvbXR78RGuFrrrdocPuEpibbkfIBA8EQjpRwmMkY8g=",
  // secure: true should be used in production (HTTPS) but can't be used in development (HTTP)
  cookieOptions: {
    secure: env.NODE_ENV === "production",
  },
};

export { plaidClient, sessionOptions };
