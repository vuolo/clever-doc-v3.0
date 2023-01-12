import { z } from "zod";

import { router, protectedProcedure } from "../trpc";

import { plaidClient, sessionOptions } from "@/utils/plaid";
import { type IronSession } from "iron-session";

export const plaidRouter = router({
  getSession: protectedProcedure
    .input(
      z.object({
        req: z.any(),
      })
    )
    .query(async ({ input }) => {
      const req = input.req;
      const session = req.session as IronSession & { access_token?: string };
      if (!session) {
        return {
          error: "No session",
        };
      }
      const access_token = session.access_token;

      if (!access_token) {
        return {
          error: "No access token",
        };
      }

      const balanceResponse = await plaidClient.accountsBalanceGet({
        access_token,
      });
      const transactionsResponse = await plaidClient.transactionsGet({
        access_token,
        start_date: "2018-01-01",
        end_date: "2023-02-01",
      });

      return {
        props: {
          balance: balanceResponse.data,
          transactions: transactionsResponse.data,
        },
      };
    }),
});
