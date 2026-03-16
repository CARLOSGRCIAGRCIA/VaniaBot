/**
 * QuizAnswerHandler.test.ts
 *
 * Unit tests for the QuizAnswerHandler.
 * Tests quiz answer validation and scoring.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, vi } from 'vitest';

describe('QuizAnswerHandler', () => {
  describe('answer validation', () => {
    const normalizeAnswer = (answer: string): string => {
      return answer
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    };

    it('should normalize answers', () => {
      expect(normalizeAnswer('  HOLA  ')).toBe('hola');
    });

    it('should remove accents', () => {
      expect(normalizeAnswer('café')).toBe('cafe');
      expect(normalizeAnswer('español')).toBe('espanol');
    });
  });

  describe('answer matching', () => {
    const isCorrectAnswer = (userAnswer: string, correctAnswer: string): boolean => {
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
      return normalize(userAnswer) === normalize(correctAnswer);
    };

    it('should match exact answers', () => {
      expect(isCorrectAnswer('paris', 'paris')).toBe(true);
      expect(isCorrectAnswer('Paris', 'paris')).toBe(true);
    });

    it('should match answers with different casing', () => {
      expect(isCorrectAnswer('PARIS', 'paris')).toBe(true);
      expect(isCorrectAnswer('PaRiS', 'paris')).toBe(true);
    });

    it('should reject incorrect answers', () => {
      expect(isCorrectAnswer('london', 'paris')).toBe(false);
    });
  });

  describe('time bonus calculation', () => {
    const calculateTimeBonus = (
      timeMs: number,
      maxTimeMs: number = 30000,
      basePoints: number = 100,
    ): number => {
      const timeRatio = Math.max(0, 1 - timeMs / maxTimeMs);
      return Math.floor(basePoints * timeRatio);
    };

    it('should give max bonus for fast answers', () => {
      const bonus = calculateTimeBonus(1000);
      expect(bonus).toBe(96);
    });

    it('should give partial bonus for medium answers', () => {
      const bonus = calculateTimeBonus(15000);
      expect(bonus).toBe(50);
    });

    it('should give no bonus for slow answers', () => {
      const bonus = calculateTimeBonus(35000);
      expect(bonus).toBe(0);
    });
  });

  describe('scoring', () => {
    const calculateScore = (
      isCorrect: boolean,
      timeMs: number,
      difficulty: 'easy' | 'medium' | 'hard',
    ): number => {
      if (!isCorrect) return 0;

      const basePoints = { easy: 10, medium: 20, hard: 30 }[difficulty];
      const timeBonus = Math.floor(Math.max(0, 1 - timeMs / 30000) * 10);

      return basePoints + timeBonus;
    };

    it('should score easy questions correctly', () => {
      expect(calculateScore(true, 5000, 'easy')).toBe(18);
    });

    it('should score medium questions correctly', () => {
      expect(calculateScore(true, 5000, 'medium')).toBe(28);
    });

    it('should score hard questions correctly', () => {
      expect(calculateScore(true, 5000, 'hard')).toBe(38);
    });

    it('should return 0 for incorrect answers', () => {
      expect(calculateScore(false, 5000, 'hard')).toBe(0);
    });
  });

  describe('streak calculation', () => {
    const calculateStreak = (previousStreak: number, isCorrect: boolean): number => {
      if (isCorrect) {
        return previousStreak + 1;
      }
      return 0;
    };

    it('should increase streak on correct answer', () => {
      expect(calculateStreak(3, true)).toBe(4);
    });

    it('should reset streak on incorrect answer', () => {
      expect(calculateStreak(5, false)).toBe(0);
    });

    it('should start streak at 1 for first correct answer', () => {
      expect(calculateStreak(0, true)).toBe(1);
    });
  });
});
