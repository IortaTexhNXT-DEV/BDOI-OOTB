import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Chart } from "primereact/chart";

const MONTH_KEYS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function BarchartMonthly({ year, data: commissionByYear }) {
  const { t } = useTranslation();
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});
  const monthLabels = useMemo(
    () => MONTH_KEYS.map((m) => t(`chart.${m}`)),
    [t]
  );

  const data = useMemo(() => ({
    labels: monthLabels,
    datasets: [
      {
        type: "bar",
        label: year,
        backgroundColor: "#0072d8",
        data: commissionByYear?.[year] || Array(12).fill(0),
        barPercentage: 0.8,
        categoryPercentage: 0.6,
      },
    ],
  }), [monthLabels, commissionByYear, year]);

  useEffect(() => {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
        const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

        const options = {
            maintainAspectRatio: false,
            aspectRatio: 0.8,
            plugins: {
                tooltips: {
                    mode: 'index',
                    intersect: false
                },
                legend: {
                    labels: {
                        color: textColor
                    },
                    display: false
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: textColorSecondary
                    },
                    grid: {
                        display: false,
                        color: surfaceBorder
                    }
                },
                y: {
                    display: false,
                    stacked: true,
                    ticks: {
                        color: textColorSecondary
                    },
                    grid: {
                        display: false,
                        color: surfaceBorder
                    }
                }
            }
        };
    setChartData(data);
    setChartOptions(options);
  }, [year, data]);

    return (
        <div className="card">
            <Chart type="bar" data={chartData} options={chartOptions} />
            <div className='mt-2' style={{ textAlign: "center", fontFamily: "Nunito, Arial, sans-serif", fontSize: "12px", fontWeight: 400 }}>{year}</div>
        </div>
    )
}
