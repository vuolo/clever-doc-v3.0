import { router } from "../trpc";
import { authRouter } from "./auth";
import { fileRouter } from "./file";
import { bscaRouter } from "./tools/bsca";

export const appRouter = router({
  auth: authRouter,
  file: fileRouter,
  bsca: bscaRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
