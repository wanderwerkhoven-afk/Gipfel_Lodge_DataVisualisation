// ./JS/state.js
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
  rawRows: [],
  kpiYear: "ALL",
  currentYear: new Date().getFullYear(),
  cumulativeYear: null,
  currentSeason: "all",
  currentMode: "gross",

  charts: {
    homeBar: null,
    cumulative: null,
  },

  // ✅ occupancy page
  occupancyYear: "ALL",
  occupancyMonth: null,
  showPlatform: true,
  showOwner: true,
};

export function setState(patch) {
  Object.assign(state, patch);
}
