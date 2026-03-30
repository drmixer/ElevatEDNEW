# Confidence Intervals & Hypothesis Tests (Intro to HS Stats)

## Learning Goal
- I can explain what a confidence interval estimates and what a hypothesis test helps us decide.
- I can interpret sample statistics in context instead of treating them as exact population truths.
- I can describe how evidence from data supports or does not support a claim.

## Introduction
Confidence intervals and hypothesis tests help people make decisions when they only have sample data instead of data from an entire population. Researchers, pollsters, school leaders, and health scientists all use these tools when they need to estimate a population value or test whether an observed result is strong enough to count as evidence.

For example, imagine a school surveys a sample of students and finds that they study an average of 15 hours per week. That sample mean is useful, but it is not automatically the exact mean for every student in the school. Statistics gives us tools for reasoning from the sample to the larger population.

## Key Vocabulary
- **Sample statistic**: A number calculated from a sample, such as a sample mean or sample proportion.
- **Population parameter**: The true value for the full population that we want to estimate.
- **Confidence interval**: A range of plausible values for a population parameter based on sample data.
- **Null hypothesis**: The starting claim that there is no effect, no difference, or no meaningful change.
- **Alternative hypothesis**: The competing claim that there is an effect, a difference, or a meaningful change.

## What a Confidence Interval Means
A confidence interval gives a range of reasonable values for a population parameter.

Example:

A sample of students reports an average of `15` study hours per week, and the margin of error is `1.43` hours. Then the confidence interval is:

`15 +/- 1.43`, which gives the interval `(13.57, 16.43)`.

This means the data suggests the true average study time for the full student population is likely between `13.57` and `16.43` hours.

It does **not** mean every student studies in that range. It also does **not** mean there is a 95 percent chance that the already-calculated population mean moves around. The interval is about the method and the estimate, not about a changing true value.

## Worked Example: Interpreting a Confidence Interval
Suppose a poll estimates that `52%` of voters support a proposal, with a margin of error of `3%`.

The interval is:

`52% +/- 3%`, or from `49%` to `55%`.

A strong interpretation is:

"Based on the sample, the true level of support is plausibly between 49 percent and 55 percent."

That interpretation is more careful than saying, "Exactly 52 percent of all voters support the proposal."

## What a Hypothesis Test Does
A hypothesis test helps us decide whether the sample evidence is strong enough to challenge a starting claim.

Example:

A teacher wants to know whether a new study routine improves quiz scores. The null hypothesis says the routine does not change average scores. The alternative hypothesis says the routine increases average scores.

Students collect sample data, calculate a test statistic, and decide whether the evidence is strong enough to reject the null hypothesis.

## Worked Example: Making a Decision
Suppose the historical average quiz score is `78`, and a class using a new routine has a sample average of `82`.

That higher average may suggest improvement, but one sample mean is not enough by itself. A hypothesis test asks whether a result like `82` would be unusual if the true average were still `78`.

If the result would be very unusual under the null hypothesis, then the data supports rejecting the null hypothesis. If the result would not be unusual, then there is not enough evidence to reject it.

## Common Mistake
Students often confuse "failing to reject the null hypothesis" with "proving the null hypothesis is true."

Those are not the same.

A hypothesis test can show that the evidence is not strong enough to reject the starting claim. That does not prove the starting claim forever. It only means the sample did not provide convincing evidence against it.

## Summary
Confidence intervals and hypothesis tests answer related but different questions:

1. A confidence interval estimates a plausible range for a population value.
2. A hypothesis test evaluates whether the data gives strong evidence against a starting claim.
3. Both tools depend on interpreting sample data carefully and explaining results in context.

When reading a statistical claim, always ask:

- What population is being described?
- What sample evidence was collected?
- Is this an estimate, a test of a claim, or both?
