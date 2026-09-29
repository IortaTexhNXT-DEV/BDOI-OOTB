import { createAsyncThunk } from "@reduxjs/toolkit";
import { POST_UPLOAD_ENDROSMENT } from "../../../../redux/actionTypes";





export const postEndromentMiddleWare = createAsyncThunk(
    POST_UPLOAD_ENDROSMENT,
    async (payload, { rejectWithValue }) => {
        console.log(payload.production, "payload");
        let data = {
            policyNumber: payload?.policyNumber,
            endrosementNumber: payload?.endrosementNumber,
            // production: payload?.production,
            // inception: payload?.inception,
            // issuedDate: payload?.issuedDate,
            // expiry: payload?.expiry,
            production: payload?.production.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            inception: payload?.inception.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            issuedDate: payload?.issuedDate.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            expiry: payload?.expiry.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
        };
        try {
            console.log(data, "datadata");
            return data
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);