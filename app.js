// Global variables
let HR_MAX = 190; // Will be updated from data
let chart;
let allRuns = []; // Store all runs globally
let tcxDataCache = {}; // Cache TCX file data by filename
let z2Upper = 0.75;
let z3Upper = 0.85;
let z4Upper = 0.9;
let z5Upper = 0.95;

let stravaData = [];
let oldRuns = [];