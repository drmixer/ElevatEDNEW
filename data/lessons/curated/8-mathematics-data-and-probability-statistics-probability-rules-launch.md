# Probability Rules

## Learning Goal
- I can find probabilities of compound events using organized sample spaces.
- I can use the complement rule when it is more efficient than listing every favorable outcome.
- I can interpret whether two events are more likely together, separately, or through a complement.

## Introduction
By Grade 8, probability work should feel more strategic. You still need accurate counts, but you also need to decide which method fits the event:

- list the sample space directly
- count favorable outcomes
- use a complement instead of counting a large set one by one

This lesson focuses on compound events, which involve more than one step or more than one condition.

In this lesson, ask:

1. What are all the possible outcomes?
2. Is it easier to count the event directly or through its complement?
3. How do I explain what the probability means in context?

## Visual Model
![Probability spinner and number outcomes](/images/lessons/math/probability.svg)

Students can use a visual model like this one to organize compound events before counting favorable outcomes.

## Interactive Follow-Up
Students can test sample spaces and repeated trials in the [Mathigon Probability course](https://mathigon.org/course/probability).

## Video Follow-Up
Students who need another explanation can review a compound-probability video set in the [Khan Academy probability unit](https://www.khanacademy.org/math/statistics-probability/probability-library).

## Key Vocabulary
**Compound event**: An event that combines two or more simple events.

**Sample space**: The full set of possible outcomes.

**Complement**: All outcomes that are not part of the event.

**Favorable outcomes**: Outcomes that satisfy the event.

**Probability**: A measure from `0` to `1` of how likely an event is.

## When Compound Events Need Structure
Suppose you flip a coin twice.

The sample space is:

`{HH, HT, TH, TT}`

If the event is "exactly one head," the favorable outcomes are:

`{HT, TH}`

So:

`P(exactly one head) = 2 / 4 = 1 / 2`

This example shows why organization matters. If you do not list outcomes carefully, it is easy to miss one.

## Worked Example 1: Probability of a Compound Event
A fair coin is flipped and a fair number cube is rolled.

What is the probability of getting heads and a number greater than `4`?

Step 1: Build the sample space size.

- `2` possible coin outcomes
- `6` possible number cube outcomes

Total outcomes:

`2 x 6 = 12`

Step 2: Count the favorable outcomes.

Heads and a number greater than `4` means:

- `H5`
- `H6`

There are `2` favorable outcomes.

Step 3: Write the probability.

`P(heads and number greater than 4) = 2 / 12 = 1 / 6`

The event is possible, but not very likely.

## Worked Example 2: Using a Table for a Compound Event
Two fair number cubes are rolled.

What is the probability that the sum is `7`?

The total number of outcomes is:

`6 x 6 = 36`

Now list the favorable pairs:

- `(1, 6)`
- `(2, 5)`
- `(3, 4)`
- `(4, 3)`
- `(5, 2)`
- `(6, 1)`

There are `6` favorable outcomes.

So:

`P(sum of 7) = 6 / 36 = 1 / 6`

Listing the ordered pairs matters because `(2, 5)` and `(5, 2)` are different outcomes.

## Worked Example 3: Using the Complement Rule
Two fair number cubes are rolled.

What is the probability that the sum is **not** `7`?

You could list all the outcomes that are not `7`, but that is inefficient.

Start with the complement:

`P(sum of 7) = 6 / 36 = 1 / 6`

Use the complement rule:

`P(not sum of 7) = 1 - 1 / 6 = 5 / 6`

This method is faster because the complement event is smaller and easier to count.

## When the Complement Is the Better Choice
The complement rule is especially useful when the direct event includes "not," "at least one not," or "everything except."

Example:

What is the probability of **not** rolling a multiple of `3` on a fair number cube?

Multiples of `3` are:

- `3`
- `6`

So:

`P(multiple of 3) = 2 / 6 = 1 / 3`

Then:

`P(not multiple of 3) = 1 - 1 / 3 = 2 / 3`

The complement method avoids counting four favorable outcomes directly, although that direct method would still work.

## Common Mistake: Forgetting the Full Sample Space
Students sometimes count favorable outcomes correctly but use the wrong total.

Example:

Two number cubes are rolled, and the event is "sum is `8`."

The favorable outcomes are:

- `(2, 6)`
- `(3, 5)`
- `(4, 4)`
- `(5, 3)`
- `(6, 2)`

Some students write:

`5 / 12`

That is incorrect because there are not `12` total outcomes. There are:

`6 x 6 = 36`

So the correct probability is:

`5 / 36`

In compound events, the total sample space often grows faster than students expect.

## Worked Example 4: At Least One Success
A fair coin is flipped twice.

What is the probability of getting at least one head?

Direct method:

Favorable outcomes:

- `HH`
- `HT`
- `TH`

So:

`P(at least one head) = 3 / 4`

Complement method:

The complement of "at least one head" is "no heads," which means:

- `TT`

So:

`P(no heads) = 1 / 4`

Then:

`P(at least one head) = 1 - 1 / 4 = 3 / 4`

The complement method is often cleaner for "at least one" events.

## Summary
Compound-event probability depends on organized counting and method choice.

To solve well:

1. determine the full sample space
2. decide whether to count the event directly or use a complement
3. calculate the probability carefully
4. interpret whether the result is reasonable for the situation

Strong Grade 8 probability work is not just about getting an answer. It is about choosing an efficient method and explaining why the counting structure makes sense.
