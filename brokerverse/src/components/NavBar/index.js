import "./index.scss";
import { Avatar } from 'primereact/avatar';

const NavBar = ({ Logout }) => {

  return (
    <div className="nav__block">

            <i className="pi pi-bell p-overlay-badge" style={{ height:32,width:32,display:"contents" }}>
            </i>

            <Avatar image="https://primefaces.org/cdn/primereact/images/avatar/amyelsner.png" className="profile_container" size="xlarge" shape="circle" />

    </div>
  );
};

export default NavBar;