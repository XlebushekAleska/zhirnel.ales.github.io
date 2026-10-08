"use strict";

const MAX_FACTORIAL_INPUT = 200;
const MAX_BINOMIAL_INPUT = 30;
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

function validateRange(value, min, max, label) {
    if (value < min || value > max) {
        throw new Error(`${label} must be between ${min} and ${max}.`);
    }
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

    const effectiveK = Math.min(k, n - k);
    let result = 1n;

    for (let i = 1; i <= effectiveK; i += 1) {
        result =
            (result * BigInt(n - effectiveK + i))
            /
            BigInt(i);
    }

    return result;
}

function formatBigInt(value) {
    return value
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function factorialProduct(n) {
    if (n === 0 || n === 1) {
        return "1";
    }

    const factors = [];

    for (let value = n; value >= 1; value -= 1) {
        factors.push(String(value));
    }

    return factors.join(" × ");
}

function setResult(id, html, isError = false) {
    const result = getElement(id);
    result.innerHTML = html;
    result.classList.toggle("error", isError);
}

function calculationSteps(steps) {
    return `
        <div class="calculation-breakdown">
            ${steps.map((step, index) => `
                <div class="calculation-step">
                    <span class="calculation-step-label">
                        Step ${index + 1}${step.label ? ` · ${escapeHtml(step.label)}` : ""}
                    </span>

                    <code class="calculation-formula">
                        ${step.formula}
                    </code>

                    ${step.note
                        ? `<p class="calculation-note">${escapeHtml(step.note)}</p>`
                        : ""
                    }
                </div>
            `).join("")}
        </div>
    `;
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
                <div class="result-headline">
                    <span>Probability</span>
                    <strong>${percent.toFixed(2)}%</strong>
                </div>

                ${calculationSteps([
                    {
                        label: "formula",
                        formula: "P(A) = |A| / |Ω|"
                    },
                    {
                        label: "substitution",
                        formula: `P(A) = ${favorable} / ${total}`
                    },
                    {
                        label: "reduce the fraction",
                        formula:
                            `${favorable} / ${total}`
                            + ` = ${reducedNumerator} / ${reducedDenominator}`
                    },
                    {
                        label: "decimal form",
                        formula:
                            `${reducedNumerator} / ${reducedDenominator}`
                            + ` = ${decimal.toFixed(6)}`
                    },
                    {
                        label: "percentage",
                        formula:
                            `${decimal.toFixed(6)} × 100%`
                            + ` = ${percent.toFixed(2)}%`
                    }
                ])}
            `
        );
    } catch (error) {
        setResult("probability-result", escapeHtml(error.message), true);
    }
}

function calculatePermutations() {
    try {
        const n = readInteger("permutation-n");

        validateRange(n, 0, MAX_FACTORIAL_INPUT, "Number of objects");

        const result = factorialBigInt(n);
        const expanded = factorialProduct(n);

        setResult(
            "permutation-result",
            `
                <div class="result-headline">
                    <span>Permutations</span>
                    <strong>${formatBigInt(result)}</strong>
                </div>

                ${calculationSteps([
                    {
                        label: "permutation formula",
                        formula: `P<sub>${n}</sub> = ${n}!`
                    },
                    {
                        label: "expand the factorial",
                        formula: `${n}! = ${expanded}`
                    },
                    {
                        label: "multiply",
                        formula: `${expanded} = ${formatBigInt(result)}`
                    }
                ])}
            `
        );
    } catch (error) {
        setResult("permutation-result", escapeHtml(error.message), true);
    }
}

function getCharacterCounts(text) {
    const normalized = text
        .replace(/\s+/gu, "")
        .toUpperCase();

    const counts = new Map();

    for (const character of Array.from(normalized)) {
        counts.set(
            character,
            (counts.get(character) || 0) + 1
        );
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
        const totalLetters = Array.from(normalized).length;

        if (totalLetters === 0) {
            throw new Error("Please enter a word or sequence.");
        }

        validateRange(totalLetters, 1, MAX_FACTORIAL_INPUT, "Sequence length");

        const repeatedGroups =
            [...counts.entries()]
                .filter(([, count]) => count > 1);

        let denominator = 1n;

        for (const [, count] of counts.entries()) {
            denominator *= factorialBigInt(count);
        }

        const numerator = factorialBigInt(totalLetters);
        const result = numerator / denominator;

        const denominatorFormula =
            repeatedGroups.length > 0
                ? repeatedGroups
                    .map(([, count]) => `${count}!`)
                    .join(" × ")
                : "1";

        const denominatorExpansion =
            repeatedGroups.length > 0
                ? repeatedGroups
                    .map(([, count]) => `(${factorialProduct(count)})`)
                    .join(" × ")
                : "1";

        const groupDescription =
            repeatedGroups.length > 0
                ? repeatedGroups
                    .map(([character, count]) =>
                        `${escapeHtml(character)} × ${count}`
                    )
                    .join(", ")
                : "No repeated characters";

        setResult(
            "repeated-result",
            `
                <div class="result-headline">
                    <span>Distinct arrangements</span>
                    <strong>${formatBigInt(result)}</strong>
                </div>

                <p class="result-context">
                    Sequence:
                    <strong>${escapeHtml(normalized)}</strong><br>
                    Repeated groups:
                    <strong>${groupDescription}</strong>
                </p>

                ${calculationSteps([
                    {
                        label: "general formula",
                        formula: "N = n! / (m₁! × m₂! × ... × mᵣ!)"
                    },
                    {
                        label: "substitute multiplicities",
                        formula:
                            `N = ${totalLetters}! / (${denominatorFormula})`
                    },
                    {
                        label: "expand factorials",
                        formula:
                            `N = (${factorialProduct(totalLetters)})`
                            + ` / (${denominatorExpansion})`
                    },
                    {
                        label: "evaluate numerator and denominator",
                        formula:
                            `N = ${formatBigInt(numerator)}`
                            + ` / ${formatBigInt(denominator)}`
                    },
                    {
                        label: "divide",
                        formula: `N = ${formatBigInt(result)}`
                    }
                ])}
            `
        );
    } catch (error) {
        setResult("repeated-result", escapeHtml(error.message), true);
    }
}

function buildPascalRows(n) {
    const rows = [];

    for (let rowIndex = 0; rowIndex <= n; rowIndex += 1) {
        const row = [];

        for (let column = 0; column <= rowIndex; column += 1) {
            if (column === 0 || column === rowIndex) {
                row.push(1n);
            } else {
                row.push(
                    rows[rowIndex - 1][column - 1]
                    +
                    rows[rowIndex - 1][column]
                );
            }
        }

        rows.push(row);
    }

    return rows;
}

function renderPascalTriangle(n, k) {
    const rows = buildPascalRows(n);
    const triangle = getElement("pascal-triangle");

    triangle.innerHTML =
        rows.map((row, rowIndex) => {
            const cells =
                row.map((value, column) => {
                    const isTarget =
                        rowIndex === n
                        &&
                        column === k;

                    const isDirectParent =
                        rowIndex === n - 1
                        &&
                        (
                            column === k - 1
                            ||
                            column === k
                        );

                    let origin = "";

                    if (
                        rowIndex > 0
                        &&
                        column > 0
                        &&
                        column < rowIndex
                    ) {
                        const left = rows[rowIndex - 1][column - 1];
                        const right = rows[rowIndex - 1][column];

                        origin = `
                            <small class="pascal-cell-origin">
                                ${formatBigInt(left)} + ${formatBigInt(right)}
                            </small>
                        `;
                    }

                    const classes = [
                        "pascal-cell",
                        isTarget ? "is-target" : "",
                        isDirectParent ? "is-parent" : ""
                    ]
                        .filter(Boolean)
                        .join(" ");

                    return `
                        <div
                            class="${classes}"
                            title="C(${rowIndex}, ${column}) = ${value}"
                            aria-label="C(${rowIndex}, ${column}) equals ${value}"
                        >
                            <span class="pascal-cell-index">
                                C(${rowIndex},${column})
                            </span>

                            <strong>
                                ${formatBigInt(value)}
                            </strong>

                            ${origin}
                        </div>
                    `;
                }).join("");

            return `
                <div class="pascal-row">
                    ${cells}
                </div>
            `;
        }).join("");

    getElement("pascal-target-summary").innerHTML =
        `
            <span>Highlighted coefficient</span>
            <strong>
                C(${n},${k}) = ${formatBigInt(rows[n][k])}
            </strong>
        `;
}

function calculateBinomial() {
    try {
        const n = readInteger("binomial-n");
        const k = readInteger("binomial-k");

        validateRange(n, 0, MAX_BINOMIAL_INPUT, "n");
        validateRange(k, 0, MAX_BINOMIAL_INPUT, "k");

        if (k > n) {
            throw new Error("k cannot be greater than n.");
        }

        const result = combinationBigInt(n, k);
        const nFactorial = factorialBigInt(n);
        const kFactorial = factorialBigInt(k);

        const difference = n - k;
        const differenceFactorial = factorialBigInt(difference);
        const denominator = kFactorial * differenceFactorial;

        const rows = buildPascalRows(n);

        let pascalStep;

        if (k === 0 || k === n) {
            pascalStep = `C(${n},${k}) = 1`;
        } else {
            const left = rows[n - 1][k - 1];
            const right = rows[n - 1][k];

            pascalStep =
                `C(${n},${k})`
                + ` = C(${n - 1},${k - 1})`
                + ` + C(${n - 1},${k})`
                + ` = ${formatBigInt(left)}`
                + ` + ${formatBigInt(right)}`
                + ` = ${formatBigInt(result)}`;
        }

        setResult(
            "binomial-result",
            `
                <div class="result-headline">
                    <span>Binomial coefficient</span>
                    <strong>
                        C(${n},${k}) = ${formatBigInt(result)}
                    </strong>
                </div>

                ${calculationSteps([
                    {
                        label: "factorial formula",
                        formula:
                            `C(${n},${k})`
                            + ` = ${n}! / (${k}! × ${difference}!)`
                    },
                    {
                        label: "expand every factorial",
                        formula:
                            `C(${n},${k})`
                            + ` = (${factorialProduct(n)})`
                            + ` / ((${factorialProduct(k)})`
                            + ` × (${factorialProduct(difference)}))`
                    },
                    {
                        label: "evaluate factorials",
                        formula:
                            `C(${n},${k})`
                            + ` = ${formatBigInt(nFactorial)}`
                            + ` / (${formatBigInt(kFactorial)}`
                            + ` × ${formatBigInt(differenceFactorial)})`
                    },
                    {
                        label: "evaluate denominator",
                        formula:
                            `C(${n},${k})`
                            + ` = ${formatBigInt(nFactorial)}`
                            + ` / ${formatBigInt(denominator)}`
                    },
                    {
                        label: "divide",
                        formula:
                            `C(${n},${k}) = ${formatBigInt(result)}`
                    },
                    {
                        label: "same value from Pascal's triangle",
                        formula: pascalStep
                    }
                ])}
            `
        );

        renderPascalTriangle(n, k);
    } catch (error) {
        setResult("binomial-result", escapeHtml(error.message), true);

        getElement("pascal-triangle").innerHTML =
            `<div class="pascal-error">${escapeHtml(error.message)}</div>`;

        getElement("pascal-target-summary").textContent =
            "Enter valid n and k";
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

        const difference = total - selected;

        const totalFactorial = factorialBigInt(total);
        const selectedFactorial = factorialBigInt(selected);
        const differenceFactorial = factorialBigInt(difference);

        const denominator =
            selectedFactorial
            *
            differenceFactorial;

        const result =
            combinationBigInt(total, selected);

        setResult(
            "team-result",
            `
                <div class="result-headline">
                    <span>Possible teams</span>
                    <strong>${formatBigInt(result)}</strong>
                </div>

                ${calculationSteps([
                    {
                        label: "combination formula",
                        formula:
                            `Teams = C(${total},${selected})`
                            + ` = ${total}!`
                            + ` / (${selected}! × ${difference}!)`
                    },
                    {
                        label: "expand factorials",
                        formula:
                            `Teams = (${factorialProduct(total)})`
                            + ` / ((${factorialProduct(selected)})`
                            + ` × (${factorialProduct(difference)}))`
                    },
                    {
                        label: "evaluate factorials",
                        formula:
                            `Teams = ${formatBigInt(totalFactorial)}`
                            + ` / (${formatBigInt(selectedFactorial)}`
                            + ` × ${formatBigInt(differenceFactorial)})`
                    },
                    {
                        label: "evaluate denominator",
                        formula:
                            `Teams = ${formatBigInt(totalFactorial)}`
                            + ` / ${formatBigInt(denominator)}`
                    },
                    {
                        label: "divide",
                        formula:
                            `Teams = ${formatBigInt(result)}`
                    }
                ])}
            `
        );
    } catch (error) {
        setResult("team-result", escapeHtml(error.message), true);
    }
}

function normalizeVowelSet(rawValue) {
    return new Set(
        Array.from(
            rawValue
                .toUpperCase()
                .replace(/[\s,;|/]+/gu, "")
        )
    );
}

function calculateGalois() {
    try {
        const rawWord = getElement("galois-word").value;

        const normalized =
            rawWord
                .replace(/\s+/gu, "")
                .toUpperCase();

        const characters = Array.from(normalized);

        if (characters.length === 0) {
            throw new Error("Please enter a word or sequence.");
        }

        validateRange(
            characters.length,
            1,
            MAX_FACTORIAL_INPUT,
            "Sequence length"
        );

        const vowelSet =
            normalizeVowelSet(
                getElement("galois-vowels").value
            );

        let vowels = 0;

        for (const character of characters) {
            if (vowelSet.has(character)) {
                vowels += 1;
            }
        }

        const consonants =
            characters.length - vowels;

        const totalCount =
            characters.length;

        const vowelFactorial =
            factorialBigInt(vowels);

        const consonantFactorial =
            factorialBigInt(consonants);

        const totalFactorial =
            factorialBigInt(totalCount);

        const favorable =
            vowelFactorial
            *
            consonantFactorial;

        const divisor =
            gcdBigInt(
                favorable,
                totalFactorial
            );

        const reducedNumerator =
            favorable / divisor;

        const reducedDenominator =
            totalFactorial / divisor;

        /*
         * Use the reduced fraction for the floating-point percentage.
         * This avoids Infinity / Infinity for long sequences, because
         * factorials such as 200! are larger than JavaScript Number.
         */
        const probability =
            Number(reducedNumerator)
            /
            Number(reducedDenominator);

        const percentage =
            probability * 100;

        const chooseGroups =
            combinationBigInt(
                totalCount,
                vowels
            );

        setResult(
            "galois-result",
            `
                <div class="result-headline">
                    <span>Required probability</span>
                    <strong>${percentage.toFixed(4)}%</strong>
                </div>

                <p class="result-context">
                    Sequence:
                    <strong>${escapeHtml(normalized)}</strong><br>
                    Vowels:
                    <strong>${vowels}</strong>;
                    other characters:
                    <strong>${consonants}</strong>
                </p>

                ${calculationSteps([
                    {
                        label: "general formula",
                        formula: "P = (V! × C!) / (V + C)!"
                    },
                    {
                        label: "substitute group sizes",
                        formula:
                            `P = (${vowels}! × ${consonants}!)`
                            + ` / ${totalCount}!`
                    },
                    {
                        label: "expand factorials",
                        formula:
                            `P = ((${factorialProduct(vowels)})`
                            + ` × (${factorialProduct(consonants)}))`
                            + ` / (${factorialProduct(totalCount)})`
                    },
                    {
                        label: "evaluate factorials",
                        formula:
                            `P = (${formatBigInt(vowelFactorial)}`
                            + ` × ${formatBigInt(consonantFactorial)})`
                            + ` / ${formatBigInt(totalFactorial)}`
                            + ` = ${formatBigInt(favorable)}`
                            + ` / ${formatBigInt(totalFactorial)}`
                    },
                    {
                        label: "reduce",
                        formula:
                            `P = ${reducedNumerator}`
                            + ` / ${reducedDenominator}`
                            + ` = 1 / C(${totalCount},${vowels})`
                            + ` = 1 / ${formatBigInt(chooseGroups)}`
                    },
                    {
                        label: "percentage",
                        formula:
                            `P = ${percentage.toFixed(4)}%`
                    }
                ])}
            `
        );
    } catch (error) {
        setResult("galois-result", escapeHtml(error.message), true);
    }
}

function enableNavigationWheelScroll() {
    const navigation =
        document.querySelector(".project-navigation");

    if (!navigation) {
        return;
    }

    navigation.addEventListener(
        "wheel",
        function (event) {
            const canScrollHorizontally =
                navigation.scrollWidth
                >
                navigation.clientWidth;

            if (!canScrollHorizontally) {
                return;
            }

            event.preventDefault();

            const scrollAmount =
                Math.abs(event.deltaX)
                >
                Math.abs(event.deltaY)
                    ? event.deltaX
                    : event.deltaY;

            navigation.scrollLeft += scrollAmount;
        },
        { passive: false }
    );
}

function attachCalculatorEvents() {
    const bindings = [
        ["probability-button", calculateProbability],
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
    calculatePermutations();
    calculateRepeatedObjects();
    calculateBinomial();
    calculateTeamSelection();
    calculateGalois();
}

document.addEventListener(
    "DOMContentLoaded",
    function () {
        attachCalculatorEvents();
        enableNavigationWheelScroll();
        calculateDefaultValues();
    }
);
