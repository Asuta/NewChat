export async function preparePortraitImage(
  url: string,
  createImage: () => HTMLImageElement = () => new Image(),
) {
  const image = createImage();

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else resolve();
    };
    const finishFromImageState = () => {
      if (image.naturalWidth > 0) {
        finish();
      } else {
        finish(new Error(`Unable to load portrait image: ${url}`));
      }
    };

    image.onload = finishFromImageState;
    image.onerror = () => finish(new Error(`Unable to load portrait image: ${url}`));
    image.src = url;
    if (image.complete) finishFromImageState();
  });

  if (typeof image.decode === 'function') {
    try {
      await image.decode();
    } catch {
      // A completed image is still safe to display when decode() is unavailable
      // for the resource or the browser rejects a redundant decode request.
      if (!image.complete || image.naturalWidth <= 0) {
        throw new Error(`Unable to decode portrait image: ${url}`);
      }
    }
  }

  return image;
}
