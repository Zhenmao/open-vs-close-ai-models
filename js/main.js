import { debounce } from "./utils.js";

d3.csv("data/data.csv").then((data) => {
  ///////////////////////////////////////////////////////////
  //// Process data /////////////////////////////////////////
  ///////////////////////////////////////////////////////////
  const now = "2026-10";

  const parseDateString = d3.utcParse("%Y-%m");
  const formatDateString = d3.utcFormat("%Y-%m");

  const accessors = {
    name: (d) => d["Model Name"],
    category: (d) => d["Category"],
    dateString: (d) => d["Date"],
    date: (d) => parseDateString(d["Date"]),
    score: (d) => +d["Score"],
    region: (d) => d["Region"],
  };

  const [xMin, xMax] = d3.extent(data, accessors.score);
  const yMin = d3.min(data, accessors.date);
  const yMax = parseDateString(now);

  const dates = d3.utcMonths(yMin, d3.utcMonth.offset(yMax, 1));

  const grouped = d3.group(data, accessors.category);

  const monthlyGroupBest = computeMonthlyGroupBest(
    grouped,
    accessors,
    dates.map(formatDateString),
  );
  const groupPathData = (group) => {
    const data = grouped.get(group);
    const last = data.at(-1);
    return [
      ...data,
      {
        Date: now,
        Score: accessors.score(last),
      },
    ];
  };

  function computeMonthlyGroupBest(grouped, accessors, dateStrings) {
    const individualBests = [...grouped.values()].map((group) => {
      let best = group[0];
      const dataByDateString = d3.index(group, accessors.dateString);
      return dateStrings.map((dateString) => {
        const monthlyData = dataByDateString.get(dateString);
        if (
          monthlyData &&
          accessors.score(monthlyData) > accessors.score(best)
        ) {
          best = monthlyData;
        }
        return best;
      });
    });
    const combinedBests = d3.zip(...individualBests);
    combinedBests.forEach((d) =>
      d.sort((a, b) => d3.ascending(accessors.score(a), accessors.score(b))),
    );
    return new Map(
      dateStrings.map((dateString, i) => [dateString, combinedBests[i]]),
    );
  }

  ///////////////////////////////////////////////////////////
  //// Setup ////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////
  let width;

  const minWidth = 640;

  const pointRadius = 5;

  const marginTop = pointRadius;
  const marginBottom = pointRadius;
  // Manually adjust marginRight and marginLeft so at minWidth no point labels are cut off
  const marginRight = 156;
  const marginLeft = 72;

  const monthHeight = 24;
  const nMonths = d3.utcMonth.count(yMin, yMax);
  const height = monthHeight * nMonths + marginTop + marginBottom;

  const topHeight = 48;
  const bottomHeight = 32;

  const xTickPadding = 6;
  const xTickSize = 6;
  const yTickPadding = 6;
  const yTickSize = 6;

  const xScale = d3.scaleLinear().domain([xMin, xMax]).nice();
  const yScale = d3
    .scaleUtc()
    .domain([yMin, yMax])
    .range([marginTop, height - marginBottom]);
  const colorScale = d3
    .scaleOrdinal()
    .domain(["Closed leaders", "Open-weights leaders"])
    .range(["closed", "open"]);

  const xTitle = "Score";

  const xTickFormat = d3.format(".0f");
  const yTickFormat = d3.utcFormat("%Y");

  const xTicks = xScale.ticks();
  const yTicks = dates.filter((d) => d.getUTCMonth() === 0);

  ///////////////////////////////////////////////////////////
  //// Render ///////////////////////////////////////////////
  ///////////////////////////////////////////////////////////
  const container = d3.select("#chart").classed("chart", true);

  const topSvg = container
    .append("svg")
    .attr("class", "is-sticky")
    .attr("data-sticky-side", "top");
  const topXAxisG = topSvg.append("g").attr("class", "axis");
  const svg = container.append("svg");
  const defs = svg.append("defs");
  const areasG = svg.append("g").attr("class", "areas");
  const xAxisG = svg.append("g").attr("class", "axis");
  const yAxisG = svg.append("g").attr("class", "axis");
  const yDifferenceYAxisG = svg.append("g").attr("class", "axis");
  const linesG = svg.append("g").attr("class", "lines");
  const pointsG = svg.append("g").attr("class", "points");
  const annotationsG = svg.append("g").attr("class", "annotations");
  const bottomSvg = container
    .append("svg")
    .attr("class", "is-sticky")
    .attr("data-sticky-side", "bottom");
  const bottomXAxisG = bottomSvg.append("g").attr("class", "axis");

  new ResizeObserver(debounce(resized)).observe(container.node());

  function resized() {
    width = Math.max(minWidth, container.node().clientWidth);

    xScale.range([marginLeft, width - marginRight]);

    svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    topSvg
      .attr("width", width)
      .attr("height", topHeight)
      .attr("viewBox", [0, 0, width, topHeight]);

    bottomSvg
      .attr("width", width)
      .attr("height", bottomHeight)
      .attr("viewBox", [0, 0, width, bottomHeight]);

    render();
  }

  function render() {
    renderTopXAxis();
    renderBottomXAxis();
    renderXAxis();
    renderYAxis();
    renderDifference();
    renderPoints();
    renderAnnotations();
  }

  function renderTopXAxis() {
    topXAxisG
      .attr("transform", `translate(0,${topHeight})`)
      .call(
        d3
          .axisTop(xScale)
          .tickValues(xTicks)
          .tickSizeInner(xTickSize)
          .tickPadding(xTickPadding)
          .tickFormat(xTickFormat),
      )
      .attr("font-family", null)
      .attr("font-size", null)
      .call((g) => g.select(".domain").remove());

    topXAxisG
      .selectChildren(".axis__title")
      .data([xTitle])
      .join((enter) =>
        enter
          .append("text")
          .attr("class", "axis__title")
          .attr("fill", "currentColor")
          .attr("text-anchor", "middle")
          .attr("x", marginLeft)
          .attr("y", -28)
          .text((d) => d),
      );
  }

  function renderBottomXAxis() {
    bottomXAxisG
      .call(
        d3
          .axisBottom(xScale)
          .tickValues(xTicks)
          .tickSizeInner(xTickSize)
          .tickPadding(xTickPadding)
          .tickFormat(xTickFormat),
      )
      .attr("font-family", null)
      .attr("font-size", null)
      .call((g) => g.select(".domain").remove());
  }

  function renderXAxis() {
    xAxisG
      .selectChildren(".tick")
      .data(xTicks)
      .join((enter) =>
        enter.append("line").attr("class", "tick").attr("y2", height),
      )
      .attr("transform", (d) => `translate(${xScale(d)},0)`);
  }

  function renderYAxis() {
    yAxisG
      .attr("transform", `translate(${marginLeft},0)`)
      .call(
        d3
          .axisLeft(yScale)
          .tickValues(yTicks)
          .tickSizeInner(yTickSize)
          .tickPadding(yTickPadding)
          .tickFormat(yTickFormat),
      )
      .attr("font-family", null)
      .attr("font-size", null)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g.selectAll(".tick line").attr("x1", width - marginLeft - marginRight),
      );

    yDifferenceYAxisG
      .selectChildren(".tick")
      .data(monthlyGroupBest)
      .join((enter) =>
        enter
          .append("line")
          .attr("class", "tick")
          .attr("transform", (_, i) => `translate(0,${yScale(dates[i])})`),
      )
      .attr("x1", ([_, g]) => xScale(accessors.score(g[0])))
      .attr("x2", ([_, g]) => xScale(accessors.score(g[1])));
  }

  function renderDifference() {
    defs
      .selectChildren("clipPath")
      .data([
        {
          id: "clipAbove",
          area: d3
            .area()
            .curve(d3.curveStepBefore)
            .x0(width - marginRight)
            .x1((d) => xScale(accessors.score(d)))
            .y((d) => yScale(accessors.date(d))),
        },
        {
          id: "clipBelow",
          area: d3
            .area()
            .curve(d3.curveStepBefore)
            .x0(marginLeft)
            .x1((d) => xScale(accessors.score(d)))
            .y((d) => yScale(accessors.date(d))),
        },
      ])
      .join((enter) =>
        enter
          .append("clipPath")
          .attr("id", (d) => d.id)
          .call((clipPath) => clipPath.append("path")),
      )
      .call((clipPath) =>
        clipPath
          .select("path")
          .attr("d", (d) => d.area(groupPathData("Open-weights leaders"))),
      );

    areasG
      .selectChildren(".area")
      .data([
        {
          clipPath: "url(#clipAbove)",
          color: colorScale("Closed leaders"),
          area: d3
            .area()
            .curve(d3.curveStepBefore)
            .x0(marginLeft)
            .x1((d) => xScale(accessors.score(d)))
            .y((d) => yScale(accessors.date(d))),
        },
        {
          clipPath: "url(#clipBelow)",
          color: colorScale("Open-weights leaders"),
          area: d3
            .area()
            .curve(d3.curveStepBefore)
            .x0(width - marginRight)
            .x1((d) => xScale(accessors.score(d)))
            .y((d) => yScale(accessors.date(d))),
        },
      ])
      .join((enter) =>
        enter
          .append("path")
          .attr("class", "area")
          .attr("clip-path", (d) => d.clipPath)
          .attr("data-color", (d) => d.color),
      )
      .attr("d", (d) => d.area(groupPathData("Closed leaders")));

    linesG
      .selectChildren(".line")
      .data([
        {
          data: groupPathData("Closed leaders"),
          color: colorScale("Closed leaders"),
          line: d3
            .line()
            .curve(d3.curveStepBefore)
            .x((d) => xScale(accessors.score(d)))
            .y((d) => yScale(accessors.date(d))),
        },
        {
          data: groupPathData("Open-weights leaders"),
          color: colorScale("Open-weights leaders"),
          line: d3
            .line()
            .curve(d3.curveStepBefore)
            .x((d) => xScale(accessors.score(d)))
            .y((d) => yScale(accessors.date(d))),
        },
      ])
      .join((enter) =>
        enter
          .append("path")
          .attr("class", "line")
          .attr("fill", "none")
          .attr("data-color", (d) => d.color),
      )
      .attr("d", (d) => d.line(d.data));
  }

  function renderPoints() {
    const pointG = pointsG
      .selectChildren(".point")
      .data(data)
      .join((enter) =>
        enter
          .append("g")
          .attr("class", "point")
          .call((g) =>
            g
              .append("circle")
              .attr("class", "point__circle")
              .attr("r", pointRadius)
              .attr("data-color", (d) => colorScale(accessors.category(d)))
              .attr("cy", (d) => yScale(accessors.date(d))),
          )
          .call((g) =>
            g
              .append("text")
              .attr("class", "point__label")
              .attr("fill", "currentColor")
              .attr("dy", "1em")
              .attr("y", (d) => yScale(accessors.date(d)))
              .text(accessors.name)
              .each(function (d) {
                const isBest =
                  d === monthlyGroupBest.get(accessors.dateString(d))[1];
                d3.select(this)
                  .attr("dx", isBest ? 4 : -4)
                  .attr("text-anchor", isBest ? "start" : "end");
              }),
          ),
      );

    pointG
      .select(".point__circle")
      .attr("cx", (d) => xScale(accessors.score(d)));

    pointG.select(".point__label").attr("x", (d) => xScale(accessors.score(d)));
  }

  function renderAnnotations() {
    const annotationWidth = 46;
    const annotationHeight = 38;

    const annotations = [
      {
        transX: accessors.score(grouped.get("Open-weights leaders")[0]),
        transY: d3.utcMonth.offset(yMin, 2),
        xOffset: -annotationWidth,
        yOffset: 0,
        color: colorScale("Open-weights leaders"),
        arrowPaths: ["M6 32 C16 30 28 18 40 6", "M30 10 L40 6 L36 16"],
        textAnchor: "middle",
        xText: 0,
        yText: annotationHeight + 8,
        text: "Open-weights models",
      },
      {
        transX: accessors.score(grouped.get("Closed leaders")[0]),
        transY: d3.utcMonth.offset(yMin, 2),
        xOffset: 0,
        yOffset: 0,
        color: colorScale("Closed leaders"),
        arrowPaths: ["M40 32 C30 30 18 18 6 6", "M16 10 L6 6 L10 16"],
        textAnchor: "middle",
        xText: annotationWidth,
        yText: annotationHeight + 12,
        text: "Closed models",
      },
    ];

    annotationsG
      .selectChildren(".annotation")
      .data(annotations)
      .join((enter) =>
        enter
          .append("g")
          .attr("class", "annotation")
          .attr("data-color", (d) => d.color)
          .call((g) =>
            g
              .append("g")
              .attr("class", "annotation__arrow")
              .attr("fill", "none")
              .selectChildren()
              .data((d) => d.arrowPaths)
              .join("path")
              .attr("d", (d) => d),
          )
          .call((g) =>
            g
              .append("text")
              .attr("class", "annotation__label")
              .attr("text-anchor", (d) => d.textAnchor)
              .attr("transform", "rotate(-4)")
              .selectChildren("tspan")
              .data((d) => d.text.split(" "))
              .join("tspan")
              .text((d) => d)
              .each(function (_, i) {
                const d = d3.select(this.parentNode).datum();
                d3.select(this)
                  .attr("x", d.xText)
                  .attr("y", d.yText)
                  .attr("dy", i * 1.1 + "em");
              }),
          ),
      )
      .attr(
        "transform",
        (d) =>
          `translate(${xScale(d.transX) + d.xOffset},${yScale(d.transY) + d.yOffset})`,
      );
  }
});
