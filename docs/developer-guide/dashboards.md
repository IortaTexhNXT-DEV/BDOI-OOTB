# Dashboards and charts

The standard every dashboard, chart and KPI card of BrokerVerse follows. A new screen uses the kit in
`brokerverse/src/components/Dashboard` and the data colours of `brokerverse/src/theme`; it never picks colours of its
own.

## 1. One data colour system

Data colours are tokens, separate from the brand theme. The brand theme (Toyota Insurance Services: black, grey and
red) gives the ink and the surfaces; the data palette is the same for every brand and is never repainted by it.

| Where | What |
|---|---|
| `src/theme/dataviz.json` | The values: categorical palette, sequential and diverging ramps, status colours, neutral ink, business entities. Read by the charts and by the build plugin. |
| `src/theme/bdoi/dataviz.scss` | The same values as CSS custom properties (`--bv-viz-*`) for HTML marks: KPI cards, meters, legends, tables. `chartTheme.test.js` checks that both files agree. |
| `src/theme/chartTheme.js` | `useChartTheme()`: the colours handed to Chart.js (a canvas cannot read CSS variables), `options()` for axes, grid, legend, tooltip and marks, and the reference-line and direct-label plugins. |
| `scripts/postcss-brand-vars.js` | Turns the literal blues of older stylesheets into brand variables. The data palette is on its keep list, so a data blue never becomes the brand black. |

### Neutral foundation

