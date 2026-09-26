const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_HEIGHT = 900;
const JPEG_QUALITY = 0.68;

export function validateImage(file) {
  if (!file) throw new Error("Choose an issue photo.");
  if (!file.type.startsWith("image/")) throw new Error("Only image files are supported.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image must be under 8 MB before compression.");
}

export async function compressImageToBase64(file) {
  validateImage(file);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_WIDTH / bitmap.width, MAX_IMAGE_HEIGHT / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(bitmap, 0, 0, width, height);

  const imageData = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const imageHash = await computeAverageHash(bitmap);
  return {
    imageData,
    imageMimeType: "image/jpeg",
    imageSize: Math.ceil((imageData.length * 3) / 4),
    imageHash,
    width,
    height,
  };
}

const HASH_SIZE = 8;

// Lightweight 64-bit average-hash for a rough "do these two photos look
// similar" signal. This is a cheap heuristic, not a real perceptual-hashing
// library — used as a minor supporting weight in duplicate detection only.
async function computeAverageHash(bitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = HASH_SIZE;
  canvas.height = HASH_SIZE;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(bitmap, 0, 0, HASH_SIZE, HASH_SIZE);
  const { data } = ctx.getImageData(0, 0, HASH_SIZE, HASH_SIZE);

  const gray = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push((data[i] + data[i + 1] + data[i + 2]) / 3);
  }
  const average = gray.reduce((sum, value) => sum + value, 0) / gray.length;
  return gray.map((value) => (value >= average ? "1" : "0")).join("");
}

export function imageHashSimilarity(hashA, hashB) {
  if (!hashA || !hashB || hashA.length !== hashB.length) return 0;
  let matches = 0;
  for (let i = 0; i < hashA.length; i += 1) {
    if (hashA[i] === hashB[i]) matches += 1;
  }
  return matches / hashA.length;
}

// ─── EXIF GPS extraction (no external library) ───────────────────────────────
// Reads raw JPEG bytes to locate the APP1/EXIF segment and manually parse the
// GPS IFD so we can pre-fill the location from a live photo when available.

export async function extractExifGps(file) {
  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    // JPEG must start with FF D8
    if (view.getUint16(0) !== 0xffd8) return null;

    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      const segmentLength = view.getUint16(offset + 2);

      // APP1 marker = FF E1, must contain "Exif\0\0" header
      if (marker === 0xffe1 && segmentLength > 6) {
        const exifHeader = String.fromCharCode(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7),
        );
        if (exifHeader === "Exif") {
          const tiffStart = offset + 10; // skip APP1 marker (2) + length (2) + "Exif\0\0" (6)
          return parseGpsFromTiff(view, tiffStart);
        }
      }
      offset += 2 + segmentLength;
    }
  } catch {
    // Silently fail — EXIF parsing is best-effort
  }
  return null;
}

function parseGpsFromTiff(view, tiffStart) {
  const littleEndian = view.getUint16(tiffStart) === 0x4949;
  const readUint16 = (o) => view.getUint16(tiffStart + o, littleEndian);
  const readUint32 = (o) => view.getUint32(tiffStart + o, littleEndian);

  // IFD0 offset from tiff start
  const ifd0Offset = readUint32(4);
  const ifd0Count = readUint16(ifd0Offset);

  let gpsIfdOffset = null;
  for (let i = 0; i < ifd0Count; i++) {
    const entryOffset = ifd0Offset + 2 + i * 12;
    const tag = readUint16(entryOffset);
    if (tag === 0x8825) {
      gpsIfdOffset = readUint32(entryOffset + 8);
      break;
    }
  }
  if (gpsIfdOffset === null) return null;

  const gpsCount = readUint16(gpsIfdOffset);
  const gps = {};
  for (let i = 0; i < gpsCount; i++) {
    const entryOffset = gpsIfdOffset + 2 + i * 12;
    const tag = readUint16(entryOffset);
    const type = readUint16(entryOffset + 2);
    const count = readUint32(entryOffset + 4);

    if (tag === 1 || tag === 3) {
      gps[tag] = String.fromCharCode(view.getUint8(entryOffset + 8));
    } else if ((tag === 2 || tag === 4) && type === 5 && count === 3) {
      const valueOffset = readUint32(entryOffset + 8);
      const deg = readUint32(valueOffset) / readUint32(valueOffset + 4);
      const min = readUint32(valueOffset + 8) / readUint32(valueOffset + 12);
      const sec = readUint32(valueOffset + 16) / readUint32(valueOffset + 20);
      gps[tag] = deg + min / 60 + sec / 3600;
    }
  }

  const lat = gps[2] !== undefined ? (gps[1] === "S" ? -gps[2] : gps[2]) : null;
  const lng = gps[4] !== undefined ? (gps[3] === "W" ? -gps[4] : gps[4]) : null;
  if (lat === null || lng === null) return null;
  return { latitude: lat, longitude: lng, accuracy: null, fromExif: true };
}
