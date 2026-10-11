/** Upload layout of the Talkbot call results (FRS LEAD-09 chapter 13), shared by the upload and its template. */

/** The columns BrokerVerse reads from the call records file (FR-TBT-010 R2); any other column is ignored. */
export const CALL_RECORD_COLUMNS = [
  { key: 'taskName', header: 'Task Name', required: true, format: 'Text; the same for all rows', example: 'TIS_MV - OCT 07, 2026' },
  { key: 'contactId', header: 'Contact ID', required: 'Contact ID or Contact Number', format: 'Policy number on the call list', example: 'POL-2025-41187' },
  { key: 'callId', header: 'Call ID', required: true, format: 'Text; unique', example: '3422766876' },
  { key: 'contactName', header: 'Contact Name', format: 'Text', example: 'ANDREA M. VILLANUEVA' },
  { key: 'contactNumber', header: 'Contact Number', required: true, format: '11 digits', example: '09173047105' },
  { key: 'result', header: 'Result', required: true, format: 'Talkbot telephony result', example: 'Connected(200)' },
  { key: 'callTime', header: 'Call Time', required: true, format: 'DD/MM/YYYY HH:MM:SS (Manila time)', example: '07/10/2026 14:52:10' },
  { key: 'duration', header: 'Call Duration', format: 'Whole seconds', example: '96' },
  { key: 'tags', header: 'Tags', format: 'Text', example: 'Call Drop-off Point:Closing;Call Result:Will Renew' },
  { key: 'dropOffPoint', header: 'Call Drop-off Point', format: 'Text', example: 'Closing' },
  { key: 'callStatus', header: 'Call Status', format: 'Text', example: '' },
  { key: 'callResult', header: 'Call Result', format: 'Will Renew, Will not Renew, Not Interested, Undecided, Unspecified', example: 'Will Renew' },
  { key: 'callbackDate', header: 'Date of Callback', format: 'YYYY-MM-DD', example: '' },
];
