import React, { useRef } from 'react'
import SvgMenudots from '../../../assets/icons/SvgMenudots';
import { Button } from 'primereact/button';
import { Menu } from 'primereact/menu';

/** Row action menu (Edit, View, Accounts). A popup TieredMenu rendered these rows as an empty strip. */
const MenuData = ({ menuitems, rowData }) => {
    const menu = useRef(null);
    return (
        <div className="card flex justify-content-center">
            <Menu
                model={menuitems.map((item) => ({
                    ...item,
                    command: () => item.command(rowData),
                }))}
                popup
                ref={menu}
            />
            <Button
                icon={<SvgMenudots />}
                onClick={(e) => menu.current.toggle(e)}
                className="menubutton_popup"
                aria-label="Actions"
                aria-haspopup tooltip="Actions" tooltipOptions={{ position: "top" }}
            />
        </div>
    )
}

export default MenuData
