export {};

declare global {
  interface Window {
    electronAPI?: {
      print: () => void;
    };
  }
}
