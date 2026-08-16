"use strict";

const MIN_STRATEGIES = 2;
const MAX_STRATEGIES = 10;

const gameState = {
    rows: 2,
    columns: 2,
    rowNames: [],
    columnNames: [],
    payoffs: [],
    analysis: null,
    selectedCell: null
};

const PRESETS = {
    prisoners: {
        rowNames: ["Confess", "Silent"],
        columnNames: ["Confess", "Silent"],
        payoffs: [
            [
                { p1: -8, p2: -8 },
                { p1: 0, p2: -10 }
            ],
            [
                { p1: -10, p2: 0 },
                { p1: -1, p2: -1 }
            ]
        ]
    },

    coordination: {
        rowNames: ["Left", "Right"],
        columnNames: ["Left", "Right"],
        payoffs: [
            [
                { p1: 2, p2: 2 },
                { p1: 0, p2: 0 }
            ],
            [
                { p1: 0, p2: 0 },
                { p1: 1, p2: 1 }
            ]
        ]
    },

    rps: {
        rowNames: ["Rock", "Paper", "Scissors"],
        columnNames: ["Rock", "Paper", "Scissors"],
        payoffs: [
            [
                { p1: 0, p2: 0 },
                { p1: -1, p2: 1 },
                { p1: 1, p2: -1 }
            ],
            [
                { p1: 1, p2: -1 },
                { p1: 0, p2: 0 },
                { p1: -1, p2: 1 }
            ],
            [
                { p1: -1, p2: 1 },
                { p1: 1, p2: -1 },
                { p1: 0, p2: 0 }
            ]
        ]
    }
};

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

function createDefaultGame(rows, columns) {
    return {
        rows,
        columns,
        rowNames: Array.from(
            { length: rows },
            (_, index) => `A${index + 1}`
        ),
        columnNames: Array.from(
            { length: columns },
            (_, index) => `B${index + 1}`
        ),
        payoffs: Array.from(
            { length: rows },
            () => Array.from(
                { length: columns },
                () => ({ p1: 0, p2: 0 })
            )
        )
    };
}

function clonePayoffMatrix(payoffs) {
    return payoffs.map((row) =>
        row.map((cell) => ({ p1: cell.p1, p2: cell.p2 }))
    );
}

function loadGame(game) {
    gameState.rows = game.rowNames.length;
    gameState.columns = game.columnNames.length;
    gameState.rowNames = [...game.rowNames];
    gameState.columnNames = [...game.columnNames];
    gameState.payoffs = clonePayoffMatrix(game.payoffs);
    gameState.analysis = null;
    gameState.selectedCell = null;

    renderGameMatrix();
    resetAnalysisDisplay();
    renderOutcomePlaceholder();
}

function loadPreset(name) {
    const preset = PRESETS[name];

    if (!preset) {
        return;
    }

    loadGame(preset);
}

function clearCustomGame() {
    const game = createDefaultGame(gameState.rows, gameState.columns);
    loadGame(game);
}

function updateDimensionControls() {
    getElement("row-count").textContent = gameState.rows;
    getElement("column-count").textContent = gameState.columns;

    getElement("rows-minus").disabled = gameState.rows <= MIN_STRATEGIES;
    getElement("rows-plus").disabled = gameState.rows >= MAX_STRATEGIES;
    getElement("cols-minus").disabled = gameState.columns <= MIN_STRATEGIES;
    getElement("cols-plus").disabled = gameState.columns >= MAX_STRATEGIES;
}

function readGameFromMatrix() {
    const matrix = getElement("payoff-matrix");

    if (!matrix) {
        return;
    }

    matrix.querySelectorAll(".row-strategy-input").forEach((input) => {
        const row = Number(input.dataset.row);
        gameState.rowNames[row] = input.value.trim() || `A${row + 1}`;
    });

    matrix.querySelectorAll(".column-strategy-input").forEach((input) => {
        const column = Number(input.dataset.column);
        gameState.columnNames[column] = input.value.trim() || `B${column + 1}`;
    });

    matrix.querySelectorAll(".payoff-input").forEach((input) => {
        const row = Number(input.dataset.row);
        const column = Number(input.dataset.column);
        const player = input.dataset.player;
        const value = Number(input.value);

        gameState.payoffs[row][column][player] = Number.isFinite(value)
            ? value
            : 0;
    });
}

