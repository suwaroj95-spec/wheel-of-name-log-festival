function publicUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

export const frogAssetRevision = '20260917-1';

function frogAssetUrl(path: string): string {
  return `${publicUrl(path)}?v=${frogAssetRevision}`;
}

export const assets = {
  frogIdle: frogAssetUrl('assets/frog-idle.runtime.png'),
  frogSwipe: frogAssetUrl('assets/frog-swipe.runtime.png'),
  frogCelebrate: frogAssetUrl('assets/frog-celebrate.runtime.png'),
  disc: publicUrl('assets/4.jpg'),
  background: publicUrl('assets/5.jpg'),
} as const;

export type FrogPose = 'idle' | 'swipe' | 'celebrate';

export const frogPoseAsset: Record<FrogPose, string> = {
  idle: assets.frogIdle,
  swipe: assets.frogSwipe,
  celebrate: assets.frogCelebrate,
};

export async function preloadFrogAssets(): Promise<void> {
  await Promise.all(Object.values(frogPoseAsset).map((src) => new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (typeof image.decode !== 'function') {
        resolve();
        return;
      }
      void image.decode().then(resolve, reject);
    };
    image.onerror = () => reject(new Error(`Failed to load mascot asset: ${src}`));
    image.src = src;
  })));
}
