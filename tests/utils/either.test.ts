import { describe, it, expect } from 'vitest';
import {
  left,
  right,
  isLeft,
  isRight,
  map,
  mapLeft,
  flatMap,
  fromNullable,
  match,
  fold,
  getOrElse,
  getOrElseWith,
  orElse,
  tap,
  tapLeft,
  sequence,
  traverse,
  and,
  swap,
  extractLeft,
  extractRight,
  isEither,
} from '../../src/utils/either';

describe('Either', () => {
  describe('Constructors', () => {
    it('should create Left', () => {
      const result = left<string, number>('error');
      expect(isLeft(result)).toBe(true);
      expect(isRight(result)).toBe(false);
      expect(result.left).toBe('error');
    });

    it('should create Right', () => {
      const result = right<string, number>(42);
      expect(isRight(result)).toBe(true);
      expect(isLeft(result)).toBe(false);
      expect(result.right).toBe(42);
    });
  });

  describe('isEither', () => {
    it('should return true for Left', () => {
      expect(isEither(left('error'))).toBe(true);
    });

    it('should return true for Right', () => {
      expect(isEither(right(42))).toBe(true);
    });

    it('should return false for plain values', () => {
      expect(isEither('string')).toBe(false);
      expect(isEither(42)).toBe(false);
      expect(isEither(null)).toBe(false);
    });
  });

  describe('map', () => {
    it('should transform Right value', () => {
      const result = right<string, number>(5);
      const mapped = map((x: number) => x * 2)(result);
      expect(isRight(mapped)).toBe(true);
      expect(mapped.right).toBe(10);
    });

    it('should not transform Left value', () => {
      const result = left<string, number>('error');
      const mapped = map((x: number) => x * 2)(result);
      expect(isLeft(mapped)).toBe(true);
      expect(mapped.left).toBe('error');
    });
  });

  describe('mapLeft', () => {
    it('should transform Left value', () => {
      const result = left<string, number>('error1');
      const mapped = mapLeft((x: string) => x.toUpperCase())(result);
      expect(isLeft(mapped)).toBe(true);
      expect(mapped.left).toBe('ERROR1');
    });

    it('should not transform Right value', () => {
      const result = right<string, number>(42);
      const mapped = mapLeft((x: string) => x.toUpperCase())(result);
      expect(isRight(mapped)).toBe(true);
      expect(mapped.right).toBe(42);
    });
  });

  describe('flatMap (andThen)', () => {
    it('should chain Right values', () => {
      const result = right<string, number>(10);
      const chained = flatMap((x: number) => right<string, number>(x + 5))(result);
      expect(isRight(chained)).toBe(true);
      expect(chained.right).toBe(15);
    });

    it('should short-circuit on Left', () => {
      const result = left<string, number>('error');
      const chained = flatMap((x: number) => right<string, number>(x + 5))(result);
      expect(isLeft(chained)).toBe(true);
    });

    it('should allow returning Left in chain', () => {
      const result = right<string, number>(10);
      const chained = flatMap((x: number) =>
        x > 5 ? right<string, number>(x * 2) : left<string, number>('too small'),
      )(result);
      expect(isRight(chained)).toBe(true);
      expect(chained.right).toBe(20);
    });
  });

  describe('fromNullable', () => {
    it('should create Right for non-null value', () => {
      const result = fromNullable('not found')('hello');
      expect(isRight(result)).toBe(true);
      expect(result.right).toBe('hello');
    });

    it('should create Left for null', () => {
      const result = fromNullable('not found')(null);
      expect(isLeft(result)).toBe(true);
      expect(result.left).toBe('not found');
    });

    it('should create Left for undefined', () => {
      const result = fromNullable('not found')(undefined);
      expect(isLeft(result)).toBe(true);
    });

    it('should create Left for 0 (falsy but not null)', () => {
      const result = fromNullable('not found')(0);
      expect(isRight(result)).toBe(true);
      expect(result.right).toBe(0);
    });

    it('should create Left for empty string', () => {
      const result = fromNullable('not found')('');
      expect(isRight(result)).toBe(true);
      expect(result.right).toBe('');
    });
  });

  describe('match / fold', () => {
    it('should execute onRight for Right', () => {
      const result = right<string, number>(42);
      const value = match(
        l => `Error: ${l}`,
        r => `Value: ${r}`,
      )(result);
      expect(value).toBe('Value: 42');
    });

    it('should execute onLeft for Left', () => {
      const result = left<string, number>('error');
      const value = match(
        l => `Error: ${l}`,
        r => `Value: ${r}`,
      )(result);
      expect(value).toBe('Error: error');
    });
  });

  describe('getOrElse', () => {
    it('should return Right value', () => {
      const result = right<string, number>(42);
      expect(getOrElse(result, 0)).toBe(42);
    });

    it('should return default for Left', () => {
      const result = left<string, number>('error');
      expect(getOrElse(result, 0)).toBe(0);
    });
  });

  describe('getOrElseWith', () => {
    it('should return Right value', () => {
      const result = right<string, number>(42);
      expect(getOrElseWith(result, l => l.length)).toBe(42);
    });

    it('should compute default from Left value', () => {
      const result = left<string, number>('error');
      expect(getOrElseWith(result, l => l.length)).toBe(5);
    });
  });

  describe('orElse', () => {
    it('should return original Right', () => {
      const result = right<string, number>(42);
      const recovered = orElse((l: string) => right<string, number>(0))(result);
      expect(isRight(recovered)).toBe(true);
      expect(recovered.right).toBe(42);
    });

    it('should recover from Left', () => {
      const result = left<string, number>('error');
      const recovered = orElse((l: string) => right<string, number>(0))(result);
      expect(isRight(recovered)).toBe(true);
      expect(recovered.right).toBe(0);
    });

    it('should allow returning Left from recovery', () => {
      const result = left<string, number>('error1');
      const recovered = orElse((l: string) => left<string, number>(l + ' recovered'))(result);
      expect(isLeft(recovered)).toBe(true);
      expect(recovered.left).toBe('error1 recovered');
    });
  });

  describe('tap', () => {
    it('should execute fn on Right without transforming', () => {
      let tapped = false;
      const result = right<string, number>(42);
      const tappedResult = tap(() => {
        tapped = true;
      })(result);

      expect(tapped).toBe(true);
      expect(tappedResult.right).toBe(42);
    });

    it('should not execute fn on Left', () => {
      let tapped = false;
      const result = left<string, number>('error');
      const tappedResult = tap(() => {
        tapped = true;
      })(result);

      expect(tapped).toBe(false);
      expect(isLeft(tappedResult)).toBe(true);
    });
  });

  describe('tapLeft', () => {
    it('should execute fn on Left without transforming', () => {
      let tapped = false;
      const result = left<string, number>('error');
      const tappedResult = tapLeft(() => {
        tapped = true;
      })(result);

      expect(tapped).toBe(true);
      expect(tappedResult.left).toBe('error');
    });

    it('should not execute fn on Right', () => {
      let tapped = false;
      const result = right<string, number>(42);
      const tappedResult = tapLeft(() => {
        tapped = true;
      })(result);

      expect(tapped).toBe(false);
      expect(isRight(tappedResult)).toBe(true);
    });
  });

  describe('sequence', () => {
    it('should return all Right values', () => {
      const results = [right(1), right(2), right(3)];
      const sequenced = sequence(results);

      expect(isRight(sequenced)).toBe(true);
      expect(sequenced.right).toEqual([1, 2, 3]);
    });

    it('should return first Left encountered', () => {
      const results = [right(1), left('error'), right(3)];
      const sequenced = sequence(results);

      expect(isLeft(sequenced)).toBe(true);
      expect(sequenced.left).toBe('error');
    });

    it('should handle empty array', () => {
      const results: Array<{ _tag: 'Right'; right: number }> = [];
      const sequenced = sequence(results);

      expect(isRight(sequenced)).toBe(true);
      expect(sequenced.right).toEqual([]);
    });
  });

  describe('traverse', () => {
    it('should transform array to Right of array', () => {
      const arr = [1, 2, 3];
      const traversed = traverse(arr, x => right(x * 2));

      expect(isRight(traversed)).toBe(true);
      expect(traversed.right).toEqual([2, 4, 6]);
    });

    it('should short-circuit on first Left', () => {
      const arr = [1, 2, 3];
      const traversed = traverse(arr, x => (x === 2 ? left<string, number>('error') : right(x)));

      expect(isLeft(traversed)).toBe(true);
    });
  });

  describe('and', () => {
    it('should return second Right if both are Right', () => {
      const result = and(right(1), right(2));
      expect(isRight(result)).toBe(true);
      expect(result.right).toBe(2);
    });

    it('should return first Left', () => {
      const result = and(left('error1'), right(2));
      expect(isLeft(result)).toBe(true);
      expect(result.left).toBe('error1');
    });

    it('should return second Left if first is Right', () => {
      const result = and(right(1), left('error2'));
      expect(isLeft(result)).toBe(true);
      expect(result.left).toBe('error2');
    });
  });

  describe('swap', () => {
    it('should swap Left to Right', () => {
      const result = left<string, number>('error');
      const swapped = swap(result);

      expect(isRight(swapped)).toBe(true);
      expect(swapped.right).toBe('error');
    });

    it('should swap Right to Left', () => {
      const result = right<string, number>(42);
      const swapped = swap(result);

      expect(isLeft(swapped)).toBe(true);
      expect(swapped.left).toBe(42);
    });
  });

  describe('extractLeft', () => {
    it('should extract value from Left', () => {
      const result = left<string, number>('error');
      expect(extractLeft(result)).toBe('error');
    });

    it('should throw for Right', () => {
      const result = right<string, number>(42);
      expect(() => extractLeft(result)).toThrow();
    });
  });

  describe('extractRight', () => {
    it('should extract value from Right', () => {
      const result = right<string, number>(42);
      expect(extractRight(result)).toBe(42);
    });

    it('should throw for Left', () => {
      const result = left<string, number>('error');
      expect(() => extractRight(result)).toThrow();
    });
  });
});
