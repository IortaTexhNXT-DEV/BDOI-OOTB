import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Chart } from "primereact/chart";

const MONTH_KEYS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function BarchartMonthly({ year = "2024" }) {
  const { t } = useTranslation();
  const [chartData, setChartData] = useState({});
  const [chartOptions, setChartOptions] = useState({});

  const monthLabels = useMemo(
    () => MONTH_KEYS.map((m) => t(`chart.${m}`)),
    [t]
  );

  const data = useMemo(() => ({
    "2024": {
      labels: monthLabels,
      datasets: [
                {
                    type: 'bar',
                    label: '2024',
                    backgroundColor: '#0072d8',
                    data: [50, 25, 12, 48, 80, 76, 42, 50, 25, 12, 48, 70, 76, 42],
                    barPercentage: 0.8,
                    categoryPercentage: 0.6
                }
            ]
        },
    "2023": {
      labels: monthLabels,
      datasets: [
                {
                    type: 'bar',
                    label: '2024',
                    backgroundColor: '#0072d8',
                    data: [25, 50, 20, 40, 20, 33, 42, 15, 50, 44, 48, 66, 46, 41],
                    barPercentage: 0.8,
                    categoryPercentage: 0.6
                }
            ]
        },
    "2022": {
      labels: monthLabels,
      datasets: [
                {
                    type: 'bar',
                    label: '2024',
                    backgroundColor: '#0072d8',
                    data: [25, 25, 55, 88, 68, 60, 42, 30, 50, 20, 48, 30, 62, 23],
                    barPercentage: 0.8,
                    categoryPercentage: 0.6
                }
            ]
        },
    "2021": {
      labels: monthLabels,
      datasets: [
                {
                    type: 'bar',
                    label: '2024',
                    backgroundColor: '#0072d8',
                    data: [30, 77, 23, 83, 70, 76, 29, 39, 24, 28, 48, 70, 46, 32],
                    barPercentage: 0.8,
                    categoryPercentage: 0.6
                }
            ]
    },
    "2020": {
      labels: monthLabels,
      datasets: [
                {
                    type: 'bar',
                    label: '2024',
                    backgroundColor: '#0072d8',
                    data: [30, 56, 28, 48, 60, 76, 27, 66, 88, 44, 45, 57, 37, 42],
                    barPercentage: 0.8,
                    categoryPercentage: 0.6
                }
      ],
    },
  }), [monthLabels]);

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
    setChartData(data[year]);
    setChartOptions(options);
  }, [year, data]);

    return (
        <div className="card">
            <Chart type="bar" data={chartData} options={chartOptions} />
            <div className='mt-2' style={{ textAlign: "center", fontFamily: "Nunito, Arial, sans-serif", fontSize: "12px", fontWeight: 400 }}>{year}</div>
        </div>
    )
}
