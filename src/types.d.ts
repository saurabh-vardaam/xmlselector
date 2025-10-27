declare global {
  interface Window {
    flutter_inappwebview?: {
      callHandler: (handlerName: string, data: any) => void;
    };
    flutter_webview?: {
      postMessage: (message: string) => void;
    };
  }
}

export {};
