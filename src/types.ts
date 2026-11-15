export type PlacementScheme = "DE" | "SE" | "custom";

export type CharacterPick = {
  name: string;
};

export type Entry = {
  id: string;
  placement: number;
  tag: string;
  sponsor: string;
  // lowercase country code, like "kr"
  country: string;
  handle: string;
  characters: CharacterPick[]; // up to 3
};

export type EventInfo = {
  name: string;
  game: string;
  subtitle: string;
  date: string;
  location: string;
  entrants: string;
  url: string;
  hashtag: string;
  scheme: PlacementScheme;
};

// Where the face is, so layouts can scale the art around it
export type ArtFrame = {
  // face centre, as a % of the image
  focusX: number;
  focusY: number;
  // face height as a share of the image height
  face: number;
  zoom: number;
};

export type ArtAsset = ArtFrame & {
  src: string;
  thumb?: string;
  source?: "builtin" | "upload";
  manual?: boolean;
};

export type ArtLibrary = Record<string, ArtAsset>;

export type Theme = {
  id: string;
  label: string;
  note?: string;
  // matched colours the user set by hand
  manual?: string[];
  bg: string;
  bg2: string;
  surface: string;
  surfaceEdge: string;
  accent: string;
  accentInk: string; // text that sits on the accent
  accent2: string;
  text: string;
  textDim: string;
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
};

export type BackgroundImage = {
  src: string;
  // "stage:<slug>" or "upload"
  id: string;
  label: string;
};

export type BackgroundStyle = {
  // shade opacity from 0 to 1
  dim: number;
  blur: number;
  posX: number;
  posY: number;
};

export type Format = { id: string; label: string; width: number; height: number };

export type AppState = {
  event: EventInfo;
  entries: Entry[];
  themeId: string;
  customThemes: Theme[];
  standingsFormat: string;
  background: BackgroundStyle;
};