function resizeGame(nextRows, nextColumns) {
    readGameFromMatrix();

    const rows = clamp(nextRows, MIN_STRATEGIES, MAX_STRATEGIES);
    const columns = clamp(nextColumns, MIN_STRATEGIES, MAX_STRATEGIES);

    const previousRows = gameState.rows;
    const previousColumns = gameState.columns;
    const previousRowNames = [...gameState.rowNames];
    const previousColumnNames = [...gameState.columnNames];
    const previousPayoffs = clonePayoffMatrix(gameState.payoffs);

    const resized = createDefaultGame(rows, columns);

    for (let row = 0; row < Math.min(rows, previousRows); row += 1) {
        resized.rowNames[row] = previousRowNames[row];
    }

    for (
        let column = 0;
        column < Math.min(columns, previousColumns);
        column += 1
    ) {
        resized.columnNames[column] = previousColumnNames[column];
    }

    for (let row = 0; row < Math.min(rows, previousRows); row += 1) {
        for (
            let column = 0;
            column < Math.min(columns, previousColumns);
            column += 1
        ) {
            resized.payoffs[row][column] = {
                ...previousPayoffs[row][column]
            };
        }
    }

    loadGame(resized);
}

function cellKey(row, column) {
    return `${row}:${column}`;
}

function createBadge(text, className) {
    const badge = document.createElement("span");
    badge.className = `analysis-badge ${className}`;
    badge.textContent = text;
    return badge;
}

