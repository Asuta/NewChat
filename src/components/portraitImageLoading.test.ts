import assert from 'node:assert/strict';
import test from 'node:test';
import { preparePortraitImage } from './portraitImageLoading';

interface FakeImageOptions {
  complete?: boolean;
  naturalWidth?: number;
  decode?: () => Promise<void>;
}

function createFakeImage(options: FakeImageOptions = {}) {
  return {
    complete: options.complete ?? false,
    naturalWidth: options.naturalWidth ?? 0,
    decode: options.decode ?? (() => Promise.resolve()),
    onerror: null,
    onload: null,
    src: '',
  } as unknown as HTMLImageElement;
}

test('a cached portrait is decoded before it is considered ready', async () => {
  let decoded = false;
  const image = createFakeImage({
    complete: true,
    naturalWidth: 1024,
    decode: async () => {
      decoded = true;
    },
  });

  const result = await preparePortraitImage('/happy.png', () => image);

  assert.equal(image.src, '/happy.png');
  assert.equal(decoded, true);
  assert.equal(result, image);
});

test('an uncached portrait remains pending until its load event', async () => {
  const image = createFakeImage();
  let ready = false;
  const request = preparePortraitImage('/angry.png', () => image).then(() => {
    ready = true;
  });

  await Promise.resolve();
  assert.equal(ready, false);

  Object.assign(image, { complete: true, naturalWidth: 1024 });
  image.onload?.(new Event('load'));
  await request;

  assert.equal(ready, true);
});

test('a failed portrait load rejects so callers can keep the previous image', async () => {
  const image = createFakeImage();
  const request = preparePortraitImage('/missing.png', () => image);

  image.onerror?.(new Event('error'));

  await assert.rejects(request, /Unable to load portrait image/);
});
