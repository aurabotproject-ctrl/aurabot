/**
 * imageUtils.ts
 * Converts any uploaded image file to a WebP data-URL via an offscreen canvas.
 * WebP is ~25-35% smaller than JPEG and ~60-70% smaller than PNG at similar quality.
 */

/**
 * Convert a File (any format) to a WebP base64 data-URL.
 * Falls back to image/jpeg if the browser doesn't support WebP encoding
 * (extremely rare — all modern browsers support it).
 *
 * @param file      The raw File object from an <input type="file">
 * @param maxWidth  Resize so width ≤ maxWidth (maintains aspect ratio). Default 1200.
 * @param maxHeight Resize so height ≤ maxHeight (maintains aspect ratio). Default 1200.
 * @param quality   WebP quality 0–1. Default 0.88.
 */
export async function fileToWebP(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.88,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        // Calculate output dimensions preserving aspect ratio
        let { naturalWidth: w, naturalHeight: h } = img;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        if (h > maxHeight) { w = Math.round(w * maxHeight / h); h = maxHeight; }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context unavailable')); return; }

        ctx.drawImage(img, 0, 0, w, h);

        // Try WebP first, fall back to JPEG
        const webpUrl = canvas.toDataURL('image/webp', quality);
        if (webpUrl.startsWith('data:image/webp')) {
          resolve(webpUrl);
        } else {
          resolve(canvas.toDataURL('image/jpeg', quality));
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a raw data-URL (any format) to WebP.
 * Useful when you already have a data-URL from a FileReader elsewhere.
 */
export async function dataUrlToWebP(
  dataUrl: string,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.88,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      if (h > maxHeight) { w = Math.round(w * maxHeight / h); h = maxHeight; }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }

      ctx.drawImage(img, 0, 0, w, h);

      const webpUrl = canvas.toDataURL('image/webp', quality);
      resolve(webpUrl.startsWith('data:image/webp') ? webpUrl : canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}
