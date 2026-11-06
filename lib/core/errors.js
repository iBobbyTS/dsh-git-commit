// src/core/errors.ts
function details(error) {
	return error !== null && typeof error === "object" ? error : { message: String(error) };
}
export { details };

//# sourceMappingURL=errors.js.map