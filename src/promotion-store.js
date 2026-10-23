const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const dataDirectory = path.join(__dirname, "..", "data");
const stateFile = path.join(dataDirectory, "promotions.json");

function loadState() {
    try {
        const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
        return { promotions: [], ...state };
    } catch (error) {
        if (error.code === "ENOENT") return { promotions: [] };
        throw new Error(`Could not read promotion records: ${error.message}`);
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

function createPromotion(record) {
    const state = loadState();
    let id;
    do {
        id = `SC-PROMO-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    } while (state.promotions.some((promotion) => promotion.id === id));

    const promotion = { ...record, id };
    state.promotions.push(promotion);
    saveState(state);
    return promotion;
}

function getPromotion(id) {
    return loadState().promotions.find((promotion) => promotion.id === normalizeId(id)) || null;
}

function updatePromotion(id, changes) {
    const state = loadState();
    const index = state.promotions.findIndex((promotion) => promotion.id === normalizeId(id));
    if (index === -1) return null;

    state.promotions[index] = { ...state.promotions[index], ...changes };
    saveState(state);
    return state.promotions[index];
}

function deletePromotion(id) {
    const state = loadState();
    const remaining = state.promotions.filter((promotion) => promotion.id !== normalizeId(id));
    if (remaining.length === state.promotions.length) return false;
    saveState({ ...state, promotions: remaining });
    return true;
}

function listPromotionsForMember(memberId) {
    return loadState().promotions
        .filter((promotion) => promotion.memberId === memberId)
        .sort((left, right) => right.issuedAt - left.issuedAt);
}

module.exports = {
    createPromotion,
    deletePromotion,
    getPromotion,
    listPromotionsForMember,
    updatePromotion
};