export interface CaptionSegment {
  id: string;
  index: number;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
}
