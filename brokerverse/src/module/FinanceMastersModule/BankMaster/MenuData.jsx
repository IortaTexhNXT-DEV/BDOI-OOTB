import React, { useRef } from 'react'
import SvgMenudots from '../../../assets/icons/SvgMenudots';
import { Button } from 'primereact/button';
import { TieredMenu } from 'primereact/tieredmenu';

const MenuData = ({ menuitems, rowData }) => {
    const menu = useRef(null);
    console.log(rowData, "llll");
    return (
        <div className="card flex justify-content-center">
            <TieredMenu
                model={menuitems.map((item) => ({
                    ...item,
                    command: () => item.command(rowData),

                }))}

                popup
                ref={menu}
                breakpoint="767px"
            />
            <Button
                icon={<SvgMenudots />}
                onClick={(e) => menu.current.toggle(e)}
                className="menubutton_popup"
            />
        </div>
    )
}

export default MenuData