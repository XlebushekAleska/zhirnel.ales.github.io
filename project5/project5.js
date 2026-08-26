"use strict";

const MAX_TRANSMISSION_BITS = 4096;
const EPSILON = 1e-12;

function getElement(id) {
    return document.getElementById(id);
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatNumber(value, digits = 6) {
    if (!Number.isFinite(value)) {
        return "—";
    }

    const normalized = Math.abs(value) < EPSILON ? 0 : value;

    if (normalized === 0) {
        return "0";
    }

    if (Math.abs(normalized) >= 1000000 || Math.abs(normalized) < 0.000001) {
        return normalized.toExponential(4);
    }

    return Number(normalized.toFixed(digits)).toString();
}

function formatPercent(value, digits = 2) {
    if (!Number.isFinite(value)) {
        return "—";
    }

    return `${Number((value * 100).toFixed(digits))}%`;
}

function setResult(id, html, isError = false) {
    const result = getElement(id);
    result.innerHTML = html;
    result.classList.toggle("error", isError);
}

function updateMetricGrid(gridId, values) {
    const cards = getElement(gridId).querySelectorAll(".metric-card");

    cards.forEach((card, index) => {
        const strong = card.querySelector("strong");
        strong.textContent = values[index] ?? "—";
    });
}

function entropyFromProbabilities(probabilities) {
    return probabilities.reduce((sum, probability) => {
        if (!Number.isFinite(probability) || probability <= 0) {
            return sum;
        }

        return sum - probability * Math.log2(probability);
    }, 0);
}

function binaryEntropy(probability) {
    const p = clamp(probability, 0, 1);

    if (p <= EPSILON || p >= 1 - EPSILON) {
        return 0;
    }

    return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

function cleanSmallNegative(value) {
    if (value < 0 && value > -1e-10) {
        return 0;
    }

    return value;
}

function calculateJointMetrics(probabilities) {
    if (!Array.isArray(probabilities) || probabilities.length !== 4) {
        throw new Error("A 2×2 joint distribution requires exactly four probabilities.");
    }

    const [p00, p01, p10, p11] = probabilities;
    const px = [p00 + p01, p10 + p11];
    const py = [p00 + p10, p01 + p11];

    const hx = entropyFromProbabilities(px);
    const hy = entropyFromProbabilities(py);
    const hxy = entropyFromProbabilities(probabilities);
    const hxGivenY = cleanSmallNegative(hxy - hy);
    const hyGivenX = cleanSmallNegative(hxy - hx);
    const mutualInformation = cleanSmallNegative(hx + hy - hxy);

    return {
        probabilities: [...probabilities],
        px,
        py,
        hx,
        hy,
        hxy,
        hxGivenY,
        hyGivenX,
        mutualInformation
    };
}

function calculateBscMetrics(sourceOneProbability, crossoverProbability) {
    const q = clamp(sourceOneProbability, 0, 1);
    const p = clamp(crossoverProbability, 0, 0.5);

    const outputOneProbability = (1 - q) * p + q * (1 - p);
    const hx = binaryEntropy(q);
    const hy = binaryEntropy(outputOneProbability);
    const hyGivenX = binaryEntropy(p);
    const hxy = hx + hyGivenX;
    const hxGivenY = cleanSmallNegative(hxy - hy);
    const mutualInformation = cleanSmallNegative(hy - hyGivenX);
    const capacity = cleanSmallNegative(1 - binaryEntropy(p));

    return {
        q,
        p,
        outputOneProbability,
        hx,
        hy,
        hxy,
        hxGivenY,
        hyGivenX,
        mutualInformation,
        capacity
    };
}

function readJointInputs({ requireUnitSum = true } = {}) {
    const ids = ["joint-00", "joint-01", "joint-10", "joint-11"];
    const values = ids.map((id) => Number(getElement(id).value));

    values.forEach((value, index) => {
        if (!Number.isFinite(value) || value < 0) {
            throw new Error(`Joint probability ${index + 1} must be a non-negative number.`);
        }
    });

    const total = values.reduce((sum, value) => sum + value, 0);

    if (total <= 0) {
        throw new Error("The joint distribution must contain at least one positive value.");
    }

    if (requireUnitSum && Math.abs(total - 1) > 0.000001) {
        throw new Error(
            `The probabilities currently total ${formatNumber(total)}. ` +
            "They must total 1. Use Normalize to rescale them automatically."
        );
    }

    return { values, total };
}

function writeJointInputs(values) {
    const ids = ["joint-00", "joint-01", "joint-10", "joint-11"];

    ids.forEach((id, index) => {
        getElement(id).value = formatNumber(values[index], 10);
    });
}

function updateJointMarginals(metrics, total = 1) {
    getElement("marginal-x0").textContent = formatNumber(metrics.px[0]);
    getElement("marginal-x1").textContent = formatNumber(metrics.px[1]);
    getElement("marginal-y0").textContent = formatNumber(metrics.py[0]);
    getElement("marginal-y1").textContent = formatNumber(metrics.py[1]);
    getElement("joint-total").textContent = formatNumber(total);
}

function calculateJointDistribution() {
    try {
        const { values, total } = readJointInputs();
        const metrics = calculateJointMetrics(values);

        updateJointMarginals(metrics, total);
        updateMetricGrid("joint-metrics", [
            formatNumber(metrics.hx),
            formatNumber(metrics.hy),
            formatNumber(metrics.hxy),
            formatNumber(metrics.hxGivenY),
            formatNumber(metrics.hyGivenX),
            formatNumber(metrics.mutualInformation)
        ]);

        const dependenceText =
            metrics.mutualInformation < 0.000001
                ? "The variables are independent for this distribution."
                : "Knowing one variable reduces uncertainty about the other.";

        setResult(
            "joint-result",
            `
                Probability total: <strong>${formatNumber(total)}</strong><br>
                Mutual information: <strong>${formatNumber(metrics.mutualInformation)} bits</strong><br>
                ${escapeHtml(dependenceText)}
            `
        );
    } catch (error) {
        setResult("joint-result", escapeHtml(error.message), true);
    }
}

function normalizeJointDistribution() {
    try {
        const { values, total } = readJointInputs({ requireUnitSum: false });
        const normalized = values.map((value) => value / total);

        writeJointInputs(normalized);
        calculateJointDistribution();
    } catch (error) {
        setResult("joint-result", escapeHtml(error.message), true);
    }
}

function loadJointExample(type) {
    const examples = {
        independent: [0.25, 0.25, 0.25, 0.25],
        correlated: [0.4, 0.1, 0.1, 0.4],
        perfect: [0.5, 0, 0, 0.5]
    };

    writeJointInputs(examples[type] || examples.correlated);
    calculateJointDistribution();
}

function syncPercentagePair(rangeId, numberId, readoutId, maximum) {
    const range = getElement(rangeId);
    const number = getElement(numberId);
    const readout = getElement(readoutId);

    const applyValue = (rawValue) => {
        const parsed = Number(rawValue);
        const value = clamp(Number.isFinite(parsed) ? parsed : 0, 0, maximum);

        range.value = String(value);
        number.value = String(value);
        readout.textContent = `${formatNumber(value, 2)}%`;

        updateBscExplorer();
    };

    range.addEventListener("input", () => applyValue(range.value));
    number.addEventListener("input", () => applyValue(number.value));
    number.addEventListener("change", () => applyValue(number.value));
}

function getCurrentBscParameters() {
    const sourcePercent = clamp(Number(getElement("source-one-probability").value), 0, 100);
    const crossoverPercent = clamp(Number(getElement("crossover-probability").value), 0, 50);

    return {
        q: sourcePercent / 100,
        p: crossoverPercent / 100
    };
}

function updateBscDiagram(p) {
    const correct = 1 - p;
    const correctText = correct.toFixed(2);
    const crossoverText = p.toFixed(2);

    getElement("keep-zero-label").textContent = correctText;
    getElement("keep-one-label").textContent = correctText;
    getElement("flip-zero-label").textContent = crossoverText;
    getElement("flip-one-label").textContent = crossoverText;

    getElement("channel-matrix-00").textContent = correctText;
    getElement("channel-matrix-01").textContent = crossoverText;
    getElement("channel-matrix-10").textContent = crossoverText;
    getElement("channel-matrix-11").textContent = correctText;
}

function updateCapacityComparison(metrics) {
    const mutual = clamp(metrics.mutualInformation, 0, 1);
    const capacity = clamp(metrics.capacity, 0, 1);

    getElement("mutual-information-readout").textContent =
        `${formatNumber(mutual)} bits/use`;
    getElement("capacity-readout").textContent =
        `${formatNumber(capacity)} bits/use`;

    getElement("mutual-information-fill").style.width = `${mutual * 100}%`;
    getElement("capacity-fill").style.width = `${capacity * 100}%`;
}

function describeBsc(metrics) {
    if (metrics.p <= EPSILON) {
        return "Perfect channel: the output always equals the input.";
    }

    if (Math.abs(metrics.p - 0.5) <= EPSILON) {
        return "Maximum noise in the conventional BSC range: the output is independent of the input and capacity is zero.";
    }

    if (Math.abs(metrics.q - 0.5) <= 0.000001) {
        return "The source is balanced, so the current mutual information reaches the BSC capacity.";
    }

    return "The source is biased, so the current mutual information is below the channel capacity.";
}

function updateBscExplorer() {
    const { q, p } = getCurrentBscParameters();
    const metrics = calculateBscMetrics(q, p);

    getElement("source-one-readout").textContent = formatPercent(q);
    getElement("crossover-readout").textContent = formatPercent(p);
    getElement("simulator-crossover-readout").textContent = formatPercent(p);
    getElement("channel-state-badge").textContent = `${formatPercent(p)} crossover`;

    updateBscDiagram(p);
    updateCapacityComparison(metrics);

    updateMetricGrid("bsc-metrics", [
        formatNumber(metrics.hx),
        formatNumber(metrics.hy),
        formatNumber(metrics.hyGivenX),
        formatNumber(metrics.hxGivenY),
        formatNumber(metrics.mutualInformation),
        formatNumber(metrics.capacity)
    ]);

    setResult(
        "bsc-result",
        `
            P(X = 1): <strong>${formatPercent(metrics.q)}</strong><br>
            P(Y = 1): <strong>${formatPercent(metrics.outputOneProbability)}</strong><br>
            I(X;Y): <strong>${formatNumber(metrics.mutualInformation)} bits/use</strong><br>
            Capacity: <strong>${formatNumber(metrics.capacity)} bits/use</strong><br>
            ${escapeHtml(describeBsc(metrics))}
        `
    );
}

function applyBscPreset(type) {
    const presets = {
        perfect: { q: 50, p: 0 },
        moderate: { q: 50, p: 10 },
        random: { q: 50, p: 50 }
    };

    const preset = presets[type] || presets.moderate;

    getElement("source-one-probability-range").value = String(preset.q);
    getElement("source-one-probability").value = String(preset.q);
    getElement("crossover-probability-range").value = String(preset.p);
    getElement("crossover-probability").value = String(preset.p);

    updateBscExplorer();
}

function sanitizeBinaryText(rawText) {
    return String(rawText).replace(/[^01]/g, "").slice(0, MAX_TRANSMISSION_BITS);
}

function updateTransmissionCounter() {
    const input = getElement("transmission-input");
    const bitCount = sanitizeBinaryText(input.value).length;

    getElement("transmission-counter").textContent =
        `${bitCount.toLocaleString("en-US")} / ` +
        `${MAX_TRANSMISSION_BITS.toLocaleString("en-US")} bits`;
}

function createBalancedSample(length = 128) {
    let result = "";

    for (let index = 0; index < length; index += 1) {
        result += index % 2 === 0 ? "0" : "1";
    }

    return result;
}

function createRandomBinarySample(length = 256) {
    let result = "";

    for (let index = 0; index < length; index += 1) {
        result += Math.random() < 0.5 ? "0" : "1";
    }

    return result;
}

function simulateBscTransmission(bits, crossoverProbability) {
    const p = clamp(crossoverProbability, 0, 0.5);
    const outputBits = [];
    const errorFlags = [];
    const counts = {
        "00": 0,
        "01": 0,
        "10": 0,
        "11": 0
    };

    let errors = 0;
    let inputOnes = 0;

    for (const bit of bits) {
        if (bit === "1") {
            inputOnes += 1;
        }

        const flipped = Math.random() < p;
        const outputBit = flipped ? (bit === "0" ? "1" : "0") : bit;

        if (flipped) {
            errors += 1;
        }

        outputBits.push(outputBit);
        errorFlags.push(flipped);
        counts[`${bit}${outputBit}`] += 1;
    }

    const length = bits.length;
    const q = length > 0 ? inputOnes / length : 0;
    const observedBer = length > 0 ? errors / length : 0;
    const theoreticalMetrics = calculateBscMetrics(q, p);
    const empiricalJoint = length > 0
        ? [
            counts["00"] / length,
            counts["01"] / length,
            counts["10"] / length,
            counts["11"] / length
        ]
        : [0, 0, 0, 0];
    const empiricalMetrics = length > 0
        ? calculateJointMetrics(empiricalJoint)
        : null;

    return {
        inputBits: [...bits],
        outputBits,
        errorFlags,
        counts,
        length,
        errors,
        q,
        p,
        observedBer,
        expectedErrors: length * p,
        theoreticalMetrics,
        empiricalJoint,
        empiricalMetrics
    };
}

function renderBitStream(containerId, bits, errorFlags = []) {
    const container = getElement(containerId);

    container.innerHTML = bits.map((bit, index) => {
        const flipped = Boolean(errorFlags[index]);
        const className = flipped ? "bit-token bit-token-error" : "bit-token";
        const title = flipped ? "This bit changed during transmission" : "Unchanged bit";

        return `<span class="${className}" title="${title}">${bit}</span>`;
    }).join("");
}

function renderTransmissionCounts(counts) {
    getElement("observed-00").textContent = counts["00"].toLocaleString("en-US");
    getElement("observed-01").textContent = counts["01"].toLocaleString("en-US");
    getElement("observed-10").textContent = counts["10"].toLocaleString("en-US");
    getElement("observed-11").textContent = counts["11"].toLocaleString("en-US");
}

function runTransmission() {
    try {
        const rawInput = getElement("transmission-input").value;
        const sanitized = sanitizeBinaryText(rawInput);

        if (sanitized.length === 0) {
            throw new Error("Enter at least one binary digit (0 or 1) before transmitting.");
        }

        getElement("transmission-input").value = sanitized;
        updateTransmissionCounter();

        const { p } = getCurrentBscParameters();
        const simulation = simulateBscTransmission(Array.from(sanitized), p);
        const empiricalMutual = simulation.empiricalMetrics?.mutualInformation ?? 0;

        updateMetricGrid("transmission-metrics", [
            simulation.length.toLocaleString("en-US"),
            simulation.errors.toLocaleString("en-US"),
            formatPercent(simulation.observedBer),
            formatNumber(simulation.theoreticalMetrics.mutualInformation),
            formatNumber(empiricalMutual),
            formatNumber(simulation.theoreticalMetrics.capacity)
        ]);

        renderBitStream("input-bit-stream", simulation.inputBits);
        renderBitStream("output-bit-stream", simulation.outputBits, simulation.errorFlags);
        renderTransmissionCounts(simulation.counts);

        setResult(
            "transmission-result",
            `
                Channel uses: <strong>${simulation.length.toLocaleString("en-US")}</strong><br>
                Bit flips: <strong>${simulation.errors.toLocaleString("en-US")}</strong><br>
                Observed BER: <strong>${formatPercent(simulation.observedBer)}</strong><br>
                Expected BER: <strong>${formatPercent(simulation.p)}</strong><br>
                Expected number of flips: <strong>${formatNumber(simulation.expectedErrors, 2)}</strong>
            `
        );
    } catch (error) {
        setResult("transmission-result", escapeHtml(error.message), true);
    }
}

function enableNavigationWheelScroll() {
    const navigation = document.querySelector(".project-navigation");

    if (!navigation) {
        return;
    }

    navigation.addEventListener(
        "wheel",
        (event) => {
            const canScroll = navigation.scrollWidth > navigation.clientWidth;

            if (!canScroll) {
                return;
            }

            event.preventDefault();

            const amount =
                Math.abs(event.deltaX) > Math.abs(event.deltaY)
                    ? event.deltaX
                    : event.deltaY;

            navigation.scrollLeft += amount;
        },
        { passive: false }
    );
}

function attachEvents() {
    getElement("calculate-joint").addEventListener("click", calculateJointDistribution);
    getElement("normalize-joint").addEventListener("click", normalizeJointDistribution);

    getElement("joint-independent-example").addEventListener(
        "click",
        () => loadJointExample("independent")
    );
    getElement("joint-correlated-example").addEventListener(
        "click",
        () => loadJointExample("correlated")
    );
    getElement("joint-perfect-example").addEventListener(
        "click",
        () => loadJointExample("perfect")
    );

    document.querySelectorAll(".joint-probability-input").forEach((input) => {
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                calculateJointDistribution();
            }
        });
    });

    syncPercentagePair(
        "source-one-probability-range",
        "source-one-probability",
        "source-one-readout",
        100
    );
    syncPercentagePair(
        "crossover-probability-range",
        "crossover-probability",
        "crossover-readout",
        50
    );

    document.querySelectorAll("[data-bsc-preset]").forEach((button) => {
        button.addEventListener("click", () => {
            applyBscPreset(button.dataset.bscPreset);
        });
    });

    getElement("transmission-input").addEventListener("input", updateTransmissionCounter);

    getElement("balanced-sample-button").addEventListener("click", () => {
        getElement("transmission-input").value = createBalancedSample(128);
        updateTransmissionCounter();
    });

    getElement("random-sample-button").addEventListener("click", () => {
        getElement("transmission-input").value = createRandomBinarySample(256);
        updateTransmissionCounter();
    });

    getElement("transmit-button").addEventListener("click", runTransmission);
}

function initializePage() {
    enableNavigationWheelScroll();
    attachEvents();
    calculateJointDistribution();
    updateBscExplorer();
    updateTransmissionCounter();
}

document.addEventListener("DOMContentLoaded", initializePage);