Cards are white on the light grey page; grid lines are 1px solid hairlines (`--bv-viz-grid` #ebebeb), axes
`--bv-viz-axis` #c4c4c4, labels `--bv-viz-ink-muted` #666666 (5.7:1 on white), secondary text #4b4b4b, headings take
the brand heading colour. No gradients, no shadows on marks, no coloured card backgrounds.

### Toyota red is the brand accent only

`--bv-accent` (#eb0a1e) marks the brand: the active menu item, the active tab. It is never a series colour, never
series 1 and never the colour of a bad state. Critical states use the status colour #b42318, always with an icon and a
word.

### Categorical palette (fixed order)

| Slot | Name | Hex | Use |
|---|---|---|---|
| 1 | Slate | `#345d9b` | series 1; the colour of every single-series chart (`chart.primary`) |
| 2 | Teal | `#0f9485` | series 2 |
| 3 | Sienna | `#8b491f` | series 3 |
| 4 | Ochre | `#b7852a` | series 4 |
| 5 | Plum | `#86528e` | series 5 |
| 6 | Olive | `#6a8d43` | series 6 |
| 7 | Steel | `#3b90bc` | series 7 |
| - | Other | `#8c8c8c` | an eighth series and beyond fold into "Other"; de-emphasis grey |

Checked with the data-viz validator (OKLab, Machado 2009 colour-blindness simulation) on the white card surface:

```
node validate_palette.js "#345d9b,#0f9485,#8b491f,#b7852a,#86528e,#6a8d43,#3b90bc" --mode light --surface "#ffffff"
  [PASS] Lightness band         all 7 inside L 0.43–0.77
  [PASS] Chroma floor           all 7 >= 0.1
  [PASS] CVD separation         worst adjacent #8b491f↔#0f9485 ΔE 14.6 (deutan) · tritan 8.2
  [PASS] Normal-vision floor    worst adjacent #3b90bc↔#6a8d43 ΔE 17.1 (normal)
  [PASS] Contrast vs surface    all 7 >= 3:1
```

The first four slots also pass with every pair compared (`--pairs all`: worst CVD ΔE 11.2, normal vision 17.9), so
any of them can sit side by side, whichever are missing from a chart (the four panel insurers, the four channels). Past four series use a legend; past seven fold into "Other" or use a table. The application
has no dark mode; if one is added, run the validator with `--mode dark` against the dark card surface and add the dark
steps as a second column.

### Fixed colour per business entity

An entity keeps its colour on every chart, whatever the order or the filter (`chart.entity(dimension, name)`, rules in
`dataviz.json > entities`; the name is matched, so "Pioneer Insurance & Surety Corp." and "PIONEER" are the same):

| Dimension | Slot 1 | Slot 2 | Slot 3 | Slot 4 | Slot 5 | Slot 6 | Slot 7 |
|---|---|---|---|---|---|---|---|
| `insurer` | Pioneer | Maagap | AXA | Stronghold | | | |
| `lob` | Motor | CTPL | Personal accident | Credit life | Travel | Fire / property | Marine / parcel |
| `channel` | TFS | Dealer | Direct | Referral | | | |

Anything else takes the "Other" grey. Never colour by rank: filtering a series out must not repaint the others.

### Sequential, ordinal and diverging ramps

* Sequential (magnitude, one hue, light to dark): `--bv-viz-seq-100` … `--bv-viz-seq-700`
  (#e1ecfc #c2d6f2 #9cb9e5 #739ad3 #507bbb #345d9b #224271). `chart.sequential(n)` gives n ordered steps from step 300
  (the lightest mark still 2:1 on white; validated with `--ordinal`). Use it for ordered buckets: ageing, funnel and
  lifecycle stages, tiers. Never colour nominal bars (products, people) by their value.
* Diverging (variance against a target): below #8b491f #c88762 #eeccba, grey midpoint #eeeeee, above #c2d6f2 #739ad3
  #345d9b (`chart.diverging(variance, scale)`). The warm arm is sienna, not red.

### Status colours (reserved)

| Status | Mark | Text | Icon |
|---|---|---|---|
| good | `#2e7d4f` | `#1d7f4e` | `pi-check-circle` |
| warning | `#d9a21b` | `#8a5a00` | `pi-exclamation-circle` |
| serious | `#cf6a1d` | `#a3470d` | `pi-exclamation-triangle` |
| critical | `#b42318` | `#b42318` | `pi-times-circle` |

A status colour is used only where the mark *means* a state (overdue, off target), always with its icon and a word,
and never next to categorical colours in the same chart. All text colours clear 4.5:1 on white.

## 2. Chart forms

| The data | Form |
|---|---|
| One headline figure | KPI card, not a chart |
| Trend over time, one series | columns (amounts by month) or a line (rates) |
| Several series over time | lines on one axis; direct labels at the end for up to four series, plus the legend |
| Ranking of names (products, referrers, statuses) | horizontal bars sorted by value, one colour (slot 1), value at the tip |
| Part of a whole, five slices or fewer | donut in the entity colours (`ShareChart` switches to bars beyond five) |
| Ordered buckets (ageing, stages) | bars in the sequential ramp, in bucket order |
| One series is the story | emphasis: that series in its colour, the rest in the "Other" grey |
| Target | a reference line (`reference={[{ value, label }]}`), never a second colour or series |

Never: a dual axis (two scales on one plot: make two charts), a pie of more than five slices, a 2-slice pie (a KPI
card), a 0–1 axis for an empty period (`ThemedChart` shows "No data for this period"), numbers on every point,
dashed grid lines, borders around marks.

## 3. The kit

```jsx
import StatCards from "../../components/StatCards";
import { ChartCard, DashboardToolbar, LISTS, ThemedChart, changeOf, drillDown, tableOf } from "../../components/Dashboard";

<DashboardToolbar title="Sales Dashboard" period={period} onPeriod={setPeriod} compare={compare} onCompare={setCompare}
  range={{ from, to, previousFrom, previousTo }} asOf={data.asOf} onRefresh={load} />
<StatCards items={[{ key: "premium", label: "Premium", value: formatValue("currency", k.premium, { compact: true }),
  change: changeOf(k.premium, previous.premium), comparison: t("dashboards.vs.previous"),
  onClick: () => drillDown(navigate, LISTS.policiesIssued(from, to)) }]} />
<ChartCard title="Premium by month" table={tableOf(data, "currency")} exportName="premium-by-month">
  <ThemedChart type="bar" data={data} format="currency" reference={[{ value: target, label: "Target ₱5M" }]} />
</ChartCard>
```

* `DashboardToolbar`: one row above everything it scopes: the dashboard switcher (the dashboards the user's roles may
  open), the period (this month / quarter / year to date), the comparison (previous period / same period last year),
  the screen's own filters, the dates covered, "Data as of … (Asia/Manila)" and Refresh. A snapshot dashboard (work in
  flight, ageing) leaves the period out and says so.
* `KpiCard` / `StatCards`: neutral card, one structure: label, value (compact ₱1.2M), change with its arrow against the
  named comparison (green / red text only when `good` says which way is good), note (target, secondary figure), state
  (icon + word). `onClick` opens the list behind the figure. No icon chips, no coloured backgrounds.
* `ChartCard`: title, subtitle, Chart / Table switch (the table is the accessible twin and is printed with the chart),
  the pattern switch, CSV export.
* `ThemedChart`: Chart.js in the theme: compact values on the value axis and in full in the tooltip, legend from two
  series, direct labels, reference lines, patterns, empty state. Pass `format` (`currency`, `count`, `percent`, `days`,
  `hours`).
* `ShareChart`: share by insurer / line / channel in the entity colours.
* `drillDown(navigate, LISTS.x(...))`: opens a list with the same filter (written to the list's saved state).
* `periodRange(period, compare)`: the dates of a period and its comparison in the business time zone; the server uses
  the same rules (`backend/src/lib/dates.js calendarPeriod`, `dashboard/service.js comparisonRange`).
* Persona dashboards: `personas.js` maps each role to its default dashboard; `/dashboard` opens it and My Work links to it.

## 4. Numbers and dates

* Amounts: `formatValue("currency", v, { compact: true })` (₱850, ₱12.9K, ₱1.2M) on cards and axes; in full
  (₱1,234,567.00) in tooltips and tables. Never a fixed currency symbol.
* Counts with grouping; percentages with one decimal (`formatPercent`).
* Dates in the configured format (`formatDate`); "today", periods and the "data as of" time in the business time zone
  (`general.timezone`, `businessDate()`, `formatBusinessDateTime()`), never the browser's.

## 5. Accessibility

* Text WCAG AA: all ink and status text colours are 4.5:1 or more on white.
* Colour is never the only channel: a legend from two series, direct labels, icon + word for states, the table view
  of every chart, and the pattern switch (45° / 135° line texture, tone on tone; on by itself in forced-colours mode),
  which is remembered per browser.
* Marks: bars at most 24px thick with a rounded data end, lines 2px, points 8px with a 2px white ring, a 2px white gap
  between stacked and pie segments; tooltip targets of at least 24px.

## 6. Checklist for a new chart

1. Is it a chart? One figure is a KPI card; many classes are a table.
2. Pick the form from section 2; no dual axis, no pie past five slices.
3. Colours from `useChartTheme()` only: `chart.primary`, `chart.series(n)`, `chart.entity(...)`, `chart.sequential(n)`,
   `chart.status(...)`. No hex in a screen.
4. Wrap it in `ChartCard` with a `table` and an `exportName`; give `ThemedChart` the `format`.
5. Targets as `reference` lines; states with icon and word.
6. New palette values: run `node validate_palette.js "<hex,...>" --mode light --surface "#ffffff"` and update
   `dataviz.json`, `dataviz.scss` and this page together.
