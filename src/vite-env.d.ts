/// <reference types="vite/client" />

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

interface ElectronPrintOptions {
  html: string;
  paperWidth?: number;
  copies?: number;
  deviceName?: string;
}

interface Window {
  electronAPI?: {
    printSilent: (options: ElectronPrintOptions) => Promise<boolean>;
    getPrinters: () => Promise<Array<{ name: string; isDefault?: boolean }>>;
  };
}
