import React, { useState } from "react";
import * as Color from "../../TextColor";
import "./index.scss"


const ReadMoreText = ({ children, maxCharCount, isBold, alignment, fontSizes, isUnderline, isItalic, minCharCount }) => {
    const [showText, setShowText] = useState(false);
    const content = showText ? children : children.slice(0, maxCharCount);

    const textStyle = {
        fontWeight: isBold ? 'bold' : 'lighter',
        textAlign: alignment || 'left',
        color: Color.darkGrey,
        fontSize: fontSizes,
        textDecoration: isUnderline ? 'underline' : 'none',
        fontStyle: isItalic ? "italic" : "none",
    };
    return (

        <div style={textStyle}>{content}
            {children.length > maxCharCount && !showText && (
                <span
                    className="read__more"
                    onClick={() => setShowText(true)}
                >
                    ...Read more
                </span>
            )}
            {children.length > minCharCount && showText && (
                <span
                    className="read__more"
                    onClick={() => setShowText(false)}
                >
                    Read less
                </span>
            )}
        </div>


    )
}
export default ReadMoreText