import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeAddress, sortTokenAddresses, getDefaultFeeBps, createPool } from './amm';
import { isAddress, getAddress, Contract } from 'ethers';

// Mock ethers
vi.mock('ethers', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    Contract: vi.fn(),
  };
});

describe('AMM Helpers', () => {
  describe('normalizeAddress', () => {
    it('should normalize a valid address', () => {
      const validAddress = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
      const normalized = getAddress(validAddress);
      expect(normalizeAddress(validAddress)).toBe(normalized);
    });

    it('should normalize a valid address with whitespace', () => {
      const validAddress = ' 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 ';
      const normalized = getAddress(validAddress.trim());
      expect(normalizeAddress(validAddress)).toBe(normalized);
    });

    it('should throw an error for an invalid address', () => {
      const invalidAddress = '0xinvalid';
      expect(() => normalizeAddress(invalidAddress)).toThrow(`Invalid address: ${invalidAddress}`);
    });
  });

  describe('sortTokenAddresses', () => {
    it('should sort tokens correctly', () => {
      const tokenA = '0x1000000000000000000000000000000000000000';
      const tokenB = '0x2000000000000000000000000000000000000000';
      const result = sortTokenAddresses(tokenA, tokenB);
      expect(result.token0).toBe(getAddress(tokenA));
      expect(result.token1).toBe(getAddress(tokenB));
    });

    it('should sort tokens correctly when order is reversed', () => {
      const tokenA = '0x2000000000000000000000000000000000000000';
      const tokenB = '0x1000000000000000000000000000000000000000';
      const result = sortTokenAddresses(tokenA, tokenB);
      expect(result.token0).toBe(getAddress(tokenB));
      expect(result.token1).toBe(getAddress(tokenA));
    });

    it('should throw an error if addresses are identical', () => {
      const token = '0x1000000000000000000000000000000000000000';
      expect(() => sortTokenAddresses(token, token)).toThrow('Token addresses must be different');
    });
  });

  describe('Contract Interactions', () => {
    const mockProvider = {} as any;
    const mockSigner = {
      getAddress: vi.fn().mockResolvedValue('0xSigner'),
    } as any;
    const mockContractAddress = '0xContractAddress';

    // Mock contract methods
    const mockDefaultFeeBps = vi.fn();
    const mockCreatePool = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
      
      // Setup contract mock return
      (Contract as any).mockImplementation(() => ({
        defaultFeeBps: mockDefaultFeeBps,
        createPool: mockCreatePool,
      }));
    });

    describe('getDefaultFeeBps', () => {
      it('should return the default fee', async () => {
        const mockFee = 30n;
        mockDefaultFeeBps.mockResolvedValue(mockFee);

        const fee = await getDefaultFeeBps(mockContractAddress, mockProvider);
        
        expect(Contract).toHaveBeenCalledWith(mockContractAddress, expect.anything(), mockProvider);
        expect(mockDefaultFeeBps).toHaveBeenCalled();
        expect(fee).toBe(Number(mockFee));
      });
    });

    describe('createPool', () => {
      it('should call contract createPool with correct arguments', async () => {
        const tokenA = '0x1000000000000000000000000000000000000000';
        const tokenB = '0x2000000000000000000000000000000000000000';
        const amountA = 1000n;
        const amountB = 2000n;
        const feeBps = 30;
        
        const mockTx = { hash: '0xTxHash', wait: vi.fn() };
        mockCreatePool.mockResolvedValue(mockTx);

        const result = await createPool(tokenA, tokenB, amountA, amountB, feeBps, mockContractAddress, mockSigner);

        expect(mockCreatePool).toHaveBeenCalledWith(
          getAddress(tokenA),
          getAddress(tokenB),
          amountA,
          amountB,
          feeBps
        );
        expect(result).toBe(mockTx);
      });
    });
  });
});
