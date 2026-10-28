// CSV export. Every cell is quoted; a cell a spreadsheet could read as a
// formula is prefixed with an apostrophe.
export const csvColumns = [
  ["reference", "Reference"],
  ["created_at", "Received (UTC)"],
  ["status", "Status"],
  ["contacted_at", "Contacted (UTC)"],
  ["name", "Name"],
  ["email", "Work email"],
  ["company", "Company"],
  ["role", "Role"],
  ["building_type", "Building type"],
  ["floor_area", "Total floor area"],
  ["building_count", "Number of buildings"],
  ["bms", "Building management system"],
  ["bms_name", "Which BMS"],
  ["energy_spend", "Annual energy spend"],
  ["improve", "What they want to improve"],
  ["phone", "Phone"],
  ["source_url", "Source page"],
  ["utm_source", "utm_source"],
  ["utm_medium", "utm_medium"],
  ["utm_campaign", "utm_campaign"],
  ["utm_term", "utm_term"],
  ["utm_content", "utm_content"],
];

export function csvCell(value) {
  let text = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows) {
  const lines = [csvColumns.map(([, label]) => csvCell(label)).join(",")];
  for (const row of rows) lines.push(csvColumns.map(([key]) => csvCell(row[key])).join(","));
  // Byte order mark so spreadsheet apps read UTF-8 names correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
