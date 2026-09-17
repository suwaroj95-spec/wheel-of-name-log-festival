import { afterEach, describe, expect, it, vi } from 'vitest';
import { assets, frogAssetRevision, frogPoseAsset, preloadFrogAssets } from '../config/assets';

describe('mascot assets', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses base-aware, centrally versioned runtime URLs', () => {
    const baseUrl = import.meta.env.BASE_URL;
    expect(Object.values(frogPoseAsset)).toEqual([
      `${baseUrl}assets/frog-idle.runtime.png?v=${frogAssetRevision}`,
      `${baseUrl}assets/frog-swipe.runtime.png?v=${frogAssetRevision}`,
      `${baseUrl}assets/frog-celebrate.runtime.png?v=${frogAssetRevision}`,
    ]);
    expect(assets.frogIdle).not.toBe(assets.frogSwipe);
  });

  it('loads and decodes every frog pose before resolving', async () => {
    const decodedSources: string[] = [];

    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private source = '';

      set src(value: string) {
        this.source = value;
        queueMicrotask(() => this.onload?.());
      }

      async decode() {
        decodedSources.push(this.source);
      }
    }

    vi.stubGlobal('Image', FakeImage);
    await preloadFrogAssets();
    expect(decodedSources).toEqual(Object.values(frogPoseAsset));
  });
});
