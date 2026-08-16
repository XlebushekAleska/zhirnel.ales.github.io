"use strict";

const MAX_PROBABILITY_ROWS = 64;
const MAX_TEXT_LENGTH = 20000;
const MAX_TREE_LEAVES = 96;
const ENCODED_PREVIEW_LIMIT = 4096;
const MIN_APPROXIMATION_LENGTH = 20;
const MAX_APPROXIMATION_LENGTH = 1000;

let nodeSequence = 0;
let latestDistributionState = null;
let latestTextState = null;

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

    if (value === 0) {
        return "0";
    }

    if (Math.abs(value) >= 1000000 || Math.abs(value) < 0.000001) {
        return value.toExponential(4);
    }

    return Number(value.toFixed(digits)).toString();
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

function displaySymbol(symbol) {
    const replacements = {
        " ": "␠ Space",
        "\n": "↵ New line",
        "\r": "↵ Carriage return",
        "\t": "⇥ Tab"
    };

    return replacements[symbol] || symbol;
}

function displaySymbolShort(symbol) {
    const replacements = {
        " ": "␠",
        "\n": "↵",
        "\r": "↵",
        "\t": "⇥"
    };

    return replacements[symbol] || symbol;
}

function calculateSelfInformation(probability) {
    return -Math.log2(probability);
}

function calculateEntropy(items) {
    return items.reduce((sum, item) => {
        if (item.probability <= 0) {
            return sum;
        }

        return sum + item.probability * calculateSelfInformation(item.probability);
    }, 0);
}

function calculateSelfInformationFromInput() {
    const probability = Number(getElement("self-probability").value);

    if (!Number.isFinite(probability) || probability <= 0 || probability > 1) {
        setResult(
            "self-information-result",
            "Probability must be greater than 0 and no greater than 1.",
            true
        );
        return;
    }

    const information = calculateSelfInformation(probability);

    setResult(
        "self-information-result",
        `
            Probability: <strong>${formatNumber(probability)}</strong><br>
            Information: <strong>${formatNumber(information)} bits</strong><br>
            Formula: <strong>−log₂(${formatNumber(probability)})</strong>
        `
    );
}

function parseProbability(value) {
    const normalized = String(value).trim().replace(",", ".");

    if (normalized.length === 0) {
        return Number.NaN;
    }

    if (normalized.endsWith("%")) {
        return Number(normalized.slice(0, -1).trim()) / 100;
    }

    return Number(normalized);
}

function createProbabilityRow(symbol = "", probability = "") {
    const rows = getElement("probability-rows");

    if (rows.children.length >= MAX_PROBABILITY_ROWS) {
        setResult(
            "distribution-result",
            `The calculator supports up to ${MAX_PROBABILITY_ROWS} outcomes.`,
            true
        );
        return null;
    }

    const template = getElement("probability-row-template");
    const fragment = template.content.cloneNode(true);
    const row = fragment.querySelector(".probability-row");
    const symbolInput = fragment.querySelector(".probability-symbol");
    const probabilityInput = fragment.querySelector(".probability-value");
    const removeButton = fragment.querySelector(".remove-row-button");

    symbolInput.value = symbol;
    probabilityInput.value = probability;

    removeButton.addEventListener("click", () => {
        row.remove();

        if (rows.children.length === 0) {
            createProbabilityRow("A", "1");
        }
    });

    rows.appendChild(fragment);
    return row;
}

function clearProbabilityRows() {
    getElement("probability-rows").innerHTML = "";
}

function loadProbabilityRows(items) {
    clearProbabilityRows();

    for (const item of items) {
        createProbabilityRow(item.symbol, item.probability);
    }
}

function loadUniformExample() {
    loadProbabilityRows([
        { symbol: "A", probability: "0.25" },
        { symbol: "B", probability: "0.25" },
        { symbol: "C", probability: "0.25" },
        { symbol: "D", probability: "0.25" }
    ]);

    calculateDistribution();
}

function loadUnequalExample() {
    loadProbabilityRows([
        { symbol: "A", probability: "0.5" },
        { symbol: "B", probability: "0.25" },
        { symbol: "C", probability: "0.125" },
        { symbol: "D", probability: "0.125" }
    ]);

    calculateDistribution();
}

