function formatTimestamp(timestamp) {
    return new Date(timestamp).toISOString();
}

function validateInput(data, schema) {
    const { error } = schema.validate(data);
    return error ? error.details[0].message : null;
}

module.exports = {
    formatTimestamp,
    validateInput,
};