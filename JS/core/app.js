// ./JS/core/app.js
export const CONFIG = {
  NET_FACTOR: 0.76,
  DAYS_IN_YEAR: 365,
  SEASON_MAP: {
    winter: [11, 0, 1, 2],
    spring: [3, 4],
    summer: [5, 6, 7],
    autumn: [8, 9, 10],
  },
};

export const state = {
  // data
  rawRows: [],

  // year filters
  kpiYear: "ALL",
  currentYear: new Date().getFullYear(),
  cumulativeYear: null,

  // filters / mode
  currentSeason: "all",
  currentMode: "gross",

  // charts instances
  charts: {
    homeBar: null,
    cumulative: null,
    // (weekStack mag weg als je weekchart verwijderd hebt)
    // weekStack: null,
  },

  // pricing "database"
  pricingByDate: {},        // "YYYY-MM-DD" -> pricing record
  pricingYearLoaded: null,  // number

  // occupancy page
  occupancyYear: "ALL",
  occupancyMonth: null,
  showPlatform: true,
  showOwner: true,

  // scroll preservation
  scroll: {
    windowY: 0,
    containers: {},
  },
};

export function setState(patch) {
  Object.assign(state, patch);
}