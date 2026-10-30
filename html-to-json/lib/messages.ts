import type { SourceTable } from './model';

/** What each frame reports back from `scripting.executeScript`. */
export interface FrameInfo {
  origin: string;
  /** Origins of this frame's child iframes, used to spot frames we couldn't inject into. */
  childOrigins: string[];
}

/** Messages the background broadcasts to every frame in the tab. */
export type FrameMessage =
  | { type: 'status' }
  | { type: 'start-picking'; missingOrigins?: string[] }
  | { type: 'picked'; token: string; source: SourceTable; frameUrl: string }
  | { type: 'stop' };

/** Messages sent from content scripts or extension pages to the background. */
export type BackgroundMessage =
  | { type: 'relay'; payload: FrameMessage }
  | { type: 'download'; filename: string; text: string; mime: string }
  | { type: 'request-access'; origins: string[] };

export type DownloadMessage = Extract<BackgroundMessage, { type: 'download' }>;
