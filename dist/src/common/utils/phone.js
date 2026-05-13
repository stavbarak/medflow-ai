"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIsraeliPhone = normalizeIsraeliPhone;
function normalizeIsraeliPhone(input) {
    const digits = input.replace(/\D/g, '');
    if (digits.startsWith('972')) {
        return digits;
    }
    if (digits.startsWith('0')) {
        return `972${digits.slice(1)}`;
    }
    if (digits.length === 9) {
        return `972${digits}`;
    }
    return digits;
}
//# sourceMappingURL=phone.js.map