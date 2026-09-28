import React, { useState, useEffect } from "react";
import "./index.scss";
import moment from "moment";
import SvgCalendarIcon from "../../Assets/Icon/SvgCalendarIcon";
import SvgNoti from "../../Assets/Icon/SvgNoti";
import SvgRightArrow from "../../Assets/Icon/SvgRightArrow";
import SvgLeftArrow from "../../Assets/Icon/SvgLeftArrow";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import InputField from "../components/InputField";
import DropDowns from "../components/DropDowns";
import TextAreaInput from "../TextAreaInput";
import { useFormik } from "formik";
import TextComponent from "../TextComponent";
import CardComponent from "../components/Cardcomponent";
import SvgTraingleIcon from "../../Assets/Icon/SvgTraingleIcon";
import { useTranslation } from "react-i18next";

const ActivityTracker = () => {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDateTable, setShowDateTable] = useState(false);
  const [selectedData, setSelectedData] = useState([]);
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const eventDataByDate = {
    [moment().format("DD-MM-YYYY")]: [
      {
        id: 1,
        time: "8:30AM",
        title: t("shared.followUpClient"),
      },
      {
        id: 2,
        time: "10:30AM",
        title: t("shared.birthdayReminder") + ": Alexander de los Santos.",
      },
    ],
    [moment().add(1, "days").format("DD-MM-YYYY")]: [
      {
        id: 1,
        time: "8:30AM",
        title: t("shared.followUpClient"),
      },
      {
        id: 2,
        time: "10:30AM",
        title: t("shared.birthdayReminder") + ": Alexander de los Santos.",
      },
    ],
  };

  const getWeekDates = (date) => {
    const startDate = new Date(date);
    startDate.setDate(date.getDate() - date.getDay());

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  };
  const isSameDay = (date1, date2) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate() &&
      moment(date1).isSame(date2, "day")
    );
  };
  const selectDate = (date) => {
    setSelectedDate(date);
  };

  const handleCalendarButtonClick = (date) => {
    setSelectedDate(date);
    const datee = moment(date).format("DD-MM-YYYY");
    setSelectedData(eventDataByDate[datee] || []);
  };
  useEffect(() => {
    handleCalendarButtonClick(selectedDate);
  }, [selectedDate]);

  const previousWeek = () => {
    const prevWeek = new Date(currentDate);
    prevWeek.setDate(currentDate.getDate() - 7);
    setCurrentDate(prevWeek);
  };
  const nextWeek = () => {
    const nextWeek = new Date(currentDate);
    nextWeek.setDate(currentDate.getDate() + 7);
    setCurrentDate(nextWeek);
  };
  const formatSelectedDate = (date) => {
    return moment(date).format("DD-MM-YYYY");
  };
  const formatMonthYear = (date) => {
    const options = { year: "numeric", month: "long" };
    return date.toLocaleDateString("en-US", options);
  };
  const renderWeek = () => {
    const weekDates = getWeekDates(currentDate);
    const today = new Date();
    const weekdaysToRender = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

    return weekDates.map((date, index) => {
      const dayName = weekdaysToRender[index];
      const isPastDate = date < today;

      return (
        <div key={index}>
          <div className="grid week__date mt-3">
            <div className="col-12 md:col-12 lg:col-6 week__numbers">
              <button
                key={index}
                className={`${isSameDay(date, today)
                  ? "today"
                  : isSameDay(date, selectedDate)
                    ? "selected"
                    : isPastDate
                      ? "past"
                      : "default"
                  }`}
                onClick={() => {
                  if (!isPastDate || isSameDay(date, today)) {
                    selectDate(date);
                    setShowDateTable(false);
                    handleCalendarButtonClick(date);
                  }
                }}
                disabled={isPastDate && !isSameDay(date, today)}
              >
                <div className="get__date"> {date.getDate()}</div>
                <div className="day__name">{dayName}</div>
              </button>
            </div>
          </div>
        </div>
      );
    });
  };
  const initialValue = {
    dropdown: "",
    client: "",
    todayDate: "",
    from: "",
    to: "",
    textArea: "",
  };
  const validate = (values) => {
    console.log(values, "ggg");
    const errors = {};
    console.log(values, errors, "values");
    if (!values.dropdown) {
      errors.dropdown = "select any one";
    }
    if (!values.client) {
      errors.client = "enter here";
    }
    if (!values.todayDate) {
      errors.todayDate = "select date";
    }
    if (!values.from) {
      errors.from = "select date";
    }
    if (!values.to) {
      errors.to = "select date";
    }
    if (!values.textArea) {
      errors.textArea = "Write note here";
    }
    return errors;
  };
  const handleSubmit = () => {
    const formErrors = validate(formik.values);
    setErrors(formErrors);
    console.log(formErrors, "hfgdh");
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: handleSubmit,
  });

  return (
    <div className="container">
      <div className="grid to__do">
        <div className="col-12 md:col-6 lg:col-3">
          <TextComponent
            children={"TO DO"}
            classNames={"todo"}
          />
          <CardComponent
            isCurved={true}
            showContentText={true}
            useTextColor={true}
          >
            <div className="traingle__view">
              <SvgTraingleIcon />
              <div>
                <div>
                  <span className="traingle__text"> 5</span>
                </div>
                <span className="plicies__text">Policies Expiry Soon</span>
              </div>
            </div>
          </CardComponent>
        </div>
      </div>
      <div className="layout__container ">
        <div className="layout__content">
          <div className="grid header mt-5">
            <div className="col-12 md:col-8 lg:col-5 activity__addReminders">
              <div className="activity__title">Activity Tracker</div>
              <div>
                <form onSubmit={formik.handleSubmit}>
                  <div className=" flex justify-content-center">
                    <Button
                      className="add__reminders "
                      label="Add Reminders +"
                      onClick={() => setVisible(true)}
                    />
                    <Dialog
                      header="New Reminder"
                      visible={visible}
                      className="dialog__view"
                      onHide={() => setVisible(false)}
                    >
                      <div className="grid mt-4 ">
                        <div className="col-12 m-0 pl-0 pr-0 pb-0 mb-4">
                          <DropDowns
                            classNames="w-full drop__view"
                            value={formik.values.dropdown}
                            onChange={formik.handleChange("dropdown")}
                            error={formik.errors.dropdown}
                          />
                        </div>
                        <div className="col-12 md:col-9 lg:col-9 m-0 p-0">
                          <InputField
                            classNames="w-full drop__view"
                            value={formik.values.client}
                            onChange={formik.handleChange("client")}
                            error={formik.errors.client}
                          />
                        </div>
                        <div className="col-12 md:col-3 lg:col-3 submit__view ">
                          <Button
                            label="Search Chat"
                            className="search__chat"
                            onSubmit={formik.handleSubmit}
                          />
                        </div>
                        <div className="col-12 md:col-6 lg:col-6 mt-3 p-0">
                          <InputField
                            classNames="w-full drop__view"
                            value={formik.values.todayDate}
                            onChange={formik.handleChange("todayDate")}
                            error={formik.errors.todayDate}
                            required
                            label="Date"
                          />
                        </div>
                        <div className="col-6 md:col-3 lg:col-3 m-0 pr-0  ">
                          <DropDowns
                            classNames="w-full drop__view "
                            value={formik.values.from}
                            onChange={formik.handleChange("from")}
                            error={formik.errors.from}
                            required
                            label="time"
                          />
                        </div>
                        <div className="col-6 md:col-3 lg:col-3 m-0  pr-0 ">
                          <DropDowns
                            classNames="w-full drop__view"
                            value={formik.values.to}
                            onChange={formik.handleChange("to")}
                            error={formik.errors.to}
                            required
                            label="time"
                          />
                        </div>
                        <div className="col-12 m-0 p-0">
                          <TextAreaInput
                            inputClassName="w-full textArea__view"
                            value={formik.values.textArea}
                            onChange={formik.handleChange("textArea")}
                            error={formik.errors.textArea}
                            required
                            label="Notes"
                          />
                        </div>
                        <div className="col-12 submit__view">
                          <Button
                            onSubmit={formik.handleSubmit}
                            label="Submit"
                            className="submit"
                          />
                        </div>
                      </div>
                    </Dialog>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="activityTracker">
            <div className="grid active__head">
              <div className="col-12 md:col-8 lg:col-5 activity__card">
                <div className="card">
                  <div className="grid arrows mt-3">
                    <div className="col-3 arrow__left">
                      <button className="pre__button" onClick={previousWeek}>
                        <SvgLeftArrow />
                      </button>
                    </div>
                    <div className="col-6 month__year">
                      {formatMonthYear(currentDate)}
                    </div>
                    <div className="col-3 arrow__right">
                      <button onClick={nextWeek} className="pre__button">
                        <SvgRightArrow />
                      </button>
                    </div>
                    <div className="col-12">
                      <div className="week__dates">{renderWeek()}</div>
                    </div>
                    <div className="col-12 date__event mt-3">
                      {selectedData.map((val) => {
                        return (
                          <div className="grid date__list ">
                            <div className="col-2 calendar__img">
                              <SvgCalendarIcon

                              />
                            </div>
                            <div className="col-8 date__title ">
                              {val.title}
                            </div>
                            <div className="col-2 noti__img">
                              <SvgNoti

                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ActivityTracker;
