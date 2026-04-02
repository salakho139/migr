async function init() {
    const rawData = await d3.csv("data/visitor-visa-statistics.csv", d3.autoType);
    const geoData = await d3.json("data/world.json");
    const salaryData = await d3.csv("data/country_salaries.csv", d3.autoType);

    const schengenCountries = new Set([
        "Austria", "Belgium", "Bulgaria", "Croatia", "Czech Republic", "Czechia",
        "Denmark", "Estonia", "Finland", "France", "Germany", "Greece",
        "Hungary", "Iceland", "Italy", "Latvia", "Liechtenstein", "Lithuania",
        "Luxembourg", "Malta", "Netherlands", "Norway", "Poland", "Portugal",
        "Romania", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland"
    ]);

    let areachart;

    d3.csv("data/visa_2023_region.csv", d3.autoType).then(function(data){
        areachart = new SlicedRect("sliced-rect", data);

        areachart.initVis();
    })

    const salaryVis = new SalaryVis("salary-vis", geoData, salaryData);
    window.salaryVis = salaryVis; // Make it globally accessible for MapVis

    const visaExemptCountries = new Set([
        "North Macedonia",
        "former Yugoslav Republic of Macedonia",
        "Andorra",
        "United Arab Emirates",
        "Antigua and Barbuda",
        "Albania",
        "Argentina",
        "Australia",
        "Bosnia and Herzegovina",
        "Barbados",
        "Brunei",
        "Brazil",
        "Bahamas",
        "Canada",
        "Chile",
        "Colombia",
        "Costa Rica",
        "Dominica",
        "Micronesia",
        "Grenada",
        "Georgia",
        "Guatemala",
        "Honduras",
        "Israel",
        "Japan",
        "Kiribati",
        "Saint Kitts and Nevis",
        "South Korea",
        "Korea, Republic of",
        "Saint Lucia",
        "Monaco",
        "Moldova",
        "Moldova, Republic of",
        "Montenegro",
        "Marshall Islands",
        "Mauritius",
        "Mexico",
        "Malaysia",
        "Nicaragua",
        "Nauru",
        "New Zealand",
        "Panama",
        "Peru",
        "Palau",
        "Paraguay",
        "Serbia",
        "Solomon Islands",
        "Seychelles",
        "Singapore",
        "San Marino",
        "El Salvador",
        "Timor-Leste",
        "Tonga",
        "Trinidad and Tobago",
        "Tuvalu",
        "Ukraine",
        "United Kingdom",
        "United States",
        "United States of America",
        "Uruguay",
        "Holy See",
        "Vatican City",
        "Saint Vincent and the Grenadines",
        "Venezuela",
        "Venezuela, Bolivarian Republic of",
        "Samoa",
        "Hong Kong SAR",
        "Macao SAR",
        "Taiwan",
        "Kosovo"
    ]);

    const countryNameMap = {
        "Russian Federation": "Russia",
        "United States": "United States of America",
        "Korea, Republic of": "South Korea",
        "Moldova, Republic of": "Moldova",
        "Venezuela, Bolivarian Republic of": "Venezuela",
        "Iran, Islamic Republic of": "Iran",
        "Syrian Arab Republic": "Syria",
        "Viet Nam": "Vietnam",
        "Lao People's Democratic Republic": "Laos",
        "Brunei Darussalam": "Brunei",
        "Bolivia, Plurinational State of": "Bolivia",
        "Tanzania, United Republic of": "Tanzania",
        "Czechia": "Czech Republic"
    };

    const cleanedData = rawData.filter(d => d.consulate_country);

    const grouped = d3.rollups(
        cleanedData,
        values => {
            const totalApplications = d3.sum(values, d => d.visitor_visa_applications || 0);
            const totalIssued = d3.sum(values, d => d.visitor_visa_issued || 0);
            const totalNotIssued = d3.sum(values, d => d.visitor_visa_not_issued || 0);

            const refusalRate = totalApplications > 0
                ? (totalNotIssued / totalApplications) * 100
                : 0;

            const rawCountry = values[0].consulate_country.trim();
            const normalizedCountry = countryNameMap[rawCountry] || rawCountry;

            return {
                reporting_year: values[0].reporting_year,
                consulate_country: normalizedCountry,
                total_applications: totalApplications,
                total_issued: totalIssued,
                total_not_issued: totalNotIssued,
                refusal_rate: refusalRate
            };
        },
        d => +d.reporting_year,
        d => {
            const rawCountry = d.consulate_country.trim();
            return countryNameMap[rawCountry] || rawCountry;
        }
    );

    const adjustedData = grouped.flatMap(([year, countries]) =>
        countries.map(([country, values]) => values)
    );

    const years = [...new Set(adjustedData.map(d => d.reporting_year))].sort(d3.ascending);
    const defaultYear = years[years.length - 1];

    const yearSelect = d3.select("#year-select");

    yearSelect.selectAll("option")
        .data(years)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);

    yearSelect.property("value", defaultYear);

    const mapVis = new MapVis(
        "map-vis",
        adjustedData,
        geoData,
        schengenCountries,
        visaExemptCountries
    );

    mapVis.render(defaultYear);

    yearSelect.on("change", function() {
        mapVis.render(+this.value);
    });

    // ── Entrance Animation Observer ──
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                if (entry.target.classList.contains('map-page')) {
                    mapVis.enterAnimation();
                }
            }
        });
    }, observerOptions);

    const animatedSections = document.querySelectorAll('.landing-page, .transition-page, .map-page, .salary-page');
    animatedSections.forEach(section => observer.observe(section));

    initLandingVis();
}

