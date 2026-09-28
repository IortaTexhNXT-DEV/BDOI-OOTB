import { Card } from "primereact/card";
import React from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import SvgCollectedPremium from "../../../../assets/agentIcon/SvgCollectedPremium";
import SvgEarnCollection from "../../../../assets/agentIcon/SvgEarnCollection";
import SvgReceivable from "../../../../assets/agentIcon/SvgReceivable";
import SvgGrossPremium from "../../../../assets/agentIcon/SvgGrossPremium";

const BottomCard = ({ detail }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  return (
    <div className="bottom__card__container grid">
      <div className="col-12 md:col-3 lg:col-3">
        <Card>
          <div className="bottom__card__inner__container">
            <div className="bottom__card__inner__container__svg mt-2">
              <SvgEarnCollection />
            </div>
            <div className="bottom__card__inner__container__title mt-2">
              {formatCurrency(detail?.earnedCommission)}
            </div>
            <div className="bottom__card__inner__container__sub__title mt-2">
              {t("dashboard.earnedCommission")}
            </div>
          </div>
        </Card>
      </div>
      <div className="col-12 md:col-3 lg:col-3">
        <Card>
          <div className="bottom__card__inner__container">
            <div className="bottom__card__inner__container__svg mt-2">
              <SvgCollectedPremium />
            </div>
            <div className="bottom__card__inner__container__title mt-2">
              {formatCurrency(detail?.collectedPremium)}
            </div>
            <div className="bottom__card__inner__container__sub__title mt-2">
              {t("dashboard.collectedPremium")}
            </div>
          </div>
        </Card>
      </div>
      <div className="col-12 md:col-3 lg:col-3">
        <Card>
          <div className="bottom__card__inner__container">
            <div className="bottom__card__inner__container__svg mt-2">
              <SvgReceivable />
            </div>
            <div className="bottom__card__inner__container__title mt-2">
              {formatCurrency(detail?.receivables)}
            </div>
            <div className="bottom__card__inner__container__sub__title mt-2">
              {t("dashboard.receivables")}
            </div>
          </div>
        </Card>
      </div>
      <div className="col-12 md:col-3 lg:col-3">
        <Card>
          <div className="bottom__card__inner__container">
            <div className="bottom__card__inner__container__svg mt-2">
              <SvgGrossPremium />
            </div>
            <div className="bottom__card__inner__container__title mt-2">
              {formatCurrency(detail?.grossPremium)}
            </div>
            <div className="bottom__card__inner__container__sub__title mt-2">
              {t("dashboard.grossPremium")}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default BottomCard;