function renderGameMatrix() {
    const matrix = getElement("payoff-matrix");
    matrix.replaceChildren();

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const corner = document.createElement("th");
    corner.className = "matrix-axis-corner";
    corner.innerHTML = "<span>Player 1 ↓</span><span>Player 2 →</span>";
    headerRow.appendChild(corner);

    for (let column = 0; column < gameState.columns; column += 1) {
        const th = document.createElement("th");
        th.className = "column-strategy-header";

        const input = document.createElement("input");
        input.type = "text";
        input.className = "matrix-strategy-input column-strategy-input";
        input.value = gameState.columnNames[column];
        input.dataset.column = String(column);
        input.maxLength = 32;
        input.setAttribute(
            "aria-label",
            `Player 2 strategy ${column + 1} name`
        );

        th.appendChild(input);
        headerRow.appendChild(th);
    }

    thead.appendChild(headerRow);
    matrix.appendChild(thead);

    const tbody = document.createElement("tbody");

    for (let row = 0; row < gameState.rows; row += 1) {
        const tr = document.createElement("tr");

        const rowHeader = document.createElement("th");
        rowHeader.className = "row-strategy-header";

        const rowInput = document.createElement("input");
        rowInput.type = "text";
        rowInput.className = "matrix-strategy-input row-strategy-input";
        rowInput.value = gameState.rowNames[row];
        rowInput.dataset.row = String(row);
        rowInput.maxLength = 32;
        rowInput.setAttribute(
            "aria-label",
            `Player 1 strategy ${row + 1} name`
        );

        rowHeader.appendChild(rowInput);
        tr.appendChild(rowHeader);

        for (let column = 0; column < gameState.columns; column += 1) {
            const td = document.createElement("td");
            const key = cellKey(row, column);

            td.className = "payoff-cell";
            td.dataset.row = String(row);
            td.dataset.column = String(column);
            td.tabIndex = 0;

            if (gameState.analysis) {
                const analysis = gameState.analysis;

                if (analysis.bestP1.has(key)) {
                    td.classList.add("is-best-p1");
                }

                if (analysis.bestP2.has(key)) {
                    td.classList.add("is-best-p2");
                }

                if (analysis.nash.has(key)) {
                    td.classList.add("is-nash");
                }

                if (analysis.pareto.has(key)) {
                    td.classList.add("is-pareto");
                }
            }

            if (
                gameState.selectedCell
                && gameState.selectedCell.row === row
                && gameState.selectedCell.column === column
            ) {
                td.classList.add("is-selected");
            }

            const pair = document.createElement("div");
            pair.className = "payoff-pair";

            const p1Input = document.createElement("input");
            p1Input.type = "number";
            p1Input.step = "any";
            p1Input.className = "payoff-input player-one-payoff";
            p1Input.value = gameState.payoffs[row][column].p1;
            p1Input.dataset.row = String(row);
            p1Input.dataset.column = String(column);
            p1Input.dataset.player = "p1";
            p1Input.setAttribute(
                "aria-label",
                `Player 1 payoff at row ${row + 1}, column ${column + 1}`
            );

            const separator = document.createElement("span");
            separator.className = "payoff-separator";
            separator.textContent = ",";

            const p2Input = document.createElement("input");
            p2Input.type = "number";
            p2Input.step = "any";
            p2Input.className = "payoff-input player-two-payoff";
            p2Input.value = gameState.payoffs[row][column].p2;
            p2Input.dataset.row = String(row);
            p2Input.dataset.column = String(column);
            p2Input.dataset.player = "p2";
            p2Input.setAttribute(
                "aria-label",
                `Player 2 payoff at row ${row + 1}, column ${column + 1}`
            );

            pair.append("(", p1Input, separator, p2Input, ")");
            td.appendChild(pair);

            const badges = document.createElement("div");
            badges.className = "analysis-badges";

            if (gameState.analysis) {
                const analysis = gameState.analysis;

                if (analysis.bestP1.has(key)) {
                    badges.appendChild(
                        createBadge("P1 best", "best-p1-badge")
                    );
                }

                if (analysis.bestP2.has(key)) {
                    badges.appendChild(
                        createBadge("P2 best", "best-p2-badge")
                    );
                }

                if (analysis.nash.has(key)) {
                    badges.appendChild(
                        createBadge("Nash", "nash-badge")
                    );
                }

                if (analysis.pareto.has(key)) {
                    badges.appendChild(
                        createBadge("Pareto", "pareto-badge")
                    );
                }
            }

            td.appendChild(badges);
            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    }

    matrix.appendChild(tbody);

    updateDimensionControls();
    wireMatrixEvents();
}

function markAnalysisStale() {
    if (!gameState.analysis) {
        return;
    }

    readGameFromMatrix();
    gameState.analysis = null;

    getElement("metric-nash").textContent = "—";
    getElement("metric-pareto").textContent = "—";
    getElement("metric-dominant-p1").textContent = "—";
    getElement("metric-dominant-p2").textContent = "—";

    getElement("game-analysis-result").innerHTML = `
        <strong>Matrix changed.</strong><br>
        Press “Analyze game” again to refresh best responses,
        equilibria and Pareto labels.
    `;

    document.querySelectorAll(".payoff-cell").forEach((cell) => {
        cell.classList.remove(
            "is-best-p1",
            "is-best-p2",
            "is-nash",
            "is-pareto"
        );

        const badges = cell.querySelector(".analysis-badges");

        if (badges) {
            badges.replaceChildren();
        }
    });
}

function wireMatrixEvents() {
    const matrix = getElement("payoff-matrix");

    matrix.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", () => {
            markAnalysisStale();
        });
    });

    matrix.querySelectorAll(".payoff-cell").forEach((cell) => {
        const selectCell = () => {
            readGameFromMatrix();

            gameState.selectedCell = {
                row: Number(cell.dataset.row),
                column: Number(cell.dataset.column)
            };

            document.querySelectorAll(".payoff-cell").forEach((item) => {
                item.classList.remove("is-selected");
            });

            cell.classList.add("is-selected");
            renderSelectedOutcome();
        };

        cell.addEventListener("click", (event) => {
            if (event.target.matches("input")) {
                return;
            }

            selectCell();
        });

        cell.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectCell();
            }
        });
    });
}

function validateGame() {
    readGameFromMatrix();

    for (let row = 0; row < gameState.rows; row += 1) {
        for (let column = 0; column < gameState.columns; column += 1) {
            const cell = gameState.payoffs[row][column];

            if (!Number.isFinite(cell.p1) || !Number.isFinite(cell.p2)) {
                throw new Error(
                    `Invalid payoff at row ${row + 1}, column ${column + 1}.`
                );
            }
        }
    }
}