function initLandingVis() {
    const container = d3.select("#landing-bg");
    if (container.empty()) return;
    
    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid slice")
        .style("width", "100%")
        .style("height", "100%");

    const projection = d3.geoOrthographic()
        .scale(Math.min(width, height) / 2)
        .translate([width / 2, height / 2])
        .rotate([0, -20]);

    const path = d3.geoPath().projection(projection);
    const graticule = d3.geoGraticule();

    // ── Sphere Glow ──
    const defs = svg.append("defs");
    const glow = defs.append("radialGradient")
        .attr("id", "globe-glow")
        .attr("cx", "35%").attr("cy", "35%").attr("r", "50%");
    glow.append("stop").attr("offset", "0%").attr("stop-color", "rgba(249, 115, 22, 0.4)");
    glow.append("stop").attr("offset", "100%").attr("stop-color", "rgba(0, 0, 0, 0)");

    svg.append("path")
        .datum({type: "Sphere"})
        .attr("d", path)
        .attr("fill", "url(#globe-glow)");

    // ── Main Graticule ──
    svg.append("path")
        .datum(graticule())
        .attr("class", "landing-graticule")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "rgba(255, 255, 255, 0.1)")
        .attr("stroke-width", 0.5);

    // ── Secondary Graticule (thicker, slower) ──
    svg.append("path")
        .datum(graticule.step([30, 30])())
        .attr("class", "landing-graticule-2")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "rgba(249, 115, 22, 0.2)")
        .attr("stroke-width", 1);

    let rotationOffset = 0;
    let targetRotationOffset = 0;

    d3.timer((elapsed) => {
        rotationOffset += (targetRotationOffset - rotationOffset) * 0.05;
        projection.rotate([elapsed * 0.003 + rotationOffset, -15]);
        svg.selectAll(".landing-graticule, .landing-graticule-2, path").attr("d", path);
    });

    window.addEventListener("mousemove", (e) => {
        const xPercent = (e.clientX / window.innerWidth) - 0.5;
        targetRotationOffset = xPercent * 20;
    });

    window.addEventListener("resize", () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        svg.attr("viewBox", `0 0 ${w} ${h}`);
        projection.scale(Math.min(w, h) / 2).translate([w / 2, h / 2]);
    });
}

init().catch(error => {
    console.error("Error loading files:", error);
});