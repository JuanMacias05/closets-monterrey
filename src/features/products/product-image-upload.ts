const MAX_IMAGE_SIDE = 1600;
const MAX_COMPRESSED_BYTES = 300 * 1024;

export function buildProductImageStoragePath(sellerId: string, productId: string, imageId = crypto.randomUUID()) {
  return `sellers/${sellerId}/products/${productId}/${imageId}.jpg`;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo comprimir la foto."));
    }, "image/jpeg", quality);
  });
}

/** Resize and compress a clothing photo before uploading it to public Storage. */
export async function prepareProductImage(file: File): Promise<{ file: File; width: number; height: number }> {
  if (!file.type.startsWith("image/")) throw new Error("Selecciona un archivo de imagen.");

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    let blob: Blob | null = null;

    for (const factor of [1, 0.88, 0.76, 0.66, 0.56, 0.48]) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * factor));
      canvas.height = Math.max(1, Math.round(height * factor));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Este navegador no puede procesar la foto.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await canvasToJpeg(canvas, 0.82);
      width = canvas.width;
      height = canvas.height;
      if (blob.size <= MAX_COMPRESSED_BYTES) break;
    }

    if (!blob || blob.size > MAX_COMPRESSED_BYTES) {
      throw new Error("La foto no pudo comprimirse por debajo de 300 KB. Prueba con otra imagen.");
    }

    const imageId = crypto.randomUUID();
    return {
      file: new File([blob], `${imageId}.jpg`, { type: "image/jpeg", lastModified: Date.now() }),
      width,
      height,
    };
  } finally {
    bitmap.close();
  }
}
