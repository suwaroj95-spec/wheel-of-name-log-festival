function publicUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

export const assets = {
  frogIdle: publicUrl('assets/1.png'),
  frogSwipe: publicUrl('assets/2.png'),
  frogCelebrate: publicUrl('assets/3.png'),
  disc: publicUrl('assets/4.jpg'),
  background: publicUrl('assets/5.jpg'),
} as const;

export type FrogPose = 'idle' | 'swipe' | 'celebrate';

export const frogPoseAsset: Record<FrogPose, string> = {
  idle: assets.frogIdle,
  swipe: assets.frogSwipe,
  celebrate: assets.frogCelebrate,
};
