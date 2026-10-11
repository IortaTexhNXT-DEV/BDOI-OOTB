import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import { Card } from "primereact/card";
import BatchTable from "./BatchTable";

export default function BatchRenewalPage() {
  const { t } = useTranslation();
  const items = [{ label: t("sidebar.Renewals") }, { label: t("batchRenewalPage.batchRenewal"), url: "/agent/renewal-batch" }];
  const Initiate = { label: t("sidebar.Operations") };

  return (
    <div className="policy__table__container mt-4">
      <div className="grid mt-3">
        <div className="col-12 md:col-12 lg:col-12">
          <label className="leadlisting__overal__container__title">
            {t("batchRenewalPage.batchRenewal")}
          </label>
          <div className="mt-3">
            <BreadCrumb
              model={items}
              home={Initiate}
              className="breadCrums"
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>

        <div className="card__container__outer">
          <Card style={{ borderRadius: "20px" }}>
            <BatchTable />
          </Card>
        </div>
      </div>
    </div>
  );
}
