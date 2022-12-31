import type { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/server/db/client";
import * as fileHandler from "@/utils/file-handler";

export default async function uploads(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ error: "This API call only accepts the GET method." });
  }

  const parameters = req.query.parameters;

  if (
    !parameters ||
    parameters.length !== 2 ||
    !parameters[0] ||
    !parameters[1]
  )
    return res
      .status(400)
      .json({ error: "Missing required parameters. (userId or hash)" });

  const userId = parameters[0],
    hash = parameters[1];

  // Get the PDF file from the database
  let file;
  try {
    file = await prisma.file.findFirst({
      where: {
        userId,
        hash,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "This file does not exist." });
  }

  if (!file) return res.status(404).send(null);

  const blob = fileHandler.base64ToBlob(file.contents);

  res.setHeader("Content-Disposition", `inline; filename=${file.name};`);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", blob.size);

  return res.status(200).end(Buffer.from(await blob.arrayBuffer()));
}