function findBestResponses() {
    const bestP1 = new Set();
    const bestP2 = new Set();

    for (let column = 0; column < gameState.columns; column += 1) {
        let maximum = -Infinity;

        for (let row = 0; row < gameState.rows; row += 1) {
            maximum = Math.max(maximum, gameState.payoffs[row][column].p1);
        }

        for (let row = 0; row < gameState.rows; row += 1) {
            if (gameState.payoffs[row][column].p1 === maximum) {
                bestP1.add(cellKey(row, column));
            }
        }
    }

    for (let row = 0; row < gameState.rows; row += 1) {
        let maximum = -Infinity;

        for (let column = 0; column < gameState.columns; column += 1) {
            maximum = Math.max(maximum, gameState.payoffs[row][column].p2);
        }

        for (let column = 0; column < gameState.columns; column += 1) {
            if (gameState.payoffs[row][column].p2 === maximum) {
                bestP2.add(cellKey(row, column));
            }
        }
    }

    return { bestP1, bestP2 };
}

function findNashEquilibria(bestP1, bestP2) {
    const nash = new Set();

    for (const key of bestP1) {
        if (bestP2.has(key)) {
            nash.add(key);
        }
    }

    return nash;
}

function paretoDominates(first, second) {
    return (
        first.p1 >= second.p1
        && first.p2 >= second.p2
        && (first.p1 > second.p1 || first.p2 > second.p2)
    );
}

function findParetoOptimalOutcomes() {
    const pareto = new Set();

    for (let row = 0; row < gameState.rows; row += 1) {
        for (let column = 0; column < gameState.columns; column += 1) {
            const current = gameState.payoffs[row][column];
            let dominated = false;

            outer:
            for (let otherRow = 0; otherRow < gameState.rows; otherRow += 1) {
                for (
                    let otherColumn = 0;
                    otherColumn < gameState.columns;
                    otherColumn += 1
                ) {
                    if (otherRow === row && otherColumn === column) {
                        continue;
                    }

                    if (
                        paretoDominates(
                            gameState.payoffs[otherRow][otherColumn],
                            current
                        )
                    ) {
                        dominated = true;
                        break outer;
                    }
                }
            }

            if (!dominated) {
                pareto.add(cellKey(row, column));
            }
        }
    }

    return pareto;
}

function rowDominates(firstRow, secondRow, strictOnly) {
    let strictlyBetterSomewhere = false;

    for (let column = 0; column < gameState.columns; column += 1) {
        const first = gameState.payoffs[firstRow][column].p1;
        const second = gameState.payoffs[secondRow][column].p1;

        if (strictOnly) {
            if (!(first > second)) {
                return false;
            }
        } else {
            if (first < second) {
                return false;
            }

            if (first > second) {
                strictlyBetterSomewhere = true;
            }
        }
    }

    return strictOnly ? true : strictlyBetterSomewhere;
}

function columnDominates(firstColumn, secondColumn, strictOnly) {
    let strictlyBetterSomewhere = false;

    for (let row = 0; row < gameState.rows; row += 1) {
        const first = gameState.payoffs[row][firstColumn].p2;
        const second = gameState.payoffs[row][secondColumn].p2;

        if (strictOnly) {
            if (!(first > second)) {
                return false;
            }
        } else {
            if (first < second) {
                return false;
            }

            if (first > second) {
                strictlyBetterSomewhere = true;
            }
        }
    }

    return strictOnly ? true : strictlyBetterSomewhere;
}

function findDominantStrategy(player) {
    const strategyCount = player === "p1"
        ? gameState.rows
        : gameState.columns;

    const names = player === "p1"
        ? gameState.rowNames
        : gameState.columnNames;

    const dominates = player === "p1"
        ? rowDominates
        : columnDominates;

    for (let strategy = 0; strategy < strategyCount; strategy += 1) {
        let dominatesEveryOther = true;

        for (let other = 0; other < strategyCount; other += 1) {
            if (strategy === other) {
                continue;
            }

            if (!dominates(strategy, other, true)) {
                dominatesEveryOther = false;
                break;
            }
        }

        if (dominatesEveryOther) {
            return {
                index: strategy,
                name: names[strategy],
                type: "strict"
            };
        }
    }

    for (let strategy = 0; strategy < strategyCount; strategy += 1) {
        let dominatesEveryOther = true;

        for (let other = 0; other < strategyCount; other += 1) {
            if (strategy === other) {
                continue;
            }

            if (!dominates(strategy, other, false)) {
                dominatesEveryOther = false;
                break;
            }
        }

        if (dominatesEveryOther) {
            return {
                index: strategy,
                name: names[strategy],
                type: "weak"
            };
        }
    }

    return null;
}

