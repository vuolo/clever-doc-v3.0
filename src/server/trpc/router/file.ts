import { z } from "zod";

import { router, protectedProcedure } from "../trpc";
import { prisma } from "@/server/db/client";
import { type File } from "@prisma/client";

export const fileRouter = router({
  get: protectedProcedure
    .input(
      z.object({
        userId: z.string().cuid(),
        hash: z.string().cuid(),
      })
    )
    .query(({ input }) => {
      const file = prisma.file.findFirst({
        where: {
          userId: input.userId,
          hash: input.hash,
        },
      });

      return file;
    }),
  getAll: protectedProcedure
    .input(
      z.object({
        userId: z.string().cuid(),
      })
    )
    .query(({ input }) => {
      const files = prisma.file.findMany({
        where: {
          userId: input.userId,
        },
      });

      return files;
    }),
  upload: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().min(1).max(256),
        type: z.string(),
        size: z.number(),
        hash: z.string(),
        contents: z.any(),
      })
    )
    .mutation(async ({ input }) => {
      const previouslyUploadedFile = await prisma.file.findFirst({
        where: {
          userId: input.userId,
          hash: input.hash,
        },
      });
      if (previouslyUploadedFile) return previouslyUploadedFile;

      const uploadedFile = await prisma.file.create({
        data: input as File,
        select: {
          id: true,
        },
      });

      return uploadedFile;
    }),
});
