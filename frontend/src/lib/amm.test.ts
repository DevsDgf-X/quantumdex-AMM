import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeAddress, sortTokenAddresses, getDefaultFeeBps, createPool, addLiquidity, removeLiquidity, swap } from './amm';
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
    const mockAddLiquidity = vi.fn();
    const mockRemoveLiquidity = vi.fn();
    const mockSwap = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
      
      // Setup contract mock return
      (Contract as any).mockImplementation(() => ({
        defaultFeeBps: mockDefaultFeeBps,
        createPool: mockCreatePool,
        addLiquidity: mockAddLiquidity,
        removeLiquidity: mockRemoveLiquidity,
        swap: mockSwap,
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

    describe('addLiquidity', () => {
      it('should call contract addLiquidity with correct arguments', async () => {
        const poolId = '0xPoolId';
        const amount0 = 100n;
        const amount1 = 200n;
        
        const mockTx = { hash: '0xTxHash', wait: vi.fn() };
        mockAddLiquidity.mockResolvedValue(mockTx);

        const result = await addLiquidity(poolId, amount0, amount1, mockContractAddress, mockSigner);

        expect(mockAddLiquidity).toHaveBeenCalledWith(poolId, amount0, amount1);
        expect(result).toBe(mockTx);
      });
    });

    describe('removeLiquidity', () => {
      it('should call contract removeLiquidity with correct arguments', async () => {
        const poolId = '0xPoolId';
        const liquidity = 500n;
        
        const mockTx = { hash: '0xTxHash', wait: vi.fn() };
        mockRemoveLiquidity.mockResolvedValue(mockTx);

        const result = await removeLiquidity(poolId, liquidity, mockContractAddress, mockSigner);

        expect(mockRemoveLiquidity).toHaveBeenCalledWith(poolId, liquidity);
        expect(result).toBe(mockTx);
      });
    });

    describe('swap', () => {
      it('should call contract swap with correct arguments', async () => {
        const poolId = '0xPoolId';
        const tokenIn = '0xTokenIn';
        const amountIn = 1000n;
        const minAmountOut = 950n;
        const recipient = '0xRecipient';
        
        const mockTx = { hash: '0xTxHash', wait: vi.fn() };
        mockSwap.mockResolvedValue(mockTx);

        const result = await swap(poolId, tokenIn, amountIn, minAmountOut, recipient, mockContractAddress, mockSigner);

        expect(mockSwap).toHaveBeenCalledWith(poolId, getAddress(tokenIn), amountIn, minAmountOut, getAddress(recipient));
        expect(result).toBe(mockTx);
      });
    });
  });
});