function calculateGameAnalysis() {
    const { bestP1, bestP2 } = findBestResponses();
    const nash = findNashEquilibria(bestP1, bestP2);
    const pareto = findParetoOptimalOutcomes();
    const dominantP1 = findDominantStrategy("p1");
    const dominantP2 = findDominantStrategy("p2");

    return {
        bestP1,
        bestP2,
        nash,
        pareto,
        dominantP1,
        dominantP2
    };
}

function parseCellKey(key) {
    const [row, column] = key.split(":").map(Number);
    return { row, column };
}

function formatOutcome(row, column) {
    const payoff = gameState.payoffs[row][column];

    return `${gameState.rowNames[row]} / ${gameState.columnNames[column]} `
        + `(${payoff.p1}, ${payoff.p2})`;
}

function renderDominanceMetric(elementId, dominant) {
    const element = getElement(elementId);

    if (!dominant) {
        element.textContent = "None";
        return;
    }

    element.textContent = `${dominant.name} (${dominant.type})`;
}

function renderAnalysisSummary() {
    const analysis = gameState.analysis;
    const result = getElement("game-analysis-result");

    const nashOutcomes = [...analysis.nash].map((key) => {
        const { row, column } = parseCellKey(key);
        return formatOutcome(row, column);
    });

    const paretoOutcomes = [...analysis.pareto].map((key) => {
        const { row, column } = parseCellKey(key);
        return formatOutcome(row, column);
    });

    const nashText = nashOutcomes.length > 0
        ? nashOutcomes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
        : `<li>No pure-strategy Nash equilibrium was found.</li>`;

    const paretoPreview = paretoOutcomes.length <= 12
        ? paretoOutcomes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
        : paretoOutcomes
            .slice(0, 12)
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")
            + `<li>…and ${paretoOutcomes.length - 12} more.</li>`;

    const dominantP1Text = analysis.dominantP1
        ? `${escapeHtml(analysis.dominantP1.name)} (${analysis.dominantP1.type} dominance)`
        : "No dominant strategy";

    const dominantP2Text = analysis.dominantP2
        ? `${escapeHtml(analysis.dominantP2.name)} (${analysis.dominantP2.type} dominance)`
        : "No dominant strategy";

    result.innerHTML = `
        <div class="analysis-summary-grid">
            <div>
                <strong>Pure Nash equilibria</strong>
                <ul>${nashText}</ul>
            </div>

            <div>
                <strong>Pareto-optimal outcomes</strong>
                <ul>${paretoPreview}</ul>
            </div>
        </div>

        <div class="analysis-dominance-summary">
            <span><strong>Player 1:</strong> ${dominantP1Text}</span>
            <span><strong>Player 2:</strong> ${dominantP2Text}</span>
        </div>

        ${analysis.nash.size === 0 ? `
            <p class="muted">
                The absence of a pure equilibrium does not mean that the game has
                no Nash equilibrium at all; a mixed-strategy equilibrium may exist.
            </p>
        ` : ""}
    `;
}

function analyzeGame() {
    try {
        validateGame();
        gameState.analysis = calculateGameAnalysis();

        getElement("metric-nash").textContent = gameState.analysis.nash.size;
        getElement("metric-pareto").textContent = gameState.analysis.pareto.size;

        renderDominanceMetric(
            "metric-dominant-p1",
            gameState.analysis.dominantP1
        );

        renderDominanceMetric(
            "metric-dominant-p2",
            gameState.analysis.dominantP2
        );

        renderGameMatrix();
        getElement("game-analysis-result").classList.remove("error");
        renderAnalysisSummary();

        if (gameState.analysis.nash.size > 0) {
            const firstNash = parseCellKey([...gameState.analysis.nash][0]);
            gameState.selectedCell = firstNash;
        } else if (!gameState.selectedCell) {
            gameState.selectedCell = { row: 0, column: 0 };
        }

        renderGameMatrix();
        renderSelectedOutcome();
    } catch (error) {
        const result = getElement("game-analysis-result");
        result.classList.add("error");
        result.textContent = error.message;
    }
}

