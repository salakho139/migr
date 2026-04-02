document.addEventListener("DOMContentLoaded", () => {
    initPassportPowerHook();
});

async function initPassportPowerHook() {
    const visContainer = d3.select("#passport-power-vis");
    if (visContainer.empty()) return;

    let data = await d3.csv("data/passport_power_2023_ranked_with_birth_share.csv", d3.autoType);

    data = data
        .filter(d =>
            d.country &&
            d.code3 &&
            d.visa_free_score != null &&
            d.rank != null
        )
        .map(d => ({
            ...d,
            region: (d.region || d.Region || d.continent || d.Continent || "Other").trim(),
            entry_to_europe_status: String(d.entry_to_europe_status || "").trim().toLowerCase()
        }))
        .sort((a, b) => d3.ascending(+a.rank, +b.rank));

    const regionColors = new Map([
        ["Americas", "#0e7490"],
        ["Europe", "#14b8a6"],
        ["Oceania", "#99f6e4"],
        ["Asia", "#f59e0b"],
        ["Africa", "#dc2626"],
        ["Other", "#6b7280"]
    ]);

    const tooltip = d3.select("#passport-tooltip");
    const panel = d3.select("#passport-power-section");

    const countryEl = document.getElementById("passport-panel-country");
    const statusEl = document.getElementById("passport-panel-status");
    const rankEl = document.getElementById("passport-panel-rank");
    const scoreEl = document.getElementById("passport-panel-score");
    const europeEl = document.getElementById("passport-panel-europe");
    const messageEl = document.getElementById("passport-panel-message");
    const filterTitleEl = document.getElementById("passport-filter-title");
    const filterCopyEl = document.getElementById("passport-filter-copy");
    const legendEl = document.getElementById("passport-power-legend");

    const sameStatusPopulationShare = d3.rollup(
        data,
        values => d3.sum(values, d => +d.Birth_Share_Pct || 0),
        d => d.entry_to_europe_status
    );

    const scoreExtent = d3.extent(data, d => +d.visa_free_score);

    renderLegend();

    let currentSelection = null;
    let resizeTimer = null;

    function render() {
        visContainer.selectAll("*").remove();

        const containerWidth = visContainer.node().clientWidth;
        const width = containerWidth;
        const height = Math.max(820, containerWidth * 0.88);

        const svg = visContainer.append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        const centerX = width * 0.5;
        const centerY = height * 0.58;

        const g = svg.append("g")
            .attr("transform", `translate(${centerX},${centerY})`);

        const innerRadius = Math.min(width, height) * 0.19;
        const outerMax = Math.min(width, height) * 0.46;

        const angle = d3.scaleBand()
            .domain(data.map(d => d.code3))
            .range([0, Math.PI * 2])
            .align(0);

        const radius = d3.scaleLinear()
            .domain(scoreExtent)
            .range([innerRadius + 18, outerMax]);

        const bars = g.selectAll(".passport-bar")
            .data(data, d => d.code3)
            .join("path")
            .attr("class", "passport-bar")
            .attr("fill", d => regionColors.get(d.region) || regionColors.get("Other"))
            .attr("stroke", "rgba(255,255,255,0.06)")
            .attr("stroke-width", 0.6)
            .attr("d", d => {
                const start = angle(d.code3);
                const end = start + angle.bandwidth() * 0.84;
                return d3.arc()({
                    innerRadius,
                    outerRadius: radius(+d.visa_free_score),
                    startAngle: start,
                    endAngle: end,
                    padAngle: 0.004,
                    padRadius: outerMax
                });
            })
            .on("mouseenter", function(event, d) {
                tooltip
                    .style("opacity", 1)
                    .html(`
                        <strong>${d.country}</strong><br>
                        Code: ${d.code3}<br>
                        Score: ${d.visa_free_score}<br>
                        Rank: ${d.rank}
                    `);

                d3.select(this).attr("stroke", "rgba(255,255,255,0.35)");
            })
            .on("mousemove", function(event) {
                tooltip
                    .style("left", `${event.clientX + 16}px`)
                    .style("top", `${event.clientY + 16}px`);
            })
            .on("mouseleave", function() {
                tooltip.style("opacity", 0);
                d3.select(this).attr("stroke", "rgba(255,255,255,0.06)");
            })
            .on("click", function(event, d) {
                currentSelection = d;
                updateSelection(d, bars, labels);
            });

        const labels = g.selectAll(".passport-code")
            .data(data, d => d.code3)
            .join("text")
            .attr("class", "passport-code")
            .attr("dy", "0.32em")
            .attr("transform", d => {
                const a = angle(d.code3) + angle.bandwidth() / 2;
                const rotate = (a * 180 / Math.PI) - 90;
                const labelRadius = radius(+d.visa_free_score) + 12;
                const flip = a > Math.PI ? 180 : 0;
                return `rotate(${rotate}) translate(${labelRadius},0) rotate(${flip})`;
            })
            .attr("text-anchor", d => {
                const a = angle(d.code3) + angle.bandwidth() / 2;
                return a > Math.PI ? "end" : "start";
            })
            .text(d => d.code3);

        g.append("circle")
            .attr("r", innerRadius - 10)
            .attr("fill", "rgba(255,255,255,0.02)")
            .attr("stroke", "rgba(255,255,255,0.06)");

        g.append("text")
            .attr("class", "passport-chart-center-label small")
            .attr("y", -16)
            .text("Passport strength");

        g.append("text")
            .attr("class", "passport-chart-center-label large")
            .attr("y", 18)
            .text("2023");

        g.append("text")
            .attr("class", "passport-chart-note")
            .attr("y", 52)
            .text("Click a country to compare mobility privilege");

        if (currentSelection) {
            updateSelection(currentSelection, bars, labels, false);
        }
    }

    function updateSelection(selected, bars, labels, animatePanel = true) {
        const selectedStatus = selected.entry_to_europe_status;
        const sameGroupShare = sameStatusPopulationShare.get(selectedStatus) || 0;
        const isVisaFree = selectedStatus === "visa-free";

        panel.classed("has-selection", true);

        bars
            .classed("selected", d => d.code3 === selected.code3)
            .transition()
            .duration(500)
            .style("opacity", d => {
                if (d.code3 === selected.code3) return 1;
                if (d.entry_to_europe_status === selectedStatus) return 0.82;
                return 0.12;
            });

        labels
            .transition()
            .duration(500)
            .style("opacity", d => {
                if (d.code3 === selected.code3) return 1;
                if (d.entry_to_europe_status === selectedStatus) return 0.82;
                return 0.10;
            });

        countryEl.textContent = selected.country;
        rankEl.textContent = `#${selected.rank}`;
        scoreEl.textContent = selected.visa_free_score;
        europeEl.textContent = isVisaFree ? "Visa-free" : "Visa required";

        statusEl.textContent = isVisaFree
            ? "This passport keeps Europe relatively open."
            : "This passport turns Europe into a conditional destination.";

        if (isVisaFree) {
            messageEl.innerHTML = `
                <strong>Congratulations! You hit the birth privilege lottery.</strong>
                You only had <span class="accent">${formatBirthShare(selected.Birth_Share_Pct)}%</span>
                chance to be born in this country. And now you can travel most of the world visa-free.
            `;

            filterTitleEl.textContent = "All visa-free countries to Europe";
            filterCopyEl.textContent =
                "The highlighted bars show passports whose holders can reach Europe without going through the Schengen application process.";
        } else {
            messageEl.innerHTML = `
                <strong>We are very sorry.</strong>
                This passport turns travelling to Europe into a process of fees, proof, and risk.
                You need a <span class="accent">Schengen visa</span> to travel to Europe.
                But do not worry — you are part of over <span class="accent">${sameGroupShare.toFixed(1)}%</span>
                of the world’s population that shares the same fate.
            `;

            filterTitleEl.textContent = "All countries requiring a Schengen visa for Europe";
            filterCopyEl.textContent =
                "The highlighted bars show passports whose holders face the same access barrier to Europe.";
        }

        if (animatePanel) {
            d3.select("#passport-power-panel")
                .interrupt()
                .style("transform", "translateY(8px)")
                .transition()
                .duration(450)
                .style("transform", "translateY(0)");
        }
    }

    function renderLegend() {
        legendEl.innerHTML = "";
        const order = ["Americas", "Europe", "Oceania", "Asia", "Africa"];

        order.forEach(region => {
            const item = document.createElement("div");
            item.className = "passport-legend-item";

            const swatch = document.createElement("span");
            swatch.className = "passport-legend-swatch";
            swatch.style.background = regionColors.get(region);

            const text = document.createElement("span");
            text.textContent = region;

            item.appendChild(swatch);
            item.appendChild(text);
            legendEl.appendChild(item);
        });
    }

    function formatBirthShare(value) {
        const n = +value;
        if (!isFinite(n)) return "0.00";
        if (n >= 10) return n.toFixed(2);
        if (n >= 1) return n.toPrecision(2);
        return n.toPrecision(2);
    }

    render();

    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(render, 150);
    });
}