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
