import { describe, it, expect } from 'vitest';
import { shortenAddress } from './utils';

describe('shortenAddress', () => {
  it('should return an empty string for null or undefined', () => {
    expect(shortenAddress(null)).toBe('');
    expect(shortenAddress(undefined)).toBe('');
  });

  it('should shorten a valid address correctly with default chars', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    // Default chars=4. Prefix: 4+2=6 ("0x1234"), Suffix: 4 ("678")
    // Wait, let's check implementation:
    // const prefix = value.slice(0, chars + 2);
    // const suffix = value.slice(-chars);
    // return `${prefix}...${suffix}`;
    
    // For chars=4:
    // prefix = slice(0, 6) -> "0x1234"
    // suffix = slice(-4) -> "5678"
    // Result: "0x1234...5678"
    
    expect(shortenAddress(address)).toBe('0x1234...5678');
  });

  it('should shorten a valid address correctly with custom chars', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    const chars = 6;
    // Prefix: 6+2=8 -> "0x123456"
    // Suffix: 6 -> "cdef78" (Wait, "def12345678".slice(-6) -> "567890abcdef..." is long)
    // Address end is ...5678
    // slice(-6) of ...ef12345678 is "345678"
    
    // Let's re-verify the input string length or just use logic.
    // Address: 0x...78
    // Suffix is last 6 chars.
    
    const input = '0x0000000000000000000000000000000000001111';
    // prefix(8) -> 0x000000
    // suffix(6) -> 001111
    
    expect(shortenAddress(input, 6)).toBe('0x000000...001111');
  });
});
