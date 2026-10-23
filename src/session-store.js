const fs = require("node:fs");
const path = require("node:path");

const dataDirectory = path.join(__dirname, "..", "data");
const stateFile = path.join(dataDirectory, "session-state.json");

function createDefaultState() {
    return {
        active: false,
        startedAt: null,
        startedBy: null,
        lastEndedAt: null,
        lastEndedBy: null,
        lastDurationMs: null
    };
}

function loadSession() {
    try {
        const savedState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
        return { ...createDefaultState(), ...savedState };
    } catch (error) {
        if (error.code === "ENOENT") return createDefaultState();
        throw new Error(`Could not read session state: ${error.message}`);
    }
}

function saveSession(state) {
    fs.mkdirSync(dataDirectory, { recursive: true });
    const temporaryFile = `${stateFile}.tmp`;
    fs.writeFileSync(temporaryFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryFile, stateFile);
}

module.exports = { loadSession, saveSession };
