/**
 * Non-packaged (bespoke) placements: clause library and slip templates, slip composer, underwriter rooms, layering and
 * co-insurance ledger, facultative reinsurance binders. See README.md.
 */
import { clauseRouter, composerRouter, templateRouter } from './composerRouter.js';
import { linkRouter, roomRouter } from './roomRouter.js';
import { layersRouter } from './layersRouter.js';

export default composerRouter;
export const mount = '/bespoke/slips';
export const extraMounts = [
  ['/bespoke/clauses', clauseRouter],
  ['/bespoke/slip-templates', templateRouter],
  ['/bespoke/rooms', roomRouter],
  ['/bespoke/underwriter-link', linkRouter],
  ['/bespoke/layers', layersRouter],
];
