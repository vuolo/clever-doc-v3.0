import type { TextShard, TextShardGroup } from "@/types/ocr";

export function getTextShardsAsLines(textShards: TextShard[][]) {
  // Get all the text shards within the same line (0.01 Y coordinate difference threshold for now)
  const lines = [] as TextShardGroup[];
  let currentTextShardGroup = emptyTextShardGroup();
  textShards.forEach((page) => {
    page.forEach((textShard, index) => {
      const previousTextShard = page[index - 1];

      if (previousTextShard) {
        const yDifference = Math.abs(
          textShard.boundingPoly.normalizedVertices.bottomLeft.y -
            previousTextShard.boundingPoly.normalizedVertices.bottomLeft.y
        );

        if (yDifference <= 0.01) {
          currentTextShardGroup.textShards.push(textShard);
        } else {
          lines.push(currentTextShardGroup);
          currentTextShardGroup = emptyTextShardGroup();
          currentTextShardGroup.textShards.push(textShard);
        }
      } else {
        currentTextShardGroup.textShards.push(textShard);
      }
    });
  });

  // Then, combine the furthest left and furthest right bounding boxes to get the line's combined bounding box
  lines.forEach((line) => {
    line.boundingPoly = getCombinedBoundingPoly(line);
  });

  return lines;
}

function getCombinedBoundingPoly(
  line: TextShardGroup
): TextShardGroup["boundingPoly"] {
  return {
    vertices: {
      topLeft: {
        x: Math.min(
          ...line.textShards.map(
            (textShard) => textShard.boundingPoly.vertices.topLeft.x
          )
        ),
        y: Math.min(
          ...line.textShards.map(
            (textShard) => textShard.boundingPoly.vertices.topLeft.y
          )
        ),
      },
      topRight: {
        x: Math.max(
          ...line.textShards.map(
            (textShard) => textShard.boundingPoly.vertices.topRight.x
          )
        ),
        y: Math.min(
          ...line.textShards.map(
            (textShard) => textShard.boundingPoly.vertices.topRight.y
          )
        ),
      },
      bottomLeft: {
        x: Math.min(
          ...line.textShards.map(
            (textShard) => textShard.boundingPoly.vertices.bottomLeft.x
          )
        ),
        y: Math.max(
          ...line.textShards.map(
            (textShard) => textShard.boundingPoly.vertices.bottomLeft.y
          )
        ),
      },
      bottomRight: {
        x: Math.max(
          ...line.textShards.map(
            (textShard) => textShard.boundingPoly.vertices.bottomRight.x
          )
        ),
        y: Math.max(
          ...line.textShards.map(
            (textShard) => textShard.boundingPoly.vertices.bottomRight.y
          )
        ),
      },
    },
    normalizedVertices: {
      topLeft: {
        x: Math.min(
          ...line.textShards.map(
            (textShard) => textShard.boundingPoly.normalizedVertices.topLeft.x
          )
        ),
        y: Math.min(
          ...line.textShards.map(
            (textShard) => textShard.boundingPoly.normalizedVertices.topLeft.y
          )
        ),
      },
      topRight: {
        x: Math.max(
          ...line.textShards.map(
            (textShard) => textShard.boundingPoly.normalizedVertices.topRight.x
          )
        ),
        y: Math.min(
          ...line.textShards.map(
            (textShard) => textShard.boundingPoly.normalizedVertices.topRight.y
          )
        ),
      },
      bottomLeft: {
        x: Math.min(
          ...line.textShards.map(
            (textShard) =>
              textShard.boundingPoly.normalizedVertices.bottomLeft.x
          )
        ),
        y: Math.max(
          ...line.textShards.map(
            (textShard) =>
              textShard.boundingPoly.normalizedVertices.bottomLeft.y
          )
        ),
      },
      bottomRight: {
        x: Math.max(
          ...line.textShards.map(
            (textShard) =>
              textShard.boundingPoly.normalizedVertices.bottomRight.x
          )
        ),
        y: Math.max(
          ...line.textShards.map(
            (textShard) =>
              textShard.boundingPoly.normalizedVertices.bottomRight.y
          )
        ),
      },
    },
  };
}

function emptyTextShardGroup(): TextShardGroup {
  return {
    textShards: [],
    boundingPoly: {
      vertices: {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 0, y: 0 },
        bottomLeft: { x: 0, y: 0 },
        bottomRight: { x: 0, y: 0 },
      },
      normalizedVertices: {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 0, y: 0 },
        bottomLeft: { x: 0, y: 0 },
        bottomRight: { x: 0, y: 0 },
      },
    },
  };
}
