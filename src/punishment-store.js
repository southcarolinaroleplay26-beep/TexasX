const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const dataDirectory = path.join(__dirname, "..", "data");
const stateFile = path.join(dataDirectory, "punishments.json");

function loadState() {
    try {
        const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
        return { infractions: [], ...state };
    } catch (error) {
        if (error.code === "ENOENT") return { infractions: [] };
        throw new Error(`Could not read punishment records: ${error.message}`);
    }
}

function saveState(state) {
    fs.mkdirSync(dataDirectory, { recursive: true });
    const temporaryFile = `${stateFile}.tmp`;
    fs.writeFileSync(temporaryFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryFile, stateFile);
}

function normalizeId(id) {
    return id.trim().toUpperCase();
}

function createInfraction(record) {
    const state = loadState();
    let id;
    do {
        id = `SC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    } while (state.infractions.some((infraction) => infraction.id === id));

    const infraction = { ...record, id };
    state.infractions.push(infraction);
    saveState(state);
    return infraction;
}

function getInfraction(id) {
    return loadState().infractions.find((infraction) => infraction.id === normalizeId(id)) || null;
}

function updateInfraction(id, changes) {
    const state = loadState();
    const index = state.infractions.findIndex((infraction) => infraction.id === normalizeId(id));
    if (index === -1) return null;

    state.infractions[index] = { ...state.infractions[index], ...changes };
    saveState(state);
    return state.infractions[index];
}

function deleteInfraction(id) {
    const state = loadState();
    const remaining = state.infractions.filter((infraction) => infraction.id !== normalizeId(id));
    if (remaining.length === state.infractions.length) return false;
    saveState({ ...state, infractions: remaining });
    return true;
}

function listInfractionsForMember(memberId) {
    return loadState().infractions
        .filter((infraction) => infraction.memberId === memberId)
        .sort((left, right) => right.issuedAt - left.issuedAt);
}

module.exports = {
    createInfraction,
    deleteInfraction,
    getInfraction,
    listInfractionsForMember,
    updateInfraction
};