function readDistributionRows({ requireUnitSum = true } = {}) {
    const rowElements = Array.from(
        getElement("probability-rows").querySelectorAll(".probability-row")
    );

    if (rowElements.length === 0) {
        throw new Error("Add at least one outcome.");
    }

    const symbols = new Set();
    const items = rowElements.map((row, index) => {
        const symbol = row.querySelector(".probability-symbol").value.trim();
        const probability = parseProbability(
            row.querySelector(".probability-value").value
        );

        if (symbol.length === 0) {
            throw new Error(`Outcome ${index + 1} has no symbol.`);
        }

        if (symbols.has(symbol)) {
            throw new Error(`The symbol “${symbol}” is used more than once.`);
        }

        if (!Number.isFinite(probability) || probability <= 0) {
            throw new Error(
                `Probability for “${symbol}” must be a positive number.`
            );
        }

        symbols.add(symbol);

        return {
            symbol,
            probability,
            weight: probability,
            count: null,
            order: index
        };
    });

    const total = items.reduce((sum, item) => sum + item.probability, 0);

    if (requireUnitSum && Math.abs(total - 1) > 0.000001) {
        throw new Error(
            `The probabilities currently total ${formatNumber(total)}. ` +
            "They must total 1. Use Normalize to rescale them automatically."
        );
    }

    return { items, total };
}

function normalizeProbabilityRows() {
    try {
        const { items, total } = readDistributionRows({ requireUnitSum: false });

        if (!Number.isFinite(total) || total <= 0) {
            throw new Error("The probability total must be greater than 0.");
        }

        const rows = Array.from(
            getElement("probability-rows").querySelectorAll(".probability-row")
        );

        rows.forEach((row, index) => {
            row.querySelector(".probability-value").value =
                formatNumber(items[index].probability / total, 10);
        });

        calculateDistribution();
    } catch (error) {
        setResult("distribution-result", escapeHtml(error.message), true);
    }
}

function compareHuffmanNodes(first, second) {
    if (Math.abs(first.weight - second.weight) > Number.EPSILON) {
        return first.weight - second.weight;
    }

    if (first.minimumOrder !== second.minimumOrder) {
        return first.minimumOrder - second.minimumOrder;
    }

    return first.sequence - second.sequence;
}

function buildHuffmanTree(items) {
    nodeSequence = 0;

    const queue = items.map((item, index) => ({
        id: `huffman-node-${nodeSequence}`,
        sequence: nodeSequence++,
        symbol: item.symbol,
        weight: item.weight,
        probability: item.probability,
        count: item.count,
        isLeaf: true,
        left: null,
        right: null,
        minimumOrder: item.order ?? index,
        code: ""
    }));

    if (queue.length === 0) {
        throw new Error("Huffman coding requires at least one outcome.");
    }

    if (queue.length === 1) {
        queue[0].code = "0";

        return {
            root: queue[0],
            codes: new Map([[queue[0].symbol, "0"]])
        };
    }

    while (queue.length > 1) {
        queue.sort(compareHuffmanNodes);

        const left = queue.shift();
        const right = queue.shift();

        const parent = {
            id: `huffman-node-${nodeSequence}`,
            sequence: nodeSequence++,
            symbol: null,
            weight: left.weight + right.weight,
            probability: left.probability + right.probability,
            count:
                Number.isFinite(left.count) && Number.isFinite(right.count)
                    ? left.count + right.count
                    : null,
            isLeaf: false,
            left,
            right,
            minimumOrder: Math.min(left.minimumOrder, right.minimumOrder),
            code: ""
        };

        queue.push(parent);
    }

    const root = queue[0];
    const codes = new Map();

    function assignCodes(node, code) {
        node.code = code;

        if (node.isLeaf) {
            codes.set(node.symbol, code || "0");
            return;
        }

        assignCodes(node.left, `${code}0`);
        assignCodes(node.right, `${code}1`);
    }

    assignCodes(root, "");

    return { root, codes };
}

function countLeaves(node) {
    if (!node) {
        return 0;
    }

    if (node.isLeaf) {
        return 1;
    }

    return countLeaves(node.left) + countLeaves(node.right);
}

function calculateTreeDepth(node) {
    if (!node || node.isLeaf) {
        return 0;
    }

    return 1 + Math.max(
        calculateTreeDepth(node.left),
        calculateTreeDepth(node.right)
    );
}

