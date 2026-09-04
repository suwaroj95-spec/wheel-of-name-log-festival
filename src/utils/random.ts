export function getUnbiasedRandomInt(maxExclusive: number, cryptoSource: Crypto = crypto): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError('maxExclusive must be a positive safe integer');
  }

  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const buffer = new Uint32Array(1);

  do {
    cryptoSource.getRandomValues(buffer);
  } while (buffer[0] >= limit);

  return buffer[0] % maxExclusive;
}

export function pickRandomId(eligibleIds: string[], cryptoSource: Crypto = crypto): string {
  if (eligibleIds.length === 0) {
    throw new Error('No eligible participants remain');
  }
  return eligibleIds[getUnbiasedRandomInt(eligibleIds.length, cryptoSource)];
}
