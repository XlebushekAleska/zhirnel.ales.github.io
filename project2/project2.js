"use strict";

const MAX_DATA_BITS = 1024;
const MAX_RECEIVED_BITS = MAX_DATA_BITS + calculateParityCount(MAX_DATA_BITS);
const COVERAGE_VISUAL_LIMIT = 64;
const PREVIEW_LIMIT = 28;

let latestEncodedCode = "";
let latestEncodedMetadata = [];
let latestParityDetails = [];

function getElement(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function isPowerOfTwo(number) {
    return number > 0 && (number & (number - 1)) === 0;
}

function calculateParityCount(dataLength) {
    let parityCount = 0;

    while (2 ** parityCount < dataLength + parityCount + 1) {
        parityCount += 1;
    }

    return parityCount;
}

function cleanBitString(value, maxLength) {
    return Array.from(value)
        .filter((character) => character === "0" || character === "1")
        .join("")
        .slice(0, maxLength);
}

function updateLimitedTextarea(textareaId, statusId, statusTextId, maxLength, unitName) {
    const textarea = getElement(textareaId);
    const cleaned = cleanBitString(textarea.value, maxLength);

    if (textarea.value !== cleaned) {
        textarea.value = cleaned;
    }

    const status = getElement(statusId);
    const statusText = getElement(statusTextId);
    const isFull = cleaned.length >= maxLength;

    status.classList.toggle("is-full", isFull);

    statusText.textContent = isFull
        ? `${cleaned.length} / ${maxLength} ${unitName} used. Input space is full.`
        : `${cleaned.length} / ${maxLength} ${unitName} used. Input space available.`;

    return cleaned;
}

function setResult(id, html, isError = false) {
    const result = getElement(id);
    result.innerHTML = html;
    result.classList.toggle("error", isError);
}

function previewList(items, limit = PREVIEW_LIMIT) {
    if (items.length <= limit) {
        return items.join(", ");
    }

    return `${items.slice(0, limit).join(", ")}, ...`;
}

function xorBits(bitString) {
    let result = 0;

    for (const bit of bitString) {
        result ^= Number(bit);
    }

    return result;
}

function binaryWidthForLength(totalLength) {
    return Math.max(1, Math.ceil(Math.log2(totalLength + 1)));
}

function positionToBinary(position, width) {
    return position.toString(2).padStart(width, "0");
}

function calculateXorMini() {
    const input = getElement("xor-bits");
    const bits = cleanBitString(input.value, MAX_DATA_BITS);

    if (input.value !== bits) {
        input.value = bits;
    }

    if (bits.length === 0) {
        setResult("xor-result", "Please enter at least one bit.", true);
        return;
    }

    const result = xorBits(bits);
    const ones = Array.from(bits).filter((bit) => bit === "1").length;
    const expression = Array.from(bits).join(" ⊕ ");

    setResult(
        "xor-result",
        `
            <div class="hamming-result-headline">
                <span>XOR result</span>
                <strong>${result}</strong>
            </div>

            <div class="hamming-formula-steps">
                <div class="hamming-formula-step">
                    <span>Input bits</span>
                    <code>${escapeHtml(bits)}</code>
                </div>
                <div class="hamming-formula-step">
                    <span>Full XOR expression</span>
                    <code>${escapeHtml(expression)} = ${result}</code>
                </div>
                <div class="hamming-formula-step">
                    <span>Parity interpretation</span>
                    <code>${ones} one${ones === 1 ? "" : "s"} → ${ones % 2 === 0 ? "even" : "odd"} parity</code>
                </div>
            </div>
        `
    );
}

function createMetadata(totalLength) {
    const metadata = [];
    let dataIndex = 1;

    for (let position = 1; position <= totalLength; position += 1) {
        if (isPowerOfTwo(position)) {
            metadata[position] = {
                type: "parity",
                label: `p${position}`
            };
        } else {
            metadata[position] = {
                type: "data",
                label: `d${dataIndex}`
            };
            dataIndex += 1;
        }
    }

    return metadata;
}

function getParityPositions(totalLength) {
    const positions = [];

    for (let position = 1; position <= totalLength; position *= 2) {
        positions.push(position);
    }

    return positions;
}

function getParityRequirementSteps(dataLength, finalParityCount) {
    const steps = [];

    for (let r = 0; r <= finalParityCount; r += 1) {
        const left = 2 ** r;
        const right = dataLength + r + 1;

        steps.push({
            r,
            left,
            right,
            works: left >= right
        });
    }

    return steps;
}

function buildHammingCode(dataBits) {
    const dataLength = dataBits.length;
    const parityCount = calculateParityCount(dataLength);
    const totalLength = dataLength + parityCount;
    const code = new Array(totalLength + 1).fill("0");
    const metadata = createMetadata(totalLength);
    const parityPositions = getParityPositions(totalLength);

    let dataIndex = 0;

    for (let position = 1; position <= totalLength; position += 1) {
        if (!isPowerOfTwo(position)) {
            code[position] = dataBits[dataIndex];
            dataIndex += 1;
        }
    }

    const codeBeforeParity = code.slice();
    const parityDetails = [];

    for (const parityPosition of parityPositions) {
        const checkedPositions = [];
        const usedPositions = [];
        let parityValue = 0;

        for (let position = 1; position <= totalLength; position += 1) {
            if ((position & parityPosition) !== 0) {
                checkedPositions.push(position);

                if (position !== parityPosition) {
                    usedPositions.push(position);
                    parityValue ^= Number(code[position]);
                }
            }
        }

        code[parityPosition] = String(parityValue);

        parityDetails.push({
            parityPosition,
            checkedPositions,
            usedPositions,
            value: parityValue
        });
    }

    return {
        dataLength,
        parityCount,
        totalLength,
        code: code.slice(1).join(""),
        codeArray: code,
        codeBeforeParity,
        metadata,
        parityPositions,
        parityDetails,
        parityRequirementSteps: getParityRequirementSteps(dataLength, parityCount)
    };
}

function renderBitGrid(containerId, bits, metadata, options = {}) {
    const container = getElement(containerId);
    let html = "";

    for (let index = 0; index < bits.length; index += 1) {
        const position = index + 1;
        const bit = bits[index];
        const bitInfo = metadata[position] || {
            type: isPowerOfTwo(position) ? "parity" : "data",
            label: isPowerOfTwo(position) ? `p${position}` : "data"
        };

        const classes = [
            "bit-cell",
            bitInfo.type === "parity" ? "parity-bit" : "data-bit"
        ];

        if (options.errorPosition === position) {
            classes.push("error-bit");
        }

        if (options.correctedPosition === position) {
            classes.push("corrected-bit");
        }

        html += `
            <div
                class="${classes.join(" ")}"
                data-position="${position}"
                tabindex="0"
            >
                <span class="bit-position">#${position}</span>
                <span class="bit-value">${bit}</span>
                <span class="bit-type">${bitInfo.label}</span>
            </div>
        `;
    }

    container.innerHTML = html;

    if (containerId === "encoded-grid") {
        wireEncodedGridInteractions();
    }
}

function renderEncodingPipeline(result, dataBits) {
    const parityPositionText = result.parityPositions.map((position) => `p${position}`).join(", ");
    const structure = [];

    for (let position = 1; position <= result.totalLength; position += 1) {
        structure.push(result.metadata[position].label);
    }

    const parityValues = result.parityDetails
        .map((detail) => `p${detail.parityPosition}=${detail.value}`)
        .join(", ");

    getElement("encoding-pipeline").innerHTML = `
        <div class="pipeline-stage">
            <span class="pipeline-number">1</span>
            <small>Input</small>
            <strong>${escapeHtml(dataBits)}</strong>
            <p>${result.dataLength} data bit${result.dataLength === 1 ? "" : "s"}</p>
        </div>
        <div class="pipeline-arrow" aria-hidden="true">→</div>
        <div class="pipeline-stage">
            <span class="pipeline-number">2</span>
            <small>Reserve parity positions</small>
            <strong>${result.parityCount} parity bits</strong>
            <p>${escapeHtml(parityPositionText)}</p>
        </div>
        <div class="pipeline-arrow" aria-hidden="true">→</div>
        <div class="pipeline-stage">
            <span class="pipeline-number">3</span>
            <small>Place data</small>
            <strong>${result.totalLength} positions</strong>
            <p>${escapeHtml(previewList(structure, 18))}</p>
        </div>
        <div class="pipeline-arrow" aria-hidden="true">→</div>
        <div class="pipeline-stage">
            <span class="pipeline-number">4</span>
            <small>Calculate parity</small>
            <strong>${escapeHtml(parityValues)}</strong>
            <p>Even parity via XOR</p>
        </div>
        <div class="pipeline-arrow" aria-hidden="true">→</div>
        <div class="pipeline-stage pipeline-stage-final">
            <span class="pipeline-number">5</span>
            <small>Encoded word</small>
            <strong>${escapeHtml(result.code)}</strong>
            <p>Ready for transmission</p>
        </div>
    `;
}

function renderParityExplanation(parityDetails, codeArray) {
    const container = getElement("xor-list");

    container.innerHTML = parityDetails.map((detail) => {
        const values = detail.usedPositions.map((position) => codeArray[position]);
        const labeledValues = detail.usedPositions
            .map((position) => `#${position}=${codeArray[position]}`)
            .join(", ");
        const xorExpression = values.length > 0 ? values.join(" ⊕ ") : "0";

        return `
            <div class="xor-row parity-detail-row" data-parity-detail="${detail.parityPosition}">
                <h4>p${detail.parityPosition} = ${detail.value}</h4>
                <p>
                    Coverage positions: ${escapeHtml(previewList(detail.checkedPositions))}
                </p>
                <p>
                    Data/parity values used to solve p${detail.parityPosition}:
                    ${escapeHtml(labeledValues || "none")}
                </p>
                <div class="full-xor-expression">
                    <code>
                        p${detail.parityPosition}
                        = ${escapeHtml(xorExpression)}
                        = ${detail.value}
                    </code>
                </div>
            </div>
        `;
    }).join("");
}

function getCoverageDisplayPositions(totalLength) {
    if (totalLength <= COVERAGE_VISUAL_LIMIT) {
        return Array.from({ length: totalLength }, (_, index) => index + 1);
    }

    const half = COVERAGE_VISUAL_LIMIT / 2;
    const first = Array.from({ length: half }, (_, index) => index + 1);
    const lastStart = totalLength - half + 1;
    const last = Array.from({ length: half }, (_, index) => lastStart + index);

    return [...new Set([...first, ...last])];
}

function renderCoverageMap(result) {
    const positions = getCoverageDisplayPositions(result.totalLength);
    const width = binaryWidthForLength(result.totalLength);
    const map = getElement("coverage-map");

    map.style.setProperty("--coverage-columns", String(positions.length));

    const cells = (values, rowClass = "") => values.map((value) => value(rowClass)).join("");

    const positionCells = cells(
        positions.map((position) => () => `
            <div class="coverage-cell coverage-position-cell" data-coverage-position="${position}">
                <strong>${position}</strong>
            </div>
        `)
    );

    const binaryCells = cells(
        positions.map((position) => () => `
            <div class="coverage-cell coverage-binary-cell" data-coverage-position="${position}">
                ${positionToBinary(position, width)}
            </div>
        `)
    );

    const typeCells = cells(
        positions.map((position) => () => {
            const info = result.metadata[position];
            return `
                <div
                    class="coverage-cell coverage-type-cell ${info.type === "parity" ? "is-parity" : "is-data"}"
                    data-coverage-position="${position}"
                >
                    ${info.label}
                </div>
            `;
        })
    );

    const bitCells = cells(
        positions.map((position) => () => `
            <div class="coverage-cell coverage-bit-cell" data-coverage-position="${position}">
                ${result.codeArray[position]}
            </div>
        `)
    );

    const parityRows = result.parityPositions.map((parityPosition) => {
        const rowCells = positions.map((position) => {
            const covered = (position & parityPosition) !== 0;

            return `
                <div
                    class="coverage-cell coverage-check-cell ${covered ? "is-covered" : ""}"
                    data-coverage-position="${position}"
                    data-coverage-parity="${parityPosition}"
                >
                    ${covered ? "✓" : "·"}
                </div>
            `;
        }).join("");

        return `
            <div class="coverage-row" data-parity-row="${parityPosition}">
                <div class="coverage-row-label parity-row-label">p${parityPosition}</div>
                ${rowCells}
            </div>
        `;
    }).join("");

    map.innerHTML = `
        <div class="coverage-row coverage-header-row">
            <div class="coverage-row-label">Position</div>
            ${positionCells}
        </div>
        <div class="coverage-row">
            <div class="coverage-row-label">Binary</div>
            ${binaryCells}
        </div>
        <div class="coverage-row">
            <div class="coverage-row-label">Type</div>
            ${typeCells}
        </div>
        <div class="coverage-row">
            <div class="coverage-row-label">Bit</div>
            ${bitCells}
        </div>
        ${parityRows}
    `;

    getElement("coverage-note").textContent = result.totalLength <= COVERAGE_VISUAL_LIMIT
        ? `All ${result.totalLength} encoded positions are shown.`
        : `The code contains ${result.totalLength} positions. For readability, the map shows the first 32 and last 32 positions; all parity calculations still use the complete code.`;

    wireCoverageInteractions(result);
}

function clearCoverageHighlights() {
    document.querySelectorAll(".coverage-map .is-related").forEach((element) => {
        element.classList.remove("is-related");
    });

    document.querySelectorAll(".coverage-map .is-active-row").forEach((element) => {
        element.classList.remove("is-active-row");
    });

    document.querySelectorAll("#encoded-grid .coverage-highlight").forEach((element) => {
        element.classList.remove("coverage-highlight");
    });
}

function inspectPosition(position, result) {
    clearCoverageHighlights();

    document.querySelectorAll(`[data-coverage-position="${position}"]`).forEach((element) => {
        element.classList.add("is-related");
    });

    const coveredBy = result.parityPositions.filter((parityPosition) => {
        return (position & parityPosition) !== 0;
    });

    coveredBy.forEach((parityPosition) => {
        const row = document.querySelector(`[data-parity-row="${parityPosition}"]`);
        if (row) {
            row.classList.add("is-active-row");
        }
    });

    const encodedCell = document.querySelector(`#encoded-grid .bit-cell[data-position="${position}"]`);
    if (encodedCell) {
        encodedCell.classList.add("coverage-highlight");
    }

    const width = binaryWidthForLength(result.totalLength);
    const info = result.metadata[position];

    getElement("coverage-inspector").innerHTML = `
        <strong>Position ${position}</strong>
        = <code>${positionToBinary(position, width)}₂</code>
        · ${escapeHtml(info.label)}
        · covered by
        <strong>${coveredBy.map((value) => `p${value}`).join(", ") || "none"}</strong>
    `;
}

function inspectParity(parityPosition, result) {
    clearCoverageHighlights();

    const row = document.querySelector(`[data-parity-row="${parityPosition}"]`);
    if (row) {
        row.classList.add("is-active-row");
    }

    const coveredPositions = [];

    for (let position = 1; position <= result.totalLength; position += 1) {
        if ((position & parityPosition) !== 0) {
            coveredPositions.push(position);

            const encodedCell = document.querySelector(`#encoded-grid .bit-cell[data-position="${position}"]`);
            if (encodedCell) {
                encodedCell.classList.add("coverage-highlight");
            }
        }
    }

    document.querySelectorAll(`[data-coverage-parity="${parityPosition}"].is-covered`).forEach((element) => {
        element.classList.add("is-related");
    });

    const bitIndex = Math.log2(parityPosition);

    getElement("coverage-inspector").innerHTML = `
        <strong>p${parityPosition}</strong>
        checks positions whose binary index has bit ${bitIndex} set to 1.
        Visible/full coverage: <strong>${coveredPositions.length} positions</strong>.
    `;
}

function wireCoverageInteractions(result) {
    const map = getElement("coverage-map");

    map.querySelectorAll("[data-coverage-position]").forEach((cell) => {
        cell.addEventListener("mouseenter", () => {
            inspectPosition(Number(cell.dataset.coveragePosition), result);
        });
    });

    map.querySelectorAll("[data-parity-row]").forEach((row) => {
        row.addEventListener("mouseenter", () => {
            inspectParity(Number(row.dataset.parityRow), result);
        });
    });

    map.addEventListener("mouseleave", () => {
        clearCoverageHighlights();
        getElement("coverage-inspector").textContent =
            "Hover a position or parity row to inspect the relationship.";
    });
}

function wireEncodedGridInteractions() {
    const grid = getElement("encoded-grid");

    if (!latestEncodedCode || latestEncodedMetadata.length === 0) {
        return;
    }

    const resultLike = {
        totalLength: latestEncodedCode.length,
        metadata: latestEncodedMetadata,
        parityPositions: getParityPositions(latestEncodedCode.length)
    };

    grid.querySelectorAll(".bit-cell[data-position]").forEach((cell) => {
        cell.addEventListener("mouseenter", () => {
            inspectPosition(Number(cell.dataset.position), resultLike);
        });

        cell.addEventListener("focus", () => {
            inspectPosition(Number(cell.dataset.position), resultLike);
        });
    });

    grid.addEventListener("mouseleave", clearCoverageHighlights);
}

function renderParityRequirement(result) {
    const rows = result.parityRequirementSteps.map((step) => `
        <div class="parity-requirement-row ${step.works ? "works" : "fails"}">
            <span>r = ${step.r}</span>
            <code>
                2^${step.r} = ${step.left}
                ${step.works ? "≥" : "<"}
                ${result.dataLength} + ${step.r} + 1 = ${step.right}
            </code>
            <strong>${step.works ? "enough" : "not enough"}</strong>
        </div>
    `).join("");

    return `
        <div class="parity-requirement-list">
            ${rows}
        </div>
    `;
}

function encodeDataBits() {
    try {
        const dataBits = updateLimitedTextarea(
            "data-bits",
            "data-limit-status",
            "data-status-text",
            MAX_DATA_BITS,
            "data bits"
        );

        if (dataBits.length === 0) {
            throw new Error("Please enter at least one data bit.");
        }

        const result = buildHammingCode(dataBits);

        latestEncodedCode = result.code;
        latestEncodedMetadata = result.metadata;
        latestParityDetails = result.parityDetails;

        setResult(
            "encode-result",
            `
                <div class="hamming-result-headline">
                    <span>Encoded length</span>
                    <strong>${result.totalLength} bits</strong>
                </div>

                <p class="hamming-result-summary">
                    <strong>${result.dataLength}</strong> data bits +
                    <strong>${result.parityCount}</strong> parity bits =
                    <strong>${result.totalLength}</strong> total bits.
                </p>

                <div class="hamming-formula-title">Find the smallest valid r</div>
                ${renderParityRequirement(result)}
            `
        );

        getElement("encoded-output").textContent = result.code;

        renderBitGrid("encoded-grid", result.code, result.metadata);
        renderEncodingPipeline(result, dataBits);
        renderParityExplanation(result.parityDetails, result.codeArray);
        renderCoverageMap(result);
    } catch (error) {
        setResult("encode-result", escapeHtml(error.message), true);
    }
}

function loadEncodedCode() {
    if (!latestEncodedCode) {
        encodeDataBits();
    }

    if (!latestEncodedCode) {
        return;
    }

    getElement("received-bits").value = latestEncodedCode;

    updateLimitedTextarea(
        "received-bits",
        "received-limit-status",
        "received-status-text",
        MAX_RECEIVED_BITS,
        "received bits"
    );
}

function flipRandomBit() {
    let receivedBits = updateLimitedTextarea(
        "received-bits",
        "received-limit-status",
        "received-status-text",
        MAX_RECEIVED_BITS,
        "received bits"
    );

    if (receivedBits.length === 0) {
        loadEncodedCode();
        receivedBits = getElement("received-bits").value;
    }

    if (receivedBits.length === 0) {
        setResult("check-result", "There is no code to modify.", true);
        return;
    }

    const index = Math.floor(Math.random() * receivedBits.length);
    const bits = Array.from(receivedBits);

    bits[index] = bits[index] === "0" ? "1" : "0";

    getElement("received-bits").value = bits.join("");

    updateLimitedTextarea(
        "received-bits",
        "received-limit-status",
        "received-status-text",
        MAX_RECEIVED_BITS,
        "received bits"
    );

    checkReceivedCode();
}

function renderSyndromeExplanation(syndromeDetails, syndrome, bits) {
    const container = getElement("syndrome-list");

    const rows = syndromeDetails.map((detail) => {
        const values = detail.checkedPositions.map((position) => bits[position]);
        const labeledValues = detail.checkedPositions
            .map((position) => `#${position}=${bits[position]}`)
            .join(", ");
        const xorExpression = values.join(" ⊕ ");
        const status = detail.value === 0 ? "passed" : "failed";

        return `
            <div class="xor-row ${detail.value === 0 ? "check-passed" : "check-failed"}">
                <h4>p${detail.parityPosition} check: ${status}</h4>
                <p>
                    Positions: ${escapeHtml(previewList(detail.checkedPositions))}
                </p>
                <p>
                    Values: ${escapeHtml(labeledValues)}
                </p>
                <div class="full-xor-expression">
                    <code>
                        ${escapeHtml(xorExpression)} = ${detail.value}
                    </code>
                </div>
            </div>
        `;
    }).join("");

    const failed = syndromeDetails
        .filter((detail) => detail.value !== 0)
        .map((detail) => detail.parityPosition);

    const weightedSum = failed.length > 0
        ? `${failed.join(" + ")} = ${syndrome}`
        : "0";

    container.innerHTML = rows + `
        <div class="syndrome-summary-card ${syndrome === 0 ? "success" : "error"}">
            <span>Combine failed checks</span>
            <code>${weightedSum}</code>
            <strong>Syndrome = ${syndrome}</strong>
        </div>
    `;
}

function renderSyndromeLocator(syndromeDetails, syndrome, totalLength) {
    const container = getElement("syndrome-locator");
    const reversed = [...syndromeDetails].reverse();
    const binary = reversed.map((detail) => String(detail.value)).join("");
    const failed = syndromeDetails
        .filter((detail) => detail.value !== 0)
        .map((detail) => detail.parityPosition);

    const bitHeaders = reversed.map((detail) => `
        <div class="syndrome-column">
            <span>p${detail.parityPosition}</span>
            <strong class="${detail.value ? "failed" : "passed"}">${detail.value}</strong>
        </div>
    `).join("");

    let conclusion;

    if (syndrome === 0) {
        conclusion = `
            <div class="syndrome-conclusion success">
                <strong>${binary || "0"}₂ = 0₁₀</strong>
                <span>All parity checks pass.</span>
            </div>
        `;
    } else if (syndrome <= totalLength) {
        conclusion = `
            <div class="syndrome-conclusion error">
                <strong>${binary}₂ = ${syndrome}₁₀</strong>
                <span>Suspected one-bit error at position ${syndrome}.</span>
            </div>
        `;
    } else {
        conclusion = `
            <div class="syndrome-conclusion warning">
                <strong>${binary}₂ = ${syndrome}₁₀</strong>
                <span>The syndrome points outside this received code.</span>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="syndrome-columns">
            ${bitHeaders}
        </div>
        <div class="syndrome-equals">↓</div>
        ${conclusion}
        <div class="syndrome-weighted-sum">
            Failed-check weights:
            <strong>${failed.length > 0 ? failed.join(" + ") : "none"}</strong>
        </div>
    `;
}

function checkReceivedCode() {
    try {
        const receivedBits = updateLimitedTextarea(
            "received-bits",
            "received-limit-status",
            "received-status-text",
            MAX_RECEIVED_BITS,
            "received bits"
        );

        if (receivedBits.length === 0) {
            throw new Error("Please enter a received code.");
        }

        const totalLength = receivedBits.length;
        const metadata = createMetadata(totalLength);
        const parityPositions = getParityPositions(totalLength);
        const bits = ["", ...Array.from(receivedBits)];
        const syndromeDetails = [];
        let syndrome = 0;

        for (const parityPosition of parityPositions) {
            const checkedPositions = [];
            let parityCheck = 0;

            for (let position = 1; position <= totalLength; position += 1) {
                if ((position & parityPosition) !== 0) {
                    checkedPositions.push(position);
                    parityCheck ^= Number(bits[position]);
                }
            }

            if (parityCheck !== 0) {
                syndrome += parityPosition;
            }

            syndromeDetails.push({
                parityPosition,
                checkedPositions,
                value: parityCheck
            });
        }

        let correctedBits = receivedBits;
        let errorPosition = 0;
        let resultHtml = "";

        if (syndrome === 0) {
            resultHtml = `
                <div class="hamming-result-headline">
                    <span>Syndrome</span>
                    <strong>0</strong>
                </div>
                <p class="hamming-result-summary">
                    Every parity check returned 0, so the sequence satisfies the Hamming parity equations.
                </p>
                <p class="muted">
                    This does not prove that multiple errors are absent; some multi-bit patterns can imitate another valid codeword.
                </p>
            `;
        } else if (syndrome <= totalLength) {
            errorPosition = syndrome;
            const correctedArray = Array.from(receivedBits);
            const originalBit = correctedArray[errorPosition - 1];

            correctedArray[errorPosition - 1] = originalBit === "0" ? "1" : "0";
            correctedBits = correctedArray.join("");

            resultHtml = `
                <div class="hamming-result-headline">
                    <span>Suspected error</span>
                    <strong>position ${errorPosition}</strong>
                </div>
                <div class="hamming-formula-steps">
                    <div class="hamming-formula-step">
                        <span>Syndrome value</span>
                        <code>${syndrome}</code>
                    </div>
                    <div class="hamming-formula-step">
                        <span>Single-bit correction</span>
                        <code>#${errorPosition}: ${originalBit} → ${correctedArray[errorPosition - 1]}</code>
                    </div>
                </div>
                <p class="muted">
                    The correction is valid under the assumption that exactly one bit was corrupted.
                </p>
            `;
        } else {
            resultHtml = `
                <div class="hamming-result-headline">
                    <span>Invalid single-error location</span>
                    <strong>${syndrome}</strong>
                </div>
                <p class="hamming-result-summary">
                    The syndrome points outside the received sequence. The length may be invalid or more than one bit may be wrong.
                </p>
            `;
        }

        setResult(
            "check-result",
            resultHtml,
            syndrome !== 0 && syndrome > totalLength
        );

        getElement("corrected-output").textContent = correctedBits;

        renderBitGrid("received-grid", receivedBits, metadata, { errorPosition });
        renderSyndromeExplanation(syndromeDetails, syndrome, bits);
        renderSyndromeLocator(syndromeDetails, syndrome, totalLength);
    } catch (error) {
        setResult("check-result", escapeHtml(error.message), true);
        getElement("syndrome-locator").innerHTML = "";
        getElement("syndrome-list").innerHTML = "";
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

function attachEvents() {
    getElement("xor-button").addEventListener("click", calculateXorMini);
    getElement("encode-button").addEventListener("click", encodeDataBits);
    getElement("load-encoded-button").addEventListener("click", function () {
        loadEncodedCode();
        checkReceivedCode();
    });
    getElement("flip-random-button").addEventListener("click", flipRandomBit);
    getElement("check-button").addEventListener("click", checkReceivedCode);

    getElement("data-bits").addEventListener("input", function () {
        updateLimitedTextarea(
            "data-bits",
            "data-limit-status",
            "data-status-text",
            MAX_DATA_BITS,
            "data bits"
        );
    });

    getElement("received-bits").addEventListener("input", function () {
        updateLimitedTextarea(
            "received-bits",
            "received-limit-status",
            "received-status-text",
            MAX_RECEIVED_BITS,
            "received bits"
        );
    });
}

document.addEventListener("DOMContentLoaded", function () {
    attachEvents();
    enableNavigationWheelScroll();

    updateLimitedTextarea(
        "data-bits",
        "data-limit-status",
        "data-status-text",
        MAX_DATA_BITS,
        "data bits"
    );

    updateLimitedTextarea(
        "received-bits",
        "received-limit-status",
        "received-status-text",
        MAX_RECEIVED_BITS,
        "received bits"
    );

    calculateXorMini();
    encodeDataBits();
    loadEncodedCode();
    checkReceivedCode();
});
