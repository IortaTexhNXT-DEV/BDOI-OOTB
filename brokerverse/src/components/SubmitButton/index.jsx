import { useEffect } from "react";
import { Button } from "primereact/button";
import "./index.scss";
import { useNavigate } from "react-router-dom";

const SubmitButton = ({
  handleSubmit,
  label,
  setVisible,
  visible,
  navigation,
  visiblechange,
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (visiblechange) {
      navigate(`/${navigation}`);
    }
  }, [visiblechange]);

  return (
    <div>
      <Button
        label={label}
        className="submit_button p-0"
        rounded
        handleSubmit={handleSubmit}
      />

      </div>

  );
};

export default SubmitButton;
