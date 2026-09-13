document.addEventListener("DOMContentLoaded", () => {
    const queryForm = document.getElementById("query-form");
    const queryInput = document.getElementById("query-input");
    const submitBtn = document.getElementById("submit-btn");
    const modeBtns = document.querySelectorAll(".mode-btn");
    const sampleQueriesList = document.getElementById("sample-queries-list");

    const loadingState = document.getElementById("loading-state");
    const resultsContainer = document.getElementById("results-container");

    const baselinePanel = document.getElementById("baseline-panel");
    const reactPanel = document.getElementById("react-panel");
    const comparisonGrid = document.getElementById("comparison-grid");

    const baselineAnswer = document.getElementById("baseline-answer");
    const baselineModeLabel = document.getElementById("baseline-mode-label");
    const baselineTime = document.getElementById("baseline-time");

    const reactAnswer = document.getElementById("react-answer");
    const reactStatusBadge = document.getElementById("react-status-badge");
    const reactTime = document.getElementById("react-time");
    const reactIterationsCount = document.getElementById("react-iterations-count");
    const reactToolsCount = document.getElementById("react-tools-count");

    const traceSection = document.getElementById("trace-section");
    const traceTimeline = document.getElementById("trace-timeline");
    const toggleTraceBtn = document.getElementById("toggle-trace-btn");

    let currentMode = "both";

    // 1. Fetch & Render Sample Queries
    async function loadSampleQueries() {
        try {
            const res = await fetch("/api/sample-queries");
            const samples = await res.json();
            sampleQueriesList.innerHTML = "";

            samples.forEach(item => {
                const chip = document.createElement("button");
                chip.type = "button";
                chip.className = "sample-chip";
                chip.innerHTML = `<span>${item.icon}</span> <span>${item.title}</span>`;
                chip.addEventListener("click", () => {
                    queryInput.value = item.query;
                    queryForm.dispatchEvent(new Event("submit"));
                });
                sampleQueriesList.appendChild(chip);
            });
        } catch (err) {
            console.error("Lỗi khi tải câu hỏi mẫu:", err);
        }
    }

    // 2. Mode Selector Event Listeners
    modeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            modeBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentMode = btn.dataset.mode;
            updatePanelVisibility();
        });
    });

    function updatePanelVisibility() {
        if (currentMode === "baseline") {
            baselinePanel.classList.remove("hidden");
            reactPanel.classList.add("hidden");
            comparisonGrid.style.gridTemplateColumns = "1fr";
            traceSection.classList.add("hidden");
        } else if (currentMode === "react") {
            baselinePanel.classList.add("hidden");
            reactPanel.classList.remove("hidden");
            comparisonGrid.style.gridTemplateColumns = "1fr";
            traceSection.classList.remove("hidden");
        } else {
            baselinePanel.classList.remove("hidden");
            reactPanel.classList.remove("hidden");
            comparisonGrid.style.gridTemplateColumns = "1fr 1fr";
            traceSection.classList.remove("hidden");
        }
    }

    // 3. Form Submit Event
    queryForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const userQuery = queryInput.value.trim();
        if (!userQuery) return;

        // UI Loading state
        submitBtn.disabled = true;
        loadingState.classList.remove("hidden");
        resultsContainer.classList.add("hidden");

        try {
            const res = await fetch("/api/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: userQuery, mode: currentMode })
            });

            const data = await res.json();
            if (res.ok) {
                renderResults(data);
            } else {
                alert(data.error || "Có lỗi xảy ra khi xử lý câu hỏi.");
            }
        } catch (err) {
            alert("Lỗi kết nối máy chủ REST API: " + err.message);
        } finally {
            submitBtn.disabled = false;
            loadingState.classList.add("hidden");
        }
    });

    // 4. Render Results Function
    function renderResults(data) {
        resultsContainer.classList.remove("hidden");
        updatePanelVisibility();

        // Baseline Panel
        if (data.baseline) {
            baselineAnswer.textContent = data.baseline.answer || "Không có câu trả lời.";
            baselineModeLabel.textContent = `Mode: ${data.baseline.mode || "mock_baseline"}`;
            baselineTime.textContent = `⏱️ ${data.baseline.execution_time_ms} ms`;
        }

        // ReAct Panel
        if (data.react) {
            reactAnswer.textContent = data.react.answer || "Không có câu trả lời.";
            reactTime.textContent = `⏱️ ${data.react.execution_time_ms} ms`;
            reactIterationsCount.textContent = `🔄 ${data.react.iterations} Iteration(s)`;

            const trace = data.react.trace || [];
            const toolCallCount = trace.filter(t => t.action).length;
            reactToolsCount.textContent = `🛠️ ${toolCallCount} Tool Call(s)`;

            if (data.react.status === "completed") {
                reactStatusBadge.className = "badge badge-success";
                reactStatusBadge.textContent = "Completed";
            } else {
                reactStatusBadge.className = "badge badge-warning";
                reactStatusBadge.textContent = data.react.status || "Reached Limit";
            }

            renderTraceTimeline(trace);
        }
    }

    // 5. Render Step-by-Step ReAct Trace Timeline
    function renderTraceTimeline(trace) {
        traceTimeline.innerHTML = "";

        if (!trace || trace.length === 0) {
            traceTimeline.innerHTML = `<p class="subtitle">Không có thông tin trace log.</p>`;
            return;
        }

        trace.forEach((step, idx) => {
            const card = document.createElement("div");
            card.className = "step-card";

            let blocksHtml = "";

            // Thought Block
            if (step.thought) {
                blocksHtml += `
                    <div class="step-block">
                        <div class="step-block-title title-thought">💭 Thought (Suy luận bước ${step.iteration})</div>
                        <div class="thought-content">${escapeHtml(step.thought)}</div>
                    </div>
                `;
            }

            // Action Block
            if (step.action) {
                blocksHtml += `
                    <div class="step-block">
                        <div class="step-block-title title-action">🛠️ Action (Gọi Tool)</div>
                        <pre class="code-box"><code>${escapeHtml(JSON.stringify(step.action, null, 2))}</code></pre>
                    </div>
                `;
            }

            // Observation Block
            if (step.observation !== undefined) {
                blocksHtml += `
                    <div class="step-block">
                        <div class="step-block-title title-observation">👁️ Observation (Kết quả trả về từ Tool)</div>
                        <pre class="code-box"><code>${escapeHtml(JSON.stringify(step.observation, null, 2))}</code></pre>
                    </div>
                `;
            }

            // Final Answer Block
            if (step.final_answer) {
                blocksHtml += `
                    <div class="step-block">
                        <div class="step-block-title title-final">🎯 Final Answer (Câu trả lời cuối cùng)</div>
                        <div class="thought-content" style="border-left: 3px solid #fbbf24;">${escapeHtml(step.final_answer)}</div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="step-header">
                    <span class="step-title">📍 Step #${step.iteration || (idx + 1)}</span>
                </div>
                ${blocksHtml}
            `;

            traceTimeline.appendChild(card);
        });
    }

    // 6. Toggle Collapse/Expand Trace
    toggleTraceBtn.addEventListener("click", () => {
        if (traceTimeline.classList.contains("hidden")) {
            traceTimeline.classList.remove("hidden");
            toggleTraceBtn.textContent = "Thu Gọn Trace";
        } else {
            traceTimeline.classList.add("hidden");
            toggleTraceBtn.textContent = "Mở Rộng Trace";
        }
    });

    function escapeHtml(str) {
        if (typeof str !== 'string') return str;
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Initialize
    loadSampleQueries();
});
