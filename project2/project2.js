"use strict";

const MAX_DATA_BITS = 1024;
const MAX_RECEIVED_BITS = MAX_DATA_BITS + calculateParityCount(MAX_DATA_BITS);
const PREVIEW_LIMIT = 28;

let latestEncodedCode = "";
let latestEncodedMetadata = [];

function getElement(id) {
    return document.getElementById(id);
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

    if (isFull) {
        statusText.textContent = `${cleaned.length} / ${maxLength} ${unitName} used. Input space is full.`;
    } else {
        statusText.textContent = `${cleaned.length} / ${maxLength} ${unitName} used. Input space available.`;
    }

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

    setResult(
        "xor-result",
        `
            Sequence: <strong>${bits}</strong><br>
            Number of ones: <strong>${ones}</strong><br>
            XOR result: <strong>${result}</strong>
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
        metadata,
        parityDetails
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
            <div class="${classes.join(" ")}">
                <span class="bit-position">#${position}</span>
                <span class="bit-value">${bit}</span>
                <span class="bit-type">${bitInfo.label}</span>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderParityExplanation(parityDetails) {
    const container = getElement("xor-list");

    if (parityDetails.length === 0) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = parityDetails.map((detail) => {
        const checked = previewList(detail.checkedPositions);
        const used = previewList(detail.usedPositions);

        return `
            <div class="xor-row">
                <h4>p${detail.parityPosition} = ${detail.value}</h4>
                <p>
                    Checks ${detail.checkedPositions.length} positions:
                    ${checked}
                </p>
                <p class="xor-expression">
                    p${detail.parityPosition} is calculated from positions:
                    ${used || "only itself"}
                </p>
            </div>
        `;
    }).join("");
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

        setResult(
            "encode-result",
            `
                Data bits: <strong>${result.dataLength}</strong><br>
                Parity bits: <strong>${result.parityCount}</strong><br>
                Total encoded bits: <strong>${result.totalLength}</strong><br>
                Condition: <strong>2^${result.parityCount} ≥ ${result.dataLength} + ${result.parityCount} + 1</strong>
            `
        );

        getElement("encoded-output").textContent = result.code;
        renderBitGrid("encoded-grid", result.code, result.metadata);
        renderParityExplanation(result.parityDetails);
    } catch (error) {
        setResult("encode-result", error.message, true);
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
                <strong>No error detected.</strong><br>
                Syndrome: <strong>0</strong>
            `;
        } else if (syndrome <= totalLength) {
            errorPosition = syndrome;
            const correctedArray = Array.from(receivedBits);
            correctedArray[errorPosition - 1] = correctedArray[errorPosition - 1] === "0" ? "1" : "0";
            correctedBits = correctedArray.join("");

            resultHtml = `
                <strong>One-bit error detected.</strong><br>
                Syndrome: <strong>${syndrome}</strong><br>
                Error position: <strong>${errorPosition}</strong><br>
                Corrected bit: <strong>${receivedBits[errorPosition - 1]} → ${correctedBits[errorPosition - 1]}</strong>
            `;
        } else {
            resultHtml = `
                <strong>Syndrome points outside the received code.</strong><br>
                Syndrome: <strong>${syndrome}</strong><br>
                This may indicate an invalid length or more than one error.
            `;
        }

        setResult("check-result", resultHtml, syndrome !== 0 && syndrome > totalLength);
        getElement("corrected-output").textContent = correctedBits;

        renderBitGrid("received-grid", receivedBits, metadata, {
            errorPosition
        });

        renderSyndromeExplanation(syndromeDetails, syndrome);
    } catch (error) {
        setResult("check-result", error.message, true);
    }
}

function renderSyndromeExplanation(syndromeDetails, syndrome) {
    const container = getElement("syndrome-list");

    container.innerHTML = syndromeDetails.map((detail) => {
        const checked = previewList(detail.checkedPositions);
        const status = detail.value === 0 ? "passed" : "failed";

        return `
            <div class="xor-row ${detail.value === 0 ? "check-passed" : "check-failed"}">
                <h4>p${detail.parityPosition} check: ${status}</h4>
                <p>
                    Checks ${detail.checkedPositions.length} positions:
                    ${checked}
                </p>
                <p class="xor-expression">
                    Check result = ${detail.value}
                </p>
            </div>
        `;
    }).join("") + `
        <div class="compact-result">
            <div class="result-chip ${syndrome === 0 ? "success" : "error"}">
                Syndrome = ${syndrome}
            </div>
        </div>
    `;
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
    getElement("load-encoded-button").addEventListener("click", loadEncodedCode);
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