function resetAnalysisDisplay() {
    getElement("metric-nash").textContent = "—";
    getElement("metric-pareto").textContent = "—";
    getElement("metric-dominant-p1").textContent = "—";
    getElement("metric-dominant-p2").textContent = "—";

    const result = getElement("game-analysis-result");
    result.classList.remove("error");
    result.textContent = "Press “Analyze game” to evaluate the matrix.";
}

function renderOutcomePlaceholder() {
    getElement("outcome-detail").textContent =
        "Select a cell in the payoff matrix.";
}

function getBetterPlayerOneDeviations(row, column) {
    const current = gameState.payoffs[row][column].p1;
    const deviations = [];

    for (let otherRow = 0; otherRow < gameState.rows; otherRow += 1) {
        if (otherRow === row) {
            continue;
        }

        const payoff = gameState.payoffs[otherRow][column].p1;

        if (payoff > current) {
            deviations.push({
                name: gameState.rowNames[otherRow],
                payoff
            });
        }
    }

    return deviations.sort((a, b) => b.payoff - a.payoff);
}

function getBetterPlayerTwoDeviations(row, column) {
    const current = gameState.payoffs[row][column].p2;
    const deviations = [];

    for (
        let otherColumn = 0;
        otherColumn < gameState.columns;
        otherColumn += 1
    ) {
        if (otherColumn === column) {
            continue;
        }

        const payoff = gameState.payoffs[row][otherColumn].p2;

        if (payoff > current) {
            deviations.push({
                name: gameState.columnNames[otherColumn],
                payoff
            });
        }
    }

    return deviations.sort((a, b) => b.payoff - a.payoff);
}

function renderDeviationList(deviations, currentPayoff) {
    if (deviations.length === 0) {
        return `
            <p class="deviation-success">
                No unilateral deviation gives a higher payoff.
            </p>
        `;
    }

    return `
        <ul class="deviation-list">
            ${deviations.map((item) => `
                <li>
                    ${escapeHtml(item.name)}: ${currentPayoff} → <strong>${item.payoff}</strong>
                </li>
            `).join("")}
        </ul>
    `;
}

function renderSelectedOutcome() {
    if (!gameState.selectedCell) {
        renderOutcomePlaceholder();
        return;
    }

    readGameFromMatrix();

    const { row, column } = gameState.selectedCell;
    const payoff = gameState.payoffs[row][column];
    const betterP1 = getBetterPlayerOneDeviations(row, column);
    const betterP2 = getBetterPlayerTwoDeviations(row, column);

    const currentAnalysis = calculateGameAnalysis();
    const key = cellKey(row, column);

    const statusTags = [];

    if (currentAnalysis.nash.has(key)) {
        statusTags.push("Nash equilibrium");
    }

    if (currentAnalysis.pareto.has(key)) {
        statusTags.push("Pareto-optimal");
    }

    if (statusTags.length === 0) {
        statusTags.push("Neither Nash nor Pareto-optimal");
    }

    getElement("outcome-detail").innerHTML = `
        <div class="outcome-detail-heading">
            <div>
                <span class="outcome-label">Selected strategy profile</span>
                <h4>
                    ${escapeHtml(gameState.rowNames[row])} / ${escapeHtml(gameState.columnNames[column])}
                </h4>
            </div>

            <strong class="outcome-payoff">(${payoff.p1}, ${payoff.p2})</strong>
        </div>

        <div class="outcome-status-row">
            ${statusTags.map((tag) => `<span>${tag}</span>`).join("")}
        </div>

        <div class="outcome-detail-grid">
            <article class="deviation-card">
                <h4>Player 1 unilateral deviations</h4>
                <p>
                    Player 2 keeps <strong>${escapeHtml(gameState.columnNames[column])}</strong>.
                </p>
                ${renderDeviationList(betterP1, payoff.p1)}
            </article>

            <article class="deviation-card">
                <h4>Player 2 unilateral deviations</h4>
                <p>
                    Player 1 keeps <strong>${escapeHtml(gameState.rowNames[row])}</strong>.
                </p>
                ${renderDeviationList(betterP2, payoff.p2)}
            </article>
        </div>
    `;
}

function sanitizePercentage(value) {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
        return 0;
    }

    return clamp(numeric, 0, 100);
}

