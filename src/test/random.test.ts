import { describe, expect, it } from 'vitest';
import { getUnbiasedRandomInt, pickRandomId } from '../utils/random';

function cryptoFrom(values: number[]): Crypto {
  let index = 0;
  return {
    getRandomValues<T extends ArrayBufferView>(array: T): T {
      (array as unknown as Uint32Array)[0] = values[index] ?? values[values.length - 1];
      index += 1;
      return array;
    },
  } as Crypto;
}

describe('random helpers', () => {
  it('stays in range', () => {
    const value = getUnbiasedRandomInt(5, cryptoFrom([9]));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(5);
  });

  it('selects one eligible participant ID', () => {
    expect(pickRandomId(['a', 'b', 'c'], cryptoFrom([1]))).toBe('b');
  });
});
