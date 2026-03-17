/**
 * CVR Calculation Unit Tests
 *
 * Tests the actual conversion rate computation logic, NOT mocked data.
 * This tests the real function that would have caught the Direct card bug
 * (10 visits, 14 signups).
 *
 * Rules:
 * - visits = 0 → null (no data to compute from)
 * - visits > 0, signups <= visits → real percentage
 * - visits > 0, signups > visits → real percentage (>100%, signals incomplete tracking)
 */
import { describe, it, expect } from '@jest/globals';
import { calculateCVR } from '../../src/repositories/WaitlistRepository';

describe('calculateCVR - conversion rate computation', () => {
  // ============================================================
  // Normal cases (signups <= visits)
  // ============================================================
  describe('normal cases (signups <= visits)', () => {
    it('25 signups from 100 visits = 25%', () => {
      expect(calculateCVR(100, 25)).toBe(25);
    });

    it('15 signups from 50 visits = 30%', () => {
      expect(calculateCVR(50, 15)).toBe(30);
    });

    it('1 signup from 100 visits = 1%', () => {
      expect(calculateCVR(100, 1)).toBe(1);
    });

    it('50 signups from 50 visits = 100% (perfect conversion)', () => {
      expect(calculateCVR(50, 50)).toBe(100);
    });

    it('0 signups from 50 visits = 0%', () => {
      expect(calculateCVR(50, 0)).toBe(0);
    });

    it('1 signup from 3 visits = 33.33%', () => {
      expect(calculateCVR(3, 1)).toBe(33.33);
    });
  });

  // ============================================================
  // Over 100% cases (signups > visits, incomplete visit tracking)
  // ============================================================
  describe('over 100% cases (signups > visits)', () => {
    it('10 visits, 14 signups = 140% (THE DIRECT CARD SCENARIO)', () => {
      // Direct source had 10 visits but 14 signups.
      // Shows real CVR so admin knows tracking is incomplete.
      expect(calculateCVR(10, 14)).toBe(140);
    });

    it('1 visit, 10 signups = 1000%', () => {
      expect(calculateCVR(1, 10)).toBe(1000);
    });

    it('50 visits, 51 signups = 102%', () => {
      expect(calculateCVR(50, 51)).toBe(102);
    });
  });

  // ============================================================
  // Null cases (no visits = no data)
  // ============================================================
  describe('null cases (no visits)', () => {
    it('0 visits, 0 signups → null', () => {
      expect(calculateCVR(0, 0)).toBeNull();
    });

    it('0 visits, 5 signups → null', () => {
      expect(calculateCVR(0, 5)).toBeNull();
    });
  });

  // ============================================================
  // Edge cases & precision
  // ============================================================
  describe('edge cases', () => {
    it('1 visit, 1 signup = 100%', () => {
      expect(calculateCVR(1, 1)).toBe(100);
    });

    it('1 visit, 0 signups = 0%', () => {
      expect(calculateCVR(1, 0)).toBe(0);
    });

    it('large numbers: 10000 visits, 2500 signups = 25%', () => {
      expect(calculateCVR(10000, 2500)).toBe(25);
    });

    it('precision: 1 signup from 7 visits = 14.29%', () => {
      expect(calculateCVR(7, 1)).toBe(14.29);
    });

    it('precision: 2 signups from 3 visits = 66.67%', () => {
      expect(calculateCVR(3, 2)).toBe(66.67);
    });
  });
});
