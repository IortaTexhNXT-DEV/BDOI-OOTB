import React, { useEffect, useState } from "react";
import "./index.scss";
import { data } from "./mock";
import { Button } from "primereact/button";
import { Image } from "primereact/image";
import SvgLogo from "../../assets/icons/SvgLogo";
import SvgBell from "../../assets/icons/SvgBell";
import Cookies from "js-cookie";

const Header = () => {
  const [isMobile, setIsMobile] = useState(false);

  // Get user data from localStorage
  const userName = localStorage.getItem("USER_NAME") || data.Name;
  const userEmail = localStorage.getItem("USER_EMAIL") || "";
  const userImage = data.Image; // Keep using default image for now

  const RightView = () => {
    if (isMobile) {
      return (
        <div className="barger__icon">
          <Button icon="pi pi-bars" text />
        </div>
      );
    } else {
      return (
        <div className="grid align-items-center">
          <div className="bdo-header-logo col-auto">
            {/* <img src="/BDO_insure_logo.png.png" alt="BDO Insure" className="bdo-logo-header" /> */}
          </div>
          <div className="col"></div>
          <div className="image__main__block col-auto">
            <div className="image__block">
              <Image src={userImage} alt="Image" width="45" />
            </div>
          </div>
          <div className="col-auto">
            <div className="text__block">
              <div className="text">{userName}</div>
              <i className="pi pi-angle-right" style={{ color: "#6366f1" }}></i>
            </div>
          </div>
          <div className="bell__icon__block col-auto">
            <div className="text-center">
              <div className="bell__icon bg-primary p-2">
                <SvgBell height={20} width={20} color={"#FFFFFFFF"} />
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="heder__block grid grid-nogutter">
      <div className=" col">
        <div className="left__side  p-4  bg-primary font-bold">
          <SvgLogo className="mr-2" color={"#FFFFFFFF"} />
        </div>
      </div>
      <div className="box__wrap col">
        <div className="right__side text-center p-2 font-bold">
          <RightView />
        </div>
      </div>
    </div>
  );
};

export default Header;
