import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import SvgAdd from "../../../assets/agentIcon/SvgAdd";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import DropdownField from "../../component/DropdownField";
import DatepickerField from "../../component/datePicker";
import InputTextField from "../../component/inputText";
import { InputTextarea } from "primereact/inputtextarea";
import CustomToast from "../../../components/Toast";
import SvgArrow from "../../../assets/agentIcon/SvgArrow";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid"; // a plugin!
import { useDispatch, useSelector } from "react-redux";
import UpcommingEventCard from "./UpcommingEventCard";
import { useFormik } from "formik";
import {
  getOpenItemsListMiddleware,
  postOpenItemsListMiddleware,
} from "../store/openItemsMiddleware";
import Notification from "../upcomingEvents";

const initialValues = {
  reminder: "",
  client: "",
  date: new Date(),
  startTime: "",
  endTime: "",
  notes: "",
};

const customValidation = (values) => {
  const errors = {};
  return errors;
};

const OpenItems = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const toastRef = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  useEffect(() => {
    dispatch(getOpenItemsListMiddleware());
  }, [dispatch]);

  const handleSubmit = async (value) => {
    const result = await dispatch(postOpenItemsListMiddleware(value));
    if (postOpenItemsListMiddleware.rejected.match(result)) {
      toastRef.current?.showToast({ severity: "error", detail: result.payload });
      return;
    }
    toastRef.current?.showToast();
    handleclickClose();
  };
  const formik = useFormik({
    initialValues: initialValues,
    validate: customValidation,
    onSubmit: handleSubmit,
  });

  const handleclickOpen = () => {
    setVisible(true);
  };
  const handleclickClose = () => {
    setVisible(false);
  };
  const timeSlots = [
    { label: "00:00", value: "00:00" },
    { label: "01:00", value: "01:00" },
    { label: "02:00", value: "02:00" },
    { label: "03:00", value: "03:00" },
    { label: "04:00", value: "04:00" },
    { label: "05:00", value: "05:00" },
    { label: "06:00", value: "06:00" },
    { label: "07:00", value: "07:00" },
    { label: "08:00", value: "08:00" },
    { label: "09:00", value: "09:00" },
    { label: "10:00", value: "10:00" },
    { label: "11:00", value: "11:00" },
    { label: "12:00", value: "12:00" },
    { label: "13:00", value: "13:00" },
    { label: "14:00", value: "14:00" },
    { label: "15:00", value: "15:00" },
    { label: "16:00", value: "16:00" },
    { label: "17:00", value: "17:00" },
    { label: "18:00", value: "18:00" },
    { label: "19:00", value: "19:00" },
    { label: "20:00", value: "20:00" },
    { label: "21:00", value: "21:00" },
    { label: "22:00", value: "22:00" },
    { label: "23:00", value: "23:00" },
  ];

  const { upcommingList } = useSelector(({ openitemsReducers }) => {
    return {
      upcommingList: openitemsReducers?.upcommingEventsList || [],
    };
  });

  const handleSeeMore = () => {
    navigate("/agent/openitems/upcomingevents");
  };

  const handleHomeNavigation = () => {
    navigate("/");
  };

  return (
    <div className="open__item__container  mt-3">
      <CustomToast ref={toastRef} message={t("openItems.eventAddedSuccess")} />
      <div className="open__item__title">{t("openItems.activityTracker")}</div>

      <div className="grid mt-3">
        <div className="col-12 md:col-6 lg:col-6">
          <div
            className="left__arrow cursor-pointer"
            onClick={handleHomeNavigation}
          >
            <SvgLeftArrow />
            <div className="activity__tracker">{t("openItems.home")}</div>
          </div>
        </div>
        <div className="btn__container__new__event col-12 md:col-6 lg:col-6">
          <Button
            icon={<SvgAdd />}
            label={t("openItems.newEvent")}
            onClick={handleclickOpen}
          />
        </div>
      </div>

      <div className="grid mt-3">
        <div className="col-12 md:col-8 lg:col-8">
          <Card>
            <div className="custom__full__calendar">
              <FullCalendar
                plugins={[dayGridPlugin]}
                initialView="dayGridMonth"
                editable={true}
                selectable={true}
              />
            </div>
          </Card>
        </div>
        <div className="col-12 md:col-4 lg:col-4">
          <Card className="upcoming__event__main___container">
            <div className="upcoming__event__container mt-3">
              Upcoming events
            </div>
            <div className="upcoming__event__container__sub__title mt-1">
              Based on the Activity Monitor
            </div>
            <div>
              {upcommingList.length > 0 ? (
                <div>
                  {upcommingList?.map((singleData, i) => (
                    <UpcommingEventCard key={i} data={singleData} />
                  ))}
                  {upcommingList.length > 4 && (
                    <div
                      className="see__more__container mt-2"
                      onClick={() => handleSeeMore()}
                    >
                      <div className="see__more__text">See More</div>
                      <SvgArrow />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: "center", paddingTop: "40px" }}>
                  No data available
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
      <Dialog
        header="New Event"
        visible={visible}
        style={{ width: "40vw" }}
        onHide={() => setVisible(false)}
        className="agent__flow__common__dialog__container"
      >
        <div className="grid mt-2">
          <div className="col-12 md:col-12 lg:col-12">
            <DropdownField
              value={formik.values.reminder}
              options={[
                {
                  label: "Reminder",
                  value: "reminder",
                },
                {
                  label: "Appointment",
                  value: "appointment",
                },
                {
                  label: "Follow Back",
                  value: "followBack",
                },
              ]}
              onChange={(e) => formik.setFieldValue("reminder", e.value)}
              label="Select Remainder Type"
            />
          </div>
        </div>
        <div className="grid mt-2">
          <div className="col-12 md:col-12 lg:col-12">
            <InputTextField
              label="Search Client"
              value={formik?.values?.client}
              onChange={(e) => formik.setFieldValue("client", e.target.value)}
            />
          </div>
        </div>
        <div className="grid mt-2">
          <div className="col-4 md:col-4 lg:col-4">
            <DatepickerField
              label="Date"
              value={formik?.values?.date}
              onChange={(e) => formik.setFieldValue("date", e.value)}
            />
          </div>
          <div className="col-4 md:col-4 lg:col-4">
            <DropdownField
              label="Time"
              options={timeSlots}
              value={formik?.values?.startTime}
              onChange={(e) => formik.setFieldValue("startTime", e.value)}
            />
          </div>
          <div className="col-4 md:col-4 lg:col-4">
            <DropdownField
              label="Time"
              options={timeSlots}
              value={formik?.values?.endTime}
              onChange={(e) => formik.setFieldValue("endTime", e.value)}
            />
          </div>
        </div>
        <div className="mt-2">
          <InputTextarea
            rows={5}
            cols={30}
            value={formik?.values?.notes}
            onChange={(e) => formik.setFieldValue("notes", e.target.value)}
            autoResize
            label="Notes"
            style={{ width: "100%" }}
          />
        </div>
        <div
          className="add__event__btn__container mt-2"
          style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}
        >
          <Button label="Add Event" onClick={formik.handleSubmit} />
        </div>
      </Dialog>
      <Notification />
    </div>
  );
};

export default OpenItems;
