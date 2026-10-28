// The inquiry form contract: exact field names, choices and length caps.
// The server is the authority; index.html offers the same choices and
// tests/unit/fields.test.mjs proves the two agree.

export const choices = {
  buildingType: ["Office", "Retail", "Healthcare", "Education", "Hotel", "Industrial or warehouse", "Mixed use", "Other"],
  floorArea: ["Under 50,000 sq ft", "50,000 to 200,000 sq ft", "200,000 to 500,000 sq ft", "Over 500,000 sq ft", "Not sure"],
  role: ["Owner or executive", "Facilities or engineering", "Energy or sustainability", "Property manager", "Other"],
  buildingCount: ["1", "2 to 5", "6 to 20", "More than 20"],
  bms: ["Yes", "No", "Not sure"],
  energySpend: ["Under $100,000", "$100,000 to $500,000", "$500,000 to $1M", "Over $1M", "Prefer not to say"],
};

// name: [required, max length]. Choice fields are capped by their options.
export const fields = {
  name: [true, 100],
  email: [true, 160],
  company: [true, 120],
  buildingType: [true, 40],
  floorArea: [true, 40],
  role: [false, 40],
  buildingCount: [false, 20],
  bms: [false, 20],
  bmsName: [false, 80],
  energySpend: [false, 40],
  improve: [false, 1000],
  phone: [false, 40],
};
export const fieldNames = Object.keys(fields);

export const messages = {
  required: {
    name: "Enter your name.",
    email: "Enter your work email.",
    company: "Enter your company.",
    buildingType: "Choose a building type.",
    floorArea: "Choose a floor area.",
  },
  email: "Enter an email address like name@company.com.",
  phone: "Enter a phone number using digits, spaces, + or brackets.",
  choice: "Choose an option from the list.",
  characters: "Remove unsupported characters.",
  text: "Use text for this field.",
  tooLong: (max) => `Use ${max.toLocaleString("en-US")} characters or fewer.`,
};

const EMAIL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const PHONE = /^\+?[0-9 ().-]{7,40}(?:\s*(?:x|ext\.?)\s*[0-9]{1,6})?$/i;
// C0/C1 controls and bidirectional overrides never belong in an answer.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
const LINE_BREAK = /[\t\r\n\u2028\u2029]/;

// Returns trimmed answers (empty string for a skipped optional field) and a
// message per invalid field. Unknown keys are the caller's concern.
export function validate(input) {
  const source = input && typeof input === "object" ? input : {};
  const data = {};
  const errors = {};
  for (const [field, [required, max]] of Object.entries(fields)) {
    const raw = source[field];
    if (raw !== undefined && typeof raw !== "string") {
      errors[field] = messages.text;
      data[field] = "";
      continue;
    }
    let value = (raw ?? "").trim();
    if (field === "improve") value = value.replace(/\r\n?|[\u2028\u2029]/g, "\n");
    data[field] = value;
    if (!value) {
      if (required) errors[field] = messages.required[field];
    } else if (value.length > max) errors[field] = messages.tooLong(max);
    else if (CONTROL.test(value) || (field !== "improve" && LINE_BREAK.test(value))) errors[field] = messages.characters;
    else if (choices[field] && !choices[field].includes(value)) errors[field] = messages.choice;
    else if (field === "email" && !EMAIL.test(value)) errors[field] = messages.email;
    else if (field === "phone" && !PHONE.test(value)) errors[field] = messages.phone;
  }
  // "Which one?" belongs to a building management system the visitor has.
  if (!errors.bmsName && data.bmsName && data.bms !== "Yes") data.bmsName = "";
  return { data, errors };
}

export const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

// Campaign parameters from the page query string, cleaned and capped. Every
// other parameter (including any preview share token) is discarded.
export function readUtm(search) {
  const params = new URLSearchParams(typeof search === "string" ? search.slice(0, 2000) : "");
  const utm = {};
  for (const key of utmKeys) {
    const value = params.get(key)?.replace(new RegExp(CONTROL.source, "g"), "").replace(new RegExp(LINE_BREAK.source, "g"), " ").trim().slice(0, 100);
    if (value) utm[key] = value;
  }
  return utm;
}

// Only a same-site path is kept as the source page; never a query or hash.
export function readSourcePath(value) {
  if (typeof value !== "string" || value.length > 200 || !/^\/[A-Za-z0-9/._~-]*$/.test(value) || value.includes("..")) return "/";
  return value;
}
