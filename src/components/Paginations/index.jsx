import React, { useState } from "react";
import { Paginator } from 'primereact/paginator';
import { Ripple } from 'primereact/ripple';
import { classNames } from 'primereact/utils';
import SvgPaginationBack from "../../Assets/Icon/SvgPaginationBack";
import SvgPaginationButton from "../../Assets/Icon/SvgPaginationButton";

export default function Paginations({
  first,
  rows,
  totalRecords,
  onPageChange,
}) {
  const template1 = {
    layout: "PrevPageLink PageLinks NextPageLink RowsPerPageDropdown",
    PrevPageLink: (options) => (
      <button
        type="button"
        className={classNames(options.className, "border-round")}
        onClick={options.onClick}
        disabled={options.disabled}
      >
        <span className="p-3">
          <Ripple />
          <SvgPaginationBack />
        </span>
      </button>
    ),
    NextPageLink: (options) => (
      <button
        type="button"
        className={classNames(options.className, "border-round")}
        onClick={options.onClick}
        disabled={options.disabled}
      >
        <span className="p-3">
          <Ripple />
          <SvgPaginationButton />
        </span>
      </button>
    ),
    PageLinks: (options) => {
      if (
        (options.view.startPage === options.page &&
          options.view.startPage !== 0) ||
        (options.view.endPage === options.page &&
          options.page + 1 !== options.totalPages)
      ) {
        const className = classNames(options.className, { "p-disabled": true });

        return (
          <span className={className} style={{ userSelect: "none" }}>
            ... {options.page + 1}
          </span>
        );
      }

      return (
        <button
          type="button"
          className={options.className}
          onClick={options.onClick}
        >
          {options.page + 1}
          <Ripple />
        </button>
      );
    },
  };

  const onPageChangeLocal = (e) => {
    onPageChange(e);
  };

  return (
    <div className="custom-paginator">
      <Paginator
        template={template1}
        first={first}
        rows={rows}
        totalRecords={totalRecords}
        onPageChange={onPageChangeLocal}
      />
    </div>
  );
}
