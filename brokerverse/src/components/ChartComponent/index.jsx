import React, { useState, useEffect } from "react";
import { Chart } from "primereact/chart";
import { Card } from "primereact/card";
import { Chip } from "primereact/chip";
import "./index.scss";

export default function ChartComponent({
  useCustomBackground,
  useCustomTextColor,
  useCustomColors,
  useCurvedCard,
}) {
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});

  useEffect(() => {
    const documentStyle = getComputedStyle(document.documentElement);
    const backgroundColor = useCustomBackground ? "#755FE2" : "";
    const textColor = useCustomTextColor ? "#FFFFFF" : "";

    const datasetColors = useCustomColors
      ? [
          documentStyle.getPropertyValue("--yellow-500"),
          documentStyle.getPropertyValue("--red-500"),
          documentStyle.getPropertyValue("--green-500"),
          documentStyle.getPropertyValue("--black-500"),
        ]
      : [
          documentStyle.getPropertyValue("--yellow-500"),
          documentStyle.getPropertyValue("--red-500"),
          documentStyle.getPropertyValue("--green-500"),
          documentStyle.getPropertyValue("--black-500"),
        ];

    const data = {
      datasets: [
        {
          data: [50, 10, 20, 20],
          backgroundColor: datasetColors,
          hoverBackgroundColor: [
            documentStyle.getPropertyValue("--yellow-400"),
            documentStyle.getPropertyValue("--red-400"),
            documentStyle.getPropertyValue("--green-400"),
            documentStyle.getPropertyValue("--black-400"),
          ],
        },
      ],
    };

    const options = {
      cutout: "80%",
      borderColor: "transparent",
      borderRadius: {
        outerStart: -10,
        outerEnd: 40,
        innerStart: -50,
        innerEnd: 10,
      },
    };

    setChartData(data);
    setChartOptions(options);
  }, [useCustomBackground, useCustomTextColor, useCustomColors]);

  return (
    <div className="overall__container">
      <div className="chart__div">
        <Chart
          type="doughnut"
          data={chartData}
          options={chartOptions}
          className="chart"
        />
        <div className="chart__data">$</div>
      </div>
      <div className="main__text">
        <div className="daily__progress">Daily progress</div>

        <div className="new__div">
          <Chip className="new__chip" />
          <div className="new__h2">New Business</div>
        </div>
        <div className="new__div">
          <Chip className="renewal__chip" />
          <div className="renewal__h2">Renewal</div>
        </div>
        <div className="new__div">
          <Chip className="claims__div" />
          <div className="claims__h2">Claims</div>
        </div>
      </div>
    </div>
  );
}