function layoutHuffmanTree(root) {
    const leafCount = countLeaves(root);
    const maximumDepth = calculateTreeDepth(root);
    const leafGap = leafCount <= 12 ? 112 : leafCount <= 36 ? 96 : 84;
    const levelGap = maximumDepth <= 5 ? 108 : 92;
    const horizontalMargin = 70;
    const verticalMargin = 65;
    let leafIndex = 0;
    const nodes = [];
    const edges = [];

    function placeNode(node, depth, parent = null, branch = null) {
        let x;

        if (node.isLeaf) {
            x = horizontalMargin + leafIndex * leafGap;
            leafIndex += 1;
        } else {
            const leftPosition = placeNode(node.left, depth + 1, node, "0");
            const rightPosition = placeNode(node.right, depth + 1, node, "1");
            x = (leftPosition.x + rightPosition.x) / 2;
        }

        const y = verticalMargin + depth * levelGap;
        const positionedNode = { ...node, x, y, depth };
        nodes.push(positionedNode);

        if (parent) {
            edges.push({
                parent,
                child: positionedNode,
                branch,
                pathCode: node.code
            });
        }

        return positionedNode;
    }

    const rootPosition = placeNode(root, 0);

    // Internal edges are collected before the matching parent position exists.
    // Resolve every parent by node id after all coordinates are known.
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const resolvedEdges = edges.map((edge) => ({
        ...edge,
        parent: nodeById.get(edge.parent.id)
    }));

    const width = Math.max(
        620,
        horizontalMargin * 2 + Math.max(0, leafCount - 1) * leafGap
    );
    const height = Math.max(
        330,
        verticalMargin * 2 + maximumDepth * levelGap + 70
    );

    return {
        root: rootPosition,
        nodes,
        edges: resolvedEdges,
        width,
        height,
        leafCount,
        maximumDepth
    };
}

function createHuffmanNodeMarkup(node) {
    const probabilityText = formatPercent(node.probability, 2);
    const codeAttribute = escapeHtml(node.code);
    const classes = ["huffman-node-group"];

    if (node.isLeaf) {
        classes.push("huffman-leaf-node");
    } else {
        classes.push("huffman-internal-node");
    }

    const symbolMarkup = node.isLeaf
        ? `
            <text class="huffman-node-symbol" x="0" y="-3">
                ${escapeHtml(displaySymbolShort(node.symbol))}
            </text>
            <text class="huffman-node-value" x="0" y="15">
                ${escapeHtml(probabilityText)}
            </text>
        `
        : `
            <text class="huffman-node-symbol" x="0" y="-3">Σ</text>
            <text class="huffman-node-value" x="0" y="15">
                ${escapeHtml(probabilityText)}
            </text>
        `;

    const title = node.isLeaf
        ? `${displaySymbol(node.symbol)}: ${probabilityText}, code ${node.code || "0"}`
        : `Combined probability ${probabilityText}`;

    return `
        <g
            class="${classes.join(" ")}"
            transform="translate(${node.x} ${node.y})"
            data-code="${codeAttribute}"
            ${node.isLeaf ? 'tabindex="0" role="button"' : ""}
        >
            <title>${escapeHtml(title)}</title>
            <circle class="huffman-node-circle" r="29"></circle>
            ${symbolMarkup}
        </g>
    `;
}

function createHuffmanEdgeMarkup(edge) {
    const startX = edge.parent.x;
    const startY = edge.parent.y + 29;
    const endX = edge.child.x;
    const endY = edge.child.y - 29;
    const controlY = (startY + endY) / 2;
    const labelX = (startX + endX) / 2;
    const labelY = (startY + endY) / 2 - 6;

    return `
        <g class="huffman-edge-group" data-code="${escapeHtml(edge.pathCode)}">
            <path
                class="huffman-edge"
                d="M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}"
            ></path>
            <text
                class="huffman-branch-label"
                x="${labelX}"
                y="${labelY}"
            >
                ${edge.branch}
            </text>
        </g>
    `;
}

function setTreeMessage(svgId, message) {
    const svg = getElement(svgId);
    svg.setAttribute("viewBox", "0 0 720 260");
    svg.dataset.baseWidth = "720";
    svg.dataset.baseHeight = "260";
    svg.dataset.zoom = "1";
    svg.style.width = "720px";
    svg.style.height = "260px";
    svg.innerHTML = `
        <text class="huffman-empty-message" x="360" y="130" text-anchor="middle">
            ${escapeHtml(message)}
        </text>
    `;
}

