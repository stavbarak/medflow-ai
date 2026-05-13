"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.looksLikeQuestion = looksLikeQuestion;
function looksLikeQuestion(text) {
    const t = text.trim();
    if (!t) {
        return false;
    }
    if (t.endsWith('?')) {
        return true;
    }
    const prefixes = /^(מה|איפה|מתי|מי|למה|איך|כמה|האם|יש|נשאר|צריך|באיזה|איזה|היכן)/u;
    return prefixes.test(t);
}
//# sourceMappingURL=question-heuristic.js.map