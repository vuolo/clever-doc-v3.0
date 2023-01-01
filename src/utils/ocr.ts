import type {
  BoundingPolyCoordinates,
  TextShard,
  TextShardGroup,
} from "@/types/ocr";

// Check whether the bounding poly is within the specified range
// Example: coordinate = "x", start = 0.1, end = 0.8, check if the coordinates are within 0.1 and 0.8 on the x-axis
export function isBoundingPolyWithinRange(
  coordinates: BoundingPolyCoordinates,
  coordinate: "x" | "y",
  start: number,
  end: number
) {
  return (
    coordinates.topLeft[coordinate] >= start &&
    coordinates.topLeft[coordinate] <= end &&
    coordinates.topRight[coordinate] >= start &&
    coordinates.topRight[coordinate] <= end &&
    coordinates.bottomLeft[coordinate] >= start &&
    coordinates.bottomLeft[coordinate] <= end &&
    coordinates.bottomRight[coordinate] >= start &&
    coordinates.bottomRight[coordinate] <= end
  );
}

export function getTextShardsAsLines(
  textShards: TextShard[][],
  separateByPage = true
): TextShardGroup[] | TextShardGroup[][] {
  // Get all the text shards within the same line (0.01 Y coordinate difference threshold for now)
  const lines = [] as TextShardGroup[];
  let currentTextShardGroup = emptyTextShardGroup();
  textShards.forEach((page, i) => {
    page.forEach((textShard, j) => {
      // If the text shard is on a different page, push the current text shard group to the lines array
      if (separateByPage && currentTextShardGroup.page !== i) {
        lines.push(currentTextShardGroup);
        currentTextShardGroup = emptyTextShardGroup();
        currentTextShardGroup.page = i;
      }

      // If the text shard is on the same page, check if it's on the same line as the previous text shard
      const previousTextShard = page[j - 1];
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
          currentTextShardGroup.page = i;
          currentTextShardGroup.textShards.push(textShard);
        }
      } else {
        currentTextShardGroup.textShards.push(textShard);
      }
    });
  });

  // Make sure to add the very last line to the lines array
  lines.push(currentTextShardGroup);

  // Then, combine the furthest left and furthest right bounding boxes to get the line's combined bounding box
  lines.forEach((line) => {
    line.boundingPoly = getCombinedBoundingPoly(line);
  });

  // If separateByPage is true, then separate the lines by page
  if (separateByPage) {
    const linesByPage = [] as TextShardGroup[][];
    let currentPage = 0;
    let currentLines = [] as TextShardGroup[];
    lines.forEach((line) => {
      if (line.page !== currentPage) {
        linesByPage.push(currentLines);
        currentLines = [];
        currentPage = line.page;
      }
      currentLines.push(line);
    });
    linesByPage.push(currentLines);
    return linesByPage;
  }

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
    page: 0,
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
