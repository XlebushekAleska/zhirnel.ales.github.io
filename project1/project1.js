"use strict";

const MAX_FACTORIAL_INPUT = 200;
const MAX_COMBINATION_INPUT = 500;

function getElement(id) {
    return document.getElementById(id);
}

function readInteger(id) {
    const element = getElement(id);
    const value = Number(element.value);

    if (!Number.isInteger(value)) {
        throw new Error("Please enter integer values only.");
    }

    return value;
}

function factorialBigInt(n) {
    let result = 1n;

    for (let i = 2n; i <= BigInt(n); i += 1n) {
        result *= i;
    }

    return result;
}

function gcdBigInt(a, b) {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;

    while (y !== 0n) {
        const temp = y;
        y = x % y;
        x = temp;
    }

    return x;
}

function combinationBigInt(n, k) {
    if (k < 0 || k > n) {
        return 0n;
    }

    let effectiveK = Math.min(k, n - k);
    let result = 1n;

    for (let i = 1; i <= effectiveK; i += 1) {
        result = (result * BigInt(n - effectiveK + i)) / BigInt(i);
    }

    return result;
}

function formatBigInt(value) {
    const text = value.toString();
    return text.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function setResult(id, html, isError = false) {
    const result = getElement(id);
    result.innerHTML = html;
    result.classList.toggle("error", isError);
}

function validateRange(value, min, max, label) {
    if (value < min || value > max) {
        throw new Error(`${label} must be between ${min} and ${max}.`);
    }
}

function calculateProbability() {
    try {
        const total = readInteger("probability-total");
        const favorable = readInteger("probability-favorable");

        validateRange(total, 1, Number.MAX_SAFE_INTEGER, "Total outcomes");
        validateRange(favorable, 0, Number.MAX_SAFE_INTEGER, "Favorable outcomes");

        if (favorable > total) {
            throw new Error("Favorable outcomes cannot be greater than total outcomes.");
        }

        const numerator = BigInt(favorable);
        const denominator = BigInt(total);
        const divisor = gcdBigInt(numerator, denominator);

        const reducedNumerator = numerator / divisor;
        const reducedDenominator = denominator / divisor;

        const decimal = favorable / total;
        const percent = decimal * 100;

        setResult(
            "probability-result",
            `
                <strong>P = ${favorable} / ${total}</strong><br>
                Reduced fraction: <strong>${reducedNumerator.toString()} / ${reducedDenominator.toString()}</strong><br>
                Decimal: <strong>${decimal.toFixed(6)}</strong><br>
                Percentage: <strong>${percent.toFixed(2)}%</strong>
            `
        );
    } catch (error) {
        setResult("probability-result", error.message, true);
    }
}

function calculateFactorial() {
    try {
        const n = readInteger("factorial-n");
        validateRange(n, 0, MAX_FACTORIAL_INPUT, "n");

        const result = factorialBigInt(n);

        setResult(
            "factorial-result",
            `
                <strong>${n}! = ${formatBigInt(result)}</strong><br>
                <span class="muted">The result is calculated exactly with BigInt.</span>
            `
        );
    } catch (error) {
        setResult("factorial-result", error.message, true);
    }
}

function calculatePermutations() {
    try {
        const n = readInteger("permutation-n");
        validateRange(n, 0, MAX_FACTORIAL_INPUT, "Number of objects");

        const result = factorialBigInt(n);

        setResult(
            "permutation-result",
            `
                For <strong>${n}</strong> different objects:<br>
                <strong>Permutations = ${n}! = ${formatBigInt(result)}</strong>
            `
        );
    } catch (error) {
        setResult("permutation-result", error.message, true);
    }
}

function getCharacterCounts(text) {
    const normalized = text
        .replace(/\s+/g, "")
        .toUpperCase();

    const counts = new Map();

    for (const character of Array.from(normalized)) {
        counts.set(character, (counts.get(character) || 0) + 1);
    }

    return {
        normalized,
        counts
    };
}

function calculateRepeatedObjects() {
    try {
        const input = getElement("repeated-word").value;
        const { normalized, counts } = getCharacterCounts(input);

        if (normalized.length === 0) {
            throw new Error("Please enter a word or sequence.");
        }

        validateRange(normalized.length, 1, MAX_FACTORIAL_INPUT, "Sequence length");

        const totalLetters = normalized.length;
        let denominator = 1n;
        const repeatedParts = [];

        for (const [character, count] of counts.entries()) {
            if (count > 1) {
                repeatedParts.push(`${character}: ${count}`);
            }

            denominator *= factorialBigInt(count);
        }

        const numerator = factorialBigInt(totalLetters);
        const result = numerator / denominator;

        const repeatedText = repeatedParts.length > 0
            ? repeatedParts.join(", ")
            : "No repeated characters";

        setResult(
            "repeated-result",
            `
                Sequence: <strong>${normalized}</strong><br>
                Length: <strong>${totalLetters}</strong><br>
                Repeated groups: <strong>${repeatedText}</strong><br>
                Formula: <strong>${totalLetters}! / repeated factorials</strong><br>
                Result: <strong>${formatBigInt(result)}</strong>
            `
        );
    } catch (error) {
        setResult("repeated-result", error.message, true);
    }
}

function calculateBinomial() {
    try {
        const n = readInteger("binomial-n");
        const k = readInteger("binomial-k");

        validateRange(n, 0, MAX_COMBINATION_INPUT, "n");
        validateRange(k, 0, MAX_COMBINATION_INPUT, "k");

        if (k > n) {
            throw new Error("k cannot be greater than n.");
        }

        const result = combinationBigInt(n, k);

        setResult(
            "binomial-result",
            `
                <strong>C(${n}, ${k}) = ${formatBigInt(result)}</strong><br>
                Formula: n! / (k! × (n - k)!)
            `
        );
    } catch (error) {
        setResult("binomial-result", error.message, true);
    }
}

function calculateTeamSelection() {
    try {
        const total = readInteger("team-total");
        const selected = readInteger("team-selected");

        validateRange(total, 0, MAX_COMBINATION_INPUT, "Total players");
        validateRange(selected, 0, MAX_COMBINATION_INPUT, "Team size");

        if (selected > total) {
            throw new Error("Team size cannot be greater than total players.");
        }

        const result = combinationBigInt(total, selected);

        setResult(
            "team-result",
            `
                Number of possible teams:<br>
                <strong>C(${total}, ${selected}) = ${formatBigInt(result)}</strong>
            `
        );
    } catch (error) {
        setResult("team-result", error.message, true);
    }
}

function calculateGalois() {
    try {
        const input = getElement("galois-word").value;
        const vowelsInput = getElement("galois-vowels").value;

        const normalized = input
            .toUpperCase()
            .replace(/[^A-Z]/g, "");

        const vowelsText = vowelsInput
            .toUpperCase()
            .replace(/[^A-Z]/g, "");

        if (normalized.length === 0) {
            throw new Error("Please enter at least one English letter.");
        }

        if (vowelsText.length === 0) {
            throw new Error("Please enter at least one vowel.");
        }

        validateRange(normalized.length, 1, MAX_FACTORIAL_INPUT, "Word length");

        const vowelSet = new Set(Array.from(vowelsText));
        const letterCounts = new Map();

        let vowelCount = 0;
        let consonantCount = 0;

        for (const character of Array.from(normalized)) {
            letterCounts.set(
                character,
                (letterCounts.get(character) || 0) + 1
            );

            if (vowelSet.has(character)) {
                vowelCount += 1;
            } else {
                consonantCount += 1;
            }
        }

        const totalLetters = normalized.length;

        const totalPositionArrangements = factorialBigInt(totalLetters);
        const favorablePositionArrangements =
            factorialBigInt(vowelCount) * factorialBigInt(consonantCount);

        const divisor = gcdBigInt(
            favorablePositionArrangements,
            totalPositionArrangements
        );

        const reducedNumerator = favorablePositionArrangements / divisor;
        const reducedDenominator = totalPositionArrangements / divisor;

        const percentage =
            Number(
                (favorablePositionArrangements * 1000000n)
                / totalPositionArrangements
            ) / 10000;

        let allRepeatedDenominator = 1n;
        let vowelRepeatedDenominator = 1n;
        let consonantRepeatedDenominator = 1n;

        for (const [character, count] of letterCounts.entries()) {
            const repeatedFactorial = factorialBigInt(count);

            allRepeatedDenominator *= repeatedFactorial;

            if (vowelSet.has(character)) {
                vowelRepeatedDenominator *= repeatedFactorial;
            } else {
                consonantRepeatedDenominator *= repeatedFactorial;
            }
        }

        const totalDistinctArrangements =
            totalPositionArrangements / allRepeatedDenominator;

        const favorableDistinctArrangements =
            (factorialBigInt(vowelCount) / vowelRepeatedDenominator)
            * (factorialBigInt(consonantCount) / consonantRepeatedDenominator);

        setResult(
            "galois-result",
            `
                Word: <strong>${normalized}</strong><br>
                Vowels: <strong>${vowelCount}</strong>,
                consonants: <strong>${consonantCount}</strong><br><br>

                Total position arrangements:
                <strong>${totalLetters}! = ${formatBigInt(totalPositionArrangements)}</strong><br>

                Favorable position arrangements:
                <strong>${vowelCount}! × ${consonantCount}! =
                ${formatBigInt(favorablePositionArrangements)}</strong><br><br>

                Probability:
                <strong>${formatBigInt(favorablePositionArrangements)}
                / ${formatBigInt(totalPositionArrangements)}</strong><br>

                Reduced fraction:
                <strong>${reducedNumerator.toString()}
                / ${reducedDenominator.toString()}</strong><br>

                Percentage:
                <strong>${percentage.toFixed(4)}%</strong><br><br>

                Distinct written arrangements:
                <strong>${formatBigInt(totalDistinctArrangements)}</strong><br>

                Distinct favorable arrangements:
                <strong>${formatBigInt(favorableDistinctArrangements)}</strong>
            `
        );
    } catch (error) {
        setResult("galois-result", error.message, true);
    }
}

function enableNavigationWheelScroll() {
    const navigation = document.querySelector(".project-navigation");

    if (!navigation) {
        return;
    }

    navigation.addEventListener("wheel", function (event) {
        const canScrollHorizontally = navigation.scrollWidth > navigation.clientWidth;

        if (!canScrollHorizontally) {
            return;
        }

        event.preventDefault();

        const scrollAmount = Math.abs(event.deltaX) > Math.abs(event.deltaY)
            ? event.deltaX
            : event.deltaY;

        navigation.scrollLeft += scrollAmount;
    }, { passive: false });
}

function attachCalculatorEvents() {
    const bindings = [
        ["probability-button", calculateProbability],
        ["factorial-button", calculateFactorial],
        ["permutation-button", calculatePermutations],
        ["repeated-button", calculateRepeatedObjects],
        ["binomial-button", calculateBinomial],
        ["team-button", calculateTeamSelection],
        ["galois-button", calculateGalois]
    ];

    for (const [buttonId, handler] of bindings) {
        const button = getElement(buttonId);

        if (button) {
            button.addEventListener("click", handler);
        }
    }
}

function calculateDefaultValues() {
    calculateProbability();
    calculateFactorial();
    calculatePermutations();
    calculateRepeatedObjects();
    calculateBinomial();
    calculateTeamSelection();
    calculateGalois();
}

document.addEventListener("DOMContentLoaded", function () {
    attachCalculatorEvents();
    enableNavigationWheelScroll();
    calculateDefaultValues();
});
