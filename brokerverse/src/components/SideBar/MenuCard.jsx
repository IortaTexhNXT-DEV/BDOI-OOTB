import React from 'react'

const MenuCard = ({ data }) => {
    if (data?.submenu?.length > 0) {
        return <div>
            sss
        </div>
    }
    return (

        <div>{data.name}</div>
    )
}

export default MenuCard