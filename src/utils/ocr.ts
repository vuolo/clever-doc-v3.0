import type {
  BoundingPolyCoordinates,
  TextShard,
  TextShardGroup,
} from "@/types/ocr";

export const NEWLINES_REGEX = /\r?\n|\r/g;

export function strip(text?: string): string {
  return text ? text.replace(NEWLINES_REGEX, "").trim() : "";
}

export function getGroupedShardTexts(
  textShardGroup: TextShardGroup,
  removeNewlines = true
): string[] {
  return textShardGroup.textShards.map((t) =>
    removeNewlines ? strip(t.text) : t.text
  );
}

export function getTextShardWithinRange(
  textShards: TextShard[],
  coordinate: "x" | "y",
  start: number,
  end: number
): TextShard | undefined {
  // Return the first instance
  return textShards.find((textShard) =>
    isBoundingPolyWithinRange(
      textShard.boundingPoly.normalizedVertices,
      coordinate,
      start,
      end
    )
  );

  // Return all instances
  // return textShards.filter((textShard) =>
  //   isBoundingPolyWithinRange(
  //     textShard.boundingPoly.normalizedVertices,
  //     coordinate,
  //     start,
  //     end
  //   )
  // );
}

export function getTextShardGroupsWithinRange(
  textShardGroups: TextShardGroup[][],
  coordinate: "x" | "y",
  start: number,
  end: number
): TextShardGroup[][] {
  return textShardGroups.map((page) =>
    page.filter((textShardGroup) =>
      isBoundingPolyWithinRange(
        textShardGroup.boundingPoly.normalizedVertices,
        coordinate,
        start,
        end
      )
    )
  );
}

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
  // Get all the text shards within the same lines
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

        // (0.01 Y coordinate difference threshold for now)
        if (yDifference <= 0.01) {
          currentTextShardGroup.textShards.push(textShard);
        } else {
          let lineFound = false;
          // Check if the text shard belongs to a line that was already created
          for (let k = lines.length - 1; k >= 0; k--) {
            const line = lines[k];
            if (!line) continue;
            if (line.page !== i) {
              break;
            }
            const lastTextShardInLine =
              line.textShards[line.textShards.length - 1];
            if (!lastTextShardInLine) continue;
            const yDifference = Math.abs(
              textShard.boundingPoly.normalizedVertices.bottomLeft.y -
                lastTextShardInLine.boundingPoly.normalizedVertices.bottomLeft.y
            );
            if (yDifference <= 0.01) {
              // Add the text shard to the previous line
              line.textShards.push(textShard);
              lineFound = true;
              break;
            }
          }
          // If no matching line was found, create a new line
          if (!lineFound) {
            currentTextShardGroup = emptyTextShardGroup();
            currentTextShardGroup.page = i;
            currentTextShardGroup.textShards.push(textShard);
            lines.push(currentTextShardGroup);
          }
        }
      } else {
        currentTextShardGroup.textShards.push(textShard);
        lines.push(currentTextShardGroup);
        currentTextShardGroup = emptyTextShardGroup(i);
      }
    });
  });

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

function emptyTextShardGroup(page = 0): TextShardGroup {
  return {
    textShards: [],
    page,
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