function renderHuffmanTree(svgId, root) {
    const svg = getElement(svgId);
    const leafCount = countLeaves(root);

    if (leafCount > MAX_TREE_LEAVES) {
        setTreeMessage(
            svgId,
            `Tree hidden: ${leafCount} unique symbols exceed the visualization limit of ${MAX_TREE_LEAVES}.`
        );
        return;
    }

    const layout = layoutHuffmanTree(root);
    const edgeMarkup = layout.edges.map(createHuffmanEdgeMarkup).join("");
    const nodeMarkup = layout.nodes.map(createHuffmanNodeMarkup).join("");

    svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    svg.dataset.baseWidth = String(layout.width);
    svg.dataset.baseHeight = String(layout.height);
    svg.dataset.zoom = "1";
    svg.style.width = `${layout.width}px`;
    svg.style.height = `${layout.height}px`;
    svg.innerHTML = `
        <g class="huffman-tree-content">
            ${edgeMarkup}
            ${nodeMarkup}
        </g>
    `;

    const leafGroups = svg.querySelectorAll(".huffman-leaf-node");

    leafGroups.forEach((leaf) => {
        const highlight = () => highlightHuffmanPath(svgId, leaf.dataset.code);
        const clear = () => clearHuffmanPath(svgId);

        leaf.addEventListener("mouseenter", highlight);
        leaf.addEventListener("mouseleave", clear);
        leaf.addEventListener("focus", highlight);
        leaf.addEventListener("blur", clear);
    });
}

function highlightHuffmanPath(svgId, code) {
    const svg = getElement(svgId);
    const elements = svg.querySelectorAll("[data-code]");

    elements.forEach((element) => {
        const elementCode = element.dataset.code || "";
        const onPath = elementCode === "" || code.startsWith(elementCode);
        element.classList.toggle("is-highlighted", onPath);
        element.classList.toggle("is-muted", !onPath);
    });
}

function clearHuffmanPath(svgId) {
    const svg = getElement(svgId);

    svg.querySelectorAll("[data-code]").forEach((element) => {
        element.classList.remove("is-highlighted", "is-muted");
    });
}

function setTreeZoom(
    svgId,
    requestedZoom,
    pointerPosition = null
) {
    const svg = getElement(svgId);

    const scrollContainer =
        svg.closest(".huffman-tree-scroll");

    const baseWidth =
        Number(svg.dataset.baseWidth);

    const baseHeight =
        Number(svg.dataset.baseHeight);

    if (
        !Number.isFinite(baseWidth)
        ||
        !Number.isFinite(baseHeight)
    ) {
        return;
    }

    const currentZoom =
        Number(svg.dataset.zoom) || 1;

    const nextZoom = clamp(
        requestedZoom,
        0.55,
        2.25
    );

    let viewportX = 0;
    let viewportY = 0;
    let treeX = 0;
    let treeY = 0;

    if (scrollContainer) {
        const rectangle =
            scrollContainer.getBoundingClientRect();

        viewportX = pointerPosition
            ? clamp(
                pointerPosition.clientX - rectangle.left,
                0,
                scrollContainer.clientWidth
            )
            : scrollContainer.clientWidth / 2;

        viewportY = pointerPosition
            ? clamp(
                pointerPosition.clientY - rectangle.top,
                0,
                scrollContainer.clientHeight
            )
            : scrollContainer.clientHeight / 2;

        /*
         * Coordinates of the point under the cursor
         * in the unscaled tree.
         */
        treeX =
            (
                scrollContainer.scrollLeft
                +
                viewportX
            )
            /
            currentZoom;

        treeY =
            (
                scrollContainer.scrollTop
                +
                viewportY
            )
            /
            currentZoom;
    }

    svg.dataset.zoom =
        String(nextZoom);

    svg.style.width =
        `${baseWidth * nextZoom}px`;

    svg.style.height =
        `${baseHeight * nextZoom}px`;

    if (scrollContainer) {
        /*
         * Keep the same part of the tree under
         * the cursor after zooming.
         */
        scrollContainer.scrollLeft =
            treeX * nextZoom - viewportX;

        scrollContainer.scrollTop =
            treeY * nextZoom - viewportY;
    }
}

