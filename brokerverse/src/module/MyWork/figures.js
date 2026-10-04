import { getRequest } from "../../utility/commonServices";

/**
 * Home figures of My Work (GET /my-work/figures): the role preset the server chose, the user's role, branch and
 * company for the subtitle, and the two or three figures of the role shown next to the My Work header figures.
 */
export const fetchFigures = () => getRequest("my-work/figures").then((r) => r.data.data);
