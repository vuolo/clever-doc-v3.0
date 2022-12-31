import { z } from "zod";

import { router, protectedProcedure } from "../../trpc";
import { parse } from "@/utils/tools/bsca/pdf-parser";

export const bscaRouter = router({
  parse: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        hash: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return parse(input);
    }),
});