function changeTreeZoom(svgId, action) {
    const svg = getElement(svgId);

    const currentZoom =
        Number(svg.dataset.zoom) || 1;

    let nextZoom = 1;

    if (action === "in") {
        nextZoom =
            currentZoom * 1.15;
    } else if (action === "out") {
        nextZoom =
            currentZoom / 1.15;
    }

    setTreeZoom(
        svgId,
        nextZoom
    );
}

function wireTreeZoomControls() {
    document
        .querySelectorAll(
            "[data-tree][data-zoom]"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    changeTreeZoom(
                        button.dataset.tree,
                        button.dataset.zoom
                    );
                }
            );
        });
}

function wireTreeInteractions() {
    document
        .querySelectorAll(
            ".huffman-tree-scroll"
        )
        .forEach((scrollContainer) => {
            const svg =
                scrollContainer.querySelector(
                    ".huffman-tree-svg"
                );

            if (!svg) {
                return;
            }

            /*
             * Ctrl + wheel:
             * zoom around the cursor position.
             */
            scrollContainer.addEventListener(
                "wheel",
                (event) => {
                    if (!event.ctrlKey) {
                        return;
                    }

                    event.preventDefault();

                    const currentZoom =
                        Number(svg.dataset.zoom) || 1;

                    /*
                     * Normalize wheel values from mice
                     * and touchpads.
                     */
                    const normalizedDelta =
                        event.deltaMode === 1
                            ? event.deltaY * 16
                            : event.deltaY;

                    const zoomMultiplier =
                        Math.exp(
                            -normalizedDelta * 0.0015
                        );

                    setTreeZoom(
                        svg.id,
                        currentZoom
                            *
                            zoomMultiplier,
                        {
                            clientX: event.clientX,
                            clientY: event.clientY
                        }
                    );
                },
                {
                    passive: false
                }
            );

            /*
             * Mouse drag:
             * grab and move the tree viewport.
             */
            let isDragging = false;

            let startPointerX = 0;
            let startPointerY = 0;

            let startScrollLeft = 0;
            let startScrollTop = 0;

            scrollContainer.addEventListener(
                "pointerdown",
                (event) => {
                    /*
                     * Only the main mouse button.
                     * Touch scrolling remains native.
                     */
                    if (
                        event.button !== 0
                        ||
                        event.pointerType !== "mouse"
                        ||
                        event.ctrlKey
                    ) {
                        return;
                    }

                    isDragging = true;

                    startPointerX =
                        event.clientX;

                    startPointerY =
                        event.clientY;

                    startScrollLeft =
                        scrollContainer.scrollLeft;

                    startScrollTop =
                        scrollContainer.scrollTop;

                    scrollContainer.classList.add(
                        "is-dragging"
                    );

                    scrollContainer.setPointerCapture(
                        event.pointerId
                    );

                    event.preventDefault();
                }
            );

            scrollContainer.addEventListener(
                "pointermove",
                (event) => {
                    if (!isDragging) {
                        return;
                    }

                    const movementX =
                        event.clientX
                        -
                        startPointerX;

                    const movementY =
                        event.clientY
                        -
                        startPointerY;

                    scrollContainer.scrollLeft =
                        startScrollLeft
                        -
                        movementX;

                    scrollContainer.scrollTop =
                        startScrollTop
                        -
                        movementY;
                }
            );

            const finishDragging = (event) => {
                if (!isDragging) {
                    return;
                }

                isDragging = false;

                scrollContainer.classList.remove(
                    "is-dragging"
                );

                if (
                    scrollContainer.hasPointerCapture(
                        event.pointerId
                    )
                ) {
                    scrollContainer.releasePointerCapture(
                        event.pointerId
                    );
                }
            };

            scrollContainer.addEventListener(
                "pointerup",
                finishDragging
            );

            scrollContainer.addEventListener(
                "pointercancel",
                finishDragging
            );
        });
}

function wireTableTreeHighlights(tableBodyId, svgId) {
    const body = getElement(tableBodyId);

    body.querySelectorAll("tr[data-huffman-code]").forEach((row) => {
        const highlight = () => highlightHuffmanPath(
            svgId,
            row.dataset.huffmanCode
        );
        const clear = () => clearHuffmanPath(svgId);

        row.addEventListener("mouseenter", highlight);
        row.addEventListener("mouseleave", clear);
        row.addEventListener("focusin", highlight);
        row.addEventListener("focusout", clear);
    });
}

