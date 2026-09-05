import { describe, it, expect } from 'vitest';
import { calculateMasteryScore } from '../src/services/practiceService.js';

describe('Spec Section 2 — Mastery Score Calculation & Contributing Factors', () => {
  it('1. should calculate exact mastery score for 10 mixed attempts matching manual calculation', () => {
    // 10 attempts in chronological order:
    // [0, 1, 2] -> Chunk 1: L1(Correct), L1(Correct), L1(Correct)
    // [3, 4, 5] -> Chunk 2: L1(Wrong), L2(Correct), L2(Correct)
    // [6, 7, 8] -> Chunk 3: L2(Wrong), L3(Correct), L3(Correct)
    // [9]       -> Remaining: L3(Correct)
    const attempts = [
      { is_correct: true, question: { difficulty_level: 1 } },
      { is_correct: true, question: { difficulty_level: 1 } },
      { is_correct: true, question: { difficulty_level: 1 } },
      { is_correct: false, question: { difficulty_level: 1 } },
      { is_correct: true, question: { difficulty_level: 2 } },
      { is_correct: true, question: { difficulty_level: 2 } },
      { is_correct: false, question: { difficulty_level: 2 } },
      { is_correct: true, question: { difficulty_level: 3 } },
      { is_correct: true, question: { difficulty_level: 3 } },
      { is_correct: true, question: { difficulty_level: 3 } },
    ];

    const result = calculateMasteryScore(attempts);

    // 1. recent_accuracy: 8 correct out of 10 = 80%
    expect(result.contributing_factors.recent_accuracy).toBe(80);

    // 2. difficulty_weighted_accuracy:
    // L1: 4 * 1.0 = 4.0, correct = 3.0
    // L2: 3 * 1.3 = 3.9, correct = 2.6
    // L3: 3 * 1.6 = 4.8, correct = 4.8
    // Total possible = 12.7, Total correct = 10.4 -> (10.4 / 12.7) * 100 = 81.89%
    expect(result.contributing_factors.difficulty_weighted_accuracy).toBeCloseTo(81.89, 1);

    // 3. consistency_score:
    // Chunk 1: 3/3 (100%), Chunk 2: 2/3 (66.67%), Chunk 3: 2/3 (66.67%)
    // Normalized variance ~ 9.88 -> consistency ~ 90.12
    expect(result.contributing_factors.consistency_score).toBeCloseTo(90.12, 1);

    // Final Mastery = 0.6 * 80 + 0.25 * 81.89 + 0.15 * 90.12 = 48 + 20.47 + 13.52 = 81.99 -> 82
    expect(result.mastery_score).toBe(82);
    expect(result.contributing_factors.window_size).toBe(10);
    expect(result.contributing_factors.insufficient_data_for_consistency).toBeUndefined();
  });

  it('2. should use all available attempts when attempt count < 10', () => {
    const attempts = [
      { is_correct: true, question: { difficulty_level: 1 } },
      { is_correct: true, question: { difficulty_level: 2 } },
      { is_correct: true, question: { difficulty_level: 3 } },
      { is_correct: false, question: { difficulty_level: 2 } },
    ];

    const result = calculateMasteryScore(attempts);

    expect(result.contributing_factors.window_size).toBe(4);
    // 3 correct out of 4 = 75%
    expect(result.contributing_factors.recent_accuracy).toBe(75);
    // Weights: L1(1.0), L2(1.3), L3(1.6), L2(1.3) = 5.2. Correct: 1.0 + 1.3 + 1.6 = 3.9. (3.9 / 5.2) * 100 = 75%
    expect(result.contributing_factors.difficulty_weighted_accuracy).toBe(75);
    // 1 chunk of 3 (all correct = 100%), 1 chunk variance = 0 -> consistency = 100
    expect(result.contributing_factors.consistency_score).toBe(100);
    // Total = 0.6 * 75 + 0.25 * 75 + 0.15 * 100 = 45 + 18.75 + 15 = 78.75 -> 79
    expect(result.mastery_score).toBe(79);
  });

  it('3. should default consistency_score to 50 with insufficient_data flag when attempt count < 3', () => {
    const attempts = [
      { is_correct: true, question: { difficulty_level: 1 } },
      { is_correct: false, question: { difficulty_level: 2 } },
    ];

    const result = calculateMasteryScore(attempts);

    expect(result.contributing_factors.window_size).toBe(2);
    expect(result.contributing_factors.recent_accuracy).toBe(50);
    expect(result.contributing_factors.consistency_score).toBe(50);
    expect(result.contributing_factors.insufficient_data_for_consistency).toBe(true);
  });

  it('4. should correctly store contributing_factors JSON with computed_at timestamp', () => {
    const attempts = [{ is_correct: true, question: { difficulty_level: 1 } }];
    const result = calculateMasteryScore(attempts);

    expect(result.contributing_factors).toHaveProperty('recent_accuracy');
    expect(result.contributing_factors).toHaveProperty('difficulty_weighted_accuracy');
    expect(result.contributing_factors).toHaveProperty('consistency_score');
    expect(result.contributing_factors).toHaveProperty('computed_at');
    expect(typeof result.contributing_factors.computed_at).toBe('string');
  });
});
