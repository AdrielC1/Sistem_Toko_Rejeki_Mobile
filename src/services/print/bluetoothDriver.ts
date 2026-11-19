import { Buffer } from "buffer";
import { NativeModules, PermissionsAndroid, Platform } from "react-native";
import {
  registerBluetoothEscPosDriver,
  type BluetoothEscPosDriver,
} from "@/services/print/printerService";
import type { PairedBluetoothPrinter } from "@/store/printerPrefsStore";

type RNBluetoothClassicModule = {
  isBluetoothEnabled?: () => Promise<boolean>;
  getBondedDevices: () => Promise<Array<{ name?: string; address: string }>>;
  isDeviceConnected?: (address: string) => Promise<boolean>;
  connectToDevice: (
    address: string,
    options?: Record<string, unknown>
  ) => Promise<{
    write: (data: string | Buffer, encoding?: string) => Promise<boolean>;
  }>;
  writeToDevice?: (
    address: string,
    data: string | Buffer,
    encoding?: string
  ) => Promise<boolean>;
};

let initialized = false;

async function ensureAndroidBluetoothPermissions(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  const sdkInt =
    typeof Platform.Version === "number"
      ? Platform.Version
      : parseInt(String(Platform.Version), 10);

  if (Number.isFinite(sdkInt) && sdkInt >= 31) {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ].filter(Boolean);

    if (permissions.length > 0) {
      await PermissionsAndroid.requestMultiple(permissions);
    }
  }
}

function loadNativeBluetoothClassic(): RNBluetoothClassicModule | null {
  if (!NativeModules?.RNBluetoothClassic) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-bluetooth-classic");
    const resolved = (mod?.default ?? mod) as RNBluetoothClassicModule | null;
    if (!resolved || typeof resolved.getBondedDevices !== "function") {
      return null;
    }
    return resolved;
  } catch {
    return null;
  }
}

export function initBluetoothEscPosDriver(): boolean {
  if (initialized) {
    return Boolean(NativeModules?.RNBluetoothClassic);
  }
  initialized = true;

  const bt = loadNativeBluetoothClassic();
  if (!bt) {
    return false;
  }

  const driver: BluetoothEscPosDriver = {
    async scanPairedDevices(): Promise<PairedBluetoothPrinter[]> {
      await ensureAndroidBluetoothPermissions();
      if (typeof bt.isBluetoothEnabled === "function") {
        const enabled = await bt.isBluetoothEnabled();
        if (!enabled) {
          throw new Error(
            "Bluetooth HP belum aktif. Nyalakan Bluetooth terlebih dahulu."
          );
        }
      }
      const devices = await bt.getBondedDevices();
      return devices.map((d) => ({
        name: d.name?.trim() || d.address,
        address: d.address,
      }));
    },

    async writeRawBytes(
      deviceAddress: string,
      payload: Uint8Array
    ): Promise<void> {
      await ensureAndroidBluetoothPermissions();
      const buffer = Buffer.from(payload);

      let connected = false;
      if (typeof bt.isDeviceConnected === "function") {
        connected = await bt.isDeviceConnected(deviceAddress);
      }

      if (connected && typeof bt.writeToDevice === "function") {
        const ok = await bt.writeToDevice(deviceAddress, buffer);
        if (!ok) {
          throw new Error("Gagal menulis data struk ke printer Bluetooth.");
        }
        return;
      }

      const device = await bt.connectToDevice(deviceAddress, {
        connectorType: "rfcomm",
        SECURE_SOCKET: false,
      });
      const ok = await device.write(buffer);
      if (!ok) {
        throw new Error("Printer Bluetooth menolak data cetak ESC/POS.");
      }
    },
  };

  registerBluetoothEscPosDriver(driver);
  return true;
}
