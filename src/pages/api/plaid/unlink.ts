import type { NextApiRequest, NextApiResponse } from "next";

import { withIronSessionApiRoute } from "iron-session/next";
import { plaidClient, sessionOptions } from "@/utils/plaid";
import { type IronSession } from "iron-session";

export default withIronSessionApiRoute(unlink, sessionOptions);

async function unlink(req: NextApiRequest, res: NextApiResponse) {
  const session = req.session as IronSession & { access_token?: string };
  if (!session) {
    return {
      error: "No session",
    };
  }

  req.session.destroy();
  res.send({ ok: true });
}
