import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Card } from "primereact/card";
import "./index.scss";
import { useDispatch, useSelector } from "react-redux";
import { Skeleton } from "primereact/skeleton";

const PolicyStatsCards = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const dispatch = useDispatch();
  
  const { policyListData, loading } = useSelector(({ policyMainReducers }) => ({
    policyListData: policyMainReducers?.policyListData || [],
    loading: policyMainReducers?.loading || false,
  }));

  // Calculate statistics from policy data
  const calculateStats = () => {
    if (!policyListData || policyListData.length === 0) {
      return {
        totalPolicies: 0,
        activePolicies: 0,
        pendingApproval: 0,
        expiringSoon: 0,
        premiumCollected: 0,
        policiesByCompany: []
      };
    }

    const currentDate = new Date();
    const thirtyDaysFromNow = new Date(currentDate.getTime() + (30 * 24 * 60 * 60 * 1000));

    const totalPolicies = policyListData.length;
    
    // Count active policies (Payment status is "Completed")
    const activePolicies = policyListData.filter(
      policy => policy.Payment === 'Completed' || policy.Payment === 'Active'
    ).length;
    
    // Count pending approval (Payment status is "Pending" or "Reviewing")
    const pendingApproval = policyListData.filter(
      policy => policy.Payment === 'Pending' || policy.Payment === 'Reviewing'
    ).length;
    
    // Count expiring soon (within 30 days)
    const expiringSoon = policyListData.filter(policy => {
      if (!policy.PolicyExpiry) return false;
      const expiryDate = new Date(policy.PolicyExpiry);
      return expiryDate >= currentDate && expiryDate <= thirtyDaysFromNow;
    }).length;
    
    // Calculate total premium collected (from completed policies)
    const premiumCollected = policyListData
      .filter(policy => policy.Payment === 'Completed')
      .reduce((sum, policy) => {
        const premium = parseFloat(policy.grossPremium || 0);
        return sum + premium;
      }, 0);
    
    // Group policies by company
    const companyMap = {};
    policyListData.forEach(policy => {
      const company = policy.InsuranceCompany || 'Unknown';
      if (!companyMap[company]) {
        companyMap[company] = 0;
      }
      companyMap[company]++;
    });
    
    const policiesByCompany = Object.entries(companyMap)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 companies

    return {
      totalPolicies,
      activePolicies,
      pendingApproval,
      expiringSoon,
      premiumCollected,
      policiesByCompany
    };
  };

  const stats = calculateStats();

  const StatCard = ({ title, value, icon, color, subtitle }) => (
    <Card className="policy-stat-card" style={{ borderLeft: `4px solid ${color}` }}>
      {loading ? (
        <Skeleton height="80px" />
      ) : (
        <div className="stat-card-content">
          <div className="stat-card-header">
            <div className="stat-card-icon" style={{ backgroundColor: `${color}20`, color }}>
              {icon}
            </div>
            <div className="stat-card-info">
              <div className="stat-card-title">{title}</div>
              <div className="stat-card-value">{value}</div>
              {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
            </div>
          </div>
        </div>
      )}
    </Card>
  );

  return (
    <div className="policy-stats-container">
      <div className="grid">
        <div className="col-12 md:col-6 lg:col-4">
          <StatCard
            title={t("policyStats.totalPolicies")}
            value={stats.totalPolicies}
            icon="📋"
            color="#3B82F6"
          />
        </div>

        <div className="col-12 md:col-6 lg:col-4">
          <StatCard
            title={t("policyStats.activePolicies")}
            value={stats.activePolicies}
            icon="✅"
            color="#10B981"
            subtitle={t("policyStats.percentOfTotal", {
              percent: ((stats.activePolicies / stats.totalPolicies) * 100 || 0).toFixed(1),
            })}
          />
        </div>

        <div className="col-12 md:col-6 lg:col-4">
          <StatCard
            title={t("policyStats.pendingApproval")}
            value={stats.pendingApproval}
            icon="⏳"
            color="#F59E0B"
          />
        </div>

        <div className="col-12 md:col-6 lg:col-4">
          <StatCard
            title={t("policyStats.expiringSoon")}
            value={stats.expiringSoon}
            icon="⚠️"
            color="#EF4444"
            subtitle={t("policyStats.next30Days")}
          />
        </div>

        <div className="col-12 md:col-6 lg:col-4">
          <StatCard
            title={t("policyStats.premiumCollectedYtd")}
            value={formatCurrency(stats.premiumCollected)}
            icon="💰"
            color="#8B5CF6"
          />
        </div>

        <div className="col-12 md:col-6 lg:col-4">
          <Card className="policy-stat-card" style={{ borderLeft: `4px solid #0072d8` }}>
            {loading ? (
              <Skeleton height="80px" />
            ) : (
              <div className="stat-card-content">
                <div className="stat-card-title">{t("policyStats.topCompanies")}</div>
                {stats.policiesByCompany.length > 0 ? (
                  <div className="company-list">
                    {stats.policiesByCompany.map((item, index) => (
                      <div key={index} className="company-item">
                        <span className="company-name">{item.company}</span>
                        <span className="company-count">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-data">{t("dashboard.noDataAvailable")}</div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PolicyStatsCards;

