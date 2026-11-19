import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export type PickLogoResult =
  | { status: "success"; dataUri: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export async function pickAndCompressStoreLogoBase64(): Promise<PickLogoResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      status: "error",
      message:
        "Izin akses galeri foto ditolak. Aktifkan izin foto untuk memilih logo toko.",
    };
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });

  if (picked.canceled || !picked.assets || picked.assets.length === 0) {
    return { status: "cancelled" };
  }

  const asset = picked.assets[0];
  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 300, height: 300 } }],
      {
        compress: 0.78,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!manipulated.base64) {
      return {
        status: "error",
        message: "Gagal mengonversi gambar logo menjadi base64.",
      };
    }

    return {
      status: "success",
      dataUri: `data:image/jpeg;base64,${manipulated.base64}`,
    };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Gagal memproses gambar logo toko.",
    };
  }
}
