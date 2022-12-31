export type TextShard = {
  text: string;
  page: number;
  indices: {
    start: number;
    end: number;
  };
  boundingPoly: {
    vertices: BoundingPolyCoordinates;
    normalizedVertices: BoundingPolyCoordinates;
  };
};

export type BoundingPolyCoordinates = {
  topLeft: Coordinates;
  topRight: Coordinates;
  bottomLeft: Coordinates;
  bottomRight: Coordinates;
};

export type Coordinates = {
  x: number;
  y: number;
};
