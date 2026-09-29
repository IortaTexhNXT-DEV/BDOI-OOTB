import React from "react";
import { Card } from "primereact/card";
import { useTranslation } from "react-i18next";
import "./index.scss";

const PolicyStatsCards = ({ policyData = [] }) => {
  const { t } = useTranslation();
  // Calculate policy counts based on expiry dates
  const calculatePolicyCounts = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let activeCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;

    policyData.forEach((policy) => {
      const expiryDate = policy.PolicyExpiry || policy.expiry;
      if (!expiryDate) return;

      const expiry = new Date(expiryDate);
      expiry.setHours(0, 0, 0, 0);
      
      const diffTime = expiry - today;
      const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        expiredCount++;
      } else if (daysUntilExpiry >= 0 && daysUntilExpiry <= 5) {
        expiringCount++;
      } else {
        activeCount++;
      }
    });

    return { activeCount, expiringCount, expiredCount };
  };

  const { activeCount, expiringCount, expiredCount } = calculatePolicyCounts();

  const statsCards = [
    {
      title: t("shared.activePolicies"),
      count: activeCount,
      icon: "pi pi-check-circle",
      className: "stats-card-active",
      description: t("shared.moreThan5Days")
    },
    {
      title: t("shared.expiringSoon"),
      count: expiringCount,
      icon: "pi pi-clock",
      className: "stats-card-expiring",
      description: t("shared.zeroTo5Days")
    },
    {
      title: t("shared.expiredPolicies"),
      count: expiredCount,
      icon: "pi pi-times-circle",
      className: "stats-card-expired",
      description: t("shared.pastExpiryDate")
    }
  ];

  return (
    <div className="policy-stats-container">
      <div className="grid">
        {statsCards.map((card, index) => (
          <div key={index} className="col-12 md:col-4 lg:col-4">
            <Card className={`stats-card ${card.className}`}>
              <div className="stats-card-content">
                <div className="stats-card-header">
                  <i className={`stats-card-icon ${card.icon}`}></i>
                  <div className="stats-card-title">{card.title}</div>
                </div>
                <div className="stats-card-count">{card.count}</div>
                <div className="stats-card-description">{card.description}</div>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PolicyStatsCards;
