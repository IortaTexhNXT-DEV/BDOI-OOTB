import { InputTextarea } from "primereact/inputtextarea";
import "./index.scss";
import LabelWrapper from "../LabelWrapper";

const TextAreaInput = ({
  label,
  cols,
  subText,
  name,
  inputClassName,
  value,
  onChange,
  error,
  required,
}) => {
  return (
    <div className="input__text__container full__width">
      <LabelWrapper textSize={true} textColor={false} label={label}>
        {required && <span className="required__label">*</span>}
        <div className="sub__title">{subText}</div>

        <InputTextarea
          cols={cols}
          className={inputClassName}
          name={name}
          onChange={onChange}
          value={value}
        />
        {error && <div className="formik__error">{error}</div>}
      </LabelWrapper>
    </div>
  );
};

export default TextAreaInput;
