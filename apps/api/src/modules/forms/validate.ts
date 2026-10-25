import { validateWeightGroup } from '@pe/shared';

interface SectionWithQuestions {
  title: string;
  weight: unknown;
  questions: { weight: unknown }[];
}

/**
 * Validates the weight groups of a form version.
 *
 * Negative weights are always an error. A group that does not sum to the target
 * is only a warning under the default policy (it is normalized at scoring
 * time); errors are pushed into `errorsOut` and warnings returned.
 */
export function validateAndNormalizeWeights(
  sectionWeights: number[],
  sections: SectionWithQuestions[],
  errorsOut: string[],
): string[] {
  const warnings: string[] = [];

  for (const w of sectionWeights) {
    if (!Number.isFinite(w) || w < 0) errorsOut.push('وزن بخش‌ها باید اعداد نامنفی باشند.');
  }

  if (sectionWeights.length > 0) {
    const result = validateWeightGroup(sectionWeights, { allowWeightNormalization: true, weightTarget: 100 });
    if (!result.ok) errorsOut.push(result.error ?? 'وزن بخش‌ها نامعتبر است.');
    else if (result.normalized) warnings.push('مجموع وزن بخش‌ها ۱۰۰ نیست و در محاسبه نرمال می‌شود.');
  }

  for (const section of sections) {
    const weights = section.questions.map((q) => Number(q.weight));
    for (const w of weights) {
      if (!Number.isFinite(w) || w < 0) errorsOut.push(`وزن پرسش‌های بخش «${section.title}» نامعتبر است.`);
    }
    const positive = weights.filter((w) => w > 0);
    if (positive.length === 0) continue;

    const result = validateWeightGroup(positive, { allowWeightNormalization: true, weightTarget: 100 });
    if (!result.ok) errorsOut.push(result.error ?? `وزن پرسش‌های بخش «${section.title}» نامعتبر است.`);
    else if (result.normalized) warnings.push(`مجموع وزن پرسش‌های بخش «${section.title}» ۱۰۰ نیست و نرمال می‌شود.`);
  }

  return warnings;
}