function updateMetricGrid(gridId, values) {
    const cards = getElement(gridId).querySelectorAll(".metric-card");

    cards.forEach((card, index) => {
        const value = values[index];
        const strong = card.querySelector("strong");

        strong.textContent = value ?? "—";
    });
}

function calculateAverageCodeLength(items, codes) {
    return items.reduce((sum, item) => {
        const code = codes.get(item.symbol) || "";
        return sum + item.probability * code.length;
    }, 0);
}

function renderDistributionTable(items, codes) {
    const sortedItems = [...items].sort((first, second) => {
        if (Math.abs(second.probability - first.probability) > Number.EPSILON) {
            return second.probability - first.probability;
        }

        return first.order - second.order;
    });

    getElement("distribution-table-body").innerHTML = sortedItems.map((item) => {
        const information = calculateSelfInformation(item.probability);
        const contribution = item.probability * information;
        const code = codes.get(item.symbol) || "0";

        return `
            <tr data-huffman-code="${escapeHtml(code)}" tabindex="0">
                <td><span class="symbol-token">${escapeHtml(displaySymbol(item.symbol))}</span></td>
                <td>${formatNumber(item.probability)}</td>
                <td>${formatNumber(information)} bits</td>
                <td>${formatNumber(contribution)} bits</td>
                <td><code>${escapeHtml(code)}</code></td>
                <td>${code.length}</td>
            </tr>
        `;
    }).join("");

    wireTableTreeHighlights("distribution-table-body", "distribution-tree");
}

function calculateDistribution() {
    try {
        const { items } = readDistributionRows();
        const huffman = buildHuffmanTree(items);
        const entropy = calculateEntropy(items);
        const maximumEntropy = Math.log2(items.length);
        const averageLength = calculateAverageCodeLength(items, huffman.codes);
        const efficiency = averageLength > 0 ? entropy / averageLength : 1;

        latestDistributionState = {
            items,
            ...huffman,
            entropy,
            maximumEntropy,
            averageLength,
            efficiency
        };

        setResult(
            "distribution-result",
            `
                Outcomes: <strong>${items.length}</strong><br>
                Probability total: <strong>1</strong><br>
                Shannon entropy: <strong>${formatNumber(entropy)} bits</strong><br>
                Average Huffman length: <strong>${formatNumber(averageLength)} bits</strong>
            `
        );

        updateMetricGrid("distribution-metrics", [
            formatNumber(entropy),
            formatNumber(maximumEntropy),
            formatNumber(averageLength),
            formatPercent(efficiency)
        ]);

        renderDistributionTable(items, huffman.codes);
        renderHuffmanTree("distribution-tree", huffman.root);
    } catch (error) {
        setResult("distribution-result", escapeHtml(error.message), true);
    }
}

function updateTextCounter() {
    const input = getElement("text-input");

    if (input.value.length > MAX_TEXT_LENGTH) {
        input.value = input.value.slice(0, MAX_TEXT_LENGTH);
    }

    getElement("text-counter").textContent =
        `${input.value.length.toLocaleString("en-US")} / ` +
        `${MAX_TEXT_LENGTH.toLocaleString("en-US")} characters`;
}

