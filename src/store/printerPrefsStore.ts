import Storage from "expo-sqlite/kv-store";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

export type PrinterDeviceMode = "server" | "bluetooth" | "system";

export interface PairedBluetoothPrinter {
  name: string;
  address: string;
}

export const PRINTER_PREFS_STORAGE_KEY = "toko_rejeki_printer_prefs_v1";

const kvStateStorage: StateStorage = {
  getItem: (name) => {
    try {
      return Storage.getItemSync(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      Storage.setItemSync(name, value);
    } catch {
      // Ignore transient KV write failures
    }
  },
  removeItem: (name) => {
    try {
      Storage.removeItemSync(name);
    } catch {
      // Ignore removal error
    }
  },
};

export interface PrinterPrefsState {
  mode: PrinterDeviceMode;
  bluetoothDevice: PairedBluetoothPrinter | null;
  bluetoothPaperWidth: 58 | 80;
  defaultCopies: 1 | 2;
  previewBeforePrint: boolean;
  setMode: (mode: PrinterDeviceMode) => void;
  setBluetoothDevice: (device: PairedBluetoothPrinter | null) => void;
  setBluetoothPaperWidth: (width: 58 | 80) => void;
  setDefaultCopies: (copies: 1 | 2) => void;
  setPreviewBeforePrint: (preview: boolean) => void;
  resetForTest: () => void;
}

export const usePrinterPrefsStore = create<PrinterPrefsState>()(
  persist(
    (set) => ({
      mode: "server",
      bluetoothDevice: null,
      bluetoothPaperWidth: 58,
      defaultCopies: 1,
      previewBeforePrint: true,

      setMode: (mode) => set({ mode }),
      setBluetoothDevice: (bluetoothDevice) => set({ bluetoothDevice }),
      setBluetoothPaperWidth: (bluetoothPaperWidth) =>
        set({ bluetoothPaperWidth }),
      setDefaultCopies: (defaultCopies) => set({ defaultCopies }),
      setPreviewBeforePrint: (previewBeforePrint) => set({ previewBeforePrint }),
      resetForTest: () =>
        set({
          mode: "server",
          bluetoothDevice: null,
          bluetoothPaperWidth: 58,
          defaultCopies: 1,
          previewBeforePrint: true,
        }),
    }),
    {
      name: PRINTER_PREFS_STORAGE_KEY,
      storage: createJSONStorage(() => kvStateStorage),
      partialize: (state) => ({
        mode: state.mode,
        bluetoothDevice: state.bluetoothDevice,
        bluetoothPaperWidth: state.bluetoothPaperWidth,
        defaultCopies: state.defaultCopies,
        previewBeforePrint: state.previewBeforePrint,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.defaultCopies !== 1 && state.defaultCopies !== 2) {
          state.setDefaultCopies(1);
        }
      },
    }
  )
);