function wireProbabilityPair(numberId, rangeId) {
    const numberInput = getElement(numberId);
    const rangeInput = getElement(rangeId);

    const syncFromNumber = () => {
        const value = sanitizePercentage(numberInput.value);
        numberInput.value = String(value);
        rangeInput.value = String(value);
    };

    const syncFromRange = () => {
        numberInput.value = rangeInput.value;
    };

    numberInput.addEventListener("input", syncFromNumber);
    rangeInput.addEventListener("input", syncFromRange);
}

function simulateBernoulli(probability, trials) {
    let successes = 0;

    for (let index = 0; index < trials; index += 1) {
        if (Math.random() < probability) {
            successes += 1;
        }
    }

    return successes;
}

function runSimulation() {
    const regularPercent = sanitizePercentage(
        getElement("regular-probability").value
    );

    const crimePercent = sanitizePercentage(
        getElement("crime-probability").value
    );

    const requestedTrials = Number(getElement("simulation-trials").value);
    const trials = clamp(
        Number.isFinite(requestedTrials) ? Math.round(requestedTrials) : 1000,
        100,
        100000
    );

    getElement("regular-probability").value = String(regularPercent);
    getElement("regular-probability-range").value = String(regularPercent);
    getElement("crime-probability").value = String(crimePercent);
    getElement("crime-probability-range").value = String(crimePercent);
    getElement("simulation-trials").value = String(trials);

    const regularCount = simulateBernoulli(regularPercent / 100, trials);
    const crimeCount = simulateBernoulli(crimePercent / 100, trials);

    const regularObserved = regularCount / trials * 100;
    const crimeObserved = crimeCount / trials * 100;

    getElement("simulation-bars").hidden = false;

    getElement("regular-observed").textContent =
        `${regularObserved.toFixed(1)}%`;

    getElement("crime-observed").textContent =
        `${crimeObserved.toFixed(1)}%`;

    getElement("regular-count").textContent =
        `${regularCount.toLocaleString("en-US")} of ${trials.toLocaleString("en-US")} trials`;

    getElement("crime-count").textContent =
        `${crimeCount.toLocaleString("en-US")} of ${trials.toLocaleString("en-US")} trials`;

    getElement("regular-bar-fill").style.width = `${regularObserved}%`;
    getElement("crime-bar-fill").style.width = `${crimeObserved}%`;

    getElement("simulation-result").innerHTML = `
        <strong>${trials.toLocaleString("en-US")} trials completed.</strong><br>
        Regular-person target: <strong>${regularPercent}%</strong>, observed:
        <strong>${regularObserved.toFixed(1)}%</strong>.<br>
        Crime-ring target: <strong>${crimePercent}%</strong>, observed:
        <strong>${crimeObserved.toFixed(1)}%</strong>.
    `;
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

            const amount = Math.abs(event.deltaX) > Math.abs(event.deltaY)
                ? event.deltaX
                : event.deltaY;

            navigation.scrollLeft += amount;
        },
        { passive: false }
    );
}

function attachEvents() {
    getElement("rows-minus").addEventListener("click", () => {
        resizeGame(gameState.rows - 1, gameState.columns);
    });

    getElement("rows-plus").addEventListener("click", () => {
        resizeGame(gameState.rows + 1, gameState.columns);
    });

    getElement("cols-minus").addEventListener("click", () => {
        resizeGame(gameState.rows, gameState.columns - 1);
    });

    getElement("cols-plus").addEventListener("click", () => {
        resizeGame(gameState.rows, gameState.columns + 1);
    });

    getElement("preset-prisoners").addEventListener("click", () => {
        loadPreset("prisoners");
    });

    getElement("preset-coordination").addEventListener("click", () => {
        loadPreset("coordination");
    });

    getElement("preset-rps").addEventListener("click", () => {
        loadPreset("rps");
    });

    getElement("preset-custom").addEventListener("click", clearCustomGame);
    getElement("analyze-game-button").addEventListener("click", analyzeGame);
    getElement("run-simulation-button").addEventListener("click", runSimulation);

    wireProbabilityPair(
        "regular-probability",
        "regular-probability-range"
    );

    wireProbabilityPair(
        "crime-probability",
        "crime-probability-range"
    );
}

function initializePage() {
    enableNavigationWheelScroll();
    attachEvents();
    loadPreset("prisoners");
    analyzeGame();
    runSimulation();
}

document.addEventListener("DOMContentLoaded", initializePage);
