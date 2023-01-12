import { withIronSessionApiRoute } from "iron-session/next";
import { plaidClient, sessionOptions } from "@/utils/plaid";

export default withIronSessionApiRoute(exchangePublicToken, sessionOptions);

// TODO: change from any type to Request and Response (probably from axios)
async function exchangePublicToken(req: any, res: any) {
  const exchangeResponse = await plaidClient.itemPublicTokenExchange({
    public_token: req.body.public_token,
  });

  req.session.access_token = exchangeResponse.data.access_token;
  await req.session.save();
  res.send({ ok: true });
}