function removeUnicodePunctuation(text) {
    try {
        return text.replace(/\p{P}/gu, "");
    } catch (error) {
        return text.replace(/[.,/#!$%^&*;:{}=\-_`~()"'<>?@[\]\\|]/g, "");
    }
}

function normalizeText(rawText) {
    let text = rawText.slice(0, MAX_TEXT_LENGTH);

    if (getElement("ignore-case").checked) {
        text = text.toLocaleLowerCase();
    }

    if (getElement("ignore-punctuation").checked) {
        text = removeUnicodePunctuation(text);
    }

    if (getElement("ignore-spaces").checked) {
        text = text.replace(/\s/gu, "");
    }

    return text;
}

function countCharacters(text) {
    const frequencies = new Map();

    for (const character of Array.from(text)) {
        frequencies.set(character, (frequencies.get(character) || 0) + 1);
    }

    return frequencies;
}

function createItemsFromFrequencies(frequencies, total) {
    return Array.from(frequencies.entries()).map(([symbol, count], index) => ({
        symbol,
        count,
        probability: count / total,
        weight: count,
        order: index
    }));
}

function getUtf8BitLength(text) {
    if (typeof TextEncoder === "function") {
        return new TextEncoder().encode(text).length * 8;
    }

    return unescape(encodeURIComponent(text)).length * 8;
}

function createEncodedPreview(text, codes) {
    let preview = "";
    let truncated = false;

    for (const character of Array.from(text)) {
        const code = codes.get(character) || "";

        if (preview.length + code.length > ENCODED_PREVIEW_LIMIT) {
            const available = Math.max(0, ENCODED_PREVIEW_LIMIT - preview.length);
            preview += code.slice(0, available);
            truncated = true;
            break;
        }

        preview += code;
    }

    return {
        preview,
        truncated
    };
}

function renderTextTable(items, codes) {
    const sortedItems = [...items].sort((first, second) => {
        if (second.count !== first.count) {
            return second.count - first.count;
        }

        return first.order - second.order;
    });

    getElement("text-table-body").innerHTML = sortedItems.map((item) => {
        const information = calculateSelfInformation(item.probability);
        const contribution = item.probability * information;
        const code = codes.get(item.symbol) || "0";

        return `
            <tr data-huffman-code="${escapeHtml(code)}" tabindex="0">
                <td><span class="symbol-token">${escapeHtml(displaySymbol(item.symbol))}</span></td>
                <td>${item.count.toLocaleString("en-US")}</td>
                <td>${formatNumber(item.probability)}</td>
                <td>${formatNumber(information)} bits</td>
                <td>${formatNumber(contribution)} bits</td>
                <td><code>${escapeHtml(code)}</code></td>
                <td>${code.length}</td>
            </tr>
        `;
    }).join("");

    wireTableTreeHighlights("text-table-body", "text-tree");
}

function analyzeText() {
    try {
        updateTextCounter();

        const rawText = getElement("text-input").value;
        const normalizedText = normalizeText(rawText);
        const characters = Array.from(normalizedText);

        if (characters.length === 0) {
            throw new Error(
                "No characters remain after applying the selected normalization settings."
            );
        }

        const frequencies = countCharacters(normalizedText);
        const items = createItemsFromFrequencies(frequencies, characters.length);
        const huffman = buildHuffmanTree(items);
        const entropy = calculateEntropy(items);
        const maximumEntropy = Math.log2(items.length);
        const huffmanBits = items.reduce((sum, item) => {
            return sum + item.count * (huffman.codes.get(item.symbol) || "0").length;
        }, 0);
        const averageLength = huffmanBits / characters.length;
        const utf8Bits = getUtf8BitLength(normalizedText);
        const utf8Ratio = utf8Bits > 0 ? huffmanBits / utf8Bits : 0;
        const encodedPreview = createEncodedPreview(normalizedText, huffman.codes);

        latestTextState = {
            rawText,
            normalizedText,
            characters,
            frequencies,
            items,
            ...huffman,
            entropy,
            maximumEntropy,
            huffmanBits,
            averageLength,
            utf8Bits,
            utf8Ratio
        };

        setResult(
            "text-analysis-result",
            `
                Characters analyzed: <strong>${characters.length.toLocaleString("en-US")}</strong><br>
                Unique symbols: <strong>${items.length.toLocaleString("en-US")}</strong><br>
                Shannon entropy: <strong>${formatNumber(entropy)} bits per character</strong><br>
                Huffman encoded size: <strong>${huffmanBits.toLocaleString("en-US")} bits</strong>
            `
        );

        updateMetricGrid("text-metrics", [
            characters.length.toLocaleString("en-US"),
            items.length.toLocaleString("en-US"),
            formatNumber(entropy),
            formatNumber(averageLength),
            huffmanBits.toLocaleString("en-US"),
            formatPercent(utf8Ratio)
        ]);

        renderTextTable(items, huffman.codes);
        renderHuffmanTree("text-tree", huffman.root);

        getElement("encoded-text-preview").textContent =
            encodedPreview.preview +
            (encodedPreview.truncated
                ? `\n\nPreview limited to ${ENCODED_PREVIEW_LIMIT.toLocaleString("en-US")} bits.`
                : "");

        generateApproximations();
    } catch (error) {
        setResult("text-analysis-result", escapeHtml(error.message), true);
    }
}

function chooseWeighted(entries) {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);

    if (total <= 0) {
        return entries[0]?.value ?? "";
    }

    let target = Math.random() * total;

    for (const entry of entries) {
        target -= entry.weight;

        if (target <= 0) {
            return entry.value;
        }
    }

    return entries.at(-1)?.value ?? "";
}

function createGlobalWeightedCharacters(frequencies) {
    return Array.from(frequencies.entries()).map(([value, weight]) => ({
        value,
        weight
    }));
}

function generateFirstOrderText(frequencies, length) {
    const weightedCharacters = createGlobalWeightedCharacters(frequencies);
    let result = "";

    for (let index = 0; index < length; index += 1) {
        result += chooseWeighted(weightedCharacters);
    }

    return result;
}

function buildTransitionMap(text) {
    const characters = Array.from(text);
    const transitions = new Map();

    for (let index = 0; index < characters.length - 1; index += 1) {
        const current = characters[index];
        const next = characters[index + 1];

        if (!transitions.has(current)) {
            transitions.set(current, new Map());
        }

        const nextCounts = transitions.get(current);
        nextCounts.set(next, (nextCounts.get(next) || 0) + 1);
    }

    return transitions;
}

function generateSecondOrderText(text, frequencies, length) {
    const globalCharacters = createGlobalWeightedCharacters(frequencies);
    const transitions = buildTransitionMap(text);
    let current = chooseWeighted(globalCharacters);
    let result = current;

    while (Array.from(result).length < length) {
        const nextCounts = transitions.get(current);
        let next;

        if (nextCounts && nextCounts.size > 0) {
            const weightedNext = Array.from(nextCounts.entries()).map(
                ([value, weight]) => ({ value, weight })
            );
            next = chooseWeighted(weightedNext);
        } else {
            next = chooseWeighted(globalCharacters);
        }

        result += next;
        current = next;
    }

    return Array.from(result).slice(0, length).join("");
}

function generateApproximations() {
    if (!latestTextState) {
        analyzeText();
        return;
    }

    const lengthInput = getElement("approximation-length");
    const requestedLength = Number.parseInt(lengthInput.value, 10);
    const length = clamp(
        Number.isFinite(requestedLength) ? requestedLength : 180,
        MIN_APPROXIMATION_LENGTH,
        MAX_APPROXIMATION_LENGTH
    );
    lengthInput.value = String(length);

    const source = latestTextState.normalizedText;
    const originalSample = Array.from(source).slice(0, length).join("");
    const firstOrder = generateFirstOrderText(
        latestTextState.frequencies,
        length
    );
    const secondOrder = generateSecondOrderText(
        source,
        latestTextState.frequencies,
        length
    );

    getElement("original-text-output").textContent = originalSample;
    getElement("first-order-output").textContent = firstOrder;
    getElement("second-order-output").textContent = secondOrder;
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
    getElement("self-information-button").addEventListener(
        "click",
        calculateSelfInformationFromInput
    );

    getElement("self-probability").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            calculateSelfInformationFromInput();
        }
    });

    getElement("add-probability-row").addEventListener("click", () => {
        const rows = getElement("probability-rows");
        createProbabilityRow(
            `S${rows.children.length + 1}`,
            "0.1"
        );
    });

    getElement("normalize-probabilities").addEventListener(
        "click",
        normalizeProbabilityRows
    );
    getElement("calculate-distribution").addEventListener(
        "click",
        calculateDistribution
    );
    getElement("load-uniform-example").addEventListener(
        "click",
        loadUniformExample
    );
    getElement("load-unequal-example").addEventListener(
        "click",
        loadUnequalExample
    );

    getElement("text-input").addEventListener("input", updateTextCounter);
    getElement("analyze-text-button").addEventListener("click", analyzeText);
    getElement("generate-approximations-button").addEventListener(
        "click",
        generateApproximations
    );

    wireTreeZoomControls();
    wireTreeInteractions();
}

function initializePage() {
    enableNavigationWheelScroll();
    attachEvents();
    loadUnequalExample();
    updateTextCounter();
    calculateSelfInformationFromInput();
    analyzeText();
}

document.addEventListener("DOMContentLoaded", initializePage);
